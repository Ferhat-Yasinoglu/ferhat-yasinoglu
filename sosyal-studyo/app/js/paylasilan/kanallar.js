// Kanal yetenekleri ve dürüst etiketler. UI'da kartların üstünde görünür; ürün
// sözü Meta/Telegram/TikTok'un gerçek kurallarına bağlıdır.
// Etiketler: CALISIR · ONAY_GEREKIR · IZIN_YOK · PROVA
export const ETIKET = {
  CALISIR: { kod: 'calisir', ad: 'Çalışır', renk: 'yesil' },
  ONAY_GEREKIR: { kod: 'onay', ad: 'Meta onayı gerekir', renk: 'sari' },
  IZIN_YOK: { kod: 'izin-yok', ad: 'Platform izin vermiyor', renk: 'kirmizi' },
  PROVA: { kod: 'prova', ad: 'Prova', renk: 'mavi' },
};

export const KANALLAR = {
  telegram: {
    ad: 'Telegram', simge: '✈️', kurulum_dk: 5, etiket: ETIKET.CALISIR,
    ozet: 'BotFather token\'ı ile dakikalar içinde; webhook, akışlar ve gerçek toplu mesaj çalışır.',
    yetenekler: {
      dm: ETIKET.CALISIR, butonlar: ETIKET.CALISIR, toplu: ETIKET.CALISIR, gecikme: ETIKET.CALISIR,
      yorum: ETIKET.IZIN_YOK, story: ETIKET.IZIN_YOK, referans: ETIKET.CALISIR, ai_ajan: ETIKET.CALISIR,
    },
    sinirlar: { pencere_saat: null, mesaj_sn: 30 },
  },
  instagram: {
    ad: 'Instagram', simge: '📸', kurulum_dk: 60, etiket: ETIKET.CALISIR,
    ozet: 'Kendi profesyonel hesabın: DM, yorum→DM, yoruma yanıt, gizleme. Yorum webhook\'u onaysız gecikmeli (polling) çalışır.',
    yetenekler: {
      dm: ETIKET.CALISIR, butonlar: ETIKET.CALISIR, toplu: ETIKET.IZIN_YOK, gecikme: ETIKET.CALISIR,
      yorum: ETIKET.CALISIR, yorum_webhook: ETIKET.ONAY_GEREKIR, story: ETIKET.CALISIR,
      referans: ETIKET.CALISIR, ai_ajan: ETIKET.CALISIR, baska_hesaplar: ETIKET.ONAY_GEREKIR,
    },
    sinirlar: { pencere_saat: 24, buton: 3, etiket_kr: 20, metin_kr: 1000, yorum_gunluk: 150 },
  },
  whatsapp: {
    ad: 'WhatsApp', simge: '💬', kurulum_dk: 60, etiket: ETIKET.CALISIR,
    ozet: 'Cloud API test numarasıyla hemen; toplu mesaj yalnız onaylı şablonla ve ücretli.',
    yetenekler: {
      dm: ETIKET.CALISIR, butonlar: ETIKET.CALISIR, toplu: ETIKET.ONAY_GEREKIR, gecikme: ETIKET.CALISIR,
      yorum: ETIKET.IZIN_YOK, story: ETIKET.IZIN_YOK, referans: ETIKET.IZIN_YOK, ai_ajan: ETIKET.CALISIR,
    },
    sinirlar: { pencere_saat: 24, buton: 3 },
  },
  tiktok: {
    ad: 'TikTok', simge: '🎵', kurulum_dk: 0, etiket: ETIKET.IZIN_YOK,
    ozet: 'DM/yorum otomasyonu için API yok; yalnız içerik araçları (fikir, kanca, senaryo, karusel).',
    yetenekler: { dm: ETIKET.IZIN_YOK, yorum: ETIKET.IZIN_YOK, toplu: ETIKET.IZIN_YOK, icerik: ETIKET.CALISIR },
    sinirlar: {},
  },
};

/** Kişinin 24 saat penceresi açık mı (Telegram'da hep açık, kişi engellemediyse). */
export function pencereAcik(kisi, simdi = Date.now()) {
  const k = KANALLAR[kisi.kanal];
  if (!k) return false;
  if (kisi.engelli) return false;
  if (!k.sinirlar.pencere_saat) return true;
  if (!kisi.son_gelen) return false;
  return simdi - Date.parse(kisi.son_gelen) < k.sinirlar.pencere_saat * 3600 * 1000;
}

/** Pencerenin kapanmasına kalan süre (saat, ondalık) ya da null (sınırsız). */
export function pencereKalan(kisi, simdi = Date.now()) {
  const k = KANALLAR[kisi.kanal];
  if (!k || !k.sinirlar.pencere_saat) return null;
  if (!kisi.son_gelen) return 0;
  return Math.max(0, k.sinirlar.pencere_saat - (simdi - Date.parse(kisi.son_gelen)) / 3600000);
}
