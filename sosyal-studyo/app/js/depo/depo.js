// Depo sözleşmesi ve fabrika. Üç gerçekleme aynı arayüzü sunar:
//   BellekDepo  — Map tabanlı; testler ve simülatör
//   IdbDepo     — IndexedDB; yerel mod
//   UzakDepo    — Worker + IdbDepo önbellek; bağlı mod (worker/… ile birlikte gelir)
// Her kayıt bir zarf taşır: id, rev, olusturuldu, guncellendi, silindi (mezar taşı), demo, sanal.
import { KOLEKSIYONLAR, SEMA_SURUMU } from '../paylasilan/sema/surum.js';
import { yeniId, simdi } from '../paylasilan/kimlik.js';
import { yedekOlustur, yedekDogrula } from '../paylasilan/sema/yedek-belgesi.js';
import { yukselt } from '../paylasilan/sema/gocler.js';

export class DepoHatasi extends Error {
  constructor(kod, mesaj) { super(mesaj || kod); this.kod = kod; }
}

/** Ortak davranış: zarf yönetimi, dinleyiciler, yedek. Alt sınıflar _oku/_yaz/_hepsi verir. */
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

  async al(kol, id) { const k = await this._oku(kol, id); return k && !k.silindi ? k : null; }

  async listele(kol, { filtre, sirala, azalan = false, limit, silinmisDahil = false } = {}) {
    let liste = await this._hepsi(kol);
    if (!silinmisDahil) liste = liste.filter((k) => !k.silindi);
    if (typeof filtre === 'function') liste = liste.filter(filtre);
    else if (filtre && typeof filtre === 'object') liste = liste.filter((k) => Object.entries(filtre).every(([a, v]) => (Array.isArray(v) ? v.includes(k[a]) : k[a] === v)));
    if (sirala) liste.sort((a, b) => (a[sirala] > b[sirala] ? 1 : a[sirala] < b[sirala] ? -1 : 0) * (azalan ? -1 : 1));
    if (limit) liste = liste.slice(0, limit);
    return liste;
  }

  async say(kol, filtre) { return (await this.listele(kol, { filtre })).length; }

  async kaydet(kol, kayit, { rev } = {}) {
    const eski = kayit.id ? await this._oku(kol, kayit.id) : null;
    if (rev !== undefined && eski && eski.rev !== rev) throw new DepoHatasi('cakisma', 'kayıt başka yerde değiştirildi');
    const yeni = this.zarfla(kol, kayit, eski);
    await this._yaz(kol, yeni);
    this._yay(kol, { tur: 'kaydet', kayit: yeni });
    return yeni;
  }

  async topluKaydet(kol, kayitlar) { const out = []; for (const k of kayitlar) out.push(await this.kaydet(kol, k)); return out; }

  async sil(kol, id) {
    const eski = await this._oku(kol, id);
    if (!eski) return false;
    await this._yaz(kol, { ...eski, silindi: 1, silindi_zamani: simdi(), rev: eski.rev + 1, guncellendi: simdi() });
    this._yay(kol, { tur: 'sil', id });
    return true;
  }

  async kaliciSil(kol, filtre) {
    const liste = await this.listele(kol, { filtre, silinmisDahil: true });
    for (const k of liste) await this._kaldir(kol, k.id);
    this._yay(kol, { tur: 'temizle' });
    return liste.length;
  }

  async ayar(anahtar, varsayilan) { const g = await this._oku('ayarlar', 'genel'); const v = g?.[anahtar]; return v === undefined ? varsayilan : v; }
  async ayarlar() { return (await this._oku('ayarlar', 'genel')) || { id: 'genel' }; }
  async ayarKaydet(anahtar, deger) { const g = await this.ayarlar(); return this.kaydet('ayarlar', { ...g, id: 'genel', [anahtar]: deger }); }
  async gizli(anahtar) { return (await this._oku('gizli', anahtar))?.deger ?? null; }
  async gizliKaydet(anahtar, deger) { return this._yaz('gizli', { id: anahtar, deger }); }
  async gizliSil(anahtar) { return this._kaldir('gizli', anahtar); }

  dinle(kol, cb) {
    if (!this._dinleyiciler.has(kol)) this._dinleyiciler.set(kol, new Set());
    this._dinleyiciler.get(kol).add(cb);
    return () => this._dinleyiciler.get(kol)?.delete(cb);
  }
  _yay(kol, olay) { for (const cb of this._dinleyiciler.get(kol) || []) { try { cb(olay); } catch (e) { console.error(e); } } for (const cb of this._dinleyiciler.get('*') || []) { try { cb({ kol, ...olay }); } catch (e) { console.error(e); } } }

  async disaAktar({ gunlukDahil = false, sanalDahil = false } = {}) {
    const koleksiyonlar = {};
    for (const [ad, bilgi] of Object.entries(KOLEKSIYONLAR)) {
      if (!bilgi.yedek && !(gunlukDahil && (ad === 'gunluk' || ad === 'mesajlar'))) continue;
      koleksiyonlar[ad] = await this.listele(ad, { silinmisDahil: true });
    }
    const belge = await yedekOlustur(koleksiyonlar, { kaynak: { mod: this.mod }, secenekler: { gunlukDahil, sanalDahil }, uygulama_surumu: globalThis.UYGULAMA_SURUMU || '' });
    await this.metaKaydet({ son_yedek: belge.olusturuldu, degisiklik_sayaci: 0 });
    return belge;
  }

  /** strateji: 'birlestir' (yeni guncellendi kazanır) | 'degistir' (koleksiyonu boşalt) | 'yalnizca_eksik' */
  async iceAktar(belgeGirdi, { strateji = 'birlestir', prova = false } = {}) {
    const dogrulama = await yedekDogrula(belgeGirdi);
    if (!dogrulama.gecerli) return { ok: false, hatalar: dogrulama.hatalar };
    const belge = yukselt(belgeGirdi);
    const rapor = {};
    for (const [ad, kayitlar] of Object.entries(belge.koleksiyonlar)) {
      const r = { eklendi: 0, guncellendi: 0, atlandi: 0 };
      if (!prova && strateji === 'degistir') await this.kaliciSil(ad);
      for (const k of kayitlar) {
        const eski = strateji === 'degistir' ? null : await this._oku(ad, k.id);
        if (eski) {
          if (strateji === 'yalnizca_eksik' || (eski.guncellendi || '') >= (k.guncellendi || '')) { r.atlandi++; continue; }
          r.guncellendi++;
        } else r.eklendi++;
        if (!prova) await this._yaz(ad, { ...k, rev: Math.max(eski?.rev || 0, k.rev || 0) + 1 });
      }
      rapor[ad] = r;
      if (!prova) this._yay(ad, { tur: 'temizle' });
    }
    return { ok: true, rapor, surumFarki: dogrulama.surumFarki };
  }

  async meta() { return (await this._oku('meta', 'meta')) || { id: 'meta', sema_surumu: SEMA_SURUMU, degisiklik_sayaci: 0 }; }
  async metaKaydet(parca) { const m = await this.meta(); return this._yaz('meta', { ...m, ...parca, id: 'meta' }); }
  async degisiklikSay() { const m = await this.meta(); return this._yaz('meta', { ...m, degisiklik_sayaci: (m.degisiklik_sayaci || 0) + 1 }); }

  async demoSil() {
    let n = 0;
    for (const ad of Object.keys(KOLEKSIYONLAR)) n += await this.kaliciSil(ad, (k) => k.demo === 1);
    await this.metaKaydet({ tohumlandi: 0 });
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
  /** Tohum: {kol: [kayıt]} — zarfsız kayıtları zarflayarak yükler. */
  async yukle(zarf) { for (const [kol, liste] of Object.entries(zarf)) for (const k of liste) await this._yaz(kol, this.zarfla(kol, k)); }
}
