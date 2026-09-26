// Hekimlerin getirdiği tasarım görselindeki gerçek görünen veri: bir adres,
// iki iş yeri, bir ad ve bir telefon. Depo herkese açık; bunlar örnek veriye,
// sözlüğe, bir denemeye ya da tanıtım görüntüsüne sızmamalı. kontrol.mjs
// depodaki metin dosyalarını, gorsel-uret.mjs her görüntüden önce sayfanın
// yazısını bu listeyle tarıyor.
//
// TAM İFADE aranıyor, tek kelime değil: şehir adları (mazar, kunduz) zayıf
// parola listesinde meşru olarak geçiyor. İfadeler base64: listenin kendisi
// de o veriyi açık metin olarak taşımasın.
export const GERCEK_VERI = [
  'TWFsdG9u', 'RmFyaGFk', 'Um96YS1lIE11YmFyYWs=', 'TWF6YXItZS1TaGFyaWYgRGlhZ25vc3RpYw==', 'S3VuZHV6IFJlZ2lvbmFs',
  'MDc5MDAwMDAwMA==', '2YXYp9mE2KrZiNmG', '2LHZiNi22Ycg2YXYqNin2LHaqQ==', '2YHYsdmH2KfYrw==',
].map((b) => Buffer.from(b, 'base64').toString('utf8'));

/** Metinde geçen ifadeler (büyük-küçük harf duyarsız). */
export const gercekVeriBul = (metin) => GERCEK_VERI.filter((ifade) => String(metin).toLowerCase().includes(ifade.toLowerCase()));
