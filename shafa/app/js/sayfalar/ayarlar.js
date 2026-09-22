// Ayarlar: reçete antedi, yedek, örnek veri, depolama, görünüm ve tehlikeli bölge.
// Antet bilgileri hem yeni reçetelere düşer hem de basılan kâğıdın başlığını kurar.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, kart, rozet, sayfaBas } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { gorseliOku, gorselMi } from '../cekirdek/gorsel.js';
import { yedekOlustur, iceAktar, yedekDogrula, indir, hatirlatmaGerekli } from '../depo/yedek.js';
import { ornekYukle, ornekAntetiSil } from '../depo/ornek.js';
import { hazirListeyiYukle } from '../depo/hazir-ilaclar.js';
import { KOLEKSIYONLAR } from '../depo/sema.js';
import { tarihSaatMetni } from '../paylasilan/tarih.js';
import { sayiMetni, bicimAyarla, PARA_BIRIMLERI } from '../paylasilan/metin.js';
import { t } from '../i18n.js';
import { sablonListesi } from '../sablon-arayuz.js';
import { kagidiYazdir } from '../kagit.js';
import { hataMetni } from '../hatalar.js';
import { metniDogrula } from '../depo/dogrulama.js';

/* Koleksiyon → ekranda görünecek etiket. HER yedeklenen koleksiyon burada
   olmalı: eksik kalan, "Veriler" kartında ve yedek geri yükleme metninde ham
   anahtarıyla, yani Türkçe basılıyor (şablonlar eklendiğinde tam bu oldu:
   Farsça sütunun ortasında "sablonlar" yazıyordu). Denetim bunu göremiyor,
   anahtar `KOL_ANAHTARI[ad] || ad` ile dinamik kuruluyor — tarayıcı denemesi
   kartta Latin harfli etiket kalmadığını doğruluyor. */
const KOL_ANAHTARI = {
  ilaclar: 'nav.ilaclar', hastalar: 'nav.hastalar', receteler: 'nav.receteler',
  sablonlar: 'sablon.kisa', ayarlar: 'nav.ayarlar',
};
const KOL_ADI = {
  ilaclar: 'İlaç', hastalar: 'Hasta', receteler: 'Reçete',
  sablonlar: 'Şablon', ayarlar: 'Ayar',
};

/** Antet alanları: [anahtar, Türkçe etiket, ipucu, çokSatır?]
 *  Sıra kâğıttaki sırayla aynı: ad, ünvan, slogan, hizmetler, sabıka, iletişim. */
const ANTET_ALANLARI = [
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

const QR_SECENEKLERI = [
  ['whatsapp', 'WhatsApp bağlantısı (hasta karekodu okutup yazabilir)'],
  ['recete', 'Reçete metni (okutunca reçete telefonda açılır)'],
  ['yok', 'QR basma'],
];

function boyutMetni(bayt) {
  if (!bayt) return '—';
  const birim = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bayt;
  while (n >= 1024 && i < birim.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${birim[i]}`;
}

/** Yedek dosyasını okur, önce sorar, sonra yükler. */
async function geriYukle(ctx, dosya) {
  const { depo, modal, basari, hata } = ctx;
  let belge;
  try { belge = JSON.parse(await dosya.text()); }
  catch { hata(t('yedek.okunamadi', 'Dosya okunamadı — geçerli bir JSON değil.')); return false; }

  const dogrulama = yedekDogrula(belge);
  if (!dogrulama.gecerli) { hata(dogrulama.hatalar.join(' ')); return false; }

  const strateji = secim([
    ['birlestir', t('yedek.birlestir', 'Birleştir — yalnız daha yeni kayıtlar yazılır (önerilen)')],
    ['degistir', t('yedek.degistir', 'Değiştir — mevcut kayıtlar silinip yedek yazılır')],
  ], { value: 'birlestir' });

  const sayilar = Object.entries(belge.koleksiyonlar || {})
    .filter(([ad]) => ad !== 'ayarlar' && ad !== 'meta')
    .map(([ad, l]) => `${sayiMetni(l.length)} ${t(KOL_ANAHTARI[ad] || ad, KOL_ADI[ad] || ad).toLocaleLowerCase('tr')}`);

  const onay = await modal({
    baslik: t('yedek.geri_yukle', 'Yedekten geri yükle'),
    govde: el('div', {},
      el('p', {}, t('yedek.dosya_tarihi', 'Dosya tarihi: {t}', { t: tarihSaatMetni(belge.olusturuldu) })),
      el('p', {}, t('yedek.icindekiler', 'İçindekiler: {l}', { l: sayilar.join(', ') || '—' })),
      el('div', { class: 'alan' }, el('span', { class: 'alan__etiket' }, t('yedek.nasil', 'Nasıl yüklensin?')), strateji),
      el('div', { class: 'uyari uyari--bilgi' }, simge('bilgi', { boy: 16 }), el('span', {}, t('yedek.uyari', 'Birleştirmede hiçbir kayıt kaybolmaz; değiştirmede bu cihazdaki kayıtlar silinir.')))),
    dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.yukle', 'Yükle'), sinif: 'btn--birincil', deger: true }],
  });
  if (!onay) return false;

  const sonuc = await iceAktar(depo, belge, { strateji: strateji.value });
  if (!sonuc.ok) { hata(sonuc.hatalar.join(' ')); return false; }
  const eklenen = Object.values(sonuc.rapor).reduce((a, r) => a + r.eklendi + r.guncellendi, 0);
  basari(t('yedek.yuklendi', '{n} kayıt yüklendi', { n: eklenen }));
  return true;
}

export default {
  baslik: 'Ayarlar',
  async cizim(kok, ctx) {
    const { depo, modal, onayla, basari, hata, uyar } = ctx;

    let sira = 0;
    async function ciz() {
      const benim = ++sira;
      const meta = await depo.meta();
      const ayar = await depo.ayarlar();
      const h = hatirlatmaGerekli(meta);
      const kapasite = depo.kapasite ? await depo.kapasite() : null;
      const sablonlar = await depo.listele('sablonlar', { sirala: 'ad' });
      const sayilar = {};
      for (const ad of Object.keys(KOLEKSIYONLAR)) {
        if (ad === 'meta' || ad === 'ayarlar') continue;
        sayilar[ad] = await depo.say(ad);
      }
      if (benim !== sira) return;

      temizle(kok);
      kok.append(sayfaBas(t('nav.ayarlar', 'Ayarlar'), { alt: t('ayar.alt', 'Reçete antedi, yedek ve uygulama bilgileri.') }));

      /* --- Reçete antedi --- */
      const antet = {};
      for (const [anahtar, , , cokSatir] of ANTET_ALANLARI) {
        antet[anahtar] = cokSatir
          ? metinAlani({ name: anahtar, rows: 2, value: ayar[anahtar] ?? '' })
          : girdi({ name: anahtar, value: ayar[anahtar] ?? '' });
      }
      const boyut = secim([['A4', 'A4'], ['A5', 'A5']], { name: 'yazdirmaBoyutu', value: ayar.yazdirmaBoyutu || 'A4' });
      const stil = secim([
        ['modern', t('ayar.stil_modern', 'Modern (beyaz zemin, ince çizgiler)')],
        ['klasik', t('ayar.stil_klasik', 'Klasik (basılı kâğıdın aynısı)')],
        ['sade', t('ayar.stil_sade', 'Sade (siyah-beyaz, az mürekkep)')],
      ], { name: 'kagitStili', value: ayar.kagitStili === 'renkli' ? 'klasik' : (ayar.kagitStili || 'modern') });
      const qr = secim(QR_SECENEKLERI.map(([k, ad]) => [k, t('ayar.qr.' + k, ad)]), { name: 'qrIcerik', value: ayar.qrIcerik || 'recete' });
      const para = secim(PARA_BIRIMLERI, { name: 'paraBirimi', value: ayar.paraBirimi || 'AFN' });

      /* Clinical sütununun altındaki fotoğraf. Dosya CİHAZDA okunuyor,
         küçültülüp ayarlara yazılıyor — hiçbir yere yüklenmiyor. Hekim
         yüklemezse kâğıtta çizim duruyor. */
      let saglikGorseli = gorselMi(ayar.saglikGorseli) ? ayar.saglikGorseli : '';
      const gorselOnizleme = el('div', { class: 'gorsel-secim__onizleme' });
      const gorselDosyasi = el('input', {
        type: 'file', accept: 'image/*', hidden: true,
        onchange: async (e) => {
          const d = e.target.files?.[0];
          e.target.value = '';
          if (!d) return;
          try {
            saglikGorseli = await gorseliOku(d);
            gorseliCiz();
            uyar(t('ayar.gorsel_kaydet_gerek', 'Görsel seçildi — kaydetmeyi unutma.'));
          } catch (hataNesnesi) { hata(hataMetni(hataNesnesi)); }
        },
      });
      function gorseliCiz() {
        temizle(gorselOnizleme);
        gorselOnizleme.append(
          saglikGorseli
            ? el('img', { class: 'gorsel-secim__resim', src: saglikGorseli, alt: '' })
            : el('span', { class: 'sessiz' }, t('ayar.gorsel_yok', 'Şimdilik çizim basılıyor')),
          el('div', { class: 'satir' },
            btnS('yukle', saglikGorseli ? t('ayar.gorsel_degistir', 'Değiştir') : t('ayar.gorsel_sec', 'Fotoğraf seç'),
              { class: 'btn btn--kucuk', onclick: () => gorselDosyasi.click() }),
            saglikGorseli
              ? btnS('cop', t('genel.kaldir', 'Kaldır'), {
                class: 'btn btn--kucuk btn--sade',
                onclick: () => { saglikGorseli = ''; gorseliCiz(); uyar(t('ayar.gorsel_kaydet_gerek', 'Görsel seçildi — kaydetmeyi unutma.')); },
              })
              : null));
      }
      gorseliCiz();
      const gorselSecim = el('div', { class: 'gorsel-secim' }, gorselDosyasi, gorselOnizleme);

      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('ayar.antet', 'Reçete antedi'))),
        el('p', { class: 'kart__alt' }, t('ayar.antet_alt', 'Bu bilgiler basılan reçete kâğıdının başlığını kurar ve yeni reçetelere kendiliğinden düşer. Bir reçete kaydedilince doktor bilgileri o günkü haliyle reçeteye işlenir — sonradan burada değişiklik yapsan eski reçeteler bozulmaz.')),
        el('div', { class: 'izgara izgara--form', style: { marginBlockStart: 'var(--b-3)' } },
          ...ANTET_ALANLARI.map(([anahtar, etiket, ipucu]) =>
            alan(t('ayar.' + anahtar, etiket), antet[anahtar], ipucu ? { ipucu: t('ayar.' + anahtar + '_ipucu', ipucu) } : {})),
          alan(t('ayar.kagit', 'Reçete kâğıdı'), boyut),
          alan(t('ayar.kagit_stili', 'Kâğıt stili'), stil),
          alan(t('ayar.qr', 'Karekod (QR)'), qr),
          alan(t('ayar.para', 'Para birimi'), para)),
        alan(t('ayar.saglik_gorseli', 'Clinical sütunundaki fotoğraf'), gorselSecim, {
          ipucu: t('ayar.saglik_gorseli_ipucu', 'Kâğıdın sol altında, «Healthy Life Brighter Tomorrow» yazısının yanında basılır. Bu cihazda kalır, hiçbir yere yüklenmez.'),
        }),
        el('div', { class: 'satir', style: { marginBlockStart: 'var(--b-3)' } },
          btnS('kaydet', t('ayar.antet_kaydet', 'Antet bilgilerini kaydet'), { class: 'btn btn--birincil', onclick: async () => {
            const v = { yazdirmaBoyutu: boyut.value, kagitStili: stil.value, qrIcerik: qr.value, paraBirimi: para.value };
            for (const [anahtar] of ANTET_ALANLARI) v[anahtar] = antet[anahtar].value.trim();
            v.saglikGorseli = saglikGorseli;
            await depo.ayarKaydet(v);
            bicimAyarla({ kur: para.value });
            basari(t('ayar.kaydedildi', 'Bilgiler kaydedildi'));
            ciz();
          } }),
          btnS('yazdir', t('ayar.bos_kagit', 'Boş reçete kâğıdı yazdır'), {
            class: 'btn',
            title: t('ayar.bos_kagit_ipucu', 'Elle doldurmak için tomar halinde bastır'),
            onclick: () => kagidiYazdir({ ayar, bos: true }),
          }))));

      /* --- Reçete doğrulama --- */
      const kutu = metinAlani({ rows: 6, placeholder: t('dogrula.yer', 'QR\'dan okunan metni buraya yapıştır') });
      const sonuc = el('div', { style: { marginBlockStart: 'var(--b-3)' } });
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('dogrula.baslik', 'Reçete doğrula'))),
        el('p', { class: 'kart__alt' }, t('dogrula.alt', 'Kâğıttaki QR okutulup metni buraya yapıştırılır. Kod tutuyorsa reçete bu cihazdan çıkmıştır ve üzerinde oynanmamıştır. Kâğıtta ilaç, adet ya da doz değiştirilmişse kod tutmaz.')),
        alan('', kutu),
        btnS('onay', t('dogrula.dugme', 'Denetle'), { class: 'btn btn--birincil', onclick: async () => {
          temizle(sonuc);
          const metin = kutu.value.trim();
          if (!metin) { sonuc.appendChild(el('div', { class: 'uyari uyari--bilgi' }, simge('bilgi', { boy: 16 }), el('span', {}, t('dogrula.bos', 'Önce metni yapıştır.')))); return; }
          try {
            const r = await metniDogrula(depo, metin);
            const bicim = {
              gecerli: ['uyari--bilgi', 'basari', t('dogrula.gecerli', 'Geçerli — bu reçete bu cihazdan çıkmış ve değiştirilmemiş.')],
              gecersiz: ['uyari--hata', 'hata', t('dogrula.gecersiz', 'TUTMUYOR — metin değiştirilmiş ya da kod başka bir cihazdan. Beklenen kod: {k}', { k: r.beklenen })],
              kodsuz: ['uyari', 'uyari', t('dogrula.kodsuz', 'Metinde doğrulama kodu yok. Bu metnin kodu şu olmalıydı: {k}', { k: r.beklenen || '—' })],
            }[r.durum];
            sonuc.appendChild(el('div', { class: `uyari ${bicim[0]}` }, simge(bicim[1], { boy: 16 }), el('span', {}, bicim[2])));
          } catch (e) { hata(hataMetni(e)); }
        } }),
        sonuc));

      /* --- Yedek --- */
      const dosyaGirdisi = el('input', {
        type: 'file', accept: 'application/json,.json', hidden: true,
        onchange: async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f && await geriYukle(ctx, f)) ciz();
        },
      });
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, t('ayar.yedek', 'Yedek')),
          h.gerekli ? rozet(t('ayar.yedek_gerekli', 'yedek gerekli'), 'sari') : rozet(t('ayar.guncel', 'güncel'), 'yesil')),
        el('p', { class: 'kart__alt' }, meta.sonYedek
          ? t('ayar.son_yedek', 'Son yedek: {t} · o günden beri {n} değişiklik.', { t: tarihSaatMetni(meta.sonYedek), n: meta.degisiklikSayaci || 0 })
          : t('ayar.yedek_yok', 'Henüz yedek alınmadı.')),
        el('div', { class: 'uyari uyari--bilgi', style: { marginBlock: 'var(--b-3)' } },
          simge('kilit', { boy: 16 }),
          el('span', {}, t('ayar.gizlilik', 'Kayıtlar yalnız bu cihazda ve bu tarayıcıda durur. Tarayıcı verisi temizlenirse hepsi silinir — düzenli yedek al ve dosyayı güvenli bir yerde sakla. Yedek dosyası hasta bilgisi içerir.'))),
        el('div', { class: 'satir' },
          btnS('indir', t('yedek.indir', 'Yedek indir'), { class: 'btn btn--birincil', onclick: async () => {
            indir(await yedekOlustur(depo));
            basari(t('yedek.indirildi', 'Yedek indirildi'));
            ctx.yenileBantlar?.();
            ciz();
          } }),
          el('label', { class: 'btn' }, simge('yukle', { boy: 18 }), t('yedek.geri_yukle', 'Yedekten geri yükle'), dosyaGirdisi))));

      /* --- Veriler --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('ayar.veriler', 'Veriler'))),
        el('div', { class: 'izgara' }, ...Object.entries(sayilar).map(([ad, n]) =>
          el('div', {}, el('div', { class: 'alan__etiket' }, t(KOL_ANAHTARI[ad] || ad, KOL_ADI[ad] || ad)), el('div', { class: 'sayi-yazi' }, sayiMetni(n))))),
        el('div', { class: 'satir', style: { marginBlockStart: 'var(--b-4)' } },
          meta.ornekYuklendi
            ? btnS('cop', t('ayar.ornek_sil', 'Örnek verileri sil'), { class: 'btn', onclick: async () => {
              if (await onayla(t('ayar.ornek_sil_onay', 'Örnek ilaç ve hastalar silinsin mi? Kendi eklediğin kayıtlara dokunulmaz.'), { evet: t('genel.sil', 'Sil') })) {
                const n = await depo.ornekSil();
                // Antet ayarlar koleksiyonunda; ornekSil oraya bakmıyor.
                // Temizlenmezse kâğıtta «نمونه» adı basılmaya devam ediyor.
                await ornekAntetiSil(depo);
                basari(t('ayar.ornek_silindi', '{n} örnek kayıt silindi', { n }));
                ciz();
              }
            } })
            : btnS('yukle', t('ayar.ornek_yukle', 'Örnek verileri yükle'), { class: 'btn', onclick: async () => {
              const r = await ornekYukle(depo);
              basari(t('ayar.ornek_yuklendi', '{a} ilaç, {b} hasta eklendi', { a: r.ilac, b: r.hasta }));
              ciz();
            } }),
          el('span', { class: 'kart__alt' }, t('ayar.ornek_alt', 'Örnek kayıtlar "örnek" rozetiyle görünür.')))));

      /* --- Hazır ilaç listesi --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, t('ayar.hazir_liste', 'Hazır ilaç listesi')),
          meta.hazirListeSurumu ? rozet(t('ayar.hazir_yuklendi', 'yüklendi'), 'yesil') : null),
        el('p', { class: 'kart__alt' }, t('ayar.hazir_alt', 'Yaygın kullanılan jenerik ilaçların adı, şekli ve dozu. Her ilacı sıfırdan yazmamak için.')),
        el('div', { class: 'uyari uyari--bilgi', style: { marginBlock: 'var(--b-3)' } },
          simge('bilgi', { boy: 16 }),
          el('span', {}, t('ayar.hazir_uyari', 'Bu bir ad listesidir, tedavi önerisi değil. Kullanım şekli, doz ve süre kararı hekimindir; kutunun üstündeki bilgiyle karşılaştırın.'))),
        el('div', { class: 'satir' },
          btnS('yukle', t('ayar.hazir_yukle', 'Listeyi yükle'), { class: 'btn', onclick: async () => {
            try {
              const r = await hazirListeyiYukle(depo);
              if (r.eklendi) basari(t('ayar.hazir_eklendi', '{n} ilaç eklendi', { n: r.eklendi }));
              else uyar(t('ayar.hazir_zaten', 'Listedeki ilaçların hepsi zaten kayıtlı'));
              ciz();
            } catch (e) { hata(hataMetni(e, t('ayar.hazir_hata', 'İlaç listesi yüklenemedi'))); }
          } }),
          el('span', { class: 'kart__alt' }, t('ayar.hazir_silme', 'Yüklenen ilaçlar tek tek silinebilir; kendi eklediklerine dokunulmaz.')))));

      /* --- Depolama --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('ayar.depolama', 'Depolama')),
          depo.kalici ? rozet(t('ayar.kalici', 'kalıcı'), 'yesil') : rozet(t('ayar.gecici', 'geçici'), 'kirmizi')),
        el('div', { class: 'izgara' },
          el('div', {}, el('div', { class: 'alan__etiket' }, t('ayar.depo', 'Depo')), el('div', {}, depo.mod === 'idb' ? t('ayar.depo_idb', 'IndexedDB (bu cihaz)') : t('ayar.depo_bellek', 'Bellek (geçici)'))),
          el('div', {}, el('div', { class: 'alan__etiket' }, t('ayar.kullanilan', 'Kullanılan')), el('div', {}, kapasite ? boyutMetni(kapasite.kullanilan) : '—')),
          el('div', {}, el('div', { class: 'alan__etiket' }, t('ayar.ayrilan', 'Ayrılan')), el('div', {}, kapasite ? boyutMetni(kapasite.toplam) : '—'))),
        !depo.kalici
          ? el('div', { class: 'uyari uyari--hata', style: { marginBlockStart: 'var(--b-3)' } }, simge('uyari', { boy: 16 }),
            el('span', {}, t('ayar.kalici_degil', 'Tarayıcı kalıcı depolama vermedi: kayıtlar silinebilir. Uygulamayı ana ekrana ekle ve özel pencerede kullanma.')))
          : null));

      /* --- Görünüm --- */
      const temaSecimi = secim([['aydinlik', t('ayar.tema_aydinlik', 'Aydınlık')], ['karanlik', t('ayar.tema_karanlik', 'Karanlık')]], {
        value: document.documentElement.dataset.tema || 'aydinlik',
        onchange: (e) => {
          document.documentElement.dataset.tema = e.target.value;
          try { localStorage.setItem('ecz-tema', e.target.value); } catch { uyar(t('ayar.tema_kaydedilemedi', 'Tema seçimi kaydedilemedi.')); }
        },
      });
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('ayar.gorunum', 'Görünüm'))),
        el('div', { class: 'izgara izgara--form' }, alan(t('ayar.tema', 'Tema'), temaSecimi))));

      /* --- Reçete şablonları --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' },
          el('h2', {}, t('sablon.baslik', 'Reçete şablonları')),
          el('span', { class: 'kart__alt' }, t('sablon.baslik_alt', 'Tekrar yazdığın ilaç kümelerini bir kez kaydet.'))),
        sablonListesi(ctx, sablonlar, ciz)));

      /* --- Tehlikeli bölge --- */
      kok.appendChild(kart({ style: { borderColor: 'rgb(var(--kirmizi) / .4)' } },
        el('div', { class: 'kart__bas' }, el('h2', { style: { color: 'rgb(var(--kirmizi))' } }, t('ayar.tehlike', 'Tehlikeli bölge'))),
        el('p', { class: 'kart__alt' }, t('ayar.tehlike_alt', 'Bütün ilaçlar, hastalar ve reçeteler bu cihazdan silinir. Geri alınamaz — önce yedek al.')),
        btnS('cop', t('ayar.hepsini_sil', 'Tüm verileri sil'), { class: 'btn btn--tehlike', style: { marginBlockStart: 'var(--b-3)' }, onclick: async () => {
          const onayKelimesi = t('ayar.sil_kelimesi', 'SİL');
          const kutu = girdi({ placeholder: onayKelimesi, autocomplete: 'off' });
          const onay = await modal({
            baslik: t('ayar.hepsini_sil', 'Tüm verileri sil'),
            govde: el('div', {}, el('p', {}, t('ayar.sil_onay', 'Bu işlem geri alınamaz. Onaylamak için kutuya {k} yaz.', { k: onayKelimesi })), kutu),
            dugmeler: [
              { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
              { metin: t('genel.sil', 'Sil'), sinif: 'btn--tehlike', cb: () => {
                if (kutu.value.trim().toLocaleUpperCase('tr') !== onayKelimesi.toLocaleUpperCase('tr')) {
                  kutu.classList.add('input--hata'); kutu.focus(); return false;
                }
                return true;
              } },
            ],
          });
          if (!onay) return;
          try {
            for (const ad of Object.keys(KOLEKSIYONLAR)) if (ad !== 'meta') await depo.kaliciSil(ad);
            await depo.metaKaydet({ ornekYuklendi: 0, degisiklikSayaci: 0, sonYedek: '' });
            basari(t('ayar.hepsi_silindi', 'Bütün veriler silindi'));
            ctx.yenileMenu?.();
            ciz();
          } catch (e) { hata(hataMetni(e, t('genel.silinemedi', 'Silinemedi'))); }
        } })));

      /* --- Hakkında --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, t('ayar.hakkinda', 'Hakkında'))),
        el('p', { class: 'kart__alt' }, `${t('uygulama.tam_ad', 'Shafa — Reçete')} · ${t('ayar.surum', 'sürüm')} ${ctx.uygulamaSurumu}`),
        el('p', { class: 'kart__alt' }, t('ayar.hakkinda_alt', 'Çerçevesiz, derleme adımsız bir PWA. İnternet olmadan da tam çalışır; hiçbir veri sunucuya gönderilmez.'))));
    }

    await ciz();
    return depo.dinle('*', () => {});
  },
};
