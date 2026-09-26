// Eşitlemenin karar mantığı. Saf: depo da, ağ da, DOM da görmez.
//
// Kayıt zarfı (id, rev, guncellendi, silindi) eşitleme için zaten yeterli:
// bağımsız kayıtlarda "guncellendi'si yeni olan kazanır" doğru davranıştır,
// silme mezar taşı olduğu için de silinen kayıt öbür cihazda dirilmiyor.
//
// İki yer bu kuralın dışında kalıyor, ikisi de AYARLAR kaydında:
//
// 1) Ayarlar tek bir kayıt. Bütün antet alanları aynı zarfı paylaştığı için
//    "yenisi kazansın" dersek, telefonda boş bırakılmış bir antet bilgisayarda
//    doldurulmuş anteti silip süpürür. Bu yüzden ayarlar ALAN ALAN birleşiyor:
//    bir tarafta boş, öbüründe dolu olan alan dolu kalıyor; iki taraf da dolu
//    ve farklıysa yenisi seçiliyor ama eskisi rapora yazılıyor ki hekim görsün.
//
// 2) Reçete doğrulama anahtarı da ayarların içinde ve CİHAZ BAŞINA üretiliyor.
//    Düz "yenisi kazanır" iki cihazdan birinin anahtarını çöpe atardı; o cihazda
//    o güne kadar basılmış bütün reçetelerin kodu bir daha tutmazdı. Kaybeden
//    anahtar siliniyor değil, `eskiAnahtarlar`a düşüyor; doğrulama sırayla
//    hepsini deniyor. (Aynı tehlike yedekten geri yüklemede de vardı.)

/** Google dönemindeki eşitlemenin cihaza özel ayarları. Artık kimse yazmıyor;
 *  açılışta bir kez ayarlardan siliniyor (depo/senkron.js). Listede KALIYORLAR:
 *  güncellenmemiş eski bir cihazın yedeğinden ya da kasasından gelseler bile
 *  hiçbir yere taşınmasınlar — senkronParolasi o dönemin kasa anahtarıydı. */
export const ESKI_SENKRON_AYARLARI = ['senkronParolasi', 'senkronIstemciId', 'senkronIstemciIdBozuk', 'senkronAcik', 'senkronHesap', 'senkronDosyaId'];

/** Eşitlemeyle gidip gelmeyen, yedek dosyasına da girmeyen, her cihazda
 *  kendine ait kalan ayarlar. Hesabın durumu (jeton, K) ayarlarda değil,
 *  meta deposunda duruyor; buradaki hesap adları yalnız savunma: biri bu
 *  adlarla bir alan yazsa bile cihazdan çıkmasın. İmza görseli de burada:
 *  hekimin imzası çalınırsa sahte reçete basılır, cihazdan hiç çıkmıyor. */
export const CIHAZA_OZEL_AYARLAR = [...ESKI_SENKRON_AYARLARI, 'hesap', 'hesapKullanici', 'hesapJetonu', 'hesapSunucu', 'imzaGorseli'];

/** Kayıttan cihaza özel alanları söker (yeni nesne döner). */
export function cihazaOzelSiz(kayit) {
  const temiz = { ...kayit };
  for (const a of CIHAZA_OZEL_AYARLAR) delete temiz[a];
  return temiz;
}

const ZARF_ALANLARI = ['id', 'rev', 'olusturuldu', 'guncellendi', 'silindi', 'silindiZamani'];
const ANAHTAR_ALANLARI = ['dogrulamaAnahtari', 'eskiAnahtarlar'];

/** Biriken eski anahtar sayısına sınır: doğrulama her birini tek tek deniyor. */
export const EN_COK_ESKI_ANAHTAR = 20;

const bosMu = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const esitMi = (a, b) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const enBuyuk = (...l) => l.filter(Boolean).sort().at(-1) || '';
const enKucuk = (...l) => l.filter(Boolean).sort()[0] || '';

/**
 * İki ayar kaydının doğrulama anahtarlarını birleştirir.
 * Aktif anahtar kazananınki; kaybedenin anahtarı ve her iki taraftaki eskiler
 * `eskiAnahtarlar`da toplanır. Sıralı: iki cihaz da aynı listeyi üretsin diye.
 */
export function anahtarlariBirlestir(kazanan, kaybeden) {
  const aktif = kazanan?.dogrulamaAnahtari || kaybeden?.dogrulamaAnahtari || '';
  const havuz = new Set();
  for (const k of [kazanan, kaybeden]) {
    if (!k) continue;
    if (k.dogrulamaAnahtari) havuz.add(k.dogrulamaAnahtari);
    for (const a of k.eskiAnahtarlar || []) if (a) havuz.add(a);
  }
  havuz.delete(aktif);
  const eski = [...havuz].sort().slice(0, EN_COK_ESKI_ANAHTAR);
  const out = {};
  if (aktif) out.dogrulamaAnahtari = aktif;
  if (eski.length) out.eskiAnahtarlar = eski;
  return out;
}

/**
 * Ayar kaydını alan alan birleştirir.
 * tercih: 'yeni' (guncellendi'si yeni olan) | 'yerel' | 'uzak'
 * Döner: { sonuc, cakisan: [{alan, yerel, uzak, secilen}], degisti }
 *
 * `guncellendi` bilerek yeni damga ALMIYOR, iki tarafın büyüğü oluyor:
 * damga atsaydık her eşitleme kaydı "yeni" yapar, öbür cihaz onu çekip yine
 * yeni yapar ve ayarlar iki cihaz arasında sonsuza kadar gidip gelirdi.
 */
export function ayarlariBirlestir(yerel, uzak, { tercih = 'yeni' } = {}) {
  const y = yerel || {};
  const u = uzak || {};
  // Kaydın kendi id'si korunuyor. Ayarlar koleksiyonunda pratikte tek kayıt
  // ('genel') var ama id'yi varsayıp yazmak, başka bir id gelirse kaydı
  // sessizce yeniden adlandırırdı.
  const kimlik = y.id || u.id || 'genel';
  if (!uzak) return { sonuc: { ...y, id: kimlik }, cakisan: [], degisti: false };
  // Yerelde kayıt yokken bile uzaktakinin cihaza özel alanları ALINMAZ:
  // başka bir cihazın (ya da hekimin) anahtarı bu cihaza yerleşmesin.
  if (!yerel) return { sonuc: { ...cihazaOzelSiz(u), id: kimlik }, cakisan: [], degisti: true };

  const yerelYeni = (y.guncellendi || '') >= (u.guncellendi || '');
  const yerelKazandi = tercih === 'yerel' || (tercih === 'yeni' && yerelYeni);
  const kazanan = yerelKazandi ? y : u;
  const kaybeden = yerelKazandi ? u : y;

  const paylasilan = [...new Set([...Object.keys(y), ...Object.keys(u)])]
    .filter((a) => !ZARF_ALANLARI.includes(a) && !ANAHTAR_ALANLARI.includes(a) && !CIHAZA_OZEL_AYARLAR.includes(a))
    .sort();

  const sonuc = { id: kimlik };
  const cakisan = [];
  for (const a of paylasilan) {
    const yv = y[a], uv = u[a];
    if (bosMu(yv) && bosMu(uv)) sonuc[a] = a in y ? yv : uv;
    else if (bosMu(yv)) sonuc[a] = uv;
    else if (bosMu(uv)) sonuc[a] = yv;
    else if (esitMi(yv, uv)) sonuc[a] = yv;
    else {
      sonuc[a] = kazanan[a];
      cakisan.push({ alan: a, yerel: yv, uzak: uv, secilen: yerelKazandi ? 'yerel' : 'uzak' });
    }
  }
  Object.assign(sonuc, anahtarlariBirlestir(kazanan, kaybeden));
  for (const a of CIHAZA_OZEL_AYARLAR) if (a in y) sonuc[a] = y[a];

  const olusturuldu = enKucuk(y.olusturuldu, u.olusturuldu);
  if (olusturuldu) sonuc.olusturuldu = olusturuldu;
  const guncellendi = enBuyuk(y.guncellendi, u.guncellendi);
  if (guncellendi) sonuc.guncellendi = guncellendi;
  sonuc.rev = Math.max(Number(y.rev) || 0, Number(u.rev) || 0);
  sonuc.silindi = 0;

  // Karşılaştırmanın dışında yalnız `rev` ve cihaza özel alanlar var.
  // `guncellendi` İÇERİDE olmalı: iki cihaz aynı anteti ayrı ayrı yazdığında
  // içerik aynı, damga farklı oluyor. Damgaya bakmasaydık "değişen yok" deyip
  // kimse yazmaz, iki cihaz da her turda kendi damgasını öbürüne yükleyip
  // dururdu. Damga iki tarafın büyüğüne eşitlendiği için tek yazmada oturuyor.
  const olcut = (k) => JSON.stringify(Object.fromEntries(
    Object.entries(k).filter(([a]) => a !== 'rev' && !CIHAZA_OZEL_AYARLAR.includes(a)).sort()));
  return { sonuc, cakisan, degisti: olcut(sonuc) !== olcut(y) };
}

/** Belgeden cihaza özel ayarları söker. Hem eşitlemede hem DOSYA YEDEĞİNDE
 *  çalışır: yedek dosyası WhatsApp'la, USB'yle el değiştiriyor; içinde bir
 *  cihazın anahtarı durmamalı. */
export function belgeyiTemizle(belge) {
  const kopya = { ...belge, koleksiyonlar: { ...(belge?.koleksiyonlar || {}) } };
  const ayarlar = kopya.koleksiyonlar.ayarlar;
  if (Array.isArray(ayarlar)) kopya.koleksiyonlar.ayarlar = ayarlar.map(cihazaOzelSiz);
  return kopya;
}

/**
 * Örnek (demo) kayıtları belgeden söker — YALNIZ eşitlemede. Örnekler hiçbir
 * cihaza taşınmaz: yüklenselerdi «örnek verileri sil» bir cihazda silip
 * öbüründen geri indirirdi (kalıcı silme mezar taşı bırakmıyor). Dosya
 * yedeğinde duruyorlar; hekim yedeği kendi cihazına geri yüklüyor.
 */
export function ornekleriAyikla(belge) {
  const koleksiyonlar = {};
  for (const [ad, liste] of Object.entries(belge?.koleksiyonlar || {})) {
    koleksiyonlar[ad] = Array.isArray(liste) ? liste.filter((k) => k?.ornek !== 1) : liste;
  }
  return { ...belge, koleksiyonlar };
}

/** Nesneyi anahtar sırasından bağımsız hale getirir — parmak izi için. */
function duzle(v) {
  if (Array.isArray(v)) return v.map(duzle);
  if (v && typeof v === 'object') {
    const out = {};
    for (const a of Object.keys(v).sort()) out[a] = duzle(v[a]);
    return out;
  }
  return v;
}

/**
 * Belgenin içeriğini temsil eden kararlı metin. İki cihazdaki belge aynı
 * veriyi taşıyorsa parmak izleri de aynı olur; eşitleme buna bakıp gereksiz
 * yüklemeyi atlıyor.
 *
 * `rev` DIŞARIDA: her içe aktarma rev'i bir artırıyor, bu yüzden aynı içerik
 * iki cihazda farklı rev taşıyor. İçeriğin tamamı ise İÇERİDE — yalnız id ve
 * `guncellendi`ye baksaydık, ayarlar kaydı alan alan birleştiği için iki
 * cihazda aynı damgayla FARKLI içerik durabilir ve eşitleme "değişmemiş" deyip
 * öbür cihazın alanını hiç göndermezdi.
 */
export function belgeParmakIzi(belge) {
  const out = [];
  for (const ad of Object.keys(belge?.koleksiyonlar || {}).sort()) {
    const liste = (belge.koleksiyonlar[ad] || []).map((k) => {
      const temiz = { ...k };
      delete temiz.rev;
      if (ad === 'ayarlar') for (const a of CIHAZA_OZEL_AYARLAR) delete temiz[a];
      return duzle(temiz);
    });
    liste.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    out.push([ad, liste]);
  }
  return JSON.stringify(out);
}

/** Rapordaki sayıları tek satıra indirir: {eklendi, guncellendi, atlandi}. */
export function raporToplami(rapor) {
  const t = { eklendi: 0, guncellendi: 0, atlandi: 0 };
  for (const r of Object.values(rapor || {})) {
    t.eklendi += r.eklendi || 0;
    t.guncellendi += r.guncellendi || 0;
    t.atlandi += r.atlandi || 0;
  }
  return t;
}
