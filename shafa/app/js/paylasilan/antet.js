// Reçete antedinin alanları. Tek liste, iki kullanıcı: Ayarlar'daki form
// onları bu sırayla çizer; hesap değişimi sorusu (senkron/hesap-servisi.js)
// cihazdaki antedin hekimin kendi yazdığı bir şey olup olmadığına — yani
// başka bir hesaba sessizce gitmemesi gereken kişisel bilgi olup olmadığına —
// bunlarla bakar. Liste iki yerde dursaydı yeni bir alan (ör. ikinci telefon)
// soruya girmeden başka bir hekimin hesabına akabilirdi.
//
// Saf: etiketler Türkçe karşılıktır, sözlükteki anahtar 'ayar.<alan>'.

/** Antet alanları: [anahtar, Türkçe etiket, ipucu, çokSatır?]
 *  Sıra kâğıttaki sırayla aynı: ad, ünvan, slogan, hizmetler, sabıka, iletişim. */
export const ANTET_ALANLARI = [
  ['doktorUnvan', 'Ünvan', 'الحاج داکتر · Dr.'],
  ['doktorAd', 'Doktor adı', 'Antetin en üstünde, büyük punto'],
  ['doktorAdAlt', 'İkinci satır', 'Örneğin aynı adın Latin harfleriyle yazılışı'],
  ['uzmanlik', 'Ünvan şeridi', 'Adın altındaki koyu şerit — uzmanlık alanı'],
  ['uzmanlikEn', 'Uzmanlık (İngilizce)', 'Lacivert kâğıtta Latin adın altındaki küçük satır'],
  ['slogan', 'Slogan', 'Antetin köşesinde; her satır ayrı yazılır', 'cok'],
  ['sloganAlt', 'Slogan (Latin)', 'Sloganın altındaki Latin harfli satır — Your Health, Our Priority'],
  ['klinikAdi', 'Klinik / eczane adı', 'Sloganın altında küçük satır; boş bırakılabilir'],
  ['cagriUst', 'Amblem üst yazısı', 'Antetin sağındaki aile ambleminin üstünde — با ما'],
  ['cagriAlt', 'Amblem alt yazısı', 'Aile ambleminin altında — به سوی زندگی سالمتر'],
  ['hizmetler', 'Hizmetler', 'Her satır ayrı bir hizmet; sırayla EKG ve ultrason simgesi alır', 'cok'],
  ['hizmetAlanlari', 'İlgi alanları', 'Hizmetlerin altındaki parantezli satır'],
  ['deneyim', 'Sabıka / çalışma geçmişi', 'Hizmetlerin altındaki açık mavi şerit'],
  ['hizmetlerEn', 'Hizmetler (İngilizce)', 'Her satır bir madde; lacivert kâğıtta antedin sol sütunu', 'cok'],
  ['deneyimEn', 'Çalışma geçmişi (İngilizce)', 'Her satır bir çalışma yeri', 'cok'],
  ['muhurAlt', 'Mühür alt yazısı', 'Health · Care · Trust'],
  ['adres', 'Adres', 'Kâğıdın altında'],
  ['adresEn', 'Adres (İngilizce)', 'Kâğıdın altındaki adresin ikinci satırı'],
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

/** Seçilebilen kâğıt stilleri, Ayarlar'daki sırayla. İlki varsayılan. */
export const KAGIT_STILLERI = ['lacivert', 'modern', 'klasik', 'sade'];

/** Stil geçişinin sürümü: 2 = lacivert varsayılan oldu. */
export const KAGIT_STILI_SURUMU = 2;

/** Ayardaki stil → çizilecek stil. Eski sürüm klasiği 'renkli' diye
 *  kaydediyordu; tanınmayan ya da boş değer varsayılana düşüyor. */
export function kagitStiliCoz(ayar = {}) {
  const k = ayar.kagitStili;
  if (k === 'renkli') return 'klasik';
  return KAGIT_STILLERI.includes(k) ? k : KAGIT_STILLERI[0];
}

/**
 * Tek seferlik geçiş: lacivert herkesin varsayılanı. 'modern' eski
 * sürümün sessizce kaydettiği varsayılandı, hekimin seçimi değil; boş ya
 * da 'modern' olan stil (geçiş damgası yoksa) laciverte döner. Klasik,
 * renkli ve sade bilerek seçilmişti, dokunulmuyor. Damga eşitlemeyle
 * öbür cihaza da gidiyor: güncellemeden sonra 'modern'i seçen hekimin
 * seçimi geçişi bir kez daha görmüyor.
 * @returns {object|null} ayara yazılacak parça ya da geçiş gerekmiyorsa null
 */
export function kagitStiliGecisi(ayar = {}) {
  if (ayar.kagitStiliSurum === KAGIT_STILI_SURUMU) return null;
  if (ayar.kagitStili !== undefined && ayar.kagitStili !== 'modern') return null;
  return { kagitStili: 'lacivert', kagitStiliSurum: KAGIT_STILI_SURUMU };
}
