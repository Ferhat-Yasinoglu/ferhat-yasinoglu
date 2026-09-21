// Depo sözleşmesi. İki gerçekleme aynı arayüzü sunar:
//   BellekDepo — Map tabanlı; testler ve IndexedDB açılamadığında yedek çözüm
//   IdbDepo    — IndexedDB; uygulamanın tek gerçek kaynağı (idb.js)
// Her kayıt bir zarf taşır: id, rev, olusturuldu, guncellendi, silindi (mezar taşı).
// Silme mezar taşıdır: kayıt kalır, `silindi: 1` olur. Yedek geri yüklenirken
// silinmiş bir kaydın diriltilmemesi için gerekli.
import { KOLEKSIYONLAR, SEMA_SURUMU } from './sema.js';
import { yeniId, simdi } from '../paylasilan/kimlik.js';

/** Depo hatası. `kod` arayüzde çevrilir, `veri` çeviriye geçen değişkenlerdir;
 *  `message` Türkçe karşılığıdır ve çeviri bulunamazsa yedek olarak kullanılır. */
export class DepoHatasi extends Error {
  constructor(kod, mesaj, veri = null) { super(mesaj || kod); this.kod = kod; this.veri = veri; }
}

export class TemelDepo {
  constructor() { this._dinleyiciler = new Map(); this.mod = 'bellek'; this.kalici = false; }

  async ac() { return this; }

  zarfla(kol, kayit, eski) {
    const bilgi = KOLEKSIYONLAR[kol];
    if (!bilgi) throw new DepoHatasi('koleksiyon', `bilinmeyen koleksiyon: ${kol}`);
    const t = simdi();
    return {
      ...kayit,
      id: kayit.id || yeniId(bilgi.onek),
      rev: (eski?.rev || 0) + 1,
      olusturuldu: eski?.olusturuldu || kayit.olusturuldu || t,
      guncellendi: t,
      silindi: kayit.silindi ? 1 : 0,
    };
  }

  async al(kol, id) { const k = id ? await this._oku(kol, id) : null; return k && !k.silindi ? k : null; }

  async listele(kol, { filtre, sirala, azalan = false, limit, silinmisDahil = false } = {}) {
    let liste = await this._hepsi(kol);
    if (!silinmisDahil) liste = liste.filter((k) => !k.silindi);
    if (typeof filtre === 'function') liste = liste.filter(filtre);
    else if (filtre && typeof filtre === 'object') liste = liste.filter((k) => Object.entries(filtre).every(([a, v]) => (Array.isArray(v) ? v.includes(k[a]) : k[a] === v)));
    if (sirala) {
      const d = azalan ? -1 : 1;
      liste.sort((a, b) => {
        const x = a[sirala] ?? '', y = b[sirala] ?? '';
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * d;
        return String(x).localeCompare(String(y), 'tr') * d;
      });
    }
    if (limit) liste = liste.slice(0, limit);
    return liste;
  }

  async say(kol, filtre) { return (await this.listele(kol, { filtre })).length; }

  async kaydet(kol, kayit, { rev } = {}) {
    const eski = kayit.id ? await this._oku(kol, kayit.id) : null;
    if (rev !== undefined && eski && eski.rev !== rev) throw new DepoHatasi('cakisma', 'Kayıt başka bir yerde değiştirildi.');
    const yeni = this.zarfla(kol, kayit, eski);
    await this._yaz(kol, yeni);
    this._yay(kol, { tur: 'kaydet', kayit: yeni });
    return yeni;
  }

  async topluKaydet(kol, kayitlar) { const out = []; for (const k of kayitlar) out.push(await this.kaydet(kol, k)); return out; }

  async sil(kol, id) {
    const eski = await this._oku(kol, id);
    if (!eski) return false;
    const t = simdi();
    await this._yaz(kol, { ...eski, silindi: 1, silindiZamani: t, rev: (eski.rev || 0) + 1, guncellendi: t });
    this._yay(kol, { tur: 'sil', id });
    return true;
  }

  async kaliciSil(kol, filtre) {
    const liste = await this.listele(kol, { filtre, silinmisDahil: true });
    for (const k of liste) await this._kaldir(kol, k.id);
    this._yay(kol, { tur: 'temizle' });
    return liste.length;
  }

  async ayarlar() { return (await this._oku('ayarlar', 'genel')) || { id: 'genel' }; }
  async ayar(anahtar, varsayilan) { const v = (await this.ayarlar())[anahtar]; return v === undefined ? varsayilan : v; }
  async ayarKaydet(anahtar, deger) {
    const g = await this.ayarlar();
    const parca = typeof anahtar === 'object' ? anahtar : { [anahtar]: deger };
    return this.kaydet('ayarlar', { ...g, ...parca, id: 'genel' });
  }

  dinle(kol, cb) {
    if (!this._dinleyiciler.has(kol)) this._dinleyiciler.set(kol, new Set());
    this._dinleyiciler.get(kol).add(cb);
    return () => this._dinleyiciler.get(kol)?.delete(cb);
  }
  _yay(kol, olay) {
    for (const cb of this._dinleyiciler.get(kol) || []) { try { cb(olay); } catch (e) { console.error(e); } }
    for (const cb of this._dinleyiciler.get('*') || []) { try { cb({ kol, ...olay }); } catch (e) { console.error(e); } }
  }

  async meta() { return (await this._oku('meta', 'meta')) || { id: 'meta', semaSurumu: SEMA_SURUMU, degisiklikSayaci: 0 }; }
  async metaKaydet(parca) { const m = await this.meta(); const y = { ...m, ...parca, id: 'meta' }; await this._yaz('meta', y); return y; }
  async degisiklikSay() { const m = await this.meta(); return this._yaz('meta', { ...m, id: 'meta', degisiklikSayaci: (m.degisiklikSayaci || 0) + 1 }); }

  /** Örnek (demo) kayıtları temizler — gerçek veriye dokunmaz. */
  async ornekSil() {
    let n = 0;
    for (const ad of Object.keys(KOLEKSIYONLAR)) {
      if (ad === 'meta' || ad === 'ayarlar') continue;
      n += await this.kaliciSil(ad, (k) => k.ornek === 1);
    }
    await this.metaKaydet({ ornekYuklendi: 0 });
    return n;
  }
}

export class BellekDepo extends TemelDepo {
  constructor() { super(); this._veri = new Map(); this.mod = 'bellek'; }
  _tablo(kol) { if (!this._veri.has(kol)) this._veri.set(kol, new Map()); return this._veri.get(kol); }
  async _oku(kol, id) { return this._tablo(kol).get(id) || null; }
  async _yaz(kol, k) { this._tablo(kol).set(k.id, structuredClone(k)); }
  async _kaldir(kol, id) { this._tablo(kol).delete(id); }
  async _hepsi(kol) { return [...this._tablo(kol).values()].map((k) => structuredClone(k)); }
}
