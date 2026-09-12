// Analitik: dönem/akış seçici, SVG çizgi grafik, huni (adım ulaşma), kanal ve tetikleyici kırılımı, CSV.
import { el, btn, kart, temizle, secim, sayfaBas, btnS, cizgiGrafigi, grafikAnahtari } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { gunlukOzet } from '../paylasilan/analitik.js';

export default {
  baslik: 'Analitik',
  async cizim(kok, ctx) {
    const { depo, t } = ctx;
    temizle(kok);
    const akislar = await depo.listele('akislar');
    const otoGenis = { style: { width: 'auto', minWidth: '150px', flex: '0 1 auto' } };
    const donem = secim([['7', t('analitik.7', '7 gün')], ['30', t('analitik.30', '30 gün')], ['90', t('analitik.90', '90 gün')]], otoGenis);
    const akisSec = secim([['', t('analitik.tum_akislar', 'Tüm akışlar')], ...akislar.map((a) => [a.id, a.ad])], otoGenis);
    const govde = el('div', {});
    async function ciz() {
      temizle(govde);
      const gunluk = await depo.listele('gunluk');
      const gun = Number(donem.value);
      const o = gunlukOzet(gunluk, { gunSayisi: gun, akisId: akisSec.value || undefined });
      const onceki = gunlukOzet(gunluk, { gunSayisi: gun, simdi: Date.now() - gun * 86400e3, akisId: akisSec.value || undefined });
      const yuzde = (a, b) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);
      const fark = (a, b) => { const y = yuzde(a, b); return el('span', { class: 'kart__alt', style: { color: y >= 0 ? 'rgb(var(--yesil))' : 'rgb(var(--kirmizi))' } }, `${y >= 0 ? '+' : '−'}${Math.abs(y)}%`); };
      // Seriler marka tokenlarıyla boyanır: başlatma altın (ana ölçü), tamamlama yeşil (sonuç).
      const seriler = [
        { ad: t('analitik.baslatma', 'Başlatma'), degerler: o.gunler.map((g) => o.seri[g].baslat), renk: 'rgb(var(--vurgu))' },
        { ad: t('analitik.tamamlama', 'Tamamlama'), degerler: o.gunler.map((g) => o.seri[g].bitir), renk: 'rgb(var(--yesil))' },
      ];
      const grafik = el('div', {}, cizgiGrafigi(o.gunler, seriler), grafikAnahtari(seriler));
      const akis = akisSec.value ? akislar.find((a) => a.id === akisSec.value) : null;
      const huni = akis ? el('div', { class: 'liste' }, ...akis.adimlar.map((a, i) => { const n = o.adim[i] || 0; const en = Math.max(1, ...Object.values(o.adim)); return el('div', { class: 'liste__satir' }, el('span', { class: 'adim__no' }, String(i + 1)), el('div', { class: 'liste__govde' }, el('div', { class: 'liste__alt' }, a.type + ': ' + (a.text || a.reason || '').slice(0, 40)), el('div', { class: 'ilerleme' }, el('div', { class: 'ilerleme__dolu', style: { width: `${(n / en) * 100}%` } }))), el('strong', {}, String(n))); })) : el('p', { class: 'kart__alt' }, t('analitik.akis_sec', 'Adım ulaşma hunisi için bir akış seç.'));
      const kirilim = (obj) => el('div', { class: 'satir' }, ...Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => el('span', { class: 'cip' }, `${k}: ${v}`)), !Object.keys(obj).length ? el('span', { class: 'kart__alt' }, '—') : null);
      govde.append(
        el('div', { class: 'izgara izgara--sayac' }, sayac(o.toplam.baslat, t('analitik.baslatma', 'Başlatma'), fark(o.toplam.baslat, onceki.toplam.baslat)), sayac(o.toplam.bitir, t('analitik.tamamlama', 'Tamamlama'), fark(o.toplam.bitir, onceki.toplam.bitir)), sayac(o.donusum + '%', t('analitik.donusum', 'Dönüşüm')), sayac(o.toplam.ajan, t('ozet.ajan', 'Ajan cevabı')), sayac(o.toplam.toplu, t('analitik.toplu', 'Toplu mesaj')), sayac(o.toplam.olay, t('analitik.olay', 'Olay'))),
        kart(el('h2', { class: 'kart__baslik' }, t('analitik.zaman', 'Zaman serisi')), grafik),
        kart(el('h2', { class: 'kart__baslik' }, t('analitik.huni', 'Adım ulaşma')), huni),
        kart(el('h2', { class: 'kart__baslik' }, t('analitik.kanal', 'Kanal kırılımı')), kirilim(o.kanal)),
        kart(el('h2', { class: 'kart__baslik' }, t('analitik.tetik', 'Tetikleyici / kaynak')), kirilim(o.tetik)),
        gunluk.some((g) => g.sanal) ? el('p', { class: 'kart__alt satir' }, simge('prova', { boy: 16 }), t('analitik.sanal_not', 'Simülatör olayları dahil (yerel mod).')) : null,
        btnS('indir', 'CSV', { class: 'btn btn--kucuk', onclick: () => { const csv = ['gun,baslat,bitir,ajan,toplu,olay', ...o.gunler.map((g) => `${g},${o.seri[g].baslat},${o.seri[g].bitir},${o.seri[g].ajan},${o.seri[g].toplu},${o.seri[g].olay}`)].join('\n'); const b = new Blob([csv], { type: 'text/csv' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = 'analitik.csv'; l.click(); } }));
    }
    donem.onchange = ciz; akisSec.onchange = ciz;
    kok.append(sayfaBas(t('nav.analitik', 'Analitik'), { ustEtiket: t('analitik.ust', 'Ölçüm'), alt: t('analitik.alt', 'Akış başlatma, tamamlanma ve kanal dağılımı.') }), el('div', { class: 'satir', style: { marginBlockEnd: '16px' } }, donem, akisSec), govde);
    ciz();
  },
};
function sayac(deger, etiket, ek) { return el('div', { class: 'sayac' }, el('span', { class: 'sayac__deger' }, String(deger)), el('span', { class: 'sayac__etiket' }, etiket), ek || null); }
