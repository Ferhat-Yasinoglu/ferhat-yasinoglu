// Reçete yazma ekranı: SOLDA form, SAĞDA canlı kâğıt.
//
// Hekim soldaki alanları doldurdukça sağdaki kâğıt anında yazılıyor —
// "birinci sayfayı doldur, ikinci sayfa olarak yazılsın". Kâğıt yalnız
// önizleme değil: üzerindeki alanlara dokunmak da çalışıyor, yani reçete
// iki yönden de doldurulabiliyor.
//
// Kâğıdın çizimi kagit.js'te tek yerde duruyor; burası onu `duzenlenebilir`
// kipinde çizdirip `data-alan` işaretlerinden yakalıyor. İkinci bir kâğıt
// kopyası yok — basılan neyse önizlenen de o.
//
// Eski form (recete-yeni.js) bunun yerine geçti ve kaldırıldı. Oradaki her
// şey buraya taşındı: alerji uyarıları, şablonlar, düzenleme ve ilaç satırı
// kutusu — sonuncusu artık ilac-satir-arayuz.js'te, iki yerden de kullanılsın
// diye değil, tek yerde dursun diye.
import { el, temizle, btn, btnS, girdi, alan, kart, bosDurum, uyariSeridi, onayKutusu, rozet } from '../cekirdek/dom.js';
import { tarihSecici } from '../cekirdek/tarih-secici.js';
import { simge } from '../cekirdek/simge.js';
import { rxIsareti } from '../cekirdek/cizimler.js';
import { kagitCiz, kagidiYazdir, kagidiOlcekle, tarayiciBaskisi, OLCUM_SIMGELERI } from '../kagit.js';
import { onizlemePaneli, pdfKaydet, yaprakRozeti, yaprakSayisi, yaprakMetni } from '../onizleme-arayuz.js';
import {
  OLCUMLER, KAN_GRUPLARI, bosRecete, receteDogrula, receteUyarilari, sikIlaclar, sonKullanimlar, bpBol, bpBirlestir,
} from '../paylasilan/recete.js';
import { klinigiOku } from '../depo/klinik.js';
import { katalogOku, katalogdanKaydet } from '../depo/hazir-ilaclar.js';
import {
  gecmisler, adIndeksi, parcala, secili, degistir, taniDegistir, ara, siklar, kagitAdi, normalizeFa, gosterilecekler,
} from '../paylasilan/klinik.js';
import { katalogIndeksi, havuz, aramaDizini, ilacSuz } from '../paylasilan/ilac-listesi.js';
import { secimKutusu } from '../klinik-arayuz.js';
import { satirKutusu, ilacGorunenAd } from '../ilac-satir-arayuz.js';
import { sablonuUygula } from '../paylasilan/sablon.js';
import { sablonSecKutusu, sablonKaydetKutusu } from '../sablon-arayuz.js';
import { tamAd, hastaYasi, hastaAra, alerjiCakismasi } from '../paylasilan/hasta.js';
import { FORMLAR, formAdi, satirAdi, satirGorunumu } from '../paylasilan/ilac.js';
import { normalize } from '../paylasilan/metin.js';
import { receteKaydet } from '../depo/recete.js';
import { bugun } from '../paylasilan/tarih.js';
import { t, secenekAdi } from '../i18n.js';
import { dogrulaMetni, hataMetni, uyariMetni } from '../hatalar.js';
import { enterleOnayla, kutuyuOnayla } from '../cekirdek/modal.js';

/** Basit liste kutusu: ara, seç. Hasta ve kan grubu için. */
async function listeKutusu(ctx, { baslik, kayitlar, ara, etiket, alt }) {
  const { modal } = ctx;
  let secilen = null;
  const kutu = girdi({ type: 'search', name: 'kagitArama', placeholder: t('genel.ara', 'Ara…') });
  const liste = el('div', { class: 'liste', style: { maxBlockSize: '46vh', overflowY: 'auto' } });

  function ciz() {
    temizle(liste);
    const bulunan = ara(kayitlar, kutu.value).slice(0, 40);
    if (!bulunan.length) {
      liste.appendChild(el('div', { class: 'liste__satir sessiz' }, t('klinik.eslesme_yok', 'Eşleşen kayıt yok')));
      return;
    }
    for (const k of bulunan) {
      liste.appendChild(el('button', {
        class: 'liste__satir liste__satir--tiklanir', type: 'button',
        style: { border: 'none', background: 'none', textAlign: 'start', font: 'inherit', cursor: 'pointer', inlineSize: '100%' },
        onclick: (e) => { secilen = k; kutuyuOnayla(e.currentTarget); },
      },
        el('div', { class: 'liste__govde' },
          el('div', { class: 'liste__baslik' }, etiket(k)),
          el('div', { class: 'liste__alt' }, (alt ? alt(k) : '') || '—'))));
    }
  }
  kutu.oninput = ciz;
  // Enter yalnız TEK eşleşme kalınca seçiyor: tek hasta kalana kadar yazıp
  // Enter. Önce ilk eşleşmeyi alıyordu; boş kutuda Enter listenin ilk
  // hastasını ya da ilk kan grubunu (A Rh+) kâğıda yazıyordu. Adı tam
  // yazılan kayıt da sayılıyor: «B Rh+» «AB Rh+»ya da uyuyor.
  enterleOnayla(kutu, () => {
    const q = kutu.value.trim().toLowerCase();
    const bulunan = q ? ara(kayitlar, kutu.value) : [];
    const tam = bulunan.filter((k) => String(etiket(k)).trim().toLowerCase() === q);
    const tek = bulunan.length === 1 ? bulunan : tam;
    if (tek.length !== 1) return false;
    [secilen] = tek;
    return true;
  });
  ciz();

  const sonuc = await modal({
    baslik, genis: true,
    govde: el('div', {}, kutu, liste),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('genel.sec', 'Seç'), sinif: 'btn--birincil', cb: () => secilen || false },
    ],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc : null;
}

/** Tek satırlık değer kutusu: ölçümler, not, tarih. */
async function degerKutusu(ctx, { baslik, deger = '', ipucu = '', tur = 'text' }) {
  const kutu = girdi({ type: tur, name: 'deger', value: deger, placeholder: ipucu });
  enterleOnayla(kutu);
  const sonuc = await ctx.modal({
    baslik,
    govde: el('div', {}, kutu),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('genel.kaydet', 'Kaydet'), sinif: 'btn--birincil', cb: () => ({ deger: kutu.value.trim() }) },
    ],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc.deger : null;
}

/* Kâğıdın üstündeki «Date» alanına dokununca açılan kutu. degerKutusu ile
   `tur: 'date'` kullanılıyordu, yani tarayıcının MİLADİ takvimi: soldaki alan
   şemsiye çevrilmişti ama bu üçüncü giriş noktası gözden kaçmıştı. */
async function semsiKutusu(ctx, deger) {
  const secici = tarihSecici({ value: deger, etiket: t('genel.tarih', 'Tarih') });
  enterleOnayla(secici.querySelector('input:not([type=hidden])'));
  const sonuc = await ctx.modal({
    baslik: t('genel.tarih', 'Tarih'),
    govde: el('div', {}, secici),
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('genel.kaydet', 'Kaydet'), sinif: 'btn--birincil', cb: () => ({ deger: secici.value }) },
    ],
  });
  return sonuc && typeof sonuc === 'object' ? sonuc.deger : null;
}

/* Tablodaki sayı ile birimi bölünmez boşlukla bağlı: dar sütunda ad kelime
   arasından kırılıyor, «20 / mg» diye sayısından değil. */
const bolunmez = (m) => String(m ?? '').replace(/(\d) (?=\D)/g, '$1\u00a0');

/* Formdaki ölçüm satırlarının simgeleri kâğıdın Clinical sütunuyla aynı
   adlar (kagit.js OLCUM_SIMGELERI, dolgulu tablodan): tek liste. Çizim
   kutuları (px) tasarımdaki mürekkep boyuna göre ayrı ayrı: her simgenin
   viewBox'ındaki boşluk farklı. */
const OLCUM_SIMGE_BOY = {
  bp: 34, pr: 30, rr: 32, bw: 30, temp: 34, spo2: 32, ht: 36, kanGrubu: 32,
};
/* Tasarımda Temperature, SpO2 ve Height kutuları dar (52 px), öbürleri
   geniş (84 px). Blood Gr. kutu ile birim sütununu birlikte kaplıyor. */
const OLCUM_DAR = new Set(['temp', 'spo2', 'ht']);

/* Etiketler kâğıttakinin AYNISI olsun: hekim solda "T" görüp sağda
   "Temperature" okumasın. */
const OLCUM_ETIKET = {
  bp: 'BP', pr: 'PR', rr: 'RR', bw: 'BW',
  temp: 'Temperature', spo2: 'SpO2', ht: 'Height', kanGrubu: 'Blood Gr.',
};
/* Sayı klavyesi: telefonda harf klavyesi açılmasın. Ondalıklılar ayrı. */
const OLCUM_KLAVYE = { pr: 'numeric', rr: 'numeric', spo2: 'numeric', bw: 'decimal', temp: 'decimal', ht: 'decimal' };

/** Açılır seçim: tarayıcının oku yerine uygulamanın simgesi (iki temada da
 *  aynı çizgide), kutunun bitiş ucunda. */
const acilir = (attrs, secenekler, secili = '') => el('span', { class: 'acilir' },
  el('select', { class: 'input', ...attrs },
    ...secenekler.map(([v, m]) => el('option', { value: v, selected: v === secili }, m))),
  simge('asagi', { boy: 16, sinif: 'acilir__ok' }));

/** Kart başlığı: okuma yönünde önce simge, sonra başlık, istenirse sonda ek. */
function kartBasligi(simgesi, baslik, ek = null) {
  return el('div', { class: 'kart__bas kart__bas--serit' },
    el('span', { class: 'kart__bas-simge' }, simgesi),
    el('h2', {}, baslik), ek);
}

/* Arama sonuçlarında ok tuşlarıyla gezinme: aşağı ilk sonuca, sonuçlar
   arasında aşağı/yukarı, ilkinde yukarı kutuya; Escape paneli kapatıp
   kutuya dönüyor. İlaç ve tanı aramasında aynı. */
function oklarlaGez(kutu, panel, kapat) {
  const satirlar = () => [...panel.querySelectorAll('button')];
  kutu.addEventListener('keydown', (e) => {
    // Arama kutusunda Escape tarayıcıda yazılanı da siliyor: yalnız panel kapansın.
    if (e.key === 'Escape') { e.preventDefault(); kapat(); return; }
    if (e.key !== 'ArrowDown') return;
    const ilk = satirlar()[0];
    if (ilk) { e.preventDefault(); ilk.focus(); }
  });
  panel.addEventListener('keydown', (e) => {
    const liste = satirlar();
    const i = liste.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); (liste[i + 1] || liste[i]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (i ? liste[i - 1] : kutu).focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); kapat(); kutu.focus(); }
  });
}

export default {
  baslik: 'Reçete kâğıdı',
  async cizim(kok, ctx) {
    // Kâğıt veriyi beklerken başka bir sayfaya geçilirse eski çizim geri
    // dönüp yeni sayfanın üstüne yazıyordu: her beklemeden sonra
    // yönlendiriciye sorulur (sayfanın kendi sayacı başka sayfaya geçişi
    // görmüyordu).
    const { depo, git, basari, hata, onayla, guncel } = ctx;
    const [ilkIlaclar, hastalar, ayar, ilkSablonlar, gecmisReceteler, klinik, katalog] = await Promise.all([
      depo.listele('ilaclar', { sirala: 'ad' }),
      depo.listele('hastalar', { sirala: 'soyad' }),
      depo.ayarlar(),
      depo.listele('sablonlar', { sirala: 'ad' }),
      depo.listele('receteler'),
      klinigiOku().catch(() => null),
      // Hazır ilaç listesi (uygulamayla gelen dosya, önbellekte): reçetede
      // hekimin kendi ilaçlarıyla birlikte aranıyor. Okunamazsa yalnız kendi
      // ilaçları aranır.
      katalogOku().catch(() => null),
    ]);
    // Hazır listeden seçilen ilaç kayda dönüşünce buraya ekleniyor.
    let ilaclar = ilkIlaclar;
    if (!guncel()) return;

    const duzenleme = ctx.param.id ? await depo.al('receteler', ctx.param.id) : null;
    if (!guncel()) return;

    /* Yepyeni kurulumda karşılama. Bu sayfa artık uygulamanın GİRİŞ sayfası;
       eskiden karşılama yalnız paneldeydi ve hekim buraya ancak kendi gelirdi.
       O karşılama olmadan yeni kuran hekim boş bir kâğıda düşüyor: ne hasta
       var, ne dava, ne de nereden başlayacağını söyleyen bir şey. */
    if (!duzenleme && !ilkIlaclar.length && !hastalar.length) {
      /* Boş cihaz çoğu zaman yeni kurulmuş ya da verisi silinmiş bir cihaz
         (iOS Safari sekmesi 7 günde siler, ana ekran uygulamasının deposu
         ayrı): hesabı olan hekim girişi Ayarlar'da aramadan bulsun. Sunucu
         yoksa ya da zaten girişliyse düğme yok — gideceği yer boş olurdu. */
      const hesapDurumu = ctx.hesap?.sunucuVar ? await ctx.hesap.hesapDurumu() : null;
      if (!guncel()) return;
      // Kökü sayfa modülü temizler, yönlendirici değil: temizlemezsek
      // index.html'deki «javascript kapalı» metni karşılamanın üstünde kalıyor.
      temizle(kok);
      kok.appendChild(bosDurum({
        simge: 'kalem',
        baslik: t('kagit.ilk_baslik', 'Reçete yazmaya hazır'),
        alt: t('kagit.ilk_alt', 'Önce bir hasta ve birkaç dava lazım. Ayarlar\'dan hazır dava listesini yükleyebilir ya da örnek kayıtlarla deneyebilirsin — ikisi de tek tuşla silinir.'),
        eylem: el('div', { class: 'satir' },
          btnS('hasta', t('kagit.ilk_hasta', 'Hasta ekle'), { class: 'btn btn--birincil', onclick: () => git('/hastalar') }),
          btnS('ayarlar', t('panel.ayarlara_git', 'Ayarlar\'a git'), { class: 'btn', onclick: () => git('/ayarlar') }),
          hesapDurumu && !hesapDurumu.girisli
            ? btnS('kilit', t('hesap.var_mi', 'Hesabın var mı? Giriş yap'), { class: 'btn btn--sade', onclick: () => git('/ayarlar?hesap=1') })
            : null),
      }));
      return;
    }

    let sablonlar = ilkSablonlar;
    let recete = duzenleme ? { ...duzenleme } : bosRecete(ayar, bugun());
    let hasta = recete.hastaId ? hastalar.find((h) => h.id === recete.hastaId) : null;
    // Hasta kartındaki "reçete yaz" düğmesi hastayı adreste taşıyor.
    if (!duzenleme && ctx.sorgu?.hasta) {
      hasta = hastalar.find((h) => h.id === ctx.sorgu.hasta) || null;
      if (hasta) { recete.hastaId = hasta.id; recete.kanGrubu = hasta.kanGrubu || ''; }
    }
    let hatalar = {};
    // Kan grubu hekimin elle yazdığı mı, yoksa hastanın kaydından mı geldi?
    // Kayıttan geldiyse hasta değişince yenisininkiyle değişiyor; önce ilk
    // hastanınki kalıyor ve başka birinin kan grubu kâğıda basılıyordu.
    // Düzenlemede kayıttaki değer hastanınkinden farklıysa elle yazılmış.
    let kanElle = Boolean(duzenleme) && (recete.kanGrubu || '') !== (hasta?.kanGrubu || '');
    // Sayfadan çıkılınca false: kapanan kutudan geç dönen iş (seçim,
    // yeniden çizim) artık başka bir sayfanın yerine yazmasın.
    let aktif = true;
    const sikYazilanlar = sikIlaclar(gecmisReceteler, ilaclar);
    const sikIdler = sikYazilanlar.map((x) => x.id);
    // Hekimin her ilaca en son yazdığı kullanım (kendi reçetelerinden, saf).
    const hafiza = sonKullanimlar(gecmisReceteler);
    // Az önce eklenen ilaç satırının sırası: bir sonraki çizimde o satır
    // yükselerek giriyor, sonra sıfırlanıyor.
    let yeniSatir = null;

    /* --- İlaç arama havuzu: hekimin kendi ilaçları + hazır liste ---
       Liste depoya yazılmadan yerinde aranıyor; seçilen satır ancak satır
       kutusu onaylanınca kayda dönüşüyor (katalogdanKaydet). Dizin havuz
       değişince (yeni kayıt) yeniden kuruluyor, her tuşta değil. */
    const katalogIlaclari = katalog?.ilaclar || [];
    const katalogIndeks = katalogIndeksi(katalogIlaclari);
    let dizin = [];
    let suzgecler = { grup: [], form: [], marka: [] };
    function dizinKur() {
      dizin = aramaDizini(havuz(ilaclar, katalogIlaclari), katalogIndeks);
      // Süzgeçte yalnız havuzda karşılığı olan seçenekler: boş sonuç veren
      // bir seçenek hekimi yanıltırdı.
      const gruplar = new Set(dizin.map((d) => d.grup));
      const formlar = new Set(dizin.map((d) => d.ilac.form));
      const markalar = new Set(dizin.map((d) => d.marka));
      suzgecler = {
        grup: (katalog?.gruplar || []).filter((g) => gruplar.has(g.anahtar)).map((g) => [g.anahtar, g.ad]),
        form: FORMLAR.filter(([k]) => formlar.has(k)).map(([k]) => [k, secenekAdi(FORMLAR, k, 'form')]),
        marka: markalar.size > 1
          ? [['marka', t('recete.marka_marka', 'Marka')], ['jenerik', t('recete.marka_jenerik', 'Jenerik')]] : [],
      };
    }
    dizinKur();
    const havuzdaAra = (q, suzgec = {}) => ilacSuz(dizin, q, suzgec, { sikIdler });
    /** Hazır listeden seçilen satırı kayda çevirir; havuz yeni kaydı tanısın. */
    async function kayda(secilen) {
      const k = await katalogdanKaydet(depo, secilen);
      if (!ilaclar.some((x) => x.id === k.id)) { ilaclar = [...ilaclar, k]; dizinKur(); }
      return k;
    }
    const satirSecenekleri = (ilac = null) => ({ ilac, ara: (q) => havuzdaAra(q).sonuclar, kayda, klinik, hafiza });

    /* Formdaki arama durumu. Sayfa her kutudan sonra baştan çiziliyor;
       yazılan arama, süzgeçler ve kontrol listelerinin satırları burada
       yaşıyor ki çizim onları sıfırlamasın. «پاک کردن فرم» sıfırlıyor. */
    const bosArama = () => ({ q: '', grup: '', form: '', marka: '', acik: false });
    let arama = bosArama();
    let taniAramasi = '';
    let gosterilen = { belirtiler: [], laboratuvar: [] };
    // Çizimden sonra odağın gideceği yer, odaktaki öğeden başka bir yere
    // gitmesi gerektiğinde (ilaç eklenince arama kutusu, çip silinince yanı).
    let sonrakiOdak = null;

    /* --- Kâğıttaki alan → ne açılacak --- */
    const eylemler = {
      hasta: async () => {
        const h = await listeKutusu(ctx, {
          baslik: t('recete.hasta_sec', 'Hasta seç'), kayitlar: hastalar, ara: hastaAra,
          etiket: tamAd, alt: (x) => [x.telefon, x.kanGrubu].filter(Boolean).join(' · '),
        });
        if (h) {
          // Kan grubu hastanın kaydından mühürleniyor; kâğıtta değiştirilebilir.
          // Yalnız hasta GERÇEKTEN değişince: aynı hasta yeniden seçilince
          // reçetedeki değer (düzenlemede elle yazılmış olabilir) silinmesin.
          if (h.id !== hasta?.id && !kanElle) recete.kanGrubu = h.kanGrubu || '';
          hasta = h; recete.hastaId = h.id;
        }
      },
      tarih: async () => {
        const d = await semsiKutusu(ctx, recete.tarih);
        if (d) recete.tarih = d;
      },
      kanGrubu: async () => {
        const g = await listeKutusu(ctx, {
          baslik: t('recete.kan_sec', 'Kan grubu seç'),
          kayitlar: KAN_GRUPLARI.map((x) => ({ ad: x })),
          ara: (liste, q) => liste.filter((x) => x.ad.toLowerCase().includes(String(q || '').toLowerCase())),
          etiket: (x) => x.ad, alt: () => t('kagit.kan', 'Kan grubu'),
        });
        if (g) { recete.kanGrubu = g.ad; kanElle = true; }
      },
      // Antet ayarlardan geliyor, kâğıt üzerinden yazılmıyor: boş yer tutucuya
      // dokunmak Ayarlar'a götürüyor. Hekimin kâğıtta gördüğü eksiği
      // düzeltebileceği tek yer orası.
      antet: async () => { git('/ayarlar'); },
      belirtiler: () => klinikSec('belirtiler', klinik?.belirtiler, klinik?.gruplar, t('recete.belirtiler', 'Belirti ve bulgular')),
      tani: () => klinikSec('tani', klinik?.tanilar, klinik?.gruplar, t('recete.tani_sec', 'Tanı seç'), 'taniKodu'),
      laboratuvar: () => klinikSec('laboratuvar', klinik?.laboratuvar, klinik?.labGruplari, t('recete.lab_sec', 'Laboratuvar / görüntüleme seç')),
      'ilac-ekle': () => satirEkle(),
      notlar: async () => {
        const n = await degerKutusu(ctx, { baslik: t('recete.not', 'Reçete notu'), deger: recete.notlar });
        if (n !== null) recete.notlar = n;
      },
    };

    async function klinikSec(alanAdi, liste, gruplar, baslik, kodAlani = null) {
      if (!liste) { hata(t('hata.tani_okunamadi', 'Klinik listeler okunamadı.')); return; }
      const y = await secimKutusu(ctx, {
        liste, gruplar, baslik, kodAlani, recete, alan: alanAdi,
        // Dizinle: eski reçetedeki Dari «تب» ile yenisindeki «Fever» tek sayılsın.
        gecmis: gecmisler(gecmisReceteler, alanAdi, kodAlani, 8, adIndeksi(liste)),
      });
      if (!y) return;
      recete[alanAdi] = y.metin;
      if (kodAlani) recete[kodAlani] = y.kodlar;
    }

    /** Satır kutusu boş ya da ilacı seçili açılıyor; onaylanan satır sona
     *  ekleniyor. Vazgeçilirse false: çağıran yeniden çizmesin. */
    async function satirEkle(ilac = null) {
      const y = await satirKutusu(ctx, ilaclar, hasta, null, sikYazilanlar, satirSecenekleri(ilac));
      if (!y) return false;
      recete.satirlar = [...recete.satirlar, y];
      yeniSatir = recete.satirlar.length - 1;
      return true;
    }

    /** Tablodaki (ya da kâğıttaki) satıra dokununca: aynı kutu, dolu gelir.
     *  Kutudaki "Sil" satırı çıkarır. */
    async function satirDuzenle(i) {
      const s = recete.satirlar[i];
      if (!s) return;
      const y = await satirKutusu(ctx, ilaclar, hasta, s, sikYazilanlar, satirSecenekleri());
      if (y === 'sil') {
        if (await onayla(t('recete.satir_sil_soru', '"{ad}" reçeteden çıkarılsın mı?', { ad: satirAdi(s) }))) {
          recete.satirlar = recete.satirlar.filter((_, j) => j !== i);
        }
      } else if (y) {
        recete.satirlar = recete.satirlar.map((x, j) => (j === i ? y : x));
      }
    }

    /** Tablodaki çöp kutusu ve ad düğmesindeki Delete: sormadan silmiyor. */
    async function satirSil(i) {
      const s = recete.satirlar[i];
      if (!s) return;
      if (!await onayla(t('recete.satir_sil_soru', '"{ad}" reçeteden çıkarılsın mı?', { ad: satirAdi(s) }))) return;
      recete.satirlar = recete.satirlar.filter((_, j) => j !== i);
      ciz();
    }

    async function olcumDuzenle(anahtar) {
      const [, ad, , birim] = OLCUMLER.find(([k]) => k === anahtar) || [];
      const d = await degerKutusu(ctx, {
        baslik: t('olcum.' + anahtar, ad || anahtar), deger: recete.olcumler?.[anahtar] ?? '', ipucu: birim,
      });
      if (d !== null) recete.olcumler = { ...recete.olcumler, [anahtar]: d };
    }

    // Kayıt sürerken ikinci bir kayıt başlamasın: Ctrl+S basılı tutulunca ya
    // da düğmeye art arda basılınca aynı reçete iki kez yazılıyordu.
    let kaydediliyor = false;
    async function kaydet({ yazdir = false, pdf = false } = {}) {
      if (kaydediliyor) return;
      hatalar = receteDogrula(recete);
      if (Object.keys(hatalar).length) { ciz(); hata(dogrulaMetni(Object.values(hatalar)[0])); return; }
      kaydediliyor = true;
      try {
        const kayit = await receteKaydet(depo, recete);
        // Numara yalıtılmış (LRI … PDI): Farsça cümlenin içinde tireli rakam
        // dizisi ters diziliyordu («01-24-09-2026»).
        basari(t('recete.kaydedildi', 'Reçete kaydedildi: {no}', { no: `⁦${kayit.receteNo}⁩` }));
        // Kayıt sürerken sayfadan çıkıldıysa hekimi geri çekmiyoruz.
        if (!aktif) return;
        // Yazdırma KAYITTAN SONRA: basılan kâğıtta reçete numarası ve
        // doğrulama kodu var, ikisi de kaydederken üretiliyor.
        // Beklenmeli: yazdırma yazı yüzünü bekliyor, git() o arada sayfayı
        // değiştirip basılacak kâğıdı söküyordu.
        if (yazdir) await (pdf ? pdfKaydet : kagidiYazdir)({ ayar, recete: kayit, hasta });
        git('/recete/' + kayit.id);
      } catch (e) { hata(hataMetni(e)); } finally { kaydediliyor = false; }
    }

    /* Önizleme: kâğıdın tamamı kutuya sığacak kadar ölçekli (eni ve boyu).
       Yalnız ene göre ölçeklenince kutu sayfanın ancak üst yarısını
       gösteriyordu; ayak, QR ve imza kaydırmadan görünmüyordu. Tasarımın
       ortadaki düğmesi bu; yalnız kaydetmek de buradan (ya da Ctrl+S).
       Telefonda kâğıt formun altında kaldığı için onu görmenin en kısa yolu
       da bu. Kâğıt dokunulamaz çiziliyor: kutudaki kopya yalnız bakmak için,
       data-alan işaretleri sayfadaki asıl kâğıtta kalıyor. Ayaktaki
       düğmelerin simgeleri formdakilerle aynı. */
    async function onizlemeAc() {
      const kagit = kagitCiz({ ayar, recete, hasta });
      const tuval = el('div', { class: 'kagit-tuval' }, kagit);
      // Bölünen kâğıtta başlık yaprak sayısını da söylüyor: yapraklar kutunun
      // içinde alt alta, ikincisi ancak kaydırınca görünüyor.
      const yaprak = yaprakSayisi(kagit);
      const secim = ctx.modal({
        baslik: [t('recete.onizleme', 'Basılacak kâğıt'), yaprak > 1 ? yaprakMetni(yaprak) : ''].filter(Boolean).join(' · '),
        genis: true, sinif: 'modal--onizleme',
        govde: tuval,
        dugmeler: [
          { metin: t('genel.kapat', 'Kapat'), simge: simge('kapat', { boy: 20 }), sinif: 'recete-btn recete-btn--sade', deger: null },
          { metin: t('recete.kaydet', 'Reçeteyi kaydet'), simge: simge('kaydet', { boy: 20 }), sinif: 'recete-btn recete-btn--ikincil', deger: 'kaydet' },
          { metin: t('recete.kaydet_yazdir', 'Kaydet ve yazdır'), simge: simge('yazdir', { boy: 21, dolu: true }), sinif: 'recete-btn recete-btn--asil', deger: 'yazdir' },
        ],
      });
      // Kâğıda kalan boy: kutunun en büyük boyu (CSS'teki max-block-size ya
      // da örtünün içi) eksi başlık, ayak ve gövde payı. Hiçbiri kâğıdın
      // boyuna bağlı değil; gözlenen de ekran boyundaki örtü, yani ölçek
      // kendi değişikliğiyle kendini yeniden tetiklemiyor.
      const govde = tuval.parentElement;
      const kutu = govde.parentElement;
      const ortu = kutu.parentElement;
      const kalanBoy = () => {
        const g = getComputedStyle(govde);
        const o = getComputedStyle(ortu);
        const enBuyuk = Math.min(parseFloat(getComputedStyle(kutu).maxBlockSize) || Infinity,
          ortu.clientHeight - parseFloat(o.paddingBlockStart) - parseFloat(o.paddingBlockEnd));
        return enBuyuk - (kutu.offsetHeight - govde.clientHeight)
          - parseFloat(g.paddingBlockStart) - parseFloat(g.paddingBlockEnd);
      };
      const birak = kagidiOlcekle(tuval, kagit, ortu, { yukseklik: kalanBoy });
      const sonuc = await secim;
      birak();
      if (sonuc === 'kaydet') kaydet({});
      else if (sonuc === 'yazdir') kaydet({ yazdir: true });
    }

    /** Kâğıdı yeniden çizer. Formun HER tuşunda sayfanın tamamını çizmek
     *  yazarken odağı düşürüyordu; yalnız önizleme tazeleniyor. */
    let onizlemeKabi = null;
    let tazeleZamani = 0;
    // Önceki kâğıdın boyut gözcüsü: her tazelemede yenisi kuruluyor, eskisi
    // bırakılmazsa aynı tuvale ayrılmış kâğıdın boyunu (0) yazıyordu.
    let olcekBirak = null;
    function kagidiTazele() {
      if (!onizlemeKabi || !onizlemeKabi.isConnected) return;
      temizle(onizlemeKabi);
      const kagit = kagitCiz({ ayar, recete, hasta, duzenlenebilir: true });
      onizlemeKabi.appendChild(kagit);
      yaprakRozeti(onizlemeKabi.parentElement, kagit);
      olcekBirak?.();
      olcekBirak = olcekle(onizlemeKabi, kagit);
    }
    /** Yazarken her tuşta kâğıt yeniden çizilmesin: QR üretimi pahalı. */
    function tazeleGecikmeli() {
      clearTimeout(tazeleZamani);
      tazeleZamani = setTimeout(kagidiTazele, 180);
    }

    /* Pay yok: kâğıt önizleme sütununun tam genişliğinde, tasarımdaki gibi.
       Yan yana düzende boyu da ekrana sığıyor: önizleme yapışkan ama ızgara
       satırı formla bitiyor; kâğıt ekrandan uzunsa hekim düğmelere inince
       antet üst çubuğun altına kayıyordu (1536×864'te 145 px). Üstte CSS'teki
       yapışma ofseti (üst çubuk + 10, formun tepesiyle aynı hiza); altta
       ızgaranın altında kalan yer (alt şerit ve pay): sayfanın dibinde
       yapışkan kutu ancak ızgaranın dibine kadar inebiliyor. */
    const ikiSutun = matchMedia('(min-width: 1280px)');
    const sigacakBoy = () => {
      const duzen = kok.querySelector('.recete-duzen');
      if (!ikiSutun.matches || !duzen) return Infinity;
      const ust = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ust-cubuk'));
      const alti = document.documentElement.scrollHeight - scrollY - duzen.getBoundingClientRect().bottom;
      // Panelin başlık satırı ve kenarlığı da kâğıdın üstünde yer tutuyor.
      const bas = kok.querySelector('.recete-onizleme__bas')?.offsetHeight || 0;
      return innerHeight - ust - 10 - Math.max(12, alti) - bas - 2;
    };
    const olcekle = (tuval, kagit) => kagidiOlcekle(tuval, kagit, kok, { pay: 0, yukseklik: sigacakBoy });

    // Kartların sırayla belirmesi yalnız sayfaya gelişte: ciz() her kutudan
    // sonra sayfayı baştan kuruyor, hareket her dokunuşta tekrarlanmasın.
    let ilkCizim = true;

    /* Odağın yeniden çizimden sonra döneceği yer. ciz() sayfayı baştan
       kurduğu için kutudan dönen odak (modal onu açan öğeye veriyor) eski
       öğeyle birlikte gidiyordu; aynı yerdeki yeni öğe kararlı bir adla
       bulunuyor: form öğelerinde data-odak-adi, id ya da name, kâğıtta
       data-alan. */
    function odakYeri() {
      const a = document.activeElement;
      if (!a || !kok.contains(a)) return null;
      const adli = a.closest('[data-odak-adi]');
      if (adli) return `[data-odak-adi="${CSS.escape(adli.dataset.odakAdi)}"]`;
      const alan = a.closest('.recete-onizleme [data-alan]');
      if (alan) return `.recete-onizleme [data-alan="${CSS.escape(alan.dataset.alan)}"]`;
      if (a.id) return '#' + CSS.escape(a.id);
      return a.name ? `.recete-form [name="${CSS.escape(a.name)}"]` : null;
    }
    function odagiVer(yer) {
      if (!yer) return;
      let hedef = kok.querySelector(yer);
      // Silinen ilaç satırının düğmesi yok: aynı sıradaki (bir sonraki ilaç
      // yukarı kaydı) yoksa bir öncekinin düğmesi, o da yoksa arama kutusu.
      const silinen = !hedef && yer.match(/ilac-(sil|duzenle)-(\d+)/);
      if (silinen) {
        hedef = kok.querySelector(`[data-odak-adi="ilac-${silinen[1]}-${Number(silinen[2]) - 1}"]`)
          || kok.querySelector('[data-odak-adi="ilac-ara"]');
      }
      hedef?.focus({ preventScroll: true });
    }

    function ciz() {
      if (!aktif || !guncel()) return;
      const giris = ilkCizim;
      ilkCizim = false;
      // İlk çizimde odak yönlendiricinin (başlığa veriyor).
      const odak = giris ? null : (sonrakiOdak || odakYeri());
      sonrakiOdak = null;
      // Doğrulama hatası gösterildiyse her çizimde yeniden bakılıyor: hasta
      // seçilince «مریض باید انتخاب شود» şeridi ve kırmızı kenar gidiyor,
      // ilk ilaç eklenince onunki de. Önce ancak bir sonraki kayıt
      // denemesinde kalkıyorlardı.
      if (Object.keys(hatalar).length) hatalar = receteDogrula(recete);
      temizle(kok);

      /* ---- Panel başlığı: simge, başlık ve şablon düğmeleri ----
         Sayfa başlığı (sayfaBas) bu sayfada yok: başlık panelin kendi
         bandında ve h1 o — yönlendirici odağı ona veriyor. «ذخیره به عنوان
         قالب» boş formda da duruyor (tasarım), ilk ilaç eklenene dek pasif;
         nedenini üzerine gelince söylüyor. */
      const sablonDugmesi = (ad, simgesi, metin, onclick, { pasif = false, ipucu = metin } = {}) => btn(simge(simgesi, { boy: 16, dolu: true }), {
        class: 'btn recete-panel__sablon', title: ipucu, 'aria-label': metin, 'data-odak-adi': 'sablon-' + ad, disabled: pasif, onclick,
      }, el('span', { class: 'recete-panel__sablon-metin' }, metin));
      const panelBasi = el('header', { class: duzenleme ? 'recete-panel__bas recete-panel__bas--duzenle' : 'recete-panel__bas' },
        el('span', { class: 'recete-panel__simge' }, simge('yeni-recete', { boy: 44, dolu: true })),
        el('div', { class: 'recete-panel__metin' },
          // Numara kendi yönünde (bdi, soldan sağa): Farsça başlığın ardında
          // tireli rakamlar ters diziliyordu («01-24-09-2026»).
          duzenleme
            ? el('h1', {}, `${t('recete.duzenle', 'Reçeteyi düzenle')} · `,
              el('bdi', { class: 'recete-panel__no', dir: 'ltr' }, duzenleme.receteNo || ''))
            : el('h1', {}, t('recete.yeni', 'Yeni reçete')),
          el('p', {}, t('recete.yeni_alt', 'Hasta ve reçete bilgilerini gir.'))),
        el('div', { class: 'recete-panel__eylem' },
          sablonlar.length ? sablonDugmesi('recete', 'liste', t('sablon.doldur', 'Şablondan doldur'), async () => {
            const s = await sablonSecKutusu(ctx, sablonlar);
            if (!s) return;
            Object.assign(recete, sablonuUygula(recete, s));
            basari(t('sablon.uygulandi', '"{ad}" uygulandı', { ad: s.ad }));
            ciz();
          }) : null,
          sablonDugmesi('kaydet', 'belge', t('sablon.kaydet', 'Şablon olarak kaydet'), async () => {
            if (await sablonKaydetKutusu(ctx, recete)) {
              sablonlar = await depo.listele('sablonlar', { sirala: 'ad' });
              ciz();
            }
          }, { pasif: !recete.satirlar.length, ipucu: recete.satirlar.length ? t('sablon.kaydet', 'Şablon olarak kaydet') : t('sablon.kaydet_bos', 'Önce ilaç ekle') })));

      // Alerji ve çift etken madde uyarıları: kâğıda basılmıyorlar ama hekim
      // kaydetmeden önce görmeli. Hiçbiri kaydetmeyi engellemiyor. Panelin
      // içinde, başlıkla hasta kartı arasında duruyorlar; yalnız varken yer
      // kaplıyorlar. Ayrıca tablodaki satırın kendisi de işaretli.
      const uyarilar = receteUyarilari(recete.satirlar, hasta, ilaclar, { alerjiBul: alerjiCakismasi });
      const serit = uyariSeridi(uyarilar.map((u) => ({ tur: u.tur, metin: uyariMetni(u) })));
      const ilkHataMetni = () => {
        const h = hatalar.hastaId || hatalar.satirlar || hatalar.tarih;
        return h ? dogrulaMetni(h) : '';
      };
      const hataSeridi = ilkHataMetni() ? el('div', { class: 'uyari uyari--hata' }, el('span', {}, ilkHataMetni())) : null;

      /* ---- Hasta kartı ---- */
      const yas = hasta ? hastaYasi(hasta) : null;
      // Hasta listeden seçiliyor ama tasarımdaki gibi bir giriş kutusu
      // görünümünde: baştaki kişi simgesi ve boşken yer tutucu renginde yazı.
      const hastaDugmesi = btn(null, {
        class: 'btn secim-alani secim-alani--girdi' + (hatalar.hastaId ? ' input--hata' : ''), 'data-odak-adi': 'hasta',
        // Uzun ad kutuda üç noktayla kısalıyor; tamamı üzerine gelince okunsun.
        title: hasta ? tamAd(hasta) : null,
        onclick: async () => { await eylemler.hasta(); ciz(); },
      },
        simge('hasta', { boy: 23, dolu: true, sinif: 'girdi-simgesi' }),
        el('span', { class: 'secim-alani__metin' + (hasta ? '' : ' sessiz') },
          hasta ? tamAd(hasta) : t('recete.hasta_sec', 'Hasta seç')));
      // Kutu da takvim de ŞEMSİ. Depoda tarih yine miladi ISO — seçici onu
      // gizli alanda taşıyor. Önce miladi bir kutu vardı ve şemsi karşılığı
      // altında yazıyordu; hekim her seferinde kafadan çeviriyordu.
      const tarihGirdisi = tarihSecici({
        name: 'tarih', id: 'recete-tarih', value: recete.tarih,
        // Tarih hatası gösteriliyorsa şerit YERİNDE tazeleniyor: geçerli tarih
        // yazılınca hemen gitsin. Form yeniden kurulmuyor: kurulunca kutu
        // «1405/07/1»i «1405/07/01»e çeviriyor, imleç sona gidiyordu ve
        // yazılan 15 sessizce 1 olarak kaydediliyordu.
        degisti: (iso) => {
          recete.tarih = iso;
          if (hatalar.tarih) {
            hatalar = receteDogrula(recete);
            const metin = ilkHataMetni();
            if (!metin) hataSeridi?.remove();
            else if (hataSeridi) hataSeridi.firstChild.textContent = metin;
            tarihGirdisi.classList.toggle('input--hata', !!hatalar.tarih);
          }
          tazeleGecikmeli();
        },
      });
      if (hatalar.tarih) tarihGirdisi.classList.add('input--hata');
      // Numara ipucu üzerine gelince (title) ve ekran okuyucuya
      // (aria-describedby) söyleniyor. Gizli ipucu etiketin DIŞINDA: <label>
      // içindeyken alanın adına da katılıyor, ekran okuyucu onu iki kez okuyordu.
      const numaraIpucu = t('recete.numara_ipucu', 'Kaydedilince verilir');
      const numaraGirdisi = el('span', { class: 'girdi-simgeli' },
        simge('recete', { boy: 22, dolu: true, sinif: 'girdi-simgesi' }),
        girdi({
          value: recete.receteNo || '', readonly: true, title: numaraIpucu, dir: 'ltr',
          placeholder: t('recete.numara_oto', 'Otomatik'), 'aria-describedby': 'recete-no-ipucu',
        }));
      // Yaş hastadan türüyor, elle yazılmıyor: gölgeli kutuda sayı ve «سال».
      // Kutu sağdan sola: birim sağda, sayı onun solunda (tasarım).
      const yasKutusu = el('span', { class: 'yas-kutu', dir: 'rtl' },
        el('span', { class: 'yas-kutu__birim' + (yas === null ? ' sessiz' : '') }, t('hasta.yas_birim', 'yıl')),
        yas !== null ? el('output', { dir: 'ltr' }, String(yas)) : null);

      const hastaKarti = kart({ class: 'kart kart--hasta' },
        kartBasligi(simge('hasta-grup', { boy: 26, dolu: true }), t('recete.hasta_bilgileri', 'Hasta bilgileri')),
        // Dört alan TEK satırda, genişlikleri tasarımdaki gibi: ad ve tarih
        // en geniş, yaş en dar.
        el('div', { class: 'kart__govde' }, el('div', { class: 'izgara izgara--hasta' },
          alan(t('recete.hasta_ad', 'Ad soyad'), hastaDugmesi, { gerekli: true }),
          // Yıldızı tasarımdaki gibi: hasta zorunlu olduğu için o da hep dolu.
          alan(t('hasta.yas_etiket', 'Yaş'), yasKutusu, { gerekli: true }),
          alan(t('genel.tarih', 'Tarih'), tarihGirdisi, { gerekli: true }),
          alan(t('recete.numara', 'Reçete no'), numaraGirdisi)),
        el('span', { class: 'gizli-metin', id: 'recete-no-ipucu' }, numaraIpucu)));

      /* ---- Clinical: ölçümler ----
         Yazdıkça kâğıt tazeleniyor (sayfa yeniden kurulmuyor, odak kalıyor).
         Birimler kutunun DIŞINDA, kâğıttaki birimin aynısı. */
      const olcumYaz = (anahtar, deger) => {
        recete.olcumler = { ...recete.olcumler, [anahtar]: deger };
        tazeleGecikmeli();
      };
      const olcumSatirlari = [...OLCUMLER, ['kanGrubu', '', '', '']].map(([anahtar, , , birim]) => {
        const id = 'olcum-' + anahtar;
        let kutu;
        if (anahtar === 'bp') kutu = bpKutusu(id, olcumYaz);
        else if (anahtar === 'kanGrubu') {
          // Seçim listesi; listede olmayan eski serbest değer (elle yazılmış)
          // ikinci seçenek olarak duruyor ve seçili: açıp kaydetmek onu silmesin.
          const mevcut = recete.kanGrubu || '';
          const secenekler = [['', '—'], ...(mevcut && !KAN_GRUPLARI.includes(mevcut) ? [[mevcut, mevcut]] : []),
            ...KAN_GRUPLARI.map((g) => [g, g])];
          kutu = acilir({ name: 'olcum_kanGrubu', id, dir: 'ltr' }, secenekler, mevcut);
          kutu.firstChild.onchange = (e) => { recete.kanGrubu = e.target.value; kanElle = true; tazeleGecikmeli(); };
        } else {
          kutu = girdi({
            name: 'olcum_' + anahtar, id, dir: 'ltr', inputmode: OLCUM_KLAVYE[anahtar], autocomplete: 'off',
            value: recete.olcumler?.[anahtar] ?? '',
          });
          kutu.oninput = () => olcumYaz(anahtar, kutu.value);
        }
        return el('div', { class: 'olcum-satir' + (OLCUM_DAR.has(anahtar) ? ' olcum-satir--dar' : '') + (anahtar === 'kanGrubu' ? ' olcum-satir--kan' : '') },
          el('span', { class: 'olcum-satir__simge' },
            simge(OLCUM_SIMGELERI[anahtar], { boy: OLCUM_SIMGE_BOY[anahtar], dolu: true })),
          el('label', { class: 'olcum-satir__ad', dir: 'ltr', for: anahtar === 'bp' ? id + '-sis' : id }, OLCUM_ETIKET[anahtar]),
          kutu,
          birim ? el('span', { class: 'olcum-satir__birim', dir: 'ltr' }, birim.split(' / ')[0]) : null);
      });
      const klinikKarti = kart({ class: 'kart kart--klinik' },
        kartBasligi(simge('stetoskop', { boy: 34, dolu: true }),
          [t('recete.klinik_baslik', 'Muayene bilgileri'), ' (', el('bdi', { dir: 'ltr' }, t('kagit.klinik', 'Clinical')), ')']),
        el('div', { class: 'olcum-liste' }, ...olcumSatirlari));

      /* ---- İlaç ekle: arama, süzgeçler, canlı sonuçlar ---- */
      const ekleKarti = ilacEkleKarti();

      /* ---- Reçetedeki ilaçlar: tablo ---- */
      const yeni = yeniSatir;
      yeniSatir = null;
      const listeKarti = ilacListesiKarti(uyarilar, yeni);

      /* ---- Alt kartlar: belirtiler, tetkikler, tanı ---- */
      const altKartlar = el('div', { class: 'alt-kartlar' },
        // Tetkik kartı dar (tasarımda 178 px): üç öneri, düğme dördüncü satırda.
        kontrolKarti('belirtiler', 'belirti', klinik?.belirtiler, simge('tani', { boy: 24, dolu: true }), t('recete.belirtiler', 'Belirtiler'), 4),
        kontrolKarti('laboratuvar', 'lab', klinik?.laboratuvar, simge('tup', { boy: 24, dolu: true }), t('recete.lab_baslik', 'Tetkik sonuçları'), 3),
        taniKarti());

      /* ---- Ek not: kâğıdın «ADDITIONAL NOTES»u, yazdıkça kâğıtta ---- */
      const notAlani = el('textarea', {
        class: 'input', id: 'recete-not', name: 'notlar', rows: 1, dir: 'auto', 'data-odak-adi': 'notlar',
        placeholder: t('recete.not_ipucu', 'Özel not ya da öneri…'), value: recete.notlar || '',
      });
      notAlani.oninput = () => { recete.notlar = notAlani.value; notBoyu(notAlani); tazeleGecikmeli(); };
      const notKarti = kart({ class: 'kart kart--not' },
        el('label', { class: 'kart--not__etiket', for: 'recete-not' },
          simge('not', { boy: 20 }), el('span', {}, t('recete.not_ek', 'Ek not'))),
        notAlani);

      /* Alt düğmeler: temizle · önizle · kaydet ve yazdır. Yalnız kaydetmek
         önizleme kutusunun içinde ve Ctrl+S'te. Düzenlemede ortadaki düğme
         doğrudan kaydediyor: yazım hatası düzelten hekim bir kutudan
         geçmek zorunda kalmasın. */
      const eylemDugmesi = (simgesi, metin, tur, onclick) =>
        btn(simgesi, { class: 'btn recete-btn recete-btn--' + tur, 'data-odak-adi': 'eylem-' + tur, onclick }, metin);
      const altDugmeler = el('div', { class: 'recete-eylem' },
        eylemDugmesi(simge('cop', { boy: 24, dolu: true }), t('recete.temizle_form', 'Formu temizle'), 'sade', async () => {
          if (!await onayla(t('recete.temizle_soru', 'Girilen bilgiler silinsin mi?'), { evet: t('genel.temizle', 'Temizle') })) return;
          // Düzenlemede temizlemek düzenlemeden de çıkarıyor: yalnız formu
          // boşaltınca başlık «ویرایش نسخه» kalıyor, kaydet ise eski
          // reçetenin yerine YENİ bir reçete yazıyordu.
          if (duzenleme) { git('/recete/kagit'); return; }
          recete = bosRecete(ayar, bugun()); hasta = null; hatalar = {}; kanElle = false;
          arama = bosArama(); taniAramasi = ''; gosterilen = { belirtiler: [], laboratuvar: [] };
          ciz();
        }),
        duzenleme
          ? eylemDugmesi(simge('kaydet', { boy: 22 }), t('recete.kaydet_degisiklik', 'Değişiklikleri kaydet'), 'ikincil', () => kaydet({}))
          : eylemDugmesi(simge('goz', { boy: 24, dolu: true }), t('recete.onizle', 'Önizle'), 'ikincil', onizlemeAc),
        eylemDugmesi(simge('yazdir', { boy: 24, dolu: true }), t('recete.kaydet_yazdir', 'Kaydet ve yazdır'), 'asil', () => kaydet({ yazdir: true })));

      /* Formun tamamı TEK panel: başlık bandı, uyarılar, hasta kartı,
         Clinical ile ilaç kartları yan yana, alt kartlar, not, düğmeler. */
      const sol = el('div', { class: 'recete-form recete-panel' }, panelBasi, serit, hataSeridi, hastaKarti,
        el('div', { class: 'recete-ikili' }, klinikKarti, el('div', { class: 'recete-ilaclar' }, ekleKarti, listeKarti)),
        altKartlar, notKarti, altDugmeler);

      /* ---- Sağ sütun: canlı kâğıt ----
         Formla aynı biçimde bir panel. Başlık satırında başlık (solda) ve
         üç düğme (sağda): büyük önizleme, «چاپ», «ذخیره PDF». Bu sütun
         yapışkan: tablo uzayıp sayfa kaydıkça yazdır düğmesi hep görünür
         kalıyor (alttaki «ذخیره و چاپ» ekranın dışına inse de). Yazdır ve
         PDF alttaki düğmenin yolu: önce kaydet (numara ve doğrulama kodu
         kayıtta üretiliyor), sonra bas. */
      onizlemeKabi = el('div', { class: 'kagit-tuval' });
      const sag = onizlemePaneli({
        baslik: t('recete.onizleme_bas', 'پیش نمایش نسخه'), id: 'recete-onizleme-bas', sinif: 'recete-onizleme', tuval: onizlemeKabi,
        eylemler: [
          { simge: 'genislet', metin: t('recete.onizleme_genis', 'بزرگ نمایی'), odakAdi: 'onizleme-genis', onclick: onizlemeAc, ikon: true },
          { simge: 'yazdir', metin: t('genel.yazdir', 'چاپ'), odakAdi: 'onizleme-yazdir', onclick: () => kaydet({ yazdir: true }) },
          { simge: 'pdf', metin: t('recete.pdf_kaydet', 'ذخیره PDF'), odakAdi: 'onizleme-pdf', onclick: () => kaydet({ yazdir: true, pdf: true }) },
        ],
      });

      kok.appendChild(el('div', { class: giris ? 'recete-duzen recete-duzen--giris' : 'recete-duzen' }, sol, sag));
      notBoyu(notAlani);
      // Tablo sayfanın akışında uzuyor: yeni eklenen (hep sonda) satır
      // görünsün. Yalnız gerekiyorsa kaydırıyor (nearest).
      if (yeni !== null) listeKarti.querySelector('.tablo__yeni')?.scrollIntoView({ block: 'nearest' });
      kagidiTazele();
      odagiVer(odak);

      // Kâğıt da dokunulabilir kalıyor: soldan da sağdan da doldurulabilsin.
      onizlemeKabi.addEventListener('click', async (e) => {
        const hedef = e.target.closest('[data-alan]');
        if (!hedef) return;
        const ad = hedef.getAttribute('data-alan');
        if (ad.startsWith('ilac:')) await satirDuzenle(Number(ad.slice(5)));
        else if (ad.startsWith('olcum:')) await olcumDuzenle(ad.slice(6));
        else if (eylemler[ad]) await eylemler[ad]();
        else return;
        ciz();
      });
      onizlemeKabi.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const hedef = e.target.closest('[data-alan]');
          if (hedef) { e.preventDefault(); hedef.click(); }
        }
      });
    }

    /** Ek not kutusu yazdıkça uzuyor, altı satırdan sonra kendi içinde kayıyor. */
    function notBoyu(alanKutusu) {
      const cs = getComputedStyle(alanKutusu);
      const pay = parseFloat(cs.paddingBlockStart) + parseFloat(cs.paddingBlockEnd) + parseFloat(cs.borderBlockStartWidth) + parseFloat(cs.borderBlockEndWidth);
      const enFazla = (parseFloat(cs.lineHeight) || 22) * 6 + pay;
      alanKutusu.style.blockSize = 'auto';
      alanKutusu.style.blockSize = Math.min(alanKutusu.scrollHeight + parseFloat(cs.borderBlockStartWidth) + parseFloat(cs.borderBlockEndWidth), enFazla) + 'px';
    }

    /** Kan basıncı: tek çerçevede iki kutu, «/» arada. Reçetede yine tek
     *  metin (bpBirlestir); yalnız hekim yazınca birleştiriliyor. Sistolikte
     *  «/», boşluk ya da üçüncü rakam yazılınca diyastoliğe geçiyor;
     *  diyastolik boşken geri silme sistoliğe dönüyor. */
    function bpKutusu(id, olcumYaz) {
      const [sisDeger, diaDeger] = bpBol(recete.olcumler?.bp);
      const ortak = { dir: 'ltr', inputmode: 'numeric', autocomplete: 'off', class: 'olcum-bp__girdi' };
      const sis = el('input', { ...ortak, id: id + '-sis', name: 'olcum_bp_sis', value: sisDeger, 'aria-label': t('olcum.bp_sis', 'Sistolik') });
      const dia = el('input', { ...ortak, id: id + '-dia', name: 'olcum_bp_dia', value: diaDeger, 'aria-label': t('olcum.bp_dia', 'Diyastolik') });
      const yaz = () => olcumYaz('bp', bpBirlestir(sis.value, dia.value));
      sis.addEventListener('keydown', (e) => {
        if ((e.key === '/' || e.key === ' ') && !e.isComposing) { e.preventDefault(); dia.focus(); dia.select(); }
      });
      sis.addEventListener('input', (e) => {
        yaz();
        if (e.inputType === 'insertText' && /^\d{3}$/.test(sis.value)) { dia.focus(); dia.select(); }
      });
      dia.addEventListener('input', yaz);
      dia.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !dia.value) { e.preventDefault(); sis.focus(); }
      });
      // Çerçeve hep soldan sağa: telefonda (sağdan sola) «85 / 130» okunuyordu.
      return el('span', { class: 'olcum-bp', dir: 'ltr' }, sis, el('span', { class: 'olcum-bp__ayrac', 'aria-hidden': 'true' }, '/'), dia);
    }

    /* ---- «افزودن دوا»: satır içi arama ----
       Sonuçlar kartın içinde, kutunun hemen altında canlı (kutu değil: kutu
       hekimin kurduğu listeyi örtüyordu). Yerinde tazeleniyor, sayfa yeniden
       kurulmuyor: odak kutuda kalıyor. Seçilen ilaç satır kutusunu ilacı
       seçili açıyor (alerji uyarısı hemen, odak adette); onaylanınca satır
       ekleniyor, kutu boşalıp yeniden odakta: sıradaki ilaç hemen yazılsın. */
    function ilacEkleKarti() {
      const aramaVar = () => !!(arama.q.trim() || arama.grup || arama.form || arama.marka);
      const kutu = girdi({
        type: 'search', name: 'ilacArama', 'data-odak-adi': 'ilac-ara', autocomplete: 'off', value: arama.q,
        placeholder: t('recete.ilac_ara_yer', 'İlaç ara (ad, ticari ad ya da etken madde)…'),
        'aria-controls': 'ilac-sonuc', 'aria-describedby': 'ilac-sonuc-sayi',
      });
      const panel = el('div', { class: 'liste ilac-sonuc', id: 'ilac-sonuc', hidden: true });
      const sayi = el('span', { class: 'gizli-metin', id: 'ilac-sonuc-sayi', 'aria-live': 'polite' });

      const sonucSatiri = (ilac) => {
        const alerji = hasta ? alerjiCakismasi(hasta, ilac) : null;
        const recetede = !!ilac.id && recete.satirlar.some((s) => s.ilacId === ilac.id);
        return el('button', { type: 'button', class: 'liste__satir liste__satir--tiklanir ilac-sonuc__satir', onclick: () => ilacSec(ilac) },
          el('span', { class: 'liste__govde' },
            el('bdi', { class: 'liste__baslik' }, ilac.ad),
            el('span', { class: 'liste__alt', dir: 'auto' },
              [ilac.doz, formAdi(ilac.form) ? secenekAdi(FORMLAR, ilac.form, 'form') : '', ilac.etkenMadde].filter(Boolean).join(' · '))),
          el('span', { class: 'liste__son' },
            alerji ? rozet(t('recete.alerji_rozet', 'Alerji'), 'kirmizi', { simge: 'hata', title: uyariMetni({ kod: 'alerji', veri: { a: alerji } }) }) : null,
            recetede ? rozet(t('recete.ilac_nuskhada', 'Reçetede'), 'gri') : null,
            simge('arti', { boy: 20, sinif: 'ilac-sonuc__arti' })));
      };
      function sonucCiz() {
        temizle(panel);
        panel.hidden = !arama.acik;
        if (!arama.acik) { sayi.textContent = ''; return; }
        const q = arama.q.trim();
        const suzgec = { grup: arama.grup, form: arama.form, marka: arama.marka };
        const ayrac = (m) => el('div', { class: 'liste__ayrac' }, m);
        let n = 0;
        if (!aramaVar()) {
          // Boş kutu: yazmadan gezinme. Önce hekimin sık yazdıkları, sonra
          // kayıtlı ilaçlarının baş tarafı (satır kutusundaki gibi).
          const kalan = ilaclar.filter((x) => !x.silindi && !sikIdler.includes(x.id)).slice(0, 10);
          if (sikYazilanlar.length) panel.append(ayrac(t('recete.ilac_sik', 'Sık yazdıkların')), ...sikYazilanlar.map(sonucSatiri));
          if (kalan.length) panel.append(ayrac(t('recete.ilac_tumu', 'Kayıtlı ilaçlar')), ...kalan.map(sonucSatiri));
          n = sikYazilanlar.length + kalan.length;
        } else {
          const { sonuclar, toplam } = havuzdaAra(q, suzgec);
          panel.append(...sonuclar.map(sonucSatiri));
          // Ekrana en çok SONUC_SINIRI satır: gerisini aramayı daraltarak bulsun.
          if (toplam > sonuclar.length) {
            panel.append(el('div', { class: 'liste__satir sessiz ilac-sonuc__fazla' }, t('recete.ilac_sonuc_fazla', 'İlk {n} sonuç gösterildi.', { n: sonuclar.length })));
          }
          n = toplam;
        }
        if (!n) {
          panel.append(el('div', { class: 'liste__satir sessiz' },
            el('span', {}, t('ilac.eslesme_yok', 'Eşleşen ilaç yok')), ' ', el('span', {}, t('recete.ilac_ipucu', 'Listede yoksa önce İlaçlar\'a ekle.'))));
        }
        sayi.textContent = t('recete.ilac_sonuc', '{n} ilaç bulundu', { n });
      }
      let bekleme = 0;
      kutu.oninput = () => {
        arama.q = kutu.value;
        arama.acik = aramaVar();
        clearTimeout(bekleme);
        // Kutu boşalınca panel hemen kapanıyor; yazarken 120 ms bekleniyor.
        if (!arama.acik) sonucCiz(); else bekleme = setTimeout(sonucCiz, 120);
      };
      // Aşağı ok boş kutuda da paneli açıyor (gezinme listesi); ardından
      // oklarlaGez ilk sonuca geçiriyor. Sıra önemli: önce aç, sonra geç.
      kutu.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown' && !arama.acik) { arama.acik = true; clearTimeout(bekleme); sonucCiz(); }
      });
      oklarlaGez(kutu, panel, () => { arama.acik = false; sonucCiz(); });
      /* Enter satır kutusundaki kuralla: yalnız TEK eşleşme kalınca (ya da
         adı tam yazılınca) seçiyor; birden çok eşleşmede bir şey seçmiyor,
         yanlış ilaç reçeteye girmesin. */
      kutu.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing) return;
        e.preventDefault();
        const q = kutu.value.trim();
        if (!q) return;
        const { sonuclar } = havuzdaAra(q, { grup: arama.grup, form: arama.form, marka: arama.marka });
        const tam = sonuclar.filter((i) => ilacGorunenAd(i).toLowerCase() === q.toLowerCase());
        const tek = sonuclar.length === 1 ? sonuclar : tam;
        if (tek.length === 1) ilacSec(tek[0]);
      });
      const suzgecAlani = (ad, anahtar, etiket, secenekler) => {
        // Seçeneği olmayan süzgeç gizlenmiyor, pasif: düzen oynamasın.
        const kap = acilir({ name: ad, disabled: !secenekler.length }, [['', t('genel.hepsi', 'Hepsi')], ...secenekler], arama[anahtar]);
        kap.firstChild.onchange = (e) => { arama[anahtar] = e.target.value; arama.acik = aramaVar(); sonucCiz(); };
        return alan(etiket, kap);
      };
      const araMetni = t('recete.ara_dugme', 'Ara');
      const kart_ = kart({ class: 'kart kart--ekle' },
        kartBasligi(rxIsareti({ sinif: 'rx-baslik__isaret' }), t('recete.ilac_ekle', 'İlaç ekle')),
        el('div', { class: 'kart__govde' },
          el('div', { class: 'girdi-simgeli ilac-ara' }, simge('ara', { boy: 20, sinif: 'girdi-simgesi' }), kutu),
          panel, sayi,
          el('div', { class: 'ilac-suzgec' },
            suzgecAlani('suzgecGrup', 'grup', t('recete.suzgec_grup', 'İlaç grubu'), suzgecler.grup),
            suzgecAlani('suzgecForm', 'form', t('recete.suzgec_form', 'Şekil'), suzgecler.form),
            suzgecAlani('suzgecMarka', 'marka', t('recete.suzgec_marka', 'Marka'), suzgecler.marka),
            btn(simge('ara', { boy: 18 }), {
              class: 'btn ilac-ara__dugme', title: araMetni, 'aria-label': araMetni,
              onclick: () => { arama.acik = true; sonucCiz(); panel.querySelector('button')?.focus(); },
            }, el('span', { class: 'ilac-ara__dugme-metin' }, araMetni)))));
      sonucCiz();
      return kart_;
    }

    /** Aramadan seçilen ilaç: satır kutusu ilacı seçili açıyor. Vazgeçilirse
     *  arama ve sonuçlar olduğu gibi kalıyor. */
    async function ilacSec(ilac) {
      if (!await satirEkle(ilac)) return;
      arama = { ...arama, q: '', acik: false };
      sonrakiOdak = '[data-odak-adi="ilac-ara"]';
      ciz();
    }

    /* ---- «لیست دواها در نسخه» ----
       Tablo sayfanın akışında uzuyor (iç kaydırma yok): 15–25 ilaçta da her
       satır okunuyor, başlık üst çubuğun altına yapışıyor, önizleme kâğıdı
       yapışkan kalıyor. 11 satırdan sonra sıkışık düzen. Satıra dokunmak onu
       düzenliyor (kutuda seçim listeleri ve alerji denetimi var; tabloda
       girdi yok), çöp kutusu sorup siliyor. Alerjili ve çift etkenli satır
       kendisi de işaretli: üstteki şerit kaydırınca görünmez kalabiliyor. */
    function ilacListesiKarti(uyarilar, yeni) {
      const n = recete.satirlar.length;
      const satirTr = (s, i) => {
        const g = satirGorunumu(s);
        const u = uyarilar.filter((x) => x.satir === i).sort((a, b) => (a.tur === 'hata' ? 0 : 1) - (b.tur === 'hata' ? 0 : 1));
        const ad = satirAdi(s);
        const dozMetni = [g.doz, g.kisa ? `(${g.kisa})` : ''].filter(Boolean).join(' ');
        const ek = [s.zaman, s.yol, s.not].filter(Boolean).join(' · ');
        const silMetni = t('recete.satir_sil_ad', 'Sil: {ad}', { ad });
        return el('tr', {
          class: [i === yeni ? 'tablo__yeni' : '', u.length ? 'ilac-satir--' + u[0].tur : ''].filter(Boolean).join(' ') || null,
          onclick: async () => { await satirDuzenle(i); ciz(); },
        },
          el('td', { class: 'ilac-sira' }, String(i + 1)),
          el('td', { class: 'ilac-ad-hucre', title: ad || null },
            u.length ? el('span', { class: 'ilac-satir__uyari', title: u.map(uyariMetni).join('\n') },
              simge(u[0].tur === 'hata' ? 'hata' : 'uyari', { boy: 14 })) : null,
            // Sekme durağı adın kendisi: Enter düzenliyor, Delete sorup siliyor.
            // Ad hiç kesilmiyor, sarıyor: yanlış ilaç okunabilir kalmalı.
            el('button', {
              type: 'button', class: 'ilac-ad', 'data-odak-adi': 'ilac-duzenle-' + i,
              'aria-label': t('recete.satir_duzenle_ad', 'Düzenle: {ad}', { ad }),
              onkeydown: (e) => { if (e.key === 'Delete') { e.preventDefault(); satirSil(i); } },
            }, el('bdi', { dir: 'ltr' }, g.ad ? bolunmez(g.ad) : '—'))),
          // Hücre soldan sağa: sığmayan güç sonundan üç noktayla kısalsın
          // («20 mg (Ca…»), başından değil.
          el('td', { class: 'ilac-doz', dir: 'ltr', title: dozMetni || null }, dozMetni ? bolunmez(dozMetni) : '—'),
          el('td', { class: 'ilac-adet' }, String(s.adet ?? '')),
          el('td', { class: 'ilac-kullanim', title: [s.kullanim, ek].filter(Boolean).join('\n') || null },
            el('span', { class: 'ilac-kullanim__satir' }, s.kullanim || (ek ? '' : '—')),
            ek ? el('span', { class: 'ilac-kullanim__satir' }, ek) : null),
          el('td', { class: 'ilac-sure' }, s.sure || '—'),
          el('td', { class: 'ilac-islem' }, btn(simge('cop', { boy: 18, dolu: true }), {
            class: 'btn btn--ikon ilac-sil', 'data-odak-adi': 'ilac-sil-' + i, 'aria-label': silMetni, title: silMetni,
            onclick: (e) => { e.stopPropagation(); satirSil(i); },
          })));
      };
      const basliklar = ['#', t('recete.sutun_ad', 'İlaç'), t('recete.sutun_doz', 'Güç / şekil'), t('recete.sutun_mikdar', 'Adet'),
        t('recete.sutun_kullanim', 'Kullanım'), t('recete.sure', 'Süre'), t('genel.islem', 'İşlem')];
      return kart({ class: 'kart kart--liste' },
        kartBasligi(simge('kapsul', { boy: 26, dolu: true }), t('recete.ilac_listesi_nuskha', 'Reçetedeki ilaçlar'),
          n ? el('span', { class: 'kart__bas-sayi' }, t('recete.ilac_sayisi', '{n} ilaç', { n })) : null),
        el('div', { class: 'kart__govde' },
          /* Tablo liste boşken de çiziliyor: başlık satırı hangi sütunlara ne
             gireceğini önceden söylüyor. Sütun genişlikleri sabit (colgroup,
             oranlar CSS'te): içerik değiştikçe başlık ayraçları kaymasın. */
          el('div', { class: 'tablo-kap' + (hatalar.satirlar ? ' tablo-kap--hata' : '') },
            el('table', { class: 'tablo tablo--ilac' + (n >= 11 ? ' tablo--sik' : '') },
              el('colgroup', {}, ...basliklar.map(() => el('col'))),
              el('thead', {}, el('tr', {}, ...basliklar.map((b) => el('th', { scope: 'col' }, b)))),
              n
                // Az önce eklenen satır bir kez yükselerek giriyor; sonraki
                // çizimlerde sınıf yok, hareket tekrarlanmıyor.
                ? el('tbody', {}, ...recete.satirlar.map(satirTr))
                : el('tbody', {}, el('tr', { class: 'tablo__bos' },
                  el('td', { colspan: String(basliklar.length) },
                    simge('kapsul', { boy: 37, dolu: true }),
                    el('span', {}, t('recete.ilac_bos_kisa', 'Henüz ilaç eklenmedi.'))))))),
          // Kutuyla eklemeyi seven hekim için: arama kutunun içinde.
          el('button', {
            type: 'button', class: 'satir-ekle', 'data-odak-adi': 'ilac-ekle',
            onclick: async () => { if (await satirEkle()) ciz(); },
          }, simge('arti', { boy: 20 }), el('span', {}, n ? t('recete.satir_ekle', 'Bir satır daha ekle') : t('recete.ilac_ekle', 'İlaç ekle')))));
    }

    /* ---- Belirtiler / tetkikler: kontrol listesi ----
       Seçilenler ve birkaç öneri (hekimin geçmişi, listenin yaygınları)
       işaret kutusu olarak; işaretlemek sayfayı yeniden kurmuyor, kâğıt
       tazeleniyor. İşareti kaldırılan satır sayfadan çıkılana dek yerinde
       kalıyor. Tam liste «+ افزودن مورد»daki kutuda. */
    function kontrolKarti(alanAdi, onek, liste, simgesi, baslik, sinir) {
      const indeks = adIndeksi(liste);
      const kayitBul = (ad) => indeks.get(normalizeFa(ad)) || null;
      const anahtar = (ad) => { const k = kayitBul(ad); return k ? 'k:' + kagitAdi(k) : normalizeFa(ad); };
      const adlar = gosterilecekler({
        secilenler: parcala(recete[alanAdi]),
        oneriler: [...gecmisler(gecmisReceteler, alanAdi, null, 8, indeks).map((g) => g.ad), ...siklar(liste).map(kagitAdi)],
        onceki: gosterilen[alanAdi], anahtar, sinir,
      });
      gosterilen[alanAdi] = adlar;
      const satir = (ad) => {
        const kayit = kayitBul(ad) || ad;
        const kutu = onayKutusu(el('bdi', {}, ad), { name: onek, value: ad, checked: secili(recete[alanAdi], kayit), 'data-odak-adi': `${onek}:${ad}` });
        const girdiKutusu = kutu.querySelector('input');
        girdiKutusu.onchange = () => {
          if (girdiKutusu.checked !== secili(recete[alanAdi], kayit)) recete[alanAdi] = degistir(recete[alanAdi], kayit);
          tazeleGecikmeli();
        };
        return el('li', {}, kutu);
      };
      return kart({ class: `kart kart--${onek}` },
        kartBasligi(simgesi, baslik),
        el('div', { class: 'kart__govde' },
          el('ul', { class: 'secim-liste', role: 'list' }, ...adlar.map(satir)),
          el('button', { type: 'button', class: 'madde-ekle', 'data-odak-adi': alanAdi, onclick: async () => { await eylemler[alanAdi](); ciz(); } },
            simge('arti', { boy: 16 }), el('span', {}, t('recete.madde_ekle', 'Ekle')))));
    }

    /* ---- Tanı: satır içi arama ve çipler ----
       Arama ICD koduyla da buluyor; seçilen tanı çip oluyor (adı ve kodu),
       çipin ×'i onu çıkarıyor. Kod ADA değil DEĞERE göre yürüyor
       (taniDegistir): birini çıkarmak öbürünün kodunu kaydırmıyor. Listede
       olmayan tanı Enter'la serbest metin olarak ekleniyor (kodsuz). */
    function taniKarti() {
      const liste = klinik?.tanilar;
      const indeks = adIndeksi(liste);
      const adlar = parcala(recete.tani);
      const kodlar = parcala(recete.taniKodu);
      const kutu = girdi({
        type: 'search', name: 'taniArama', 'data-odak-adi': 'tani-ara', autocomplete: 'off', value: taniAramasi,
        placeholder: t('recete.tani_ara', 'Tanı ara…'),
      });
      const panel = el('div', { class: 'liste tani-sonuc', hidden: true });
      const sec = (kayit) => {
        if (!secili(recete.tani, kayit)) Object.assign(recete, taniDegistir({ tani: recete.tani, taniKodu: recete.taniKodu }, kayit));
        taniAramasi = '';
        sonrakiOdak = '[data-odak-adi="tani-ara"]';
        ciz();
      };
      const sonucCiz = () => {
        temizle(panel);
        const q = taniAramasi.trim();
        panel.hidden = !q;
        if (!q) return;
        const bulunan = ara(liste, q).slice(0, 5);
        if (!bulunan.length) panel.append(el('div', { class: 'liste__satir sessiz' }, t('recete.tani_serbest', 'Enter: serbest tanı olarak ekle')));
        panel.append(...bulunan.map((x) => el('button', { type: 'button', class: 'liste__satir liste__satir--tiklanir tani-sonuc__satir', onclick: () => sec(x) },
          el('span', { class: 'liste__govde' },
            el('bdi', { class: 'liste__baslik' }, kagitAdi(x)),
            x.ad !== kagitAdi(x) ? el('span', { class: 'liste__alt' }, x.ad) : null),
          x.kod ? el('bdi', { class: 'tani-sonuc__kod', dir: 'ltr' }, x.kod) : null)));
      };
      let bekleme = 0;
      kutu.oninput = () => { taniAramasi = kutu.value; clearTimeout(bekleme); bekleme = setTimeout(sonucCiz, 120); };
      oklarlaGez(kutu, panel, () => { panel.hidden = true; });
      // Enter: adı tam yazılan ya da tek kalan tanı; hiç eşleşme yoksa yazılan
      // metin serbest tanı. Birden çok eşleşmede bir şey eklemiyor: yarım
      // yazılmış «hep» tanı olarak kâğıda düşmesin, oklarla seçilsin.
      kutu.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.isComposing) return;
        e.preventDefault();
        const q = kutu.value.trim();
        if (!q) return;
        const bulunan = ara(liste, q);
        const tam = indeks.get(normalizeFa(q));
        if (tam) sec(tam);
        else if (bulunan.length === 1) sec(bulunan[0]);
        else if (!bulunan.length) sec({ ad: q });
      });
      const cipler = adlar.map((ad, i) => {
        const kayit = indeks.get(normalizeFa(ad));
        // Çipin kodu: bilinen tanıda kaydın kodu (ya da eski kodu) reçetede
        // yazılıysa o; elle yazılmış tanıda sayılar denkse aynı sıradaki.
        const kod = kayit
          ? kodlar.find((k) => [kayit.kod, kayit.eskiKod].filter(Boolean).map(normalize).includes(normalize(k))) || ''
          : (kodlar.length === adlar.length ? kodlar[i] : '');
        const sonraki = adlar[i + 1] ?? adlar[i - 1];
        const kaldir = t('genel.kaldir_ad', 'Kaldır: {ad}', { ad });
        return el('span', { class: 'cip cip--tani' },
          el('span', { class: 'tani-cip__simge' }, simge('tani', { boy: 12, dolu: true })),
          el('bdi', {}, ad),
          kod ? el('bdi', { class: 'tani-cip__kod', dir: 'ltr' }, kod) : null,
          el('button', {
            type: 'button', class: 'tani-cip__sil', 'data-odak-adi': 'tani-sil:' + ad, 'aria-label': kaldir, title: kaldir,
            onclick: () => {
              Object.assign(recete, taniDegistir({ tani: recete.tani, taniKodu: recete.taniKodu }, kayit || { ad }));
              sonrakiOdak = sonraki !== undefined ? `[data-odak-adi="${CSS.escape('tani-sil:' + sonraki)}"]` : '[data-odak-adi="tani-ara"]';
              ciz();
            },
          }, simge('kapat', { boy: 14 })));
      });
      const kart_ = kart({ class: 'kart kart--tani' },
        kartBasligi(simge('belge', { boy: 24, dolu: true }), t('recete.tani_baslik', 'Tanı')),
        el('div', { class: 'kart__govde' },
          el('div', { class: 'girdi-simgeli tani-ara' }, simge('ara', { boy: 18, sinif: 'girdi-simgesi' }), kutu),
          panel,
          adlar.length ? el('div', { class: 'tani-cipler' }, ...cipler) : null,
          el('button', { type: 'button', class: 'madde-ekle', 'data-odak-adi': 'tani', onclick: async () => { await eylemler.tani(); ciz(); } },
            simge('arti', { boy: 16 }), el('span', {}, t('recete.tani_ekle', 'Tanı ekle')))));
      sonucCiz();
      return kart_;
    }

    ciz();

    /* Ctrl+S yalnız kaydediyor, yazdırmadan; tarayıcının "sayfayı kaydet"
       penceresi açılmıyor. Tuşun yeri (KeyS) okunuyor: Farsça klavyede
       aynı tuş «س» yazıyor. Açık bir kutu varken (ilaç, tanı…) kaydetmiyor:
       yarım kalan giriş arkadan kaydedilmesin; önizleme kutusu bunun
       dışında. Dinleyici yalnız bu sayfada;
       yönlendirici sayfadan çıkarken aşağıdaki temizleyiciyi çağırıyor. */
    const kisayol = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.code !== 'KeyS') return;
      e.preventDefault();
      const kutular = document.querySelectorAll('.ortu');
      if (!kutular.length) { kaydet({}); return; }
      // Önizleme kutusu en üstteyse kısayol onun «ذخیره نسخه» düğmesi:
      // kaydetmenin yeri zaten orası. Önce tuş sessizce yutuluyordu.
      kutular[kutular.length - 1].querySelector('.modal--onizleme .recete-btn--ikincil')?.click();
    };
    document.addEventListener('keydown', kisayol);
    // Ctrl+P ya da tarayıcının menüsü: formdaki reçete o anki hâliyle basılsın.
    const baskiBirak = tarayiciBaskisi(() => kagitCiz({ ayar, recete, hasta }));
    return () => {
      aktif = false;
      document.removeEventListener('keydown', kisayol);
      baskiBirak();
      clearTimeout(tazeleZamani);
      olcekBirak?.();
    };
  },
};
