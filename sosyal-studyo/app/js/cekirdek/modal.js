// Modal ve onay kutusu: odak tuzağı, Escape, yazarak onay ("CANLI", "SİL").
import { el, btn } from './dom.js';

export function modal({ baslik, govde, dugmeler = [], kapatilabilir = true, genis = false }) {
  return new Promise((cozul) => {
    const kapat = (deger) => { document.removeEventListener('keydown', tus); ortu.remove(); cozul(deger); };
    const tus = (e) => {
      if (e.key === 'Escape' && kapatilabilir) kapat(null);
      if (e.key === 'Tab') { const odak = [...kutu.querySelectorAll('button, input, select, textarea, a[href]')].filter((x) => !x.disabled); if (!odak.length) return; const i = odak.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); odak.at(-1).focus(); } else if (!e.shiftKey && i === odak.length - 1) { e.preventDefault(); odak[0].focus(); } }
    };
    const kutu = el('div', { class: `modal${genis ? ' modal--genis' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': baslik },
      el('header', { class: 'modal__baslik' }, el('h2', {}, baslik), kapatilabilir ? btn('✕', { class: 'btn btn--ikon', 'aria-label': 'Kapat', onclick: () => kapat(null) }) : null),
      el('div', { class: 'modal__govde' }, govde),
      dugmeler.length ? el('footer', { class: 'modal__ayak' }, ...dugmeler.map((d) => btn(d.metin, { class: `btn ${d.sinif || ''}`, disabled: d.pasif, onclick: async () => { const r = d.cb ? await d.cb() : d.deger; if (r !== false) kapat(r ?? d.deger ?? true); } }))) : null);
    const ortu = el('div', { class: 'ortu', onclick: (e) => { if (e.target === ortu && kapatilabilir) kapat(null); } }, kutu);
    document.body.appendChild(ortu);
    document.addEventListener('keydown', tus);
    (kutu.querySelector('input, textarea, select, button.btn--birincil, button') || kutu).focus();
  });
}

export async function onayla(mesaj, { baslik = 'Emin misin?', tehlikeli = false, yazarakOnay, evet = 'Evet', hayir = 'Vazgeç' } = {}) {
  let girdi = null;
  const govde = el('div', {}, el('p', {}, mesaj));
  if (yazarakOnay) {
    girdi = el('input', { class: 'input', placeholder: yazarakOnay, autocomplete: 'off' });
    govde.appendChild(el('p', { class: 'field__ipucu' }, `Onaylamak için "${yazarakOnay}" yaz.`));
    govde.appendChild(girdi);
  }
  const r = await modal({ baslik, govde, dugmeler: [
    { metin: hayir, deger: false },
    { metin: evet, sinif: tehlikeli ? 'btn--tehlike' : 'btn--birincil', cb: () => { if (yazarakOnay && girdi.value.trim() !== yazarakOnay) { girdi.classList.add('input--hata'); girdi.focus(); return false; } return true; } },
  ] });
  return r === true;
}

export async function sor(baslik, { varsayilan = '', placeholder = '', cokSatir = false } = {}) {
  const g = cokSatir ? el('textarea', { class: 'input', rows: 4 }) : el('input', { class: 'input', placeholder });
  g.value = varsayilan;
  const r = await modal({ baslik, govde: g, dugmeler: [{ metin: 'Vazgeç', deger: null }, { metin: 'Tamam', sinif: 'btn--birincil', cb: () => g.value.trim() || false }] });
  return typeof r === 'string' ? r : null;
}
