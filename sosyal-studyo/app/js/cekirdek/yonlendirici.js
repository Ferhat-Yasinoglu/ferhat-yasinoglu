// Hash yönlendirici: `#/akis/abc` → rota `/akis/:id`, param {id:'abc'}.
// GitHub Pages alt yolunda derin bağlantı 404 vermesin diye hash seçildi.
export class Yonlendirici {
  constructor(rotalar, { kok, cizimOncesi } = {}) {
    this.rotalar = rotalar.map((r) => ({ ...r, regex: new RegExp('^' + r.yol.replace(/:[^/]+/g, '([^/]+)') + '$'), adlar: [...r.yol.matchAll(/:([^/]+)/g)].map((m) => m[1]) }));
    this.kok = kok; this.cizimOncesi = cizimOncesi; this.temizleyici = null; this.simdiki = null;
  }
  baslat() {
    window.addEventListener('hashchange', () => this.calistir());
    return this.calistir();
  }
  git(yol) { location.hash = '#' + (yol.startsWith('/') ? yol : '/' + yol); }
  esle(yol) {
    for (const r of this.rotalar) {
      const m = yol.match(r.regex);
      if (m) return { rota: r, param: Object.fromEntries(r.adlar.map((a, i) => [a, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
  async calistir() {
    const ham = location.hash.replace(/^#/, '') || '/';
    const [yol, sorgu = ''] = ham.split('?');
    let e = this.esle(yol);
    if (!e) { e = this.esle('/404'); if (!e) return; }
    if (this.temizleyici) { try { this.temizleyici(); } catch (err) { console.error(err); } this.temizleyici = null; }
    this.simdiki = { yol, param: e.param, sorgu: Object.fromEntries(new URLSearchParams(sorgu)) };
    if (this.cizimOncesi) this.cizimOncesi(this.simdiki, e.rota);
    try {
      const mod = await e.rota.yukle();
      const sayfa = mod.default;
      const sonuc = await sayfa.cizim(this.kok, { ...this.ctx, param: e.param, sorgu: this.simdiki.sorgu, yol });
      this.temizleyici = typeof sonuc === 'function' ? sonuc : null;
      const h1 = this.kok.querySelector('h1');
      if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
      window.scrollTo(0, 0);
    } catch (err) {
      console.error('sayfa çizilemedi', yol, err);
      this.kok.replaceChildren();
      const p = document.createElement('p'); p.className = 'durum-hata'; p.textContent = 'Sayfa yüklenemedi: ' + (err?.message || err);
      this.kok.appendChild(p);
    }
  }
}
