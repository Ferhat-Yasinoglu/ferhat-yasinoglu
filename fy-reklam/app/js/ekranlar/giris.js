// Giriş: FY logosu ve «Google ile giriş». Yalnız YONETICILER listesindeki Gmail'ler girer.
// Yerel geliştirme sunucusunda Google yerine e-posta kutusu çıkar.
import { h, doldur } from '../dom.js';
import { t, dil, dilSec } from '../i18n.js';
import { girisGoogle, girisGelistirme } from '../api.js';
import { simge } from '../simge.js';

let gsiYukleniyor;
function gsiYukle() {
  gsiYukleniyor ??= new Promise((coz, red) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = coz;
    s.onerror = () => { gsiYukleniyor = null; red(new Error('gsi')); };
    document.head.append(s);
  });
  return gsiYukleniyor;
}

function hataMetni(e) {
  if (e?.kod === 'yetki') return t('giris.yetkisiz', { eposta: e.veri?.eposta || '' });
  if (e?.kod === 'kimlik') return t('hata.kimlik');
  if (e?.kod === 'yapilandirma') return t('hata.yapilandirma');
  if (e?.kod === 'oran') return t('hata.oran');
  if (e?.kod === 'ag' || e?.durum === 0) return t('hata.ag');
  return t('hata.sunucu');
}

export function girisEkrani(girildi, durumBilgisi) {
  const mesaj = h('p', { class: 'giris__mesaj', role: 'alert' });
  const alan = h('div', { class: 'giris__alan' }, h('span', { class: 'donen' }));
  const hata = (e) => { mesaj.textContent = hataMetni(e); };
  const d = durumBilgisi.sunucu || {};

  (async () => {
    if (d.gelistirme) {
      const girdi = h('input', { class: 'input', type: 'email', value: 'sahip@ornek.af', 'aria-label': t('eposta'), dir: 'ltr' });
      doldur(alan, h('form', {
        class: 'form', style: { width: '100%' },
        onsubmit: async (o) => {
          o.preventDefault();
          try { await girisGelistirme(girdi.value); girildi(); } catch (e) { hata(e); }
        },
      }, girdi, h('button', { class: 'btn btn--birincil btn--genis' }, simge('kalkan', { boyut: 18 }), t('giris.gelistirme'))));
      return;
    }
    if (!d.istemciKimligi) { doldur(alan); mesaj.textContent = t('hata.yapilandirma'); return; }
    try { await gsiYukle(); } catch { doldur(alan); mesaj.textContent = t('giris.google_yuklenemedi'); return; }
    const hedef = h('div');
    doldur(alan, hedef);
    globalThis.google.accounts.id.initialize({
      client_id: d.istemciKimligi,
      callback: async (y) => {
        mesaj.textContent = '';
        try { await girisGoogle(y.credential); girildi(); } catch (e) { hata(e); }
      },
      auto_select: false, itp_support: true, ux_mode: 'popup',
    });
    globalThis.google.accounts.id.renderButton(hedef, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: dil() === 'fa' ? 'fa' : 'tr', width: 280 });
  })();

  const dilDugmesi = h('button', { class: 'btn btn--sade btn--kucuk', type: 'button', onclick: () => dilSec(dil() === 'fa' ? 'tr' : 'fa') }, simge('dil', { boyut: 16 }), dil() === 'fa' ? 'Türkçe' : 'دری');

  return h('div', { class: 'giris' },
    h('div', { class: 'giris__kart' },
      h('img', { class: 'giris__logo', src: 'img/icon-512.png', alt: 'FY', width: 112, height: 112, 'data-reveal': '' }),
      h('div', { 'data-reveal': '' },
        h('p', { class: 'eyebrow', style: { marginBottom: '12px' } }, t('giris.ust')),
        h('h1', {}, 'FY ', h('span', { class: 'vurgu' }, t('giris.reklam'))),
        h('p', { class: 'soluk', style: { marginTop: '10px' } }, t('giris.aciklama'))),
      h('div', { 'data-reveal': '', style: { width: '100%', display: 'grid', gap: '12px', justifyItems: 'center' } }, alan, mesaj),
      h('p', { class: 'giris__not', 'data-reveal': '' }, t('giris.not')),
      dilDugmesi));
}
