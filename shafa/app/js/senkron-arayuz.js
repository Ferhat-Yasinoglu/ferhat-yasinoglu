// Ayarlar'daki "Kendi Google hesabına yedek" kartı ve yedekleme turunun arayüz tarafı.
// Karar mantığı depo/senkron.js'te; burası yalnız düğme, metin ve rapor.
import { el, btnS, girdi, alan, kart, rozet } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { senkronEt } from './depo/senkron.js';
import { driveTasima, cikisYap, VARSAYILAN_ISTEMCI } from './senkron/google.js';
import { KIMLIK_KALIBI } from './paylasilan/senkron.js';
import { tarihSaatMetni } from './paylasilan/tarih.js';
import { simdi, kasaKoduUret } from './paylasilan/kimlik.js';
import { hataMetni } from './hatalar.js';
import { t } from './i18n.js';

export const istemciKimligi = (ayar) => (ayar?.senkronIstemciId || VARSAYILAN_ISTEMCI || '').trim();

export const kimlikDurumu = (ayar) => {
  const kimlik = istemciKimligi(ayar);
  const kendi = !(ayar?.senkronIstemciId || '').trim();
  if (!kimlik) return { kimlik: '', kaynak: 'yok', gecerli: false };
  return { kimlik, kaynak: kendi ? 'gomulu' : 'ayar', gecerli: KIMLIK_KALIBI.test(kimlik) };
};
export const senkronHazir = (ayar) => !!istemciKimligi(ayar) && !!ayar?.senkronParolasi && !!ayar?.senkronAcik;

/**
 * Bir eşitleme turu. `sessiz` açılışta kendiliğinden çalışan tur için:
 * hata gösterilmez, yalnız meta'ya yazılır — hekim internetsizken uygulamayı
 * her açtığında kırmızı kutu görmesin diye.
 */
export async function senkronTuru(ctx, { sessiz = false } = {}) {
  const { depo } = ctx;
  const ayar = await depo.ayarlar();
  const kimlik = istemciKimligi(ayar);
  if (!kimlik || !ayar.senkronParolasi) {
    if (!sessiz) ctx.hata(t('senkron.eksik', 'Önce istemci kimliği ve kasa parolası girilmeli.'));
    return null;
  }
  if (!navigator.onLine) {
    if (!sessiz) ctx.uyar(t('senkron.cevrimdisi', 'İnternet yok — yedek internet gelince alınır.'));
    return null;
  }
  try {
    const sonuc = await senkronEt(depo, driveTasima(kimlik), { parola: ayar.senkronParolasi });
    await depo.metaKaydet({ sonSenkron: simdi(), sonSenkronHata: '', sonSenkronHataKodu: '' });
    return sonuc;
  } catch (e) {
    await depo.metaKaydet({
      sonSenkronHata: hataMetni(e, t('senkron.olmadi', 'Google\'a yedekleme yapılamadı')),
      sonSenkronHataKodu: e?.kod || '',
    });
    if (!sessiz) ctx.hata(hataMetni(e, t('senkron.olmadi', 'Google\'a yedekleme yapılamadı')));
    return null;
  }
}

/** Turun sonucunu tek cümleye indirir. */
export function senkronOzeti(s) {
  if (!s) return '';
  const { eklendi = 0, guncellendi = 0 } = s.indirildi || {};
  const inen = eklendi + guncellendi;
  if (inen && s.yuklendi) return t('senkron.iki_yon', '{n} kayıt indi, bu cihazdakiler de kaydedildi.', { n: inen });
  if (inen) return t('senkron.indi', '{n} kayıt Google\'dan indi.', { n: inen });
  if (s.yuklendi) return t('senkron.yuklendi', 'Bu cihazdakiler Google\'a kaydedildi.');
  return t('senkron.zaten', 'İki taraf zaten aynıydı.');
}

/* «Gelişmiş» açık mıydı, kart yeniden çizilince hatırlansın. Hatırlanmazsa
   hekim orada bir şey kaydettiği anda bölüm kapanıyor ve KAYDIN SONUCUNU —
   bozuk kimlik uyarısı dahil — hiç göremiyor. Denetim tam bunu yakaladı. */
let gelismisAcik = false;

export function senkronKarti(ctx, ayar, meta, yenile) {
  const { depo, basari, uyar } = ctx;
  const acik = !!ayar.senkronAcik;
  const kod = ayar.senkronParolasi || '';
  // Kasa kodu tutmadı demek: bu Google hesabında ZATEN bir yedek var ve onu
  // başka bir cihaz yapmış. Kodu metinden değil koddan anlıyoruz.
  const baskaCihaz = meta.sonSenkronHataKodu === 'parola';
  const rapor = el('div', { style: { marginBlockStart: 'var(--b-3)' } });

  /* Çakışan değer ekrana basılıyor ve `saglikGorseli` gibi bir alan base64
     fotoğraf taşıyor: kırpılmasa kartı satırlarca veri doldururdu. */
  const kisalt = (v) => {
    const m = String(v ?? '');
    if (m.startsWith('data:')) return t('senkron.gorsel_deger', '(fotoğraf)');
    return m.length > 60 ? m.slice(0, 57) + '…' : m;
  };
  const cakismaListesi = (cakisan) => el('div', { class: 'uyari', style: { marginBlockStart: 'var(--b-2)' } },
    simge('uyari', { boy: 16 }),
    el('div', {},
      el('div', {}, t('senkron.cakisma_bas', 'Şu alanlar iki cihazda farklıydı; bu cihazdaki daha yeni olan seçildi:')),
      el('ul', { class: 'sessiz' }, ...cakisan.slice(0, 8).map((c) =>
        el('li', {}, t('ayar.' + c.alan, c.alan) + ': ' + kisalt(c.secilen === 'yerel' ? c.uzak : c.yerel))))));

  async function eslestir() {
    rapor.replaceChildren(el('div', { class: 'uyari uyari--bilgi' }, simge('yenile', { boy: 16 }), el('span', {}, t('senkron.suruyor', 'Yedekleniyor…'))));
    const s = await senkronTuru(ctx, {});
    rapor.replaceChildren();
    if (!s) { yenile(); return; }
    basari(senkronOzeti(s));
    if (s.cakisan?.length) rapor.appendChild(cakismaListesi(s.cakisan));
    ctx.yenileMenu?.();
    yenile();
  }

  /* TEK DÜĞME. Hekim bu uygulamada hiçbir parola yazmıyor — yazdığı tek şifre
     kendi Gmail şifresi, o da Google'ın kendi penceresinde. İlk basışta kasa
     kodunu uygulama üretip saklıyor; hekim onu ancak ikinci cihaz eklerken
     görüyor. Eskiden burada bir "kasa parolası" kutusu ve bir "istemci
     kimliği" kutusu vardı: ikisi de hekimin işi değil. */
  async function girisYap() {
    const yama = {};
    if (!ayar.senkronParolasi) yama.senkronParolasi = kasaKoduUret();
    if (!ayar.senkronAcik) yama.senkronAcik = 1;
    if (Object.keys(yama).length) {
      await depo.ayarKaydet(yama);
      Object.assign(ayar, yama);
    }
    await eslestir();
  }

  /* --- Öbür cihazın kodu --- */
  const kodKutusu = girdi({ name: 'senkronKodu', value: '', autocomplete: 'off', spellcheck: false, dir: 'ltr' });
  const baskaCihazKutusu = () => el('div', { class: 'uyari uyari--hata', style: { marginBlock: 'var(--b-3)' } },
    simge('kilit', { boy: 16 }),
    el('div', { style: { flex: '1' } },
      el('div', {}, t('senkron.baska_cihaz', 'Bu Google hesabında zaten bir yedek var ve onu başka bir cihaz yaptı. O cihazın kodunu buraya yaz — orada «Gelişmiş» altında yazıyor.')),
      kodKutusu,
      btnS('onay', t('senkron.kod_kaydet', 'Kodu kaydet ve yeniden dene'), { class: 'btn', style: { marginBlockStart: 'var(--b-2)' }, onclick: async () => {
        const g = kodKutusu.value.trim().toUpperCase();
        if (!g) { uyar(t('senkron.kod_bos', 'Önce kodu yaz.')); return; }
        await depo.ayarKaydet({ senkronParolasi: g, senkronAcik: 1 });
        Object.assign(ayar, { senkronParolasi: g, senkronAcik: 1 });
        await depo.metaKaydet({ sonSenkronHata: '', sonSenkronHataKodu: '' });
        await eslestir();
      } })));

  /* --- Gelişmiş: hekimin günlük işinde yeri olmayan her şey --- */
  const kimlikKutusu = girdi({ name: 'senkronIstemciId', value: ayar.senkronIstemciId || '', autocomplete: 'off', spellcheck: false, dir: 'ltr' });
  const kimlikSatiri = () => {
    const d = kimlikDurumu(ayar);
    if (!d.kimlik) return null;
    const kisa = d.kimlik.length > 34 ? d.kimlik.slice(0, 30) + '…' : d.kimlik;
    if (!d.gecerli) {
      return el('div', { class: 'uyari uyari--hata', style: { marginBlockStart: 'var(--b-2)' } },
        simge('uyari', { boy: 16 }),
        el('span', {}, t('senkron.kimlik_bozuk', 'Buradaki kimlik biçime uymuyor, Google tanımaz: {k} — alanı boşaltıp kaydedersen uygulamanın kendi kimliği kullanılır.', { k: kisa })));
    }
    return el('div', { class: 'sessiz', style: { marginBlockStart: 'var(--b-1)' } },
      d.kaynak === 'gomulu'
        ? t('senkron.kimlik_gomulu', 'Kullanılan kimlik: {k} (uygulamanın kendi kimliği)', { k: kisa })
        : t('senkron.kimlik_ayar', 'Kullanılan kimlik: {k} (buradan girildi)', { k: kisa }));
  };

  // Bozuk kimlik uyarısı bölümün içinde: katlı kalırsa hekim sorunu hiç görmez.
  // O durumda bölüm kendiliğinden açılıyor.
  const zorlaAcik = !!kimlikDurumu(ayar).kimlik && !kimlikDurumu(ayar).gecerli;
  const gelismis = el('details', { class: 'gelismis', ...(gelismisAcik || zorlaAcik ? { open: '' } : {}) },
    el('summary', {}, t('senkron.gelismis', 'Gelişmiş')),
    kod
      ? el('div', { style: { marginBlockStart: 'var(--b-3)' } },
        alan(t('senkron.kod', 'Bu cihazın kodu'), el('div', {},
          el('code', { class: 'kod', dir: 'ltr' }, kod),
          btnS('kaydet', t('senkron.kopyala', 'Kopyala'), { class: 'btn btn--kucuk', style: { marginInlineStart: 'var(--b-2)' }, onclick: async () => {
            try { await navigator.clipboard.writeText(kod); basari(t('senkron.kopyalandi', 'Kod kopyalandı')); }
            catch { uyar(t('senkron.kopya_olmadi', 'Kopyalanamadı — kodu elle yaz.')); }
          } })), {
          ipucu: t('senkron.kod_alt', 'İkinci cihazın aynı kayıtları görmesi için o cihazda bu kodu yaz. Uygulama bunu kendi üretti; Google\'ın parolası değil ve Google onu görmez.'),
        }))
      : null,
    el('div', { class: 'uyari uyari--bilgi', style: { marginBlock: 'var(--b-3)' } },
      simge('kilit', { boy: 16 }),
      el('span', {}, t('senkron.gizlilik', 'Yüklenmeden önce her şey bu cihazda şifrelenir; Google yalnız şifreli veriyi görür. Kod cihazdan çıkmaz. Kod kaybolur ve elde başka cihaz kalmazsa Google\'daki kopya açılamaz — asıl yedek yine dosya yedeğidir.'))),
    alan(t('senkron.istemci', 'Google istemci kimliği'), el('div', {}, kimlikKutusu, kimlikSatiri()), {
      ipucu: t('senkron.istemci_ipucu', 'Boş bırak — uygulamanın kendi kimliği kullanılır. Yalnız kendi Google Cloud projeni kullanmak istersen buraya yaz.'),
    }),
    btnS('kaydet', t('senkron.kaydet', 'Gelişmiş ayarları kaydet'), { class: 'btn', style: { marginBlockStart: 'var(--b-3)' }, onclick: async () => {
      await depo.ayarKaydet({ senkronIstemciId: kimlikKutusu.value.trim() });
      basari(t('ayar.kaydedildi', 'Bilgiler kaydedildi'));
      yenile();
    } }));

  gelismis.addEventListener('toggle', () => { gelismisAcik = gelismis.open; });

  return kart({},
    el('div', { class: 'kart__bas' },
      el('h2', {}, t('senkron.baslik', 'Kendi Google hesabına yedek')),
      acik ? rozet(t('senkron.acik', 'açık'), 'yesil') : rozet(t('senkron.kapali', 'kapalı'), 'gri')),
    el('p', { class: 'kart__alt' }, t('senkron.alt', 'Veriler KENDİ Google hesabına şifreli konur; Google içeriği göremez. Bilgisayarla telefon da aynı kayıtları alır.')),

    baskaCihaz ? baskaCihazKutusu() : null,

    el('div', { class: 'satir', style: { marginBlockStart: 'var(--b-4)' } },
      btnS(acik ? 'yenile' : 'bulut', acik ? t('senkron.simdi', 'Şimdi yedekle') : t('senkron.giris', 'Google ile giriş yap'), {
        class: 'btn btn--birincil btn--buyuk',
        onclick: girisYap,
      }),
      acik
        ? btnS('kapat', t('senkron.cikis', 'Google\'dan çık'), { class: 'btn btn--sade', onclick: async () => {
          cikisYap();
          await depo.ayarKaydet({ senkronAcik: 0 });
          uyar(t('senkron.cikildi', 'Çıkıldı. Google\'daki kopyaya dokunulmadı.'));
          yenile();
        } })
        : null),

    acik
      ? (meta.sonSenkron
        ? el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } }, t('senkron.son', 'Google\'a son yedek: {t}', { t: tarihSaatMetni(meta.sonSenkron) }))
        : el('p', { class: 'kart__alt', style: { marginBlockStart: 'var(--b-3)' } }, t('senkron.hic', 'Google\'a henüz yedek alınmadı.')))
      : null,
    meta.sonSenkronHata && !baskaCihaz
      ? el('div', { class: 'uyari uyari--hata' }, simge('hata', { boy: 16 }), el('span', {}, meta.sonSenkronHata))
      : null,

    rapor,
    gelismis);
}
