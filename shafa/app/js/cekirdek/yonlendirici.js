// Hash yönlendirici: `#/hasta/abc` → rota `/hasta/:id`, param {id:'abc'}.
// Hash seçildi ki uygulama dosya sisteminden ya da alt yoldan açıldığında da
// derin bağlantılar 404 vermesin.
export class Yonlendirici {
  constructor(rotalar, { kok, cizimOncesi } = {}) {
    this.rotalar = rotalar.map((r) => ({
      ...r,
      regex: new RegExp('^' + r.yol.replace(/:[^/]+/g, '([^/]+)') + '$'),
      adlar: [...r.yol.matchAll(/:([^/]+)/g)].map((m) => m[1]),
    }));
    this.kok = kok; this.cizimOncesi = cizimOncesi; this.temizleyici = null; this.simdiki = null; this.ctx = {};
    // Çizim sırası: sayfa modülü tembel yüklendiği için iki gezinme üst üste
    // gelirse iki çizim aynı anda yürüyebilir. Eskisi kendi temizleyicisini
    // çağırıp çekilir — yoksa dinleyicileri sonsuza dek açık kalır ve bambaşka
    // bir sayfadayken ekranı basar.
    this.sira = 0;
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
    const benim = ++this.sira;
    try {
      const mod = await e.rota.yukle();
      if (benim !== this.sira) return;
      const sonuc = await mod.default.cizim(this.kok, { ...this.ctx, param: e.param, sorgu: this.simdiki.sorgu, yol });
      const temiz = typeof sonuc === 'function' ? sonuc : null;
      if (benim !== this.sira) { if (temiz) { try { temiz(); } catch (err) { console.error(err); } } return; }
      this.temizleyici = temiz;
      this.kok.classList.remove('sayfa-giris'); void this.kok.offsetWidth; this.kok.classList.add('sayfa-giris');
      const h1 = this.kok.querySelector('h1');
      // Yeni sayfada odak başlığa: ekran okuyucu nerede olduğunu söylesin.
      // `data-yonlendirme-odagi` ile işaretleniyor çünkü tarayıcı programla
      // verilen bu odağı klavye odağı sayıp görünür halkayı çiziyordu —
      // sayfanın üstünde sebepsiz bir çerçeve olarak görünüyordu. Halka
      // CSS'te yalnız bu öğe için bastırılıyor; gerçek klavye gezinmesinde
      // odak yine görünür kalıyor.
      if (h1) {
        h1.setAttribute('tabindex', '-1');
        h1.setAttribute('data-yonlendirme-odagi', '');
        h1.focus({ preventScroll: true });
        // İşaret yalnız bu odak için: sonra klavyeyle gelinirse halka çıksın.
        h1.addEventListener('blur', () => h1.removeAttribute('data-yonlendirme-odagi'), { once: true });
      }
      window.scrollTo(0, 0);
    } catch (err) {
      if (benim !== this.sira) return;
      console.error('sayfa çizilemedi', yol, err);
      // Modül yükleme hatası genelde önbellekteki eski/yeni karışımından
      // geliyor; kullanıcıya ölü bir ekran göstermeden önce temizleyip
      // bir kez yeniden deniyoruz.
      const { modulHatasiMi, kurtar } = await import('./kurtarma.js');
      if (modulHatasiMi(err) && await kurtar()) return;
      this.kok.replaceChildren();
      const { bosDurum } = await import('./dom.js');
      const { t } = await import('../i18n.js');
      this.kok.appendChild(bosDurum({
        hata: true, simge: 'hata',
        baslik: t('hata.sayfa_yuklenemedi', 'Sayfa yüklenemedi'),
        alt: err?.message || String(err),
      }));
    }
  }
}
