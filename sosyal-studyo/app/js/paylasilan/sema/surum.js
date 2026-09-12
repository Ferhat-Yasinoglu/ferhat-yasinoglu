// Tek şema sürümü: IndexedDB sürümü, yedek belgesi, Worker'ın X-SS-Sema başlığı
// hepsi bu sayıyı kullanır. Yayınlanmış bir sürümün göçü asla düzenlenmez;
// değişiklik = yeni sürüm + gocler.js'e yeni eleman.
export const SEMA_SURUMU = 1;

// Koleksiyon kataloğu. `onek`: kimlik öneki, `yedek`: yedek belgesine varsayılan
// olarak girer mi, `yerel`: yalnızca tarayıcıda yaşar (yedeğe ve sunucuya gitmez).
export const KOLEKSIYONLAR = {
  meta:             { onek: 'meta',   yedek: false, yerel: true,  tekil: true },
  ayarlar:          { onek: 'ayar',   yedek: true,  tekil: true },
  hesaplar:         { onek: 'hes',    yedek: true },
  akislar:          { onek: 'akis',   yedek: true },
  tetikleyiciler:   { onek: 'tet',    yedek: true },
  kurallar:         { onek: 'kural',  yedek: true },
  kisiler:          { onek: 'kisi',   yedek: true },
  etiketler:        { onek: 'etk',    yedek: true },
  segmentler:       { onek: 'seg',    yedek: true },
  puan_kurallari:   { onek: 'pk',     yedek: true },
  puan_olaylari:    { onek: 'puan',   yedek: true },
  kosular:          { onek: 'kosu',   yedek: true },
  gunluk:           { onek: 'gun',    yedek: false },
  sohbetler:        { onek: 'sohbet', yedek: true },
  mesajlar:         { onek: 'msj',    yedek: false },
  toplu_mesajlar:   { onek: 'toplu',  yedek: true },
  kancalar:         { onek: 'kanca',  yedek: true },
  fikirler:         { onek: 'fikir',  yedek: true },
  senaryolar:       { onek: 'sen',    yedek: true },
  video_analizleri: { onek: 'vid',    yedek: true },
  karuseller:       { onek: 'karu',   yedek: true },
  galeri:           { onek: 'gal',    yedek: true },
  ai_brifingler:    { onek: 'brif',   yedek: true },
  cevapsiz_sorular: { onek: 'soru',   yedek: true },
  hos_geldin:       { onek: 'hg',     yedek: true },
  referans_linkleri:{ onek: 'ref',    yedek: true },
  dosyalar:         { onek: 'dosya',  yedek: false, yerel: true },
  anliklar:         { onek: 'anlik',  yedek: false, yerel: true },
  giden_kutusu:     { onek: 'giden',  yedek: false, yerel: true },
  gizli:            { onek: 'gizli',  yedek: false, yerel: true },
};

export const KOLEKSIYON_ADLARI = Object.keys(KOLEKSIYONLAR);

// Yedek belgesine asla girmeyecekler: gizli değerler, blob'lar, kuyruklar, anlık görüntüler.
export const YEDEGE_GIRMEZ = new Set(['gizli', 'dosyalar', 'giden_kutusu', 'anliklar', 'meta']);
