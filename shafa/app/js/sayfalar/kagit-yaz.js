// Reçeteyi KÂĞIDIN ÜZERİNDE yazma ekranı — reçete yazmanın tek yolu.
//
// Form doldurup sonra çıktıya bakmak yerine hekim doğrudan reçetenin
// kendisine dokunuyor: ada dokun → hasta listesi, ℞ alanına dokun → ilaç
// listesi, علائم'e dokun → belirti listesi. Ne görüyorsa o basılıyor.
//
// Kâğıdın çizimi kagit.js'te tek yerde duruyor; burası onu `duzenlenebilir`
// kipinde çizdirip `data-alan` işaretlerinden yakalıyor. İkinci bir kâğıt
// kopyası yok — basılan neyse düzenlenen de o.
//
// Eski form (recete-yeni.js) bunun yerine geçti ve kaldırıldı. Oradaki her
// şey buraya taşındı: alerji uyarıları, şablonlar, düzenleme ve ilaç satırı
// kutusu — sonuncusu artık ilac-satir-arayuz.js'te, iki yerden de kullanılsın
// diye değil, tek yerde dursun diye.
import { el, temizle, btn, btnS, girdi, sayfaBas, uyariSeridi } from '../cekirdek/dom.js';
import { kagitCiz } from '../kagit.js';
import {
  OLCUMLER, KAN_GRUPLARI, bosRecete, receteDogrula, receteUyarilari, sikIlaclar,
} from '../paylasilan/recete.js';
import { klinigiOku } from '../depo/klinik.js';
import { gecmisler } from '../paylasilan/klinik.js';
import { secimKutusu } from '../klinik-arayuz.js';
import { satirKutusu } from '../ilac-satir-arayuz.js';
import { sablonuUygula } from '../paylasilan/sablon.js';
import { sablonSecKutusu, sablonKaydetKutusu } from '../sablon-arayuz.js';
import { tamAd, hastaAra, alerjiCakismasi } from '../paylasilan/hasta.js';
import { receteKaydet } from '../depo/recete.js';
import { bugun } from '../paylasilan/tarih.js';
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

    async function kaydet() {
      hatalar = receteDogrula(recete);
      if (Object.keys(hatalar).length) { ciz(); hata(dogrulaMetni(Object.values(hatalar)[0])); return; }
      try {
        const kayit = await receteKaydet(depo, recete);
        basari(t('recete.kaydedildi', 'Reçete kaydedildi'));
        git('/recete/' + kayit.id);
      } catch (e) { hata(hataMetni(e)); }
    }

    function ciz() {
      if (benimSira !== cizimSirasi) return;
      temizle(kok);

      const eylemDugmeleri = [
        btnS('kaydet', duzenleme ? t('recete.kaydet_degisiklik', 'Değişiklikleri kaydet') : t('recete.kaydet', 'Reçeteyi kaydet'),
          { class: 'btn btn--birincil', onclick: kaydet }),
      ];
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
      eylemDugmeleri.push(btn(t('genel.vazgec', 'Vazgeç'), {
        class: 'btn btn--sade',
        onclick: () => git(duzenleme ? `/recete/${duzenleme.id}` : '/receteler'),
      }));

      kok.append(sayfaBas(
        duzenleme ? `${t('recete.duzenle', 'Reçeteyi düzenle')} · ${duzenleme.receteNo || ''}` : t('nav.kagit', 'Reçete yaz'),
        { alt: t('kagit.yaz_alt', 'Kâğıdın üzerindeki alanlara dokunarak doldur.'), eylemler: eylemDugmeleri },
      ));

      // Alerji ve çift etken madde uyarıları kâğıdın ÜSTÜNDE: kâğıda
      // basılmıyorlar ama hekim kaydetmeden önce görmeli. Hiçbiri
      // kaydetmeyi engellemiyor — karar hekimin.
      const uyarilar = receteUyarilari(recete.satirlar, hasta, ilaclar, { alerjiBul: alerjiCakismasi });
      const serit = uyariSeridi(uyarilar.map((u) => ({ tur: u.tur, metin: uyariMetni(u) })));
      if (serit) kok.appendChild(serit);
      const ilkHata = hatalar.hastaId || hatalar.satirlar || hatalar.tarih;
      if (ilkHata) {
        kok.appendChild(el('div', { class: 'uyari uyari--hata' }, el('span', {}, dogrulaMetni(ilkHata))));
      }

      const tuval = el('div', { class: 'kagit-tuval' });
      const kagit = kagitCiz({ ayar, recete, hasta, duzenlenebilir: true });
      tuval.appendChild(kagit);
      kok.appendChild(tuval);

      // Kâğıt her ekranda AYNI tek uzun sayfa: mm ölçüleri değişmiyor,
      // yalnız kabın genişliğine göre ölçekleniyor. CSS kırılma noktaları
      // denendi ve kenar çubuğunu hesaba katmadıkları için telefonda kâğıt
      // 107 px'e düşüyordu; ölçek kabın GERÇEK genişliğinden hesaplanıyor.
      const KAGIT_PX = 794;            // 210 mm, 96 dpi
      const olcekle = () => {
        if (!tuval.isConnected) return;
        const olcek = Math.min(1, Math.max(0.2, (tuval.clientWidth - 8) / KAGIT_PX));
        tuval.style.setProperty('--olcek', String(olcek));
        // Ölçeklenen öğe yerinde yer kaplamıyor; tuvalin boyunu elle veriyoruz.
        tuval.style.blockSize = Math.ceil(kagit.offsetHeight * olcek) + 'px';
      };
      // İlk ölçüm yerleşimden SONRA: hemen ölçünce tuval daha dar geliyor
      // ve kâğıt küçücük kalıyordu.
      requestAnimationFrame(olcekle);
      // TUVALİN KENDİSİ İZLENMİYOR: boyunu bu geri çağrıda değiştiriyoruz,
      // izleseydik kendi kendini tetikleyen bir döngü olurdu.
      const gozcu = new ResizeObserver(olcekle);
      gozcu.observe(kok);
      gozcu.observe(kagit);

      // Tek dinleyici, kâğıdın tamamı için: olay kâğıttan yukarı geliyor.
      tuval.addEventListener('click', async (e) => {
        const hedef = e.target.closest('[data-alan]');
        if (!hedef) return;
        const ad = hedef.getAttribute('data-alan');
        if (ad.startsWith('ilac:')) await satirDuzenle(Number(ad.slice(5)));
        else if (ad.startsWith('olcum:')) await olcumDuzenle(ad.slice(6));
        else if (eylemler[ad]) await eylemler[ad]();
        else return;
        ciz();
      });
      tuval.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          const hedef = e.target.closest('[data-alan]');
          if (hedef) { e.preventDefault(); hedef.click(); }
        }
      });
    }

    ciz();
  },
};
