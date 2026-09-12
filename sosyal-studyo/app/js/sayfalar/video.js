// Video Analizi: transkript yapıştır (her zaman) ya da telefondan video seç (ses + kareler → Worker).
// Başkasının videosu URL ile indirilmez (ToS). Yerel modda elle notlarla çalışır.
import { el, btn, kart, rozet, temizle, girdi, alan, metinAlani, goreliZaman } from '../cekirdek/dom.js';
import { aiIstemci } from '../ai-istemci.js';

export default {
  baslik: 'Video Analizi',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    const ai = aiIstemci(depo, t); const mevcut = await ai.mevcut();
    if (ctx.param.id) {
      const v = await depo.al('video_analizleri', ctx.param.id);
      if (!v) { kok.appendChild(el('p', { class: 'durum-hata' }, 'Analiz yok')); return; }
      const s = v.sonuc || {};
      kok.append(el('div', { class: 'satir' }, btn('←', { class: 'btn btn--ikon btn--sade', onclick: () => git('/video') }), el('h1', { style: { margin: 0 } }, v.baslik || t('video.analiz', 'Analiz'))),
        kart(el('h2', { class: 'kart__baslik' }, '🪝 ' + t('video.kanca', 'Kanca (ilk 3 sn)')), el('p', {}, s.kanca || '—')),
        kart(el('h2', { class: 'kart__baslik' }, t('video.yapi', 'Yapı')), ...(s.yapi || []).map((y) => el('div', { class: 'kart__alt' }, `${y.sn}s · ${y.bolum}: ${y.not || ''}`))),
        kart(el('h2', { class: 'kart__baslik' }, 'CTA'), el('p', {}, s.cta || '—'), el('p', { class: 'kart__alt' }, `${t('video.tempo', 'Tempo')}: ${s.tempo || '—'} · ${t('video.puan', 'kaydırma durdurma tahmini')}: ${s.puan ?? '—'}/10`)),
        kart(el('h2', { class: 'kart__baslik' }, t('video.alternatif', 'Alternatif kancalar')), ...(s.alternatifKancalar || []).map((k) => el('div', { class: 'satir satir--arasi' }, el('span', {}, k), btn('🪝', { class: 'btn btn--kucuk btn--ikon', onclick: async () => { await depo.kaydet('kancalar', { metin: k, dil: 'tr', format: 'reels', nis: [], kaynak: 'video' }); ctx.basari(t('genel.eklendi', 'Eklendi')); } })))),
        kart(el('h2', { class: 'kart__baslik' }, t('video.iyilestirme', 'İyileştirmeler')), ...(s.iyilestirmeler || []).map((i) => el('div', { class: 'kart__alt' }, '• ' + i))),
        el('details', { class: 'katlanir' }, el('summary', {}, t('video.transkript', 'Transkript')), el('div', { class: 'kod' }, v.transkript || '—')));
      return;
    }
    const baslik = girdi({ placeholder: t('video.baslik', 'Video başlığı / notu') });
    const transkript = metinAlani({ rows: 8, placeholder: t('video.transkript_yapistir', 'Transkript ya da altyazıyı yapıştır…') });
    const dosya = el('input', { type: 'file', accept: 'video/*', hidden: true });
    const dosyaBtn = el('label', { class: 'btn' }, '📱 ' + t('video.sec', 'Telefondan video seç'), dosya);
    const dosyaNot = el('span', { class: 'kart__alt' });
    dosya.onchange = () => { const f = dosya.files[0]; dosyaNot.textContent = f ? `${f.name} · ${(f.size / 1048576).toFixed(1)} MB` + (mevcut ? '' : ' · ' + t('video.worker_gerek', 'transkript için Worker gerekir')) : ''; };
    const liste = el('div', { class: 'izgara' });
    async function ciz() { temizle(liste); for (const v of await depo.listele('video_analizleri', { sirala: 'guncellendi', azalan: true })) liste.appendChild(kart(el('h2', { class: 'kart__baslik' }, v.baslik || '—'), el('p', { class: 'kart__alt' }, (v.sonuc?.kanca || v.transkript || '').slice(0, 120)), el('div', { class: 'satir' }, rozet(v.elle ? t('video.elle', 'elle') : 'AI', v.elle ? 'gri' : 'altin'), el('span', { class: 'kart__alt' }, goreliZaman(v.guncellendi, t))), el('div', { class: 'satir' }, btn(t('akis.ac', 'Aç'), { class: 'btn btn--kucuk btn--birincil', onclick: () => git(`/video/${v.id}`) }), btn('✕', { class: 'btn btn--kucuk btn--ikon', onclick: async () => { await depo.sil('video_analizleri', v.id); ciz(); } })))); }
    async function analizEt(elle) {
      const metin = transkript.value.trim(); if (!metin && !dosya.files[0]) { ctx.hata(t('video.girdi_yok', 'Transkript yapıştır ya da video seç.')); return; }
      let sonuc, kullanilanTranskript = metin;
      if (elle) {
        const cumleler = metin.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
        sonuc = { kanca: cumleler[0] || '', yapi: [{ sn: 0, bolum: 'Kanca', not: cumleler[0] || '' }, { sn: 3, bolum: 'Gövde', not: `${cumleler.length} cümle` }, { sn: Math.round(metin.split(/\s+/).length / 2.5), bolum: 'CTA', not: cumleler.at(-1) || '' }], cta: cumleler.at(-1) || '', tempo: `${Math.round(metin.split(/\s+/).length / Math.max(1, metin.split(/\s+/).length / 150))} kelime/dk (tahmin)`, puan: null, alternatifKancalar: [], iyilestirmeler: [t('video.elle_not', 'AI analizi için Worker\'ı bağla; bu sonuç yalnız basit sezgisel bölümlemedir.')] };
      } else {
        try {
          if (dosya.files[0] && !metin) { const f = dosya.files[0]; if (f.size > 25 * 1048576) throw new Error(t('video.buyuk', 'Video 25 MB\'tan büyük; kısalt ya da transkript yapıştır.')); const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(f); }); const tr = await ai.iste('transkript', { dosya: b64, mime: f.type, ad: f.name }); kullanilanTranskript = tr.transkript || ''; }
          sonuc = await ai.iste('video_analiz', { transkript: kullanilanTranskript, baslik: baslik.value });
        } catch (e) { ctx.hata(e.message); return; }
      }
      const v = await depo.kaydet('video_analizleri', { baslik: baslik.value.trim() || (kullanilanTranskript.slice(0, 40) || dosya.files[0]?.name), kaynak: { tip: dosya.files[0] ? 'dosya' : 'metin', dosyaAdi: dosya.files[0]?.name }, transkript: kullanilanTranskript.slice(0, 65536), sonuc, elle: elle ? 1 : 0 });
      await depo.kaydet('galeri', { tur: 'video_analiz', baslik: v.baslik, kaynak: { kol: 'video_analizleri', id: v.id }, onizleme: sonuc.kanca });
      git(`/video/${v.id}`);
    }
    kok.append(el('h1', {}, t('nav.video', 'Video Analizi')), el('p', { class: 'kart__alt' }, t('video.aciklama', 'Bir videonun kancasını, yapısını ve CTA\'sını çıkarır; alternatif kancalar önerir. Başkasının videosu URL ile indirilmez — kendi videonu seç ya da transkript yapıştır.')),
      kart(alan(t('video.baslik_etiket', 'Başlık'), baslik), alan(t('video.transkript', 'Transkript'), transkript), el('div', { class: 'satir' }, dosyaBtn, dosyaNot), el('div', { class: 'satir' }, btn('✨ ' + t('video.ai', 'AI ile analiz et'), { class: 'btn btn--birincil', disabled: !mevcut, onclick: () => analizEt(false) }), btn('✍️ ' + t('video.elle_analiz', 'Elle bölümle'), { onclick: () => analizEt(true) }), !mevcut ? el('span', { class: 'kart__alt' }, t('ai.yerel_kisa', 'AI üretimi için Worker gerekir; elle yazmak her zaman açık.')) : null)),
      el('h2', {}, t('video.gecmis', 'Analizler')), liste);
    ciz();
  },
};
