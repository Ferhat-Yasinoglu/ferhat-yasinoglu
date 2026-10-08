// Tasarla: biçim (kare / dikey / hikâye), şablon (başlık / özellikler / akış), içerik dili, metinler;
// sağda (ya da altta) canlı önizleme. Her değişiklik taslağa yazılır (IndexedDB). «Devam» → Metin.
//
// Adres: #/tasarla/<urun>  (yeni taslak)   ·   #/tasarla/t/<taslakId>  (var olan taslak)
import { h, doldur, svgCoz, bildir } from '../dom.js';
import { simge } from '../simge.js';
import { urunBul, metin as urunMetni, DILLER, RTL_DILLER } from '../paylasilan/urunler.js';
import { BICIMLER, SABLONLAR, svgUret, varsayilanMetinler } from '../sablon/cizim.js';
import * as depo from '../depo.js';
import { adimGostergesi } from './ortak.js';

const DIL_ADI = { tr: 'Türkçe', de: 'Deutsch', en: 'English', fa: 'دری' };
const BICIM_SIMGE = { kare: 'kare', dikey: 'dikey', hikaye: 'hikaye' };
const SABLON_SIMGE = { baslik: 'baslik', ozellikler: 'liste', akis: 'akis' };

export async function tasarlaEkrani(kap, a, ctx) {
  const { t, git } = ctx;
  let taslak;
  if (a.yol[1] === 't' && a.yol[2]) {
    taslak = await depo.al('taslaklar', a.yol[2]);
    if (!taslak) { git('#/taslaklar'); return; }
  } else {
    const urun = urunBul(a.yol[1]);
    if (!urun) { git('#/projeler'); return; }
    const dilSec = urun.kitle[0] || 'tr';
    taslak = await depo.kaydet('taslaklar', {
      urun: urun.anahtar, bicim: 'dikey', sablon: 'baslik', dil: dilSec, logo: true, adresGoster: true,
      ...varsayilanMetinler(urun, dilSec, urunMetni),
      gonderi: null, durum: 'taslak',
    });
    // Adres çubuğu taslağın kalıcı adresine döner (geri tuşu yeni taslak üretmesin).
    history.replaceState(null, '', `#/tasarla/t/${taslak.id}`);
  }
  const urun = urunBul(taslak.urun);
  if (!urun) { git('#/projeler'); return; }

  // --- önizleme ------------------------------------------------------------
  const onizleme = h('div', { class: ['onizleme', `onizleme--${taslak.bicim}`, 'onizleme--yukleniyor'] });
  let cizimSayaci = 0;
  async function onizle() {
    const sira = ++cizimSayaci;
    onizleme.classList.add('onizleme--yukleniyor');
    try {
      const svg = await svgUret(taslak, urun);
      if (sira !== cizimSayaci) return;
      const el = svgCoz(svg);
      el.removeAttribute('width'); el.removeAttribute('height');
      onizleme.className = `onizleme onizleme--${taslak.bicim}`;
      doldur(onizleme, el);
    } catch (e) {
      if (sira !== cizimSayaci) return;
      onizleme.classList.remove('onizleme--yukleniyor');
      doldur(onizleme, h('p', { class: 'denetim__oge denetim__oge--hata', style: { padding: '16px' } }, simge('uyari'), String(e.message || e)));
    }
  }

  let kayitZamanlayici;
  const kaydet = (hemen = false) => {
    clearTimeout(kayitZamanlayici);
    const yaz = async () => { taslak = await depo.kaydet('taslaklar', taslak); };
    if (hemen) return yaz();
    kayitZamanlayici = setTimeout(yaz, 400);
  };
  const degisti = () => { kaydet(); onizle(); };

  // --- seçimler --------------------------------------------------------------
  const secimGrubu = (secenekler, secili, sec, simgeler) => {
    const grup = h('div', { class: 'secim', role: 'group' });
    const yenile = () => {
      doldur(grup, ...secenekler.map(([deger, etiket]) => h('button', {
        type: 'button', class: ['secim__ogesi', deger === secili() ? 'secili' : ''], 'aria-pressed': deger === secili() ? 'true' : 'false',
        onclick: () => { sec(deger); yenile(); },
      }, simgeler?.[deger] ? simge(simgeler[deger], { boyut: 18 }) : null, etiket)));
    };
    yenile();
    return grup;
  };

  const bicimSecimi = secimGrubu(Object.keys(BICIMLER).map((b) => [b, t(`bicim.${b}`)]), () => taslak.bicim, (b) => { taslak.bicim = b; degisti(); }, BICIM_SIMGE);
  const sablonSecimi = secimGrubu(SABLONLAR.map((s) => [s, t(`sablon.${s}`)]), () => taslak.sablon, (s) => { taslak.sablon = s; degisti(); }, SABLON_SIMGE);

  // Dil değişince metinler o dilin varsayılanlarına döner (kullanıcı yazdıklarını kaybetmesin diye sorulur).
  const dilSecimi = secimGrubu(DILLER.map((d) => [d, DIL_ADI[d]]), () => taslak.dil, (d) => {
    const varsayilan = varsayilanMetinler(urun, taslak.dil, urunMetni);
    const degismis = taslak.baslik !== varsayilan.baslik || taslak.alt !== varsayilan.alt || taslak.cagri !== varsayilan.cagri || (taslak.ozellikler || []).join('|') !== varsayilan.ozellikler.join('|');
    taslak.dil = d;
    if (!degismis || confirm(t('tasarla.dil_sifirla'))) Object.assign(taslak, varsayilanMetinler(urun, d, urunMetni));
    formuDoldur();
    degisti();
  });

  // --- metin alanları ---------------------------------------------------------
  const alan = (anahtar, { satir = 1, ipucu = '', enCok = 160 } = {}) => {
    const sayac = h('span', { class: 'field__sayac' });
    const girdi = satir > 1
      ? h('textarea', { class: 'input', rows: satir, maxlength: enCok, placeholder: ipucu, dir: RTL_DILLER.has(taslak.dil) ? 'rtl' : 'auto' })
      : h('input', { class: 'input', type: 'text', maxlength: enCok, placeholder: ipucu, dir: RTL_DILLER.has(taslak.dil) ? 'rtl' : 'auto' });
    const say = () => { sayac.textContent = `${[...girdi.value].length}/${enCok}`; };
    girdi.addEventListener('input', () => { taslak[anahtar] = girdi.value; say(); degisti(); });
    const kutu = h('div', { class: 'field' }, h('label', {}, h('span', {}, t(`tasarla.${anahtar}`)), sayac), girdi);
    kutu.doldur = () => { girdi.value = taslak[anahtar] || ''; girdi.dir = RTL_DILLER.has(taslak.dil) ? 'rtl' : 'auto'; say(); };
    return kutu;
  };
  const baslikAlani = alan('baslik', { ipucu: t('tasarla.baslik_ipucu'), enCok: 120 });
  const altAlani = alan('alt', { satir: 3, ipucu: t('tasarla.alt_ipucu'), enCok: 240 });
  const cagriAlani = alan('cagri', { ipucu: t('tasarla.cagri_ipucu'), enCok: 80 });

  // özellikler: 4 satır (hikâyede 5)
  const ozellikKutusu = h('div', { class: 'field' });
  function ozellikleriDoldur() {
    const n = taslak.bicim === 'hikaye' ? 5 : 4;
    const liste = (taslak.ozellikler || []).slice(0, n);
    while (liste.length < n) liste.push('');
    doldur(ozellikKutusu,
      h('label', {}, h('span', {}, t('tasarla.ozellikler')), h('span', { class: 'field__sayac' }, t('tasarla.ozellik_not'))),
      ...liste.map((o, i) => h('input', {
        class: 'input', type: 'text', value: o, maxlength: 90, dir: RTL_DILLER.has(taslak.dil) ? 'rtl' : 'auto',
        placeholder: `${i + 1}.`,
        oninput: (e) => { const l = [...(taslak.ozellikler || [])]; l[i] = e.target.value; taslak.ozellikler = l; degisti(); },
      })));
  }

  const logoKutusu = h('label', { class: 'onay-kutusu' }, h('input', { type: 'checkbox', checked: taslak.logo !== false, onchange: (e) => { taslak.logo = e.target.checked; degisti(); } }), t('tasarla.logo'));
  const adresKutusu = h('label', { class: 'onay-kutusu' }, h('input', { type: 'checkbox', checked: taslak.adresGoster !== false, onchange: (e) => { taslak.adresGoster = e.target.checked; degisti(); } }), t('tasarla.adres_goster'));

  function formuDoldur() {
    for (const k of [baslikAlani, altAlani, cagriAlani]) k.doldur();
    ozellikleriDoldur();
  }
  formuDoldur();

  const devam = h('button', {
    class: 'btn btn--birincil', type: 'button',
    onclick: async () => { await kaydet(true); git(`#/metin/${taslak.id}`); },
  }, t('tasarla.devam'), simge('ileri', { boyut: 18 }));

  const sifirla = h('button', {
    class: 'btn btn--sade btn--kucuk', type: 'button',
    onclick: () => { if (confirm(t('tasarla.sifirla_onay'))) { Object.assign(taslak, varsayilanMetinler(urun, taslak.dil, urunMetni)); formuDoldur(); degisti(); bildir(t('tasarla.sifirlandi')); } },
  }, simge('yenile', { boyut: 16 }), t('tasarla.sifirla'));

  doldur(kap,
    h('header', { class: 'g-head' },
      h('div', { class: 'g-head__ust' },
        h('a', { class: 'btn btn--ikon btn--sade', href: '#/projeler', 'aria-label': t('geri') }, simge('geri')),
        h('span', { class: 'icon-box icon-box--renk', style: { '--renk': urun.renk, width: '36px', height: '36px' } }, simge(urun.simge, { boyut: 18 })),
        h('h1', { style: { fontSize: 'var(--fs-h2)' } }, urun.ad),
        h('span', { class: 'sag' }, adimGostergesi(1, t))),
      h('p', {}, t('tasarla.aciklama'))),
    h('div', { class: 'iki-sutun' },
      h('div', { class: 'sutun', style: { gap: 'var(--space-5)' } },
        h('div', { class: 'field' }, h('span', { class: 'field__etiket' }, t('tasarla.bicim')), bicimSecimi),
        h('div', { class: 'field' }, h('span', { class: 'field__etiket' }, t('tasarla.sablon')), sablonSecimi),
        h('div', { class: 'field' }, h('span', { class: 'field__etiket' }, t('tasarla.dil')), dilSecimi),
        h('hr', { class: 'cizgi' }),
        baslikAlani, altAlani, ozellikKutusu, cagriAlani,
        h('div', { class: 'satir' }, logoKutusu, adresKutusu),
        h('div', { class: 'dugmeler' }, devam, sifirla)),
      h('div', { class: 'yapiskan sutun' },
        onizleme,
        h('p', { class: 'g-note' }, t('tasarla.onizleme_not')))));

  onizle();
}
