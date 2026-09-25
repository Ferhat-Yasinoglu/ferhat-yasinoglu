// Simge seti: iki tablo, ikisi de currentColor ile boyanır.
//   SIMGELER       24×24 çizgi simgeler (1.8 kalınlık) — uygulamanın genelinde.
//   SIMGELER_DOLU  dolgulu simgeler — reçete sayfası tasarımındaki kabuk, form
//                  ve kâğıt; tasarımın simgeleri neredeyse hep dolgulu siluet.
// Dış kaynak yok; yollar satır içi, uygulama çevrimdışı da eksiksiz görünür.
const NS = 'http://www.w3.org/2000/svg';

const SIMGELER = {
  panel: [['path', { d: 'M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-4H4zM14 8h6V4h-6z' }]],
  ilac: [['path', { d: 'M10.5 20.5 20 11a5.7 5.7 0 0 0-8-8L2.5 12.5a5.7 5.7 0 0 0 8 8z' }], ['path', { d: 'm8.5 8.5 7 7' }]],
  hasta: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5' }]],
  recete: [['path', { d: 'M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z' }], ['path', { d: 'M14 3v4h4M9 12h6M9 16h4' }]],
  kutu: [['path', { d: 'M3 8l9-4 9 4v8l-9 4-9-4z' }], ['path', { d: 'M3 8l9 4 9-4M12 12v8' }]],
  ara: [['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'M16.5 16.5 21 21' }]],
  arti: [['path', { d: 'M12 5v14M5 12h14' }]],
  eksi: [['path', { d: 'M5 12h14' }]],
  kapat: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
  onay: [['path', { d: 'M5 13l4 4L19 7' }]],
  kalem: [['path', { d: 'M4 20h4L20 8l-4-4L4 16z' }]],
  cop: [['path', { d: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13' }]],
  indir: [['path', { d: 'M12 4v11M8 11l4 4 4-4M4 20h16' }]],
  yukle: [['path', { d: 'M12 19V6M8 10l4-4 4 4M5 20h14' }]],
  yenile: [['path', { d: 'M20 12a8 8 0 1 1-2.6-5.9' }], ['path', { d: 'M20 4v4h-4' }]],
  menu: [['path', { d: 'M4 7h16M4 12h16M4 17h16' }]],
  sag: [['path', { d: 'M9 5l7 7-7 7' }]],
  sol: [['path', { d: 'M15 5l-7 7 7 7' }]],
  asagi: [['path', { d: 'M5 9l7 7 7-7' }]],
  yukari: [['path', { d: 'M5 15l7-7 7 7' }]],
  geri: [['path', { d: 'M10 19l-7-7 7-7M3 12h18' }]],
  git: [['path', { d: 'M5 12h14M13 6l6 6-6 6' }]],
  uyari: [['path', { d: 'M12 3 2 20h20z' }], ['path', { d: 'M12 9v5' }], ['path', { d: 'M12 17.4v.2' }]],
  bilgi: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 11v6M12 7.4v.2' }]],
  hata: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M9 9l6 6M15 9l-6 6' }]],
  basari: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M8 12.5l2.5 2.5L16 9.5' }]],
  takvim: [['rect', { x: 3, y: 5, width: 18, height: 16, rx: 2 }], ['path', { d: 'M3 10h18M8 3v4M16 3v4' }]],
  saat: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
  yazdir: [['path', { d: 'M7 8V3h10v5' }], ['path', { d: 'M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1' }], ['rect', { x: 7, y: 14, width: 10, height: 7, rx: 1 }]],
  ayarlar: [['path', { d: 'M4 7h9M19 7h1M4 12h4M14 12h6M4 17h11M21 17h0' }], ['circle', { cx: 16, cy: 7, r: 2 }], ['circle', { cx: 11, cy: 12, r: 2 }], ['circle', { cx: 18, cy: 17, r: 2 }]],
  barkod: [['path', { d: 'M4 6v12M7 6v12M10.5 6v12M14 6v12M17 6v12M20 6v12' }]],
  telefon: [['path', { d: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z' }]],
  bulut: [['path', { d: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.6 4.2 4.2 0 0 0 7 18z' }]],
  kilit: [['rect', { x: 4, y: 11, width: 16, height: 10, rx: 2 }], ['path', { d: 'M8 11V7a4 4 0 0 1 8 0v4' }]],
  kalp: [['path', { d: 'M12 20s-7-4.4-7-9.4A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.6C19 15.6 12 20 12 20z' }]],
  /* Marka simgesi: kalbin içinden geçen nabız çizgisi. Düz kalp tek başına
     bir sağlık uygulamasından çok bir "beğen" düğmesi gibi duruyordu. */
  'nabiz-kalp': [
    ['path', { d: 'M12 20.4s-7.6-4.8-7.6-10.2A4.2 4.2 0 0 1 12 7.2a4.2 4.2 0 0 1 7.6 3C19.6 15.6 12 20.4 12 20.4z' }],
    ['path', { d: 'M4.8 12.6h3.1l1.5-3 2.2 5.4 1.6-3.4 1 1h4.8' }],
  ],
  /* Laboratuvar: deney tüpü. Yarısına kadar dolu — boş tüp ekranda düz bir
     dikdörtgene iniyordu. */
  tup: [
    ['path', { d: 'M9 3v13.2a3.2 3.2 0 0 0 6.4 0V3' }],
    ['path', { d: 'M7.6 3h9.2' }],
    ['path', { d: 'M9 11.4h6.4' }],
  ],
  filtre: [['path', { d: 'M3 5h18l-7 8v6l-4 2v-8z' }]],
  kaydet: [['path', { d: 'M5 3h11l3 3v15H5z' }], ['path', { d: 'M8 3v6h7V3M8 14h8v7H8z' }]],
  gece: [['path', { d: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z' }]],
  gunduz: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }]],
  grafik: [['path', { d: 'M4 20V10M10 20V4M16 20v-7M22 20H2' }]],
  not: [['path', { d: 'M5 4h14v16l-4-3-3 3-3-3-4 3z' }], ['path', { d: 'M9 9h6M9 13h4' }]],

  /* Reçete kâğıdının süslemeleri */
  stetoskop: [
    ['path', { d: 'M4.5 3v5.5a5 5 0 0 0 10 0V3' }],
    ['path', { d: 'M3 3h2.5M13.5 3h2.5' }],
    ['path', { d: 'M9.5 13.5v1.5a4 4 0 0 0 8 0v-2.2' }],
    ['circle', { cx: 17.5, cy: 10.5, r: 2.2 }],
  ],
  akciger: [
    ['path', { d: 'M12 3.5v8' }],
    ['path', { d: 'M9.6 11.6 12 9.6l2.4 2' }],
    ['path', { d: 'M9.4 11.8c-2.3.5-3.6 2.4-3.6 4.9V19a2 2 0 0 0 2 2h1.4a2 2 0 0 0 2-2v-4.8c0-1.4-.6-2.6-1.8-2.4z' }],
    ['path', { d: 'M14.6 11.8c2.3.5 3.6 2.4 3.6 4.9V19a2 2 0 0 1-2 2h-1.4a2 2 0 0 1-2-2v-4.8c0-1.4.6-2.6 1.8-2.4z' }],
  ],
  mide: [
    ['path', { d: 'M9.5 3v3.8c-2.9 1.1-4.8 3.8-4.8 7 0 3.6 2.9 6.6 6.6 6.6 3 0 5.5-2 6.4-4.8' }],
    ['path', { d: 'M8.4 3h3.2' }],
    ['path', { d: 'M17.9 15.3c.2-.6.3-1.3.3-2 0-2.1-1-3.9-2.6-5' }],
  ],
  cocuk: [
    ['circle', { cx: 12, cy: 6, r: 3.2 }],
    ['path', { d: 'M12 9.4V16' }],
    ['path', { d: 'M8 12.2h8' }],
    ['path', { d: 'M9 20.5 12 16l3 4.5' }],
  ],
  ekg: [['path', { d: 'M2 12h3.6l2-6.4 3 12.8 2.4-8 1.8 4H22' }]],
  ultrason: [
    ['rect', { x: 3.5, y: 4.5, width: 17, height: 12, rx: 2 }],
    ['path', { d: 'M8.4 13.4a5 5 0 0 1 7.2 0' }],
    ['path', { d: 'M10.6 10.8a2.6 2.6 0 0 1 2.8 0' }],
    ['path', { d: 'M10 20h4' }],
  ],
  /* Klinik ölçüm simgeleri: reçete kâğıdında her ölçümün yanında duruyor. */
  termometre: [
    ['path', { d: 'M10 13.6V5a2 2 0 0 1 4 0v8.6' }],
    ['circle', { cx: 12, cy: 17, r: 3.4 }],
    ['path', { d: 'M12 13.6V17' }],
    ['path', { d: 'M16.5 7h2M16.5 10h2' }],
  ],
  oksijen: [
    ['path', { d: 'M12 3.4s6.2 6.8 6.2 10.8a6.2 6.2 0 0 1-12.4 0C5.8 10.2 12 3.4 12 3.4z' }],
    ['path', { d: 'M9.4 14.6a2.6 2.6 0 0 0 2.6 2.6' }],
  ],
  boy: [
    ['circle', { cx: 10, cy: 4.8, r: 2 }],
    ['path', { d: 'M10 7.2v6M7.2 9.6h5.6M8 20v-6.8M12 20v-6.8' }],
    ['path', { d: 'M18 3.4v17.2M16.2 3.4h3.6M16.2 20.6h3.6' }],
  ],
  tarti: [
    ['rect', { x: 3.4, y: 6.4, width: 17.2, height: 13.2, rx: 2.4 }],
    ['path', { d: 'M9.2 12.6a3.4 3.4 0 0 1 5.6 0' }],
    ['path', { d: 'M12 12.4l2-1.6' }],
    ['path', { d: 'M8.6 6.4V5a1.6 1.6 0 0 1 1.6-1.6h3.6A1.6 1.6 0 0 1 15.4 5v1.4' }],
  ],

  /* Reçete ayağındaki uzmanlık rozetleri için ek simgeler. */
  bobrek: [
    ['path', { d: 'M9.2 4C6 4 4 7.2 4 10.6c0 3.8 2.4 6.4 5 6.4 1.2 0 2-.5 2.6-1.4' }],
    ['path', { d: 'M9.2 4c2.6 0 4.4 2 4.4 4.6 0 2.2-1.4 3.4-2.8 3.7-1.2.3-2 1-2 2.3V20' }],
    ['path', { d: 'M14.8 20c3.2 0 5.2-3.2 5.2-6.6 0-3.8-2.4-6.4-5-6.4-1.2 0-2 .5-2.6 1.4' }],
  ],
  seker: [
    ['path', { d: 'M12 3.4s6 6.6 6 10.6a6 6 0 0 1-12 0c0-4 6-10.6 6-10.6z' }],
    ['path', { d: 'M10 14h4M12 12v4' }],
  ],
  /* Romatizma rozeti: eklemli kemik. Önceki çizim (iki daire + çapraz
     çizgiler) rozet boyunda kaleme benziyordu. */
  eklem: [
    ['path', { d: 'M8.6 5.2a2.3 2.3 0 1 0-3.4 3l-.2.2a2.3 2.3 0 1 0 3 3.4l6.4-6.4a2.3 2.3 0 1 0-3.4-3z' }],
    ['path', { d: 'M15.4 18.8a2.3 2.3 0 1 0 3.4-3l.2-.2a2.3 2.3 0 1 0-3-3.4l-6.4 6.4a2.3 2.3 0 1 0 3.4 3z' }],
  ],
  /* Baş ağrısı rozeti: profilden kafa ve içinde beyin kıvrımları. Rozet
     boyunda iki yarım beyin çizimi tek dikey çizgiye iniyordu. */
  beyin: [
    ['path', { d: 'M16.8 20v-2.6c2-1.2 3.2-3.3 3.2-5.7 0-4-3.3-7.2-7.4-7.2S5.2 7.7 5.2 11.7c0 1.7.6 3.2 1.6 4.4v3.9' }],
    ['path', { d: 'M12.4 8.6c-1.3 0-2.2.9-2.2 2s.9 2 2.2 2 2.2.9 2.2 2-.9 2-2.2 2' }],
  ],

  /* Kan grubu: damla, oksijenden ayrılsın diye bantlı. */
  kan: [
    ['path', { d: 'M12 3.4s6.2 6.8 6.2 10.8a6.2 6.2 0 0 1-12.4 0C5.8 10.2 12 3.4 12 3.4z' }],
    ['path', { d: 'M6.4 13.6h11.2' }],
  ],

  konum: [
    ['path', { d: 'M12 21.2s6.8-6 6.8-10.7a6.8 6.8 0 1 0-13.6 0C5.2 15.2 12 21.2 12 21.2z' }],
    ['circle', { cx: 12, cy: 10.2, r: 2.5 }],
  ],

  /* Önizleme panelinin başlık düğmeleri: kıvrık köşeli sayfa ve aşağı ok
     («ذخیره PDF»), iki köşeye açılan oklar (büyük önizleme). */
  pdf: [['path', { d: 'M6 3h8l4 4v14H6zM14 3v4h4M12 10v7M9 14l3 3 3-3' }]],
  genislet: [['path', { d: 'M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7' }]],
};

/* Dolgulu simgeler. Bir kısmı bootstrap-icons 1.13.1'den (MIT, © 2019-2024
   The Bootstrap Authors; lisans metni: bootstrap-icons-LICENSE.txt). O
   girdiler `// bi: <ad>` ile işaretli ve yol verisi pakettekiyle birebir:
   sonraki bir güncellemede kaynağına bakılabilsin. İşaretsiz olanlar bu
   uygulama için çizildi (24×24).

   Girdi biçimi { vb, yollar, oyuk?, ust? }:
     vb     viewBox kenarı (bi 16, kendi çizimlerimiz 24)
     yollar dolgulu parçalar; çizgi parçaları kendi fill/stroke'unu taşır
     oyuk   yollar'dan OYULAN şekiller (maske). Beyaz bir şekil boyamak yerine
            gerçek delik: altındaki kart, düğme ya da karanlık tema görünsün.
            Basit delikler maske yerine fill-rule="evenodd" ile yazıldı.
     ust    maskenin dışında, en üste çizilen parçalar (oyuğun içine oturan) */
const CIZGI = (kalinlik) => ({ fill: 'none', stroke: 'currentColor', 'stroke-width': kalinlik });
// Bazı bi simgeleri (göz, yazıcı, belge) tasarımdakinden ~%30 ince: aynı
// renkte ince bir kontur dolguyu dışa doğru kalınlaştırıyor.
const KALIN = (kalinlik) => ({ stroke: 'currentColor', 'stroke-width': kalinlik, 'paint-order': 'stroke' });
const OYUK = (kalinlik) => ({ fill: 'none', stroke: '#000', 'stroke-width': kalinlik });

// bi: file-earmark-text-fill — kenar menüsü, hasta kartındaki No. alanı, kâğıttaki tarih
const BELGE_DOLU = 'M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0M9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1M4.5 9a.5.5 0 0 1 0-1h7a.5.5 0 0 1 0 1zM4 10.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5m.5 2.5a.5.5 0 0 1 0-1h4a.5.5 0 0 1 0 1z';
// bi: pencil-fill
const KALEM_DOLU = 'M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.5.5 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11z';
// bi: person-standing
const AYAKTA_INSAN = 'M8 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M6 6.75v8.5a.75.75 0 0 0 1.5 0V10.5a.5.5 0 0 1 1 0v4.75a.75.75 0 0 0 1.5 0v-8.5a.25.25 0 1 1 .5 0v2.5a.75.75 0 0 0 1.5 0V6.5a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v2.75a.75.75 0 0 0 1.5 0v-2.5a.25.25 0 0 1 .5 0';
// Formun başlığındaki "yeni reçete" simgesinde kalem, belgenin sağ alt
// köşesine küçültülüp bindiriliyor; ucu yine sol altta.
const KALEM_YERI = 'translate(7.7 7.7) scale(.52)';

/* Marka logosu: kontur kalp ve içinden geçen nabız; nabız kalbin sağ
   kenarındaki boşluktan çıkıyor. Tasarımda kenar çubuğundaki ve kâğıdın
   slogan bloğundaki logo aynı çizim: ikisi de bu yolları kullanıyor, kâğıt
   (kagit.js sloganAmblemi) yalnız kalınlığı ve görünen kutuyu kendi veriyor.
   `kutu` çizimin sıkı çerçevesi (viewBox), 24'lük kutunun içinde. */
export const LOGO = {
  kalp: 'M20.27 13.87C18.38 16.57 15.42 18.75 12 20.65 7.8 18.29 3.67 15.02 3.6 10.26 3.54 7.21 5.78 5.16 8.11 5.16c1.74 0 3.11.93 3.89 2.36C12.78 6.09 14.15 5.16 15.89 5.16 18.22 5.16 20.46 7.21 20.4 10.26c0 .56-.09 1.09-.22 1.55',
  nabiz: 'M6.25 12.78h2.92l.59-1.93 1.06 4.17 1.74-6.59 1.12 8.33.96-4.6.68.62h5.16',
  kutu: '2.67 4.29 18.66 17.1',
};

const SIMGELER_DOLU = {
  /* ---- Kenar çubuğu ---- */
  // Marka: kontur kalp ve nabız (bkz. LOGO).
  logo: { vb: 24, yollar: [
    ['path', { ...CIZGI(1.3), d: LOGO.kalp }],
    ['path', { ...CIZGI(1), d: LOGO.nabiz }],
  ] },
  // bi: grid-fill
  panel: { vb: 16, yollar: [['path', { d: 'M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5z' }]] },
  // bi: people-fill
  hastalar: { vb: 16, yollar: [['path', { d: 'M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6m-5.784 6A2.24 2.24 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.3 6.3 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1zM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5' }]] },
  // bi: file-earmark-text-fill
  recete: { vb: 16, yollar: [['path', { d: BELGE_DOLU }]] },
  // Kâğıt reçete: çizgi belge ve köşesine binen kapsül. Tasarımda da
  // dolgulu kardeşleri arasında tek çizgi simge ("kâğıt" ayrı bir kavram).
  kagazi: { vb: 24, yollar: [
    ['path', { ...CIZGI(1.6), d: 'M13 3H6a1.4 1.4 0 0 0-1.4 1.4v15.2A1.4 1.4 0 0 0 6 21h5' }],
    ['path', { ...CIZGI(1.6), d: 'M13 3l4.4 4.4V10M8 9.5h5M8 13h3.5M8 16.5h2' }],
    ['rect', { ...CIZGI(1.6), x: 11.6, y: 14.4, width: 10, height: 4.4, rx: 2.2, transform: 'rotate(-45 16.6 16.6)' }],
    ['path', { ...CIZGI(1.6), d: 'M16.6 14.4v4.4', transform: 'rotate(-45 16.6 16.6)' }],
  ] },
  // Reçete listesi: üç yuvarlak şerit, başlarında birer delik.
  liste: { vb: 24, yollar: [['path', { 'fill-rule': 'evenodd', d:
    'M4.6 3.6h14.8a1.6 1.6 0 0 1 1.6 1.6v1.4a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 6.6V5.2a1.6 1.6 0 0 1 1.6-1.6zM5 5.9a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z'
    + 'M4.6 9.9h14.8a1.6 1.6 0 0 1 1.6 1.6v1.4a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 12.9v-1.4a1.6 1.6 0 0 1 1.6-1.6zM5 12.2a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z'
    + 'M4.6 16.2h14.8a1.6 1.6 0 0 1 1.6 1.6v1.4a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 19.2v-1.4a1.6 1.6 0 0 1 1.6-1.6zM5 18.5a.9.9 0 1 0 1.8 0 .9.9 0 1 0-1.8 0z' }]] },
  // Dava (ilaç): 45° yatık kapsül, üst yarısında küçük bir delik.
  ilac: { vb: 24, yollar: [['path', { 'fill-rule': 'evenodd', transform: 'rotate(-45 12 12)', d:
    'M5.9 7.6h12.2a4.4 4.4 0 0 1 0 8.8H5.9a4.4 4.4 0 0 1 0-8.8zM15 10.4a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0z' }]] },
  // bi: heart-pulse-fill — tanılar; kâğıdın ayağında "قلب" rozeti
  tani: { vb: 16, yollar: [
    ['path', { d: 'M1.475 9C2.702 10.84 4.779 12.871 8 15c3.221-2.129 5.298-4.16 6.525-6H12a.5.5 0 0 1-.464-.314l-1.457-3.642-1.598 5.593a.5.5 0 0 1-.945.049L5.889 6.568l-1.473 2.21A.5.5 0 0 1 4 9z' }],
    ['path', { d: 'M.88 8C-2.427 1.68 4.41-2 7.823 1.143q.09.083.176.171a3 3 0 0 1 .176-.17C11.59-2 18.426 1.68 15.12 8h-2.783l-1.874-4.686a.5.5 0 0 0-.945.049L7.921 8.956 6.464 5.314a.5.5 0 0 0-.88-.091L3.732 8z' }],
  ] },
  // bi: flask-fill — laboratuvar
  tup: { vb: 16, yollar: [['path', { d: 'M11.5 0a.5.5 0 0 1 0 1H11v5.358l4.497 7.36c.099.162.16.332.192.503l.013.063.008.083q.006.053.007.107l-.003.09q-.001.047-.005.095-.006.053-.017.106l-.016.079q-.012.049-.028.096l-.028.086a1.5 1.5 0 0 1-.17.322 1.5 1.5 0 0 1-.395.394q-.04.028-.082.054-.045.026-.095.049l-.073.035-.09.033q-.05.02-.103.034-.04.01-.08.017-.053.012-.108.021l-.006.002-.202.013H1.783l-.214-.015a1.503 1.503 0 0 1-1.066-2.268L5 6.359V1h-.5a.499.499 0 0 1-.354-.854A.5.5 0 0 1 4.5 0zm.5 12a.5.5 0 0 0 0 1h1.885l-.61-1zm-1-2a.5.5 0 0 0 0 1h1.664l-.612-1zm-1-2a.5.5 0 0 0 0 1h1.441l-.61-1zM9 6a.5.5 0 0 0 0 1h1.22l-.147-.24A.5.5 0 0 1 10 6.5V6zm0-2a.5.5 0 0 0 0 1h1V4zm0-2a.5.5 0 0 0 0 1h1V2z' }]] },
  // bi: file-earmark-bar-graph-fill — raporlar
  rapor: { vb: 16, yollar: [['path', { d: 'M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0M9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1m.5 10v-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5m-2.5.5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5zm-3 0a.5.5 0 0 1-.5-.5v-2a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5z' }]] },
  // bi: gear-fill
  ayarlar: { vb: 16, yollar: [['path', { d: 'M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z' }]] },

  /* ---- Üst çubuk ---- */
  // Takvim: çizgi kutu, dolgulu başlık bandı, iki halka ve 3×2 gün noktası.
  takvim: { vb: 24, yollar: [
    ['rect', { ...CIZGI(1.8), x: 3.2, y: 4.8, width: 17.6, height: 16.2, rx: 2.6 }],
    ['path', { ...CIZGI(1.8), d: 'M8 2.8v3.4M16 2.8v3.4', 'stroke-linecap': 'round' }],
    ['path', { d: 'M3.2 7.4a2.6 2.6 0 0 1 2.6-2.6h12.4a2.6 2.6 0 0 1 2.6 2.6v2.4H3.2z' }],
    ['path', { d: 'M6.8 13.4a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0zm4 0a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0zm4 0a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0zM6.8 17.2a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0zm4 0a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0zm4 0a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 1 0-2.4 0z' }],
  ] },
  // bi: moon-fill
  gece: { vb: 16, yollar: [['path', { d: 'M6 .278a.77.77 0 0 1 .08.858 7.2 7.2 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277q.792-.001 1.533-.16a.79.79 0 0 1 .81.316.73.73 0 0 1-.031.893A8.35 8.35 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.75.75 0 0 1 6 .278' }]] },
  // bi: sun-fill — karanlık temadayken tema düğmesi
  gunduz: { vb: 16, yollar: [['path', { d: 'M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0m0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13m8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5M3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8m10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0m-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0m9.193 2.121a.5.5 0 0 1-.707 0l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707M4.464 4.465a.5.5 0 0 1-.707 0L2.343 3.05a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708' }]] },
  // bi: bell-fill
  zil: { vb: 16, yollar: [['path', { d: 'M8 16a2 2 0 0 0 2-2H6a2 2 0 0 0 2 2m.995-14.901a1 1 0 1 0-1.99 0A5 5 0 0 0 3 6c0 1.098-.5 6-2 7h14c-1.5-1-2-5.902-2-7 0-2.42-1.72-4.44-4.005-4.901' }]] },

  /* ---- Form başlığı ve kartlar ---- */
  // bi: file-earmark-text-fill + bi: pencil-fill (bileşik). Kalemin çevresi
  // belgeden oyuluyor: tek renkte iki şekil ancak bu boşlukla ayrışıyor.
  'yeni-recete': { vb: 16,
    yollar: [['path', { d: BELGE_DOLU }]],
    oyuk: [['path', { ...OYUK(2.3), fill: '#000', d: KALEM_DOLU, transform: KALEM_YERI }]],
    ust: [['path', { d: KALEM_DOLU, transform: KALEM_YERI }]],
  },
  // Hasta bilgileri: ortada uzun, iki yanda kısa üç figür.
  'hasta-grup': { vb: 24, yollar: [
    ['ellipse', { cx: 12, cy: 5, rx: 2.7, ry: 3.3 }],
    ['rect', { x: 9.5, y: 9.2, width: 5, height: 13, rx: 2.3 }],
    ['circle', { cx: 5.2, cy: 9.6, r: 1.9 }],
    ['rect', { x: 3, y: 12.6, width: 4.4, height: 9.6, rx: 2 }],
    ['circle', { cx: 18.8, cy: 9.6, r: 1.9 }],
    ['rect', { x: 16.6, y: 12.6, width: 4.4, height: 9.6, rx: 2 }],
  ] },
  // Stetoskop (çizgi): kulaklıklar içe kıvrık, hortum uzun, göğüs parçası halka.
  stetoskop: { vb: 24, yollar: [
    ['path', { ...CIZGI(2), d: 'M6.6 3.2H5.4a1.2 1.2 0 0 0-1.2 1.2v4.8a5.1 5.1 0 0 0 10.2 0V4.4a1.2 1.2 0 0 0-1.2-1.2H12' }],
    ['path', { ...CIZGI(2), d: 'M9.3 14.3v2.2a4.6 4.6 0 0 0 9.2 0v-2.2' }],
    ['circle', { ...CIZGI(2), cx: 18.5, cy: 12, r: 2.3 }],
  ] },
  // bi: person-fill — hasta adı; kâğıttaki "Name"
  hasta: { vb: 16, yollar: [['path', { d: 'M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6' }]] },

  /* ---- Clinical: form kartı ve kâğıt sütunu aynı yolları kullanır ---- */
  // Kan basıncı: dolu kalp, ortasında kenarlara değmeyen kısa bir nabız oyuğu.
  tansiyon: { vb: 24,
    yollar: [['path', { d: 'M12 21.2s-8.2-5.2-8.2-11.2a4.7 4.7 0 0 1 8.2-3.1 4.7 4.7 0 0 1 8.2 3.1c0 6-8.2 11.2-8.2 11.2z' }]],
    oyuk: [['path', { ...OYUK(1.4), d: 'M7.6 12.6h2.4l1.1-2.2 1.6 4.4 1.1-2.2h2.6' }]],
  },
  // Nabız: açık EKG çizgisi; eski çizimlerden daha yüksek genlikli.
  nabiz: { vb: 24, yollar: [['path', { ...CIZGI(2), d: 'M1 13h4.5l1.4-2.2 2.1 5.9 2.8-13.8 1.4 18 1.8-9.8 1.6 1.9H23' }]] },
  // bi: lungs-fill — solunum; kâğıdın ayağında "شش" rozeti
  akciger: { vb: 16, yollar: [['path', { d: 'M8 1a.5.5 0 0 1 .5.5v5.243L9 7.1V4.72C9 3.77 9.77 3 10.72 3c.524 0 1.023.27 1.443.592.431.332.847.773 1.216 1.229.736.908 1.347 1.946 1.58 2.48.176.405.393 1.16.556 2.011.165.857.283 1.857.24 2.759-.04.867-.232 1.79-.837 2.33-.67.6-1.622.556-2.741-.004l-1.795-.897A2.5 2.5 0 0 1 9 11.264V8.329l-1-.715-1 .715V7.214c-.1 0-.202.03-.29.093l-2.5 1.786a.5.5 0 1 0 .58.814L7 8.329v2.935A2.5 2.5 0 0 1 5.618 13.5l-1.795.897c-1.12.56-2.07.603-2.741.004-.605-.54-.798-1.463-.838-2.33-.042-.902.076-1.902.24-2.759.164-.852.38-1.606.558-2.012.232-.533.843-1.571 1.579-2.479.37-.456.785-.897 1.216-1.229C4.257 3.27 4.756 3 5.28 3 6.23 3 7 3.77 7 4.72V7.1l.5-.357V1.5A.5.5 0 0 1 8 1m3.21 8.907a.5.5 0 1 0 .58-.814l-2.5-1.786A.5.5 0 0 0 9 7.214V8.33z' }]] },
  // Kilo: dolu yuvarlak kare; üstte kadran halkası (ortası dolu), altta ibre oyuğu.
  tarti: { vb: 24, yollar: [['path', { 'fill-rule': 'evenodd', d:
    'M5.5 2.5h13a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3h-13a3 3 0 0 1-3-3v-13a3 3 0 0 1 3-3z'
    + 'M8.5 9a3.5 3.5 0 1 0 7 0 3.5 3.5 0 1 0-7 0z'
    + 'M10.8 9a1.2 1.8 0 1 0 2.4 0 1.2 1.8 0 1 0-2.4 0z'
    + 'M12 13.4a.9.9 0 0 1 .9.9v4a.9.9 0 0 1-1.8 0v-4a.9.9 0 0 1 .9-.9z' }]] },
  // Ateş (çizgi): içi boş hazne ve tüp, yanda ince çentikler.
  termometre: { vb: 24, yollar: [
    ['path', { ...CIZGI(1.8), d: 'M9.4 14.6V4a2.1 2.1 0 0 1 4.2 0v10.6a4.3 4.3 0 1 1-4.2 0z' }],
    ['path', { ...CIZGI(1.2), d: 'M15.8 5.6h1.3M15.8 7.9h1.3M15.8 10.2h1.3M15.8 12.5h1.3' }],
  ] },
  // SpO₂ (çizgi): içi boş damla.
  oksijen: { vb: 24, yollar: [['path', { ...CIZGI(2), d: 'M12 2.8s6.4 7 6.4 11.2a6.4 6.4 0 0 1-12.8 0C5.6 9.8 12 2.8 12 2.8z' }]] },
  // bi: person-standing — boy
  boy: { vb: 16, yollar: [['path', { d: AYAKTA_INSAN }]] },
  // Kan grubu: tasarımda yok (uygulamanın sekizinci satırı); çizgi tablosundaki
  // bantlı damla aynen, çizgiyle. İki tabloda ayrı ayrı yol tutulmasın.
  kan: { vb: 24, yollar: SIMGELER.kan.map(([etiket, nit]) => [etiket, { ...CIZGI(1.8), ...nit }]) },

  /* ---- Rx, ilaç listesi, düğmeler ---- */
  // bi: capsule — boş ilaç listesi (tasarımda 180° döndürülmüş; çağıran döndürür)
  kapsul: { vb: 16, yollar: [['path', { d: 'M1.828 8.9 8.9 1.827a4 4 0 1 1 5.657 5.657l-7.07 7.071A4 4 0 1 1 1.827 8.9Zm9.128.771 2.893-2.893a3 3 0 1 0-4.243-4.242L6.713 5.429z' }]] },
  // bi: trash-fill
  cop: { vb: 16, yollar: [['path', { d: 'M2.5 1a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1H3v9a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4h.5a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1zm3 4a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 .5-.5M8 5a.5.5 0 0 1 .5.5v7a.5.5 0 0 1-1 0v-7A.5.5 0 0 1 8 5m3 .5v7a.5.5 0 0 1-1 0v-7a.5.5 0 0 1 1 0' }]] },
  // bi: eye (kalınlaştırılmış)
  goz: { vb: 16, yollar: [
    ['path', { ...KALIN(0.45), d: 'M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z' }],
    ['path', { ...KALIN(0.45), d: 'M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0' }],
  ] },
  // bi: printer (kalınlaştırılmış)
  yazdir: { vb: 16, yollar: [
    ['path', { ...KALIN(0.4), d: 'M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1' }],
    ['path', { ...KALIN(0.4), d: 'M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2zm7 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1' }],
  ] },
  // bi: heart-fill — alt şeritteki kalp
  kalp: { vb: 16, yollar: [['path', { 'fill-rule': 'evenodd', d: 'M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314' }]] },

  /* ---- Reçete kâğıdı ---- */
  // bi: hourglass-split — "Age". Tasarımdaki açık kitap yaşla ilgisiz bir
  // üretim hatası; kum saati anlamı taşıyor.
  'kum-saati': { vb: 16, yollar: [['path', { d: 'M2.5 15a.5.5 0 1 1 0-1h1v-1a4.5 4.5 0 0 1 2.557-4.06c.29-.139.443-.377.443-.59v-.7c0-.213-.154-.451-.443-.59A4.5 4.5 0 0 1 3.5 3V2h-1a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-1v1a4.5 4.5 0 0 1-2.557 4.06c-.29.139-.443.377-.443.59v.7c0 .213.154.451.443.59A4.5 4.5 0 0 1 12.5 13v1h1a.5.5 0 0 1 0 1zm2-13v1c0 .537.12 1.045.337 1.5h6.326c.216-.455.337-.963.337-1.5V2zm3 6.35c0 .701-.478 1.236-1.011 1.492A3.5 3.5 0 0 0 4.5 13s.866-1.299 3-1.48zm1 0v3.17c2.134.181 3 1.48 3 1.48a3.5 3.5 0 0 0-1.989-3.158C8.978 9.586 8.5 9.052 8.5 8.351z' }]] },
  // bi: file-earmark-text (kalınlaştırılmış) — kâğıttaki "No"
  belge: { vb: 16, yollar: [
    ['path', { ...KALIN(0.3), d: 'M5.5 7a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1zM5 9.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5m0 2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 0 1h-2a.5.5 0 0 1-.5-.5' }],
    ['path', { ...KALIN(0.3), d: 'M9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5zm0 1v2A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z' }],
  ] },
  // Vecize kartuşunun iki yanındaki kalın artı: kolları yuvarlak uçlu.
  'arti-kalin': { vb: 24, yollar: [['path', { ...KALIN(1.5), 'stroke-linejoin': 'round', d: 'M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z' }]] },
  // Ayak rozetleri (koyu bant üstünde beyaz). Tasarımdaki böbrek (üç top) ve
  // baş ağrısı (erimiş kase) okunmuyordu; organlar yeniden çizildi.
  // Mide: yukarıda yemek borusu, sağa şişen gövde, altta sola dönüp
  // yukarı kıvrılan onikiparmak bağırsağı (J biçimi); gövdede tek kırışık.
  // Eskiden kutunun üçte biri kadardı ve «ط» harfi gibi okunuyordu.
  mide: { vb: 24,
    yollar: [['path', { d: 'M9.2 1.4h3.2v3.9C15.3 3.6 19.7 4.3 21.5 7.9c1.6 3.2 1.1 7.5-1.6 10.7-2.8 3.2-7.3 4.3-11 3.1-1.6-.5-2.9-1.4-3.9-2.4-1.2.8-2.9.7-3.6-.5-.6-1.2 0-2.7 1.4-2.9 1.3-.2 2.4.6 3.4 1.2 2.9 1.6 6.3.4 7.4-2.4.9-2.3.1-4.6-1.8-6.1C10 8.5 9.2 7.5 9.2 6z' }]],
    // Gövdenin içindeki kırışık: tasarımdaki tek koyu çizgi.
    oyuk: [['path', { ...OYUK(1.2), 'stroke-linecap': 'round', d: 'M16.4 8.6c1.9 1.1 2.9 3 2.7 5.2' }]],
  },
  bobrek: { vb: 24, yollar: [
    ['path', { d: 'M7.4 3.4c-2.7 0-4.6 2.9-4.6 6.4 0 3.9 1.9 6.9 4.7 6.9 1.9 0 3.1-1.3 3.1-2.9 0-1.2-.9-1.9-.9-3.9s.9-2.5.9-3.7c0-1.6-1.2-2.8-3.2-2.8z' }],
    ['path', { d: 'M16.6 3.4c2.7 0 4.6 2.9 4.6 6.4 0 3.9-1.9 6.9-4.7 6.9-1.9 0-3.1-1.3-3.1-2.9 0-1.2.9-1.9.9-3.9s-.9-2.5-.9-3.7c0-1.6 1.2-2.8 3.2-2.8z' }],
    ['path', { ...CIZGI(1.4), 'stroke-linecap': 'round', d: 'M9.6 10.6c1.4.8 1.6 2.8 1.6 5V21M14.4 10.6c-1.4.8-1.6 2.8-1.6 5V21' }],
  ] },
  // Şeker: insülin şişesi, ortasında damla oyuğu.
  sise: { vb: 24, yollar: [['path', { 'fill-rule': 'evenodd', 'stroke-linejoin': 'round', d:
    'M9 2.6h6v2.6h-1v1.9l4.1 3.1v10.6a1 1 0 0 1-1 1H6.9a1 1 0 0 1-1-1V10.2L10 7.1V5.2H9z'
    + 'M12 11.6s2.4 2.6 2.4 4.2a2.4 2.4 0 0 1-4.8 0c0-1.6 2.4-4.2 2.4-4.2z' }]] },
  // Romatizma: ayakta insan ve iki yanında ağrı yayları. İnsan kutunun
  // boyunca (eskiden yarısıydı), yaylar ona yakın.
  romatizma: { vb: 24, yollar: [
    ['path', { d: AYAKTA_INSAN, transform: 'translate(1.6 1.4) scale(1.3)' }],
    ['path', { ...CIZGI(1.4), 'stroke-linecap': 'round', d: 'M5.2 9q-1.6 3.4 0 6.8M18.8 9q1.6 3.4 0 6.8M2.6 7.6q-2.2 4.8 0 9.6M21.4 7.6q2.2 4.8 0 9.6' }],
  ] },
  // Baş ağrısı: yandan baş silueti ve şakaktan çıkan üç kısa çizgi.
  'bas-agrisi': { vb: 24, yollar: [
    ['path', { d: 'M15.2 22v-3.1c2.3-1.3 3.8-3.7 3.8-6.5 0-4.3-3.5-7.4-7.7-7.4-4 0-7 2.8-7.4 6.4l-1.6 2.6c-.3.5 0 1 .5 1h1.3v2.2c0 1.2 1 2.1 2.1 2.1h1.8V22z' }],
    ['path', { ...CIZGI(1.4), 'stroke-linecap': 'round', d: 'M19.4 3.8l1.6-1.6M21 7.6h2.2M16.4 2.4l.5-1.6' }],
  ] },
  // bi: geo-alt-fill — adres
  konum: { vb: 16, yollar: [['path', { d: 'M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10m0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6' }]] },
  // bi: briefcase-fill — antetteki «Professional Experience:» satırı
  canta: { vb: 16, yollar: [
    ['path', { d: 'M6.5 1A1.5 1.5 0 0 0 5 2.5V3H1.5A1.5 1.5 0 0 0 0 4.5v1.384l7.614 2.03a1.5 1.5 0 0 0 .772 0L16 5.884V4.5A1.5 1.5 0 0 0 14.5 3H11v-.5A1.5 1.5 0 0 0 9.5 1zm0 1h3a.5.5 0 0 1 .5.5V3H6v-.5a.5.5 0 0 1 .5-.5' }],
    ['path', { d: 'M0 12.5A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5V6.85L8.129 8.947a.5.5 0 0 1-.258 0L0 6.85z' }],
  ] },
  // bi: telephone-fill
  telefon: { vb: 16, yollar: [['path', { 'fill-rule': 'evenodd', d: 'M1.885.511a1.745 1.745 0 0 1 2.61.163L6.29 2.98c.329.423.445.974.315 1.494l-.547 2.19a.68.68 0 0 0 .178.643l2.457 2.457a.68.68 0 0 0 .644.178l2.189-.547a1.75 1.75 0 0 1 1.494.315l2.306 1.794c.829.645.905 1.87.163 2.611l-1.034 1.034c-.74.74-1.846 1.065-2.877.702a18.6 18.6 0 0 1-7.01-4.42 18.6 18.6 0 0 1-4.42-7.009c-.362-1.03-.037-2.137.703-2.877z' }]] },
};

const ogeler = (liste) => liste.map(([etiket, nit]) => {
  const e = document.createElementNS(NS, etiket);
  for (const [k, v] of Object.entries(nit)) e.setAttribute(k, String(v));
  return e;
});

// Maske kimlikleri belgede tekil olmalı: aynı simge sayfada birkaç kez çizilir.
let oyukSayaci = 0;

function doluCiz(svg, { vb, yollar, oyuk, ust = [] }) {
  svg.setAttribute('viewBox', `0 0 ${vb} ${vb}`);
  svg.setAttribute('fill', 'currentColor');
  let govde = ogeler(yollar);
  if (oyuk) {
    const kimlik = 'simge-oyuk-' + (++oyukSayaci);
    const maske = document.createElementNS(NS, 'mask');
    for (const [k, v] of Object.entries({ id: kimlik, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: vb, height: vb })) maske.setAttribute(k, String(v));
    // Maskede beyaz = görünür, siyah = oyulur. Bu beyaz ekrana çizilmiyor.
    maske.append(...ogeler([['rect', { width: vb, height: vb, fill: '#fff' }], ...oyuk]));
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('mask', `url(#${kimlik})`);
    g.append(...govde);
    govde = [maske, g];
  }
  svg.append(...govde, ...ogeler(ust));
}

/**
 * Satır içi SVG simge. `dolu: true` dolgulu tablodan çizer (reçete sayfası
 * tasarımı); yoksa çizgi tablosundan. Bilinmeyen ad sessizce "bilgi" çizer —
 * yeni bir adı simgeVar(ad, { dolu }) ile doğrula.
 */
export function simge(ad, { boy = 20, sinif = '', dolu = false } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(boy));
  svg.setAttribute('height', String(boy));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', ('simge ' + sinif).trim());
  if (dolu && Object.hasOwn(SIMGELER_DOLU, ad)) {
    doluCiz(svg, SIMGELER_DOLU[ad]);
    return svg;
  }
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.append(...ogeler(SIMGELER[ad] || SIMGELER.bilgi));
  return svg;
}

/** Ad, istenen tabloda (çizgi ya da `dolu`) var mı? */
export const simgeVar = (ad, { dolu = false } = {}) => Object.hasOwn(dolu ? SIMGELER_DOLU : SIMGELER, ad);

/** Dolgulu tablonun adları: testler ve belgeler için. */
export const doluSimgeAdlari = () => Object.keys(SIMGELER_DOLU);
