// Sohbetler: tek gelen kutusu. Yerel modda simülatör koşuları; bağlı modda gerçek sohbetler (aynı görünüm).
import { el, btn, temizle, girdi, rozet, goreliZaman, kart } from '../cekirdek/dom.js';
import { bos } from '../cekirdek/durum.js';
import { pencereKalan } from '../paylasilan/kanallar.js';

export default {
  baslik: 'Sohbetler',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    if (ctx.param.id) return sohbetCiz(kok, ctx, ctx.param.id);
    const arama = girdi({ type: 'search', placeholder: t('sohbet.ara', 'Ad ya da kullanıcı adı…') });
    const liste = el('div', { class: 'liste' });
    let sekme = 'acik';
    const sekmeler = el('div', { class: 'sekmeler' });
    for (const [k, ad] of [['acik', t('sohbet.acik', 'Açık')], ['kapali', t('sohbet.kapali', 'Kapalı')], ['sanal', t('sohbet.sanal', 'Simülatör')]]) sekmeler.appendChild(el('button', { class: 'sekme', 'aria-selected': String(sekme === k), onclick: (e) => { sekme = k; [...sekmeler.children].forEach((x) => x.setAttribute('aria-selected', String(x === e.currentTarget))); ciz(); } }, ad));
    async function ciz() {
      temizle(liste);
      const kisiler = await depo.listele('kisiler');
      const sohbetler = await depo.listele('sohbetler');
      const gunluk = await depo.listele('gunluk', { sirala: 'zaman', azalan: true });
      // Simülatör sohbetleri: sanal günlük kayıtlarını akış başına grupla.
      const sanal = new Map();
      for (const g of gunluk) if (g.sanal) { const k = g.akis_id || 'x'; if (!sanal.has(k)) sanal.set(k, { id: 'sanal:' + k, sanal: 1, akis_id: k, son_zaman: g.zaman, son_mesaj_ozeti: g.metin_ozeti, sayi: 0, kanal: g.kanal }); sanal.get(k).sayi++; }
      const akislar = Object.fromEntries((await depo.listele('akislar')).map((a) => [a.id, a]));
      let satirlar = sekme === 'sanal' ? [...sanal.values()] : sohbetler.filter((s) => (sekme === 'acik' ? s.durum !== 'kapali' : s.durum === 'kapali'));
      const q = arama.value.trim().toLowerCase();
      if (!satirlar.length) { liste.appendChild(bos({ simge: '💬', baslik: sekme === 'sanal' ? t('sohbet.sanal_bos', 'Simülatör sohbeti yok') : t('sohbet.bos', 'Henüz sohbet yok'), aciklama: sekme === 'sanal' ? t('sohbet.sanal_aciklama', 'Bir akışın Test sekmesinde konuş; koşular burada görünür.') : t('sohbet.bos_aciklama', 'Gerçek sohbetler bağlı modda görünür — botuna /start yaz.'), eylem: { metin: t('nav.akislar', 'Akışlar'), cb: () => git('/akislar') } })); return; }
      for (const s of satirlar) {
        const kisi = s.sanal ? { ad: t('sim.kisi', 'Deneme Kişi'), kanal: s.kanal } : kisiler.find((k) => k.id === s.kisi_id) || { ad: '?' };
        if (q && !`${kisi.ad} ${kisi.kullanici_adi || ''}`.toLowerCase().includes(q)) continue;
        const kalan = kisi.kanal ? pencereKalan(kisi) : null;
        liste.appendChild(el('a', { class: 'liste__satir', href: `#/sohbet/${encodeURIComponent(s.id)}` }, el('div', { class: 'avatar' }, (kisi.ad || '?').slice(0, 1).toUpperCase()), el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, `${kisi.ad}${s.sanal ? ' · ' + (akislar[s.akis_id]?.ad || '') : ''}`), el('div', { class: 'liste__alt' }, s.son_mesaj_ozeti || '')), el('div', { style: { textAlign: 'end' } }, el('div', { class: 'kart__alt' }, goreliZaman(s.son_zaman, t)), s.sanal ? rozet('🧪', 'gri') : kalan === null ? rozet('∞', 'yesil') : kalan > 0 ? rozet(`✅ ${Math.ceil(kalan)} sa`, 'yesil') : rozet('❌ ' + t('sohbet.kapandi', 'kapalı'), 'kirmizi'))));
      }
    }
    arama.oninput = ciz;
    kok.append(el('h1', {}, t('nav.sohbetler', 'Sohbetler')), sekmeler, arama, el('div', { style: { height: '12px' } }), liste);
    await ciz();
    return depo.dinle('gunluk', ciz);
  },
};

async function sohbetCiz(kok, ctx, id) {
  const { depo, t, git } = ctx;
  const sanal = id.startsWith('sanal:');
  const gunluk = await depo.listele('gunluk', { sirala: 'zaman', filtre: sanal ? (g) => g.sanal && g.akis_id === id.slice(6) : (g) => g.sohbet_id === id || g.kisi_id === id });
  const mesajlar = sanal ? [] : await depo.listele('mesajlar', { filtre: { sohbet_id: id }, sirala: 'zaman' });
  const sohbet = sanal ? null : await depo.al('sohbetler', id);
  const kisi = sohbet ? await depo.al('kisiler', sohbet.kisi_id) : null;
  const ekran = el('div', { class: 'telefon__ekran', style: { maxHeight: '55vh' } });
  for (const m of mesajlar) ekran.appendChild(el('div', { class: `balon balon--${m.yon === 'gelen' ? 'gelen' : 'giden'}` }, m.metin));
  for (const g of gunluk) ekran.appendChild(el('div', { class: 'balon balon--sistem' }, `${goreliZaman(g.zaman, t)} · ${g.olay_tipi}: ${g.metin_ozeti || ''} → ${g.karar?.tur || ''}${g.karar?.durum ? ' (' + g.karar.durum + ')' : ''}${g.prova ? ' · prova' : ''}`));
  const yaz = el('form', { class: 'satir', onsubmit: async (e) => { e.preventDefault(); const g = e.currentTarget.querySelector('input'); const metin = g.value.trim(); if (!metin) return; if (!depo.komut || !kisi) { ctx.bildir(t('sohbet.yerel_gonderim', 'Gönderim bağlı modda çalışır; yerel modda sohbetler yalnız okunur.')); return; } try { await depo.komut('mesaj_gonder', { kisi_id: kisi.id, metin }); g.value = ''; ctx.basari(t('sohbet.gonderildi', 'Gönderildi')); setTimeout(() => git(`/sohbet/${id}`), 600); } catch (err) { ctx.hata(err.message); } } }, girdi({ placeholder: sanal ? t('sohbet.sanal_yaz', 'Simülatörde konuşmak için akışın Test sekmesini kullan.') : t('sohbet.yaz', 'Mesaj yaz…'), disabled: sanal }), btn('➤', { type: 'submit', class: 'btn btn--birincil btn--ikon', disabled: sanal }));
  kok.append(el('div', { class: 'satir' }, btn('←', { class: 'btn btn--ikon btn--sade', onclick: () => git('/sohbetler') }), el('h1', { style: { margin: 0 } }, kisi ? kisi.ad : t('sohbet.sanal', 'Simülatör')), sanal ? rozet('🧪 ' + t('sohbet.sanal', 'Simülatör'), 'gri') : null),
    kisi ? kart(el('div', { class: 'satir' }, rozet(kisi.kanal, 'mavi'), ...(kisi.etiketler || []).map((e) => rozet(e, 'altin'))), btn(t('sohbet.kisi_kart', 'Kişi kartı'), { class: 'btn btn--kucuk', onclick: () => git(`/kisi/${kisi.id}`) })) : null,
    el('div', { class: 'telefon', style: { maxWidth: '100%' } }, ekran, yaz),
    sanal ? btn(t('sohbet.akisa_git', 'Akışa git'), { onclick: () => git(`/akis/${id.slice(6)}/test`) }) : null);
}
