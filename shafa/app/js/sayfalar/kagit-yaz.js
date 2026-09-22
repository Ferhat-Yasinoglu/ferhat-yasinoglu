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
import { el, temizle, btn, btnS, girdi, alan, kart, bosDurum, sayfaBas, uyariSeridi } from '../cekirdek/dom.js';
import { tarihSecici } from '../cekirdek/tarih-secici.js';
import { simge } from '../cekirdek/simge.js';
import { kagitCiz, kagidiYazdir, kagidiOlcekle } from '../kagit.js';
import {
  OLCUMLER, KAN_GRUPLARI, bosRecete, receteDogrula, receteUyarilari, sikIlaclar,
} from '../paylasilan/recete.js';
import { klinigiOku } from '../depo/klinik.js';
import { gecmisler } from '../paylasilan/klinik.js';
import { secimKutusu } from '../klinik-arayuz.js';
import { satirKutusu } from '../ilac-satir-arayuz.js';
import { sablonuUygula } from '../paylasilan/sablon.js';
import { sablonSecKutusu, sablonKaydetKutusu } from '../sablon-arayuz.js';
import { tamAd, hastaYasi, hastaAra, alerjiCakismasi } from '../paylasilan/hasta.js';
import { receteKaydet } from '../depo/recete.js';
import { bugun, tarihMetni } from '../paylasilan/tarih.js';
import { t } from '../i18n.js';
import { dogrulaMetni, hataMetni, uyariMetni } from '../hatalar.js';

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
        onclick: () => { secilen = k; document.querySelector('.ortu .btn--birincil')?.click(); },
      },
        el('div', { class: 'liste__govde' },
          el('div', { class: 'liste__baslik' }, etiket(k)),
          el('div', { class: 'liste__alt' }, (alt ? alt(k) : '') || '—'))));
    }
  }
  kutu.oninput = ciz;
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

const doluMu = (v) => String(v ?? '').trim() !== '';

/* Formdaki ölçüm satırlarının simgeleri; kâğıttakiyle aynı sıra. */
const OLCUM_SIMGE = {
  // BP nabız çizgili kalp: düz kalp bir ölçümden çok "beğen" gibi duruyordu.
  bp: 'nabiz-kalp', pr: 'ekg', rr: 'akciger', bw: 'tarti',
  temp: 'termometre', spo2: 'oksijen', ht: 'boy', kanGrubu: 'kan',
};

/* Etiketler kâğıttakinin AYNISI olsun: hekim solda "T" görüp sağda
   "Temperature" okumasın. */
const OLCUM_ETIKET = {
  bp: 'BP', pr: 'PR', rr: 'RR', bw: 'BW',
  temp: 'Temperature', spo2: 'SpO2', ht: 'Height', kanGrubu: 'Blood Gr.',
};

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

    let sablonlar = ilkSablonlar;
    let recete = duzenleme ? { ...duzenleme } : bosRecete(ayar, bugun());
    let hasta = recete.hastaId ? hastalar.find((h) => h.id === recete.hastaId) : null;
    // Hasta kartındaki "reçete yaz" düğmesi hastayı adreste taşıyor.
    if (!duzenleme && ctx.sorgu?.hasta) {
      hasta = hastalar.find((h) => h.id === ctx.sorgu.hasta) || null;
      if (hasta) { recete.hastaId = hasta.id; recete.kanGrubu = hasta.kanGrubu || ''; }
    }
    let hatalar = {};
    const sikYazilanlar = sikIlaclar(gecmisReceteler, ilaclar);

    /* --- Kâğıttaki alan → ne açılacak --- */
    const eylemler = {
      hasta: async () => {
        const h = await listeKutusu(ctx, {
          baslik: t('recete.hasta_sec', 'Hasta seç'), kayitlar: hastalar, ara: hastaAra,
          etiket: tamAd, alt: (x) => [x.telefon, x.kanGrubu].filter(Boolean).join(' · '),
        });
        if (h) {
          hasta = h; recete.hastaId = h.id;
          // Kan grubu hastanın kaydından mühürleniyor; kâğıtta değiştirilebilir.
          if (!recete.kanGrubu) recete.kanGrubu = h.kanGrubu || '';
        }
      },
      tarih: async () => {
        const d = await degerKutusu(ctx, { baslik: t('genel.tarih', 'Tarih'), deger: recete.tarih, tur: 'date' });
        if (d) recete.tarih = d;
      },
      kanGrubu: async () => {
        const g = await listeKutusu(ctx, {
          baslik: t('recete.kan_sec', 'Kan grubu seç'),
          kayitlar: KAN_GRUPLARI.map((x) => ({ ad: x })),
          ara: (liste, q) => liste.filter((x) => x.ad.toLowerCase().includes(String(q || '').toLowerCase())),
          etiket: (x) => x.ad, alt: () => t('kagit.kan', 'Kan grubu'),
        });
        if (g) recete.kanGrubu = g.ad;
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
        if (y) recete.satirlar = [...recete.satirlar, y];
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
        gecmis: gecmisler(gecmisReceteler, alanAdi, kodAlani),
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
        if (await onayla(t('recete.satir_sil_soru', '"{ad}" reçeteden çıkarılsın mı?', { ad: s.ilacAdi }))) {
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

    async function kaydet({ yazdir = false } = {}) {
      hatalar = receteDogrula(recete);
      if (Object.keys(hatalar).length) { ciz(); hata(dogrulaMetni(Object.values(hatalar)[0])); return; }
      try {
        const kayit = await receteKaydet(depo, recete);
        basari(t('recete.kaydedildi', 'Reçete kaydedildi'));
        // Yazdırma KAYITTAN SONRA: basılan kâğıtta reçete numarası ve
        // doğrulama kodu var, ikisi de kaydederken üretiliyor.
        if (yazdir) kagidiYazdir({ ayar, recete: kayit, hasta });
        git('/recete/' + kayit.id);
      } catch (e) { hata(hataMetni(e)); }
    }

    /** Kâğıdı yeniden çizer. Formun HER tuşunda sayfanın tamamını çizmek
     *  yazarken odağı düşürüyordu; yalnız önizleme tazeleniyor. */
    let onizlemeKabi = null;
    let tazeleZamani = 0;
    function kagidiTazele() {
      if (!onizlemeKabi || !onizlemeKabi.isConnected) return;
      temizle(onizlemeKabi);
      const kagit = kagitCiz({ ayar, recete, hasta, duzenlenebilir: true });
      onizlemeKabi.appendChild(kagit);
      olcekle(onizlemeKabi, kagit);
    }
    /** Yazarken her tuşta kâğıt yeniden çizilmesin: QR üretimi pahalı. */
    function tazeleGecikmeli() {
      clearTimeout(tazeleZamani);
      tazeleZamani = setTimeout(kagidiTazele, 180);
    }

    const olcekle = (tuval, kagit) => kagidiOlcekle(tuval, kagit, kok);

    /** Soldaki formun bir satırı: etiket, değer ve "+" düğmesi. */
    function rxSatiri(etiket, deger, ipucu, eylem) {
      // Satırın tamamı bir kutu ve tıklanabilir: "+" küçük olduğu için
      // parmakla ıskalanıyordu; asıl hedef satırın kendisi.
      const ac = async () => { await eylem(); ciz(); };
      return el('div', { class: 'rx-satir', role: 'button', tabindex: '0', onclick: ac,
        onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ac(); } } },
        el('span', { class: 'rx-satir__etiket' }, etiket),
        el('span', { class: doluMu(deger) ? 'rx-satir__deger' : 'rx-satir__deger sessiz' },
          doluMu(deger) ? deger : ipucu),
        el('span', { class: 'rx-satir__ayrac', 'aria-hidden': 'true' }),
        btnS('arti', '', { class: 'btn btn--ikon rx-satir__arti', 'aria-label': etiket, onclick: ac }));
    }

    /* Kart başlığı: okuma yönünde önce simge kutusu, sonra başlık.
       Şeridin kendi zemini var — ince gri çizgi tek başına kartın gövdesinden
       ayırmaya yetmiyordu. */
    function kartBasligi(simgeAdi, baslik, { latin = false } = {}) {
      return el('div', { class: 'kart__bas kart__bas--serit' },
        el('span', { class: 'kart__bas-simge' }, simge(simgeAdi, { boy: 22 })),
        el('h2', latin ? { dir: 'ltr' } : {}, baslik));
    }

    function ciz() {
      if (benimSira !== cizimSirasi) return;
      temizle(kok);

      /* ---- Sayfa başlığı ve şablon düğmeleri ---- */
      const eylemDugmeleri = [];
      if (sablonlar.length) {
        eylemDugmeleri.push(btnS('recete', t('sablon.doldur', 'Şablondan doldur'), { class: 'btn', onclick: async () => {
          const s = await sablonSecKutusu(ctx, sablonlar);
          if (!s) return;
          Object.assign(recete, sablonuUygula(recete, s));
          basari(t('sablon.uygulandi', '"{ad}" uygulandı', { ad: s.ad }));
          ciz();
        } }));
      }
      if (recete.satirlar.length) {
        eylemDugmeleri.push(btnS('kaydet', t('sablon.kaydet', 'Şablon olarak kaydet'), { class: 'btn', onclick: async () => {
          if (await sablonKaydetKutusu(ctx, recete)) {
            sablonlar = await depo.listele('sablonlar', { sirala: 'ad' });
            ciz();
          }
        } }));
      }
      kok.append(sayfaBas(
        duzenleme ? `${t('recete.duzenle', 'Reçeteyi düzenle')} · ${duzenleme.receteNo || ''}` : t('recete.yeni', 'Yeni reçete'),
        { alt: t('recete.yeni_alt', 'Hasta ve reçete bilgilerini gir.'), eylemler: eylemDugmeleri },
      ));

      // Alerji ve çift etken madde uyarıları: kâğıda basılmıyorlar ama hekim
      // kaydetmeden önce görmeli. Hiçbiri kaydetmeyi engellemiyor.
      const uyarilar = receteUyarilari(recete.satirlar, hasta, ilaclar, { alerjiBul: alerjiCakismasi });
      const serit = uyariSeridi(uyarilar.map((u) => ({ tur: u.tur, metin: uyariMetni(u) })));
      if (serit) kok.appendChild(serit);
      const ilkHata = hatalar.hastaId || hatalar.satirlar || hatalar.tarih;
      if (ilkHata) kok.appendChild(el('div', { class: 'uyari uyari--hata' }, el('span', {}, dogrulaMetni(ilkHata))));

      /* ---- Sol sütun: form ---- */
      const yas = hasta ? hastaYasi(hasta) : null;
      const hastaDugmesi = btn(hasta ? tamAd(hasta) : t('recete.hasta_sec', 'Hasta seç'), {
        class: 'btn secim-alani' + (hatalar.hastaId ? ' input--hata' : ''),
        onclick: async () => { await eylemler.hasta(); ciz(); },
      });
      // Kutu da takvim de ŞEMSİ. Depoda tarih yine miladi ISO — seçici onu
      // gizli alanda taşıyor. Önce miladi bir kutu vardı ve şemsi karşılığı
      // altında yazıyordu; hekim her seferinde kafadan çeviriyordu.
      const tarihGirdisi = tarihSecici({
        name: 'tarih', value: recete.tarih,
        degisti: (iso) => { recete.tarih = iso; tazeleGecikmeli(); },
      });

      const hastaKarti = kart({},
        kartBasligi('hasta', t('recete.hasta_bilgileri', 'Hasta bilgileri')),
        // Dört alan TEK satırda, genişlikleri içeriğe göre: ad en geniş,
        // yaş en dar. Eşit dört kutuda "Yaş" için ayrılan yer boşa gidiyordu.
        el('div', { class: 'izgara izgara--hasta' },
          alan(t('nav.hasta', 'Hasta'), hastaDugmesi, { gerekli: true }),
          alan(t('hasta.yas_etiket', 'Yaş'), girdi({
            value: yas !== null ? String(yas) : '', readonly: true,
            placeholder: t('hasta.yas_birim', 'yıl'), dir: 'ltr',
          })),
          alan(t('genel.tarih', 'Tarih'), tarihGirdisi, { gerekli: true }),
          alan(t('recete.numara', 'Reçete no'), girdi({
            value: recete.receteNo || '', readonly: true,
            placeholder: t('recete.numara_yer', 'İsteğe bağlı'),
          }), { ipucu: t('recete.numara_ipucu', 'Kaydedilince verilir') })));

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
          if (kanMi) recete.kanGrubu = g.value;
          else recete.olcumler = { ...recete.olcumler, [anahtar]: g.value };
          tazeleGecikmeli();
        };
        return el('div', { class: 'olcum-satir' },
          el('span', { class: 'olcum-satir__simge' }, simge(OLCUM_SIMGE[anahtar] || 'kalp', { boy: 21 })),
          el('span', { class: 'olcum-satir__ad', dir: 'ltr' }, OLCUM_ETIKET[anahtar] || anahtar),
          g);
      });
      const klinikKarti = kart({},
        kartBasligi('stetoskop', t('kagit.klinik', 'Clinical'), { latin: true }),
        el('div', { class: 'olcum-liste' }, ...olcumSatirlari));

      /* ℞ alanları: her biri kendi kutusunu açıyor. */
      const rxKarti = kart({ class: 'kart kart--rx' },
        // Başlığın altında çizgi YOK: ℞ sembolü ile satırlar tek blok akıyor.
        el('div', { class: 'kart__bas kart__bas--cizgisiz' }, el('h2', { class: 'rx-baslik', dir: 'ltr' }, '℞')),
        rxSatiri(t('kagit.belirtiler', 'Belirtiler'), recete.belirtiler,
          t('recete.belirti_ipucu', 'Belirti seç ya da yaz…'), eylemler.belirtiler),
        rxSatiri(t('recete.tani', 'Tanı'), [recete.tani, recete.taniKodu].filter(doluMu).join(' · '),
          t('recete.tani_ipucu', 'Tanı seç…'), eylemler.tani),
        rxSatiri(t('recete.ilac_ekle', 'İlaç ekle'), '',
          t('recete.ilac_ipucu_kisa', 'İlaç ara ve ekle…'), eylemler['ilac-ekle']),
        rxSatiri(t('kagit.laboratuvar', 'Laboratuvar'), recete.laboratuvar,
          t('recete.lab_ipucu', 'İstenen tetkikleri seç…'), eylemler.laboratuvar),
        rxSatiri(t('recete.not', 'Reçete notu'), recete.notlar,
          t('recete.not_ipucu', 'Özel not ya da öneri…'), eylemler.notlar));

      /* İlaç listesi: eklenenler tabloda, satır başına düzenle/sil. */
      const ilacKarti = kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, t('recete.ilac_listesi', 'İlaç listesi')),
          btnS('arti', t('recete.ilac_ekle', 'İlaç ekle'), { class: 'btn btn--birincil btn--kucuk', onclick: async () => { await eylemler['ilac-ekle'](); ciz(); } })),
        /* Tablo liste boşken de çiziliyor: başlık satırı hangi sütunlara ne
           gireceğini önceden söylüyor. Önce boş durum tabloyu tamamen
           götürüyordu ve kart ilk ilaç eklenene kadar bomboş duruyordu. */
        el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo tablo--ilac' },
          el('thead', {}, el('tr', {},
            el('th', {}, '#'),
            el('th', {}, t('nav.ilac', 'İlaç')),
            el('th', {}, t('recete.adet', 'Adet')),
            el('th', {}, t('recete.kullanim', 'Kullanım')),
            el('th', {}, t('recete.sure', 'Süre')),
            el('th', {}, t('genel.islem', 'İşlem')))),
          recete.satirlar.length
            ? el('tbody', {}, ...recete.satirlar.map((s, i) => el('tr', {},
              el('td', {}, String(i + 1)),
              el('td', {}, s.ilacAdi || '—'),
              el('td', {}, String(s.adet ?? '')),
              el('td', {}, s.kullanim || '—'),
              el('td', {}, s.sure || '—'),
              el('td', {}, btnS('kalem', '', {
                class: 'btn btn--ikon btn--kucuk', 'aria-label': t('genel.duzenle', 'Düzenle'),
                onclick: async () => { await satirDuzenle(i); ciz(); },
              })))))
            : el('tbody', {}, el('tr', { class: 'tablo__bos' },
              el('td', { colspan: '6' },
                simge('ilac', { boy: 20 }),
                el('span', {}, t('recete.ilac_bos_kisa', 'Henüz ilaç eklenmedi.'))))))));

      /* Alt düğmeler */
      const altDugmeler = el('div', { class: 'satir recete-eylem' },
        btnS('cop', t('genel.temizle', 'Temizle'), { class: 'btn btn--sade', onclick: async () => {
          if (await onayla(t('recete.temizle_soru', 'Girilen bilgiler silinsin mi?'), { evet: t('genel.temizle', 'Temizle') })) {
            recete = bosRecete(ayar, bugun()); hasta = null; hatalar = {}; ciz();
          }
        } }),
        btnS('kaydet', duzenleme ? t('recete.kaydet_degisiklik', 'Değişiklikleri kaydet') : t('recete.kaydet', 'Reçeteyi kaydet'),
          { class: 'btn', onclick: () => kaydet({}) }),
        btnS('yazdir', t('recete.kaydet_yazdir', 'Kaydet ve yazdır'), { class: 'btn btn--birincil', onclick: () => kaydet({ yazdir: true }) }));

      const sol = el('div', { class: 'recete-form' }, hastaKarti,
        el('div', { class: 'recete-ikili' }, klinikKarti, rxKarti),
        ilacKarti, altDugmeler);

      /* ---- Sağ sütun: canlı kâğıt ---- */
      onizlemeKabi = el('div', { class: 'kagit-tuval' });
      const sag = el('div', { class: 'recete-onizleme' },
        el('div', { class: 'recete-onizleme__bas' }, simge('yazdir', { boy: 16 }),
          el('span', {}, t('recete.onizleme', 'Basılacak kâğıt'))),
        onizlemeKabi);

      kok.appendChild(el('div', { class: 'recete-duzen' }, sol, sag));
      kagidiTazele();

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
  },
};
