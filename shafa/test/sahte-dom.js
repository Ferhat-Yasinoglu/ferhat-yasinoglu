// Testler Node'da koşuyor, tarayıcı DOM'u yok. SVG kuran modüller (simge.js,
// cizimler.js) yalnız birkaç çağrı kullanıyor: createElement(NS),
// setAttribute, append/prepend, textContent. Bunları taklit eden küçük bir
// ağaç yetiyor — jsdom gibi bir bağımlılık eklemeye gerek yok.
class Oge {
  constructor(etiket, ns = null) {
    this.tagName = etiket;
    this.namespaceURI = ns;
    this.attributes = new Map();
    this.children = [];
    this.textContent = '';
  }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.has(k) ? this.attributes.get(k) : null; }
  appendChild(c) { this.children.push(c); return c; }
  append(...c) { this.children.push(...c); }
  prepend(...c) { this.children.unshift(...c); }
  get className() { return this.getAttribute('class') ?? ''; }
  set className(v) { this.setAttribute('class', v); }
  get dir() { return this.getAttribute('dir') ?? ''; }
  set dir(v) { this.setAttribute('dir', v); }
  /** Alt ağaçtaki bütün öğeler (kendisi hariç), belge sırasıyla. */
  torunlar() { return this.children.flatMap((c) => [c, ...c.torunlar()]); }
}

export function sahteDomKur() {
  globalThis.document = {
    createElementNS: (ns, etiket) => new Oge(etiket, ns),
    createElement: (etiket) => new Oge(etiket, 'http://www.w3.org/1999/xhtml'),
  };
  return () => { delete globalThis.document; };
}
