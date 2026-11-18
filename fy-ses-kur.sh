#!/usr/bin/env bash
# ÜRETİLDİ — elle düzenleme. Kaynak: depoda ses-sunucu/ (kur.sh + ses_sunucu.py requirements.txt fy-ses.service fy-ses-tunel.service MODEL-LISANSI.md); üreten: ses-sunucu/paket.sh. Paket 14065af39fdf.
if grep -q $'\r' "$0" 2>/dev/null; then echo "Bu dosya Windows satır sonu (CRLF) taşıyor; yapıştırırken bozulmuş. Yeniden kopyala." >&2; exit 1; fi #
FY_KUR_OZET=17ddf61961ce963d3a6b5cd26951a9285ed73430cc21ca504bcb1551ab2a0868
if [ "$FY_KUR_OZET" != depo ] && [ "$(grep -v '^FY_KUR_OZET=' "$0" 2>/dev/null | sed -n '1,/^ana "\$@"$/p' | sha256sum | cut -c1-64)" != "$FY_KUR_OZET" ]; then echo "Bu dosya yapıştırırken bozulmuş (bir satır eksik ya da değişmiş; özet tutmuyor). Hiçbir şey yapılmadı. Yeniden kopyala; olmazsa SFTP ile yükle (docs/vps-ses.md §3)." >&2; exit 1; fi
# FY ses servisi — VPS kurulumu (Ubuntu 24.04, root olarak).  Ayrıntı ve sahibin adımları: docs/vps-ses.md
#
#   bash kur.sh <TÜNEL_TOKENI>   ilk kurulum: ses servisi + FY'nin tüneli (token: Cloudflare → Workers VPC → Tunnels)
#   bash kur.sh                  güncelleme / onarım: her şeyi yeniden kurar, tünel token'ına ve anahtara dokunmaz
#   KURU=1 bash kur.sh [token]   hiçbir şeye dokunmadan yalnızca ne yapacağını yazar
#   YENI_ANAHTAR=1 bash kur.sh   SES_KEY'i yeniler (sonra Worker'daki SES_KEY secret'ı da değişmeli)
#
# İPUCU: token'lı komutun başına bir BOŞLUK koy (« bash kur.sh eyJ…»): Ubuntu'da bash öyle satırları geçmişe yazmaz.
# İPUCU: tmux içinde çalıştır (tmux new -s fy); SSH koparsa «tmux attach -t fy» ile dönülür, kurulum yarıda kalmaz.
#
# Ne yapar: python3-venv, ffmpeg, curl, ca-certificates, openssl kurar (kurulu olanları YÜKSELTMEZ); «fyses» sistem
# kullanıcısını (giriş kabuğu yok) açar; servisi /opt/fy-ses'e, sürüm ve özetleriyle sabit Python paketlerini bir venv'e
# kurar; Supertonic 3 modelini SABİT bir revizyondan /var/lib/fy-ses/model'e indirip dosya özetlerini denetler;
# /etc/fy-ses.env (0600, root) içine yoksa «openssl rand -base64 32» ile SES_KEY yazar; sertleştirilmiş systemd birimini
# (yalnız 127.0.0.1:8790) kurar; cloudflared'i Cloudflare'in resmî, imzalı apt deposundan kurar ve token verildiyse onu
# /etc/fy-ses-tunel.env'e (0600, root) yazıp FY'nin KENDİ tünel birimini (fy-ses-tunel.service) açar.
# Ne YAPMAZ: SSH ayarına, güvenlik duvarına (ufw/iptables), öbür servislere dokunmaz; makinede başka bir cloudflared
# (cloudflared.service, /etc/cloudflared) varsa ona da dokunmaz; servisleri apt sonrası kendiliğinden yeniden başlatmaz
# (needrestart askıda); makineyi yeniden başlatmaz. Yeni kurulan paketlerin bağımlılığı gerektirirse apt bazı ortak
# kütüphaneleri güncelleyebilir (ör. ffmpeg'in istediği sürüm); bu apt'nin kendi kuralıdır. Defalarca çalıştırılabilir:
# her seferinde aynı sonuca varır; yarıda kalırsa (SSH koptu, apt kilitliydi) aynı komutu yeniden çalıştırmak yeter.
set -Eeuo pipefail
umask 022
# needrestart (Ubuntu 24.04) apt'den sonra öbür servisleri kendiliğinden yeniden başlatmasın; onnxruntime telemetrisi kapalı
export LC_ALL=C.UTF-8 DEBIAN_FRONTEND=noninteractive NEEDRESTART_SUSPEND=1 NEEDRESTART_MODE=l ORT_DISABLE_TELEMETRY=1

# --- Gömülü servis dosyaları (paket.sh) ---
gomulu_yaz() {
  mkdir -p "$1"
  cat > "$1/ses_sunucu.py" <<'FY_SES_SES_SUNUCU_PY_SON'
#!/usr/bin/env python3
"""FY ses servisi — FY'nin yanıtlarını sahibinin VPS'inde Supertonic 3 ile MP3'e çevirir.

Yalnız 127.0.0.1:8790'da dinler. Ona ulaşan tek şey aynı makinedeki cloudflared'dir (Cloudflare Tunnel); Worker
oraya Workers VPC «VPC Service» bağlantısıyla gelir (docs/vps-ses.md). Açık port yok, genel adres yok.

Uçlar (ikisi de X-FY-Ses-Key başlığını ister; yoksa ya da tutmazsa 401):
  POST /v1/ses   gövde {"text": "...", "lang": "tr|de|en", "voice": "F4|M3"} → audio/mpeg (mono, 64 kbps, 24 kHz)
  GET  /saglik   {"ok": true, "model": "supertonic-3", "voices": [...], "langs": [...]} — sır yok

Kurallar (docs/vps-ses.md «Ses servisi»):
  - Anahtar sabit zamanlı karşılaştırılır (hmac.compare_digest); anahtarı systemd /etc/fy-ses.env'den (0600, root) okur.
    Anahtarsız ya da kısa anahtarla servis hiç açılmaz (fail-closed).
  - Metin en çok 500 karakter (Worker'ın MAX_TTS_CHARS'ı); boş, uzun, bilinmeyen dil ya da ses → 400.
    Farsça (fa) bu modelde yok: 400 «dil» (Worker zaten göndermez; Farsça tarayıcının sesiyle okunur).
  - «FY» modelde yanlış okunuyor: dile göre okunuşu yazılır (tr «Ef Ye», de «Eff Ypsilon», en «Eff Why»; yalnız
    büyük harfle ve tek başına «FY» — «FYOS» ya da «fy» değişmez). «Melis» olduğu gibi kalır.
  - Eşzamanlılık sınırlı: aynı anda ESZAMANLI sentez, içeride en çok KUYRUK istek; dolunca hemen 503 «mesgul»,
    sırada BEKLEME_SN'den uzun bekleyen de 503 «mesgul». Süre bütçesi: Worker X-FY-Ses-Sure-Ms başlığıyla kendi kalan
    süresini yollar (sitede 9500, Telegram'da 14500; yoksa SURE_VARSAYILAN, tavan SURE_SN) — Worker vazgeçtikten sonra
    CPU harcanmasın diye bütçe sıra beklemesini de kapsar; metnin uzunluğundan tahmin edilen süre bütçeye sığmıyorsa iş
    hiç başlamaz, parçalar arasında da denetlenir: 503 «zaman».
  - Bağlantı başına bir iş parçacığı ve her yanıttan sonra «Connection: close»: boşta bekleyen keep-alive soketi iş
    parçacığı tutmaz; aynı anda en çok EN_COK_BAGLANTI bağlantı, fazlası yanıtsız kapatılır (sentezi aç bırakmasın).
  - Kayda (journald) yalnız durum, dil, uzunluk ve süre yazılır: metin, anahtar, istek başlıkları ASLA.
    İstemciye yığın izi ya da sağlayıcı/model hata metni gitmez; yalnız kısa bir kod ({"hata": "..."}). İstemci yanıtı
    beklemeden kopsa da yığın izi ya da karşı adres kayda düşmez (Sunucu.handle_error yalnız istisnanın türünü yazar).
  - onnxruntime'ın Microsoft telemetrisi (1DS: aygıt kimliği dosyası + mobile.events.data.microsoft.com) KAPALI:
    ORT_DISABLE_TELEMETRY=1 onnxruntime yüklenmeden önce konur (birim ve kur.sh da koyar), yüklenince de kapatılır.
  - Model ağdan indirilmez: kur.sh sabit bir revizyonu önceden indirir; servis auto_download=False ile açılır.

Bağımlılıklar requirements.txt'te sürüm ve özetiyle sabit; MP3 için sistemin ffmpeg'i (apt).
Model: Supertone/supertonic-3, lisansı BigScience OpenRAIL-M (MODEL-LISANSI.md; tam metin model klasöründe LICENSE).
Yerel deneme: ses-sunucu/test_ses.py.
"""

import os

# onnxruntime (Supertonic'in altında) Linux'ta da Microsoft'a telemetri yollar ve ~/.cache/Microsoft altına bir aygıt
# kimliği yazar; değişken kütüphane yüklenmeden ÖNCE konmalı. Kullanıcı ayarıyla açılamaz (setdefault değil).
os.environ['ORT_DISABLE_TELEMETRY'] = '1'

import hmac  # noqa: E402
import json  # noqa: E402
import logging  # noqa: E402
import re  # noqa: E402
import subprocess  # noqa: E402
import sys  # noqa: E402
import threading  # noqa: E402
import time  # noqa: E402
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer  # noqa: E402

HOST = '127.0.0.1'                     # sabit: ayarla değişmez, servis dışarıya asla açılmaz


def _sayi(ad, varsayilan, tur=int, en_az=None, en_cok=None):
    """Ortam değişkenini sayıya çevirir; bozuk ya da sınır dışıysa varsayılan."""
    try:
        v = tur(os.environ.get(ad, varsayilan))
    except (TypeError, ValueError):
        return varsayilan
    if (en_az is not None and v < en_az) or (en_cok is not None and v > en_cok):
        return varsayilan
    return v


PORT = _sayi('FY_SES_PORT', 8790, int, 1024, 65535)
MAX_METIN = 500                        # Worker'ın MAX_TTS_CHARS'ı ile aynı
MAX_GOVDE = 8 * 1024                   # 500 karakter Farsça/Türkçe + JSON payı rahat sığar
DILLER = ('tr', 'de', 'en')
SESLER = ('F4', 'M3')                  # F4 = Melis (FY'nin sesi), M3 = ikinci ses
VARSAYILAN_SES = 'F4'
ESZAMANLI = _sayi('FY_SES_ESZAMANLI', 2, int, 1, 8)
KUYRUK = max(ESZAMANLI, _sayi('FY_SES_KUYRUK', 4, int, 1, 32))
BEKLEME_SN = _sayi('FY_SES_BEKLEME', 4.0, float, 0.1, 30.0)
SURE_SN = _sayi('FY_SES_SURE', 15.0, float, 1.0, 120.0)   # mutlak tavan (Telegram bütçesi 14,5 sn sığsın)
SURE_VARSAYILAN = min(SURE_SN, 9.5)    # başlık yoksa: sitedeki Worker 10 sn bekler, fazlası boşa iş
HARF_MS = _sayi('FY_SES_HARF_MS', 12.0, float, 0.0, 200.0)   # süre tahmini: harf başına (4 vCPU'da tek istek ~12-13 ms)
TAHMIN_TABAN_SN = 0.3                  # süre tahmini: sabit pay (model çağrısı + ffmpeg)
EN_COK_BAGLANTI = _sayi('FY_SES_BAGLANTI', 32, int, 4, 256)
ADIM = _sayi('FY_SES_ADIM', 8, int, 1, 32)          # Supertonic total_steps (yüksek = daha iyi, yavaş)
HIZ = _sayi('FY_SES_HIZ', 1.05, float, 0.7, 2.0)
SESSIZLIK_SN = 0.3                     # parçalar arası sessizlik (Supertonic'in varsayılanı)
MP3_KBPS = 64
MP3_HZ = 24000
MODEL_ADI = 'supertonic-3'
MODEL_DIZIN = os.environ.get('SUPERTONIC_CACHE_DIR') or '/var/lib/fy-ses/model'
ANAHTAR_EN_AZ = 32                     # «openssl rand -base64 32» 44 karakter verir

FY_OKUNUS = {'tr': 'Ef Ye', 'de': 'Eff Ypsilon', 'en': 'Eff Why'}
# Tek başına, büyük harfle «FY»: önünde/arkasında harf, rakam ya da _ yok. «FY'nin» → «Ef Ye'nin»; «FYOS» değişmez.
FY_RE = re.compile(r'(?<!\w)FY(?!\w)')

log = logging.getLogger('fy-ses')


def tahmin(n):
    """n harflik sentezin tahmini süresi (sn). İyimser: tahmini aşan iş yine de parçalar arasında kesilir."""
    return TAHMIN_TABAN_SN + n * HARF_MS / 1000.0


class Hata(Exception):
    """İstemciye yalnız kodu gidecek, beklenen hata (durum + kısa kod)."""

    def __init__(self, durum, kod):
        super().__init__(kod)
        self.durum = durum
        self.kod = kod


def fy_oku(metin, dil):
    return FY_RE.sub(FY_OKUNUS[dil], metin)


class Motor:
    """Model bir kez yüklenir; ses stilleri önceden okunur. Sentez parça parça yapılır ki süre tavanı parçalar
    arasında denetlenebilsin (çalışan bir ONNX çağrısı yarıda kesilemez; parça en çok ~300 karakter, birkaç saniye)."""

    def __init__(self, model_dizin):
        import numpy as np                      # noqa: F401 — bağımlılık yoksa açılışta düşsün
        import onnxruntime
        from supertonic import TTS
        from supertonic.utils import chunk_text
        if hasattr(onnxruntime, 'disable_telemetry_events'):
            onnxruntime.disable_telemetry_events()    # ikinci kat (asıl kapı: yukarıdaki ORT_DISABLE_TELEMETRY)
        self._np = np
        self._parcala = chunk_text
        self.tts = TTS(model=MODEL_ADI, model_dir=model_dizin, auto_download=False)
        self.hz = int(self.tts.sample_rate)
        self.stiller = {ad: self.tts.get_voice_style(ad) for ad in SESLER}
        self._isleyici = getattr(getattr(self.tts, 'model', None), 'text_processor', None)
        self._harf = {}
        self._harf_kilit = threading.Lock()

    def _destekli(self, c):
        """Model bu karakteri okuyabiliyor mu (sonuç önbellekte). Okuyamadığı karakter (emoji dışı semboller, başka
        yazılar) Supertonic'te bütün isteği ValueError ile düşürür; onun yerine boşluk konur."""
        v = self._harf.get(c)
        if v is None:
            try:
                v = bool(self._isleyici.validate_text(c)[0]) if self._isleyici is not None else True
            except Exception:                    # noqa: BLE001 — karakter denetimi asla isteği düşürmez
                v = False
            with self._harf_kilit:
                if len(self._harf) < 20000:
                    self._harf[c] = v
        return v

    def temizle(self, metin):
        metin = ''.join(c if self._destekli(c) else ' ' for c in metin)
        return re.sub(r'\s+', ' ', metin).strip()

    def sentez(self, metin, dil, ses, son_an):
        np = self._np
        stil = self.stiller[ses]
        parcalar = self._parcala(metin, 300) or [metin]
        dalgalar = []
        for i, p in enumerate(parcalar):
            if time.monotonic() + (tahmin(len(p)) if i else 0) > son_an:   # ilk parça için kabulde bakıldı
                raise Hata(503, 'zaman')
            dalga, _ = self.tts.synthesize(p, voice_style=stil, lang=dil, total_steps=ADIM, speed=HIZ)
            dalga = np.asarray(dalga, dtype=np.float32).reshape(-1)
            if i:
                dalgalar.append(np.zeros(int(SESSIZLIK_SN * self.hz), dtype=np.float32))
            dalgalar.append(dalga)
        if time.monotonic() > son_an:
            raise Hata(503, 'zaman')
        dalga = np.concatenate(dalgalar) if len(dalgalar) > 1 else dalgalar[0]
        pcm = (np.clip(dalga, -1.0, 1.0) * 32767.0).astype('<i2').tobytes()
        return mp3(pcm, self.hz, max(0.5, son_an - time.monotonic()))


def mp3(pcm, hz, sure):
    """16 bit PCM (mono) → MP3, sistemin ffmpeg'iyle; dosyaya yazmadan (stdin → stdout). Etiket (ID3) yazılmaz."""
    komut = ['ffmpeg', '-hide_banner', '-nostdin', '-loglevel', 'error',
             '-f', 's16le', '-ar', str(hz), '-ac', '1', '-i', 'pipe:0',
             '-ac', '1', '-ar', str(MP3_HZ), '-c:a', 'libmp3lame', '-b:a', '%dk' % MP3_KBPS,
             '-map_metadata', '-1', '-id3v2_version', '0', '-write_id3v1', '0', '-f', 'mp3', 'pipe:1']
    try:
        r = subprocess.run(komut, input=pcm, capture_output=True, timeout=sure, check=False)
    except subprocess.TimeoutExpired:
        raise Hata(503, 'zaman') from None
    except OSError:
        raise Hata(500, 'kodlama') from None
    if r.returncode != 0 or len(r.stdout) < 100:
        raise Hata(500, 'kodlama')
    return r.stdout


class Kapi:
    """İçerideki istek sayısı (sentezde + sırada). Dolunca yeni istek beklemeden 503 «mesgul» alır."""

    def __init__(self, kuyruk, eszamanli):
        self._kilit = threading.Lock()
        self._icerde = 0
        self._kuyruk = kuyruk
        self.sentez = threading.BoundedSemaphore(eszamanli)

    def gir(self):
        with self._kilit:
            if self._icerde >= self._kuyruk:
                return False
            self._icerde += 1
            return True

    def cik(self):
        with self._kilit:
            self._icerde -= 1


def yapilandir(motor, anahtar):
    kapi = Kapi(KUYRUK, ESZAMANLI)

    class Islem(BaseHTTPRequestHandler):
        server_version = 'fy-ses'
        sys_version = ''
        protocol_version = 'HTTP/1.1'
        timeout = 5                             # yavaş ya da yarım istek soketi en çok bu kadar tutar (karşı taraf
                                                # aynı makinedeki cloudflared; isteği tek seferde yollar)

        # Varsayılan erişim satırı adres ve yol yazar; kendi satırımız yeter (yalnız durum, dil, uzunluk, süre).
        def log_message(self, *args):
            pass

        def log_error(self, *args):
            pass

        # Her yanıt bağlantıyı kapatır: keep-alive'da boşta bekleyen her soket bir iş parçacığı tutardı (TasksMax'ı
        # doldurup ffmpeg'in fork'unu düşürebilirdi). Döngü adresinde yeni TCP bağlantısı mikrosaniyeler sürer.
        def _gonder(self, durum, govde, tur='application/json'):
            if isinstance(govde, dict):
                govde = json.dumps(govde, separators=(',', ':')).encode()
            self.close_connection = True
            self.send_response(durum)
            self.send_header('Content-Type', tur)
            self.send_header('Content-Length', str(len(govde)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Connection', 'close')
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(govde)

        def _hata(self, durum, kod):
            self._gonder(durum, {'hata': kod})

        def _butce(self, t0):
            """Bu isteğin bitmesi gereken an (monotonic). Worker X-FY-Ses-Sure-Ms ile kalan süresini yollar."""
            try:
                ms = int(self.headers.get('X-FY-Ses-Sure-Ms') or '')
            except ValueError:
                ms = 0
            sure = min(SURE_SN, ms / 1000.0) if 500 <= ms <= 120000 else SURE_VARSAYILAN
            return t0 + sure

        def _anahtar_tamam(self):
            gelen = (self.headers.get('X-FY-Ses-Key') or '').encode('latin-1', 'replace')
            return hmac.compare_digest(gelen, anahtar)

        def _yol(self):
            return self.path.split('?', 1)[0].rstrip('/') or '/'

        def do_GET(self):
            if not self._anahtar_tamam():
                return self._hata(401, 'anahtar')
            if self._yol() != '/saglik':
                return self._hata(404, 'yol')
            self._gonder(200, {'ok': True, 'model': MODEL_ADI, 'voices': list(SESLER), 'langs': list(DILLER)})

        def do_HEAD(self):
            self.do_GET()

        def do_PUT(self):
            self._izinsiz()

        do_DELETE = do_PATCH = do_OPTIONS = do_PUT

        def _izinsiz(self):
            if not self._anahtar_tamam():
                return self._hata(401, 'anahtar')
            self._hata(405, 'yontem')

        def do_POST(self):
            t0 = time.monotonic()
            dil, uzunluk = '-', 0
            durum = 500
            try:
                if not self._anahtar_tamam():
                    durum = 401
                    return self._hata(401, 'anahtar')
                if self._yol() != '/v1/ses':
                    durum = 404
                    return self._hata(404, 'yol')
                try:
                    boy = int(self.headers.get('Content-Length') or '-1')
                except ValueError:
                    boy = -1
                if boy < 0:
                    durum = 411
                    return self._hata(411, 'boy')
                if boy > MAX_GOVDE:
                    durum = 413
                    return self._hata(413, 'buyuk')
                ham = self.rfile.read(boy)
                try:
                    g = json.loads(ham.decode('utf-8'))
                except (UnicodeDecodeError, ValueError):
                    durum = 400
                    return self._hata(400, 'json')
                if not isinstance(g, dict):
                    durum = 400
                    return self._hata(400, 'json')
                dil = g.get('lang')
                if dil not in DILLER:
                    dil = '-'
                    durum = 400
                    return self._hata(400, 'dil')
                ses = g.get('voice', VARSAYILAN_SES)
                if ses not in SESLER:
                    durum = 400
                    return self._hata(400, 'ses')
                metin = g.get('text')
                if not isinstance(metin, str):
                    durum = 400
                    return self._hata(400, 'metin')
                metin = re.sub(r'\s+', ' ', metin).strip()
                uzunluk = len(metin)
                if uzunluk > MAX_METIN:
                    durum = 400
                    return self._hata(400, 'uzun')
                metin = motor.temizle(fy_oku(metin, dil))
                if not any(c.isalnum() for c in metin):          # okunacak harf ya da rakam yok (yalnız sembol)
                    durum = 400
                    return self._hata(400, 'metin')
                son_an = self._butce(t0)
                ilk = tahmin(min(len(metin), 300))      # ilk parçanın tahmini (sentez parça parça; bkz. Motor.sentez)
                if son_an - time.monotonic() < ilk:     # bütçeye sığmayacak iş hiç başlamaz
                    raise Hata(503, 'zaman')
                if not kapi.gir():
                    durum = 503
                    return self._hata(503, 'mesgul')
                try:
                    bekle = min(BEKLEME_SN, son_an - time.monotonic() - ilk)
                    if bekle <= 0 or not kapi.sentez.acquire(timeout=bekle):
                        durum = 503
                        return self._hata(503, 'mesgul')
                    try:
                        if son_an - time.monotonic() < ilk:
                            raise Hata(503, 'zaman')
                        ses_baytlari = motor.sentez(metin, dil, ses, son_an)
                    finally:
                        kapi.sentez.release()
                finally:
                    kapi.cik()
                durum = 200
                self._gonder(200, ses_baytlari, tur='audio/mpeg')
            except Hata as e:
                durum = e.durum
                try:
                    self._hata(e.durum, e.kod)
                except (ConnectionError, TimeoutError, OSError):
                    durum = 499                  # Worker o arada vazgeçmiş: yazacak kimse yok
                    self.close_connection = True
            except (ConnectionError, TimeoutError):
                durum = 499                      # istemci (Worker) beklemekten vazgeçti
                self.close_connection = True
            except Exception as e:               # noqa: BLE001 — istemciye yığın izi gitmez, kayda yalnız türü
                durum = 500
                log.error('ses 500 %s %s', dil, type(e).__name__)
                try:
                    self._hata(500, 'ic')
                except OSError:
                    self.close_connection = True
            finally:
                log.info('ses %d %s %d harf %.2f sn', durum, dil, uzunluk, time.monotonic() - t0)

    return Islem


class Sunucu(ThreadingHTTPServer):
    """Bağlantı başına bir iş parçacığı, ama en çok EN_COK_BAGLANTI tane: fazlası iş parçacığı açılmadan kapatılır
    (cloudflared 502 görür, Worker tarayıcı sesine düşer). İş parçacığı açılamazsa da aynı. Bağlantı hatası kayda yalnız
    istisnanın türüyle düşer: socketserver'ın varsayılanı yığın izi ve karşı adresi yazardı."""

    daemon_threads = True
    block_on_close = False

    def __init__(self, adres, isleyici, en_cok=EN_COK_BAGLANTI):
        self._bkilit = threading.Lock()
        self._baglanti = 0
        self._en_cok = en_cok
        super().__init__(adres, isleyici)

    def process_request(self, request, client_address):
        with self._bkilit:
            dolu = self._baglanti >= self._en_cok
            if not dolu:
                self._baglanti += 1
        if dolu:
            log.error('ses baglanti dolu (%d)', self._en_cok)
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception as e:                   # noqa: BLE001 — ör. «can't start new thread» (TasksMax)
            with self._bkilit:
                self._baglanti -= 1
            log.error('ses baglanti %s', type(e).__name__)
            self.shutdown_request(request)

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            with self._bkilit:
                self._baglanti -= 1

    def handle_error(self, request, client_address):
        tur = sys.exc_info()[0]
        log.error('ses baglanti %s', tur.__name__ if tur else '?')


def ana():
    logging.basicConfig(stream=sys.stderr, level=logging.INFO, format='%(levelname)s %(message)s')
    for ad in ('supertonic', 'huggingface_hub', 'urllib3', 'httpx', 'httpx2'):
        logging.getLogger(ad).setLevel(logging.WARNING)
    anahtar = os.environ.get('SES_KEY', '').strip().encode('latin-1', 'replace')
    if len(anahtar) < ANAHTAR_EN_AZ:
        log.error('SES_KEY yok ya da kısa (en az %d karakter); servis açılmadı', ANAHTAR_EN_AZ)
        return 2
    t = time.monotonic()
    try:
        motor = Motor(MODEL_DIZIN)
    except Exception as e:                       # noqa: BLE001
        log.error('model yüklenemedi (%s): %s', MODEL_DIZIN, type(e).__name__)
        return 3
    # Isınma: ilk ONNX çağrısı yavaştır; ilk ziyaretçi beklemesin
    try:
        motor.sentez('Merhaba.', 'tr', VARSAYILAN_SES, time.monotonic() + 60)
    except Exception as e:                       # noqa: BLE001
        log.error('ısınma sentezi düştü: %s', type(e).__name__)
        return 3
    log.info('model hazır (%s, %.1f sn); %s:%d dinleniyor, eşzamanlı %d, kuyruk %d, bağlantı %d, süre %.1f/%.1f sn',
             MODEL_ADI, time.monotonic() - t, HOST, PORT, ESZAMANLI, KUYRUK, EN_COK_BAGLANTI, SURE_VARSAYILAN, SURE_SN)
    sunucu = Sunucu((HOST, PORT), yapilandir(motor, anahtar))
    try:
        sunucu.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        sunucu.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(ana())
FY_SES_SES_SUNUCU_PY_SON
  cat > "$1/requirements.txt" <<'FY_SES_REQUIREMENTS_TXT_SON'
# FY ses servisi — Python bağımlılıkları (Ubuntu 24.04, CPython 3.12, x86_64).
# Her paket sürümüyle ve SHA-256 özetiyle sabit: kur.sh «pip install --require-hashes --only-binary=:all:» ile kurar,
# özeti tutmayan ya da listede olmayan paket kurulmaz (tedarik zinciri). Güncellemek: docs/vps-ses.md «Güncelleme».
# Kaynak: «pip download supertonic==1.3.1» (cp312, manylinux x86_64), 17 Kasım 2026.
anyio==4.16.0 \
    --hash=sha256:c66ae634e0b8228396b801741beb3294326d4b6102f7bba4041c0dfb58c29026
cffi==2.1.1 \
    --hash=sha256:c1453022f490d2459a11819d83ad1d586e9ff65a12ac3e705ffebd46d3685dcf
click==8.5.1 \
    --hash=sha256:8bb5376d2006950386f8c6427613334a2acadc5f559cb80e638d00b4df957e37
filelock==4.2.11 \
    --hash=sha256:020e229e4bb9d410fc799c07ddf45fa217cba970278f40b30751d94f309b69e2
flatbuffers==25.12.19 \
    --hash=sha256:7634f50c427838bb021c2d66a3d1168e9d199b0607e6329399f04846d42e20b4
fsspec==2026.9.0 \
    --hash=sha256:8dd6e646e99ea382bd85f97a45e6b526a442d79423a7dc673f1e2756d05fcb5f
h11==0.16.0 \
    --hash=sha256:63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86
hf-xet==1.8.0 \
    --hash=sha256:29dab7c904cd1914a0439c6e1306c12c7497c8bd32290fbe563ebf51ca4b6d6d
httpcore2==2.16.2 \
    --hash=sha256:16051ae2a42f776007543f32de9349a317b23d2cbb4e1456b4bac0e88b87419a
httpx2==2.16.2 \
    --hash=sha256:f05c13aade4c45dbf1c9060647a1058f0acad62398fad96e741269edb33d46f5
huggingface-hub==2.4.0 \
    --hash=sha256:42ecfd93ede47bdd333daebbf66a32d7bfe2e18752754fe4d2d4f98a0179d801
idna==3.20 \
    --hash=sha256:ab7ae7122974553370f0bdb919e1a960b2cd1bc1ef0276416d896db81c14582c
numpy==2.5.5 \
    --hash=sha256:704d819265e5d1064d932968e9ee85fff2103ccc78c05b878c06943ba27b8507
onnxruntime==1.32.0 \
    --hash=sha256:99e1074c4b2197accd5073052a465361be17b89c093b8ffb6e6bd8f986c52df8
packaging==26.3 \
    --hash=sha256:d7193f7c8e4e93f444fde0262bf90af30e16fa0ad0ad44cb553c87339b23cd1c
protobuf==7.36.2 \
    --hash=sha256:89f23aa53c24553a2416fd4fd1ec06f74fa42b14b546d8883128813f775bbfd2
pycparser==3.12 \
    --hash=sha256:a076f3f489b39b43ed13563a1dafe42447445bec2e294154ec5c57fcdda4c85e
pyyaml==6.0.3 \
    --hash=sha256:ba1cc08a7ccde2d2ec775841541641e4548226580ab850948cbfda66a1befcdc
soundfile==0.14.0 \
    --hash=sha256:1e38bac1853412871318e82a1ba69a8be677619b56025bbfcccdb41b6cafe82d
supertonic==1.3.1 \
    --hash=sha256:0079c9d4166008b8a6eeae95f20c092148786b7232192dd3dd9f358960c6c077
tqdm==4.70.1 \
    --hash=sha256:c293e525e6fef9c20e8728fd4612df02a0aa31bb5fe91ecd93e123b1b7bffa73
truststore==0.10.5 \
    --hash=sha256:9aaaedaefaf06d8b206278cf8b5012bc897f485a874503501e12d776df78951c
typing-extensions==4.16.0 \
    --hash=sha256:481caa481374e813c1b176ada14e97f1f67a4539ce9cfeb3f350d78d6370c2e8
FY_SES_REQUIREMENTS_TXT_SON
  cat > "$1/fy-ses.service" <<'FY_SES_FY_SES_SERVICE_SON'
# FY ses servisi — systemd birimi. kur.sh /etc/systemd/system/fy-ses.service olarak kurar; elle düzenleme (bir sonraki
# kur.sh ezer). Ayar değiştirmek için /etc/fy-ses.env'e satır ekle (ör. FY_SES_ESZAMANLI=3): o dosyadaki değerler
# buradaki Environment= satırlarını ezer ve kur.sh onu korur. Ayrıntı: docs/vps-ses.md «Ses servisi».
[Unit]
Description=FY ses servisi (Supertonic 3; yalnız 127.0.0.1:8790)
After=network.target
StartLimitIntervalSec=300
StartLimitBurst=10

[Service]
Type=simple
User=fyses
Group=fyses
WorkingDirectory=/opt/fy-ses
Environment=HOME=/var/lib/fy-ses
Environment=SUPERTONIC_CACHE_DIR=/var/lib/fy-ses/model
Environment=SUPERTONIC_MODEL_REVISION=724fb5abbf5502583fb520898d45929e62f02c0b
Environment=HF_HUB_OFFLINE=1
Environment=HF_HUB_DISABLE_TELEMETRY=1
# onnxruntime Linux'ta da Microsoft'a telemetri (1DS) yollar ve ev dizinine aygıt kimliği yazar: kapalı. (ses_sunucu.py
# da kendisi koyar; IPAddressDeny zaten dışarıyı keser — üç kat.)
Environment=ORT_DISABLE_TELEMETRY=1
# ONNX tek istekte ~2 çekirdekten fazlasını iyi kullanmıyor (ölçüldü); iki eşzamanlı istek ≈ 4 çekirdek
Environment=SUPERTONIC_INTRA_OP_THREADS=2
Environment=SUPERTONIC_INTER_OP_THREADS=1
Environment=OMP_NUM_THREADS=1
Environment=OPENBLAS_NUM_THREADS=1
Environment=FY_SES_PORT=8790
Environment=FY_SES_ESZAMANLI=2
Environment=FY_SES_KUYRUK=4
# SES_KEY (ve isteğe bağlı ayarlar) buradan; dosya 0600, sahibi root (systemd okur, servisin kendisi okumaz)
EnvironmentFile=/etc/fy-ses.env
ExecStart=/opt/fy-ses/venv/bin/python -I -B -u /opt/fy-ses/ses_sunucu.py
Restart=always
RestartSec=3
TimeoutStopSec=15
Nice=5

# Kaynak tavanları: 6 vCPU'nun en çok 4,5'i (SSH ve cloudflared'e pay kalsın), en çok 3 GB bellek
# (model yüklüyken ~0,5 GB, iki eşzamanlı uzun istekte ~0,7 GB ölçüldü)
CPUQuota=450%
MemoryHigh=2G
MemoryMax=3G
# İş parçacığı tavanı: bağlantı başına bir (en çok FY_SES_BAGLANTI=32) + ONNX havuzları + ffmpeg çocukları; bol pay
TasksMax=256
LimitNOFILE=1024

# Sertleştirme: kod ve model salt okunur, ev dizinleri görünmez, ağ yalnız localhost, ayrıcalık yok
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
# Tünel token'ı ve başka tünel ayarları servis sürecinden görünmez (servis ele geçirilse de okuyamaz)
InaccessiblePaths=-/etc/fy-ses-tunel.env -/etc/cloudflared -/etc/systemd/system/cloudflared.service
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectKernelLogs=yes
ProtectControlGroups=yes
ProtectClock=yes
ProtectHostname=yes
ProtectProc=invisible
RestrictNamespaces=yes
RestrictRealtime=yes
RestrictSUIDSGID=yes
LockPersonality=yes
RemoveIPC=yes
CapabilityBoundingSet=
AmbientCapabilities=
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
IPAddressDeny=any
IPAddressAllow=localhost
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM
UMask=0077

[Install]
WantedBy=multi-user.target
FY_SES_FY_SES_SERVICE_SON
  cat > "$1/fy-ses-tunel.service" <<'FY_SES_FY_SES_TUNEL_SERVICE_SON'
# FY ses tüneli — yalnız FY'nin Cloudflare Tunnel'ı (Workers VPC → 127.0.0.1:8790). kur.sh
# /etc/systemd/system/fy-ses-tunel.service olarak kurar; elle düzenleme (bir sonraki kur.sh ezer). Ayrıntı: docs/vps-ses.md.
# Kendi adıyla ayrı birim: makinede başka bir cloudflared.service (başka bir tünel) varsa ona hiç dokunulmaz.
# Token /etc/fy-ses-tunel.env'de (TUNNEL_TOKEN=…, 0600, root): birim dosyasında ve komut satırında (ps) görünmez.
[Unit]
Description=FY ses tüneli (cloudflared; yalnız Workers VPC için)
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=0

[Service]
Type=simple
EnvironmentFile=/etc/fy-ses-tunel.env
# cloudflared «tunnel run» token'ı TUNNEL_TOKEN ortam değişkeninden okur (--token'ın karşılığı; Cloudflare dokümanının
# Kubernetes örneğiyle aynı komut). Protokol varsayılan «auto» (önce QUIC; Workers VPC QUIC ister, dışarıya UDP 7844).
# Güncellemeyi apt yapar (kur.sh), cloudflared kendisi değil.
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run
Restart=always
RestartSec=5
TimeoutStopSec=15

# Hafif sertleştirme (cloudflared ağa çıkmak zorunda; token kipinde diske yazmaz)
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full
ProtectHome=read-only

[Install]
WantedBy=multi-user.target
FY_SES_FY_SES_TUNEL_SERVICE_SON
  cat > "$1/MODEL-LISANSI.md" <<'FY_SES_MODEL_LISANSI_MD_SON'
# Ses modeli lisansı — Supertonic 3

FY'nin VPS'teki sesi **Supertonic 3** modeliyle üretilir.

| | |
|---|---|
| Model | `Supertone/supertonic-3` (Hugging Face), Supertone Inc. |
| Sabit revizyon | `724fb5abbf5502583fb520898d45929e62f02c0b` (kur.sh bunu indirir, dosya özetlerini denetler) |
| Model lisansı | **BigScience OpenRAIL-M** (18 Ağustos 2022) — ticari kullanım serbest, kullanım kısıtlarıyla |
| Python paketi | `supertonic` 1.3.1 — MIT lisansı (Supertone Inc.) |
| Çalıştırıcı | `onnxruntime` 1.32.0 — MIT lisansı (Microsoft). Linux'ta da varsayılan olarak Microsoft'a telemetri yollar ve ev dizinine aygıt kimliği yazar: **kapalı** (`ORT_DISABLE_TELEMETRY=1` birimde, kur.sh'ta ve ses_sunucu.py'de; docs/vps-ses.md §6 «Telemetri») |
| Lisansın tam metni | model klasöründe `LICENSE` (`/var/lib/fy-ses/model/LICENSE`); kur.sh bir kopyasını `/opt/fy-ses/MODEL-LICENSE.txt` olarak servisin yanına koyar |

## Bizim için anlamı

- Model ve türevleri lisansın **Ek A** kısıtlarıyla kullanılır. FY için önemli olanlar:
  - **(e)** Üretilen içerik, makine üretimi olduğu açıkça ve anlaşılır biçimde belirtilmeden yayılmaz. Site ve
    Telegram botu FY'nin bir yapay zekâ asistanı olduğunu zaten söylüyor (ana sayfa, `terms.html`, botun profili);
    ses yalnızca FY'nin yapay zekâ yanıtını okur. Bu söz kaldırılmaz.
  - **(g)** Bir başkasının sesi taklit edilmez: yalnız modelle gelen hazır sesler (F4 «Melis», M3) kullanılır; ses
    klonlama yok.
  - **(l)** Tıbbi tavsiye vermek için kullanılmaz (FY'nin istemi de bunu yapmaz).
  - (a)–(m) maddelerinin tamamı lisans metninde; bu liste özet, yerine geçmez.
- Lisans, modeli dağıtırken (başkasına verirken) Ek A kısıtlarının da aktarılmasını ister. Biz modeli dağıtmıyoruz:
  yalnız kendi sunucumuzda çalıştırıyoruz, ziyaretçiye giden şey üretilmiş ses (MP3).
- Lisans metni ve bu not servisle birlikte durur; güncellemede model revizyonu değişirse lisans metni de yeniden
  okunur (docs/vps-ses.md «Güncelleme»).
FY_SES_MODEL_LISANSI_MD_SON
}

KURU="${KURU:-0}"
YENI_ANAHTAR="${YENI_ANAHTAR:-0}"
PAKET=14065af39fdf

UYGULAMA=/opt/fy-ses
VERI=/var/lib/fy-ses
MODEL="$VERI/model"
ORTAM=/etc/fy-ses.env
BIRIM=/etc/systemd/system/fy-ses.service
TUNEL_ORTAM=/etc/fy-ses-tunel.env
TUNEL_BIRIM=/etc/systemd/system/fy-ses-tunel.service
KULLANICI=fyses
PORT=8790
REVIZYON=724fb5abbf5502583fb520898d45929e62f02c0b     # Supertone/supertonic-3, supertonic 1.3.1'in sınadığı revizyon
CF_ANAHTAR_URL=https://pkg.cloudflare.com/cloudflare-main.gpg
CF_ANAHTAR=/usr/share/keyrings/cloudflare-main.gpg
CF_DEPO="deb [signed-by=$CF_ANAHTAR] https://pkg.cloudflare.com/cloudflared any main"
CF_LISTE=/etc/apt/sources.list.d/cloudflared.list
# apt: dpkg kilidi (ör. otomatik güncelleme o an çalışıyor) 10 dakikaya dek beklenir, hemen düşülmez
APT=(apt-get -q -o DPkg::Lock::Timeout=600)

# Modelin bu revizyondaki dosya özetleri (indirilen her şey bununla denetlenir; tutmazsa servis kurulmaz)
MODEL_OZET='c3eb91414d5ff8a7a239b7fe9e34e7e2bf8a8140d8375ffb14718b1c639325db  onnx/duration_predictor.onnx
c7befd5ea8c3119769e8a6c1486c4edc6a3bc8365c67621c881bbb774b9902ff  onnx/text_encoder.onnx
883ac868ea0275ef0e991524dc64f16b3c0376efd7c320af6b53f5b780d7c61c  onnx/vector_estimator.onnx
085de76dd8e8d5836d6ca66826601f615939218f90e519f70ee8a36ed2a4c4ba  onnx/vocoder.onnx
42078d3aef1cd43ab43021f3c54f47d2d75ceb4e75f627f118890128b06a0d09  onnx/tts.json
9bf7346e43883a81f8645c81224f786d43c5b57f3641f6e7671a7d6c493cb24f  onnx/unicode_indexer.json
c2fa764c1225a76dfc3e2c73e8aa4f70d9ee48793860eb34c295fff01c2e032b  voice_styles/F4.json
ea1ac35ccb91b0d7ecad533a2fbd0eec10c91513d8951e3b25fbba99954e159b  voice_styles/M3.json
0d944a9110fed9a9602d60e0423a272903e7bd21ab060490774efc77c2275e9f  LICENSE'

DOSYALAR="ses_sunucu.py requirements.txt fy-ses.service fy-ses-tunel.service MODEL-LISANSI.md"

adim() { printf '\n== %s\n' "$*"; }
bilgi() { printf '   %s\n' "$*"; }
dur() { printf '\nDURDU: %s\n' "$*" >&2; exit 1; }
# Beklenmeyen bir komut düşerse (set -e) Türkçe ne yapılacağını söyle. Alt kabuklarda susar: mesaj bir kez çıkar.
hata_yakala() {
  local kod=$? satir="$1"
  [ "${BASH_SUBSHELL:-0}" = 0 ] || return 0
  printf '\nDURDU (satır %s, çıkış kodu %s): bir adım yarıda kaldı; ne olduğu hemen yukarıda yazıyor.\n' "$satir" "$kod" >&2
  printf 'Çoğu zaman AYNI komutu yeniden çalıştırmak yeter: betik kaldığı yerden güvenle sürer (apt kilidi, ağ, SSH kopması).\n' >&2
  printf 'Olmazsa çıktının son 30 satırıyla docs/vps-ses.md §8 «Sorun giderme».\n' >&2
}
trap 'hata_yakala $LINENO' ERR
# Değiştiren her komut bundan geçer: KURU=1'de yalnız yazılır
yap() {
  if [ "$KURU" = 1 ]; then printf '   [kuru] %s\n' "$*"; else "$@"; fi
}
# apt-get update: listeleri o an otomatik güncelleme kilitlemiş olabilir; birkaç kez dener
apt_guncelle() {
  local i
  if [ "$KURU" = 1 ]; then bilgi "[kuru] ${APT[*]} update"; return 0; fi
  for i in 1 2 3 4 5 6; do
    if "${APT[@]}" update; then return 0; fi
    bilgi "apt-get update olmadı (otomatik güncelleme listeleri kilitlemiş olabilir); 20 sn sonra yeniden ($i/6)"
    sleep 20
  done
  dur "apt-get update 6 denemede olmadı (ağ ya da apt kilidi). Birkaç dakika sonra aynı komutu yeniden çalıştır"
}
# Önceki bir çalıştırma (SSH koptu) dpkg'yi yarıda bıraktıysa apt hiçbir şey kurmaz; önce onu tamamla
dpkg_onar() {
  local i
  if [ -z "$(dpkg --audit 2>/dev/null || true)" ] && [ -z "$(ls -A /var/lib/dpkg/updates 2>/dev/null || true)" ]; then return 0; fi
  if [ "$KURU" = 1 ]; then bilgi "[kuru] yarım kalmış paket kurulumu var → dpkg --configure -a"; return 0; fi
  bilgi "yarım kalmış bir paket kurulumu var (ör. önceki çalıştırmada SSH koptu); tamamlanıyor: dpkg --configure -a"
  for i in $(seq 1 30); do
    if dpkg --configure -a; then return 0; fi
    bilgi "dpkg meşgul (otomatik güncelleme çalışıyor olabilir); 20 sn sonra yeniden ($i/30)"
    sleep 20
  done
  dur "dpkg --configure -a 10 dakikada tamamlanamadı; «dpkg --configure -a» komutunu elle çalıştır, sonra bu betiği yeniden"
}

# Bütün iş ana()'nın içinde, en son satırda çağrılır: telefondan yapıştırırken dosya yarım kalırsa bash işlevi
# sonuna kadar okuyamaz ve HİÇBİR adım çalışmaz (yarım betik yarım kurulum yapmaz). Ortadan satır düşerse de dosyanın
# başındaki özet denetimi (FY_KUR_OZET) tutmaz ve betik hiçbir şey yapmadan durur.
ana() {
TOKEN="${1:-}"

# --- Gömülü dosyaları çıkarma kipi (paket.sh --kontrol kullanır): FY_SES_CIKAR=<klasör> bash fy-ses-kur.sh ---
if [ -n "${FY_SES_CIKAR:-}" ]; then
  declare -F gomulu_yaz >/dev/null || dur "bu kopyada gömülü dosya yok (dist/fy-ses-kur.sh kullan)"
  mkdir -p "$FY_SES_CIKAR"
  gomulu_yaz "$FY_SES_CIKAR"
  exit 0
fi

printf 'FY ses servisi kurulumu (paket %s)%s\n' "$PAKET" "$([ "$KURU" = 1 ] && echo ' — KURU (hiçbir şey değişmez)')"
if [ -z "${TMUX:-}${STY:-}" ] && [ -t 1 ]; then
  bilgi "İPUCU: tmux içinde değilsin. SSH koparsa kurulum yarıda kalır (zararsız: yeniden çalıştırınca sürer)."
  bilgi "       Daha rahatı: Ctrl+C, sonra «tmux new -s fy» ve aynı komut; kopunca «tmux attach -t fy»."
fi

# --- 0) Ön koşullar ---------------------------------------------------------------------------------------------
adim "0/8 Ön koşullar"
uyar_ya_da_dur() { if [ "$KURU" = 1 ]; then bilgi "UYARI (kuru kipte devam): $*"; else dur "$*"; fi; }
[ "$(id -u)" = 0 ] || uyar_ya_da_dur "root olarak çalıştır (sudo -i, sonra bash kur.sh …)"
# shellcheck source=/dev/null
SURUM="$( . /etc/os-release 2>/dev/null && echo "${ID:-?} ${VERSION_ID:-?}" || echo '? ?')"
[ "$SURUM" = "ubuntu 24.04" ] || uyar_ya_da_dur "Ubuntu 24.04 bekleniyordu, bulunan: $SURUM"
[ "$(uname -m)" = x86_64 ] || uyar_ya_da_dur "x86_64 bekleniyordu (paket özetleri bu mimari için), bulunan: $(uname -m)"
bilgi "sistem: $SURUM $(uname -m)"
if [ -n "$TOKEN" ]; then
  # Cloudflare tünel token'ı base64 bir JSON'dur (ey… ile başlar); boşluk ya da tırnak taşımaz
  case "$TOKEN" in *[!A-Za-z0-9+/=_-]*) dur "token beklenmeyen karakter içeriyor (kopyalarken bölünmüş olabilir)";; esac
  [ "${#TOKEN}" -ge 80 ] || dur "token çok kısa (${#TOKEN} karakter); panodaki «cloudflared service install» satırının sonundaki uzun değeri kopyala"
  bilgi "tünel token'ı verildi (${#TOKEN} karakter; ekrana yazılmaz, yalnız $TUNEL_ORTAM'e (0600, root) yazılır)"
else
  bilgi "tünel token'ı verilmedi: cloudflared kurulur/güncellenir, tünel token'ı değişmez"
fi

# --- 1) Sistem paketleri ----------------------------------------------------------------------------------------
adim "1/8 Sistem paketleri (python3-venv ffmpeg curl ca-certificates openssl; kurulu olan yükseltilmez)"
dpkg_onar
apt_guncelle
yap "${APT[@]}" install -y --no-install-recommends --no-upgrade python3-venv ffmpeg curl ca-certificates openssl
if [ "$KURU" != 1 ]; then
  PY="$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"
  [ "$PY" = 3.12 ] || dur "python3 3.12 bekleniyordu (requirements.txt özetleri cp312 için), bulunan: $PY"
  bilgi "python3 $PY, $(ffmpeg -version 2>/dev/null | head -1 | cut -d' ' -f1-3)"
fi

# --- 2) Kullanıcı ve klasörler ----------------------------------------------------------------------------------
adim "2/8 Kullanıcı «$KULLANICI» ve klasörler"
if id "$KULLANICI" >/dev/null 2>&1; then
  bilgi "kullanıcı zaten var"
else
  yap useradd --system --user-group --home-dir "$VERI" --no-create-home --shell /usr/sbin/nologin "$KULLANICI"
fi
yap install -d -m 0755 -o root -g root "$UYGULAMA"
yap install -d -m 0750 -o "$KULLANICI" -g "$KULLANICI" "$VERI"
# Eski bir sürümün onnxruntime'ı telemetri kapatılmadan çalıştıysa bıraktığı aygıt kimliği (yalnız fyses'in evinde)
if [ -d "$VERI/.cache/Microsoft" ]; then
  yap rm -rf "$VERI/.cache/Microsoft"
  bilgi "onnxruntime'ın eski telemetri kalıntısı silindi ($VERI/.cache/Microsoft)"
fi

# --- 3) Servis dosyaları -----------------------------------------------------------------------------------------
adim "3/8 Servis dosyaları → $UYGULAMA"
GECICI=""
temizle() { [ -n "$GECICI" ] && rm -rf "$GECICI"; return 0; }
trap temizle EXIT
if [ "$KURU" = 1 ]; then
  bilgi "[kuru] $DOSYALAR → $UYGULAMA (root, 0644); fy-ses.service → $BIRIM; fy-ses-tunel.service → $TUNEL_BIRIM"
else
  GECICI="$(mktemp -d)"
  chmod 0700 "$GECICI"
  if declare -F gomulu_yaz >/dev/null; then
    gomulu_yaz "$GECICI/kaynak"
  else
    BURASI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    mkdir -p "$GECICI/kaynak"
    for f in $DOSYALAR; do
      [ -f "$BURASI/$f" ] || dur "$f bulunamadı: kur.sh'ı ses-sunucu/ klasöründen çalıştır ya da tek dosyalık dist/fy-ses-kur.sh'ı kullan"
      cp "$BURASI/$f" "$GECICI/kaynak/$f"
    done
  fi
  K="$GECICI/kaynak"
  for f in ses_sunucu.py requirements.txt MODEL-LISANSI.md; do install -m 0644 -o root -g root "$K/$f" "$UYGULAMA/$f"; done
  bilgi "kuruldu: $(cd "$UYGULAMA" && echo ses_sunucu.py requirements.txt MODEL-LISANSI.md)"
fi

# --- 4) Python ortamı (sürüm + özet sabit) ----------------------------------------------------------------------
# Her requirements.txt için ayrı venv (venv-<özet>): yenisi hazır olmadan eskisine dokunulmaz, sonra bağlantı çevrilir.
adim "4/8 Python ortamı (pip --require-hashes)"
if [ "$KURU" = 1 ]; then
  bilgi "[kuru] python3 -m venv $UYGULAMA/venv-<requirements özeti>; pip install --require-hashes --only-binary=:all: -r requirements.txt; $UYGULAMA/venv → bu klasör"
else
  OZET="$(sha256sum "$UYGULAMA/requirements.txt" | cut -c1-12)"
  YENI_VENV="$UYGULAMA/venv-$OZET"
  if [ -x "$YENI_VENV/bin/python" ] && [ -f "$YENI_VENV/.fy-tamam" ]; then
    bilgi "ortam güncel (venv-$OZET)"
  else
    rm -rf "$YENI_VENV"
    python3 -m venv "$YENI_VENV"
    "$YENI_VENV/bin/python" -m pip install --quiet --disable-pip-version-check --no-input --no-cache-dir \
      --require-hashes --only-binary=:all: -r "$UYGULAMA/requirements.txt"
    "$YENI_VENV/bin/python" -I -c 'import supertonic, onnxruntime, numpy; print("   paketler tamam: supertonic", supertonic.__version__)'
    touch "$YENI_VENV/.fy-tamam"
  fi
  ln -sfn "venv-$OZET" "$UYGULAMA/venv"
fi

# --- 5) Model (sabit revizyon, özet denetimi) -------------------------------------------------------------------
adim "5/8 Supertonic 3 modeli → $MODEL (revizyon ${REVIZYON:0:12})"
model_tamam() { [ -f "$MODEL/.fy-revizyon" ] && [ "$(cat "$MODEL/.fy-revizyon")" = "$REVIZYON" ] && (cd "$MODEL" && printf '%s\n' "$MODEL_OZET" | sha256sum --quiet -c - >/dev/null 2>&1); }
if [ "$KURU" = 1 ]; then
  bilgi "[kuru] model yoksa ya da revizyonu/özeti tutmuyorsa fyses olarak Hugging Face'ten indir (~390 MB), özetleri denetle"
elif model_tamam; then
  bilgi "model güncel ve özetleri tutuyor"
else
  bilgi "indiriliyor (~390 MB, bir iki dakika)…"
  (cd / && runuser -u "$KULLANICI" -- env -i PATH=/usr/bin:/bin HOME="$VERI" HF_HOME="$VERI/hf" HF_HUB_DISABLE_TELEMETRY=1 HF_HUB_DISABLE_PROGRESS_BARS=1 \
    ORT_DISABLE_TELEMETRY=1 SUPERTONIC_MODEL_REVISION="$REVIZYON" SUPERTONIC_CACHE_DIR="$MODEL" \
    "$UYGULAMA/venv/bin/python" -I -B -c 'import os, pathlib; from supertonic.loader import download_model; download_model(pathlib.Path(os.environ["SUPERTONIC_CACHE_DIR"]), "supertonic-3")')
  (cd "$MODEL" && printf '%s\n' "$MODEL_OZET" | sha256sum --quiet -c -) || dur "model dosyalarının özeti tutmuyor; indirme bozuk. kur.sh'ı yeniden çalıştır"
  printf '%s\n' "$REVIZYON" | runuser -u "$KULLANICI" -- tee "$MODEL/.fy-revizyon" >/dev/null
  bilgi "model indirildi, özetler tamam"
fi
yap install -m 0644 -o root -g root "$MODEL/LICENSE" "$UYGULAMA/MODEL-LICENSE.txt"

# --- 6) Anahtar ---------------------------------------------------------------------------------------------------
# Dosyayı systemd (root) okur; servis anahtarı ortamdan alır. Sahibi root: fyses hesabı onu değiştiremez.
adim "6/8 Paylaşılan anahtar (SES_KEY) → $ORTAM"
ANAHTAR_YENI=""
MEVCUT="$( (sed -n 's/^SES_KEY=//p' "$ORTAM" 2>/dev/null || true) | tail -n 1)"
if [ "${#MEVCUT}" -ge 32 ] && [ "$YENI_ANAHTAR" != 1 ]; then
  bilgi "anahtar zaten var; değişmedi (Worker'daki SES_KEY aynı kalır)"
elif [ "$KURU" = 1 ]; then
  bilgi "[kuru] openssl rand -base64 32 → $ORTAM (0600, root); değer sonda bir kez gösterilir"
else
  ANAHTAR_YENI="$(openssl rand -base64 32)"
  ( umask 077
    { printf '# FY ses servisi — kur.sh yazdı. SES_KEY, Worker'"'"'daki SES_KEY secret'"'"'ı ile AYNI olmalı. Bu dosyayı paylaşma.\n'
      [ -f "$ORTAM" ] && grep -v -e '^SES_KEY=' -e '^# FY ses servisi' "$ORTAM" || true
      printf 'SES_KEY=%s\n' "$ANAHTAR_YENI"
    } > "$ORTAM.yeni" )
  chown root:root "$ORTAM.yeni"
  chmod 0600 "$ORTAM.yeni"
  mv -f "$ORTAM.yeni" "$ORTAM"
  bilgi "yeni anahtar yazıldı (değeri sonda bir kez gösterilecek)"
fi
[ "$KURU" = 1 ] || { chown root:root "$ORTAM"; chmod 0600 "$ORTAM"; }

# --- 7) systemd birimi ve başlatma ---------------------------------------------------------------------------------
adim "7/8 systemd birimi (fy-ses) ve başlatma"
if [ "$KURU" = 1 ]; then
  bilgi "[kuru] fy-ses.service → $BIRIM; systemctl daemon-reload; enable; restart; 127.0.0.1:$PORT/saglik beklenir"
else
  install -m 0644 -o root -g root "$K/fy-ses.service" "$BIRIM"
  systemctl daemon-reload
  systemctl enable --quiet fy-ses
  systemctl restart fy-ses
  # Sağlık denetimi: anahtar komut satırına girmesin (ps'de görünürdü) diye başlık root'a özel geçici dosyadan okunur
  BASLIK="$GECICI/baslik"
  ( umask 077; printf 'X-FY-Ses-Key: %s\n' "$(sed -n 's/^SES_KEY=//p' "$ORTAM" | tail -n 1)" > "$BASLIK" )
  SAGLIK=""
  for _ in $(seq 1 45); do
    if SAGLIK="$(curl -fsS -m 3 -H @"$BASLIK" "http://127.0.0.1:$PORT/saglik" 2>/dev/null)"; then break; fi
    SAGLIK=""
    systemctl is-failed --quiet fy-ses && break
    sleep 2
  done
  rm -f "$BASLIK"
  if [ -n "$SAGLIK" ]; then
    bilgi "servis yanıt veriyor: $SAGLIK"
  else
    journalctl -u fy-ses -n 20 --no-pager >&2 || true
    dur "ses servisi 90 saniyede hazır olmadı (yukarıda son kayıtlar). «journalctl -u fy-ses -n 50» ile bak"
  fi
  # Eski venv'ler (bağlantının göstermediği) silinir
  for d in "$UYGULAMA"/venv-*; do
    if [ -d "$d" ] && [ "$(readlink "$UYGULAMA/venv")" != "$(basename "$d")" ]; then rm -rf "$d"; fi
  done
fi

# --- 8) cloudflared (resmî apt deposu) ve FY'nin tüneli -----------------------------------------------------------
# FY'nin tüneli KENDİ biriminde (fy-ses-tunel.service): «cloudflared service install» kullanılmaz, çünkü o
# cloudflared.service'i yazar — makinede başka bir tünel varsa onu ezerdi. Token /etc/fy-ses-tunel.env'de (0600, root).
adim "8/8 cloudflared (pkg.cloudflare.com, imzalı depo) ve FY'nin tüneli (fy-ses-tunel)"
yap install -d -m 0755 /usr/share/keyrings
if [ "$KURU" = 1 ]; then
  bilgi "[kuru] curl -fsSL $CF_ANAHTAR_URL → $CF_ANAHTAR"
  bilgi "[kuru] $CF_LISTE ← «$CF_DEPO»"
else
  curl -fsSL "$CF_ANAHTAR_URL" -o "$CF_ANAHTAR.yeni"
  install -m 0644 "$CF_ANAHTAR.yeni" "$CF_ANAHTAR" && rm -f "$CF_ANAHTAR.yeni"
  printf '%s\n' "$CF_DEPO" > "$CF_LISTE"
fi
apt_guncelle
yap "${APT[@]}" install -y cloudflared
[ "$KURU" = 1 ] || bilgi "$(cloudflared --version 2>/dev/null | head -1)"
if systemctl cat cloudflared.service >/dev/null 2>&1 || [ -d /etc/cloudflared ]; then
  bilgi "makinede başka bir cloudflared kurulumu var (cloudflared.service ya da /etc/cloudflared): ona DOKUNULMADI"
fi
TUNEL_YENI=""
if [ -n "$TOKEN" ]; then
  if [ "$KURU" = 1 ]; then
    bilgi "[kuru] TUNNEL_TOKEN=<token gizli> → $TUNEL_ORTAM (0600, root)"
  else
    # printf kabuğun kendi komutu: token hiçbir sürecin komut satırına (ps) girmez
    ( umask 077
      printf '# FY ses tüneli — kur.sh yazdı. Bu bir paroladır: paylaşma.\nTUNNEL_TOKEN=%s\n' "$TOKEN" > "$TUNEL_ORTAM.yeni" )
    chown root:root "$TUNEL_ORTAM.yeni"
    chmod 0600 "$TUNEL_ORTAM.yeni"
    mv -f "$TUNEL_ORTAM.yeni" "$TUNEL_ORTAM"
    TUNEL_YENI=1
  fi
fi
unset TOKEN
set --
TUNEL_DURUM="kurulmadı (token yok: « bash $0 <TOKEN>» ile yeniden çalıştır)"
if [ "$KURU" = 1 ]; then
  bilgi "[kuru] fy-ses-tunel.service → $TUNEL_BIRIM; token dosyası varsa: daemon-reload; enable; restart; QUIC denetimi"
elif [ -f "$TUNEL_ORTAM" ]; then
  chown root:root "$TUNEL_ORTAM"; chmod 0600 "$TUNEL_ORTAM"
  install -m 0644 -o root -g root "$K/fy-ses-tunel.service" "$TUNEL_BIRIM"
  systemctl daemon-reload
  systemctl enable --quiet fy-ses-tunel
  systemctl restart fy-ses-tunel
  bilgi "tünel servisi (yeniden) başlatıldı$([ -n "$TUNEL_YENI" ] && echo ' — yeni token ile') (protokol «auto» = önce QUIC; Workers VPC QUIC ister, dışarıya UDP 7844)"
  TUNEL_DURUM="$(systemctl is-active fy-ses-tunel 2>/dev/null || true)"
  QUIC=""
  if [ "$TUNEL_DURUM" = active ]; then
    for _ in $(seq 1 10); do
      sleep 2
      # Önce kaydı al, sonra ara: «journalctl | grep -q» pipefail altında SIGPIPE ile yanlış «yok» diyebilirdi
      TLOG="$(journalctl -u fy-ses-tunel --since "-3min" --no-pager 2>/dev/null || true)"
      if [[ "${TLOG,,}" == *protocol=quic* ]]; then QUIC=1; break; fi
    done
    if [ -n "$QUIC" ]; then
      bilgi "tünel QUIC ile bağlandı"
    else
      bilgi "UYARI: 20 sn'de QUIC bağlantısı görülmedi; «journalctl -u fy-ses-tunel -n 30» ile bak (UDP 7844 dışarı kapalıysa http2'ye düşer, Workers VPC çalışmaz)"
    fi
  fi
else
  bilgi "tünel token'ı yok: FY'nin tüneli kurulmadı (ses servisi yine de hazır)"
fi

# --- Özet ---------------------------------------------------------------------------------------------------------
printf '\n================================ ÖZET ================================\n'
if [ "$KURU" = 1 ]; then
  printf 'KURU kip: hiçbir şey değişmedi. Gerçek kurulum için KURU=1 olmadan çalıştır.\n'
  exit 0
fi
printf 'Ses servisi : %s (127.0.0.1:%s, yalnız bu makineden)\n' "$(systemctl is-active fy-ses)" "$PORT"
printf 'Tünel       : %s (fy-ses-tunel)\n' "$TUNEL_DURUM"
if [ -n "$ANAHTAR_YENI" ]; then
  printf '\nSES_KEY (yalnız şimdi gösteriliyor; kimseyle paylaşma):\n\n    %s\n\n' "$ANAHTAR_YENI"
  printf "Bunu Cloudflare'de Worker'a SECRET olarak gir: Workers & Pages → fy-ajans → Settings →\n"
  printf "Variables and Secrets → Add → Type: Secret, Name: SES_KEY, Value: yukarıdaki değer → Deploy.\n"
  printf "(Bilgisayardan: cd worker && npx wrangler secret put SES_KEY)\n"
else
  printf "\nSES_KEY değişmedi; Worker'daki secret aynı kalır. Yeniden görmek gerekirse:\n    sed -n 's/^SES_KEY=//p' %s\n" "$ORTAM"
fi
printf '\nSonraki adım (bir kez): Workers VPC → VPC Services → Create: tünel bu makine, Host 127.0.0.1, HTTP port %s.\n' "$PORT"
printf 'Çıkan Service ID ile etkinleştirme: docs/vps-ses.md «Etkinleştirme».\n'
if [ -f /var/run/reboot-required ]; then
  printf 'Makine yeniden başlatma bekliyor (çekirdek/kütüphane güncellemesi): istediğin zaman «reboot»; iki servis de kendiliğinden açılır.\n'
else
  printf 'Yeniden başlatma gerekirse («reboot») iki servis de kendiliğinden açılır.\n'
fi
}

ana "$@"
