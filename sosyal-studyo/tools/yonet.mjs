// Worker yönetim işlemleri (CI'dan elle tetiklenir). Yönetici API'sini kullanır;
// gizli değer yazmaz, yalnız id, ad ve durum yazar.
// Ortam: URL, YONETICI_ANAHTARI, ISLEM (durum|akis_yayinla|canliya_al|provaya_al), AKIS_ID (isteğe bağlı)

const URL_ADRES = process.env.URL;
const ANAHTAR = process.env.YONETICI_ANAHTARI;
const ISLEM = process.env.ISLEM || 'durum';
const AKIS_ID = (process.env.AKIS_ID || '').trim();

if (!URL_ADRES || !ANAHTAR) { console.log('::error::URL ya da YONETICI_ANAHTARI yok'); process.exit(1); }

const basliklar = { Authorization: 'Bearer ' + ANAHTAR, 'X-SS-Sema': '1', 'Content-Type': 'application/json' };

async function api(yol, secenek = {}) {
  const r = await fetch(URL_ADRES + yol, { ...secenek, headers: { ...basliklar, ...(secenek.headers || {}) } });
  const j = await r.json().catch(() => ({ ok: false, mesaj: 'yanıt JSON değil (' + r.status + ')' }));
  if (!j.ok) throw Object.assign(new Error(j.mesaj || ('HTTP ' + r.status)), { kod: j.hata, durum: r.status });
  return j.veri;
}

const canlilar = (v) => (v.kayitlar || []).filter((k) => !k.silindi);

async function durumYaz() {
  const [akislar, tetler, hesaplar] = await Promise.all([
    api('/api/k/akislar?limit=200').then(canlilar),
    api('/api/k/tetikleyiciler?limit=200').then(canlilar),
    api('/api/k/hesaplar?limit=200').then(canlilar),
  ]);
  const saglik = await fetch(URL_ADRES + '/health').then((r) => r.json()).catch(() => ({}));
  console.log(`PROVA: ${saglik.prova ? 'açık (dış gönderim yok)' : 'KAPALI (canlı gönderim açık)'} · sürüm ${saglik.surum || '?'}`);
  for (const h of hesaplar) console.log(`hesap ${h.id} · ${h.kanal} · ${h.durum}${h.ad ? ' · ' + h.ad : ''}`);
  for (const a of akislar) console.log(`akis  ${a.id} · ${a.durum} · ${(a.adimlar || []).length} adım · ${a.ad}`);
  for (const x of tetler) {
    const a = akislar.find((y) => y.id === x.akis_id);
    console.log(`tetik ${x.id} · ${x.tip} · aktif=${x.aktif ? 1 : 0} → ${a ? (a.durum === 'yayinda' ? 'ÇALIŞIR' : 'akış taslak · ÇALIŞMAZ') : 'akış yok · ÇALIŞMAZ'}`);
  }
  const calisan = tetler.filter((x) => { const a = akislar.find((y) => y.id === x.akis_id); return x.aktif && a && a.durum === 'yayinda'; });
  console.log(calisan.length ? `→ ${calisan.length} tetikleyici çalışır durumda` : '→ UYARI: çalışır tetikleyici yok; gelen mesaj hiçbir akışı başlatmaz');
  return { akislar, tetler, hesaplar, saglik };
}

async function akisYayinla() {
  const akislar = await api('/api/k/akislar?limit=200').then(canlilar);
  const hedefler = AKIS_ID ? akislar.filter((a) => a.id === AKIS_ID) : akislar.filter((a) => a.durum !== 'yayinda');
  if (!hedefler.length) { console.log('Yayına alınacak taslak akış yok.'); return; }
  let basarili = 0;
  for (const a of hedefler) {
    const govde = { ...a, durum: 'yayinda', surum: (a.surum || 0) + 1, yayin_tarihi: new Date().toISOString() };
    delete govde.rev; delete govde.degisiklik_no;
    try {
      await api(`/api/k/akislar/${a.id}`, { method: 'PUT', body: JSON.stringify(govde), headers: { 'If-Match': String(a.rev ?? '') } });
      console.log(`✓ yayında: ${a.ad} (${a.id})`);
      basarili++;
    } catch (e) {
      // Worker yayına almadan önce adımları doğrular; hata mesajı neyin eksik olduğunu söyler.
      console.log(`::warning::${a.ad} yayına alınamadı: ${e.message}`);
    }
  }
  console.log(`${basarili}/${hedefler.length} akış yayına alındı.`);
}

async function hesapDurum(yeni) {
  const hesaplar = await api('/api/k/hesaplar?limit=200').then(canlilar);
  if (!hesaplar.length) { console.log('Hesap yok.'); return; }
  for (const h of hesaplar) {
    await api('/api/kanal/hesap/durum', { method: 'POST', body: JSON.stringify({ hesap_id: h.id, durum: yeni }) });
    console.log(`✓ ${h.kanal} (${h.id}) → ${yeni}`);
  }
}

try {
  if (ISLEM === 'akis_yayinla') await akisYayinla();
  else if (ISLEM === 'canliya_al') await hesapDurum('canli');
  else if (ISLEM === 'provaya_al') await hesapDurum('prova');
  console.log('--- durum ---');
  await durumYaz();
} catch (e) {
  console.log(`::error::${ISLEM} başarısız: ${e.message}`);
  process.exit(1);
}
