// Sunucu adresi. Uygulama Cloudflare Pages'te, API Worker'da.
// Yerelde (npm run yerel) uygulama ve API aynı kökenden sunulur: adres boş kalır.
// Worker adresi değişirse index.html CSP connect-src de değişmeli (tools/kontrol.mjs denetler).
const YAYIN = 'https://fy-reklam-sunucu.ferhatyasinoglu.workers.dev';

const yerel = ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname);
export const SUNUCU = yerel ? '' : YAYIN;

/** Meta Business Suite: API'siz paylaşım ve zamanlama için (Instagram + Facebook tek yerden). */
export const BUSINESS_SUITE = 'https://business.facebook.com/latest/composer';

/** Instagram profili (gönderi metinlerinde «profildeki bağlantı» buraya çıkar). */
export const INSTAGRAM = 'https://instagram.com/farhad___yaqoobi';
