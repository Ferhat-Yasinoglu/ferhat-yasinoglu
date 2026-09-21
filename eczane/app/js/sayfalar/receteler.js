// Reçeteler: liste, süzme ve arama. Bekleyenler en üstte durur —
// tezgâhta önce onlar lazım.
import { el, temizle, btnS, girdi, secim, rozet, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { receteOzet, DURUM_ADLARI, receteTuruAdi } from '../paylasilan/recete.js';
import { tamAd } from '../paylasilan/hasta.js';
import { eslesir, paraMetni } from '../paylasilan/metin.js';
import { trTarih, bugun } from '../paylasilan/tarih.js';

const DURUM_RENGI = { bekliyor: 'sari', kismi: 'mavi', tamamlandi: 'yesil', bos: 'gri' };
const SUZGECLER = [
  ['', 'Tümü'], ['acik', 'Bekleyen ve kısmi'], ['bekliyor', 'Bekleyenler'],
  ['kismi', 'Kısmen verilenler'], ['tamamlandi', 'Tamamlananlar'], ['bugun', 'Bugün yazılanlar'],
];

export default {
  baslik: 'Reçeteler',
  async cizim(kok, ctx) {
    const { depo, git } = ctx;
    temizle(kok);

    const arama = girdi({ type: 'search', placeholder: 'Reçete no, hasta adı, tanı…', style: { flex: '2', minWidth: '200px', inlineSize: 'auto' } });
    const suzgec = secim(SUZGECLER, { value: ctx.sorgu?.suzgec || '', style: { flex: '1', minWidth: '180px', inlineSize: 'auto' } });
    const govde = el('div', {});

    kok.append(
      sayfaBas('Reçeteler', {
        alt: 'Yazılan reçeteler ve karşılama durumları.',
        eylemler: [btnS('arti', 'Yeni reçete', { class: 'btn btn--birincil', onclick: () => git('/recete/yeni') })],
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
      if (s === 'acik') liste = liste.filter(({ o }) => o.durum === 'bekliyor' || o.durum === 'kismi');
      else if (s === 'bugun') liste = liste.filter(({ r }) => String(r.tarih).slice(0, 10) === bugun());
      else if (s) liste = liste.filter(({ o }) => o.durum === s);

      // Açık reçeteler öne alınır, sonra tarihe göre yeniden eskiye.
      const oncelik = { bekliyor: 0, kismi: 0, bos: 1, tamamlandi: 2 };
      liste.sort((a, b) => (oncelik[a.o.durum] - oncelik[b.o.durum]) || String(b.r.tarih).localeCompare(String(a.r.tarih)));

      if (!hepsi.length) {
        govde.appendChild(bosDurum({
          simge: 'recete', baslik: 'Henüz reçete yok',
          alt: 'Hasta seçip ilaçları ekleyerek ilk reçeteyi yaz.',
          eylem: btnS('arti', 'Yeni reçete', { class: 'btn btn--birincil', onclick: () => git('/recete/yeni') }),
        }));
        return;
      }
      if (!liste.length) { govde.appendChild(bosDurum({ simge: 'ara', baslik: 'Eşleşen reçete yok', alt: 'Aramayı ya da süzgeci değiştir.' })); return; }

      const tbody = el('tbody', {});
      for (const { r, o, hasta } of liste) {
        tbody.appendChild(el('tr', { style: { cursor: 'pointer' }, onclick: () => git(`/recete/${r.id}`) },
          el('td', {},
            el('div', { class: 'liste__baslik' }, r.receteNo || '—'),
            el('div', { class: 'liste__alt' }, receteTuruAdi(r.tur))),
          el('td', {}, trTarih(r.tarih)),
          el('td', {},
            el('div', { class: 'liste__baslik' }, hasta),
            r.tani ? el('div', { class: 'liste__alt' }, [r.tani, r.taniKodu].filter(Boolean).join(' · ')) : null),
          el('td', { class: 'sayi' }, `${o.verilen}/${o.toplam}`),
          el('td', { class: 'sayi' }, paraMetni(o.tutar)),
          el('td', {}, rozet(DURUM_ADLARI[o.durum] || o.durum, DURUM_RENGI[o.durum] || 'gri'))));
      }

      govde.append(
        el('p', { class: 'kart__alt' }, `${liste.length} reçete${liste.length !== hepsi.length ? ` (toplam ${hepsi.length})` : ''}`),
        el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'Reçete'), el('th', {}, 'Tarih'), el('th', {}, 'Hasta'),
            el('th', { class: 'sayi' }, 'Verilen'), el('th', { class: 'sayi' }, 'Tutar'), el('th', {}, 'Durum'))),
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
