// Reçeteyi KÂĞIDIN ÜZERİNDE yazma ekranı.
//
// Form doldurup sonra çıktıya bakmak yerine hekim doğrudan reçetenin
// kendisine dokunuyor: ada dokun → hasta listesi, ℞ alanına dokun → ilaç
// listesi, علائم'e dokun → belirti listesi. Ne görüyorsa o basılıyor.
//
// Kâğıdın çizimi kagit.js'te tek yerde duruyor; burası onu `duzenlenebilir`
// kipinde çizdirip `data-alan` işaretlerinden yakalıyor. İkinci bir kâğıt
// kopyası yok — basılan neyse düzenlenen de o.
import { el, temizle, btn, btnS, girdi, sayfaBas } from '../cekirdek/dom.js';
import { kagitCiz } from '../kagit.js';
import { OLCUMLER, bosRecete, receteDogrula } from '../paylasilan/recete.js';
import { gecmisler } from '../paylasilan/klinik.js';
import { klinigiOku } from '../depo/klinik.js';
import { secimKutusu } from '../klinik-arayuz.js';
import { ilacAra, ilacEtiketi } from '../paylasilan/ilac.js';
import { tamAd, hastaAra } from '../paylasilan/hasta.js';
import { receteKaydet } from '../depo/recete.js';
import { bugun } from '../paylasilan/tarih.js';
import { t } from '../i18n.js';
import { dogrulaMetni, hataMetni } from '../hatalar.js';

/** Basit liste kutusu: ara, seç. Hasta ve ilaç için ortak. */
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
          el('div', { class: 'liste__alt' }, alt ? alt(k) || '—' : '—'))));
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

let cizimSirasi = 0;

export default {
  baslik: 'Reçete kâğıdı',
  async cizim(kok, ctx) {
    const benimSira = ++cizimSirasi;
    const { depo, git, basari, hata } = ctx;
    const [ilaclar, hastalar, ayar, gecmisReceteler, klinik] = await Promise.all([
      depo.listele('ilaclar', { sirala: 'ad' }),
      depo.listele('hastalar', { sirala: 'soyad' }),
      depo.ayarlar(),
      depo.listele('receteler'),
      klinigiOku().catch(() => null),
    ]);
    if (benimSira !== cizimSirasi) return;

    let recete = bosRecete(ayar, bugun());
    let hasta = null;
    let hatalar = {};

    /* --- Alan → ne açılacak --- */
    const eylemler = {
      hasta: async () => {
        const h = await listeKutusu(ctx, {
          baslik: t('recete.hasta_sec', 'Hasta seç'), kayitlar: hastalar, ara: hastaAra,
          etiket: tamAd, alt: (x) => [x.telefon, x.kanGrubu].filter(Boolean).join(' · '),
        });
        if (h) { hasta = h; recete.hastaId = h.id; }
      },
      tarih: async () => {
        const d = await degerKutusu(ctx, { baslik: t('genel.tarih', 'Tarih'), deger: recete.tarih, tur: 'date' });
        if (d) recete.tarih = d;
      },
      belirtiler: () => klinikSec('belirtiler', klinik?.belirtiler, klinik?.gruplar, t('recete.belirtiler', 'Belirti ve bulgular')),
      tani: () => klinikSec('tani', klinik?.tanilar, klinik?.gruplar, t('recete.tani_sec', 'Tanı seç'), 'taniKodu'),
      laboratuvar: () => klinikSec('laboratuvar', klinik?.laboratuvar, klinik?.labGruplari, t('recete.lab_sec', 'Laboratuvar / görüntüleme seç')),
      'ilac-ekle': async () => {
        const i = await listeKutusu(ctx, {
          baslik: t('recete.ilac_ekle', 'İlaç ekle'), kayitlar: ilaclar, ara: ilacAra,
          etiket: ilacEtiketi, alt: (x) => x.etkenMadde,
        });
        if (i) {
          recete.satirlar = [...recete.satirlar, {
            ilacId: i.id, ilacAdi: ilacEtiketi(i), form: i.form || '', etkenMadde: i.etkenMadde || '',
            adet: 1, kullanim: '', sure: '', yol: '', not: '',
          }];
        }
      },
      notlar: async () => {
        const n = await degerKutusu(ctx, { baslik: t('recete.not', 'Reçete notu'), deger: recete.notlar });
        if (n !== null) recete.notlar = n;
      },
    };

    async function klinikSec(alanAdi, liste, gruplar, baslik, kodAlani = null) {
      if (!liste) { hata(t('hata.tani_okunamadi', 'Klinik listeler okunamadı.')); return; }
      const y = await secimKutusu(ctx, { liste, gruplar, baslik, kodAlani, recete, alan: alanAdi });
      if (!y) return;
      recete[alanAdi] = y.metin;
      if (kodAlani) recete[kodAlani] = y.kodlar;
    }

    /** İlaç satırı: adet, kullanım, süre. Satıra dokununca açılıyor. */
    async function satirDuzenle(i) {
      const s = recete.satirlar[i];
      if (!s) return;
      const adet = girdi({ type: 'number', name: 'adet', min: 1, value: s.adet });
      const kullanim = girdi({ name: 'kullanim', value: s.kullanim });
      const sure = girdi({ name: 'sure', value: s.sure });
      const sonuc = await ctx.modal({
        baslik: s.ilacAdi, genis: true,
        govde: el('div', { class: 'izgara izgara--form' },
          el('label', {}, el('span', { class: 'alan__etiket' }, t('recete.adet', 'Adet')), adet),
          el('label', {}, el('span', { class: 'alan__etiket' }, t('recete.kullanim', 'Kullanım')), kullanim),
          el('label', {}, el('span', { class: 'alan__etiket' }, t('recete.sure', 'Süre')), sure)),
        dugmeler: [
          { metin: t('genel.sil', 'Sil'), deger: { sil: true } },
          { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
          { metin: t('genel.kaydet', 'Kaydet'), sinif: 'btn--birincil',
            cb: () => ({ adet: Math.max(1, Math.floor(Number(adet.value)) || 1), kullanim: kullanim.value.trim(), sure: sure.value.trim() }) },
        ],
      });
      if (!sonuc) return;
      recete.satirlar = sonuc.sil
        ? recete.satirlar.filter((_, j) => j !== i)
        : recete.satirlar.map((x, j) => (j === i ? { ...x, ...sonuc } : x));
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
      kok.append(sayfaBas(t('kagit.yaz', 'Reçete kâğıdı'), {
        alt: t('kagit.yaz_alt', 'Kâğıdın üzerindeki alanlara dokunarak doldur.'),
        eylemler: [
          btnS('kaydet', t('recete.kaydet', 'Reçeteyi kaydet'), { class: 'btn btn--birincil', onclick: kaydet }),
          btn(t('genel.vazgec', 'Vazgeç'), { class: 'btn btn--sade', onclick: () => git('/receteler') }),
        ],
      }));

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
      // Kâğıt büyüdükçe (ilaç eklendikçe) ve pencere değiştikçe yeniden ölçülüyor.
      //
      // TUVALİN KENDİSİ İZLENMİYOR: boyunu bu geri çağrıda değiştiriyoruz,
      // izleseydik kendi kendini tetikleyen bir döngü olur ve tarayıcı
      // bildirimleri düşürüp ölçeği 0.2'de bırakırdı (telefonda 158 px).
      const gozcu = new ResizeObserver(olcekle);
      gozcu.observe(kok);
      gozcu.observe(kagit);

      // Tek dinleyici, kâğıdın tamamı için: her yeniden çizimde yenisini
      // bağlamak yerine olay kâğıttan yukarı geliyor.
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
