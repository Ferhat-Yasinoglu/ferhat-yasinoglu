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

// IG token'ı hangi uygulamaya bağlı? Farklıysa webhook'u başka uygulama gönderiyor demektir.
const d = await fetch(`${G}/debug_token?input_token=${encodeURIComponent(process.env.IG_ACCESS_TOKEN || '')}&access_token=${encodeURIComponent(uygulamaBelirteci)}`);
const dj = await d.json().catch(() => ({}));
const veri = dj.data;
if (dj.error || !veri) { console.log(`  IG token'in uygulamasi sorulamadi: ${dj.error?.message || 'yanit bos'}`); process.exit(0); }
if (String(veri.app_id) === String(id)) console.log(`  IG token da ayni uygulamaya ait (app_id ${veri.app_id}).`);
else console.log(`  DIKKAT: IG token baska bir uygulamaya ait (app_id ${veri.app_id}), App Secret ise ${id}. Webhook'u o uygulama gonderiyor olabilir.`);
