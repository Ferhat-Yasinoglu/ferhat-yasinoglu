// Bağlı mod deposu: IndexedDB önbellek + Worker. Yazar koleksiyonları PUT ile sunucuya gider
// (başarısızsa giden kutusuna düşer, çevrimiçi olunca boşalır); sunucu koleksiyonları
// (kişiler, koşular, günlük, sohbetler, mesajlar…) `since` imleciyle artımlı çekilir.
import { IdbDepo } from './idb.js';
import { DepoHatasi } from './depo.js';
import { SEMA_SURUMU } from '../paylasilan/sema/surum.js';

const YAZAR = new Set(['ayarlar', 'hesaplar', 'akislar', 'tetikleyiciler', 'kurallar', 'etiketler', 'segmentler', 'puan_kurallari', 'toplu_mesajlar', 'kancalar', 'fikirler', 'senaryolar', 'video_analizleri', 'karuseller', 'galeri', 'ai_brifingler', 'cevapsiz_sorular', 'hos_geldin', 'referans_linkleri', 'kisiler']);
const SUNUCU = ['hesaplar', 'kisiler', 'kosular', 'gunluk', 'sohbetler', 'mesajlar', 'puan_olaylari', 'cevapsiz_sorular', 'toplu_mesajlar', 'akislar', 'tetikleyiciler'];

export class UzakDepo extends IdbDepo {
  constructor(adres) { super(); this.adres = adres.replace(/\/$/, ''); this.mod = 'bagli'; this.cevrimici = null; this._zamanlayici = null; }

  async ac() {
    await super.ac();
    const bosalt = () => this.gidenKutusunuBosalt().catch(() => {});
    window.addEventListener('online', bosalt);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this.esitle().catch(() => {}); });
    this.esitle().catch((e) => console.warn('eşitleme', e));
    this._zamanlayici = setInterval(() => { if (document.visibilityState === 'visible') this.esitle().catch(() => {}); }, 60000);
    return this;
  }

  async istek(yol, { yontem = 'GET', govde, basliklar = {} } = {}) {
    const anahtar = await this.gizli('yonetici');
    if (!anahtar) throw new DepoHatasi('yetki', 'Yönetici anahtarı yok (Ayarlar → Worker)');
    let r;
    try { r = await fetch(this.adres + yol, { method: yontem, headers: { Authorization: 'Bearer ' + anahtar, 'X-SS-Sema': String(SEMA_SURUMU), ...(govde ? { 'Content-Type': 'application/json' } : {}), ...basliklar }, body: govde ? JSON.stringify(govde) : undefined, signal: AbortSignal.timeout(20000) }); }
    catch (e) { this.cevrimici = false; throw new DepoHatasi('ag', 'Worker\'a ulaşılamadı'); }
    this.cevrimici = true;
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) throw new DepoHatasi('yetki', j.mesaj || 'yönetici anahtarı reddedildi');
    if (r.status === 409) throw new DepoHatasi('cakisma', j.mesaj || 'çakışma');
    if (!r.ok || j.ok === false) throw new DepoHatasi('sunucu', j.mesaj || `Worker ${r.status}`);
    return j.veri;
  }

  async kaydet(kol, kayit, sec) {
    const yerel = await super.kaydet(kol, kayit, sec);
    // Demo kayıtları yereldedir; sunucuya gönderilirse gerçek hesapların yanında ikinci bir
    // kayıt olarak görünüp motoru yanıltır.
    if (YAZAR.has(kol) && yerel.demo !== 1) this.gonder({ tur: 'kaydet', kol, id: yerel.id, kayit: yerel }).catch(() => {});
    return yerel;
  }
  async sil(kol, id) { const r = await super.sil(kol, id); if (r && YAZAR.has(kol)) this.gonder({ tur: 'sil', kol, id }).catch(() => {}); return r; }

  /** Sunucuya yazmayı dener; olmazsa giden kutusuna koyar. */
  async gonder(is) {
    try {
      if (is.tur === 'kaydet') { const { rev, degisiklik_no, ...govde } = is.kayit; const sunucu = await this.istek(`/api/k/${is.kol}/${is.id}`, { yontem: 'PUT', govde }); await this._yaz(is.kol, { ...sunucu, rev: is.kayit.rev }); }
      else if (is.tur === 'sil') await this.istek(`/api/k/${is.kol}/${is.id}`, { yontem: 'DELETE' });
      else if (is.tur === 'komut') await this.istek('/api/komut', { yontem: 'POST', govde: is.komut });
    } catch (e) {
      if (e.kod === 'yetki' || e.kod === 'cakisma') throw e;
      await this._yaz('giden_kutusu', { id: 'giden_' + Date.now() + Math.random().toString(16).slice(2, 6), ...is, deneme: 0, zaman: new Date().toISOString() });
      this._yay('giden_kutusu', { tur: 'kaydet' });
    }
  }
  async gidenKutusunuBosalt() {
    const liste = (await this._hepsi('giden_kutusu')).sort((a, b) => a.zaman.localeCompare(b.zaman));
    for (const is of liste) {
      try { const { id, deneme, zaman, ...saf } = is; if (saf.tur === 'kaydet') { const { rev, degisiklik_no, ...govde } = saf.kayit; await this.istek(`/api/k/${saf.kol}/${saf.id}`, { yontem: 'PUT', govde }); } else if (saf.tur === 'sil') await this.istek(`/api/k/${saf.kol}/${saf.id}`, { yontem: 'DELETE' }); else if (saf.tur === 'komut') await this.istek('/api/komut', { yontem: 'POST', govde: saf.komut }); await this._kaldir('giden_kutusu', is.id); }
      catch (e) { if (e.kod === 'ag') break; await this._yaz('giden_kutusu', { ...is, deneme: (is.deneme || 0) + 1, sonHata: e.message }); if ((is.deneme || 0) >= 5) await this._kaldir('giden_kutusu', is.id); }
    }
    this._yay('giden_kutusu', { tur: 'temizle' });
  }
  async gidenSayisi() { return (await this._hepsi('giden_kutusu')).length; }

  /** İdempotent komut: etiket/puan/mesaj gönder/akış başlat/ajanı sustur. */
  async komut(ad, yuk) {
    const komut = { ad, yuk, komut_id: 'k_' + Date.now() + Math.random().toString(16).slice(2, 8) };
    const sonuc = await this.istek('/api/komut', { yontem: 'POST', govde: komut });
    this.esitle().catch(() => {});
    return sonuc;
  }

  /** Sunucu koleksiyonlarını artımlı çeker; yerel yazar kayıtlarının üstüne sunucununki gelmez (mezar taşı hariç). */
  async esitle() {
    const meta = await this.meta();
    const son = meta.son_senkron || {};
    let degisen = false;
    for (const kol of SUNUCU) {
      let since = son[kol] || 0, devam = true, tur = 0;
      while (devam && tur++ < 20) {
        const r = await this.istek(`/api/k/${kol}?since=${since}&limit=500`);
        for (const k of r.kayitlar) { const yerel = await this._oku(kol, k.id); if (YAZAR.has(kol) && yerel && !k.silindi && (yerel.guncellendi || '') > (k.guncellendi || '')) continue; await this._yaz(kol, k); degisen = true; }
        since = r.son_no; devam = r.devam;
      }
      son[kol] = since;
    }
    await this.metaKaydet({ son_senkron: son, son_esitleme: new Date().toISOString() });
    if (degisen) for (const kol of SUNUCU) this._yay(kol, { tur: 'temizle' });
    await this.gidenKutusunuBosalt();
  }

  async disaAktar(sec) { try { const belge = await this.istek('/api/yedek' + (sec?.gunlukDahil ? '?gunluk=1' : '')); await this.metaKaydet({ son_yedek: belge.olusturuldu, degisiklik_sayaci: 0 }); return belge; } catch { return super.disaAktar(sec); } }
  async doktor() { return this.istek('/api/durum'); }
}
