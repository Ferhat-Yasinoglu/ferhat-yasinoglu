// Günlükten günlük özet: akış başlatma/tamamlama, kanal ve tetikleyici kırılımı, adım ulaşma.
export function gunlukOzet(gunluk, { gunSayisi = 7, simdi = Date.now(), akisId } = {}) {
  const gunler = [];
  for (let i = gunSayisi - 1; i >= 0; i--) gunler.push(new Date(simdi - i * 86400e3).toISOString().slice(0, 10));
  const seri = Object.fromEntries(gunler.map((g) => [g, { baslat: 0, bitir: 0, ajan: 0, toplu: 0, olay: 0 }]));
  const kanal = {}, tetik = {}, adim = {};
  for (const g of gunluk) {
    const gun = (g.zaman || '').slice(0, 10);
    if (!seri[gun]) continue;
    if (akisId && g.akis_id !== akisId) continue;
    seri[gun].olay++;
    if (g.metin_ozeti === 'başlat' || g.olay_tipi === 'başlat') { seri[gun].baslat++; tetik[g.olay_tipi || '?'] = (tetik[g.olay_tipi || '?'] || 0) + 1; }
    if (g.karar?.durum === 'finished') seri[gun].bitir++;
    if (g.karar?.tur === 'ai') seri[gun].ajan++;
    if (g.olay_tipi === 'toplu') seri[gun].toplu++;
    if (g.kanal) kanal[g.kanal] = (kanal[g.kanal] || 0) + 1;
    if (g.karar?.adim !== undefined) adim[g.karar.adim] = (adim[g.karar.adim] || 0) + 1;
  }
  const toplam = Object.values(seri).reduce((a, s) => ({ baslat: a.baslat + s.baslat, bitir: a.bitir + s.bitir, ajan: a.ajan + s.ajan, toplu: a.toplu + s.toplu, olay: a.olay + s.olay }), { baslat: 0, bitir: 0, ajan: 0, toplu: 0, olay: 0 });
  return { gunler, seri, toplam, donusum: toplam.baslat ? Math.round((toplam.bitir / toplam.baslat) * 100) : 0, kanal, tetik, adim };
}

/** Basit SVG çizgi grafiği (bağımlılıksız). seriler: [{ad, degerler[], renk}] */
