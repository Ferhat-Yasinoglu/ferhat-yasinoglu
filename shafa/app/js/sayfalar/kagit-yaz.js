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
import { el, svgEl, temizle, btn, btnS, girdi, alan, kart, bosDurum, uyariSeridi } from '../cekirdek/dom.js';
import { tarihSecici } from '../cekirdek/tarih-secici.js';
import { simge } from '../cekirdek/simge.js';
import { rxIsareti } from '../cekirdek/cizimler.js';
import { kagitCiz, kagidiYazdir, kagidiOlcekle, tarayiciBaskisi, OLCUM_SIMGELERI } from '../kagit.js';
import {
  OLCUMLER, KAN_GRUPLARI, bosRecete, receteDogrula, receteUyarilari, sikIlaclar,
} from '../paylasilan/recete.js';
import { klinigiOku } from '../depo/klinik.js';
import { gecmisler, adIndeksi } from '../paylasilan/klinik.js';
import { secimKutusu } from '../klinik-arayuz.js';
import { satirKutusu } from '../ilac-satir-arayuz.js';
import { sablonuUygula } from '../paylasilan/sablon.js';
import { sablonSecKutusu, sablonKaydetKutusu } from '../sablon-arayuz.js';
import { tamAd, hastaYasi, hastaAra, alerjiCakismasi } from '../paylasilan/hasta.js';
import { ilacAdiFormsuz, satirAdi } from '../paylasilan/ilac.js';
import { receteKaydet } from '../depo/recete.js';
import { bugun, tarihMetni } from '../paylasilan/tarih.js';
import { t } from '../i18n.js';
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

const doluMu = (v) => String(v ?? '').trim() !== '';

/* Formdaki ilaç tablosunda ad: şekil adı düşmüş (kâğıttaki gibi; sütun
   dar), sayı birimine bölünmez boşlukla bağlı. Dar sütunda ad kelime
   arasından kırılıyor: «Augmentin / 1000 mg», «1000 / mg Tablet» değil. */
const tablodakiAd = (s) => ilacAdiFormsuz(s.ilacAdi, s.form).replace(/(\d) (?=\D)/g, '$1\u00a0');

/* Formdaki ölçüm satırlarının simgeleri kâğıdın Clinical sütunuyla aynı
   adlar (kagit.js OLCUM_SIMGELERI, dolgulu tablodan): tek liste.
   Simgelerin çizim kutusu (px). Kutu görünen çizimden büyük: her simgenin
   viewBox'ındaki boşluk farklı, tasarımdaki mürekkep boyu (BP 33×30,
   Height 17×42 …) ancak kutu ayrı ayrı verilince tutuyor. */
const OLCUM_SIMGE_BOY = {
  bp: 46, pr: 32, rr: 36, bw: 37, temp: 37, spo2: 36, ht: 42, kanGrubu: 36,
};
/* Tasarımda Temperature, SpO2 ve Height kutuları dar (63 px), öbürleri
   geniş (105 px); uygulamanın sekizinci satırı Blood Gr. de dar. */
const OLCUM_DAR = new Set(['temp', 'spo2', 'ht', 'kanGrubu']);

/* Etiketler kâğıttakinin AYNISI olsun: hekim solda "T" görüp sağda
   "Temperature" okumasın. */
const OLCUM_ETIKET = {
  bp: 'BP', pr: 'PR', rr: 'RR', bw: 'BW',
  temp: 'Temperature', spo2: 'SpO2', ht: 'Height', kanGrubu: 'Blood Gr.',
};

/* Form başlığındaki dalga. Tasarımın yönünde çizildi: büyük dalga sağ
   uçta, kâğıda bakan kenarda; masaüstünde çevrilmiyor (sayfa yerleşimi
   orada soldan sağa). Telefonda başlık sağdan sola dizildiği için CSS onu
   aynalıyor. Yollar tasarımdaki renk bantlarının izine oturtuldu, çizerin
   eğrilerinin kopyası değil. Renkler CSS'te (sınıf başına bir token):
   karanlık temada ayrı tonlar alabilsin. */
const DALGA_YOLLARI = [
  // 1: sol alttan yükselen açık şerit
  'M0 62C90 50 200 28 262 0H330C270 30 170 62 110 76H0Z',
  // 2–4: sol üst köşedeki üç kat (açıktan koyuya)
  'M0 0H110C80 10 40 30 0 58Z',
  'M0 0H52C35 12 18 26 0 39Z',
  'M0 0H35C22 8 10 18 0 32Z',
  // 5: sağdaki dalganın önündeki soluk gölge
  'M381 0H521C530 8 545 15 562 22C585 30 615 34 683 40V50C640 46 600 42 575 34C550 26 530 20 505 16C460 10 420 4 381 0Z',
  // 6: koyu dalga
  'M513 0H683V36C668 34 650 31 630 31C605 31 585 28 565 23C545 17 528 9 513 0Z',
  // 7: koyunun üstündeki açık başlık; koyudan yalnız alttaki şerit kalıyor
  'M585 0H683V21C668 23 655 25 640 25C620 24 605 17 595 10C590 6 587 3 585 0Z',
  // 8: sağ uçta, açık şeridin altındaki ince ikinci bant
  'M600 45C625 44 645 42 660 36C670 32 677 30 683 28V38C672 40 660 44 640 46C625 47 612 47 600 45Z',
];
const baslikDalgasi = () => svgEl('svg', {
  class: 'recete-panel__dalga', viewBox: '0 0 683 76', preserveAspectRatio: 'none', 'aria-hidden': 'true',
}, DALGA_YOLLARI.map((d, i) => svgEl('path', { class: 'recete-panel__dalga-' + (i + 1), d })));

// Gezinme sırası: kâğıt veriyi beklerken başka bir sayfaya geçilirse eski
// çizim geri dönüp yeni sayfanın üstüne yazıyordu.
let cizimSirasi = 0;

export default {
  baslik: 'Reçete kâğıdı',
  async cizim(kok, ctx) {
    const benimSira = ++cizimSirasi;
    const { depo, git, basari, hata, onayla } = ctx;
    const [ilaclar, hastalar, ayar, ilkSablonlar, gecmisReceteler, klinik] = await Promise.all([
      depo.listele('ilaclar', { sirala: 'ad' }),
      depo.listele('hastalar', { sirala: 'soyad' }),
      depo.ayarlar(),
      depo.listele('sablonlar', { sirala: 'ad' }),
      depo.listele('receteler'),
      klinigiOku().catch(() => null),
    ]);
    if (benimSira !== cizimSirasi) return;

    const duzenleme = ctx.param.id ? await depo.al('receteler', ctx.param.id) : null;
    if (benimSira !== cizimSirasi) return;

    /* Yepyeni kurulumda karşılama. Bu sayfa artık uygulamanın GİRİŞ sayfası;
       eskiden karşılama yalnız paneldeydi ve hekim buraya ancak kendi gelirdi.
       O karşılama olmadan yeni kuran hekim boş bir kâğıda düşüyor: ne hasta
       var, ne dava, ne de nereden başlayacağını söyleyen bir şey. */
    if (!duzenleme && !ilaclar.length && !hastalar.length) {
      /* Boş cihaz çoğu zaman yeni kurulmuş ya da verisi silinmiş bir cihaz
         (iOS Safari sekmesi 7 günde siler, ana ekran uygulamasının deposu
         ayrı): hesabı olan hekim girişi Ayarlar'da aramadan bulsun. Sunucu
         yoksa ya da zaten girişliyse düğme yok — gideceği yer boş olurdu. */
      const hesapDurumu = ctx.hesap?.sunucuVar ? await ctx.hesap.hesapDurumu() : null;
      if (benimSira !== cizimSirasi) return;
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
    // Az önce eklenen ilaç satırının sırası: bir sonraki çizimde o satır
    // yükselerek giriyor, sonra sıfırlanıyor.
    let yeniSatir = null;

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
      'ilac-ekle': async () => {
        const y = await satirKutusu(ctx, ilaclar, hasta, null, sikYazilanlar);
        if (y) { recete.satirlar = [...recete.satirlar, y]; yeniSatir = recete.satirlar.length - 1; }
      },
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

    /** Kâğıttaki ilaç satırına dokununca: aynı kutu, dolu gelir.
     *  Kutudaki "Sil" satırı çıkarır. */
    async function satirDuzenle(i) {
      const s = recete.satirlar[i];
      if (!s) return;
      const y = await satirKutusu(ctx, ilaclar, hasta, s, sikYazilanlar);
      if (y === 'sil') {
        if (await onayla(t('recete.satir_sil_soru', '"{ad}" reçeteden çıkarılsın mı?', { ad: satirAdi(s) }))) {
          recete.satirlar = recete.satirlar.filter((_, j) => j !== i);
        }
      } else if (y) {
        recete.satirlar = recete.satirlar.map((x, j) => (j === i ? y : x));
      }
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
    async function kaydet({ yazdir = false } = {}) {
      if (kaydediliyor) return;
      hatalar = receteDogrula(recete);
      if (Object.keys(hatalar).length) { ciz(); hata(dogrulaMetni(Object.values(hatalar)[0])); return; }
      kaydediliyor = true;
      try {
        const kayit = await receteKaydet(depo, recete);
        // Numara yalıtılmış (LRI … PDI): Farsça cümlenin içinde tireli rakam
        // dizisi ters diziliyordu («01-24-09-2026»).
        basari(t('recete.kaydedildi', 'Reçete kaydedildi: {no}', { no: `\u2066${kayit.receteNo}\u2069` }));
        // Kayıt sürerken sayfadan çıkıldıysa hekimi geri çekmiyoruz.
        if (!aktif) return;
        // Yazdırma KAYITTAN SONRA: basılan kâğıtta reçete numarası ve
        // doğrulama kodu var, ikisi de kaydederken üretiliyor.
        if (yazdir) kagidiYazdir({ ayar, recete: kayit, hasta });
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
      const secim = ctx.modal({
        baslik: t('recete.onizleme', 'Basılacak kâğıt'), genis: true, sinif: 'modal--onizleme',
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
      olcekBirak?.();
      olcekBirak = olcekle(onizlemeKabi, kagit);
    }
    /** Yazarken her tuşta kâğıt yeniden çizilmesin: QR üretimi pahalı. */
    function tazeleGecikmeli() {
      clearTimeout(tazeleZamani);
      tazeleZamani = setTimeout(kagidiTazele, 180);
    }

    /* Pay yok: kâğıt önizleme sütununun (609 px) tam genişliğinde, tasarımdaki
       gibi. Yan yana düzende boyu da ekrana sığıyor: önizleme yapışkan ama
       ızgara satırı formla bitiyor; kâğıt ekrandan uzunsa hekim düğmelere
       inince antet üst çubuğun altına kayıyordu (1536×864'te 145 px). Üstte
       CSS'teki yapışma ofseti (üst çubuk + 12); altta ızgaranın altında kalan
       yer (alt şerit ve pay): sayfanın dibinde yapışkan kutu ancak ızgaranın
       dibine kadar inebiliyor. 1536×1024'te boy yetiyor (886 ≥ 882 px),
       orada ölçek değişmiyor. */
    const ikiSutun = matchMedia('(min-width: 1280px)');
    const sigacakBoy = () => {
      const duzen = kok.querySelector('.recete-duzen');
      if (!ikiSutun.matches || !duzen) return Infinity;
      const ust = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ust-cubuk'));
      const alti = document.documentElement.scrollHeight - scrollY - duzen.getBoundingClientRect().bottom;
      return innerHeight - ust - 12 - Math.max(12, alti);
    };
    const olcekle = (tuval, kagit) => kagidiOlcekle(tuval, kagit, kok, { pay: 0, yukseklik: sigacakBoy });

    /** Soldaki formun bir satırı: etiket, değer ve "+" kutusu. */
    function rxSatiri(odakAdi, etiket, deger, ipucu, eylem) {
      // Satırın tamamı bir kutu ve tıklanabilir: "+" küçük olduğu için
      // parmakla ıskalanıyordu; asıl hedef satırın kendisi.
      const ac = async () => { await eylem(); ciz(); };
      return el('div', { class: 'rx-satir', role: 'button', tabindex: '0', 'data-odak-adi': odakAdi, onclick: ac,
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); } } },
        el('span', { class: 'rx-satir__etiket' }, etiket),
        el('span', { class: doluMu(deger) ? 'rx-satir__deger' : 'rx-satir__deger sessiz' },
          doluMu(deger) ? deger : ipucu),
        el('span', { class: 'rx-satir__ayrac', 'aria-hidden': 'true' }),
        // "+" yalnız görünüş: kendi tıklaması yok, tık satıra kabarıyor.
        // Önce ayrı bir düğmeydi ve satırla birlikte İKİ kez açıyordu (üst
        // üste iki kutu); satırın içinde ikinci bir sekme durağı da oluyordu.
        el('span', { class: 'rx-satir__arti', 'aria-hidden': 'true' }, simge('arti', { boy: 12 })));
    }

    /* Kart başlığı: okuma yönünde önce simge, sonra başlık. Simge kutusuz,
       doğrudan şeridin üstünde (tasarımda karo yok). */
    function kartBasligi(simgeAdi, boy, baslik, { latin = false } = {}) {
      return el('div', { class: 'kart__bas kart__bas--serit' },
        el('span', { class: 'kart__bas-simge' }, simge(simgeAdi, { boy, dolu: true })),
        el('h2', latin ? { dir: 'ltr' } : {}, baslik));
    }

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
      // Silinen ilaç satırının düğmesi yok: odak «ilaç ekle»ye.
      const hedef = kok.querySelector(yer)
        || (yer.includes('ilac-duzenle-') ? kok.querySelector('[data-odak-adi="ilac-ekle"]') : null);
      hedef?.focus({ preventScroll: true });
    }

    function ciz() {
      if (!aktif || benimSira !== cizimSirasi) return;
      const giris = ilkCizim;
      ilkCizim = false;
      // İlk çizimde odak yönlendiricinin (başlığa veriyor).
      const odak = giris ? null : odakYeri();
      // Doğrulama hatası gösterildiyse her çizimde yeniden bakılıyor: hasta
      // seçilince «مریض باید انتخاب شود» şeridi ve kırmızı kenar gidiyor,
      // ilk ilaç eklenince onunki de. Önce ancak bir sonraki kayıt
      // denemesinde kalkıyorlardı.
      if (Object.keys(hatalar).length) hatalar = receteDogrula(recete);
      temizle(kok);

      /* ---- Panel başlığı: simge, başlık ve şablon düğmeleri ----
         Sayfa başlığı (sayfaBas) bu sayfada yok: başlık panelin kendi
         bandında ve h1 o — yönlendirici odağı ona veriyor. */
      const sablonDugmesi = (ad, metin, onclick) => btn(simge(ad, { boy: 16 }), {
        class: 'btn recete-panel__cam', title: metin, 'data-odak-adi': 'sablon-' + ad, onclick,
      }, el('span', { class: 'recete-panel__cam-metin' }, metin));
      const eylemDugmeleri = [];
      if (sablonlar.length) {
        eylemDugmeleri.push(sablonDugmesi('recete', t('sablon.doldur', 'Şablondan doldur'), async () => {
          const s = await sablonSecKutusu(ctx, sablonlar);
          if (!s) return;
          Object.assign(recete, sablonuUygula(recete, s));
          basari(t('sablon.uygulandi', '"{ad}" uygulandı', { ad: s.ad }));
          ciz();
        }));
      }
      if (recete.satirlar.length) {
        eylemDugmeleri.push(sablonDugmesi('kaydet', t('sablon.kaydet', 'Şablon olarak kaydet'), async () => {
          if (await sablonKaydetKutusu(ctx, recete)) {
            sablonlar = await depo.listele('sablonlar', { sirala: 'ad' });
            ciz();
          }
        }));
      }
      const panelBasi = el('header', { class: duzenleme ? 'recete-panel__bas recete-panel__bas--duzenle' : 'recete-panel__bas' },
        baslikDalgasi(),
        el('span', { class: 'recete-panel__simge' }, simge('yeni-recete', { boy: 45, dolu: true })),
        el('div', { class: 'recete-panel__metin' },
          // Numara kendi yönünde (bdi, soldan sağa): Farsça başlığın ardında
          // tireli rakamlar ters diziliyordu («01-24-09-2026»).
          duzenleme
            ? el('h1', {}, `${t('recete.duzenle', 'Reçeteyi düzenle')} · `,
              el('bdi', { class: 'recete-panel__no', dir: 'ltr' }, duzenleme.receteNo || ''))
            : el('h1', {}, t('recete.yeni', 'Yeni reçete')),
          el('p', {}, t('recete.yeni_alt', 'Hasta ve reçete bilgilerini gir.'))),
        eylemDugmeleri.length ? el('div', { class: 'recete-panel__eylem' }, ...eylemDugmeleri) : null);

      // Alerji ve çift etken madde uyarıları: kâğıda basılmıyorlar ama hekim
      // kaydetmeden önce görmeli. Hiçbiri kaydetmeyi engellemiyor. Panelin
      // içinde, başlıkla hasta kartı arasında duruyorlar; yalnız varken yer
      // kaplıyorlar.
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
      // görünümünde: soluk kişi simgesi ve boşken yer tutucu renginde yazı.
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
          }
          tazeleGecikmeli();
        },
      });
      // Numara ipucu görünür satır olarak kartı 36 px uzatıyordu; artık
      // üzerine gelince (title) ve ekran okuyucuya (aria-describedby) söyleniyor.
      // Gizli ipucu etiketin DIŞINDA: <label> içindeyken alanın adına da
      // katılıyor, ekran okuyucu onu iki kez okuyordu.
      const numaraIpucu = t('recete.numara_ipucu', 'Kaydedilince verilir');
      const numaraGirdisi = el('span', { class: 'girdi-simgeli' },
        simge('recete', { boy: 22, dolu: true, sinif: 'girdi-simgesi' }),
        girdi({
          value: recete.receteNo || '', readonly: true, title: numaraIpucu,
          placeholder: t('recete.numara_yer', 'İsteğe bağlı'), 'aria-describedby': 'recete-no-ipucu',
        }));

      const hastaKarti = kart({ class: 'kart kart--hasta' },
        kartBasligi('hasta-grup', 28, t('recete.hasta_bilgileri', 'Hasta bilgileri')),
        // Dört alan TEK satırda, genişlikleri tasarımdaki gibi: ad en geniş,
        // yaş en dar.
        el('div', { class: 'kart__govde' }, el('div', { class: 'izgara izgara--hasta' },
          alan(t('nav.hasta', 'Hasta'), hastaDugmesi, { gerekli: true }),
          // Yaş hastadan türüyor, elle yazılmıyor: gölgeli salt okunur kutu.
          // Yıldızı tasarımdaki gibi: hasta zorunlu olduğu için o da hep dolu.
          alan(t('hasta.yas_etiket', 'Yaş'), girdi({
            class: 'input input--salt', value: yas !== null ? String(yas) : '', readonly: true,
            placeholder: t('hasta.yas_birim', 'yıl'), dir: 'ltr',
          }), { gerekli: true }),
          alan(t('genel.tarih', 'Tarih'), tarihGirdisi, { gerekli: true }),
          alan(t('recete.numara', 'Reçete no'), numaraGirdisi)),
        el('span', { class: 'gizli-metin', id: 'recete-no-ipucu' }, numaraIpucu)));

      /* Clinical: ölçümler. Yazdıkça kâğıt tazeleniyor. */
      const olcumSatirlari = [...OLCUMLER, ['kanGrubu', 'Kan grubu', '', '']].map(([anahtar, , , birim]) => {
        const kanMi = anahtar === 'kanGrubu';
        // dir=ltr ŞART: birim yazıları ("/min", "°C") sağdan sola akışta ters
        // okunuyor — ekranda "min/" ve "C°" çıkıyordu. Değerler de ("118/76")
        // aynı sebeple soldan sağa yazılmalı.
        const g = girdi({
          name: 'olcum_' + anahtar, placeholder: birim || '', dir: 'ltr',
          value: kanMi ? (recete.kanGrubu || '') : (recete.olcumler?.[anahtar] ?? ''),
        });
        g.oninput = () => {
          if (kanMi) { recete.kanGrubu = g.value; kanElle = true; }
          else recete.olcumler = { ...recete.olcumler, [anahtar]: g.value };
          tazeleGecikmeli();
        };
        return el('div', { class: 'olcum-satir' + (OLCUM_DAR.has(anahtar) ? ' olcum-satir--dar' : '') },
          el('span', { class: 'olcum-satir__simge' },
            simge(OLCUM_SIMGELERI[anahtar], { boy: OLCUM_SIMGE_BOY[anahtar], dolu: true })),
          el('span', { class: 'olcum-satir__ad', dir: 'ltr' }, OLCUM_ETIKET[anahtar] || anahtar),
          g);
      });
      const klinikKarti = kart({ class: 'kart kart--klinik' },
        kartBasligi('stetoskop', 45, t('kagit.klinik', 'Clinical'), { latin: true }),
        el('div', { class: 'olcum-liste' }, ...olcumSatirlari));

      /* ℞ alanları ve ilaç listesi TEK kart: üstte satırlar, çizginin
         altında eklenen dawalar. */
      const rxUst = el('div', { class: 'kart--rx__ust' },
        // Başlık tasarımdaki "Rx" çizimi (kâğıttakiyle aynı yol); gizli «℞»
        // metni ekran okuyucu ve arama için yanında duruyor.
        el('h2', { class: 'rx-baslik' }, rxIsareti({ sinif: 'rx-baslik__isaret' })),
        rxSatiri('belirtiler', t('kagit.belirtiler', 'Belirtiler'), recete.belirtiler,
          t('recete.belirti_ipucu', 'Belirti seç ya da yaz…'), eylemler.belirtiler),
        rxSatiri('tani', t('recete.tani', 'Tanı'), [recete.tani, recete.taniKodu].filter(doluMu).join(' · '),
          t('recete.tani_ipucu', 'Tanı seç…'), eylemler.tani),
        rxSatiri('rx-ilac', t('recete.ilac_ekle', 'İlaç ekle'), '',
          t('recete.ilac_ipucu_kisa', 'İlaç ara ve ekle…'), eylemler['ilac-ekle']),
        rxSatiri('laboratuvar', t('kagit.laboratuvar', 'Laboratuvar'), recete.laboratuvar,
          t('recete.lab_ipucu', 'İstenen tetkikleri seç…'), eylemler.laboratuvar),
        rxSatiri('notlar', t('recete.not', 'Reçete notu'), recete.notlar,
          t('recete.not_ipucu', 'Özel not ya da öneri…'), eylemler.notlar));

      /* İlaç listesi: eklenenler tabloda, satır başına düzenle/sil. */
      const yeni = yeniSatir;
      yeniSatir = null;
      const ilacListesi = el('div', { class: 'kart--rx__ilac' },
        el('div', { class: 'ilac-bas' },
          el('h2', {}, t('recete.ilac_listesi', 'İlaç listesi')),
          btn(simge('arti', { boy: 20 }), {
            class: 'btn ilac-bas__ekle', 'data-odak-adi': 'ilac-ekle', onclick: async () => { await eylemler['ilac-ekle'](); ciz(); },
          }, t('recete.ilac_ekle', 'İlaç ekle'))),
        /* Tablo liste boşken de çiziliyor: başlık satırı hangi sütunlara ne
           gireceğini önceden söylüyor. Önce boş durum tabloyu tamamen
           götürüyordu ve kart ilk ilaç eklenene kadar bomboş duruyordu.
           Sütun genişlikleri sabit (colgroup, oranlar CSS'te): içerik
           değiştikçe başlık ayraçları kaymasın. */
        el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo tablo--ilac' },
          el('colgroup', {}, ...Array.from({ length: 6 }, () => el('col'))),
          el('thead', {}, el('tr', {},
            el('th', {}, '#'),
            el('th', {}, t('nav.ilac', 'İlaç')),
            // Kutudaki uzun etiket («… (بسته)») dar başlıkta iki satıra iniyordu.
            el('th', {}, t('recete.adet_kisa', 'Adet')),
            el('th', {}, t('recete.kullanim', 'Kullanım')),
            el('th', {}, t('recete.sure', 'Süre')),
            el('th', {}, t('genel.islem', 'İşlem')))),
          recete.satirlar.length
            // Az önce eklenen satır bir kez yükselerek giriyor; sonraki
            // çizimlerde sınıf yok, hareket tekrarlanmıyor.
            ? el('tbody', {}, ...recete.satirlar.map((s, i) => el('tr', { class: i === yeni ? 'tablo__yeni' : null },
              el('td', {}, String(i + 1)),
              // Latin ad sağdan sola hücrede kendi yönünde (bdi): sonu ")" olan
              // ad aynalanmasın.
              el('td', { class: 'ilac-ad', title: ilacAdiFormsuz(s.ilacAdi, s.form) || null },
                el('span', { class: 'ilac-ad__metin' }, el('bdi', {}, s.ilacAdi ? tablodakiAd(s) : '—'))),
              el('td', {}, String(s.adet ?? '')),
              el('td', { title: s.kullanim || null }, s.kullanim || '—'),
              el('td', { title: s.sure || null }, s.sure || '—'),
              el('td', {}, btn(simge('kalem', { boy: 16 }), {
                class: 'btn btn--ikon ilac-duzenle', 'aria-label': t('genel.duzenle', 'Düzenle'), 'data-odak-adi': 'ilac-duzenle-' + i,
                onclick: async () => { await satirDuzenle(i); ciz(); },
              })))))
            : el('tbody', {}, el('tr', { class: 'tablo__bos' },
              el('td', { colspan: '6' },
                simge('kapsul', { boy: 37, dolu: true }),
                el('span', {}, t('recete.ilac_bos_kisa', 'Henüz ilaç eklenmedi.'))))))));

      /* Alt düğmeler: temizle · önizle · kaydet ve yazdır. Yalnız kaydetmek
         önizleme kutusunun içinde ve Ctrl+S'te. Düzenlemede ortadaki düğme
         doğrudan kaydediyor: yazım hatası düzelten hekim bir kutudan
         geçmek zorunda kalmasın. */
      const eylemDugmesi = (simgesi, metin, tur, onclick) =>
        btn(simgesi, { class: 'btn recete-btn recete-btn--' + tur, 'data-odak-adi': 'eylem-' + tur, onclick }, metin);
      const altDugmeler = el('div', { class: 'recete-eylem' },
        eylemDugmesi(simge('cop', { boy: 22, dolu: true }), t('genel.temizle', 'Temizle'), 'sade', async () => {
          if (!await onayla(t('recete.temizle_soru', 'Girilen bilgiler silinsin mi?'), { evet: t('genel.temizle', 'Temizle') })) return;
          // Düzenlemede temizlemek düzenlemeden de çıkarıyor: yalnız formu
          // boşaltınca başlık «ویرایش نسخه» kalıyor, kaydet ise eski
          // reçetenin yerine YENİ bir reçete yazıyordu.
          if (duzenleme) { git('/recete/kagit'); return; }
          recete = bosRecete(ayar, bugun()); hasta = null; hatalar = {}; kanElle = false; ciz();
        }),
        duzenleme
          ? eylemDugmesi(simge('kaydet', { boy: 20 }), t('recete.kaydet_degisiklik', 'Değişiklikleri kaydet'), 'ikincil', () => kaydet({}))
          : eylemDugmesi(simge('goz', { boy: 23, dolu: true }), t('recete.onizle', 'Önizle'), 'ikincil', onizlemeAc),
        eylemDugmesi(simge('yazdir', { boy: 21, dolu: true }), t('recete.kaydet_yazdir', 'Kaydet ve yazdır'), 'asil', () => kaydet({ yazdir: true })));

      const rxKarti = kart({ class: 'kart kart--rx' }, rxUst, ilacListesi);

      /* Formun tamamı TEK panel: başlık bandı, uyarılar, hasta kartı,
         Clinical ile ℞ yan yana, alt düğmeler. */
      const sol = el('div', { class: 'recete-form recete-panel' }, panelBasi, serit, hataSeridi, hastaKarti,
        el('div', { class: 'recete-ikili' }, klinikKarti, rxKarti),
        altDugmeler);

      /* ---- Sağ sütun: canlı kâğıt ----
         Başlık («basılacak kâğıt») geniş ekranda görünmüyor, kâğıt panelle
         aynı hizadan başlıyor; bölgenin adı olarak ekran okuyucuda kalıyor. */
      onizlemeKabi = el('div', { class: 'kagit-tuval' });
      const sag = el('section', { class: 'recete-onizleme', 'aria-labelledby': 'recete-onizleme-bas' },
        el('div', { class: 'recete-onizleme__bas', id: 'recete-onizleme-bas' }, simge('yazdir', { boy: 16 }),
          el('span', {}, t('recete.onizleme', 'Basılacak kâğıt'))),
        onizlemeKabi);

      kok.appendChild(el('div', { class: giris ? 'recete-duzen recete-duzen--giris' : 'recete-duzen' }, sol, sag));
      // Geniş ekranda tablo kendi içinde kayıyor: yeni eklenen (hep sonda)
      // ilaç görünsün. Sayfanın kaydırması değişmiyor.
      if (yeni !== null) {
        const kap = ilacListesi.querySelector('.tablo-kap');
        kap.scrollTop = kap.scrollHeight;
      }
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
