/* Senkron çalışır (modül değil): sayfa boyanmadan tema yerleşir, yanıp sönme olmaz.
   Eczane gündüz ışığında kullanılır; varsayılan aydınlık tema. Seçim cihazda kalır. */
(function () {
  try {
    document.documentElement.setAttribute('data-tema', localStorage.getItem('ecz-tema') || 'aydinlik');
  } catch (e) {
    document.documentElement.setAttribute('data-tema', 'aydinlik');
  }
  document.documentElement.classList.add('js');
})();
