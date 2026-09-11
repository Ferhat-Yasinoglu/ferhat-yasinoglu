// Toast bildirimleri: aria-live, kuyruk, otomatik kapanış.
let kap = null;
function kapAl() {
  if (!kap) { kap = document.createElement('div'); kap.className = 'bildirimler'; kap.setAttribute('aria-live', 'polite'); document.body.appendChild(kap); }
  return kap;
}
export function bildir(metin, { tur = 'bilgi', sure = 3500, eylem } = {}) {
  const k = kapAl();
  const e = document.createElement('div'); e.className = `bildirim bildirim--${tur}`;
  const m = document.createElement('span'); m.textContent = metin; e.appendChild(m);
  if (eylem) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn btn--kucuk'; b.textContent = eylem.metin; b.onclick = () => { eylem.cb(); e.remove(); }; e.appendChild(b); }
  k.appendChild(e);
  if (sure) setTimeout(() => e.remove(), sure);
  while (k.children.length > 4) k.firstChild.remove();
  return () => e.remove();
}
export const hata = (m, s) => bildir(m, { tur: 'hata', sure: 6000, ...s });
export const basari = (m, s) => bildir(m, { tur: 'basari', ...s });
