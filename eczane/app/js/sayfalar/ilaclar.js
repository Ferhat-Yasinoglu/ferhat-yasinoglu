// İlaçlar: stok listesi, arama, süzme ve ilaç kartı ekleme/düzenleme.
// Stok bu ekrandan doğrudan değiştirilmez — her değişiklik bir hareket kaydı
// bırakır (bkz. ilac.js). Yeni ilacın başlangıç stoğu "mal girişi" sayılır.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, onayKutusu, rozet, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { FORMLAR, formAdi, ilacAra, ilacEtiketi, stokDurumu, sktDurumu, bosIlac, ilacDogrula } from '../paylasilan/ilac.js';
import { paraMetni } from '../paylasilan/metin.js';
import { trTarih } from '../paylasilan/tarih.js';
import { hareketUygula } from '../depo/stok.js';

const SUZGECLER = [
  ['', 'Tümü'],
  ['azalan', 'Stoğu azalanlar'],
  ['yok', 'Stokta olmayanlar'],
  ['skt_yakin', 'Son kullanması yaklaşanlar'],
  ['skt_gecti', 'Son kullanması geçmişler'],
  ['receteli', 'Yalnız reçeteli'],
];

/** İlaç rozetleri: stok ve son kullanma durumu tek bakışta. */
export function ilacRozetleri(i) {
  const r = [];
  const s = stokDurumu(i);
  if (s === 'yok') r.push(rozet('Stok yok', 'kirmizi'));
  else if (s === 'kritik') r.push(rozet('Stok az', 'sari'));
  const k = sktDurumu(i);
  if (k === 'gecti') r.push(rozet('SKT geçti', 'kirmizi'));
  else if (k === 'yaklasiyor') r.push(rozet('SKT yakın', 'sari'));
  if (i.ornek) r.push(rozet('örnek', 'mor'));
  return r;
}

/** Ekleme/düzenleme kutusu. Yeni kayıtta stok alanı açık, düzenlemede kilitli. */
export async function ilacKutusu(ctx, mevcut = null) {
  const { depo, modal, basari, hata } = ctx;
  let deger = { ...bosIlac(), ...(mevcut || {}) };
  const govde = el('div', {});

  function ciz(hatalar = {}) {
    temizle(govde);
    const g = {
      ad: girdi({ name: 'ad', value: deger.ad, autocomplete: 'off' }),
      barkod: girdi({ name: 'barkod', value: deger.barkod, inputmode: 'numeric', autocomplete: 'off' }),
      etkenMadde: girdi({ name: 'etkenMadde', value: deger.etkenMadde, autocomplete: 'off' }),
      form: secim(FORMLAR, { name: 'form', value: deger.form }),
      doz: girdi({ name: 'doz', value: deger.doz, placeholder: '500 mg' }),
      kutuAdedi: girdi({ name: 'kutuAdedi', value: deger.kutuAdedi, type: 'number', min: 0, step: 1 }),
      stok: girdi({ name: 'stok', value: deger.stok, type: 'number', min: 0, step: 1, disabled: !!mevcut }),
      kritikStok: girdi({ name: 'kritikStok', value: deger.kritikStok, type: 'number', min: 0, step: 1 }),
      alisFiyati: girdi({ name: 'alisFiyati', value: deger.alisFiyati, type: 'number', min: 0, step: '0.01' }),
      satisFiyati: girdi({ name: 'satisFiyati', value: deger.satisFiyati, type: 'number', min: 0, step: '0.01' }),
      sonKullanma: girdi({ name: 'sonKullanma', value: String(deger.sonKullanma || '').slice(0, 10), type: 'date' }),
      uretici: girdi({ name: 'uretici', value: deger.uretici }),
      raf: girdi({ name: 'raf', value: deger.raf, placeholder: 'A1' }),
      notlar: metinAlani({ name: 'notlar', value: deger.notlar, rows: 2 }),
      receteli: onayKutusu('Reçete ile verilir', { name: 'receteli', checked: !!deger.receteli }),
    };
    govde.append(
      el('div', { class: 'izgara izgara--form' },
        alan('İlaç adı', g.ad, { gerekli: true, hata: hatalar.ad }),
        alan('Etken madde', g.etkenMadde, { ipucu: 'Muadil bulmakta kullanılır' }),
        alan('Form', g.form),
        alan('Doz', g.doz),
        alan('Kutudaki adet', g.kutuAdedi),
        alan('Barkod', g.barkod, { hata: hatalar.barkod }),
        alan(mevcut ? 'Stok (yalnız hareketlerle değişir)' : 'Başlangıç stoğu', g.stok, {
          hata: hatalar.stok,
          ipucu: mevcut ? 'Mal girişi, sayım ve fire için ilaç kartını aç.' : 'Mal girişi olarak kaydedilir.',
        }),
        alan('Kritik stok eşiği', g.kritikStok, { hata: hatalar.kritikStok, ipucu: 'Bu sayıya düşünce uyarır' }),
        alan('Alış fiyatı (₺)', g.alisFiyati, { hata: hatalar.alisFiyati }),
        alan('Satış fiyatı (₺)', g.satisFiyati, { hata: hatalar.satisFiyati }),
        alan('Son kullanma tarihi', g.sonKullanma, { hata: hatalar.sonKullanma }),
        alan('Üretici', g.uretici),
        alan('Raf', g.raf)),
      alan('Not', g.notlar),
      g.receteli);
    govde._oku = () => {
      const v = {};
      for (const x of govde.querySelectorAll('[name]')) {
        if (x.type === 'checkbox') v[x.name] = x.checked;
        else if (x.type === 'number') v[x.name] = x.value === '' ? '' : Number(x.value);
        else v[x.name] = x.value.trim();
      }
      return v;
    };
  }
  ciz();

  const sonuc = await modal({
    baslik: mevcut ? 'İlacı düzenle' : 'Yeni ilaç',
    govde, genis: true,
    dugmeler: [
      { metin: 'Vazgeç', deger: null },
      { metin: 'Kaydet', sinif: 'btn--birincil', cb: () => {
        const v = { ...deger, ...govde._oku() };
        if (mevcut) v.stok = mevcut.stok; // kilitli alan okunmaz
        const hatalar = ilacDogrula(v);
        if (Object.keys(hatalar).length) { deger = v; ciz(hatalar); return false; }
        return v;
      } },
    ],
  });
  if (!sonuc || typeof sonuc !== 'object') return null;

  try {
    if (mevcut) {
      const y = await depo.kaydet('ilaclar', { ...mevcut, ...sonuc, stok: mevcut.stok });
      basari('İlaç güncellendi');
      return y;
    }
    const baslangic = Math.max(0, Number(sonuc.stok) || 0);
    const y = await depo.kaydet('ilaclar', { ...sonuc, stok: 0 });
    if (baslangic > 0) await hareketUygula(depo, { ilacId: y.id, tur: 'giris', adet: baslangic, aciklama: 'İlk kayıt' });
    basari('İlaç eklendi');
    return depo.al('ilaclar', y.id);
  } catch (e) {
    hata(e.message || 'Kaydedilemedi');
    return null;
  }
}

export default {
  baslik: 'İlaçlar',
  async cizim(kok, ctx) {
    const { depo, git } = ctx;
    temizle(kok);

    const arama = girdi({ type: 'search', placeholder: 'Ad, barkod, etken madde…', style: { flex: '2', minWidth: '200px', inlineSize: 'auto' } });
    const suzgec = secim(SUZGECLER, { style: { flex: '1', minWidth: '180px', inlineSize: 'auto' }, value: ctx.sorgu?.suzgec || '' });
    const govde = el('div', {});

    kok.append(
      sayfaBas('İlaçlar', {
        alt: 'Stok, fiyat ve son kullanma takibi.',
        eylemler: [btnS('arti', 'İlaç ekle', { class: 'btn btn--birincil', onclick: async () => { if (await ilacKutusu(ctx)) listele(); } })],
      }),
      el('div', { class: 'satir', style: { marginBlockEnd: 'var(--b-4)' } }, arama, suzgec),
      govde);

    // Çizim sırası: arama ve süzgeç aynı anda tetiklenince iki çizim yarışır ve
    // ikisi de listeye eklerdi. Her çizim sırasını alır; beklerken yenisi
    // başladıysa eskisi sessizce çekilir.
    let sira = 0;
    async function listele() {
      const benim = ++sira;
      const hepsi = await depo.listele('ilaclar', { sirala: 'ad' });
      if (benim !== sira) return;
      temizle(govde);
      let liste = ilacAra(hepsi, arama.value);
      const s = suzgec.value;
      if (s === 'azalan') liste = liste.filter((i) => stokDurumu(i) === 'kritik');
      else if (s === 'yok') liste = liste.filter((i) => stokDurumu(i) === 'yok');
      else if (s === 'skt_yakin') liste = liste.filter((i) => sktDurumu(i) === 'yaklasiyor');
      else if (s === 'skt_gecti') liste = liste.filter((i) => sktDurumu(i) === 'gecti');
      else if (s === 'receteli') liste = liste.filter((i) => i.receteli);

      if (!hepsi.length) {
        govde.appendChild(bosDurum({
          simge: 'ilac', baslik: 'Henüz ilaç yok',
          alt: 'İlk ilacı ekle ya da Ayarlar\'dan örnek verileri yükleyerek uygulamayı dene.',
          eylem: btnS('arti', 'İlaç ekle', { class: 'btn btn--birincil', onclick: async () => { if (await ilacKutusu(ctx)) listele(); } }),
        }));
        return;
      }
      if (!liste.length) { govde.appendChild(bosDurum({ simge: 'ara', baslik: 'Eşleşen ilaç yok', alt: 'Aramayı ya da süzgeci değiştir.' })); return; }

      const tbody = el('tbody', {});
      for (const i of liste) {
        tbody.appendChild(el('tr', { class: 'liste__satir--tiklanir', style: { cursor: 'pointer' }, onclick: () => git(`/ilac/${i.id}`) },
          el('td', {},
            el('div', { class: 'liste__baslik' }, ilacEtiketi(i)),
            el('div', { class: 'liste__alt' }, [i.etkenMadde, i.uretici].filter(Boolean).join(' · ') || '—')),
          el('td', { class: 'sayi' }, el('strong', {}, String(i.stok ?? 0)), el('div', { class: 'satir', style: { gap: '4px', justifyContent: 'flex-end' } }, ...ilacRozetleri(i))),
          el('td', {}, trTarih(i.sonKullanma)),
          el('td', { class: 'sayi' }, paraMetni(i.satisFiyati)),
          el('td', {}, i.raf || '—'),
          el('td', { class: 'sayi' }, btn(simge('sag', { boy: 16 }), { class: 'btn btn--kucuk btn--ikon btn--sade', 'aria-label': `${i.ad} kartını aç` }))));
      }
      const tablo = el('div', { class: 'tablo-kap' },
        el('table', { class: 'tablo' },
          el('thead', {}, el('tr', {},
            el('th', {}, 'İlaç'), el('th', { class: 'sayi' }, 'Stok'), el('th', {}, 'Son kullanma'),
            el('th', { class: 'sayi' }, 'Satış'), el('th', {}, 'Raf'), el('th', {}, ''))),
          tbody));
      govde.append(el('p', { class: 'kart__alt' }, `${liste.length} ilaç${liste.length !== hepsi.length ? ` (toplam ${hepsi.length})` : ''}`), tablo);
      sirala(tbody);
    }

    arama.oninput = listele;
    suzgec.onchange = listele;
    await listele();
    return depo.dinle('ilaclar', () => listele());
  },
};
