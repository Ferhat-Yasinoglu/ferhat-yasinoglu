// Hesap sunucusunun adresi. Arayüzde adres kutusu YOK, bilerek: hekime
// "şu adresi yaz" diyen biri kendi sunucusuna kullanıcı adını ve parola
// doğrulayıcısını toplayabilirdi. Adres koda gömülü; değişmesi yeni bir sürüm
// ve CSP'de (index.html connect-src) aynı adres demek.
//
// Boşken hesaplar kapalıdır: kart bunu dürüstçe söyler, dosya yedeği yol
// olarak kalır. Tek istisna yerel geliştirme: sayfa localhost'tan açılmışsa
// API aynı kökendedir (sunucu/yerel.mjs uygulamayı ve /v1/'i birlikte sunar).

/** Dağıtımdan sonra ayrı bir değişiklikle yazılacak (https://…workers.dev). */
export const VARSAYILAN_SUNUCU = '';

const YEREL = ['localhost', '127.0.0.1'];

/** Kullanılacak sunucu kökü; yoksa ''. */
export function sunucuAdresi(konum = globalThis.location) {
  if (VARSAYILAN_SUNUCU) return VARSAYILAN_SUNUCU;
  if (konum && YEREL.includes(konum.hostname)) return konum.origin;
  return '';
}
