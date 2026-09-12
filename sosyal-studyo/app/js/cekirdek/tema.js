/* Senkron çalışır (modül değil): sayfa boyanmadan tema ve dil sınıfı yerleşir, yanıp sönme olmaz. */
(function () {
  try {
    var tema = localStorage.getItem('ss-tema');
    if (!tema) tema = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', tema);
    var dil = localStorage.getItem('ss-lang') || 'tr';
    document.documentElement.lang = dil;
    document.documentElement.dir = dil === 'fa' ? 'rtl' : 'ltr';
  } catch (e) { document.documentElement.setAttribute('data-theme', 'light'); }
  document.documentElement.classList.add('js');
})();
