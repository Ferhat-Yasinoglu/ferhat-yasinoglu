"""kazi PDF desteği: PDF baytları → Markdown (saf Python, pypdf)."""
from __future__ import annotations

import io
import re
import time

from pypdf import PdfReader
from pypdf.errors import DependencyError

MAX_PAGES = 5000
MAX_CHARS = 10_000_000
MAX_SECONDS = 60.0  # kötü niyetli PDF aynı sayfayı defalarca referanslayıp saatlerce işletmesin
_CTRL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f]")
_BLANKS = re.compile(r"\n{3,}")


def _clean(text: str) -> str:
    text = _CTRL.sub("", text.replace("\r\n", "\n").replace("\r", "\n").replace("\xa0", " "))
    text = "\n".join(l.rstrip() for l in text.split("\n"))
    return _BLANKS.sub("\n\n", text).strip()


def _open(data: bytes) -> PdfReader:
    if not isinstance(data, (bytes, bytearray, memoryview)):
        raise TypeError(f"PDF bayt olmalı, {type(data).__name__} verildi")
    data = bytes(data)
    if not data:
        raise ValueError("PDF boş (0 bayt).")
    if b"%PDF-" not in data[:1024]:
        raise ValueError("Bu bir PDF değil (%PDF başlığı yok).")
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        encrypted = reader.is_encrypted
    except Exception as e:
        raise ValueError(f"PDF bozuk veya okunamadı: {e}") from e
    if encrypted:
        try:
            ok = reader.decrypt("")
        except DependencyError as e:
            raise ValueError("PDF AES ile şifreli; açmak için: pip install cryptography") from e
        except Exception as e:
            raise ValueError(f"PDF şifresi çözülemedi: {e}") from e
        if not ok:
            raise ValueError("PDF parola korumalı; parolasız açılamıyor.")
    return reader


def _title(reader: PdfReader) -> str | None:
    try:
        t = reader.metadata.title if reader.metadata else None
    except Exception:
        return None
    t = str(t).strip() if t else ""
    return t or None


def pdf_to_markdown(data: bytes) -> tuple[str, str | None]:
    """PDF baytları → (markdown, başlık). Her sayfa '## Sayfa N' ile başlar (N = PDF'teki
    gerçek sayfa no, boş sayfalar atlanır ama numara kaymaz). Başlık PDF üstverisinden, yoksa None.
    Hiç metin çıkmazsa (taranmış/görüntü PDF) markdown '' döner. Bozuk, PDF olmayan veya
    parola korumalı dosyada ValueError. MAX_PAGES / MAX_CHARS / MAX_SECONDS aşılırsa okuma durur
    ve çıktının sonuna kırpıldığını söyleyen bir satır eklenir."""
    reader = _open(data)
    n = size = 0
    cut = 0
    parts: list[str] = []
    deadline = time.monotonic() + MAX_SECONDS
    try:
        total = len(reader.pages)
        for n in range(1, total + 1):
            if n > MAX_PAGES or size > MAX_CHARS or (n > 1 and time.monotonic() > deadline):
                cut = n
                break
            text = _clean(reader.pages[n - 1].extract_text() or "")
            if text:
                parts.append(f"## Sayfa {n}\n\n{text}")
                size += len(text)
    except Exception as e:
        raise ValueError(f"PDF {f'sayfa {n}' if n else 'sayfa listesi'} okunamadı: {e}") from e
    if cut and parts:
        parts.append(f"[... PDF {cut}. sayfadan sonrası okunmadı (sayfa/boyut/süre sınırı); toplam {total} sayfa ...]")
    return "\n\n".join(parts), _title(reader)
