// META_APP_SECRET'ın hangi uygulamaya ait olduğunu söyler.
//
// Damga "Meta uğradı ama imza tutmadı" diyor, sonda ise Cloudflare'deki değerin GitHub'daki
// değerle aynı olduğunu kanıtlıyor. Geriye tek açıklama kalıyor: elimizdeki secret, webhook'u
// gönderen uygulamanın secret'ı değil — Meta hesabında birden fazla uygulama varsa kolayca olur
// ve hiçbir hata mesajı bunu söylemez.
//
// Uygulama erişim belirteci "<app_id>|<app_secret>" biçiminde. Çift geçerliyse Meta uygulamanın
// adını döner; geçersizse kimlik ve secret aynı uygulamaya ait değildir. Ne app secret ne de
// belirteç çıktıya yazılır.
const G = 'https://graph.facebook.com/v26.0';
const id = (process.env.META_APP_ID || '').trim();
const gizli = (process.env.META_APP_SECRET || '').trim();

if (!id) { console.log('  META_APP_ID verilmemis; uygulama kimligi dogrulanamadi'); process.exit(0); }
if (!gizli) { console.log('  META_APP_SECRET verilmemis'); process.exit(0); }

const uygulamaBelirteci = `${id}|${gizli}`;
const r = await fetch(`${G}/${id}?fields=id,name&access_token=${encodeURIComponent(uygulamaBelirteci)}`);
const j = await r.json().catch(() => ({}));

if (j.error) {
  console.log(`  ESLESMIYOR: App ID ${id} ile elimizdeki App Secret ayni uygulamaya ait degil.`);
  console.log(`  Meta: ${j.error.message} [tip=${j.error.type || '?'} kod=${j.error.code || '?'}]`);
  console.log('  -> App settings > Basic sayfasini WEBHOOK\'U KURDUGUN uygulamada ac ve App secret\'i oradan kopyala.');
  process.exit(1);
}

console.log(`  ESLESIYOR: App Secret, "${j.name}" (id ${j.id}) uygulamasina ait.`);

// IG token'ın hangi uygulamaya bağlı olduğu VE hangi izinleri taşıdığı.
// İzin listesi kritik: instagram_business_manage_messages yoksa ne konuşmalar okunabiliyor
// ne de Meta "messages" webhook'u gönderiyor — ikisi aynı izne bağlı.
// debug_token bazen geçici olarak "Service temporarily unavailable" dönüyor; bir kez yeniden denenir.
async function belirteciCoz() {
  for (let deneme = 0; deneme < 2; deneme++) {
    const d = await fetch(`${G}/debug_token?input_token=${encodeURIComponent(process.env.IG_ACCESS_TOKEN || '')}&access_token=${encodeURIComponent(uygulamaBelirteci)}`);
    const dj = await d.json().catch(() => ({}));
    if (dj.data) return dj.data;
    if (deneme === 0 && /temporarily/i.test(String(dj.error?.message || ''))) continue;
    return { hata: dj.error?.message || 'yanit bos' };
  }
  return { hata: 'iki denemede de yanit alinamadi' };
}

const veri = await belirteciCoz();
if (veri.hata) { console.log(`  IG token cozulemedi: ${veri.hata}`); process.exit(0); }

if (String(veri.app_id) === String(id)) console.log(`  IG token da ayni uygulamaya ait (app_id ${veri.app_id}).`);
else console.log(`  IG token app_id=${veri.app_id} (Instagram App ID, Meta App ID'den farkli olmasi normal).`);

const izinler = veri.scopes || [];
console.log(`  token izinleri: ${izinler.length ? izinler.join(', ') : '(bildirilmedi)'}`);
if (veri.expires_at) console.log(`  token bitis: ${new Date(veri.expires_at * 1000).toISOString().slice(0, 19)}`);
if (veri.is_valid === false) console.log('::error::token gecersiz gorunuyor');

const MESAJ_IZNI = 'instagram_business_manage_messages';
if (izinler.length && !izinler.includes(MESAJ_IZNI)) {
  console.log(`::error::${MESAJ_IZNI} izni YOK. Bu izin olmadan ne konusmalar okunabilir ne de Meta messages webhook'u gonderir.`);
  console.log('  -> Instagram hesabinin uygulamaya verdigi izinler yenilenmeli: token yeniden uretilirken');
  console.log('     mesajlasma izni de istenmeli (Meta panel > Instagram > API setup with Instagram login).');
}
