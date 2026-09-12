// Özet: bugünün sayıları (7 günlük sparkline ile), kanal durumu, kurulum halkası, son olaylar.
// Bir bakışta "ne oluyor" — ve sayıların yanında eğilim.
import { el, btn, btnS, kart, rozet, temizle, goreliZaman, sayfaBas, ekle, sparkline, halka, sirala } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { KANALLAR } from '../paylasilan/kanallar.js';

const GUN = 86400e3;

export default {
  baslik: 'Özet',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    const gun = (k) => new Date(Date.now() - k * GUN).toISOString().slice(0, 10);
    const bugun = gun(0), dun = gun(1);
    const [hesaplar, akislar, kisiler, gunlukHepsi, toplu, meta, ayar] = await Promise.all([
      depo.listele('hesaplar'), depo.listele('akislar'), depo.listele('kisiler'),
      depo.listele('gunluk', { sirala: 'zaman', azalan: true }), depo.listele('toplu_mesajlar'), depo.meta(), depo.ayarlar(),
    ]);
    const mod = ayar.mod || 'yerel';
    const gununkiler = (g) => gunlukHepsi.filter((x) => (x.zaman || '').startsWith(g));
    const gunluk = gununkiler(bugun), gunlukDun = gununkiler(dun);
    const say = (liste, f) => liste.filter(f).length;

    // Her ölçüm: etiket, sayaç işlevi, simge. Sayaç işlevi hem günlük listesini
    // hem de o güne ait kişileri alır ki "yeni kişi" de 7 günlük eğilim çizebilsin.
    const olcumler = [
      [t('ozet.gelen', 'gelen mesaj'), (l) => say(l, (g) => g.olay_tipi === 'dm'), 'sohbet'],
      [t('ozet.baslatma', 'akış başlatma'), (l) => say(l, (g) => g.karar?.tur === 'akis' || g.olay_tipi === 'başlat' || g.metin_ozeti === 'başlat'), 'akis'],
      [t('ozet.tamamlanan', 'tamamlanan'), (l) => say(l, (g) => g.karar?.durum === 'finished'), 'basari'],
      [t('ozet.yeni_kisi', 'yeni kişi'), (l, g) => kisiler.filter((k) => (k.olusturuldu || '').startsWith(g)).length, 'kisiler'],
      [t('ozet.ajan', 'ajan cevabı'), (l) => say(l, (g) => g.karar?.tur === 'ai' || g.karar?.tur === 'ajan'), 'parilti'],
      [t('ozet.toplu', 'bekleyen toplu iş'), () => toplu.filter((x) => ['kuyrukta', 'gonderiliyor'].includes(x.durum)).length, 'toplu'],
    ];
    const sayaclar = el('div', { class: 'izgara izgara--sayac' }, ...olcumler.map(([etiket, f, ikonAd]) => {
      const gecmis = [6, 5, 4, 3, 2, 1, 0].map((k) => { const g = gun(k); return f(gununkiler(g), g); });
      const bugunku = f(gunluk, bugun), dunku = f(gunlukDun, dun), fark = bugunku - dunku;
      return el('div', { class: 'sayac' },
        gecmis.filter((v) => v).length >= 2 ? el('div', { class: 'sayac__cizgi', 'aria-hidden': 'true' }, sparkline(gecmis)) : null,
        el('div', { class: 'satir satir--arasi' },
          el('span', { class: 'sayac__etiket' }, etiket),
          el('span', { class: 'sayac__simge' }, simge(ikonAd, { boy: 16 }))),
        el('span', { class: 'sayac__deger' }, el('span', { class: 'rakam' }, String(bugunku))),
        fark
          ? el('span', { class: 'sayac__fark ' + (fark > 0 ? 'sayac__fark--arti' : 'sayac__fark--eksi') }, `${fark > 0 ? '+' : ''}${fark} ${t('ozet.dune_gore', 'düne göre')}`)
          : el('span', { class: 'sayac__fark', style: { color: 'rgb(var(--metin-3))' } }, t('ozet.dun_ayni', 'dünle aynı')));
    }));
    sirala(sayaclar);

    const kanalKartlari = el('div', { class: 'izgara izgara--dar' });
    for (const [k, bilgi] of Object.entries(KANALLAR)) {
      const h = hesaplar.find((x) => x.kanal === k && !x.demo) || hesaplar.find((x) => x.kanal === k);
      const durum = !h ? [t('kanal.bagli_degil', 'Bağlı değil'), 'gri'] : h.durum === 'canli' ? [t('kanal.canli', 'Canlı'), 'yesil'] : [t('kanal.prova', 'Prova'), 'mavi'];
      kanalKartlari.appendChild(el('section', { class: 'kart kart--tik sweep', onclick: () => git(h ? '/ayarlar/kanallar' : `/ayarlar/kurulum/${k}`) },
        el('div', { class: 'satir satir--arasi' },
          el('span', { class: 'kart__baslik' }, simge(bilgi.ikon), bilgi.ad),
          el('span', { class: h?.durum === 'canli' ? 'nabiz-altin' : '' }, rozet(durum[0], durum[1]))),
        el('div', { class: 'satir' }, rozet(bilgi.etiket.ad, bilgi.etiket.renk), h?.demo ? rozet('Demo', 'gri') : null),
        el('p', { class: 'kart__alt', style: { margin: 0 } }, h ? (h.ad || '') : bilgi.ozet)));
    }
    sirala(kanalKartlari);

    // Kurulum: halka ölçer + adım çipleri. Hepsi bitince blok kaybolur.
    const adimlar = [
      [t('kurulum.worker', 'Worker'), mod === 'bagli', '/ayarlar/worker'],
      [t('kurulum.kanal', 'Kanal'), hesaplar.some((h) => !h.demo), '/ayarlar/kurulum/telegram'],
      [t('kurulum.akis', 'İlk akış'), akislar.some((a) => !a.demo && a.durum === 'yayinda'), '/akislar'],
      [t('kurulum.canli', 'Canlı'), hesaplar.some((h) => h.durum === 'canli'), '/ayarlar/kanallar'],
      [t('kurulum.yedek', 'Yedek'), !!meta.son_yedek, '/ayarlar/yedek'],
    ];
    const tamam = adimlar.filter((a) => a[1]).length;
    const ilerleme = tamam === adimlar.length ? null : el('section', { class: 'kart kart--vurgu' },
      el('div', { class: 'satir', style: { gap: 'var(--b-5)', alignItems: 'center' } },
        halka(tamam / adimlar.length, { boy: 88, yazi: `${tamam}/${adimlar.length}` }),
        el('div', { style: { flex: '1', minWidth: 'min(100%, 220px)' } },
          el('div', { class: 'kart__baslik' }, t('ozet.kurulum', 'Kurulum')),
          el('p', { class: 'kart__alt', style: { marginBlock: '2px 10px' } }, t('ozet.kurulum_alt', 'Sırayla tamamla; her adım bir sayfaya götürür.')),
          el('div', { class: 'satir' }, ...adimlar.map(([ad, ok, yol]) =>
            el('button', { class: `cip${ok ? ' cip--secili' : ''}`, type: 'button', onclick: () => git(yol) },
              ok ? simge('onay', { boy: 13 }) : null, ad))))));

    const son = gunlukHepsi.slice(0, 8);
    const gunlukListe = el('div', { class: 'liste' }, ...son.map((g) => el('div', { class: 'liste__satir' },
      el('div', { class: 'avatar avatar--kucuk avatar--sade' }, simge(g.sanal ? 'prova' : g.olay_tipi === 'dm' ? 'sohbet' : g.olay_tipi === 'start' ? 'oynat' : 'bilgi', { boy: 15 })),
      el('div', { class: 'liste__govde' },
        el('div', { class: 'liste__baslik' }, (g.metin_ozeti || g.olay_tipi || '—').replace(/^\[prova\]\s*/, '')),
        el('div', { class: 'liste__alt' }, [g.kanal, g.karar?.tur === 'akis' ? t('karar.akis', 'akış başladı') : g.karar?.tur === 'yok' ? t('karar.yok', 'eşleşme yok') : g.karar?.tur, g.karar?.durum, g.prova ? 'prova' : ''].filter(Boolean).join(' · '))),
      el('span', { class: 'kart__alt', style: { whiteSpace: 'nowrap' } }, goreliZaman(g.zaman, t)))));
    sirala(gunlukListe, 'sirali-hizli');

    const uyari = !hesaplar.some((h) => !h.demo)
      ? el('div', { class: 'bant bant--altin', style: { cursor: 'pointer' }, onclick: () => git('/ayarlar/kurulum/telegram') },
          simge('anten', { boy: 18 }), t('ozet.kanal_yok', 'Gerçek kanal yok — Telegram\'ı 5 dakikada bağla.'))
      : null;

    ekle(kok, [
      sayfaBas(t('nav.ozet', 'Özet'), {
        ustEtiket: t('ozet.ust', 'Kumanda paneli'),
        alt: tarihBasligi(t),
        eylemler: [
          btnS('akis', t('akislar.yeni', 'Yeni akış'), { class: 'btn btn--birincil', onclick: () => git('/akislar/yeni') }),
          btnS('toplu', t('nav.toplu', 'Toplu mesaj'), { onclick: () => git('/toplu') }),
        ],
      }),
      uyari,
      el('h2', { style: { marginBlockStart: '8px' } }, t('ozet.bugun', 'Bugün')), sayaclar,
      ilerleme ? el('h2', {}, t('ozet.kurulum', 'Kurulum')) : null, ilerleme,
      el('h2', {}, t('ozet.kanallar', 'Kanallar')), kanalKartlari,
      el('div', { class: 'satir satir--arasi', style: { marginBlockStart: 'var(--b-6)' } },
        el('h2', { style: { margin: 0 } }, t('ozet.son', 'Son olaylar')),
        btn(t('ozet.hepsi', 'Tümü'), { class: 'btn btn--kucuk btn--sade', onclick: () => git('/analitik') })),
      son.length ? gunlukListe : el('p', { class: 'kart__alt' }, t('ozet.olay_yok', 'Henüz olay yok. Bir akışı Test sekmesinde çalıştır; simülatör olayları burada görünür.'))]);
  },
};

function tarihBasligi(t) {
  try { return new Intl.DateTimeFormat(document.documentElement.lang || 'tr', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()); } catch { return ''; }
}
