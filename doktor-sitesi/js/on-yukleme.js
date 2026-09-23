// Senkron çalışır (modül değil, <head>'te engelleyici script): sayfa
// boyanmadan tema yerleşir, yanıp sönme olmaz. Dil/yön index.html'de sabit
// (lang="fa" dir="rtl") — site tek dilde, Farsça.
(function () {
  try {
    var tema = localStorage.getItem('ds-tema');
    if (tema) document.documentElement.setAttribute('data-theme', tema);
  } catch (e) {}
})();
