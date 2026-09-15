// Meta panelindeki "Configure webhooks → Verify and save" düğmesinin API karşılığı.
//
// NEDEN: Meta'nın belgesi açık — "Bir saat boyunca teslimat başarısız olmaya devam ederse
// Webhooks Disabled uyarısı alırsınız ve uygulamanız o Instagram Profesyonel hesabının
// webhook'larından ÇIKARILIR. Sorunları düzelttikten sonra yeniden abone olmanız gerekir."
// Bizde tam bu oldu: iki teslimat yanlış app secret yüzünden reddedildi, Meta bir saat denedi,
// sonra aboneliği kapattı. Abonelik listede hâlâ "açık" görünüyordu; hiçbir uç bunu söylemedi.
//
// ÇARE (yine belgeden): "callback_url, verify_token ve object alanlarıyla POST isteği yapmak
// aboneliği YENİDEN ETKİNLEŞTİRİR." Meta bu çağrı sırasında adresi baştan doğruluyor
// (GET ...hub.mode=subscribe&hub.challenge=...) ve sonucu POST'un yanıtında bildiriyor.
//
// İki ayrı kayıt var, ikisi de gerekli:
//   1) UYGULAMA düzeyi: /{app-id}/subscriptions  → adres + alanlar + active bayrağı
//   2) HESAP düzeyi:    /me/subscribed_apps      → hesabın hangi uygulamaya bağlı olduğu
// Hesabı tazelemek uygulama aboneliğinin active bayrağını açmıyor; bu yüzden ikisi de yapılır.
//
// Gizli değerlerin hiçbiri (app secret, verify token, erişim belirteci) çıktıya yazılmaz.
const G = 'https://graph.facebook.com/v26.0';
const IG = 'https://graph.instagram.com/v26.0';

// Panelin Instagram Login akışında öntanımlı olarak abone ettiği alanların tamamı.
// POST'un birleştirme mi değiştirme mi yaptığı Meta tarafından belgelenmemiş; tam listeyi
// göndermek iki durumda da doğru sonucu veriyor.
const ALANLAR = (process.env.IG_ALANLAR
  || 'comments,live_comments,message_reactions,messages,messaging_optins,messaging_postbacks,messaging_referral,messaging_seen').trim();

const appId = (process.env.META_APP_ID || '').trim();
const appSecret = (process.env.META_APP_SECRET || '').trim();
const verifyToken = (process.env.META_VERIFY_TOKEN || '').trim();
const callback = (process.env.CALLBACK_URL || '').trim();
const nesne = (process.env.META_NESNE || 'instagram').trim();

const eksik = [];
if (!appId) eksik.push('META_APP_ID (GitHub → Variables)');
if (!appSecret) eksik.push('META_APP_SECRET (GitHub → Secrets)');
if (!verifyToken) eksik.push('META_VERIFY_TOKEN (GitHub → Secrets)');
if (!callback) eksik.push('CALLBACK_URL');
if (eksik.length) { console.log(`::error::eksik: ${eksik.join(', ')}`); process.exit(1); }

const uygulamaBelirteci = `${appId}|${appSecret}`;
const jsonAl = async (r) => { try { return await r.json(); } catch { return {}; } };

// 1) App Secret gerçekten bu uygulamaya mı ait? Değilse sonraki her adım yanıltıcı olur.
const kim = await jsonAl(await fetch(`${G}/${appId}?fields=id,name&access_token=${encodeURIComponent(uygulamaBelirteci)}`));
if (kim.error) { console.log(`::error::App ID ile App Secret eslesmiyor: ${kim.error.message}`); process.exit(1); }
console.log(`uygulama: "${kim.name}" (id ${kim.id})`);

const abonelikleriOku = async () => jsonAl(await fetch(`${G}/${appId}/subscriptions?access_token=${encodeURIComponent(uygulamaBelirteci)}`));
const yazAbonelik = (etiket, j) => {
  if (j?.error) { console.log(`  ${etiket}: sorulamadi — ${j.error.message}`); return null; }
  const kayit = (j?.data || []).find((k) => k.object === nesne);
  if (!kayit) { console.log(`  ${etiket}: ${nesne} aboneligi yok`); return null; }
  const alan = (kayit.fields || []).map((f) => (typeof f === 'string' ? f : f.name));
  console.log(`  ${etiket}: active=${kayit.active} alanlar=[${alan.join(', ')}] adres=${kayit.callback_url || '(yok)'}`);
  return { kayit, alan };
};

const once = await abonelikleriOku();
yazAbonelik('once ', once);

// 2) Yeniden kur. Parametreler form gövdesinde gider: "|" ve "://" bir sorgu dizesinde
//    bazı ara katmanlarca bozulabiliyor ve bu, sahte "callback verification failed" üretiyor.
const govde = new URLSearchParams({
  object: nesne,
  callback_url: callback,
  fields: ALANLAR,
  verify_token: verifyToken,
  access_token: uygulamaBelirteci,
});
const kur = await jsonAl(await fetch(`${G}/${appId}/subscriptions`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: govde,
}));
if (kur.error) {
  const e = kur.error;
  console.log(`::error::abonelik kurulamadi: ${e.message} [tip=${e.type || '?'} kod=${e.code || '?'} alt=${e.error_subcode || '-'}]`);
  if (/verif|callback|url/i.test(String(e.message || ''))) {
    console.log('  -> Meta adresi dogrulayamadi. Worker ayakta olmali ve GET /meta/webhook,');
    console.log('     hub.verify_token META_VERIFY_TOKEN ile esitse hub.challenge\'i ham metin olarak 200 ile dondurmeli.');
  }
  process.exit(1);
}
console.log(`POST /subscriptions: ${JSON.stringify(kur)}`);

// 3) Okuma tarafı bilgilendirme amaçlı — başarının ölçütü DEĞİL.
//    /{app-id}/subscriptions'ın belgelenmiş nesne listesi {user, page, permissions, payments};
//    "instagram" orada yok ve listeleme onu döndürmeyebiliyor. Asıl kanıt POST'un yanıtı:
//    Meta {"success":true} ancak adresi GET ile doğrulayıp hub.challenge'ı geri aldıysa dönüyor.
const sonra = await abonelikleriOku();
const s = yazAbonelik('sonra', sonra);
if (!s) console.log('  (listeleme bu uc noktada instagram\'i dondurmuyor olabilir; POST success:true asil kanit)');
else {
  if (!s.alan.includes('messages')) console.log('::warning::listede messages alani gorunmuyor');
  if (s.kayit.active === false) console.log('::warning::listede abonelik pasif gorunuyor (active=false)');
  if (s.kayit.callback_url && s.kayit.callback_url !== callback) console.log(`::warning::kayitli adres beklenenden farkli: ${s.kayit.callback_url}`);
}

// 4) Hesap bağı — ayrı bir kayıt. Hangi uygulamaya yazıldığını da okumak gerekiyor:
//    POST "success" dönüp bağı başka bir uygulama kimliğine yazan bir platform hatası biliniyor.
const igToken = process.env.IG_ACCESS_TOKEN;
if (!igToken) { console.log('  hesap bagi: IG_ACCESS_TOKEN yok, atlandi'); }
else {
  const igBasliklar = { Authorization: `Bearer ${igToken}` };
  const bagOku = async () => jsonAl(await fetch(`${IG}/me/subscribed_apps`, { headers: igBasliklar }));
  const bagKur = async () => jsonAl(await fetch(`${IG}/me/subscribed_apps?subscribed_fields=${encodeURIComponent(ALANLAR)}`, { method: 'POST', headers: igBasliklar }));

  let bag = await bagKur();
  if (bag.error) console.log(`  hesap bagi kurulamadi: ${bag.error.message}`);
  else console.log(`  hesap bagi POST: ${JSON.stringify(bag)}`);

  const bagDurum = await bagOku();
  if (bagDurum.error) { console.log(`  hesap bagi sorulamadi: ${bagDurum.error.message}`); }
  else {
    const kayitlar = bagDurum.data || [];
    for (const k of kayitlar) console.log(`  hesap bagi: uygulama=${k.id || '?'} "${k.name || ''}" alanlar=[${(k.subscribed_fields || []).join(', ')}]`);
    const yabanci = kayitlar.filter((k) => k.id && String(k.id) !== String(appId));
    if (yabanci.length) console.log(`::warning::hesap bagi baska bir uygulamaya yazilmis (${yabanci.map((k) => k.id).join(', ')}); DM gelmeyebilir`);
    if (!kayitlar.length) console.log('::warning::hesap bagi bos gorunuyor');
  }
}

console.log('Abonelik yeniden kuruldu. Meta success:true dondu — yani adresi GET ile dogruladi ve hub.challenge geri alindi.');
