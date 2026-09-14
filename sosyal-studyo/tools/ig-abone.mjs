// Instagram webhook aboneliğini yeniden kurar.
//
// Meta, sürekli hata dönen bir geri çağırma adresine göndermeyi kesiyor. Worker uzun süre
// her teslimata 401 döndüyse (yanlış META_APP_SECRET) abonelik kaydı "açık" görünmeye devam
// ediyor ama Meta artık uğramıyor — ve bunu hiçbir yerde yazmıyor. Secret düzeltildikten
// sonra aboneliği bir kez yeniden POST etmek teslimatı yeniden başlatıyor.
//
// Yalnız hâlihazırda abone olunan alanı yeniden bildirir; yeni izin istemez, alan eklemez.
// IG_ACCESS_TOKEN isteğe Authorization başlığıyla gider, hiçbir çıktıya yazılmaz.
const KONAK = 'https://graph.instagram.com/v26.0';
const ALANLAR = process.env.IG_ALANLAR || 'messages';

async function iste(yol, method = 'GET') {
  const r = await fetch(`${KONAK}/${yol}`, { method, headers: { Authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}` } });
  const j = await r.json().catch(() => ({}));
  return { durum: r.status, govde: j };
}

const alanlariYaz = (j) => {
  const kayitlar = j?.data || [];
  if (!kayitlar.length) return 'abonelik yok';
  const alanlar = kayitlar.flatMap((k) => k.subscribed_fields || []);
  return alanlar.length ? alanlar.join(', ') : '(alan bildirilmedi)';
};

const token = process.env.IG_ACCESS_TOKEN;
if (!token) { console.log('::error::IG_ACCESS_TOKEN yok; abonelik kurulamaz'); process.exit(1); }

const kim = await iste('me?fields=id,username');
if (kim.govde?.error) { console.log(`::error::token gecersiz: ${kim.govde.error.message}`); process.exit(1); }
console.log(`hesap: @${kim.govde.username} (id ${kim.govde.id})`);

const once = await iste('me/subscribed_apps');
console.log(`once : ${once.govde?.error ? 'sorulamadi: ' + once.govde.error.message : alanlariYaz(once.govde)}`);

const kur = await iste(`me/subscribed_apps?subscribed_fields=${encodeURIComponent(ALANLAR)}`, 'POST');
if (kur.govde?.error) { console.log(`::error::abonelik kurulamadi: ${kur.govde.error.message} [kod=${kur.govde.error.code ?? '?'}]`); process.exit(1); }
console.log(`POST : ${JSON.stringify(kur.govde)}`);

const sonra = await iste('me/subscribed_apps');
const alanlar = sonra.govde?.error ? '' : alanlariYaz(sonra.govde);
console.log(`sonra: ${sonra.govde?.error ? 'sorulamadi: ' + sonra.govde.error.message : alanlar}`);

if (!alanlar.includes('messages')) { console.log('::error::messages alani abonelikte gorunmuyor; DM gelmez'); process.exit(1); }
console.log('Abonelik yeniden kuruldu. Simdi baska bir hesaptan DM at ve doktoru calistir.');
