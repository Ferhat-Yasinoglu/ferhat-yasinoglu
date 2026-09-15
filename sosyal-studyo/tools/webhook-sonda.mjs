// Webhook ucunu kendi imzamızla yoklar.
//
// "Meta hiç uğramadı" ile "uğradı ama imza tutmadı" ayrımını damga çözüyor. Geriye bir soru
// kalıyor: Worker'daki META_APP_SECRET, GitHub'daki değerle aynı mı? Dağıtım zinciri sessizce
// bozuksa (yanlış ortam, eski dağıtım, yazılmamış secret) Meta'ya bakarak bunu anlamak imkânsız.
//
// Bu sonda GitHub'daki secret ile geçerli bir X-Hub-Signature-256 üretip uca gönderir:
//   200 → Cloudflare'deki değer GitHub'dakiyle AYNI; kalan sorun Meta tarafında (teslimat).
//   401 → İkisi farklı; dağıtım zincirinde sorun var, Meta'yı suçlamak yanlış olur.
//
// Gövde bilerek {"object":"sonda"}: imza doğrulamasından geçer ama olaylaraCevir hiçbir olay
// üretmez, yani kişi/sohbet/mesaj kaydı oluşmaz. Kabul damgasına "sonda" yazılır; gerçek bir
// Instagram teslimatı "instagram" yazacağı için ikisi karışmaz.
const url = process.env.URL;
const gizli = process.env.META_APP_SECRET;
if (!url) { console.log('::error::URL yok'); process.exit(1); }
if (!gizli) { console.log('META_APP_SECRET verilmemis; sonda atlandi'); process.exit(0); }

const ham = JSON.stringify({ object: 'sonda', entry: [] });
const enc = new TextEncoder();
const anahtar = await crypto.subtle.importKey('raw', enc.encode(gizli), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const imza = await crypto.subtle.sign('HMAC', anahtar, enc.encode(ham));
const hex = [...new Uint8Array(imza)].map((b) => b.toString(16).padStart(2, '0')).join('');

const r = await fetch(`${url}/meta/webhook`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': `sha256=${hex}` },
  body: ham,
});
const metin = (await r.text()).slice(0, 100);
// Durum kodu artık ayırt etmiyor: Worker, Meta'nın aboneliği kapatmaması için yanlış imzaya da
// 200 dönüyor. Ayrımı X-SS-Imza başlığı taşıyor. (Bu sonda bir süre 401'e bakıyordu ve Worker
// 200 dönmeye başlayınca koşulsuz "AYNI" yazar hale gelmişti — yani yanlış bilgi veriyordu.)
const imzaDurumu = r.headers.get('X-SS-Imza');

if (r.status !== 200) {
  console.log(`  beklenmeyen yanit: ${r.status} ${metin}`);
  process.exit(1);
}
if (imzaDurumu === 'gecerli') {
  console.log('  gecerli → Cloudflare\'deki secret, GitHub\'daki degerle AYNI.');
  console.log('  Worker dogru imzali istegi kabul ediyor; teslimat gelmiyorsa sorun Meta tarafinda.');
} else if (imzaDurumu === 'gecersiz') {
  console.log('  gecersiz → Cloudflare\'deki secret GitHub\'dakinden FARKLI.');
  console.log('  Dagitim zinciri secret\'i tasimamis: Worker dagitimini yeniden calistir.');
  process.exit(1);
} else {
  console.log(`  X-SS-Imza basligi yok (yanit: ${metin}). Worker eski surumde olabilir —`);
  console.log('  bu sonda yalnizca yeni surumle anlamli sonuc verir; dagitimi yenile.');
  process.exit(1);
}
