// Giriş noktası: tema anahtarı, mobil menü, alt bilgi yılı.
// Dış bağımlılık yok; tamas (tel:/wa.me) bağlantıları saf HTML olarak çalışır.

// <details open> varsayılanı: JS kapalıyken/gelmeden önce içerik her zaman
// erişilebilir. Mobilde JS varsa daha derli toplu bir başlangıç için kapatır;
// masaüstünde CSS zaten [open] durumundan bağımsız yatay çubuk olarak gösterir.
const mobilMenu = document.querySelector('.mobil-menu');
if (mobilMenu && window.matchMedia('(max-width: 860px)').matches) mobilMenu.open = false;

const temaButon = document.querySelector('.tema-degistir');
if (temaButon) {
  temaButon.addEventListener('click', () => {
    const guncel = document.documentElement.getAttribute('data-theme')
      || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const yeni = guncel === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', yeni);
    try { localStorage.setItem('ds-tema', yeni); } catch {}
  });
}

// Bir bağlantıya tıklayınca mobil açılır menüyü kapat.
document.querySelectorAll('.menu a').forEach((baglanti) => {
  baglanti.addEventListener('click', () => {
    const detay = baglanti.closest('details');
    if (detay) detay.open = false;
  });
});

const yilEtiketi = document.querySelector('[data-yil]');
if (yilEtiketi) yilEtiketi.textContent = String(new Date().getFullYear());
