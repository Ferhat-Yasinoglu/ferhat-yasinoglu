// Reçeteler: liste, süzme ve arama. En yeni reçete en üstte.
import { el, temizle, btnS, girdi, secim, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { receteOzet, RECETE_TURLERI } from '../paylasilan/recete.js';
import { tamAd } from '../paylasilan/hasta.js';
import { eslesir } from '../paylasilan/metin.js';
import { trTarih, bugun } from '../paylasilan/tarih.js';
import { t, secenekleriCevir, secenekAdi } from '../i18n.js';

const SUZGECLER = [['', 'Tümü'], ['bugun', 'Bugün yazılanlar']];
const suzgecler = () => secenekleriCevir(SUZGECLER, 'recete.suzgec');

export default {
  baslik: 'Reçeteler',
  async cizim(kok, ctx) {
    const { depo, git } = ctx;
    temizle(kok);

    const arama = girdi({ type: 'search', placeholder: t('recete.ara', 'Reçete no, hasta adı, tanı…'), style: { flex: '2', minWidth: '200px', inlineSize: 'auto' } });
    const suzgec = secim(suzgecler(), { value: ctx.sorgu?.suzgec || '', style: { flex: '1', minWidth: '180px', inlineSize: 'auto' } });
    const govde = el('div', {});

    kok.append(
      sayfaBas(t('nav.receteler', 'Reçeteler'), {
        alt: t('recete.sayfa_alt', 'Yazılan reçeteler.'),
        eylemler: [btnS('kalem', t('recete.yeni', 'Yeni reçete'), { class: 'btn btn--birincil', onclick: () => git('/recete/kagit') })],
      }),
      el('div', { class: 'satir', style: { marginBlockEnd: 'var(--b-4)' } }, arama, suzgec),
      govde);

    let sira = 0;
    async function listele() {
      const benim = ++sira;
      const [hepsi, hastalar] = await Promise.all([
        depo.listele('receteler', { sirala: 'tarih', azalan: true }),
        depo.listele('hastalar'),
      ]);
      if (benim !== sira) return;
      temizle(govde);

      const hastaAdi = (id) => tamAd(hastalar.find((h) => h.id === id)) || '—';
      const q = arama.value.trim();
      const s = suzgec.value;

      let liste = hepsi.map((r) => ({ r, o: receteOzet(r), hasta: hastaAdi(r.hastaId) }));
      if (q) liste = liste.filter(({ r, hasta }) => eslesir(`${r.receteNo || ''} ${hasta} ${r.tani || ''} ${r.taniKodu || ''}`, q));
      if (s === 'bugun') liste = liste.filter(({ r }) => String(r.tarih).slice(0, 10) === bugun());

      liste.sort((a, b) => String(b.r.tarih).localeCompare(String(a.r.tarih)));

      if (!hepsi.length) {
        govde.appendChild(bosDurum({
          simge: 'recete', baslik: t('recete.bos', 'Henüz reçete yok'),
          alt: t('recete.bos_alt', 'Hasta seçip ilaçları ekleyerek ilk reçeteyi yaz.'),
          eylem: btnS('kalem', t('recete.yeni', 'Yeni reçete'), { class: 'btn btn--birincil', onclick: () => git('/recete/kagit') }),
        }));
        return;
      }
      if (!liste.length) { govde.appendChild(bosDurum({ simge: 'ara', baslik: t('recete.eslesme_yok', 'Eşleşen reçete yok'), alt: t('genel.suzgec_degistir', 'Aramayı ya da süzgeci değiştir.') })); return; }

      const tbody = el('tbody', {});
      for (const { r, o, hasta } of liste) {
        tbody.appendChild(el('tr', { style: { cursor: 'pointer' }, onclick: () => git(`/recete/${r.id}`) },
          el('td', {},
            el('div', { class: 'liste__baslik' }, r.receteNo || '—'),
            el('div', { class: 'liste__alt' }, secenekAdi(RECETE_TURLERI, r.tur, 'recete.tur'))),
          el('td', {}, trTarih(r.tarih)),
          el('td', {},
            el('div', { class: 'liste__baslik' }, hasta),
            r.tani ? el('div', { class: 'liste__alt' }, [r.tani, r.taniKodu].filter(Boolean).join(' · ')) : null),
          el('td', { class: 'sayi' }, String(o.toplam))));
      }

      govde.append(
        el('p', { class: 'kart__alt' }, t('recete.sayim', '{n} reçete', { n: liste.length }) + (liste.length !== hepsi.length ? ' ' + t('genel.toplam', '(toplam {n})', { n: hepsi.length }) : '')),
        el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo' },
          el('thead', {}, el('tr', {},
            el('th', {}, t('nav.recete', 'Reçete')), el('th', {}, t('genel.tarih', 'Tarih')), el('th', {}, t('nav.hasta', 'Hasta')),
            el('th', { class: 'sayi' }, t('nav.ilaclar', 'İlaçlar')))),
          tbody)));
      sirala(tbody);
    }

    arama.oninput = listele;
    suzgec.onchange = listele;
    await listele();
    const birak = [depo.dinle('receteler', listele), depo.dinle('hastalar', listele)];
    return () => birak.forEach((f) => f());
  },
};
