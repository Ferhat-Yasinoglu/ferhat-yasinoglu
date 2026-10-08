// Metin: gönderi açıklaması üç parça (kanca · değer · çağrı) + etiketler. Marka sesi ve platform
// denetimi canlı (paylasilan/metin.js); sağda Instagram'ın «daha fazla» kesmesiyle önizleme.
import { h, doldur, kopyala, bildir } from '../dom.js';
import { simge } from '../simge.js';
import { urunBul, metin as urunMetni, RTL_DILLER } from '../paylasilan/urunler.js';
import { birlestir, denetle, onizlemeKesiti, normalEtiket, EN_COK_KARAKTER, KANCA_GORUNEN } from '../paylasilan/metin.js';
import * as depo from '../depo.js';
import { adimGostergesi } from './ortak.js';

/** Üründen varsayılan gönderi metni (seçili içerik dilinde). */
export function varsayilanGonderi(urun, dil) {
  const ozellikler = urun.ozellikler?.[dil] || urun.ozellikler?.en || [];
  return {
    kanca: urunMetni(urun, 'ozet', dil),
    deger: ozellikler.slice(0, 4).join('\n'),
    cagri: urunMetni(urun, 'cagri', dil),
    etiketler: [...(urun.etiketler?.[dil] || urun.etiketler?.en || [])],
    baglanti: '',
  };
}

export async function metinEkrani(kap, a, ctx) {
  const { t, git } = ctx;
  const taslak = await depo.al('taslaklar', a.yol[1]);
  if (!taslak) { git('#/taslaklar'); return; }
  const urun = urunBul(taslak.urun);
  if (!urun) { git('#/projeler'); return; }
  const rtl = RTL_DILLER.has(taslak.dil);
  const g = taslak.gonderi || varsayilanGonderi(urun, taslak.dil);
  taslak.gonderi = g;

  let kayitZamanlayici;
  const kaydet = (hemen = false) => {
    clearTimeout(kayitZamanlayici);
    const yaz = () => depo.kaydet('taslaklar', taslak);
    if (hemen) return yaz();
    kayitZamanlayici = setTimeout(yaz, 400);
  };

  // --- alanlar -----------------------------------------------------------------
  const alan = (anahtar, { satir = 1, enCok = 300, ipucu = '' } = {}) => {
    const sayac = h('span', { class: 'field__sayac' });
    const girdi = h(satir > 1 ? 'textarea' : 'input', { class: 'input', rows: satir > 1 ? satir : false, type: satir > 1 ? false : 'text', maxlength: enCok, placeholder: ipucu, value: satir > 1 ? false : (g[anahtar] || ''), dir: rtl ? 'rtl' : 'auto' });
    if (satir > 1) girdi.value = g[anahtar] || '';
    const say = () => { const n = [...girdi.value].length; sayac.textContent = `${n}/${enCok}`; sayac.classList.toggle('asim', n > enCok); };
    say();
    girdi.addEventListener('input', () => { g[anahtar] = girdi.value; say(); yenile(); kaydet(); });
    return h('div', { class: 'field' }, h('label', {}, h('span', {}, t(`metin.${anahtar}`)), sayac), girdi, h('p', { class: 'g-note' }, t(`metin.${anahtar}_not`)));
  };
  const kancaAlani = alan('kanca', { satir: 2, enCok: 200 });
  const degerAlani = alan('deger', { satir: 6, enCok: 1500 });
  const cagriAlani = alan('cagri', { satir: 2, enCok: 200 });
  const baglantiAlani = alan('baglanti', { enCok: 200, ipucu: 'https://' });

  // etiketler: seçili çipler + öneriler + elle ekleme
  const etiketKutusu = h('div', { class: 'satir' });
  const etiketGirdi = h('input', { class: 'input', type: 'text', placeholder: t('metin.etiket_ekle'), dir: 'auto', style: { minHeight: '44px' } });
  etiketGirdi.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ',' && e.key !== ' ') return;
    e.preventDefault();
    const yeni = normalEtiket(etiketGirdi.value);
    if (yeni && !g.etiketler.includes(yeni)) { g.etiketler.push(yeni); etiketleriCiz(); yenile(); kaydet(); }
    etiketGirdi.value = '';
  });
  const oneriler = [...new Set([...(urun.etiketler?.[taslak.dil] || []), ...(urun.etiketler?.en || []), '#fyajans', '#afganistan', '#afghanistan', '#çevrimdışı', '#offlinefirst', '#pwa'])];
  function etiketleriCiz() {
    doldur(etiketKutusu,
      ...g.etiketler.map((e) => h('button', { type: 'button', class: 'chip chip--secili', 'aria-label': t('metin.etiket_kaldir', { e }), onclick: () => { g.etiketler = g.etiketler.filter((x) => x !== e); etiketleriCiz(); yenile(); kaydet(); } }, e, simge('kapat', { boyut: 12 }))),
      ...oneriler.filter((e) => !g.etiketler.includes(e)).slice(0, 10).map((e) => h('button', { type: 'button', class: 'chip', onclick: () => { g.etiketler.push(e); etiketleriCiz(); yenile(); kaydet(); } }, simge('arti', { boyut: 12 }), e)));
  }
  etiketleriCiz();

  // --- denetim ve önizleme -------------------------------------------------------
  const denetimKutusu = h('div', { class: 'denetim' });
  const onizleme = h('div', { class: 'metin-onizleme', dir: rtl ? 'rtl' : 'auto' });
  const sayacSatiri = h('p', { class: 'g-note' });
  const devam = h('button', { class: 'btn btn--birincil', type: 'button', onclick: async () => { await kaydet(true); git(`#/paylas/${taslak.id}`); } }, t('metin.devam'), simge('ileri', { boyut: 18 }));

  function yenile() {
    const d = denetle(g, { kanal: 'instagram' });
    const satirlar = [];
    for (const x of d.hatalar) satirlar.push(h('p', { class: 'denetim__oge denetim__oge--hata' }, simge('uyari'), t(`denetim.${x.kod}`, { n: x.deger ?? '' })));
    for (const x of d.uyarilar) satirlar.push(h('p', { class: 'denetim__oge denetim__oge--uyari' }, simge('bilgi'), t(`denetim.${x.kod}`, { n: x.deger ?? '' })));
    if (!satirlar.length) satirlar.push(h('p', { class: 'denetim__oge denetim__oge--ok' }, simge('onay'), t('denetim.temiz')));
    doldur(denetimKutusu, ...satirlar);
    const kesit = onizlemeKesiti(d.metin, KANCA_GORUNEN);
    doldur(onizleme, kesit.kesik
      ? [kesit.gorunen, ' ', h('span', { class: 'daha' }, t('metin.daha_fazla')), '\n', h('span', { class: 'kesik' }, d.metin.slice(kesit.gorunen.length - 1))]
      : d.metin);
    sayacSatiri.textContent = t('metin.sayac', { k: d.sayilar.karakter, enCok: EN_COK_KARAKTER, e: d.sayilar.etiket, emoji: d.sayilar.emoji });
    devam.disabled = d.hatalar.length > 0;
  }
  yenile();

  const kopyalaDugmesi = h('button', { class: 'btn btn--hayalet', type: 'button', onclick: async () => { bildir((await kopyala(birlestir(g))) ? t('metin.kopyalandi') : t('metin.kopyalanamadi'), 'basari'); } }, simge('kopyala', { boyut: 18 }), t('metin.kopyala'));
  const sifirla = h('button', { class: 'btn btn--sade btn--kucuk', type: 'button', onclick: () => { if (confirm(t('metin.sifirla_onay'))) { Object.assign(g, varsayilanGonderi(urun, taslak.dil)); ctx.yenidenCiz(); kaydet(true); } } }, simge('yenile', { boyut: 16 }), t('metin.sifirla'));

  doldur(kap,
    h('header', { class: 'g-head' },
      h('div', { class: 'g-head__ust' },
        h('a', { class: 'btn btn--ikon btn--sade', href: `#/tasarla/t/${taslak.id}`, 'aria-label': t('geri') }, simge('geri')),
        h('span', { class: 'icon-box icon-box--renk', style: { '--renk': urun.renk, width: '36px', height: '36px' } }, simge(urun.simge, { boyut: 18 })),
        h('h1', { style: { fontSize: 'var(--fs-h2)' } }, t('metin.baslik')),
        h('span', { class: 'sag' }, adimGostergesi(2, t))),
      h('p', {}, t('metin.aciklama'))),
    h('div', { class: 'iki-sutun' },
      h('div', { class: 'sutun', style: { gap: 'var(--space-5)' } },
        kancaAlani, degerAlani, cagriAlani,
        h('div', { class: 'field' }, h('span', { class: 'field__etiket' }, h('span', {}, t('metin.etiketler')), h('span', { class: 'field__sayac' }, t('metin.etiket_hedef'))), etiketKutusu, etiketGirdi),
        baglantiAlani,
        h('div', { class: 'dugmeler' }, devam, kopyalaDugmesi, sifirla)),
      h('div', { class: 'yapiskan sutun' },
        h('div', { class: 'glass' }, h('p', { class: 'eyebrow eyebrow--xs', style: { marginBottom: '12px' } }, t('metin.onizleme')), onizleme, h('div', { class: 'bosluk' }), sayacSatiri),
        h('div', { class: 'glass glass--sik' }, h('p', { class: 'eyebrow eyebrow--xs', style: { marginBottom: '12px' } }, t('metin.denetim')), denetimKutusu))));
}
