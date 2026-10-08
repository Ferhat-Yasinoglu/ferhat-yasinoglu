// Kurulum: Meta tarafı adım adım (hesaplar → uygulama → token'lar → kanıt). Onay kutuları bu cihazda durur.
import { h, doldur, kopyala, bildir } from '../dom.js';
import { simge } from '../simge.js';
import { dil } from '../i18n.js';
import { BOLUMLER, TUM_ADIMLAR } from '../rehber.js';

const ANAHTAR = 'fyr.kurulum';

function oku() {
  try { return new Set(JSON.parse(localStorage.getItem(ANAHTAR) || '[]')); } catch { return new Set(); }
}
function yaz(k) {
  try { localStorage.setItem(ANAHTAR, JSON.stringify([...k])); } catch { /* yalnız bu oturum */ }
}

export async function kurulumEkrani(kap, a, ctx) {
  const { t } = ctx;
  const d = dil() === 'fa' ? 'fa' : 'tr';
  const tamam = oku();
  const ilerleme = h('span', { class: 'chip chip--kirec' });
  const yenile = () => { ilerleme.textContent = t('kurulum.ilerleme', { n: tamam.size, t: TUM_ADIMLAR.length }); };
  yenile();

  const bolumler = BOLUMLER.map((b, i) => h('section', { class: 'glass', 'data-reveal': '' },
    h('div', { class: 'satir satir--arasi', style: { marginBottom: '12px' } }, h('h2', { class: 'kart__baslik' }, b.baslik[d]), h('span', { class: 'ghost-num' }, String(i + 1).padStart(2, '0'))),
    ...b.adimlar.map((s) => {
      const kutu = h('input', { type: 'checkbox', checked: tamam.has(s.id), onchange: (e) => { if (e.target.checked) tamam.add(s.id); else tamam.delete(s.id); yaz(tamam); yenile(); } });
      return h('div', { style: { padding: '12px 0', borderBlockEnd: '1px solid rgb(var(--line) / .06)' } },
        h('label', { class: 'onay-kutusu', style: { alignItems: 'flex-start' } }, kutu, h('span', {}, h('b', {}, s.b[d]), h('span', { class: 'kart__alt', style: { display: 'block', marginTop: '4px' } }, s.a[d]))),
        s.kod ? h('pre', { class: 'g-mono', dir: 'ltr', style: { margin: '8px 0 0 30px', padding: '12px', borderRadius: 'var(--radius-md)', background: 'rgb(var(--ink-2))', border: '1px solid rgb(var(--line) / .08)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '12px', lineHeight: '1.5' } }, s.kod) : null,
        h('div', { class: 'satir', style: { marginInlineStart: '30px', marginTop: '8px' } },
          s.link ? h('a', { class: 'btn btn--kucuk btn--hayalet', href: s.link, target: '_blank', rel: 'noopener' }, simge('harici', { boyut: 16 }), t('ac')) : null,
          s.kod ? h('button', { class: 'btn btn--kucuk btn--sade', type: 'button', onclick: async () => bildir((await kopyala(s.kod)) ? t('kurulum.kopyalandi') : t('metin.kopyalanamadi')) }, simge('kopyala', { boyut: 16 }), t('kurulum.kopyala')) : null));
    })));

  doldur(kap,
    h('header', { class: 'g-head g-head--yan' },
      h('div', {},
        h('div', { class: 'g-head__ust' }, h('a', { class: 'btn btn--ikon btn--sade', href: '#/daha', 'aria-label': t('geri') }, simge('geri')), h('p', { class: 'eyebrow' }, t('kurulum.ust'))),
        h('h1', { style: { marginTop: '10px' } }, t('kurulum.baslik'))),
      h('div', {}, h('p', {}, t('kurulum.aciklama')), h('div', { class: 'satir', style: { marginTop: '10px' } }, ilerleme,
        h('button', { class: 'btn btn--kucuk btn--sade', type: 'button', onclick: () => { if (confirm(t('kurulum.sifirla_onay'))) { tamam.clear(); yaz(tamam); ctx.yenidenCiz(); } } }, simge('yenile', { boyut: 16 }), t('kurulum.sifirla'))))),
    h('p', { class: 'g-note' }, t('kurulum.not')),
    ...bolumler);
}
