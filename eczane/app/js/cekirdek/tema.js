/* Senkron çalışır (modül değil): sayfa boyanmadan tema ve yazı yönü yerleşir,
   yanıp sönme olmaz. Eczane gündüz ışığında kullanılır; varsayılan aydınlık tema.
   Dari seçiliyse belge sağdan sola açılır. */
(function () {
  var dil = 'tr';
  try {
    document.documentElement.setAttribute('data-tema', localStorage.getItem('ecz-tema') || 'aydinlik');
    dil = localStorage.getItem('ecz-dil') || 'tr';
  } catch (e) {
    document.documentElement.setAttribute('data-tema', 'aydinlik');
  }
  document.documentElement.lang = dil;
  document.documentElement.dir = dil === 'fa' ? 'rtl' : 'ltr';
  document.documentElement.classList.add('js');
})();
