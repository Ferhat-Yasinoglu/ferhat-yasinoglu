// Hesap sunucusunun adresi. Arayüzde adres kutusu YOK, bilerek: hekime
// "şu adresi yaz" diyen biri kendi sunucusuna kullanıcı adını ve parola
// doğrulayıcısını toplayabilirdi. Adres koda gömülü; değişmesi yeni bir sürüm
// ve CSP'de (index.html connect-src) aynı adres demek.
//
// Adres boşsa hesaplar kapalıdır: kart bunu dürüstçe söyler, dosya yedeği yol
// olarak kalır. Yerel geliştirmede (sayfa localhost'tan açıldıysa) API aynı
// kökendedir (sunucu/yerel.mjs uygulamayı ve /v1/'i birlikte sunar) ve bu,
// yayındaki adresten ÖNCE gelir: testler ve geliştirme gerçek sunucuya dokunmaz.

/** Yayındaki hesap sunucusu (.github/workflows/shafa-sunucu.yml dağıtır). */
export const VARSAYILAN_SUNUCU = 'https://shafa-sunucu.ferhatyasinoglu.workers.dev';

const YEREL = ['localhost', '127.0.0.1'];

/** Kullanılacak sunucu kökü; yoksa ''. `varsayilan` yalnız testler içindir. */
export function sunucuAdresi(konum = globalThis.location, varsayilan = VARSAYILAN_SUNUCU) {
  if (konum && YEREL.includes(konum.hostname)) return konum.origin;
  return varsayilan;
}
