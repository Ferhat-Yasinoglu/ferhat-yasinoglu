// Panel: reçete odaklı özet. İşin merkezi reçete yazmak; sayaçlar ve listeler
// de onu anlatıyor — bugün kaç reçete yazıldı, son reçeteler, son hastalar.
import { el, temizle, btn, btnS, kart, sayacKutusu, sayfaBas, bosDurum, sirala, sutunGrafik, yatayGrafik } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { tarihMetni, bugun, isoGun, goreliGun } from '../paylasilan/tarih.js';
import { tamAd } from '../paylasilan/hasta.js';
import { basHarfler } from '../paylasilan/metin.js';
import { receteOzet } from '../paylasilan/recete.js';
import { satirAdi } from '../paylasilan/ilac.js';
import { t } from '../i18n.js';
import { goreliMetni } from '../hatalar.js';

/** Kısa liste kartı: başlık + en çok 6 satır + "hepsini gör" bağlantısı. */
function listeKarti({ baslik, simgeAdi, satirlar, bos, tumuYol, tumuAd }) {
  const kap = el('div', { class: 'liste' });
  for (const s of satirlar.slice(0, 6)) {
    kap.appendChild(el('a', { class: 'liste__satir', href: '#' + s.yol },
      el('span', { class: 'avatar' }, s.harf || simge(simgeAdi, { boy: 18 })),
      el('div', { class: 'liste__govde' },
        el('div', { class: 'liste__baslik' }, s.baslik),
        el('div', { class: 'liste__alt' }, s.alt)),
      s.rozet ? el('div', { class: 'liste__son' }, s.rozet) : null));
  }
  sirala(kap);
  return kart({},
    el('div', { class: 'kart__bas' },
      el('h2', {}, baslik),
      satirlar.length > 6 && tumuYol ? el('a', { class: 'kart__alt', href: '#' + tumuYol }, tumuAd || t('genel.hepsini_gor', 'Hepsini gör')) : null),
    satirlar.length ? kap : bosDurum({ simge: simgeAdi, baslik: bos }));
}

export default {
  baslik: 'Panel',
  async cizim(kok, ctx) {
    const { depo, git } = ctx;

    let sira = 0;
    async function ciz() {
      const benim = ++sira;
      const [ilaclar, hastalar, receteler, ayar] = await Promise.all([
        depo.listele('ilaclar'), depo.listele('hastalar'),
        depo.listele('receteler', { sirala: 'tarih', azalan: true }), depo.ayarlar(),
      ]);
      if (benim !== sira) return;
      temizle(kok);

      const bugunku = receteler.filter((r) => String(r.tarih).slice(0, 10) === bugun());
      const hastaAdi = (id) => tamAd(hastalar.find((h) => h.id === id)) || t('nav.hasta', 'Hasta');

      // Son 14 gün: hangi gün kaç reçete yazılmış? Hekimin kendi temposunu
      // görmesi için — sayı değil, şekil bilgi veriyor.
      const GUN_SAYISI = 14;
      const gunler = [];
      for (let i = GUN_SAYISI - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const iso = isoGun(d);
        gunler.push({
          etiket: String(d.getDate()),
          deger: receteler.filter((r) => String(r.tarih).slice(0, 10) === iso).length,
          bugun: i === 0,
        });
      }
      const ikiHaftalik = gunler.reduce((a, g) => a + g.deger, 0);

      kok.append(sayfaBas(t('nav.panel', 'Panel'), {
        alt: t('panel.alt', 'Reçeteler, hastalar ve ilaç listesi.'),
        eylemler: [
          btnS('recete', t('recete.yaz', 'Reçete yaz'), { class: 'btn btn--birincil', onclick: () => git('/recete/kagit') }),
          btnS('hasta', t('hasta.ekle', 'Hasta ekle'), { class: 'btn', onclick: () => git('/hastalar') }),
          btnS('arti', t('ilac.ekle', 'İlaç ekle'), { class: 'btn', onclick: () => git('/ilaclar') }),
        ],
      }));

      // Antet boşsa reçete boş antetle basılır ve ilk izlenim mahvolur.
      // Bu yüzden uyarı panelin en üstünde, sayaçlardan önce duruyor.
      if (!String(ayar.doktorAd ?? '').trim()) {
        kok.appendChild(kart({ style: { borderColor: 'rgb(var(--sari) / .45)', background: 'rgb(var(--sari) / .05)' } },
          el('div', { class: 'satir', style: { gap: 'var(--b-3)', flexWrap: 'nowrap', alignItems: 'flex-start' } },
            el('span', { class: 'avatar', style: { background: 'rgb(var(--sari) / .15)', color: 'rgb(var(--sari))' } }, simge('uyari', { boy: 18 })),
            el('div', { style: { flex: '1', minInlineSize: '0' } },
              el('div', { class: 'liste__baslik' }, t('panel.antet_eksik', 'Reçete anteti boş')),
              el('div', { class: 'liste__alt' }, t('panel.antet_eksik_alt', 'Adın, ünvanın ve iletişim bilgilerin kâğıda basılmıyor. Bir kez girmen yeterli.'))),
            btn(t('panel.antet_gir', 'Anteti gir'), { class: 'btn btn--birincil btn--kucuk', onclick: () => git('/ayarlar') }))));
      }

      kok.appendChild(el('div', { class: 'izgara izgara--sayac', style: { marginBlockEnd: 'var(--b-5)' } },
        sayacKutusu({ baslik: t('panel.bugun_recete', 'Bugün yazılan'), deger: bugunku.length, alt: t('panel.recete_toplam', '{n} reçete toplam', { n: receteler.length }), simge: 'recete', tur: 'vurgu', yol: '/receteler?suzgec=bugun' }),
        sayacKutusu({ baslik: t('nav.receteler', 'Reçeteler'), deger: receteler.length, alt: t('panel.kayitli', 'kayıtlı'), simge: 'recete', tur: 'notr', yol: '/receteler' }),
        sayacKutusu({ baslik: t('nav.hasta', 'Hasta'), deger: hastalar.length, alt: t('panel.kayitli', 'kayıtlı'), simge: 'hasta', tur: 'vurgu', yol: '/hastalar' }),
        sayacKutusu({ baslik: t('panel.ilac_cesidi', 'İlaç çeşidi'), deger: ilaclar.length, alt: t('panel.listede', 'listede'), simge: 'ilac', tur: 'notr', yol: '/ilaclar' })));

      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, t('panel.son_gunler', 'Son 14 gün')),
          el('span', { class: 'kart__alt' }, t('recete.sayim', '{n} reçete', { n: ikiHaftalik }))),
        sutunGrafik(gunler, { etiket: t('panel.grafik_etiket', 'Son 14 günde yazılan reçete sayısı') })));

      // En çok yazılan ilaçlar: hekimin kendi pratiğini görmesi için.
      // Reçete satırlarındaki ilaç adları sayılır; ilaç kaydı silinse bile
      // ad reçetede durduğu için sayım bozulmaz.
      const sayim = new Map();
      for (const r of receteler) {
        for (const satir of r.satirlar || []) {
          const ad = satirAdi(satir);
          if (ad) sayim.set(ad, (sayim.get(ad) || 0) + 1);
        }
      }
      const enCok = [...sayim.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([etiket, deger]) => ({ etiket, deger }));

      // Panel kartları geniş ekranda iki sütuna dizilir (bkz. .panel-izgara):
      // tek sütunda her kart bin piksele geniyor ve içindeki üç satırın
      // yanında sayfanın yarısı boş kalıyordu.
      const kartlar = [
        listeKarti({
          baslik: t('panel.son_receteler', 'Son reçeteler'), simgeAdi: 'recete',
          satirlar: receteler.slice(0, 6).map((r) => ({
            yol: `/recete/${r.id}`, baslik: hastaAdi(r.hastaId),
            alt: `${r.receteNo || tarihMetni(r.tarih)} · ${t('recete.ilac_sayisi', '{n} ilaç', { n: receteOzet(r).toplam })} · ${goreliMetni(goreliGun(r.tarih))}`,
          })),
          bos: t('recete.bos', 'Henüz reçete yok'), tumuYol: '/receteler',
        }),
      ];

      if (enCok.length) {
        kartlar.push(kart({},
          el('div', { class: 'kart__bas' },
            el('h2', {}, t('panel.en_cok_ilac', 'En çok yazdığın ilaçlar')),
            el('span', { class: 'kart__alt' }, t('panel.en_cok_alt', 'bütün reçetelerde'))),
          yatayGrafik(enCok)));
      }

      if (hastalar.length) {
        const son = [...hastalar].sort((a, b) => String(b.olusturuldu).localeCompare(String(a.olusturuldu))).slice(0, 6);
        kartlar.push(listeKarti({
          baslik: t('panel.son_hastalar', 'Son eklenen hastalar'), simgeAdi: 'hasta',
          satirlar: son.map((h) => ({ yol: `/hasta/${h.id}`, baslik: tamAd(h), alt: h.telefon || '—', harf: basHarfler(tamAd(h)) })),
          bos: t('panel.hasta_yok', 'Hasta yok'), tumuYol: '/hastalar',
        }));
      }

      kok.appendChild(el('div', { class: 'panel-izgara' }, ...kartlar));

      if (!ilaclar.length && !hastalar.length) {
        kok.appendChild(kart({}, bosDurum({
          simge: 'bilgi', baslik: t('panel.bos', 'Uygulama boş'),
          alt: t('panel.bos_alt', 'İlaç ve hasta ekleyerek başla. Denemek istersen Ayarlar\'dan örnek verileri yükleyebilirsin — sonra tek tuşla silinir.'),
          eylem: btnS('ayarlar', t('panel.ayarlara_git', 'Ayarlar\'a git'), { class: 'btn btn--birincil', onclick: () => git('/ayarlar') }),
        })));
      }
    }

    await ciz();
    const birak = [depo.dinle('ilaclar', ciz), depo.dinle('hastalar', ciz), depo.dinle('receteler', ciz)];
    return () => birak.forEach((f) => f());
  },
};
