// Klinik sözlük sayfası: tanı ve laboratuvar listelerine bakma ekranı.
//
// Bunlar SALT OKUNUR ad listeleri — uygulamayla geliyor, depoya yazılmıyor,
// hekim düzenlemiyor. Sayfanın tek işi aramak: reçete yazarken seçim kutusu
// açmadan "şu tanının kodu neydi" ya da "bu tahlil listede var mı" diye
// bakabilmek. Bilerek hiçbir ilaç/tedavi/doz bilgisi taşımıyor.
import { el, temizle, girdi, kart, sayfaBas, bosDurum, rozet, sirala } from './cekirdek/dom.js';
import { ara, gruplaraBol } from './paylasilan/klinik.js';
import { klinigiOku } from './depo/klinik.js';
import { t, suankiDil } from './i18n.js';
import { hataMetni } from './hatalar.js';

const TURLER = {
  tanilar: {
    baslik: () => t('sozluk.tanilar', 'Tanılar'),
    alt: () => t('sozluk.tanilar_alt', 'Reçetede seçebildiğin tanılar ve ICD kodları.'),
    simge: 'not', grupAlani: 'gruplar', kodlu: true,
  },
  laboratuvar: {
    baslik: () => t('sozluk.laboratuvar', 'Laboratuvar'),
    alt: () => t('sozluk.laboratuvar_alt', 'Reçetede isteyebildiğin tahliller.'),
    simge: 'tup', grupAlani: 'labGruplari', kodlu: false,
  },
};

/** `tur` = 'tanilar' | 'laboratuvar'. İki sayfa da aynı gövdeyi kullanıyor;
 *  aralarındaki tek fark hangi listeyi okudukları ve kod sütunu. */
export function sozlukSayfasi(tur) {
  const bicim = TURLER[tur];
  return {
    baslik: bicim.baslik(),
    async cizim(kok) {
      temizle(kok);
      let belge;
      try {
        belge = await klinigiOku();
      } catch (e) {
        kok.appendChild(bosDurum({ simge: 'uyari', hata: true, baslik: hataMetni(e) }));
        return;
      }

      const liste = belge[tur] || [];
      const gruplar = belge[bicim.grupAlani] || [];
      let sorgu = '';
      let grup = '';   // boş = hepsi

      const kutu = girdi({
        type: 'search', name: 'sozlukArama',
        placeholder: t('sozluk.ara', '{n} kayıt içinde ara…', { n: liste.length }),
        oninput: () => { sorgu = kutu.value; govdeCiz(); },
      });
      const grupSeridi = el('div', { class: 'cip-kume' });
      const govde = el('div', {});
      const sayac = el('span', { class: 'kart__alt' });

      function grupCiz() {
        temizle(grupSeridi);
        const hepsi = [{ anahtar: '', ad: t('sozluk.hepsi', 'Hepsi') }, ...gruplar];
        for (const g of hepsi) {
          grupSeridi.appendChild(el('button', {
            type: 'button',
            class: 'cip cip--secilir' + (grup === g.anahtar ? ' cip--secili' : ''),
            'aria-pressed': grup === g.anahtar ? 'true' : 'false',
            onclick: () => { grup = g.anahtar; grupCiz(); govdeCiz(); },
          }, el('span', {}, g.ad)));
        }
      }

      function govdeCiz() {
        // Türkçe karşılık yalnız arayüz Türkçedeyken: Farsça arayüzde
        // her satırın altında Türkçe bir sözcük gürültüden başka bir şey
        // değil, hekim okumuyor.
        const trGoster = suankiDil() !== 'fa';
        const suzulmus = ara(liste, sorgu).filter((x) => !grup || x.grup === grup);
        sayac.textContent = t('sozluk.sayi', '{n} kayıt', { n: suzulmus.length });
        temizle(govde);
        if (!suzulmus.length) {
          govde.appendChild(bosDurum({ simge: 'ara', baslik: t('sozluk.bos', 'Eşleşen kayıt yok') }));
          return;
        }
        for (const g of gruplaraBol(suzulmus, gruplar)) {
          const kap = el('div', { class: 'liste' });
          for (const x of g.kayitlar) {
            kap.appendChild(el('div', { class: 'liste__satir' },
              el('div', { class: 'liste__govde' },
                el('div', { class: 'liste__baslik' }, x.ad),
                // İngilizce ad reçeteye basılan ad: hekim kâğıtta ne
                // göreceğini sözlükte de görsün.
                x.en ? el('div', { class: 'liste__alt', dir: 'ltr' }, x.en) : null,
                trGoster && x.tr ? el('div', { class: 'liste__alt' }, x.tr) : null),
              bicim.kodlu && x.kod ? el('div', { class: 'liste__son' }, rozet(x.kod, 'gri')) : null));
          }
          sirala(kap);
          govde.appendChild(el('div', { class: 'sozluk-grup' },
            el('h2', {}, g.ad, el('span', { class: 'kart__alt' }, String(g.kayitlar.length))),
            kap));
        }
      }

      kok.appendChild(sayfaBas(bicim.baslik(), { alt: bicim.alt() }));
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('sozluk.ara_baslik', 'Ara')), sayac),
        kutu, grupSeridi));
      kok.appendChild(govde);
      grupCiz();
      govdeCiz();
    },
  };
}
