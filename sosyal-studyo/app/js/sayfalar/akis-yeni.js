// Yeni akış: şablondan / boş. Tetikleyici + hesap seçip taslak oluşturur, düzenleyiciye gider.
import { el, btn, kart, temizle, girdi, secim, alan, sayfaBas } from '../cekirdek/dom.js';
import { SABLONLAR } from '../paylasilan/akis/sablonlar.js';
import { TETIKLEYICI_BILGI, TETIKLEYICI_TIPLERI } from '../paylasilan/akis/tetikleyici.js';

export default {
  baslik: 'Yeni akış',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    const hesaplar = await depo.listele('hesaplar');
    const secili = { sablon: SABLONLAR[0] };
    const ad = girdi({ value: SABLONLAR[0].ad, required: true });
    const hesap = secim([['', t('akis.tum', 'Tüm kanallar')], ...hesaplar.map((h) => [h.id, `${h.ad} (${h.kanal})`])]);
    const tetikTip = secim(TETIKLEYICI_TIPLERI.map((k) => [k, TETIKLEYICI_BILGI[k].ad]), { value: SABLONLAR[0].tetik.tip });
    const kelimeler = girdi({ value: SABLONLAR[0].tetik.anahtar_kelimeler?.join(', ') || '', placeholder: 'fiyat, ücret, price' });
    const eslesme = secim([['contains', t('tetik.icerir', 'İçeren')], ['exact', t('tetik.tam', 'Tam eşleşme')], ['any', t('tetik.herhangi', 'Herhangi')]]);
    const sablonKap = el('div', { class: 'izgara izgara--dar' });
    for (const s of SABLONLAR) {
      const k = kart(el('h2', { class: 'kart__baslik' }, s.ad), el('p', { class: 'kart__alt' }, s.aciklama));
      k.classList.add('kart--tik'); if (s === secili.sablon) k.classList.add('kart--vurgu');
      k.onclick = () => { secili.sablon = s; sablonKap.querySelectorAll('.kart').forEach((x) => x.classList.remove('kart--vurgu')); k.classList.add('kart--vurgu'); ad.value = s.ad; tetikTip.value = s.tetik.tip; kelimeler.value = s.tetik.anahtar_kelimeler?.join(', ') || ''; };
      sablonKap.appendChild(k);
    }
    const form = el('form', { onsubmit: async (e) => {
      e.preventDefault();
      const h = hesaplar.find((x) => x.id === hesap.value);
      const akis = await depo.kaydet('akislar', { ad: ad.value.trim(), aciklama: secili.sablon.aciklama, hesap_id: h?.id || null, kanal: h?.kanal || secili.sablon.kanal || null, durum: 'taslak', surum: 1, etiketler: [], adimlar: structuredClone(secili.sablon.adimlar) });
      await depo.kaydet('tetikleyiciler', { akis_id: akis.id, hesap_id: h?.id || null, tip: tetikTip.value, eslesme: eslesme.value, anahtar_kelimeler: kelimeler.value.split(',').map((s) => s.trim()).filter(Boolean), gonderi_idleri: [], yeniden_baslatma_sn: 3600, aktif: 1 });
      ctx.basari(t('akis.olusturuldu', 'Akış taslak olarak oluşturuldu'));
      git(`/akis/${akis.id}`);
    } },
      alan(t('akis.ad', 'Akış adı'), ad),
      alan(t('akis.hesap', 'Hesap'), hesap, { ipucu: t('akis.hesap_ipucu', 'Hesap seçmezsen akış bütün kanallarda geçerli olur.') }),
      alan(t('tetik.tip', 'Tetikleyici'), tetikTip),
      alan(t('tetik.kelimeler', 'Anahtar kelimeler'), kelimeler, { ipucu: t('tetik.kelime_ipucu', 'Virgülle ayır. Türkçe büyük/küçük harf ve aksan fark etmez.') }),
      alan(t('tetik.eslesme', 'Eşleşme'), eslesme),
      el('div', { class: 'satir' }, btn(t('akis.olustur', 'Taslağı oluştur'), { type: 'submit', class: 'btn btn--birincil' }), btn(t('genel.vazgec', 'Vazgeç'), { onclick: () => git('/akislar') })),
    );
    kok.append(sayfaBas(t('akis.yeni_baslik', 'Yeni akış'), { alt: t('akis.yeni_alt', 'Bir şablon seç, tetikleyiciyi ayarla, düzenlemeye başla.'), geri: () => git('/akislar') }), el('h2', {}, t('akis.sablon_sec', '1 · Şablon seç')), sablonKap, el('h2', {}, t('akis.tetik_ayarla', '2 · Tetikleyici ve hesap')), form);
  },
};
