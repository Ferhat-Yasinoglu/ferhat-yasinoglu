// D1 erişim katmanı: tek `kayitlar` tablosu üzerinde koleksiyon işlemleri.
// Her yazma `degisiklik_no`'yu artırır (artımlı eşitleme için). JSON gövde `veri`.
const ANAHTARLAR = {
  kisiler: (k) => [k.hesap_id || '', k.dis_id || '', k.kanal || ''],
  kosular: (k) => [k.kisi_id || '', k.durum || '', k.devam_zamani || ''],
  gunluk: (k) => [k.zaman || '', k.kisi_id || '', k.akis_id || ''],
  gelen_kutusu: (k) => [k.olay_id || '', k.durum || '', k.claim_at || ''],
  mesajlar: (k) => [k.sohbet_id || '', k.zaman || '', ''],
  sohbetler: (k) => [k.kisi_id || '', k.durum || '', k.son_zaman || ''],
  tetikleyiciler: (k) => [k.akis_id || '', k.tip || '', k.hesap_id || ''],
  toplu_kalemleri: (k) => [k.toplu_id || '', k.durum || '', ''],
  puan_olaylari: (k) => [k.olay_anahtari || '', k.kisi_id || '', ''],
  hesaplar: (k) => [k.kanal || '', k.durum || '', ''],
  akislar: (k) => [k.durum || '', k.hesap_id || '', ''],
};

const simdi = () => new Date().toISOString();
const yeniId = (onek) => onek + '_' + [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');

export class Veritabani {
  constructor(d1) { this.d1 = d1; }

  async sonrakiNo() {
    // Atomik artırım: UPDATE ... RETURNING D1'de destekli.
    const r = await this.d1.prepare("UPDATE meta SET deger = CAST(CAST(deger AS INTEGER) + 1 AS TEXT) WHERE anahtar = 'son_degisiklik_no' RETURNING deger").first();
    return Number(r?.deger || 0);
  }

  satirdan(s) { if (!s) return null; const v = JSON.parse(s.veri); return { ...v, rev: s.rev, guncellendi: s.guncellendi, silindi: s.silindi, degisiklik_no: s.degisiklik_no }; }

  async al(kol, id, { silinmisDahil = false } = {}) {
    const s = await this.d1.prepare('SELECT * FROM kayitlar WHERE kol = ? AND id = ?').bind(kol, id).first();
    const k = this.satirdan(s);
    return k && (silinmisDahil || !k.silindi) ? k : null;
  }

  async listele(kol, { k1, k2, since, limit = 500, silinmisDahil = false } = {}) {
    let sql = 'SELECT * FROM kayitlar WHERE kol = ?'; const args = [kol];
    if (k1 !== undefined) { sql += ' AND k1 = ?'; args.push(k1); }
    if (k2 !== undefined) { sql += ' AND k2 = ?'; args.push(k2); }
    if (since !== undefined) { sql += ' AND degisiklik_no > ?'; args.push(since); }
    if (!silinmisDahil) sql += ' AND silindi = 0';
    sql += ' ORDER BY degisiklik_no ASC LIMIT ?'; args.push(limit);
    const r = await this.d1.prepare(sql).bind(...args).all();
    return (r.results || []).map((s) => this.satirdan(s));
  }

  /** Upsert; `rev` verilirse iyimser kilit (uyuşmazsa {cakisma:true}). */
  async kaydet(kol, kayit, { rev, onek = kol.slice(0, 4) } = {}) {
    const id = kayit.id || yeniId(onek);
    const eski = await this.al(kol, id, { silinmisDahil: true });
    if (rev !== undefined && eski && eski.rev !== rev) return { cakisma: true, sunucu: eski };
    const yeniRev = (eski?.rev || 0) + 1;
    const t = simdi();
    const govde = { ...kayit, id, olusturuldu: eski?.olusturuldu || kayit.olusturuldu || t };
    delete govde.rev; delete govde.guncellendi; delete govde.silindi; delete govde.degisiklik_no;
    const [k1, k2, k3] = (ANAHTARLAR[kol] || (() => ['', '', '']))(govde);
    const no = await this.sonrakiNo();
    await this.d1.prepare('INSERT INTO kayitlar (kol, id, veri, rev, guncellendi, silindi, degisiklik_no, k1, k2, k3) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(kol, id) DO UPDATE SET veri = excluded.veri, rev = excluded.rev, guncellendi = excluded.guncellendi, silindi = excluded.silindi, degisiklik_no = excluded.degisiklik_no, k1 = excluded.k1, k2 = excluded.k2, k3 = excluded.k3')
      .bind(kol, id, JSON.stringify(govde), yeniRev, t, kayit.silindi ? 1 : 0, no, k1, k2, k3).run();
    return { ...govde, rev: yeniRev, guncellendi: t, silindi: kayit.silindi ? 1 : 0, degisiklik_no: no };
  }

  async sil(kol, id) { const e = await this.al(kol, id); if (!e) return false; await this.kaydet(kol, { ...e, silindi: 1, silindi_zamani: simdi() }); return true; }

  async kisiBul(hesap_id, dis_id) {
    const s = await this.d1.prepare("SELECT * FROM kayitlar WHERE kol = 'kisiler' AND k1 = ? AND k2 = ? AND silindi = 0").bind(hesap_id, dis_id).first();
    return this.satirdan(s);
  }
  async aktifKosu(kisi_id) {
    const s = await this.d1.prepare("SELECT * FROM kayitlar WHERE kol = 'kosular' AND k1 = ? AND k2 = 'waiting' AND silindi = 0 ORDER BY degisiklik_no DESC LIMIT 1").bind(kisi_id).first();
    return this.satirdan(s);
  }
  async zamaniGelenKosular(simdiIso, limit = 50) {
    const r = await this.d1.prepare("SELECT * FROM kayitlar WHERE kol = 'kosular' AND k2 = 'waiting' AND k3 != '' AND k3 <= ? AND silindi = 0 LIMIT ?").bind(simdiIso, limit).all();
    return (r.results || []).map((s) => this.satirdan(s)).filter((k) => k.bekleme === 'delay');
  }
  /** Gelen kutusu tekilleştirme: aynı olay_id ikinci kez gelirse false. */
  async gelenKaydet(olay) {
    try {
      const no = await this.sonrakiNo();
      await this.d1.prepare("INSERT INTO kayitlar (kol, id, veri, rev, guncellendi, silindi, degisiklik_no, k1, k2, k3) VALUES ('gelen_kutusu', ?, ?, 1, ?, 0, ?, ?, 'pending', ?)").bind(yeniId('gelen'), JSON.stringify(olay), simdi(), no, olay.olay_id, simdi()).run();
      return true;
    } catch (e) { if (/UNIQUE|constraint/i.test(String(e.message))) return false; throw e; }
  }
  async gelenBitir(olay_id, durum = 'done') {
    await this.d1.prepare("UPDATE kayitlar SET k2 = ? WHERE kol = 'gelen_kutusu' AND k1 = ?").bind(durum, olay_id).run();
  }
  async bekleyenGelenler(esikIso, limit = 20) {
    const r = await this.d1.prepare("SELECT * FROM kayitlar WHERE kol = 'gelen_kutusu' AND k2 = 'pending' AND k3 < ? LIMIT ?").bind(esikIso, limit).all();
    return (r.results || []).map((s) => JSON.parse(s.veri));
  }
  async sayacArtir(ad, gun = simdi().slice(0, 10), n = 1) {
    await this.d1.prepare('INSERT INTO sayaclar (gun, ad, sayi) VALUES (?, ?, ?) ON CONFLICT(gun, ad) DO UPDATE SET sayi = sayi + excluded.sayi').bind(gun, ad, n).run();
  }
  async sayac(ad, gun = simdi().slice(0, 10)) {
    const r = await this.d1.prepare('SELECT sayi FROM sayaclar WHERE gun = ? AND ad = ?').bind(gun, ad).first();
    return Number(r?.sayi || 0);
  }
  async metaAl(anahtar) { const r = await this.d1.prepare('SELECT deger FROM meta WHERE anahtar = ?').bind(anahtar).first(); return r?.deger ?? null; }
  async metaKaydet(anahtar, deger) { await this.d1.prepare('INSERT INTO meta (anahtar, deger) VALUES (?, ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger').bind(anahtar, String(deger)).run(); }
  async eskiGunlukSil(esikIso) { const r = await this.d1.prepare("DELETE FROM kayitlar WHERE kol = 'gunluk' AND k1 < ?").bind(esikIso).run(); return r.meta?.changes || 0; }
}
export { simdi, yeniId };
