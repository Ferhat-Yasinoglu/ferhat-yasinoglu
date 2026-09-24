// Modal, onay ve tek alanlı soru kutusu: odak tuzağı, Escape ile kapanma.
import { el, btn } from './dom.js';
import { simge } from './simge.js';

// `sinif`: kutuya ek sınıf; bir sayfanın kendi kutusunu (ör. reçete
// önizlemesi) öbür kutuları etkilemeden biçimlemek için. Düğmedeki
// `simge`: yazının önündeki çizim (hazır bir öğe).
export function modal({ baslik, govde, dugmeler = [], kapatilabilir = true, genis = false, sinif = '' }) {
  return new Promise((cozul) => {
    // Kutuyu açan öğe: kapanınca odak ona dönüyor. Dönmezse <body>'ye
    // düşüyordu ve klavyeyle çalışan hekim forma dönmek için sayfanın
    // başından yeniden Tab'lıyordu. Öğe o arada sayfadan kalkmışsa
    // (sayfa yeniden çizildiyse) odağı sayfa kendisi yerine koyar.
    const acan = document.activeElement;
    let kapandi = false;
    const kapat = (deger) => {
      // Gezinme ve düğme aynı anda kapatabilir: ikinci çağrı bir şey yapmasın.
      if (kapandi) return;
      kapandi = true;
      document.removeEventListener('keydown', tus);
      removeEventListener('hashchange', gezinti);
      ortu.remove();
      if (acan instanceof HTMLElement && acan !== document.body && acan.isConnected) acan.focus({ preventScroll: true });
      cozul(deger);
    };
    // Kutu açıkken sayfa değişince (Geri tuşu, bağlantı) kutu da kapanıyor:
    // açık kalınca başka bir sayfanın üstünde duruyor, içinden yapılan seçim
    // de eski sayfanın işini yeni sayfanın yerine yapıyordu.
    const gezinti = () => kapat(null);
    const tus = (e) => {
      if (e.key === 'Escape' && kapatilabilir) kapat(null);
      if (e.key === 'Tab') {
        const odak = [...kutu.querySelectorAll('button, input, select, textarea, a[href]')].filter((x) => !x.disabled && x.offsetParent !== null);
        if (!odak.length) return;
        const i = odak.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); odak.at(-1).focus(); }
        else if (!e.shiftKey && i === odak.length - 1) { e.preventDefault(); odak[0].focus(); }
      }
    };
    const kutu = el('div', { class: `modal${genis ? ' modal--genis' : ''}${sinif ? ' ' + sinif : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': baslik },
      el('header', { class: 'modal__bas' },
        el('h2', {}, baslik),
        kapatilabilir ? btn(simge('kapat'), { class: 'btn btn--ikon btn--sade', 'aria-label': 'Kapat', onclick: () => kapat(null) }) : null),
      el('div', { class: 'modal__govde' }, govde),
      dugmeler.length
        ? el('footer', { class: 'modal__ayak' }, ...dugmeler.map((d) => btn(d.simge, {
          class: `btn ${d.sinif || ''}`,
          disabled: d.pasif,
          onclick: async (e) => {
            e.currentTarget.disabled = true;
            try {
              const r = d.cb ? await d.cb() : d.deger;
              if (r === false) { e.currentTarget.disabled = false; return; }
              kapat(r ?? d.deger ?? true);
            } catch (err) { e.currentTarget.disabled = false; throw err; }
          },
        }, d.metin)))
        : null);
    /* Örtüye tıklamak kutuyu kapatıyor, ama yalnız basış da örtüde
       başladıysa ve tık çift tıklamanın ikincisi değilse. Çift tıklanan
       alanın açtığı kutu ikinci tıkı örtüsüne alıp hemen kapanıyordu; kutunun
       içinde başlayıp örtüde biten bir sürükleme (yazı seçerken) de öyle. */
    let ortudeBasildi = false;
    const ortu = el('div', {
      class: 'ortu',
      onpointerdown: (e) => { ortudeBasildi = e.target === ortu; },
      onclick: (e) => { if (e.target === ortu && ortudeBasildi && e.detail < 2 && kapatilabilir) kapat(null); },
    }, kutu);
    document.body.appendChild(ortu);
    document.addEventListener('keydown', tus);
    addEventListener('hashchange', gezinti);
    (kutu.querySelector('input:not([type=hidden]), textarea, select, button.btn--birincil') || kutu.querySelector('button') || kutu).focus();
  });
}

export async function onayla(mesaj, { baslik = 'Emin misin?', tehlikeli = false, evet = 'Evet', hayir = 'Vazgeç' } = {}) {
  const r = await modal({
    baslik,
    govde: el('p', { style: { margin: 0 } }, mesaj),
    dugmeler: [
      { metin: hayir, deger: false },
      { metin: evet, sinif: tehlikeli ? 'btn--tehlike' : 'btn--birincil', deger: true },
    ],
  });
  return r === true;
}

export async function sor(baslik, { varsayilan = '', ipucu = '', cokSatir = false } = {}) {
  const g = cokSatir ? el('textarea', { class: 'input', rows: 4 }) : el('input', { class: 'input', placeholder: ipucu });
  g.value = varsayilan;
  const r = await modal({
    baslik, govde: g,
    dugmeler: [{ metin: 'Vazgeç', deger: null }, { metin: 'Tamam', sinif: 'btn--birincil', cb: () => g.value.trim() || false }],
  });
  return typeof r === 'string' ? r : null;
}
