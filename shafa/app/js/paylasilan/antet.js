// Reçete antedinin alanları. Tek liste, iki kullanıcı: Ayarlar'daki form
// onları bu sırayla çizer; hesap değişimi sorusu (senkron/hesap-servisi.js)
// cihazdaki antedin hekimin kendi yazdığı bir şey olup olmadığına — yani
// başka bir hesaba sessizce gitmemesi gereken kişisel bilgi olup olmadığına —
// bunlarla bakar. Liste iki yerde dursaydı yeni bir alan (ör. ikinci telefon)
// soruya girmeden başka bir hekimin hesabına akabilirdi.
//
// Saf veri: etiketler Türkçe karşılıktır, sözlükteki anahtar 'ayar.<alan>'.

/** Antet alanları: [anahtar, Türkçe etiket, ipucu, çokSatır?]
 *  Sıra kâğıttaki sırayla aynı: ad, ünvan, slogan, hizmetler, sabıka, iletişim. */
export const ANTET_ALANLARI = [
  ['doktorUnvan', 'Ünvan', 'الحاج داکتر · Dr.'],
  ['doktorAd', 'Doktor adı', 'Antetin en üstünde, büyük punto'],
  ['doktorAdAlt', 'İkinci satır', 'Örneğin aynı adın Latin harfleriyle yazılışı'],
  ['uzmanlik', 'Ünvan şeridi', 'Adın altındaki koyu şerit — uzmanlık alanı'],
  ['slogan', 'Slogan', 'Antetin köşesinde; her satır ayrı yazılır', 'cok'],
  ['sloganAlt', 'Slogan (Latin)', 'Sloganın altındaki Latin harfli satır — Your Health, Our Priority'],
  ['klinikAdi', 'Klinik / eczane adı', 'Sloganın altında küçük satır; boş bırakılabilir'],
  ['cagriUst', 'Amblem üst yazısı', 'Antetin sağındaki aile ambleminin üstünde — با ما'],
  ['cagriAlt', 'Amblem alt yazısı', 'Aile ambleminin altında — به سوی زندگی سالمتر'],
  ['hizmetler', 'Hizmetler', 'Her satır ayrı bir hizmet; sırayla EKG ve ultrason simgesi alır', 'cok'],
  ['hizmetAlanlari', 'İlgi alanları', 'Hizmetlerin altındaki parantezli satır'],
  ['deneyim', 'Sabıka / çalışma geçmişi', 'Hizmetlerin altındaki açık mavi şerit'],
  ['adres', 'Adres', 'Kâğıdın altında'],
  ['telefon', 'Telefon', 'Kâğıdın altında'],
  ['telefon2', 'İkinci telefon', 'Varsa klinik/eczane numarası; boşsa basılmaz'],
  ['telefonEtiket', 'Telefon etiketleri', 'İki numara varsa etiketleri, virgülle: داکتر, دواخانه'],
  ['whatsapp', 'WhatsApp numarası', 'Boşsa telefon kullanılır'],
  ['ulkeKodu', 'Ülke kodu', 'Afganistan 93 · Türkiye 90'],
  ['eposta', 'E-posta', ''],
  ['ayakEtiketleri', 'Alt rozetler', 'Virgülle ayrılmış en çok sekiz etiket; simgeler sırayla kalp, akciğer, mide, böbrek, şeker, eklem, beyin, çocuk'],
  ['diplomaNo', 'Diploma no', 'Yalnız kayıtlarda tutulur'],
  ['kurum', 'Kurum / hastane', 'Yalnız kayıtlarda tutulur'],
];
