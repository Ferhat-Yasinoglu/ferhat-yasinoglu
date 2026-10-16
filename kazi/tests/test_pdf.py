import io

import pytest
from pypdf import PageObject, PdfReader, PdfWriter

from kazi.pdf import pdf_to_markdown


def _esc(s: str) -> bytes:
    return s.encode("cp1252").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def make_pdf(pages: list[str | None], title: str | None = None) -> bytes:
    """Elle minimal PDF: str → o sayfanın metni (satırlar \\n ile), None → içeriksiz sayfa."""
    n = len(pages)
    objs: dict[int, bytes] = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Count %d /Kids [%s] >>"
           % (n, b" ".join(b"%d 0 R" % (4 + 2 * i) for i in range(n))),
        3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    }
    for i, text in enumerate(pages):
        page, content = 4 + 2 * i, 5 + 2 * i
        res = b"/Resources << /Font << /F1 3 0 R >> >> /MediaBox [0 0 612 792]"
        if text is None:
            objs[page] = b"<< /Type /Page /Parent 2 0 R %s >>" % res
            objs[content] = b"<< /Length 0 >>\nstream\n\nendstream"
            continue
        ops = b"BT /F1 12 Tf 72 720 Td 16 TL\n"
        for line in text.split("\n"):
            ops += b"(" + _esc(line) + b") Tj T*\n"
        ops += b"ET"
        objs[page] = b"<< /Type /Page /Parent 2 0 R /Contents %d 0 R %s >>" % (content, res)
        objs[content] = b"<< /Length %d >>\nstream\n%s\nendstream" % (len(ops), ops)
    trailer = b"/Root 1 0 R"
    if title is not None:
        info = max(objs) + 1
        objs[info] = b"<< /Title (" + _esc(title) + b") >>"
        trailer += b" /Info %d 0 R" % info
    out, offsets = bytearray(b"%PDF-1.4\n"), {}
    for num in sorted(objs):
        offsets[num] = len(out)
        out += b"%d 0 obj\n%s\nendobj\n" % (num, objs[num])
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for num in sorted(objs):
        out += b"%010d 00000 n \n" % offsets[num]
    out += b"trailer\n<< /Size %d %s >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, trailer, xref)
    return bytes(out)


def encrypt(raw: bytes, user: str, algorithm: str) -> bytes:
    w = PdfWriter(clone_from=PdfReader(io.BytesIO(raw)))
    w.encrypt(user_password=user, owner_password="sahip", algorithm=algorithm)
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def test_make_pdf_is_valid():
    r = PdfReader(io.BytesIO(make_pdf(["a", "b"])))
    assert len(r.pages) == 2 and r.pages[1].extract_text().strip() == "b"


def test_sayfa_basliklari_ve_sira():
    md, _ = pdf_to_markdown(make_pdf(["Birinci sayfa\nikinci satir", "Ikinci sayfa metni"]))
    assert md.startswith("## Sayfa 1\n\nBirinci sayfa")
    assert "ikinci satir" in md
    assert md.index("## Sayfa 1") < md.index("## Sayfa 2") < md.index("Ikinci sayfa metni")
    assert md.count("## Sayfa") == 2


def test_turkce_latin1_karakterler():
    md, _ = pdf_to_markdown(make_pdf(["Çözüm (öncü) ve \\ ters bölü"]))
    assert "Çözüm (öncü) ve \\ ters bölü" in md


def test_baslik_ustverisinden():
    _, title = pdf_to_markdown(make_pdf(["x"], title="  Rapor Özeti "))
    assert title == "Rapor Özeti"


@pytest.mark.parametrize("title", [None, "", "   "])
def test_baslik_yoksa_none(title):
    assert pdf_to_markdown(make_pdf(["x"], title=title))[1] is None


def test_bos_sayfa_atlanir_numara_kaymaz():
    md, _ = pdf_to_markdown(make_pdf(["bir", None, "  \n ", "dort"]))
    assert "## Sayfa 1" in md and "## Sayfa 4" in md
    assert "## Sayfa 2" not in md and "## Sayfa 3" not in md


def test_hic_metin_yoksa_bos_markdown():
    md, title = pdf_to_markdown(make_pdf([None, None], title="Tarama"))
    assert md == "" and title == "Tarama"


def test_pypdf_ile_uretilen_bos_sayfa():
    w = PdfWriter()
    w.add_blank_page(200, 200)
    buf = io.BytesIO()
    w.write(buf)
    assert pdf_to_markdown(buf.getvalue()) == ("", None)


def test_bosluk_temizligi(monkeypatch):
    monkeypatch.setattr(PageObject, "extract_text",
                        lambda self, *a, **k: "satir  \r\n\r\n\r\n\r\nikinci\x00\xa0x\n\n")
    md, _ = pdf_to_markdown(make_pdf(["x"]))
    assert md == "## Sayfa 1\n\nsatir\n\nikinci x"


def test_bytearray_kabul():
    md, _ = pdf_to_markdown(bytearray(make_pdf(["merhaba"])))
    assert "merhaba" in md


def test_bayt_olmayan_tip():
    with pytest.raises(TypeError):
        pdf_to_markdown("metin")  # type: ignore[arg-type]


@pytest.mark.parametrize("data,parca", [
    (b"", "boş"),
    (b"<html><body>PDF degil</body></html>", "PDF değil"),
    (b"%PDF-1.4\nbu gercek bir pdf degil\n", "bozuk"),
])
def test_gecersiz_girdi_valueerror(data, parca):
    with pytest.raises(ValueError, match=parca):
        pdf_to_markdown(data)


def test_kesik_pdf_valueerror():
    raw = make_pdf([f"sayfa metni {i}" for i in range(1, 6)])
    with pytest.raises(ValueError, match="bozuk"):
        pdf_to_markdown(raw[: len(raw) // 2])


def test_sayfa_okuma_hatasi_valueerror(monkeypatch):
    calls = []

    def boom(self, *a, **k):
        calls.append(1)
        if len(calls) == 2:
            raise RuntimeError("cozulemeyen akis")
        return "ok"

    monkeypatch.setattr(PageObject, "extract_text", boom)
    with pytest.raises(ValueError, match="sayfa 2 okunamadı.*cozulemeyen akis"):
        pdf_to_markdown(make_pdf(["a", "b", "c"]))


def test_parolali_pdf_valueerror():
    raw = encrypt(make_pdf(["gizli icerik"]), "parola", "RC4-128")
    with pytest.raises(ValueError, match="parola"):
        pdf_to_markdown(raw)


def test_bos_kullanici_parolali_pdf_acilir():
    raw = encrypt(make_pdf(["acik icerik"], title="Kilitli"), "", "RC4-128")
    assert PdfReader(io.BytesIO(raw)).is_encrypted
    md, title = pdf_to_markdown(raw)
    assert "acik icerik" in md and title == "Kilitli"


def test_aes_bos_parola_acilir():
    pytest.importorskip("cryptography")
    raw = encrypt(make_pdf(["aes icerik"]), "", "AES-256")
    assert "aes icerik" in pdf_to_markdown(raw)[0]


def test_aes_cryptography_yoksa_anlasilir_hata(monkeypatch):
    from pypdf.errors import DependencyError

    def no_crypto(self, password):
        raise DependencyError("cryptography>=3.1 is required for AES algorithm")

    monkeypatch.setattr(PdfReader, "decrypt", no_crypto)
    raw = encrypt(make_pdf(["x"]), "", "RC4-128")
    with pytest.raises(ValueError, match="pip install cryptography"):
        pdf_to_markdown(raw)


def test_sayfa_siniri_asilinca_kirpilir_ve_soylenir(monkeypatch):
    import kazi.pdf as pdf

    monkeypatch.setattr(pdf, "MAX_PAGES", 2)
    md, _ = pdf_to_markdown(make_pdf(["bir", "iki", "uc", "dort"]))
    assert "## Sayfa 2\n\niki" in md and "## Sayfa 3" not in md
    assert md.endswith("[... PDF 3. sayfadan sonrası okunmadı (sayfa/boyut/süre sınırı); toplam 4 sayfa ...]")


def test_karakter_siniri_asilinca_kirpilir(monkeypatch):
    import kazi.pdf as pdf

    monkeypatch.setattr(pdf, "MAX_CHARS", 5)
    md, _ = pdf_to_markdown(make_pdf(["birinci sayfa", "ikinci sayfa", "ucuncu"]))
    assert "birinci sayfa" in md and "ikinci" not in md and "2. sayfadan sonrası okunmadı" in md


def test_sure_siniri_asilinca_ilk_sayfa_yine_okunur(monkeypatch):
    import kazi.pdf as pdf

    monkeypatch.setattr(pdf, "MAX_SECONDS", 0)
    md, _ = pdf_to_markdown(make_pdf(["birinci", "ikinci", "ucuncu"]))
    assert "## Sayfa 1\n\nbirinci" in md and "ikinci" not in md and "toplam 3 sayfa" in md


def test_sinirlar_normal_pdf_ve_taranmis_pdf_cikisini_degistirmez(monkeypatch):
    import kazi.pdf as pdf

    md, _ = pdf_to_markdown(make_pdf(["a", "b", "c"]))
    assert md == "## Sayfa 1\n\na\n\n## Sayfa 2\n\nb\n\n## Sayfa 3\n\nc"
    monkeypatch.setattr(pdf, "MAX_PAGES", 1)
    assert pdf_to_markdown(make_pdf([None, None]))[0] == ""  # metin yoksa kırpma satırı da yok
