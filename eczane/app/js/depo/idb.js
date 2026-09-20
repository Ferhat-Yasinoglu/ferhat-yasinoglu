// IndexedDB deposu: verilerin yaşadığı yer. Hiçbir kayıt cihazdan çıkmaz.
// Açılamazsa (özel pencere, dolu disk) BellekDepo'ya düşülür ve arayüz
// "veriler kalıcı değil" bandını gösterir.
import { TemelDepo, BellekDepo, DepoHatasi } from './depo.js';
import { SEMA_SURUMU, idbYukselt } from './sema.js';

const VT_ADI = 'eczane';

function istek(r) {
  return new Promise((cozul, reddet) => { r.onsuccess = () => cozul(r.result); r.onerror = () => reddet(r.error); });
}

export class IdbDepo extends TemelDepo {
  constructor(ad = VT_ADI) { super(); this.ad = ad; this.db = null; this.mod = 'idb'; this.kalici = true; }

  async ac() {
    this.db = await new Promise((cozul, reddet) => {
      const r = indexedDB.open(this.ad, SEMA_SURUMU);
      r.onupgradeneeded = (e) => idbYukselt(r.result, r.transaction, e.oldVersion);
      r.onsuccess = () => cozul(r.result);
      r.onerror = () => reddet(r.error);
      r.onblocked = () => reddet(new DepoHatasi('kilit', 'veritabanı başka bir sekmede açık'));
    });
    this.db.onversionchange = () => { this.db.close(); this._yay('*', { tur: 'surum' }); };
    return this;
  }

  _tx(kol, mod = 'readonly') { return this.db.transaction(kol, mod).objectStore(kol); }
  async _oku(kol, id) { return (await istek(this._tx(kol).get(id))) || null; }
  async _yaz(kol, k) {
    try { await istek(this._tx(kol, 'readwrite').put(k)); }
    catch (e) { throw new DepoHatasi(e?.name === 'QuotaExceededError' ? 'kota' : 'yazma', e?.message); }
  }
  async _kaldir(kol, id) { await istek(this._tx(kol, 'readwrite').delete(id)); }
  async _hepsi(kol) { return istek(this._tx(kol).getAll()); }

  async kaydet(kol, kayit, sec) {
    const y = await super.kaydet(kol, kayit, sec);
    if (kol !== 'meta') await this.degisiklikSay();
    return y;
  }

  async kapasite() {
    if (!navigator.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    return { kullanilan: e.usage || 0, toplam: e.quota || 0 };
  }
  /** Tarayıcıdan "bu veriyi kendiliğinden silme" izni ister. */
  async kaliciYap() { try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; } }
}

export async function yerelDepoAc() {
  if (typeof indexedDB === 'undefined') { const b = new BellekDepo(); b.kalici = false; return b; }
  try { return await new IdbDepo().ac(); }
  catch (e) {
    console.warn('IndexedDB açılamadı, bellek deposuna düşüldü:', e);
    const b = new BellekDepo(); b.kalici = false; return b;
  }
}
