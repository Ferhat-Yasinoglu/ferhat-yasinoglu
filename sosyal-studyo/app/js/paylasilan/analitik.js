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
export function cizgiGrafigiSvg(etiketler, seriler, { w = 600, h = 200 } = {}) {
  const padL = 32, padB = 24, padT = 10, padR = 10;
  const max = Math.max(1, ...seriler.flatMap((s) => s.degerler));
  const x = (i) => padL + (i / Math.max(1, etiketler.length - 1)) * (w - padL - padR);
  const y = (v) => h - padB - (v / max) * (h - padB - padT);
  const yollar = seriler.map((s) => `<path d="${s.degerler.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('')}" fill="none" stroke="${s.renk}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  const noktalar = seriler.map((s) => s.degerler.map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="${s.renk}"><title>${s.ad}: ${v}</title></circle>`).join('')).join('');
  const eksen = etiketler.map((e, i) => `<text x="${x(i).toFixed(1)}" y="${h - 6}" font-size="10" text-anchor="middle" fill="currentColor" opacity=".6">${e.slice(5)}</text>`).join('');
  return `<svg class="grafik" viewBox="0 0 ${w} ${h}" role="img" aria-label="${seriler.map((s) => s.ad).join(', ')}"><line x1="${padL}" y1="${y(0)}" x2="${w - padR}" y2="${y(0)}" stroke="currentColor" opacity=".2"/><text x="4" y="${padT + 8}" font-size="10" fill="currentColor" opacity=".6">${max}</text>${yollar}${noktalar}${eksen}</svg>`;
}
