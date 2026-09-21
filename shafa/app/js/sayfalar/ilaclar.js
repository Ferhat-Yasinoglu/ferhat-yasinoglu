// İlaçlar: hekimin kendi ilaç listesi — reçeteye hızlı ve doğru yazabilmek için.
// Stok yok: hasta ilacını dışarıdaki eczaneden kendi alıyor. Burada tutulan şey
// künye: ad, etken madde, şekil, doz, barkod.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, onayKutusu, rozet, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { FORMLAR, formAdi, ilacAra, ilacEtiketi, bosIlac, ilacDogrula } from '../paylasilan/ilac.js';
import { t, secenekleriCevir } from '../i18n.js';
import { dogrulaMetni, hataMetni } from '../hatalar.js';

const SUZGECLER = [['', 'Tümü'], ['receteli', 'Yalnız reçeteli']];
const suzgecler = () => secenekleriCevir(SUZGECLER, 'suzgec');

/** İlaç rozetleri: şimdilik yalnız örnek kayıt işareti. */
export function ilacRozetleri(i) {
  return i.ornek ? [rozet(t('genel.ornek', 'örnek'), 'mor')] : [];
}

/** Ekleme/düzenleme kutusu. */
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
      form: secim(secenekleriCevir(FORMLAR, 'form'), { name: 'form', value: deger.form }),
      doz: girdi({ name: 'doz', value: deger.doz, placeholder: '500 mg' }),
      kutuAdedi: girdi({ name: 'kutuAdedi', value: deger.kutuAdedi, type: 'number', min: 0, step: 1 }),
      uretici: girdi({ name: 'uretici', value: deger.uretici }),
      notlar: metinAlani({ name: 'notlar', value: deger.notlar, rows: 2 }),
      receteli: onayKutusu(t('ilac.receteli', 'Reçete ile verilir'), { name: 'receteli', checked: !!deger.receteli }),
    };
    govde.append(
      el('div', { class: 'izgara izgara--form' },
        alan(t('ilac.ad', 'İlaç adı'), g.ad, { gerekli: true, hata: dogrulaMetni(hatalar.ad) }),
        alan(t('ilac.etken_madde', 'Etken madde'), g.etkenMadde, { ipucu: t('ilac.etken_ipucu', 'Muadil bulmakta kullanılır') }),
        alan(t('ilac.form', 'Form'), g.form),
        alan(t('ilac.doz', 'Doz'), g.doz),
        alan(t('ilac.kutu_adedi', 'Kutudaki adet'), g.kutuAdedi),
        alan(t('ilac.barkod', 'Barkod'), g.barkod, { hata: dogrulaMetni(hatalar.barkod) }),
        alan(t('ilac.uretici', 'Üretici'), g.uretici)),
      alan(t('genel.not', 'Not'), g.notlar),
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
    baslik: mevcut ? t('ilac.duzenle', 'İlacı düzenle') : t('ilac.yeni', 'Yeni ilaç'),
    govde, genis: true,
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('genel.kaydet', 'Kaydet'), sinif: 'btn--birincil', cb: () => {
        const v = { ...deger, ...govde._oku() };
        const hatalar = ilacDogrula(v);
        if (Object.keys(hatalar).length) { deger = v; ciz(hatalar); return false; }
        return v;
      } },
    ],
  });
  if (!sonuc || typeof sonuc !== 'object') return null;

  try {
    const y = await depo.kaydet('ilaclar', mevcut ? { ...mevcut, ...sonuc } : sonuc);
    basari(mevcut ? t('ilac.guncellendi', 'İlaç güncellendi') : t('ilac.eklendi', 'İlaç eklendi'));
    return y;
  } catch (e) {
    hata(hataMetni(e, t('genel.kaydedilemedi', 'Kaydedilemedi')));
    return null;
  }
}

export default {
  baslik: 'İlaçlar',
  async cizim(kok, ctx) {
    const { depo, git } = ctx;
    temizle(kok);

    const arama = girdi({ type: 'search', placeholder: t('ilac.ara', 'Ad, barkod, etken madde…'), style: { flex: '2', minWidth: '200px', inlineSize: 'auto' } });
    const suzgec = secim(suzgecler(), { style: { flex: '1', minWidth: '180px', inlineSize: 'auto' }, value: ctx.sorgu?.suzgec || '' });
    const govde = el('div', {});

    kok.append(
      sayfaBas(t('nav.ilaclar', 'İlaçlar'), {
        alt: t('ilac.sayfa_alt', 'Reçeteye yazılacak ilaçların künyesi.'),
        eylemler: [btnS('arti', t('ilac.ekle', 'İlaç ekle'), { class: 'btn btn--birincil', onclick: async () => { if (await ilacKutusu(ctx)) listele(); } })],
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
      if (suzgec.value === 'receteli') liste = liste.filter((i) => i.receteli);

      if (!hepsi.length) {
        govde.appendChild(bosDurum({
          simge: 'ilac', baslik: t('ilac.bos', 'Henüz ilaç yok'),
          alt: t('ilac.bos_alt', 'İlk ilacı ekle ya da Ayarlar\'dan örnek verileri yükleyerek uygulamayı dene.'),
          eylem: btnS('arti', t('ilac.ekle', 'İlaç ekle'), { class: 'btn btn--birincil', onclick: async () => { if (await ilacKutusu(ctx)) listele(); } }),
        }));
        return;
      }
      if (!liste.length) { govde.appendChild(bosDurum({ simge: 'ara', baslik: t('ilac.eslesme_yok', 'Eşleşen ilaç yok'), alt: t('genel.suzgec_degistir', 'Aramayı ya da süzgeci değiştir.') })); return; }

      const tbody = el('tbody', {});
      for (const i of liste) {
        tbody.appendChild(el('tr', { class: 'liste__satir--tiklanir', style: { cursor: 'pointer' }, onclick: () => git(`/ilac/${i.id}`) },
          el('td', {},
            el('div', { class: 'liste__baslik' }, ilacEtiketi(i)),
            el('div', { class: 'liste__alt' }, [i.etkenMadde, i.uretici].filter(Boolean).join(' · ') || '—')),
          el('td', {}, formAdi(i.form) || '—'),
          el('td', {}, i.receteli ? rozet(t('ilac.receteli_kisa', 'Reçeteli'), 'vurgu') : ''),
          el('td', {}, ...ilacRozetleri(i)),
          el('td', { class: 'sayi' }, btn(simge('sag', { boy: 16 }), { class: 'btn btn--kucuk btn--ikon btn--sade', 'aria-label': t('ilac.karti_ac', '{ad} kartını aç', { ad: i.ad }) }))));
      }
      const tablo = el('div', { class: 'tablo-kap' },
        el('table', { class: 'tablo' },
          el('thead', {}, el('tr', {},
            el('th', {}, t('nav.ilac', 'İlaç')), el('th', {}, t('ilac.form', 'Form')),
            el('th', {}, ''), el('th', {}, ''), el('th', {}, ''))),
          tbody));
      govde.append(el('p', { class: 'kart__alt' }, t('ilac.sayim', '{n} ilaç', { n: liste.length }) + (liste.length !== hepsi.length ? ' ' + t('genel.toplam', '(toplam {n})', { n: hepsi.length }) : '')), tablo);
      sirala(tbody);
    }

    arama.oninput = listele;
    suzgec.onchange = listele;
    await listele();
    return depo.dinle('ilaclar', () => listele());
  },
};
