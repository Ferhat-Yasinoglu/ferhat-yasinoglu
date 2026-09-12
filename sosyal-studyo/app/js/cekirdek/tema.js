/* Senkron çalışır (modül değil): sayfa boyanmadan tema ve dil sınıfı yerleşir, yanıp sönme olmaz.
   Marka gece temalı (altın üstü siyah): varsayılan her zaman koyu. Aydınlık tema
   yalnız kullanıcı üst çubuktan seçerse açılır; seçim localStorage'da kalır. */
(function () {
  try {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('ss-tema') || 'dark');
    var dil = localStorage.getItem('ss-lang') || 'tr';
    document.documentElement.lang = dil;
    document.documentElement.dir = dil === 'fa' ? 'rtl' : 'ltr';
  } catch (e) { document.documentElement.setAttribute('data-theme', 'dark'); }
  document.documentElement.classList.add('js');
})();
