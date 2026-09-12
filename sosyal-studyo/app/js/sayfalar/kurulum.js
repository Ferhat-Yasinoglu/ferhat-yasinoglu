// Kanal kurulum rehberi: adım listesi, kopyala düğmeleri, onay kutuları; Telegram için "Webhook kur".
import { el, btn, kart, rozet, temizle, girdi, alan, sayfaBas } from '../cekirdek/dom.js';
import { KANALLAR } from '../paylasilan/kanallar.js';

const REHBER = {
  telegram: (ctx, worker) => [
    { b: 'BotFather\'da bot oluştur', a: 'Telegram\'da @BotFather\'a /newbot yaz; ad ve kullanıcı adı ver. Token\'ı kopyala (123456:AA…).' },
    { b: 'Token\'ı Worker secret\'ına yaz', a: 'Terminalde: npx wrangler secret put TELEGRAM_BOT_TOKEN — token tarayıcıdan girilmez, bu sayfaya yapıştırma.', kod: 'npx wrangler secret put TELEGRAM_BOT_TOKEN' },
    { b: 'Webhook\'u kur', a: 'Bağlı modda aşağıdaki düğme Worker\'a /api/kanal/telegram/kur çağrısı yapar (setWebhook + getWebhookInfo).', eylem: 'tg-kur' },
    { b: 'Botuna /start yaz', a: 'Sohbetler sayfasında görünmeli. PROVA modunda bot cevap yazmaz, karar günlüğe düşer.' },
    { b: 'Provadan canlıya al', a: 'Ayarlar → Kanallar → "Canlıya al" (CANLI yazarak onay).' },
  ],
  instagram: (ctx, worker) => [
    { b: 'Hesabı profesyonele çevir', a: 'Instagram ayarları → Hesap türü → İşletme ya da İçerik üreticisi. Kullanıcı adın ve gönderilerin değişmez.' },
    { b: 'Meta uygulaması oluştur', a: 'developers.facebook.com → Uygulama oluştur (Business) → Instagram ürünü ("API with Instagram Login").', link: 'https://developers.facebook.com/apps/' },
    { b: 'Kendini Instagram Tester yap', a: 'Uygulama rolleri → Instagram Testers → hesabını ekle; Instagram uygulamasında daveti kabul et.' },
    { b: 'Secret\'ları Worker\'a yaz', a: 'App Secret ve kendi uydurduğun verify token:', kod: 'npx wrangler secret put META_APP_SECRET\nnpx wrangler secret put META_VERIFY_TOKEN' },
    { b: 'Webhook adresini Meta\'ya yapıştır', a: 'Webhooks → Instagram → Callback URL ve Verify token; messages ve comments alanlarına abone ol.', kopya: worker ? `${worker}/meta/webhook` : '(Worker adresi ayarlanınca görünür)' },
    { b: 'Instagram ile giriş yap', a: 'Bağlı modda "Instagram\'a bağlan" düğmesi Business Login başlatır; token Worker\'da durur.', eylem: 'ig-baglan' },
    { b: 'Uygulamayı Live\'a al', a: 'Standard Access ile kendi hesabında çalışır; başka işletmeler için App Review gerekir.' },
    { b: 'Mesajlara erişime izin ver', a: 'Instagram uygulaması → Ayarlar → Mesajlar → Bağlı araçlar → Mesajlara erişime izin ver.' },
    { b: 'Yorum webhook\'u gelmiyorsa polling', a: 'Onaysız uygulamalarda yorum olayları gecikmeli gelir; Ayarlar → Kanallar\'da polling\'i aç (5 dk).' },
  ],
  whatsapp: (ctx, worker) => [
    { b: 'Meta uygulamasına WhatsApp ürünü ekle', a: 'Test numarası ve en fazla 5 doğrulanmış alıcıyla hemen dene.', link: 'https://developers.facebook.com/apps/' },
    { b: 'Secret\'ları Worker\'a yaz', a: 'Kalıcı token için sistem kullanıcısı oluştur; geçici token 24 saatte biter.', kod: 'npx wrangler secret put WA_ACCESS_TOKEN\nnpx wrangler secret put WA_PHONE_NUMBER_ID' },
    { b: 'Webhook', a: 'Aynı /meta/webhook adresi; messages alanı.', kopya: worker ? `${worker}/meta/webhook` : '(Worker adresi ayarlanınca görünür)' },
    { b: 'Şablon kuralı', a: '24 saat penceresi dışına yalnız onaylı şablonla mesaj gider ve ücretlidir. Toplu mesaj v1\'de PROVA + şablon adı alanı.' },
  ],
  tiktok: () => [
    { b: 'DM / yorum otomasyonu yok', a: 'TikTok\'un Business Messaging API\'si AB\'de yok; yorum otomasyonu hiçbir yerde açık değil. Bu yüzden Sosyal Stüdyo TikTok için içerik araçları sunar.' },
    { b: 'Ne yapabilirsin', a: 'Bio linkini Telegram/Instagram akışına yönlendir; kanca, senaryo ve karusel araçlarını kullan.' },
  ],
};

export default {
  baslik: 'Kurulum',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    const kanal = ctx.param.kanal;
    const b = KANALLAR[kanal];
    if (!b) { kok.appendChild(el('p', { class: 'durum-hata' }, 'Kanal yok')); return; }
    const a = await depo.ayarlar();
    const worker = a.worker?.adres?.replace(/\/$/, '') || '';
    const hesap = (await depo.listele('hesaplar')).find((h) => h.kanal === kanal && !h.demo);
    const ilerleme = a.kurulum?.[kanal] || {};
    const adimlar = (REHBER[kanal] || (() => []))(ctx, worker);
    const liste = el('div', { class: 'onay-listesi' });
    adimlar.forEach((s, i) => {
      const cb = el('input', { type: 'checkbox', checked: !!ilerleme[i], onchange: async (e) => { ilerleme[i] = e.target.checked; await depo.ayarKaydet('kurulum', { ...(a.kurulum || {}), [kanal]: ilerleme }); } });
      const govde = el('div', { style: { flex: 1 } }, el('strong', {}, `${i + 1}. ${s.b}`), el('div', { class: 'kart__alt' }, s.a));
      if (s.kod) govde.appendChild(el('div', { class: 'kopyala' }, s.kod, btn('⧉', { class: 'btn btn--kucuk', onclick: () => navigator.clipboard?.writeText(s.kod).then(() => ctx.basari(t('genel.kopyalandi', 'Kopyalandı'))) })));
      if (s.kopya) govde.appendChild(el('div', { class: 'kopyala' }, s.kopya, btn('⧉', { class: 'btn btn--kucuk', onclick: () => navigator.clipboard?.writeText(s.kopya).then(() => ctx.basari(t('genel.kopyalandi', 'Kopyalandı'))) })));
      if (s.link) govde.appendChild(el('a', { href: s.link, target: '_blank', rel: 'noopener' }, s.link));
      if (s.eylem === 'tg-kur') govde.appendChild(btn('🔗 ' + t('kurulum.webhook_kur', 'Webhook\'u kur'), { class: 'btn btn--kucuk btn--birincil', disabled: !worker, onclick: async () => { try { const r = await fetch(worker + '/api/kanal/telegram/kur', { method: 'POST', headers: { Authorization: 'Bearer ' + ((await depo.gizli('yonetici')) || ''), 'X-SS-Sema': '1' } }); const j = await r.json(); if (!j.ok) throw new Error(j.mesaj || r.status); await depo.kaydet('hesaplar', { ...(hesap || {}), kanal: 'telegram', ad: j.veri?.bot?.username ? '@' + j.veri.bot.username : 'Telegram botu', dis_id: j.veri?.bot?.username || '', durum: 'prova' }); ctx.basari(t('kurulum.webhook_ok', 'Webhook kuruldu: {u}', { u: j.veri?.webhook?.url || '' })); cb.checked = true; cb.onchange({ target: cb }); } catch (e) { ctx.hata(String(e.message || e)); } } }));
      if (s.eylem === 'ig-baglan') govde.appendChild(btn('📸 ' + t('kurulum.ig_baglan', 'Instagram\'a bağlan'), { class: 'btn btn--kucuk btn--birincil', disabled: !worker, onclick: () => { location.href = `${worker}/api/kanal/instagram/baglan?donus=${encodeURIComponent(location.href)}`; } }));
      liste.appendChild(el('label', {}, cb, govde));
    });
    kok.append(sayfaBas(`${b.simge} ${b.ad} ${t('kurulum.baslik', 'kurulumu')}`, { geri: () => git('/ayarlar/kanallar'), eylemler: [rozet(b.etiket.ad, b.etiket.renk)] }),
      el('p', { class: 'kart__alt' }, b.ozet), !worker && kanal !== 'tiktok' ? el('div', { class: 'bant bant--sari' }, '⚠️ ' + t('kurulum.worker_yok', 'Önce Worker\'ı bağla; kanal kurulumu Worker üzerinden yapılır.'), btn('Worker', { class: 'btn btn--kucuk', onclick: () => git('/ayarlar/worker') })) : null,
      liste,
      kanal !== 'tiktok' && !hesap ? btn(t('kurulum.hesap_kaydet', 'Bu kanalı PROVA olarak ekle (yerel)'), { class: 'btn', style: { marginTop: '12px' }, onclick: async () => { await depo.kaydet('hesaplar', { kanal, ad: b.ad, dis_id: '', durum: 'prova' }); ctx.basari(t('kurulum.eklendi', 'Hesap prova olarak eklendi')); git('/ayarlar/kanallar'); } }) : null);
  },
};
