"""SSRF koruması: yalnız genel internet adreslerine çıkılır.

check_url: URL biçimi + sunucu adının tüm IP'leri. PinnedTransport: her bağlantıyı (yönlendirmeler dahil) kendi
çözüp doğruladığı IP'ye sabitler; sorgu ile bağlantı arasında DNS değişse (rebinding) iç ağa çıkılamaz.
KAZI_ALLOW_PRIVATE=1 yalnız IP/ad denetimini kapatır (testler, yerel kullanım).
"""
from __future__ import annotations

import ipaddress
import os
import re
import socket

import httpx

from .core import UA

MAX_URL = 2048
DENY = "Bu adres iç ağa ya da özel bir adrese gidiyor; güvenlik için açılmaz."
BAD = "Adres geçersiz."
_CTRL = re.compile(r"[\x00-\x1f\x7f\\]")
_LOCAL = (".localhost", ".local", ".internal", ".localdomain", ".home.arpa")
_V4_DENY = tuple(ipaddress.ip_network(n) for n in (
    "0.0.0.0/8", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12", "192.0.0.0/24",
    "192.0.2.0/24", "192.88.99.0/24", "192.168.0.0/16", "198.18.0.0/15", "198.51.100.0/24", "203.0.113.0/24",
    "224.0.0.0/4", "240.0.0.0/4"))
_V6_OK = ipaddress.ip_network("2000::/3")
_V6_DENY = (ipaddress.ip_network("2001::/32"), ipaddress.ip_network("2002::/16"))  # Teredo, 6to4
_HEX, _DEC, _OCT = re.compile(r"0[xX][0-9a-fA-F]*"), re.compile(r"[0-9]+"), re.compile(r"0[0-7]+")
_resolve = socket.getaddrinfo


class UnsafeURL(RuntimeError):
    """Adres geçersiz ya da izin verilmeyen bir yere gidiyor; mesaj kullanıcıya gösterilebilir."""


def allow_private() -> bool:
    return os.environ.get("KAZI_ALLOW_PRIVATE") == "1"


def _num(p: str) -> int | None:
    if _HEX.fullmatch(p):
        return int(p[2:] or "0", 16)
    if not _DEC.fullmatch(p):
        return None
    if len(p) > 1 and p[0] == "0":
        return int(p, 8) if _OCT.fullmatch(p) else None
    return int(p)


def _ipv4_loose(host: str) -> ipaddress.IPv4Address | None:
    """Tarayıcı (WHATWG) gibi IPv4: 2130706433, 0x7f000001, 017700000001, 127.1 → 127.0.0.1.
    Ad sayıyla bitmiyorsa None; sayıyla bitip bozuksa UnsafeURL."""
    parts = host.split(".")
    if len(parts) > 1 and parts[-1] == "":
        parts.pop()
    if not (_DEC.fullmatch(parts[-1]) or _HEX.fullmatch(parts[-1])):
        return None
    nums = [_num(p) for p in parts]
    if len(parts) > 4 or None in nums or any(n > 255 for n in nums[:-1]) or nums[-1] >= 256 ** (5 - len(parts)):
        raise UnsafeURL(BAD)
    return ipaddress.IPv4Address(sum(n << (8 * (3 - i)) for i, n in enumerate(nums[:-1])) + nums[-1])


def _literal(host: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    """Sunucu adı IP ise (IPv6, noktalı/ondalık/hex/sekizli IPv4) o IP; ad ise None."""
    h = host.lower()
    if ":" in h:
        try:
            return ipaddress.IPv6Address(h)
        except ValueError as e:
            raise UnsafeURL(BAD) from e
    return _ipv4_loose(h)


def why_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> str | None:
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is None:
            ok = ip in _V6_OK and ip.is_global and not any(ip in n for n in _V6_DENY)
            return None if ok else DENY
        ip = ip.ipv4_mapped
    bad = any(ip in n for n in _V4_DENY) or not ip.is_global or ip.is_multicast
    return DENY if bad else None


def _lookup(name: str, port: int) -> list[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    try:
        infos = _resolve(name, port, type=socket.SOCK_STREAM)
        ips = list(dict.fromkeys(ipaddress.ip_address(i[4][0].split("%")[0]) for i in infos))
    except (OSError, UnicodeError, ValueError, IndexError) as e:
        raise UnsafeURL("Site adı bulunamadı; adresi kontrol edin.") from e
    if not ips:
        raise UnsafeURL("Site adı bulunamadı; adresi kontrol edin.")
    return ips


def host_ips(host: str, port: int) -> list[str]:
    """Sunucunun bağlanılacak IP'leri. Herhangi bir kaydı iç/özel ise UnsafeURL (tüm A/AAAA kayıtları denetlenir)."""
    name = host.lower().removesuffix(".")
    if not name or not name.isascii() or "%" in name:
        raise UnsafeURL(BAD)
    ips = [lit] if (lit := _literal(host)) is not None else None
    private = allow_private()
    if ips is None:
        if not private and (name == "localhost" or name.endswith(_LOCAL)):
            raise UnsafeURL(DENY)
        ips = _lookup(name, port)
    if not private and any(why_blocked(ip) for ip in ips):
        raise UnsafeURL(DENY)
    return [str(ip) for ip in ips]


def parse_url(url: str) -> httpx.URL:
    if not isinstance(url, str) or not url.strip():
        raise UnsafeURL("Adres boş.")
    if len(url) > MAX_URL:
        raise UnsafeURL(f"Adres çok uzun (en fazla {MAX_URL} karakter).")
    if _CTRL.search(url):
        raise UnsafeURL(BAD)
    try:
        u = httpx.URL(url.strip())
    except Exception as e:  # httpx.InvalidURL ve ayrıştırıcı hataları
        raise UnsafeURL(BAD) from e
    if u.scheme not in ("http", "https") or not u.host:
        raise UnsafeURL("Adres http:// ya da https:// ile başlamalı.")
    if u.userinfo:
        raise UnsafeURL("Adreste kullanıcı adı ya da şifre olamaz.")
    return u


def _host(u: httpx.URL) -> str:
    return u.raw_host.decode("ascii", "replace")  # IDN adlar punycode (xn--...) olarak


def _port(u: httpx.URL) -> int:
    return u.port or (443 if u.scheme == "https" else 80)


def check_url(url: str) -> list[str]:
    """Adres açılabilir mi: yalnız http/https, kullanıcı bilgisi yok, tüm IP'ler genel internette. IP'leri döndürür."""
    u = parse_url(url)
    return host_ips(_host(u), _port(u))


def redirect_check(url: str) -> str | None:
    """core.scrape(check=...) kancası: None serbest, metin engel nedeni."""
    try:
        check_url(url)
    except UnsafeURL as e:
        return str(e)
    return None


def _inner_transport() -> httpx.BaseTransport:
    return httpx.HTTPTransport(limits=httpx.Limits(max_keepalive_connections=0))


class PinnedTransport(httpx.BaseTransport):
    """Her isteği, adı kendisi çözüp doğruladığı IP'ye bağlar. Host başlığı ve TLS sunucu adı (SNI) özgün kalır."""

    def __init__(self) -> None:
        self._inner = _inner_transport()

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        u = request.url
        if u.scheme not in ("http", "https"):
            raise UnsafeURL("Adres http:// ya da https:// ile başlamalı.")
        if allow_private():
            return self._inner.handle_request(request)
        host = _host(u)
        ips = host_ips(host, _port(u))
        ext = dict(request.extensions)
        if _literal(host) is None:
            ext["sni_hostname"] = host
        last: Exception | None = None
        for ip in ips:
            pinned = httpx.Request(request.method, u.copy_with(host=ip), headers=request.headers,
                                   stream=request.stream, extensions=ext)
            try:
                return self._inner.handle_request(pinned)
            except httpx.ConnectError as e:  # sıradaki IP'yi dene (örn. IPv6 yok)
                last = e
        raise last  # type: ignore[misc]

    def close(self) -> None:
        self._inner.close()


def guarded_client(timeout: float = 30.0) -> httpx.Client:
    """core.scrape/map_site için SSRF korumalı istemci; ortamdaki vekiller (HTTP_PROXY) kullanılmaz."""
    return httpx.Client(headers={"User-Agent": UA}, follow_redirects=True, timeout=timeout,
                        transport=PinnedTransport())
