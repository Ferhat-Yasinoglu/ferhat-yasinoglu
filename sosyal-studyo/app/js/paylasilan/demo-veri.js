// Demo tohumu: ilk açılışta yüklenir, hepsi `demo: 1` işaretlidir ve tek tıkla silinir.
// "[Demo] Fiyat sorusu" akışı botflow-mcp'nin örnek hunisinin genişletilmiş hâli.
export const DEMO_AKIS = {
  id: 'akis_demo_fiyat_sorusu', demo: 1, ad: '[Demo] Fiyat sorusu',
  aciklama: "DM'den ya da yorumdan 'fiyat' yazan kişiye iki soru sorar, etiketler, puan verir, teklif ister. Yorumdan gelirse önce açık yanıt + tek DM; kullanıcı cevap verince devam eder.",
  durum: 'yayinda', surum: 1, kanal: null, hesap_id: null, etiketler: ['demo'],
  adimlar: [
    { type: 'condition', check: { kind: 'window_open' }, then: 3, else: 1 },
    { type: 'comment_reply', texts: [
      'Merhaba {{username}}! DM\'ine yazdım 🙂', 'Selam {{username}}, ayrıntıları DM\'den gönderdim.', '{{username}} teşekkürler, DM kutuna bak 🙂',
      'Merhaba! Fiyat bilgisini DM\'den paylaştım.', 'Selam {{username}}! Mesaj kutunda seni bekliyor.', '{{username}}, sana özel bilgi DM\'de 🙂',
      'Teşekkürler {{username}}, DM\'den devam edelim.', 'Merhaba {{username}}, DM\'e yazdım, oradan konuşalım.', 'Selam! Ayrıntılar DM\'de {{username}} 🙂', '{{username}} DM\'ini kontrol eder misin? 🙂' ] },
    { type: 'private_reply', text: 'Merhaba! Fiyat sorduğun için teşekkürler 🙂 Devam etmek için aşağıdaki düğmeye bas ya da bu mesaja cevap ver.', choices: [{ label: 'Devam edelim', goto: 3 }] },
    { type: 'message', text: 'Merhaba {{ad}}! Sana en doğru rakamı verebilmek için iki küçük soru soracağım.' },
    { type: 'buttons', text: 'Hangi hizmet ilgini çekiyor?', save_as: 'hizmet', choices: [
      { label: 'Web sitesi', goto: 5, add_tags: ['ilgi-web'] },
      { label: 'Otomasyon / bot', goto: 5, add_tags: ['ilgi-bot'] },
      { label: 'Diğer', goto: 5, add_tags: ['ilgi-diger'] } ] },
    { type: 'question', text: 'Bütçe aralığını yazar mısın? (ör. 500-1000 €)', save_as: 'butce', validate: 'none' },
    { type: 'condition', check: { kind: 'tag', any: ['ilgi-bot'] }, then: 7, else: 9 },
    { type: 'message', text: 'Otomasyon projeleri genelde 300 € ile 1.500 € arasında oluyor; {{butce}} bütçesiyle güzel bir başlangıç yapabiliriz.' },
    { type: 'goto', goto: 10 },
    { type: 'message', text: 'Web siteleri 400 € ile 2.000 € arasında oluyor; {{butce}} bütçesine uygun bir paket önerebilirim.' },
    { type: 'tag', add_tags: ['lead-fiyat'] },
    { type: 'score', delta: 5, reason: 'fiyat sordu', once_per: 'run' },
    { type: 'buttons', text: 'Devam edelim mi?', choices: [
      { label: 'Evet, teklif istiyorum', goto: 13, add_tags: ['teklif-istedi'] },
      { label: 'Şimdilik hayır', goto: 15 } ] },
    { type: 'message', text: 'Harika {{ad}}! En kısa sürede ayrıntılı teklifi göndereceğim. Teşekkürler 🙂' },
    { type: 'end' },
    { type: 'message', text: "Sorun değil. Ne zaman istersen 'fiyat' yaz, buradayım." },
    { type: 'end' },
  ],
};

export const DEMO_TETIKLEYICILER = [
  { id: 'tet_demo_dm', demo: 1, akis_id: DEMO_AKIS.id, hesap_id: null, tip: 'keyword', eslesme: 'contains',
    anahtar_kelimeler: ['fiyat', 'ücret', 'kaç para', 'price', 'preis', 'قیمت'], gonderi_idleri: [], yeniden_baslatma_sn: 3600, aktif: 1 },
  { id: 'tet_demo_yorum', demo: 1, akis_id: DEMO_AKIS.id, hesap_id: null, tip: 'comment', eslesme: 'contains',
    anahtar_kelimeler: ['fiyat', 'price', 'preis', 'قیمت'], gonderi_idleri: [], yeniden_baslatma_sn: 86400, aktif: 1 },
];

export const DEMO_HESAP = { id: 'hes_demo', demo: 1, kanal: 'telegram', ad: 'Demo bot', dis_id: '@demo_bot', durum: 'prova', yorum_yanit: { aktif: true, gunlukLimit: 150 } };

export const DEMO_ETIKETLER = ['demo', 'lead-fiyat', 'ilgi-web', 'ilgi-bot', 'ilgi-diger', 'teklif-istedi', 'test']
  .map((ad, i) => ({ id: `etk_demo_${i}`, demo: 1, ad, renk: ['gri', 'altin', 'mavi', 'mor', 'gri', 'yesil', 'gri'][i], sistem: ad === 'demo' || ad === 'test' ? 1 : 0 }));

export const DEMO_KISILER = [
  { id: 'kisi_demo_1', demo: 1, hesap_id: 'hes_demo', kanal: 'telegram', dis_id: '1001', ad: 'Ayşe Demir', kullanici_adi: 'ayse', etiketler: ['lead-fiyat', 'ilgi-web'], degiskenler: { hizmet: 'Web sitesi', butce: '800-1200 €' }, puan: 12, kaynak: 'dm', son_gelen: new Date(Date.now() - 3600e3).toISOString() },
  { id: 'kisi_demo_2', demo: 1, hesap_id: 'hes_demo', kanal: 'telegram', dis_id: '1002', ad: 'Mehmet Kaya', kullanici_adi: 'mkaya', etiketler: ['ilgi-bot', 'teklif-istedi'], degiskenler: { hizmet: 'Otomasyon / bot', butce: '500 €' }, puan: 25, kaynak: 'dm', son_gelen: new Date(Date.now() - 20 * 3600e3).toISOString() },
  { id: 'kisi_demo_3', demo: 1, hesap_id: 'hes_demo', kanal: 'instagram', dis_id: 'ig_9', ad: 'Sara N.', kullanici_adi: 'sara.n', etiketler: ['lead-fiyat'], degiskenler: {}, puan: 5, kaynak: 'yorum', takip_ediyor: true, son_gelen: new Date(Date.now() - 30 * 3600e3).toISOString() },
];

export const DEMO_PUAN_KURALLARI = [
  { id: 'pk_yorum', olay: 'yorum', puan: 2, gunlukTavan: 10, aktif: 1 },
  { id: 'pk_story', olay: 'story_tepkisi', puan: 1, gunlukTavan: 5, aktif: 1 },
  { id: 'pk_bahis', olay: 'story_bahsi', puan: 5, gunlukTavan: 10, aktif: 1 },
  { id: 'pk_dm', olay: 'dm', puan: 1, gunlukTavan: 3, aktif: 1 },
  { id: 'pk_akis', olay: 'akis_tamamlama', puan: 3, gunlukTavan: 9, aktif: 1 },
  { id: 'pk_ref', olay: 'ref', puan: 10, gunlukTavan: 50, aktif: 1 },
].map((k) => ({ ...k, demo: 1 }));

export const DEMO_FIKIRLER = [
  { id: 'fikir_demo_1', demo: 1, baslik: 'Botun 30 saniyede kurulumu', aciklama: 'Ekran kaydı: BotFather → token → ilk mesaj. Kanca: "Sunucu yok, kart yok."', format: 'reels', hedef: 'küçük işletme', durum: 'fikir', sira: 1 },
  { id: 'fikir_demo_2', demo: 1, baslik: 'DM\'lere neden 2 dakikada cevap vermelisin', aciklama: 'İstatistik + kendi deneyimin; sonunda "fiyat yaz" CTA\'sı.', format: 'karusel', hedef: 'yaratıcılar', durum: 'fikir', sira: 2 },
  { id: 'fikir_demo_3', demo: 1, baslik: 'Yorumdan DM\'e: 1 akış, 3 satış', aciklama: 'Fiyat sorusu akışının hikâyesi; önce/sonra.', format: 'story', hedef: 'e-ticaret', durum: 'fikir', sira: 3 },
];

export const DEMO_KARUSEL = {
  id: 'karu_demo_1', demo: 1, baslik: 'DM otomasyonuna 5 adımda başla', sablon: 'koyu', durum: 'taslak',
  stil: { tema: 'koyu', dil: 'tr', yon: 'ltr' },
  slaytlar: [
    { no: 1, baslik: 'DM\'lerin seni yoruyor mu?', metin: 'Her gün aynı 5 soru. Aynı 5 cevap. Bunu bir bot yapsın.', gorsel_notu: 'kapak' },
    { no: 2, baslik: '1 · Bir kanal bağla', metin: 'Telegram 5 dakika. Instagram için Meta uygulaması gerekir.', gorsel_notu: '' },
    { no: 3, baslik: '2 · Tetikleyici seç', metin: '"fiyat" yazan herkes → fiyat akışı.', gorsel_notu: '' },
    { no: 4, baslik: '3 · İki soru sor', metin: 'Hangi hizmet? Bütçe ne? Cevaplar kişiye yazılır.', gorsel_notu: '' },
    { no: 5, baslik: '4 · Etiketle, puanla', metin: 'lead-fiyat etiketi, +5 puan. Sonra toplu mesaj.', gorsel_notu: '' },
    { no: 6, baslik: '5 · Önce prova, sonra canlı', metin: 'Hiç kimseye mesaj gitmeden dene. Sonra tek tıkla canlıya al.', gorsel_notu: 'CTA: fiyat yaz' },
  ],
};

/** Tüm demo kayıtlarını koleksiyon → liste olarak döner. */
export function demoTohumu() {
  return {
    hesaplar: [DEMO_HESAP],
    akislar: [DEMO_AKIS],
    tetikleyiciler: DEMO_TETIKLEYICILER,
    etiketler: DEMO_ETIKETLER,
    kisiler: DEMO_KISILER,
    puan_kurallari: DEMO_PUAN_KURALLARI,
    fikirler: DEMO_FIKIRLER,
    karuseller: [DEMO_KARUSEL],
  };
}
