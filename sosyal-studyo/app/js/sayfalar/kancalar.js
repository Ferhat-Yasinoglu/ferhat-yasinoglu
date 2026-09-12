// Kanca Kütüphanesi: arama (Türkçe normalize), filtre, favori, kullanım sayacı, hazır paket, AI öneri.
import { el, btn, kart, rozet, temizle, girdi, secim } from '../cekirdek/dom.js';
import { normalize } from '../paylasilan/metin.js';
import { aiIstemci } from '../ai-istemci.js';

export default {
  baslik: 'Kanca Kütüphanesi',
  async cizim(kok, ctx) {
    const { depo, t, sor } = ctx;
    temizle(kok);
    const ai = aiIstemci(depo, t); const mevcut = await ai.mevcut();
    const arama = girdi({ type: 'search', placeholder: t('kanca.ara', 'Ara… (İNDİRİM ≈ indirim)') });
    const dil = secim([['', t('kanca.tum_diller', 'Tüm diller')], ['tr', 'TR'], ['de', 'DE'], ['en', 'EN'], ['fa', 'FA']]);
    const format = secim([['', t('kanca.tum_format', 'Tüm formatlar')], ['reels', 'Reels'], ['karusel', 'Karusel'], ['story', 'Story'], ['gonderi', 'Gönderi']]);
    const liste = el('div', { class: 'izgara' });
    async function ciz() {
      temizle(liste);
      let kancalar = await depo.listele('kancalar', { sirala: 'guncellendi', azalan: true });
      const q = normalize(arama.value);
      kancalar = kancalar.filter((k) => (!q || normalize(k.metin).includes(q)) && (!dil.value || k.dil === dil.value) && (!format.value || k.format === format.value)).sort((a, b) => (b.favori ? 1 : 0) - (a.favori ? 1 : 0));
      if (!kancalar.length) liste.appendChild(el('p', { class: 'kart__alt' }, t('kanca.bos', 'Kanca yok. Hazır 30 kancayı yükle ya da kendi kancanı yaz.')));
      for (const k of kancalar) liste.appendChild(kart(el('p', { style: { fontWeight: '600', fontSize: '1.05rem', margin: 0 } }, k.metin), el('div', { class: 'satir' }, rozet(k.dil || 'tr', 'gri'), rozet(k.format || '—', 'mor'), ...(k.nis || []).map((n) => rozet(n, 'mavi')), el('span', { class: 'kart__alt' }, `${k.kullanim || 0}× · ${k.kaynak || 'elle'}`)), el('div', { class: 'satir' }, btn('⧉', { class: 'btn btn--kucuk btn--ikon', title: t('genel.kopyala', 'Kopyala'), onclick: async () => { await navigator.clipboard?.writeText(k.metin); await depo.kaydet('kancalar', { ...k, kullanim: (k.kullanim || 0) + 1 }); ctx.basari(t('genel.kopyalandi', 'Kopyalandı')); } }), btn(k.favori ? '★' : '☆', { class: 'btn btn--kucuk btn--ikon', onclick: async () => { await depo.kaydet('kancalar', { ...k, favori: !k.favori }); ciz(); } }), btn('🎠', { class: 'btn btn--kucuk btn--ikon', title: t('kanca.karusele', 'Karusele ekle'), onclick: () => { sessionStorage.setItem('ss-kanca', k.metin); ctx.git('/karusel'); } }), btn('✕', { class: 'btn btn--kucuk btn--ikon', onclick: async () => { await depo.sil('kancalar', k.id); ciz(); } }))));
    }
    arama.oninput = ciz; dil.onchange = ciz; format.onchange = ciz;
    kok.append(el('h1', {}, t('nav.kancalar', 'Kanca Kütüphanesi')), el('div', { class: 'satir' }, arama, dil, format),
      el('div', { class: 'satir', style: { margin: '8px 0' } },
        btn('+ ' + t('kanca.yaz', 'Kanca yaz'), { class: 'btn btn--birincil btn--kucuk', onclick: async () => { const m = await sor(t('kanca.yaz', 'Kanca yaz'), { cokSatir: true }); if (!m) return; const var_ = (await depo.listele('kancalar')).find((k) => normalize(k.metin) === normalize(m)); if (var_) { ctx.bildir(t('kanca.zaten', 'Bu kanca zaten var; favoriye eklendi.')); await depo.kaydet('kancalar', { ...var_, favori: true }); } else await depo.kaydet('kancalar', { metin: m, dil: 'tr', format: 'reels', nis: [], kaynak: 'elle' }); ciz(); } }),
        btn('📦 ' + t('kanca.hazir', 'Hazır 30 kancayı yükle'), { class: 'btn btn--kucuk', onclick: async () => { const r = await fetch('./data/kancalar-hazir.json'); const liste = await r.json(); const mevcutlar = new Set((await depo.listele('kancalar')).map((k) => normalize(k.metin))); let n = 0; for (const k of liste) if (!mevcutlar.has(normalize(k.metin))) { await depo.kaydet('kancalar', { ...k, kaynak: 'tohum' }); n++; } ctx.basari(t('kanca.yuklendi', '{n} kanca eklendi', { n })); ciz(); } }),
        btn('✨ ' + t('kanca.ai', 'AI ile 10 kanca öner'), { class: 'btn btn--kucuk', disabled: !mevcut, onclick: async () => { const konu = await sor(t('kanca.konu', 'Konu / niş')); if (!konu) return; try { const r = await ai.iste('kanca_oner', { konu, dil: 'tr' }); for (const m of r.kancalar || []) await depo.kaydet('kancalar', { metin: m, dil: 'tr', format: 'reels', nis: [konu], kaynak: 'ai' }); ciz(); } catch (e) { ctx.hata(e.message); } } }),
        btn('⬇ JSON', { class: 'btn btn--kucuk', onclick: async () => { const b = new Blob([JSON.stringify(await depo.listele('kancalar'), null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = 'kancalar.json'; l.click(); } })),
      liste);
    ciz();
  },
};
