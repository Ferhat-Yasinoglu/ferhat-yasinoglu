// Instagram'a doğrudan sorar: DM'ler hesapta var mı?
//
// Webhook teslimatı sessizce durduğunda iki ihtimal kalıyor ve bunlar bambaşka işler:
//   (a) Mesajlar hesapta var, Meta bize göndermiyor  → teslimat/izin sorunu
//   (b) Mesajlar API'den de görünmüyor               → hesap/izin/kapsam sorunu
// Konuşma listesi bu ikisini ayırıyor. Ayrıca kaçırılan mesajlar burada duruyor: Meta
// teslim edilemeyen olayları ~36 saat sonra düşürüyor ve yeniden abone olunca geri
// göndermiyor, yani tek telafi yolu bu uç nokta.
//
// Gizlilik: mesaj metni ve kişi adı YAZILMAZ. Yalnız sayı, zaman ve kimlik yazılır —
// teşhis için yeterli, günlükler için güvenli.
const IG = 'https://graph.instagram.com/v26.0';
const token = process.env.IG_ACCESS_TOKEN;
if (!token) { console.log('::error::IG_ACCESS_TOKEN yok'); process.exit(1); }
const basliklar = { Authorization: `Bearer ${token}` };
const al = async (yol) => {
  const r = await fetch(`${IG}/${yol}`, { headers: basliklar });
  const j = await r.json().catch(() => ({}));
  return { durum: r.status, ...j };
};

const kim = await al('me?fields=id,username,account_type');
if (kim.error) { console.log(`::error::token gecersiz: ${kim.error.message}`); process.exit(1); }
console.log(`hesap: @${kim.username} (${kim.account_type || '?'})`);

const k = await al('conversations?fields=id,updated_time&limit=10');
if (k.error) {
  const e = k.error;
  console.log(`  konusmalar SORULAMADI: ${e.message} [kod=${e.code || '?'} alt=${e.error_subcode || '-'}]`);
  if (String(e.code) === '10' || /permission|scope/i.test(String(e.message))) {
    console.log('  -> Bu bir IZIN sorunu: uygulamanin mesaj kapsami verilmemis ya da dusurulmus.');
  }
  process.exit(1);
}
const konusmalar = k.data || [];
console.log(`  konusma sayisi: ${konusmalar.length}`);
if (!konusmalar.length) {
  console.log('  -> Hesapta hic konusma gorunmuyor. Mesajlar Instagram tarafinda da yok sayiliyor:');
  console.log('     hesabin "Baglantili araclar > Mesajlara erisime izin ver" ayari kapali olabilir.');
  process.exit(0);
}

let enSonMesaj = null;
for (const c of konusmalar.slice(0, 3)) {
  const m = await al(`${c.id}?fields=messages.limit(5){id,created_time,from}`);
  if (m.error) { console.log(`  ${c.id}: mesajlar sorulamadi — ${m.error.message}`); continue; }
  const mesajlar = m.messages?.data || [];
  const zamanlar = mesajlar.map((x) => (x.created_time || '').slice(0, 19)).join(', ');
  console.log(`  konusma ${c.id}: ${mesajlar.length} mesaj  son guncelleme=${(c.updated_time || '').slice(0, 19)}`);
  if (zamanlar) console.log(`    mesaj zamanlari: ${zamanlar}`);
  for (const x of mesajlar) {
    const g = x.from?.id ? String(x.from.id) : '';
    if (g && g !== String(kim.id) && !enSonMesaj) enSonMesaj = { konusma: c.id, gonderen: g, zaman: x.created_time };
  }
}

if (enSonMesaj) {
  console.log(`  -> Mesajlar Instagram tarafinda VAR (son karsi taraf ${enSonMesaj.gonderen}, ${String(enSonMesaj.zaman).slice(0, 19)}).`);
  console.log('     Demek ki hesap ve izinler calisiyor; sorun yalnizca webhook TESLIMATINDA.');
} else {
  console.log('  -> Konusma var ama karsi taraftan mesaj gorunmuyor.');
}
