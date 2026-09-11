// Fikirler & Senaryo: fikir panosu, senaryo yazımı (elle her zaman, AI Worker'la), kancaya köprü.
import { el, btn, kart, rozet, temizle, girdi, secim, alan, metinAlani } from '../cekirdek/dom.js';
import { aiIstemci } from '../ai-istemci.js';

const FORMATLAR = [['reels', 'Reels'], ['story', 'Story'], ['karusel', 'Karusel'], ['dm', 'DM kampanyası']];

export default {
  baslik: 'Fikirler & Senaryo',
  async cizim(kok, ctx) {
    const { depo, t, git, modal, onayla } = ctx;
    temizle(kok);
    const ai = aiIstemci(depo, t);
    const mevcut = await ai.mevcut();
    const nis = girdi({ placeholder: t('fikir.nis', 'Niş: ör. küçük işletmeler için otomasyon') });
    const hedef = girdi({ placeholder: t('fikir.hedef', 'Hedef kitle') });
    const format = secim(FORMATLAR);
    const uretBtn = btn('✨ ' + t('fikir.uret', '10 fikir üret'), { class: 'btn btn--birincil', disabled: !mevcut, title: mevcut ? '' : t('ai.yerel', 'AI için Worker\'ı bağla'), onclick: async () => { try { uretBtn.disabled = true; const r = await ai.iste('fikir_uret', { nis: nis.value, hedef: hedef.value, format: format.value }); for (const f of r.fikirler || []) await depo.kaydet('fikirler', { ...f, format: f.format || format.value, hedef: hedef.value, durum: 'fikir', kaynak: 'ai' }); ctx.basari(t('fikir.uretildi', '{n} fikir eklendi', { n: (r.fikirler || []).length })); ciz(); } catch (e) { ctx.hata(e.message); } finally { uretBtn.disabled = !mevcut; } } });
    const liste = el('div', { class: 'izgara' });
    async function ciz() {
      temizle(liste);
      const fikirler = await depo.listele('fikirler', { sirala: 'guncellendi', azalan: true });
      for (const f of fikirler) liste.appendChild(kart(el('div', { class: 'satir satir--arasi' }, el('h2', { class: 'kart__baslik' }, f.baslik), rozet(f.durum, { fikir: 'gri', senaryo: 'mavi', uretildi: 'altin', yayinlandi: 'yesil' }[f.durum] || 'gri')), el('p', { class: 'kart__alt' }, f.aciklama), el('div', { class: 'satir' }, rozet(f.format || '—', 'mor'), f.demo ? rozet('Demo', 'gri') : null, f.favori ? rozet('★', 'altin') : null), el('div', { class: 'satir' }, btn(t('fikir.senaryo', 'Senaryo yaz'), { class: 'btn btn--kucuk btn--birincil', onclick: () => senaryoYaz(f) }), btn(f.favori ? '★' : '☆', { class: 'btn btn--kucuk btn--ikon', onclick: async () => { await depo.kaydet('fikirler', { ...f, favori: !f.favori }); ciz(); } }), btn('✕', { class: 'btn btn--kucuk btn--ikon', onclick: async () => { await depo.sil('fikirler', f.id); ciz(); } }))));
      if (!fikirler.length) liste.appendChild(el('p', { class: 'kart__alt' }, t('fikir.bos', 'Fikir yok. Kendi nişini yazıp üret ya da elle ekle.')));
    }
    async function senaryoYaz(f) {
      const mevcutSenaryo = f.senaryo_id ? await depo.al('senaryolar', f.senaryo_id) : null;
      const kanca = girdi({ value: mevcutSenaryo?.kanca || '', placeholder: t('senaryo.kanca', 'Kanca (ilk 3 saniye)') });
      const sahneler = metinAlani({ rows: 10, value: (mevcutSenaryo?.sahneler || []).map((s) => `${s.sure_sn}s | ${s.metin}`).join('\n'), placeholder: '3s | Kanca metni\n10s | Kurulum\n20s | Değer\n5s | CTA' });
      const cta = girdi({ value: mevcutSenaryo?.cta || '', placeholder: 'CTA: "fiyat" yaz' });
      const sure = el('span', { class: 'kart__alt' });
      const hesapla = () => { const toplam = sahneler.value.split('\n').map((l) => Number(l.split('|')[0]) || 0).reduce((a, b) => a + b, 0); sure.textContent = `${t('senaryo.toplam', 'Toplam')}: ${toplam} sn · ~${Math.round((kanca.value + sahneler.value).split(/\s+/).length / 2.5)} sn okuma`; }; sahneler.oninput = hesapla; hesapla();
      const aiBtn = btn('✨ ' + t('senaryo.ai', 'AI ile yaz'), { class: 'btn btn--kucuk', disabled: !mevcut, onclick: async () => { try { const r = await ai.iste('senaryo_yaz', { baslik: f.baslik, aciklama: f.aciklama, format: f.format }); kanca.value = r.kanca || ''; sahneler.value = (r.sahneler || []).map((s) => `${s.sure_sn}s | ${s.metin}`).join('\n'); cta.value = r.cta || ''; hesapla(); } catch (e) { ctx.hata(e.message); } } });
      const govde = el('div', {}, alan(t('senaryo.kanca_etiket', 'Kanca'), kanca), alan(t('senaryo.sahneler', 'Sahneler (saniye | metin)'), sahneler), alan('CTA', cta), sure, el('div', { class: 'satir' }, aiBtn, btn('🪝 ' + t('senaryo.kancaya', 'Kancayı kütüphaneye ekle'), { class: 'btn btn--kucuk', onclick: async () => { if (kanca.value.trim()) { await depo.kaydet('kancalar', { metin: kanca.value.trim(), dil: 'tr', format: f.format, nis: [], kaynak: 'senaryo' }); ctx.basari(t('genel.eklendi', 'Eklendi')); } } })));
      const r = await modal({ baslik: f.baslik, govde, genis: true, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.kaydet', 'Kaydet'), sinif: 'btn--birincil', deger: 'kaydet' }] });
      if (r === 'kaydet') {
        const s = await depo.kaydet('senaryolar', { ...(mevcutSenaryo || {}), fikir_id: f.id, baslik: f.baslik, format: f.format, dil: 'tr', kanca: kanca.value.trim(), sahneler: sahneler.value.split('\n').filter((l) => l.trim()).map((l, i) => { const [a, ...b] = l.split('|'); return { no: i + 1, sure_sn: Number(a) || 0, metin: b.join('|').trim() }; }), cta: cta.value.trim(), kaynak: 'elle' });
        await depo.kaydet('fikirler', { ...f, senaryo_id: s.id, durum: 'senaryo' });
        await depo.kaydet('galeri', { tur: 'senaryo_txt', baslik: f.baslik, kaynak: { kol: 'senaryolar', id: s.id }, onizleme: kanca.value.slice(0, 120) });
        ciz();
      }
    }
    kok.append(el('h1', {}, t('nav.fikirler', 'Fikirler & Senaryo')), kart(el('div', { class: 'satir' }, nis, hedef, format), el('div', { class: 'satir' }, uretBtn, btn('+ ' + t('fikir.elle', 'Elle fikir ekle'), { onclick: async () => { const f = el('div', {}, alan('Başlık', girdi({ name: 'b' })), alan('Açıklama', metinAlani({ name: 'a' })), alan('Format', secim(FORMATLAR, { name: 'f' }))); const r = await modal({ baslik: t('fikir.elle', 'Fikir ekle'), govde: f, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.ekle', 'Ekle'), sinif: 'btn--birincil', cb: () => ({ baslik: f.querySelector('[name=b]').value.trim(), aciklama: f.querySelector('[name=a]').value.trim(), format: f.querySelector('[name=f]').value }) }] }); if (r?.baslik) { await depo.kaydet('fikirler', { ...r, durum: 'fikir', kaynak: 'elle' }); ciz(); } } }), !mevcut ? el('span', { class: 'kart__alt' }, t('ai.yerel_kisa', 'AI üretimi için Worker gerekir; elle yazmak her zaman açık.')) : null)), liste);
    ciz();
  },
};
