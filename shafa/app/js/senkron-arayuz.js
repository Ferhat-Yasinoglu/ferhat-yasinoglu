// Ayarlar'daki "Google ile eşitle" kartı ve eşitleme turunun arayüz tarafı.
// Karar mantığı depo/senkron.js'te; burası yalnız düğme, metin ve rapor.
import { el, btnS, girdi, alan, kart, rozet } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { senkronEt } from './depo/senkron.js';
import { driveTasima, cikisYap, VARSAYILAN_ISTEMCI } from './senkron/google.js';
import { tarihSaatMetni } from './paylasilan/tarih.js';
import { simdi } from './paylasilan/kimlik.js';
import { hataMetni } from './hatalar.js';
import { t } from './i18n.js';

export const istemciKimligi = (ayar) => (ayar?.senkronIstemciId || VARSAYILAN_ISTEMCI || '').trim();

/** Google istemci kimliğinin biçimi. Ayarlara yarım yapıştırılmış bir değer
 *  gömülü kimliğin yerine geçiyor ve Google "böyle bir client yok" diyor —
 *  hata Google'dan geldiği için de sebebi uygulamada hiç görünmüyordu. */
export const KIMLIK_KALIBI = /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/;
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
    if (!sessiz) ctx.uyar(t('senkron.cevrimdisi', 'İnternet yok — eşitleme internet gelince yapılabilir.'));
    return null;
  }
  try {
    const sonuc = await senkronEt(depo, driveTasima(kimlik), { parola: ayar.senkronParolasi });
    await depo.metaKaydet({ sonSenkron: simdi(), sonSenkronHata: '' });
    return sonuc;
  } catch (e) {
    await depo.metaKaydet({ sonSenkronHata: hataMetni(e, t('senkron.olmadi', 'Eşitleme yapılamadı')) });
    if (!sessiz) ctx.hata(hataMetni(e, t('senkron.olmadi', 'Eşitleme yapılamadı')));
    return null;
  }
}

/** Turun sonucunu tek cümleye indirir. */
export function senkronOzeti(s) {
  if (!s) return '';
  const { eklendi = 0, guncellendi = 0 } = s.indirildi || {};
  const inen = eklendi + guncellendi;
  if (inen && s.yuklendi) return t('senkron.iki_yon', '{n} kayıt indi, bu cihazdakiler de yüklendi.', { n: inen });
  if (inen) return t('senkron.indi', '{n} kayıt indi.', { n: inen });
  if (s.yuklendi) return t('senkron.yuklendi', 'Bu cihazdakiler buluta yüklendi.');
  return t('senkron.zaten', 'İki taraf zaten aynıydı.');
}

export function senkronKarti(ctx, ayar, meta, yenile) {
  const { depo, basari, uyar } = ctx;
  const kimlikKutusu = girdi({ name: 'senkronIstemciId', value: ayar.senkronIstemciId || '', autocomplete: 'off', spellcheck: false, dir: 'ltr' });
  const parolaKutusu = girdi({ name: 'senkronParolasi', type: 'password', value: ayar.senkronParolasi || '', autocomplete: 'new-password' });
  const rapor = el('div', { style: { marginBlockStart: 'var(--b-3)' } });
  const acik = !!ayar.senkronAcik;

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

  /* Hangi kimliğin GERÇEKTEN kullanıldığı yazıyor. Bu satır olmadan, ayarlara
     yarım kalmış bir kimlik yapıştırılmışsa hekim yalnız Google'ın "client
     bulunamadı" ekranını görüyor ve sebebin kendi ayarında olduğunu anlamıyor. */
  function kimlikSatiri() {
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
  }

  async function eslestir() {
    rapor.replaceChildren(el('div', { class: 'uyari uyari--bilgi' }, simge('yenile', { boy: 16 }), el('span', {}, t('senkron.suruyor', 'Eşitleniyor…'))));
    const s = await senkronTuru(ctx, {});
    rapor.replaceChildren();
    if (!s) { yenile(); return; }
    basari(senkronOzeti(s));
    if (s.cakisan?.length) rapor.appendChild(cakismaListesi(s.cakisan));
    ctx.yenileMenu?.();
    yenile();
  }

  return kart({},
    el('div', { class: 'kart__bas' },
      el('h2', {}, t('senkron.baslik', 'Google ile eşitle')),
      acik ? rozet(t('senkron.acik', 'açık'), 'yesil') : rozet(t('senkron.kapali', 'kapalı'), 'gri')),
    el('p', { class: 'kart__alt' }, t('senkron.alt', 'Bilgisayarla telefonun aynı kayıtları kullanması için. Veriler kendi Google Drive hesabının gizli uygulama klasörüne konur; Drive\'da görünmez ve başka uygulamalar okuyamaz.')),

    el('div', { class: 'uyari uyari--bilgi', style: { marginBlock: 'var(--b-3)' } },
      simge('kilit', { boy: 16 }),
      el('span', {}, t('senkron.gizlilik', 'Yüklenmeden önce her şey bu cihazda şifrelenir; Google yalnız şifreli veriyi görür. Parola cihazdan çıkmaz — bu yüzden İKİ CİHAZDA DA AYNI PAROLAYI yazmak gerekir. Parola kaybolursa buluttaki kopya açılamaz.'))),

    el('div', { class: 'izgara izgara--form' },
      alan(t('senkron.istemci', 'Google istemci kimliği'), el('div', {}, kimlikKutusu, kimlikSatiri()), {
        ipucu: t('senkron.istemci_ipucu', 'Boş bırak — uygulamanın kendi kimliği kullanılır. Yalnız kendi Google Cloud projeni kullanmak istersen buraya yaz.'),
      }),
      alan(t('senkron.parola', 'Kasa parolası'), parolaKutusu, {
        ipucu: t('senkron.parola_ipucu', 'Kendi seçtiğin parola; Google\'ın parolası değil. Öbür cihazda harfi harfine aynısını yaz.'),
      })),

    meta.sonSenkron
      ? el('p', { class: 'kart__alt' }, t('senkron.son', 'Son eşitleme: {t}', { t: tarihSaatMetni(meta.sonSenkron) }))
      : el('p', { class: 'kart__alt' }, t('senkron.hic', 'Henüz eşitlenmedi.')),
    meta.sonSenkronHata
      ? el('div', { class: 'uyari uyari--hata' }, simge('hata', { boy: 16 }), el('span', {}, meta.sonSenkronHata))
      : null,

    el('div', { class: 'satir', style: { marginBlockStart: 'var(--b-3)' } },
      btnS('kaydet', t('senkron.kaydet', 'Eşitleme ayarlarını kaydet'), { class: 'btn', onclick: async () => {
        const kimlik = kimlikKutusu.value.trim();
        const parola = parolaKutusu.value;
        // Kimlik alanı boş bırakılabilir: koda gömülü olan kullanılır. Burada
        // doğrudan `kimlik`e baksaydık, alanı boş bırakan hekimde eşitleme
        // hiç açılmazdı.
        const etkin = !!(istemciKimligi({ senkronIstemciId: kimlik }) && parola);
        await depo.ayarKaydet({ senkronIstemciId: kimlik, senkronParolasi: parola, senkronAcik: etkin ? 1 : 0 });
        basari(t('ayar.kaydedildi', 'Bilgiler kaydedildi'));
        yenile();
      } }),
      btnS('yenile', t('senkron.simdi', 'Şimdi eşitle'), {
        class: 'btn btn--birincil',
        disabled: !senkronHazir(ayar) || undefined,
        title: senkronHazir(ayar) ? '' : t('senkron.eksik', 'Önce istemci kimliği ve kasa parolası girilmeli.'),
        onclick: eslestir,
      }),
      acik
        ? btnS('kapat', t('senkron.cikis', 'Google\'dan çık'), { class: 'btn btn--sade', onclick: async () => {
          cikisYap();
          await depo.ayarKaydet({ senkronAcik: 0 });
          uyar(t('senkron.cikildi', 'Çıkıldı. Buluttaki kopyaya dokunulmadı.'));
          yenile();
        } })
        : null),
    rapor);
}
