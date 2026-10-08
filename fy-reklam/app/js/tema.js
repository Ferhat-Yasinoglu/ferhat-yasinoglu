// Görünüm: 'gece' (varsayılan; ajans sitesiyle aynı gece siyahı) ya da 'gunduz'. Seçim tarayıcıda saklanır.
const ANAHTAR = 'fyr.tema';
const RENK = { gece: '#0a0b0a', gunduz: '#f6f7f2' };

export function tema() {
  try { const t = localStorage.getItem(ANAHTAR); if (t === 'gece' || t === 'gunduz') return t; } catch { /* depolama kapalı */ }
  return 'gece';
}

export function temaUygula(t = tema()) {
  document.documentElement.dataset.tema = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', RENK[t]);
}

export function temaSec(t) {
  try { localStorage.setItem(ANAHTAR, t); } catch { /* yalnız bu oturum */ }
  const uygula = () => temaUygula(t);
  if (document.startViewTransition && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(uygula);
  else uygula();
}
