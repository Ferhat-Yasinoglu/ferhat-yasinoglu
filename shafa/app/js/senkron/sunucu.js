// Hesap sunucusunun HTTP istemcisi ve eşitlemenin taşıyıcısı.
//
// ZAMAN AŞIMLARI iki türlü, bilerek:
//  - Kimlik çağrıları (giriş, kayıt…) küçük JSON: 20 sn'de yanıt yoksa kesilir.
//  - Veri: kasa megabaytlarca olabilir ve Afgan mobil hattında 10 MB'lık bir
//    indirme dakikalar sürer. Toplam süreye sınır konsaydı orta boy bir kasa
//    hiç eşitlenmezdi. İndirmede BOŞTA KALMA sayacı var: 30 sn tek bayt
//    gelmezse kesilir, bayt geldikçe sayaç baştan başlar. Yüklemede ilerleme
//    okunamıyor (fetch yükleme ilerlemesi vermiyor); süre boyla büyüyor:
//    60 sn + her 10 KB için 1 sn.
//
// HATALAR hekime doğru yeri göstermeli: çevrimiçiyken sunucuya ulaşılamaması
// (TypeError: sunucu kapalı, kota bitti ve Cloudflare CORS'suz bir sayfa
// döndü, adres engellendi) "internet yok" değil 'sunucu_yok'; yalnız cihaz
// gerçekten çevrimdışıysa 'ag'. Sunucunun kendi kodları (§3.1) olduğu gibi
// geçer; yalnız 'kota' yerelde "cihazda yer kalmadı" demek olduğu için
// 'sunucu_dolu' olur.
//
// DOM yok: fetch ve çevrimiçi bilgisi dışarıdan verilebiliyor (testler).
import { VERI_SINIRI } from '../paylasilan/hesap-kurallari.js';

export class SunucuHatasi extends Error {
  constructor(kod, mesaj, veri = null) { super(mesaj || kod); this.kod = kod; this.veri = veri; }
}

export const SURELER = Object.freeze({
  kimlik: 20000,
  bosta: 30000,
  yuklemeTaban: 60000,
  /** bayt/sn: yavaş bir 3G hattının altı. */
  yuklemeHizi: 10 * 1024,
});

/** Sunucudan olduğu gibi geçen hata kodları. */
const GECEN_KODLAR = ['gecersiz', 'davet', 'kayit_kapali', 'alinmis', 'cok_istek', 'yanlis', 'kilitli', 'oturum', 'cakisma', 'buyuk'];

/** Yanıtı SunucuHatasi'na çevirir. `bekle` saniye; metin dakikayla konuşuyor. */
async function yanitHatasi(yanit) {
  let govde = null;
  try { govde = await yanit.json(); } catch { /* HTML ya da boş gövde: kod durumdan */ }
  const h = govde?.hata;
  const kod = GECEN_KODLAR.includes(h) ? h : h === 'kota' ? 'sunucu_dolu' : 'sunucu_hata';
  const veri = { durum: yanit.status };
  const bekle = Number(govde?.bekle);
  if (bekle > 0) { veri.bekle = bekle; veri.dakika = Math.max(1, Math.ceil(bekle / 60)); }
  return new SunucuHatasi(kod, `Sunucu: ${h || yanit.status}`, veri);
}

/**
 * İstemci. `adres` sunucunun kökü (…/v1/ eklenir).
 * ortam: { fetch, cevrimici() } — verilmezse tarayıcınınkiler.
 */
export function sunucuIstemcisi(adres, { fetch: getir = (...a) => globalThis.fetch(...a), cevrimici = () => globalThis.navigator?.onLine !== false } = {}) {
  if (!adres) throw new SunucuHatasi('sunucu_adresi_yok', 'Hesap sunucusu tanımlı değil.');
  const kok = String(adres).replace(/\/+$/, '') + '/v1/';

  /* Süre sayacı: `sure` ms içinde yeniden kurulmazsa isteği keser. İndirme
     her parçada yeniden kurar (boşta kalma), öbürleri bir kez kurar. */
  const sayac = (sure) => {
    const denetim = new AbortController();
    let zaman = null;
    const s = {
      sinyal: denetim.signal,
      asildi: false,
      kur() {
        clearTimeout(zaman);
        zaman = setTimeout(() => { s.asildi = true; denetim.abort(); }, sure);
      },
      bitir() { clearTimeout(zaman); },
      kes() { clearTimeout(zaman); denetim.abort(); },
    };
    s.kur();
    return s;
  };

  const agHatasi = (e, s) => {
    if (e instanceof SunucuHatasi) return e;
    // fetch ağ sorununda TypeError, kesilince AbortError atar. Başka bir
    // istisna ağ hatası değildir, "sunucu yok" diye örtülmeden yukarı çıkar.
    if (!(e instanceof TypeError) && e?.name !== 'AbortError') return e;
    if (s.asildi) return new SunucuHatasi('zaman_asimi', 'Sunucu zamanında yanıt vermedi.');
    return cevrimici()
      ? new SunucuHatasi('sunucu_yok', 'Sunucuya ulaşılamadı.')
      : new SunucuHatasi('ag', 'İnternet yok.');
  };

  const basliklar = (jeton, ek = {}) => (jeton ? { ...ek, Authorization: 'Bearer ' + jeton } : ek);

  /** Küçük JSON istek; yanıtın gövdesi de süre içinde okunmalı. */
  async function jsonIste(yol, { method = 'POST', jeton, govde, sure = SURELER.kimlik, ek = {} } = {}) {
    const s = sayac(sure);
    try {
      const y = await getir(kok + yol, {
        method, cache: 'no-store', signal: s.sinyal,
        headers: basliklar(jeton, govde === undefined ? ek : { ...ek, 'Content-Type': 'application/json' }),
        body: govde === undefined ? undefined : (govde instanceof Uint8Array ? govde : JSON.stringify(govde)),
      });
      if (!y.ok) throw await yanitHatasi(y);
      try { return await y.json(); } catch (e) {
        // JSON olmayan bir 200 (araya giren bir portal sayfası, yanlış adres)
        // ağ hatası değil: sunucu tarafında bir sorun.
        if (e instanceof SyntaxError) throw new SunucuHatasi('sunucu_hata', 'Sunucunun yanıtı okunamadı.');
        throw e;
      }
    } catch (e) { throw agHatasi(e, s); } finally { s.bitir(); }
  }

  return {
    kayit: (g) => jsonIste('kayit', { govde: g }),
    giris: (g) => jsonIste('giris', { govde: g }),
    kurtarAc: (g) => jsonIste('kurtar/ac', { govde: g }),
    kurtarBitir: (g) => jsonIste('kurtar/bitir', { govde: g }),
    kurtarmaYenile: (jeton, g) => jsonIste('kurtarma/yenile', { jeton, govde: g }),
    parola: (jeton, g) => jsonIste('parola', { jeton, govde: g }),
    cikis: (jeton) => jsonIste('cikis', { jeton }),
    hesapSil: (jeton, g) => jsonIste('hesap/sil', { jeton, govde: g }),

    /** Ucuz ön denetim: sunucudaki kasanın sürümü ('' = kasa yok). */
    async surum(jeton) {
      const r = await jsonIste('veri/surum', { method: 'GET', jeton });
      return String(r?.surum ?? '');
    },

    /** Kasayı ham bayt olarak indirir. Döner: { baytlar | null, surum } */
    async veriOku(jeton) {
      const s = sayac(SURELER.bosta);
      try {
        const y = await getir(kok + 'veri', { method: 'GET', cache: 'no-store', signal: s.sinyal, headers: basliklar(jeton) });
        if (!y.ok) throw await yanitHatasi(y);
        if (y.status === 204) return { baytlar: null, surum: '' };
        const surum = y.headers.get('X-Surum') ?? '';
        const parcalar = [];
        let toplam = 0;
        const okuyucu = y.body.getReader();
        for (;;) {
          const { done, value } = await okuyucu.read();
          if (done) break;
          s.kur();
          toplam += value.byteLength;
          // Sunucu 20 MB'tan büyüğünü saklamıyor; daha fazlası gelirse
          // (sahte bir sunucu) telefonun belleğini doldurmadan kesilir.
          if (toplam > VERI_SINIRI) { s.kes(); throw new SunucuHatasi('buyuk', 'Kasa beklenenden büyük.'); }
          parcalar.push(value);
        }
        const baytlar = new Uint8Array(toplam);
        let i = 0;
        for (const p of parcalar) { baytlar.set(p, i); i += p.byteLength; }
        return { baytlar, surum };
      } catch (e) { throw agHatasi(e, s); } finally { s.bitir(); }
    },

    /** Kasayı yükler; `beklenen` okunan sürüm ('' = henüz kasa yok). Döner: { surum } */
    async veriYaz(jeton, baytlar, beklenen = '') {
      // Sınırı aşan gövde hiç gönderilmez: 20 MB'ı mobil hatta yükleyip
      // 413 almak hekimin veri paketini boşa harcamak olurdu.
      if (baytlar.byteLength > VERI_SINIRI) throw new SunucuHatasi('buyuk', 'Kasa sunucunun sınırından büyük.');
      const sure = SURELER.yuklemeTaban + Math.ceil((baytlar.byteLength / SURELER.yuklemeHizi) * 1000);
      const r = await jsonIste('veri', { method: 'PUT', jeton, govde: baytlar, sure, ek: { 'If-Match': `"${beklenen || ''}"` } });
      return { surum: String(r?.surum ?? '') };
    },
  };
}

/**
 * Eşitlemenin taşıyıcısı (depo/senkron.js'in beklediği oku/yaz) ve ön
 * denetim için `surum()`. Paket kasa JSON'u; sunucu onu ayrıştırmadan saklar.
 */
export function sunucuTasima(adres, jeton, ortam = {}) {
  const istemci = sunucuIstemcisi(adres, ortam);
  return {
    ad: 'sunucu',
    async oku() {
      const { baytlar, surum } = await istemci.veriOku(jeton);
      if (!baytlar) return { paket: null, surum: '' };
      try { return { paket: JSON.parse(new TextDecoder().decode(baytlar)), surum }; }
      catch { throw new SunucuHatasi('kasa_bozuk', 'Sunucudaki kasa okunamadı.'); }
    },
    yaz: (paket, { surum } = {}) => istemci.veriYaz(jeton, new TextEncoder().encode(JSON.stringify(paket)), surum),
    surum: () => istemci.surum(jeton),
  };
}
