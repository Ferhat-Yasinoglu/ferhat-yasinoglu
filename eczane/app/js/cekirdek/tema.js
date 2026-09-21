/* Senkron çalışır (modül değil): sayfa boyanmadan tema ve yazı yönü yerleşir,
   yanıp sönme olmaz. Arayüz Farsça olduğu için belge sağdan sola açılır.
   Muayenede gündüz ışığında kullanılır; varsayılan aydınlık tema. */
(function () {
  try {
    document.documentElement.setAttribute('data-tema', localStorage.getItem('ecz-tema') || 'aydinlik');
  } catch (e) {
    document.documentElement.setAttribute('data-tema', 'aydinlik');
  }
  document.documentElement.lang = 'fa';
  document.documentElement.dir = 'rtl';
  document.documentElement.classList.add('js');
})();
