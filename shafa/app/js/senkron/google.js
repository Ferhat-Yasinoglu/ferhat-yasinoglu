// Google Drive taşıyıcısı: eşitlemenin ağ ucu.
//
// NEREYE YAZIYOR: hekimin kendi Drive'ındaki "uygulama verileri" klasörüne
// (appDataFolder). Bu klasör Drive arayüzünde görünmez, başka uygulamalar
// okuyamaz ve istediğimiz izin (drive.appdata) Drive'ın geri kalanına
// dokunamaz — Google hesabındaki öbür dosyaları göremiyoruz.
//
// NE GÖRÜYOR GOOGLE: şifrelenmiş baytları. Dosyanın içeriği yüklenmeden önce
// paylasilan/kasa.js ile kapatılıyor; parola cihazda kalıyor, buluta gitmiyor.
//
// SUNUCU YOK: uygulama GitHub Pages'te duran statik dosyalardan ibaret. Bu
// yüzden yetkilendirme tarayıcıda, Google'ın kendi betiğiyle (GIS) yapılıyor
// ve istemci kimliği gizli değil — gizli olması da gerekmiyor, Google web
// istemcilerini kaynak adresine (origin) bağlıyor.
//
// ÇEVRİMDIŞI: bu dosya yalnız hekim "eşitle" dediğinde yükleniyor. Betik ve
// istekler uygulamanın açılışına hiçbir şekilde karışmaz; internet yoksa
// uygulamanın tamamı eskisi gibi çalışır, yalnız eşitleme bekler.

const GIS_ADRESI = 'https://accounts.google.com/gsi/client';
const IZIN = 'https://www.googleapis.com/auth/drive.appdata';
const DOSYA_ADI = 'shafa.kasa.json';
const API = 'https://www.googleapis.com/drive/v3';
const YUKLEME = 'https://www.googleapis.com/upload/drive/v3';

/**
 * Hekimin Google Cloud projesindeki istemci kimliği.
 *
 * Burada açıkça duruyor ve durmasında sakınca yok: OAuth web istemci kimlikleri
 * tasarımı gereği herkese açık — Google ile giriş kullanan her sitenin kaynak
 * kodunda görünür. Gizli olan `client secret`tir, onu bu akış hiç kullanmıyor.
 * Kimliğin kötüye kullanımını engelleyen şey gizliliği değil, Google'ın onu
 * KAYNAK ADRESİNE bağlaması: yalnız aşağıdaki iki adresten çalışır.
 *   https://ferhat-yasinoglu.github.io
 *   http://localhost:8788
 * Başka biri bu kimlikle kendi Drive'ının uygulama klasörüne erişebilir —
 * yani kendi verisine; buradaki hiçbir şeye değil.
 *
 * Ayarlardaki alan yedek yol olarak duruyor: başka bir hekim kendi projesini
 * kullanmak isterse oradan girer ve buradaki değerin yerine geçer.
 */
export const VARSAYILAN_ISTEMCI = '992727769946-82oa2himlups0dihvjau26hp7det5pu8.apps.googleusercontent.com';

export class GoogleHatasi extends Error {
  constructor(kod, mesaj, veri = null) { super(mesaj || kod); this.kod = kod; this.veri = veri; }
}

let betikSozu = null;
/** GIS betiğini bir kez, hekim isteyince yükler. */
function betigiYukle() {
  if (globalThis.google?.accounts?.oauth2) return Promise.resolve();
  if (betikSozu) return betikSozu;
  betikSozu = new Promise((coz, red) => {
    const s = document.createElement('script');
    s.src = GIS_ADRESI;
    s.async = true;
    s.onload = () => (globalThis.google?.accounts?.oauth2 ? coz() : red(new GoogleHatasi('betik', 'Google betiği yüklendi ama beklenen arayüz yok.')));
    s.onerror = () => {
      betikSozu = null;
      // ÇEVRİMİÇİYKEN betiğin yüklenememesi "internet yok" demek değil:
      // engellenmiş demektir — reklam engelleyici, kurumsal filtre, ya da eski
      // önbellekten gelen ve accounts.google.com'a izin vermeyen bir CSP.
      // İkisini aynı mesaja indirmek hekimi internetini kurcalamaya gönderiyor,
      // oysa bakması gereken yer bambaşka.
      red(navigator.onLine
        ? new GoogleHatasi('betik', 'Google giriş betiği yüklenemedi.')
        : new GoogleHatasi('ag', 'İnternet yok.'));
    };
    document.head.appendChild(s);
  });
  return betikSozu;
}

/** GIS her zaman geri çağırmıyor: oturum yokken sessiz istek ya da engellenmiş
 *  bir pencere sözü hiç çözmeyebiliyor. Zaman aşımı olmadan arayüzde
 *  "Eşitleniyor…" sonsuza kadar dönüyor ve hekim neyin beklendiğini anlamıyor. */
const BELGE_SURESI = 90000;

/** Bellekte duran erişim belgesi. Diske yazılmıyor: bir saat ömrü var ve
 *  saklamanın getirisi, çalınmasının götürüsünden az. */
let belge = { deger: '', biter: 0 };
let istemci = null;
let istemciKimligi = '';

export const girisliMi = () => !!belge.deger && Date.now() < belge.biter;
export function cikisYap() { belge = { deger: '', biter: 0 }; }

function istemciKur(kimlik) {
  if (istemci && istemciKimligi === kimlik) return istemci;
  istemciKimligi = kimlik;
  istemci = globalThis.google.accounts.oauth2.initTokenClient({ client_id: kimlik, scope: IZIN, callback: () => {} });
  return istemci;
}

/**
 * Erişim belgesi alır. `sessiz` ise Google oturumu açıksa pencere açmadan
 * döner; değilse hekime onay penceresi gösterilir.
 * Pencereyi tarayıcı engellerse 'pencere' hatası düşer — bu, hekime
 * "düğmeye basınca olur" diyebilmemiz için ayrı tutuluyor.
 */
export async function belgeAl(kimlik, { sessiz = false, sure = BELGE_SURESI } = {}) {
  if (!kimlik) throw new GoogleHatasi('istemci_yok', 'Google istemci kimliği girilmemiş.');
  if (girisliMi()) return belge.deger;
  await betigiYukle();
  const c = istemciKur(kimlik);
  return new Promise((coz, red) => {
    const sayac = setTimeout(() => red(new GoogleHatasi('zaman_asimi', 'Google yanıt vermedi.')), sure);
    const bitir = (fn) => (...a) => { clearTimeout(sayac); fn(...a); };
    const tamam = bitir(coz);
    const dur = bitir(red);
    c.callback = (y) => {
      if (y?.error) {
        const kod = y.error === 'popup_closed' || y.error === 'access_denied' ? 'yetki'
          : y.error === 'popup_failed_to_open' ? 'pencere' : 'yetki';
        dur(new GoogleHatasi(kod, y.error_description || y.error));
        return;
      }
      belge = { deger: y.access_token, biter: Date.now() + (Number(y.expires_in || 3600) - 60) * 1000 };
      tamam(belge.deger);
    };
    c.error_callback = (y) => dur(new GoogleHatasi(y?.type === 'popup_failed_to_open' ? 'pencere' : 'yetki', y?.message || 'İzin alınamadı.'));
    try { c.requestAccessToken({ prompt: sessiz ? '' : 'consent' }); }
    catch (e) { dur(new GoogleHatasi('yetki', e?.message)); }
  });
}

async function istek(yol, { taban = API, belgeDegeri, ...secenekler } = {}) {
  let y;
  try {
    y = await fetch(taban + yol, { ...secenekler, headers: { Authorization: `Bearer ${belgeDegeri}`, ...(secenekler.headers || {}) } });
  } catch { throw new GoogleHatasi('ag', 'Google\'a ulaşılamadı.'); }
  if (y.status === 401) { cikisYap(); throw new GoogleHatasi('belge_bitti', 'Giriş süresi doldu.'); }
  if (!y.ok) {
    let ayrinti = '';
    try { ayrinti = (await y.json())?.error?.message || ''; } catch { /* gövde okunamadı */ }
    throw new GoogleHatasi(y.status === 403 ? 'yetki' : 'drive', ayrinti || `Drive ${y.status}`, { durum: y.status });
  }
  return y;
}

async function dosyayiBul(belgeDegeri) {
  const y = await istek(`/files?spaces=appDataFolder&pageSize=10&fields=files(id,name,version)&q=${encodeURIComponent(`name='${DOSYA_ADI}' and trashed=false`)}`, { belgeDegeri });
  const d = (await y.json()).files || [];
  return d[0] || null;
}

async function surumOku(belgeDegeri, id) {
  const y = await istek(`/files/${id}?fields=version`, { belgeDegeri });
  return String((await y.json()).version || '');
}

/**
 * Drive taşıyıcısı. depo/senkron.js'in beklediği iki yöntemi verir.
 *
 * SÜRÜM DENETİMİ dürüstçe şöyle: Drive'ın koşullu yazması yok, bu yüzden
 * yazmadan hemen önce dosyanın `version` alanı yeniden okunuyor ve okuduğumuz
 * sürümden farklıysa 'cakisma' atılıyor — eşitleme de baştan birleştiriyor.
 * Aradaki milisaniyelik boşlukta öbür cihaz yazarsa yakalanamaz; iki cihazın
 * aynı saniyede eşitlenmesi gerekir ve o durumda bile kaybedilen, o turda
 * yazılan değişikliklerdir, veri tabanı değil — bir sonraki eşitleme geri
 * getirir, çünkü her cihaz kendi tam kopyasını yüklüyor.
 */
export function driveTasima(kimlik) {
  let dosyaId = '';
  return {
    ad: 'google',
    get dosyaId() { return dosyaId; },

    async oku() {
      const b = await belgeAl(kimlik, { sessiz: true }).catch((e) => {
        if (e?.kod === 'yetki' || e?.kod === 'pencere') return belgeAl(kimlik);
        throw e;
      });
      const d = await dosyayiBul(b);
      if (!d) { dosyaId = ''; return { paket: null, surum: '' }; }
      dosyaId = d.id;
      const y = await istek(`/files/${d.id}?alt=media`, { belgeDegeri: b });
      let paket = null;
      try { paket = await y.json(); }
      catch { throw new GoogleHatasi('bozuk', 'Buluttaki dosya okunamadı.'); }
      return { paket, surum: String(d.version || '') };
    },

    async yaz(paket, { surum } = {}) {
      const b = await belgeAl(kimlik, { sessiz: true });
      const govde = JSON.stringify(paket);
      if (dosyaId) {
        if (await surumOku(b, dosyaId) !== String(surum || '')) {
          throw new GoogleHatasi('cakisma', 'Buluttaki kopya değişti.');
        }
        await istek(`/files/${dosyaId}?uploadType=media&fields=version`, {
          taban: YUKLEME, belgeDegeri: b, method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }, body: govde,
        });
        return { surum: await surumOku(b, dosyaId) };
      }
      // İlk yazma: dosya yoksa oluştur. Arada öbür cihaz oluşturduysa
      // bulup ona yazmak yerine çakışma atıyoruz; eşitleme baştan okuyor.
      if (await dosyayiBul(b)) throw new GoogleHatasi('cakisma', 'Buluttaki kopya değişti.');
      const sinir = 'shafa' + Math.random().toString(36).slice(2);
      const ustveri = JSON.stringify({ name: DOSYA_ADI, parents: ['appDataFolder'] });
      const y = await istek('/files?uploadType=multipart&fields=id,version', {
        taban: YUKLEME, belgeDegeri: b, method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${sinir}` },
        body: `--${sinir}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${ustveri}\r\n`
          + `--${sinir}\r\nContent-Type: application/json\r\n\r\n${govde}\r\n--${sinir}--`,
      });
      const d = await y.json();
      dosyaId = d.id;
      return { surum: String(d.version || '') };
    },
  };
}
