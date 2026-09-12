// Özet: bugünün sayıları, kanal durumu, kurulum ilerlemesi, son olaylar. Bir bakışta "ne oluyor".
import { el, btn, kart, rozet, temizle, goreliZaman, sayfaBas } from '../cekirdek/dom.js';
import { KANALLAR } from '../paylasilan/kanallar.js';

export default {
  baslik: 'Özet',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    const bugun = new Date().toISOString().slice(0, 10);
    const dun = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
    const [hesaplar, akislar, kisiler, gunlukHepsi, toplu, meta, ayar] = await Promise.all([
      depo.listele('hesaplar'), depo.listele('akislar'), depo.listele('kisiler'), depo.listele('gunluk', { sirala: 'zaman', azalan: true }), depo.listele('toplu_mesajlar'), depo.meta(), depo.ayarlar(),
    ]);
    const mod = ayar.mod || 'yerel';
    const gunluk = gunlukHepsi.filter((g) => (g.zaman || '').startsWith(bugun));
    const gunlukDun = gunlukHepsi.filter((g) => (g.zaman || '').startsWith(dun));
    const say = (liste, f) => liste.filter(f).length;

    const olcumler = [
      [t('ozet.gelen', 'gelen mesaj'), (l) => say(l, (g) => g.olay_tipi === 'dm'), '💬'],
      [t('ozet.baslatma', 'akış başlatma'), (l) => say(l, (g) => g.karar?.tur === 'akis' || g.olay_tipi === 'başlat' || g.metin_ozeti === 'başlat'), '⚡'],
      [t('ozet.tamamlanan', 'tamamlanan'), (l) => say(l, (g) => g.karar?.durum === 'finished'), '✅'],
      [t('ozet.yeni_kisi', 'yeni kişi'), () => kisiler.filter((k) => (k.olusturuldu || '').startsWith(bugun)).length, '👤'],
      [t('ozet.ajan', 'ajan cevabı'), (l) => say(l, (g) => g.karar?.tur === 'ai' || g.karar?.tur === 'ajan'), '✨'],
      [t('ozet.toplu', 'bekleyen toplu iş'), () => toplu.filter((x) => ['kuyrukta', 'gonderiliyor'].includes(x.durum)).length, '📣'],
    ];
    const sayaclar = el('div', { class: 'izgara izgara--dar' }, ...olcumler.map(([etiket, f, simge]) => {
      const bugunku = f(gunluk), dunku = f(gunlukDun); const fark = bugunku - dunku;
      return el('div', { class: 'sayac' }, el('div', { class: 'satir satir--arasi' }, el('span', { class: 'sayac__etiket' }, etiket), el('span', { 'aria-hidden': 'true' }, simge)), el('span', { class: 'sayac__deger' }, String(bugunku)), fark ? el('span', { class: 'sayac__fark ' + (fark > 0 ? 'sayac__fark--arti' : 'sayac__fark--eksi') }, `${fark > 0 ? '+' : ''}${fark} ${t('ozet.dune_gore', 'düne göre')}`) : el('span', { class: 'sayac__fark', style: { color: 'rgb(var(--metin-3))' } }, t('ozet.dun_ayni', 'dünle aynı')));
    }));

    const kanalKartlari = el('div', { class: 'izgara izgara--dar' });
    for (const [k, bilgi] of Object.entries(KANALLAR)) {
      const h = hesaplar.find((x) => x.kanal === k && !x.demo) || hesaplar.find((x) => x.kanal === k);
      const durum = !h ? [t('kanal.bagli_degil', 'Bağlı değil'), 'gri'] : h.durum === 'canli' ? [t('kanal.canli', 'Canlı'), 'yesil'] : [t('kanal.prova', 'Prova'), 'mavi'];
      kanalKartlari.appendChild(el('section', { class: 'kart kart--tik', onclick: () => git(h ? '/ayarlar/kanallar' : `/ayarlar/kurulum/${k}`) },
        el('div', { class: 'satir satir--arasi' }, el('span', { class: 'kart__baslik' }, `${bilgi.simge} ${bilgi.ad}`), rozet(durum[0], durum[1])),
        el('div', { class: 'satir' }, rozet(bilgi.etiket.ad, bilgi.etiket.renk), h?.demo ? rozet('Demo', 'gri') : null),
        el('p', { class: 'kart__alt', style: { margin: 0 } }, h ? (h.ad || '') : bilgi.ozet)));
    }

    const adimlar = [[t('kurulum.worker', 'Worker'), mod === 'bagli', '/ayarlar/worker'], [t('kurulum.kanal', 'Kanal'), hesaplar.some((h) => !h.demo), '/ayarlar/kurulum/telegram'], [t('kurulum.akis', 'İlk akış'), akislar.some((a) => !a.demo && a.durum === 'yayinda'), '/akislar'], [t('kurulum.canli', 'Canlı'), hesaplar.some((h) => h.durum === 'canli'), '/ayarlar/kanallar'], [t('kurulum.yedek', 'Yedek'), !!meta.son_yedek, '/ayarlar/yedek']];
    const tamam = adimlar.filter((a) => a[1]).length;
    const ilerleme = tamam === adimlar.length ? null : kart(
      el('div', { class: 'satir satir--arasi' }, el('span', { class: 'kart__baslik' }, t('ozet.kurulum', 'Kurulum')), el('span', { class: 'kart__alt' }, `${tamam}/${adimlar.length}`)),
      el('div', { class: 'ilerleme' }, el('div', { class: 'ilerleme__dolu', style: { width: `${(tamam / adimlar.length) * 100}%` } })),
      el('div', { class: 'satir' }, ...adimlar.map(([ad, ok, yol]) => el('button', { class: `cip${ok ? ' cip--secili' : ''}`, type: 'button', onclick: () => git(yol) }, (ok ? '✓ ' : '○ ') + ad))));

    const son = gunlukHepsi.slice(0, 8);
    const gunlukListe = el('div', { class: 'liste' }, ...son.map((g) => el('div', { class: 'liste__satir' },
      el('div', { class: 'avatar avatar--kucuk', style: { background: 'rgb(var(--cizgi) / .06)', color: 'rgb(var(--metin-2))' } }, g.sanal ? '🧪' : g.olay_tipi === 'dm' ? '💬' : g.olay_tipi === 'start' ? '▶' : '•'),
      el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, (g.metin_ozeti || g.olay_tipi || '—').replace(/^\[prova\]\s*/, '')), el('div', { class: 'liste__alt' }, [g.kanal, g.karar?.tur === 'akis' ? t('karar.akis', 'akış başladı') : g.karar?.tur === 'yok' ? t('karar.yok', 'eşleşme yok') : g.karar?.tur, g.karar?.durum, g.prova ? 'prova' : ''].filter(Boolean).join(' · '))),
      el('span', { class: 'kart__alt', style: { whiteSpace: 'nowrap' } }, goreliZaman(g.zaman, t)))));

    const uyari = !hesaplar.some((h) => !h.demo) ? el('div', { class: 'bant bant--mavi', style: { cursor: 'pointer' }, onclick: () => git('/ayarlar/kurulum/telegram') }, '📡 ', t('ozet.kanal_yok', 'Gerçek kanal yok — Telegram\'ı 5 dakikada bağla.')) : null;

    kok.append(
      sayfaBas(t('nav.ozet', 'Özet'), { alt: tarihBasligi(t), eylemler: [btn('⚡ ' + t('akislar.yeni', 'Yeni akış'), { class: 'btn btn--birincil', onclick: () => git('/akislar/yeni') }), btn('📣 ' + t('nav.toplu', 'Toplu mesaj'), { onclick: () => git('/toplu') })] }),
      uyari,
      el('h2', { style: { marginBlockStart: '8px' } }, t('ozet.bugun', 'Bugün')), sayaclar,
      ilerleme ? el('h2', {}, t('ozet.kurulum', 'Kurulum')) : null, ilerleme,
      el('h2', {}, t('ozet.kanallar', 'Kanallar')), kanalKartlari,
      el('div', { class: 'satir satir--arasi', style: { marginBlockStart: '24px' } }, el('h2', { style: { margin: 0 } }, t('ozet.son', 'Son olaylar')), btn(t('ozet.hepsi', 'Tümü'), { class: 'btn btn--kucuk btn--sade', onclick: () => git('/analitik') })),
      son.length ? gunlukListe : el('p', { class: 'kart__alt' }, t('ozet.olay_yok', 'Henüz olay yok. Bir akışı Test sekmesinde çalıştır; simülatör olayları burada görünür.')));
  },
};
function tarihBasligi(t) {
  try { return new Intl.DateTimeFormat(document.documentElement.lang || 'tr', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()); } catch { return ''; }
}
