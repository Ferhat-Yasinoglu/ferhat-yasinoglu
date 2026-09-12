// Özet: kanal kartları, bugün sayaçları, uyarılar, hızlı eylemler, kurulum ilerlemesi.
import { el, btn, kart, rozet, temizle, goreliZaman } from '../cekirdek/dom.js';
import { KANALLAR } from '../paylasilan/kanallar.js';

export default {
  baslik: 'Özet',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    const bugun = new Date().toISOString().slice(0, 10);
    const [hesaplar, akislar, kisiler, gunluk, toplu, meta, ayar] = await Promise.all([
      depo.listele('hesaplar'), depo.listele('akislar'), depo.listele('kisiler'), depo.listele('gunluk', { filtre: (g) => (g.zaman || '').startsWith(bugun) }), depo.listele('toplu_mesajlar'), depo.meta(), depo.ayarlar(),
    ]);
    const mod = ayar.mod || 'yerel';
    const kanalKartlari = el('div', { class: 'izgara izgara--dar' });
    for (const [k, bilgi] of Object.entries(KANALLAR)) {
      const h = hesaplar.find((x) => x.kanal === k);
      const durum = !h ? [t('kanal.bagli_degil', 'Bağlı değil'), 'gri'] : h.durum === 'canli' ? [t('kanal.canli', 'Canlı'), 'yesil'] : [t('kanal.prova', 'Prova'), 'mavi'];
      kanalKartlari.appendChild(kart(el('div', { class: 'satir satir--arasi' }, el('span', { class: 'kart__baslik' }, `${bilgi.simge} ${bilgi.ad}`), rozet(bilgi.etiket.ad, bilgi.etiket.renk)), el('div', { class: 'satir' }, rozet(durum[0], durum[1]), h?.demo ? rozet('Demo', 'gri') : null), el('p', { class: 'kart__alt' }, bilgi.ozet), btn(h ? t('kanal.ayarlar', 'Ayarlar') : t('kanal.kur', 'Kur'), { class: 'btn btn--kucuk', onclick: () => git(h ? '/ayarlar/kanallar' : `/ayarlar/kurulum/${k}`) })));
    }
    const say = (f) => gunluk.filter(f).length;
    const sayaclar = el('div', { class: 'izgara izgara--dar' },
      sayacKart(say((g) => g.olay_tipi === 'başlat' || g.metin_ozeti === 'başlat'), t('ozet.baslatma', 'akış başlatma')),
      sayacKart(say((g) => g.karar?.durum === 'finished'), t('ozet.tamamlanan', 'tamamlanan')),
      sayacKart(kisiler.filter((k) => (k.olusturuldu || '').startsWith(bugun)).length, t('ozet.yeni_kisi', 'yeni kişi')),
      sayacKart(say((g) => g.karar?.tur === 'ai'), t('ozet.ajan', 'ajan cevabı')),
      sayacKart(kisiler.filter((k) => k.kanal === 'instagram' && k.son_gelen && Date.now() - Date.parse(k.son_gelen) < 86400e3).length, t('ozet.pencere', 'açık 24 sa penceresi')),
      sayacKart(toplu.filter((x) => ['kuyrukta', 'gonderiliyor'].includes(x.durum)).length, t('ozet.toplu', 'bekleyen toplu iş')),
    );
    // Yedek ve yerel-mod uyarıları sayfa üstündeki genel bantlarda zaten var; burada yalnız kanal ve token.
    const uyarilar = [];
    if (!hesaplar.some((h) => !h.demo)) uyarilar.push(['gri', '📡 ' + t('ozet.kanal_yok', 'Gerçek kanal yok — Telegram\'ı 5 dakikada bağla.'), () => git('/ayarlar/kurulum/telegram')]);
    for (const h of hesaplar) if (h.token_bitis && Date.parse(h.token_bitis) - Date.now() < 7 * 86400e3) uyarilar.push(['sari', `🔑 ${h.ad}: ${t('ozet.token', 'token 7 gün içinde dolacak')}`, () => git('/ayarlar/kanallar')]);
    const uyariKap = el('div', { class: 'bantlar' }, ...uyarilar.map(([r, m, cb]) => el('div', { class: `bant bant--${r}`, style: { cursor: 'pointer' }, onclick: cb }, m)));
    const adimlar = [[t('kurulum.worker', 'Worker'), mod === 'bagli'], [t('kurulum.kanal', 'Kanal'), hesaplar.some((h) => !h.demo)], [t('kurulum.akis', 'İlk akış'), akislar.some((a) => !a.demo)], [t('kurulum.canli', 'Canlı'), hesaplar.some((h) => h.durum === 'canli')], [t('kurulum.yedek', 'Yedek'), !!meta.son_yedek]];
    const tamam = adimlar.filter((a) => a[1]).length;
    const ilerleme = kart(el('div', { class: 'satir satir--arasi' }, el('span', { class: 'kart__baslik' }, t('ozet.kurulum', 'Kurulum')), el('span', { class: 'kart__alt' }, `${tamam}/${adimlar.length}`)), el('div', { class: 'ilerleme' }, el('div', { class: 'ilerleme__dolu', style: { width: `${(tamam / adimlar.length) * 100}%` } })), el('div', { class: 'satir' }, ...adimlar.map(([ad, ok]) => rozet((ok ? '✓ ' : '○ ') + ad, ok ? 'yesil' : 'gri'))));
    const son = (await depo.listele('gunluk', { sirala: 'zaman', azalan: true, limit: 10 }));
    const gunlukListe = el('div', { class: 'liste' }, ...son.map((g) => el('div', { class: 'liste__satir' }, el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, `${g.sanal ? '🧪 ' : ''}${g.olay_tipi || '—'} · ${g.metin_ozeti || ''}`), el('div', { class: 'liste__alt' }, `${g.kanal || ''} · ${g.karar?.tur || ''} ${g.karar?.durum ? '· ' + g.karar.durum : ''}`)), el('span', { class: 'kart__alt' }, goreliZaman(g.zaman, t)))));
    kok.append(el('h1', {}, t('nav.ozet', 'Özet')), uyariKap,
      el('div', { class: 'satir', style: { marginBottom: '16px' } }, btn('⚡ ' + t('akislar.yeni', 'Yeni akış'), { class: 'btn btn--birincil', onclick: () => git('/akislar/yeni') }), btn('📣 ' + t('nav.toplu', 'Toplu mesaj'), { onclick: () => git('/toplu') }), btn('💡 ' + t('ozet.fikir', 'Fikir üret'), { onclick: () => git('/fikirler') }), btn('💾 ' + t('bant.yedek_indir', 'Yedeği indir'), { onclick: async () => { const { indir } = await import('../depo/yedek.js'); await indir(await depo.disaAktar()); ctx.basari(t('yedek.indirildi', 'Yedek indirildi')); ctx.yenileBantlar(); } })),
      el('h2', {}, t('ozet.bugun', 'Bugün')), sayaclar, el('h2', {}, t('ozet.kanallar', 'Kanallar')), kanalKartlari, el('h2', {}, t('ozet.kurulum', 'Kurulum')), ilerleme,
      el('h2', {}, t('ozet.son', 'Son olaylar')), son.length ? gunlukListe : el('p', { class: 'kart__alt' }, t('ozet.olay_yok', 'Henüz olay yok. Bir akışı Test sekmesinde çalıştır; simülatör olayları burada görünür.')));
  },
};
function sayacKart(deger, etiket) { return el('div', { class: 'sayac' }, el('span', { class: 'sayac__deger' }, String(deger)), el('span', { class: 'sayac__etiket' }, etiket)); }
