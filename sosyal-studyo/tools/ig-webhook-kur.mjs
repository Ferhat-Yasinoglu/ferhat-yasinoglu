// Meta panelindeki "Configure webhooks → Verify and save" düğmesinin API karşılığı.
//
// Neden gerekli: Meta, ısrarla hata dönen bir geri çağırma adresini arızalı sayıp teslimatı
// durduruyor. Abonelik listede "açık" görünmeye devam ediyor (me/subscribed_apps hâlâ
// "messages" diyor) ama tek bir olay gelmiyor ve bunu hiçbir uç noktada yazmıyor.
// Hesap aboneliğini tazelemek (me/subscribed_apps) bu durumu açmıyor; açan şey aboneliği
// UYGULAMA düzeyinde yeniden kurmak: Meta o zaman adresi baştan doğruluyor
// (GET ...?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...) ve doğrulama geçerse
// arıza işareti kalkıyor.
//
// Gizli değerlerin hiçbiri (app secret, verify token, erişim belirteci) çıktıya yazılmaz.
const G = 'https://graph.facebook.com/v26.0';
const IG = 'https://graph.instagram.com/v26.0';

const appId = (process.env.META_APP_ID || '').trim();
const appSecret = (process.env.META_APP_SECRET || '').trim();
const verifyToken = (process.env.META_VERIFY_TOKEN || '').trim();
const callback = (process.env.CALLBACK_URL || '').trim();
const alanlar = (process.env.IG_ALANLAR || 'messages').trim();
const nesne = (process.env.META_NESNE || 'instagram').trim();

const eksik = [];
if (!appId) eksik.push('META_APP_ID (GitHub → Variables)');
if (!appSecret) eksik.push('META_APP_SECRET (GitHub → Secrets)');
if (!verifyToken) eksik.push('META_VERIFY_TOKEN (GitHub → Secrets)');
if (!callback) eksik.push('CALLBACK_URL');
if (eksik.length) { console.log(`::error::eksik: ${eksik.join(', ')}`); process.exit(1); }

const uygulamaBelirteci = `${appId}|${appSecret}`;

async function cagir(url, method = 'GET') {
  const r = await fetch(url, { method });
  const j = await r.json().catch(() => ({}));
  return { durum: r.status, govde: j };
}

// 1) App Secret gerçekten bu uygulamaya mı ait? Değilse sonraki adımlar yanıltıcı olur.
const kim = await cagir(`${G}/${appId}?fields=id,name&access_token=${encodeURIComponent(uygulamaBelirteci)}`);
if (kim.govde?.error) {
  console.log(`::error::App ID ile App Secret eslesmiyor: ${kim.govde.error.message}`);
  process.exit(1);
}
console.log(`uygulama: "${kim.govde.name}" (id ${kim.govde.id})`);

// 2) Mevcut abonelikler — öncesini görelim ki değişimi okuyabilelim.
const once = await cagir(`${G}/${appId}/subscriptions?access_token=${encodeURIComponent(uygulamaBelirteci)}`);
const yaz = (etiket, j) => {
  if (j?.error) { console.log(`  ${etiket}: sorulamadi — ${j.error.message}`); return; }
  const kayitlar = j?.data || [];
  if (!kayitlar.length) { console.log(`  ${etiket}: abonelik yok`); return; }
  for (const k of kayitlar) {
    const alan = (k.fields || []).map((f) => (typeof f === 'string' ? f : f.name)).join(', ');
    console.log(`  ${etiket}: object=${k.object} aktif=${k.active} alanlar=[${alan}] adres=${k.callback_url || '(yok)'}`);
  }
};
yaz('once', once.govde);

// 3) Aboneliği yeniden kur. Meta bu çağrıda adresi GET ile doğrular; Worker hub.challenge'ı
//    META_VERIFY_TOKEN eşleşirse geri döndürüyor, yoksa 403 veriyor ve bu adım hata verir.
const kurUrl = new URL(`${G}/${appId}/subscriptions`);
kurUrl.searchParams.set('object', nesne);
kurUrl.searchParams.set('callback_url', callback);
kurUrl.searchParams.set('fields', alanlar);
kurUrl.searchParams.set('verify_token', verifyToken);
kurUrl.searchParams.set('access_token', uygulamaBelirteci);

const kur = await cagir(kurUrl.toString(), 'POST');
if (kur.govde?.error) {
  const e = kur.govde.error;
  console.log(`::error::abonelik kurulamadi: ${e.message} [tip=${e.type || '?'} kod=${e.code || '?'} alt=${e.error_subcode || '-'}]`);
  if (String(e.message || '').toLowerCase().includes('verify')) {
    console.log('  -> Meta adresi dogrulayamadi: META_VERIFY_TOKEN Worker\'daki degerle ayni olmali ve Worker ayakta olmali.');
  }
  process.exit(1);
}
console.log(`POST /subscriptions: ${JSON.stringify(kur.govde)}`);

// 4) Sonrasını oku — adres ve alanlar gerçekten yazılmış mı?
const sonra = await cagir(`${G}/${appId}/subscriptions?access_token=${encodeURIComponent(uygulamaBelirteci)}`);
yaz('sonra', sonra.govde);

const ilgili = (sonra.govde?.data || []).find((k) => k.object === nesne);
if (!ilgili) { console.log(`::error::${nesne} aboneligi kayitlarda gorunmuyor`); process.exit(1); }
const kayitliAlanlar = (ilgili.fields || []).map((f) => (typeof f === 'string' ? f : f.name));
if (!kayitliAlanlar.includes('messages')) { console.log('::error::messages alani abonelikte yok; DM gelmez'); process.exit(1); }
if (ilgili.callback_url && ilgili.callback_url !== callback) console.log(`::warning::kayitli adres beklenenden farkli: ${ilgili.callback_url}`);
if (ilgili.active === false) console.log('::warning::abonelik pasif gorunuyor');

// 5) Hesabı da uygulamaya bağla (ayrı bir kayıt; uygulama aboneliği bunu kapsamıyor).
if (process.env.IG_ACCESS_TOKEN) {
  const hesap = await fetch(`${IG}/me/subscribed_apps?subscribed_fields=${encodeURIComponent(alanlar)}`, {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.IG_ACCESS_TOKEN}` },
  }).then((r) => r.json()).catch(() => ({}));
  console.log(hesap?.error ? `  hesap baglama: ${hesap.error.message}` : `  hesap baglama: ${JSON.stringify(hesap)}`);
}

console.log('Abonelik uygulama duzeyinde yeniden kuruldu ve adres Meta tarafindan dogrulandi.');
