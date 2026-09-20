// Ayarlar: yedek, örnek veri, depolama bilgisi, görünüm ve tehlikeli bölge.
// Veriler yalnız bu cihazda durduğu için yedek en önemli kart; en üstte.
import { el, temizle, btn, btnS, girdi, secim, kart, rozet, sayfaBas } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { yedekOlustur, iceAktar, yedekDogrula, indir, hatirlatmaGerekli } from '../depo/yedek.js';
import { ornekYukle } from '../depo/ornek.js';
import { KOLEKSIYONLAR } from '../depo/sema.js';
import { trTarihSaat } from '../paylasilan/tarih.js';
import { sayiMetni } from '../paylasilan/metin.js';

const KOL_ADLARI = { ilaclar: 'İlaç', hastalar: 'Hasta', receteler: 'Reçete', hareketler: 'Stok hareketi', ayarlar: 'Ayar' };

function boyutMetni(bayt) {
  if (!bayt) return '—';
  const birim = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bayt;
  while (n >= 1024 && i < birim.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${birim[i]}`;
}

/** Yedek dosyasını okur, önce prova yapar, sonra kullanıcıya sorar. */
async function geriYukle(ctx, dosya) {
  const { depo, modal, basari, hata } = ctx;
  let belge;
  try { belge = JSON.parse(await dosya.text()); }
  catch { hata('Dosya okunamadı — geçerli bir JSON değil.'); return false; }

  const dogrulama = yedekDogrula(belge);
  if (!dogrulama.gecerli) { hata(dogrulama.hatalar.join(' ')); return false; }

  const strateji = secim([
    ['birlestir', 'Birleştir — yalnız daha yeni kayıtlar yazılır (önerilen)'],
    ['degistir', 'Değiştir — mevcut kayıtlar silinip yedek yazılır'],
  ], { value: 'birlestir' });

  const sayilar = Object.entries(belge.koleksiyonlar || {})
    .filter(([ad]) => ad !== 'ayarlar' && ad !== 'meta')
    .map(([ad, l]) => `${sayiMetni(l.length)} ${(KOL_ADLARI[ad] || ad).toLocaleLowerCase('tr')}`);

  const onay = await modal({
    baslik: 'Yedekten geri yükle',
    govde: el('div', {},
      el('p', {}, `Dosya tarihi: ${trTarihSaat(belge.olusturuldu)}`),
      el('p', {}, 'İçindekiler: ' + (sayilar.join(', ') || 'boş')),
      el('div', { class: 'alan' }, el('span', { class: 'alan__etiket' }, 'Nasıl yüklensin?'), strateji),
      el('div', { class: 'uyari uyari--bilgi' }, simge('bilgi', { boy: 16 }), el('span', {}, 'Birleştirmede hiçbir kayıt kaybolmaz; değiştirmede bu cihazdaki kayıtlar silinir.'))),
    dugmeler: [{ metin: 'Vazgeç', deger: null }, { metin: 'Yükle', sinif: 'btn--birincil', deger: true }],
  });
  if (!onay) return false;

  const sonuc = await iceAktar(depo, belge, { strateji: strateji.value });
  if (!sonuc.ok) { hata(sonuc.hatalar.join(' ')); return false; }
  const eklenen = Object.values(sonuc.rapor).reduce((t, r) => t + r.eklendi + r.guncellendi, 0);
  basari(`${eklenen} kayıt yüklendi`);
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
      const h = hatirlatmaGerekli(meta);
      const kapasite = depo.kapasite ? await depo.kapasite() : null;
      const sayilar = {};
      for (const ad of Object.keys(KOLEKSIYONLAR)) {
        if (ad === 'meta' || ad === 'ayarlar') continue;
        sayilar[ad] = await depo.say(ad);
      }
      if (benim !== sira) return;

      temizle(kok);
      kok.append(sayfaBas('Ayarlar', { alt: 'Yedek, örnek veri ve uygulama bilgileri.' }));

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
          el('h2', {}, 'Yedek'),
          h.gerekli ? rozet('yedek gerekli', 'sari') : rozet('güncel', 'yesil')),
        el('p', { class: 'kart__alt' },
          meta.sonYedek ? `Son yedek: ${trTarihSaat(meta.sonYedek)} · o günden beri ${meta.degisiklikSayaci || 0} değişiklik.` : 'Henüz yedek alınmadı.'),
        el('div', { class: 'uyari uyari--bilgi', style: { marginBlock: 'var(--b-3)' } },
          simge('kilit', { boy: 16 }),
          el('span', {}, 'Kayıtlar yalnız bu cihazda ve bu tarayıcıda durur. Tarayıcı verisi temizlenirse hepsi silinir — düzenli yedek al ve dosyayı güvenli bir yerde sakla. Yedek dosyası hasta bilgisi içerir.')),
        el('div', { class: 'satir' },
          btnS('indir', 'Yedek indir', { class: 'btn btn--birincil', onclick: async () => { indir(await yedekOlustur(depo)); basari('Yedek indirildi'); ctx.yenileBantlar?.(); ciz(); } }),
          el('label', { class: 'btn' }, simge('yukle', { boy: 18 }), 'Yedekten geri yükle', dosyaGirdisi))));

      /* --- Veriler --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, 'Veriler')),
        el('div', { class: 'izgara' }, ...Object.entries(sayilar).map(([ad, n]) =>
          el('div', {}, el('div', { class: 'alan__etiket' }, KOL_ADLARI[ad] || ad), el('div', { class: 'sayi-yazi' }, sayiMetni(n))))),
        el('div', { class: 'satir', style: { marginBlockStart: 'var(--b-4)' } },
          meta.ornekYuklendi
            ? btnS('cop', 'Örnek verileri sil', { class: 'btn', onclick: async () => {
              if (await onayla('Örnek ilaç ve hastalar silinsin mi? Kendi eklediğin kayıtlara dokunulmaz.', { evet: 'Sil' })) {
                const n = await depo.ornekSil();
                basari(`${n} örnek kayıt silindi`);
                ciz();
              }
            } })
            : btnS('yukle', 'Örnek verileri yükle', { class: 'btn', onclick: async () => {
              const r = await ornekYukle(depo);
              basari(`${r.ilac} ilaç, ${r.hasta} hasta eklendi`);
              ciz();
            } }),
          el('span', { class: 'kart__alt' }, 'Örnek kayıtlar "örnek" rozetiyle görünür.'))));

      /* --- Depolama --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, 'Depolama'),
          depo.kalici ? rozet('kalıcı', 'yesil') : rozet('geçici', 'kirmizi')),
        el('div', { class: 'izgara' },
          el('div', {}, el('div', { class: 'alan__etiket' }, 'Depo'), el('div', {}, depo.mod === 'idb' ? 'IndexedDB (bu cihaz)' : 'Bellek (geçici)')),
          el('div', {}, el('div', { class: 'alan__etiket' }, 'Kullanılan'), el('div', {}, kapasite ? boyutMetni(kapasite.kullanilan) : '—')),
          el('div', {}, el('div', { class: 'alan__etiket' }, 'Ayrılan'), el('div', {}, kapasite ? boyutMetni(kapasite.toplam) : '—'))),
        !depo.kalici
          ? el('div', { class: 'uyari uyari--hata', style: { marginBlockStart: 'var(--b-3)' } }, simge('uyari', { boy: 16 }),
            el('span', {}, 'Tarayıcı kalıcı depolama vermedi: kayıtlar silinebilir. Uygulamayı ana ekrana ekle ve özel pencerede kullanma.'))
          : null));

      /* --- Görünüm --- */
      const temaSecimi = secim([['aydinlik', 'Aydınlık'], ['karanlik', 'Karanlık']], {
        value: document.documentElement.dataset.tema || 'aydinlik',
        onchange: (e) => {
          document.documentElement.dataset.tema = e.target.value;
          try { localStorage.setItem('ecz-tema', e.target.value); } catch { uyar('Tema seçimi kaydedilemedi.'); }
        },
      });
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, 'Görünüm')),
        el('label', { class: 'alan', style: { maxInlineSize: '260px' } }, el('span', { class: 'alan__etiket' }, 'Tema'), temaSecimi)));

      /* --- Tehlikeli bölge --- */
      kok.appendChild(kart({ style: { borderColor: 'rgb(var(--kirmizi) / .4)' } },
        el('div', { class: 'kart__bas' }, el('h2', { style: { color: 'rgb(var(--kirmizi))' } }, 'Tehlikeli bölge')),
        el('p', { class: 'kart__alt' }, 'Bütün ilaçlar, hastalar, reçeteler ve hareketler bu cihazdan silinir. Geri alınamaz — önce yedek al.'),
        btnS('cop', 'Tüm verileri sil', { class: 'btn btn--tehlike', style: { marginBlockStart: 'var(--b-3)' }, onclick: async () => {
          const kutu = girdi({ placeholder: 'SİL', autocomplete: 'off' });
          const onay = await modal({
            baslik: 'Tüm verileri sil',
            govde: el('div', {},
              el('p', {}, 'Bu işlem geri alınamaz. Onaylamak için kutuya SİL yaz.'),
              kutu),
            dugmeler: [
              { metin: 'Vazgeç', deger: null },
              { metin: 'Sil', sinif: 'btn--tehlike', cb: () => {
                if (kutu.value.trim().toLocaleUpperCase('tr') !== 'SİL') { kutu.classList.add('input--hata'); kutu.focus(); return false; }
                return true;
              } },
            ],
          });
          if (!onay) return;
          try {
            for (const ad of Object.keys(KOLEKSIYONLAR)) if (ad !== 'meta') await depo.kaliciSil(ad);
            await depo.metaKaydet({ ornekYuklendi: 0, degisiklikSayaci: 0, sonYedek: '' });
            basari('Bütün veriler silindi');
            ctx.yenileMenu?.();
            ciz();
          } catch (e) { hata(e.message || 'Silinemedi'); }
        } })));

      /* --- Hakkında --- */
      kok.appendChild(kart({},
        el('div', { class: 'kart__bas' }, el('h2', {}, 'Hakkında')),
        el('p', { class: 'kart__alt' }, `Eczane Yönetim · sürüm ${ctx.uygulamaSurumu}`),
        el('p', { class: 'kart__alt' }, 'Çerçevesiz, derleme adımsız bir PWA. İnternet olmadan da tam çalışır; hiçbir veri sunucuya gönderilmez.')));
    }

    await ciz();
    return depo.dinle('*', () => {});
  },
};
