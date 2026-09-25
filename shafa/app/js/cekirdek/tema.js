/* Senkron çalışır (modül değil): sayfa boyanmadan tema ve yazı yönü yerleşir,
   yanıp sönme olmaz. Arayüz Farsça olduğu için belge sağdan sola açılır.
   Muayenede gündüz ışığında kullanılır; varsayılan aydınlık tema. */
(function () {
  try {
    document.documentElement.setAttribute('data-tema', localStorage.getItem('ecz-tema') || 'aydinlik');
  } catch (e) {
    document.documentElement.setAttribute('data-tema', 'aydinlik');
  }
  /* Tarayıcının adres/başlık çubuğu üst çubukla aynı renkte (tokenlar.css
     --bg), tema değişince de. Tema iki yerden değişiyor (üst çubuktaki
     düğme, Ayarlar); gözcü ikisini de yakalıyor. */
  function cubukRengi() {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', document.documentElement.getAttribute('data-tema') === 'karanlik' ? '#09141e' : '#f6fafd');
  }
  cubukRengi();
  new MutationObserver(cubukRengi).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema'] });
  document.documentElement.lang = 'fa';
  document.documentElement.dir = 'rtl';
  document.documentElement.classList.add('js');
})();
