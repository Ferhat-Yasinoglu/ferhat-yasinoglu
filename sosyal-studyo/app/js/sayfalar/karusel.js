// Karusel: 5–10 slayt, üç tema, canlı önizleme, PNG dışa aktarım (canvas), Galeri'ye kayıt.
import { el, btn, kart, rozet, temizle, girdi, secim, alan, metinAlani } from '../cekirdek/dom.js';
import { aiIstemci } from '../ai-istemci.js';

const TEMALAR = { koyu: { bg: '#111014', fg: '#f4f1eb', vurgu: '#f6d678' }, acik: { bg: '#f8f6f1', fg: '#1a1814', vurgu: '#a68014' }, altin: { bg: '#1a1408', fg: '#f6d678', vurgu: '#ffffff' } };

function slaytCanvas(slayt, stil, toplam) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d');
  const tema = TEMALAR[stil.tema] || TEMALAR.koyu;
  g.fillStyle = tema.bg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = tema.vurgu; g.fillRect(0, 0, 18, c.height);
  g.textAlign = stil.yon === 'rtl' ? 'end' : 'start'; g.direction = stil.yon === 'rtl' ? 'rtl' : 'ltr';
  const x = stil.yon === 'rtl' ? 990 : 90;
  const sar = (metin, boyut, y, maxW = 900, satirY = boyut * 1.25) => { g.font = `${boyut === 80 ? 'bold ' : ''}${boyut}px sans-serif`; const kelimeler = String(metin).split(' '); let satir = ''; for (const k of kelimeler) { const dene = satir ? satir + ' ' + k : k; if (g.measureText(dene).width > maxW && satir) { g.fillText(satir, x, y); y += satirY; satir = k; } else satir = dene; } if (satir) g.fillText(satir, x, y); return y + satirY; };
  g.fillStyle = tema.vurgu; let y = sar(slayt.baslik || '', 80, 320);
  g.fillStyle = tema.fg; sar(slayt.metin || '', 44, y + 40);
  g.fillStyle = tema.fg; g.globalAlpha = .6; g.font = '30px sans-serif'; g.fillText(`${slayt.no}/${toplam}`, x, 1280); g.globalAlpha = 1;
  return c;
}

export default {
  baslik: 'Karusel',
  async cizim(kok, ctx) {
    const { depo, t, git, onayla } = ctx;
    temizle(kok);
    if (ctx.param.id) return duzenle(kok, ctx, ctx.param.id);
    const liste = el('div', { class: 'izgara' });
    async function ciz() {
      temizle(liste);
      for (const k of await depo.listele('karuseller', { sirala: 'guncellendi', azalan: true })) liste.appendChild(kart(el('div', { class: `slayt slayt--${k.stil?.tema || 'koyu'}`, style: { aspectRatio: '4/5', maxHeight: '200px' } }, el('p', { class: 'slayt__baslik' }, k.slaytlar?.[0]?.baslik || k.baslik)), el('h2', { class: 'kart__baslik' }, k.baslik), el('div', { class: 'kart__alt' }, `${k.slaytlar?.length || 0} slayt · ${k.stil?.tema || 'koyu'}`), el('div', { class: 'satir' }, btn(t('akis.ac', 'Aç'), { class: 'btn btn--kucuk btn--birincil', onclick: () => git(`/karusel/${k.id}`) }), btn('✕', { class: 'btn btn--kucuk btn--ikon', onclick: async () => { await depo.sil('karuseller', k.id); ciz(); } }))));
    }
    const kanca = sessionStorage.getItem('ss-kanca'); sessionStorage.removeItem('ss-kanca');
    kok.append(el('h1', {}, t('nav.karusel', 'Karusel')), el('div', { class: 'satir', style: { marginBottom: '12px' } }, btn('+ ' + t('karusel.yeni', 'Yeni karusel'), { class: 'btn btn--birincil', onclick: async () => { const k = await depo.kaydet('karuseller', { baslik: kanca ? kanca.slice(0, 40) : t('karusel.yeni', 'Yeni karusel'), stil: { tema: 'koyu', dil: 'tr', yon: document.documentElement.dir }, durum: 'taslak', slaytlar: [{ no: 1, baslik: kanca || t('karusel.kapak', 'Kapak: kanca'), metin: '' }, { no: 2, baslik: t('karusel.kurulum', 'Kurulum'), metin: '' }, { no: 3, baslik: t('karusel.deger', 'Değer'), metin: '' }, { no: 4, baslik: t('karusel.ozet', 'Özet'), metin: '' }, { no: 5, baslik: 'CTA', metin: '' }] }); git(`/karusel/${k.id}`); } })), liste);
    ciz();
  },
};

async function duzenle(kok, ctx, id) {
  const { depo, t, git } = ctx;
  const ai = aiIstemci(depo, t); const mevcut = await ai.mevcut();
  let k = await depo.al('karuseller', id);
  if (!k) { kok.appendChild(el('p', { class: 'durum-hata' }, 'Karusel yok')); return; }
  const baslik = girdi({ value: k.baslik, style: { fontSize: '1.2rem', fontWeight: '700' } });
  const tema = secim(Object.keys(TEMALAR).map((x) => [x, x]), { value: k.stil?.tema || 'koyu' });
  const yon = secim([['ltr', 'LTR'], ['rtl', 'RTL']], { value: k.stil?.yon || 'ltr' });
  const onizleme = el('div', { class: 'izgara izgara--dar' });
  const form = el('div', {});
  const kaydet = async () => { k.baslik = baslik.value; k.stil = { ...k.stil, tema: tema.value, yon: yon.value }; k = await depo.kaydet('karuseller', k); };
  function ciz() {
    temizle(onizleme); temizle(form);
    k.slaytlar.forEach((s, i) => {
      onizleme.appendChild(el('div', { class: `slayt slayt--${tema.value}`, dir: yon.value }, el('p', { class: 'slayt__baslik' }, s.baslik), el('p', { class: 'slayt__metin' }, s.metin), el('span', { class: 'slayt__no' }, `${i + 1}/${k.slaytlar.length}`)));
      form.appendChild(kart(el('div', { class: 'satir satir--arasi' }, el('strong', {}, `${t('karusel.slayt', 'Slayt')} ${i + 1}`), el('span', { class: 'satir' }, btn('↑', { class: 'btn btn--kucuk btn--ikon', disabled: i === 0, onclick: () => { [k.slaytlar[i - 1], k.slaytlar[i]] = [k.slaytlar[i], k.slaytlar[i - 1]]; numarala(); kaydet(); ciz(); } }), btn('✕', { class: 'btn btn--kucuk btn--ikon', disabled: k.slaytlar.length <= 2, onclick: () => { k.slaytlar.splice(i, 1); numarala(); kaydet(); ciz(); } }))), girdi({ value: s.baslik, maxlength: 60, placeholder: t('karusel.baslik', 'Başlık (≤60)'), oninput: (e) => { s.baslik = e.target.value; onizleme.children[i].querySelector('.slayt__baslik').textContent = s.baslik; }, onchange: kaydet }), metinAlani({ value: s.metin, maxlength: 220, rows: 3, placeholder: t('karusel.metin', 'Metin (≤220)'), oninput: (e) => { s.metin = e.target.value; onizleme.children[i].querySelector('.slayt__metin').textContent = s.metin; }, onchange: kaydet })));
    });
  }
  const numarala = () => k.slaytlar.forEach((s, i) => (s.no = i + 1));
  tema.onchange = () => { kaydet(); ciz(); }; yon.onchange = () => { kaydet(); ciz(); }; baslik.onchange = kaydet;
  kok.append(el('div', { class: 'satir' }, btn('←', { class: 'btn btn--ikon btn--sade', onclick: () => git('/karusel') }), el('h1', { style: { margin: 0, flex: 1 } }, baslik)),
    el('div', { class: 'satir', style: { marginBottom: '12px' } }, tema, yon, btn('+ ' + t('karusel.slayt_ekle', 'Slayt'), { class: 'btn btn--kucuk', disabled: k.slaytlar.length >= 10, onclick: () => { k.slaytlar.push({ no: k.slaytlar.length + 1, baslik: '', metin: '' }); kaydet(); ciz(); } }),
      btn('✨ ' + t('karusel.ai', 'AI ile doldur'), { class: 'btn btn--kucuk', disabled: !mevcut, onclick: async () => { try { const r = await ai.iste('karusel_uret', { baslik: k.baslik, slayt: k.slaytlar.length }); if (r.slaytlar?.length) { k.slaytlar = r.slaytlar.map((s, i) => ({ no: i + 1, baslik: String(s.baslik || '').slice(0, 60), metin: String(s.metin || '').slice(0, 220) })); await kaydet(); ciz(); } } catch (e) { ctx.hata(e.message); } } }),
      btn('🖼️ ' + t('karusel.png', 'PNG olarak indir'), { class: 'btn btn--kucuk btn--birincil', onclick: async () => { await document.fonts?.ready; for (const s of k.slaytlar) { const c = slaytCanvas(s, { tema: tema.value, yon: yon.value }, k.slaytlar.length); await new Promise((r) => c.toBlob(async (b) => { const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = `${k.baslik}-${s.no}.png`; l.click(); r(); }, 'image/png')); } await depo.kaydet('galeri', { tur: 'karusel_png', baslik: k.baslik, kaynak: { kol: 'karuseller', id: k.id }, onizleme: k.slaytlar[0]?.baslik || '' }); ctx.basari(t('karusel.indirildi', '{n} slayt indirildi, Galeri\'ye kaydedildi', { n: k.slaytlar.length })); } }),
      btn('📤 ' + t('karusel.paylas', 'Paylaş'), { class: 'btn btn--kucuk', onclick: async () => { const dosyalar = []; for (const s of k.slaytlar) dosyalar.push(await new Promise((r) => slaytCanvas(s, { tema: tema.value, yon: yon.value }, k.slaytlar.length).toBlob((b) => r(new File([b], `${s.no}.png`, { type: 'image/png' })), 'image/png'))); if (navigator.canShare?.({ files: dosyalar })) await navigator.share({ files: dosyalar, title: k.baslik }); else ctx.bildir(t('karusel.paylas_yok', 'Bu cihazda dosya paylaşımı yok; PNG indir.')); } })),
    el('h2', {}, t('karusel.onizleme', 'Önizleme')), onizleme, el('h2', {}, t('karusel.slaytlar', 'Slaytlar')), form);
  ciz();
}
