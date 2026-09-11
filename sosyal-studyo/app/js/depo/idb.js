// IndexedDB deposu: yerel modun tek gerçek kaynağı. Mağaza = koleksiyon, keyPath id.
// Açılamazsa (özel pencere, dolu disk) BellekDepo'ya düşülür ve UI "kalıcı değil" der.
import { TemelDepo, BellekDepo, DepoHatasi } from './depo.js';
import { SEMA_SURUMU } from '../paylasilan/sema/surum.js';
import { idbYukselt } from '../paylasilan/sema/gocler.js';

const VT_ADI = 'sosyal-studyo';

function istek(r) { return new Promise((cozul, reddet) => { r.onsuccess = () => cozul(r.result); r.onerror = () => reddet(r.error); }); }

export class IdbDepo extends TemelDepo {
  constructor(ad = VT_ADI) { super(); this.ad = ad; this.db = null; this.mod = 'yerel'; this.kalici = true; }

  async ac() {
    this.db = await new Promise((cozul, reddet) => {
      const r = indexedDB.open(this.ad, SEMA_SURUMU);
      r.onupgradeneeded = (e) => idbYukselt(r.result, r.transaction, e.oldVersion);
      r.onsuccess = () => cozul(r.result);
      r.onerror = () => reddet(r.error);
      r.onblocked = () => reddet(new DepoHatasi('kilit', 'veritabanı başka sekmede açık'));
    });
    this.db.onversionchange = () => { this.db.close(); this._yay('*', { tur: 'sürüm' }); };
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

  async kaydet(kol, kayit, sec) { const y = await super.kaydet(kol, kayit, sec); if (kol !== 'meta' && kol !== 'gunluk') await this.degisiklikSay(); return y; }

  async kapasite() {
    if (!navigator.storage?.estimate) return null;
    const e = await navigator.storage.estimate();
    return { kullanilan: e.usage || 0, toplam: e.quota || 0 };
  }
  async kaliciYap() { try { return navigator.storage?.persist ? await navigator.storage.persist() : false; } catch { return false; } }
}

/** IndexedDB varsa onu, yoksa belleği açar. */
export async function yerelDepoAc() {
  if (typeof indexedDB === 'undefined') return new BellekDepo();
  try { return await new IdbDepo().ac(); }
  catch (e) { console.warn('IndexedDB açılamadı, bellek deposuna düşüldü:', e); const b = new BellekDepo(); b.kalici = false; return b; }
}
