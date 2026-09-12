// Toplu Mesaj: segmentli, planlı gönderim. Yerel modda "simüle et" alıcı sayısını ve
// kanal gerçeklerini gösterir; gerçek gönderim Worker'da (bağlı mod).
import { el, btn, kart, rozet, temizle, girdi, secim, alan, metinAlani, goreliZaman, sayfaBas } from '../cekirdek/dom.js';
import { bos } from '../cekirdek/durum.js';
import { pencereAcik, KANALLAR } from '../paylasilan/kanallar.js';

export function aliciSec(kisiler, { hesap_id, kanal, etiketHepsi = [], etiketHerhangi = [], etiketHaric = [], secili }) {
  return kisiler.filter((k) => {
    if (secili?.length) return secili.includes(k.id);
    if (hesap_id && k.hesap_id !== hesap_id) return false;
    if (kanal && k.kanal !== kanal) return false;
    const e = k.etiketler || [];
    if (etiketHepsi.length && !etiketHepsi.every((x) => e.includes(x))) return false;
    if (etiketHerhangi.length && !etiketHerhangi.some((x) => e.includes(x))) return false;
    if (etiketHaric.some((x) => e.includes(x))) return false;
    return true;
  });
}

export default {
  baslik: 'Toplu Mesaj',
  async cizim(kok, ctx) {
    const { depo, t, git, onayla } = ctx;
    temizle(kok);
    if (ctx.param.id === 'yeni') return yeniCiz(kok, ctx);
    if (ctx.param.id) return detayCiz(kok, ctx, ctx.param.id);
    const liste = el('div', { class: 'izgara' });
    async function ciz() {
      temizle(liste);
      const isler = await depo.listele('toplu_mesajlar', { sirala: 'guncellendi', azalan: true });
      if (!isler.length) { liste.appendChild(bos({ simge: '📣', baslik: t('toplu.bos', 'Henüz toplu mesaj yok'), aciklama: t('toplu.bos_aciklama', 'Etiketlere göre segment seç, mesajı yaz, önce kendine gönder.'), eylem: { metin: t('toplu.yeni', 'Yeni toplu mesaj'), cb: () => git('/toplu/yeni') } })); return; }
      for (const i of isler) {
        const s = i.sayim || { toplam: 0, gonderildi: 0, atlandi: 0, basarisiz: 0 };
        const oran = s.toplam ? ((s.gonderildi + s.atlandi + s.basarisiz) / s.toplam) * 100 : 0;
        liste.appendChild(kart(el('div', { class: 'satir satir--arasi' }, el('h2', { class: 'kart__baslik' }, i.ad), rozet(i.durum, { taslak: 'gri', kuyrukta: 'mavi', gonderiliyor: 'mavi', bitti: 'yesil', duraklatildi: 'sari', basarisiz: 'kirmizi', simule: 'mor' }[i.durum] || 'gri')), el('div', { class: 'kart__alt' }, `${i.kanal || '—'} · ${s.toplam} ${t('toplu.alici', 'alıcı')} · ✓ ${s.gonderildi} · ⏭ ${s.atlandi} · ✗ ${s.basarisiz}${i.prova ? ' · prova' : ''}`), el('div', { class: 'ilerleme' }, el('div', { class: 'ilerleme__dolu', style: { width: `${oran}%` } })), el('div', { class: 'satir' }, btn(t('akis.ac', 'Aç'), { class: 'btn btn--kucuk', onclick: () => git(`/toplu/${i.id}`) }), btn(t('akis.cogalt', 'Çoğalt'), { class: 'btn btn--kucuk', onclick: async () => { const { id, rev, sayim, durum, ...k } = i; await depo.kaydet('toplu_mesajlar', { ...k, ad: i.ad + ' (kopya)', durum: 'taslak', sayim: null }); ciz(); } }))));
      }
    }
    kok.append(sayfaBas(t('nav.toplu', 'Toplu Mesaj'), { alt: t('toplu.alt', 'Seçtiğin kişilere sırayla, limitlere uyarak mesaj gönderir.'), eylemler: [btn('+ ' + t('toplu.yeni', 'Yeni toplu mesaj'), { class: 'btn btn--birincil', onclick: () => git('/toplu/yeni') })] }), liste);
    await ciz();
    return depo.dinle('toplu_mesajlar', ciz);
  },
};

async function yeniCiz(kok, ctx) {
  const { depo, t, git } = ctx;
  const hesaplar = await depo.listele('hesaplar');
  const etiketler = await depo.listele('etiketler');
  const kisiler = await depo.listele('kisiler');
  const secili = JSON.parse(sessionStorage.getItem('ss-secili-kisiler') || '[]'); sessionStorage.removeItem('ss-secili-kisiler');
  const ad = girdi({ value: t('toplu.varsayilan_ad', 'Toplu mesaj') + ' ' + new Date().toLocaleDateString() });
  const hesap = secim([['', t('akis.tum', 'Tüm hesaplar')], ...hesaplar.map((h) => [h.id, `${h.ad} (${h.kanal})`])]);
  const kanal = secim([['', t('akislar.tum_kanallar', 'Tüm kanallar')], ['telegram', 'Telegram'], ['instagram', 'Instagram'], ['whatsapp', 'WhatsApp']]);
  const hepsi = girdi({ placeholder: t('toplu.etiket_hepsi', 'hepsi (VE): lead-fiyat, ilgi-bot') });
  const herhangi = girdi({ placeholder: t('toplu.etiket_herhangi', 'herhangi (VEYA)') });
  const haric = girdi({ placeholder: t('toplu.etiket_haric', 'hariç') });
  const metin = metinAlani({ placeholder: t('toplu.metin', 'Mesaj… {{ad}} kullanılabilir'), rows: 4 });
  const butonlar = girdi({ placeholder: t('toplu.butonlar', 'Butonlar (virgül, en fazla 3)') });
  const zaman = girdi({ type: 'datetime-local' });
  const ozet = el('div', { class: 'bant bant--mavi' });
  const liste = (g) => g.value.split(',').map((s) => s.trim()).filter(Boolean);
  function hesapla() {
    const secim = { hesap_id: hesap.value || undefined, kanal: kanal.value || (hesaplar.find((h) => h.id === hesap.value)?.kanal) || undefined, etiketHepsi: liste(hepsi), etiketHerhangi: liste(herhangi), etiketHaric: liste(haric), secili };
    const alicilar = aliciSec(kisiler, secim);
    const acik = alicilar.filter((k) => pencereAcik(k));
    const igKapali = alicilar.filter((k) => k.kanal === 'instagram' && !pencereAcik(k)).length;
    const wa = alicilar.filter((k) => k.kanal === 'whatsapp').length;
    ozet.replaceChildren(el('span', {}, `👥 ${alicilar.length} ${t('toplu.alici', 'alıcı')} · ✅ ${acik.length} ${t('toplu.pencere_acik', 'penceresi açık')}`), igKapali ? el('span', {}, ` · Instagram'da ${igKapali} kişi atlanacak (24 sa dışı)`) : null, wa ? el('span', {}, ` · WhatsApp ${wa}: ${t('toplu.wa_sablon', 'yalnız onaylı şablonla')}`) : null);
    return { alicilar, acik, secim };
  }
  for (const g of [hesap, kanal, hepsi, herhangi, haric]) g.oninput = hesapla; hesap.onchange = hesapla; kanal.onchange = hesapla;
  hesapla();
  async function kaydet(durum) {
    const { alicilar, acik, secim } = hesapla();
    const adimlar = [{ type: 'message', text: metin.value.trim() }]; const b = liste(butonlar).slice(0, 3); if (b.length) adimlar[0] = { type: 'buttons', text: metin.value.trim(), choices: b.map((label) => ({ label })) };
    if (!metin.value.trim()) { ctx.hata(t('toplu.metin_gerekli', 'Mesaj boş olamaz')); return; }
    const mod = await ctx.mod();
    const is = { ad: ad.value.trim(), hesap_id: hesap.value || null, kanal: secim.kanal || null, adimlar, segment: { hepsi: secim.etiketHepsi, herhangi: secim.etiketHerhangi, haric: secim.etiketHaric, secili }, alicilar_donduruldu: alicilar.map((k) => k.id), planlanan: zaman.value ? new Date(zaman.value).toISOString() : null, durum, prova: mod === 'yerel' ? 1 : 0, sayim: { toplam: alicilar.length, gonderildi: 0, atlandi: 0, basarisiz: 0 } };
    if (durum === 'simule') { is.sayim = { toplam: alicilar.length, gonderildi: acik.length, atlandi: alicilar.length - acik.length, basarisiz: 0 }; is.durum = 'simule'; is.baslangic = new Date().toISOString(); is.bitis = is.baslangic; for (const k of acik.slice(0, 50)) await depo.kaydet('gunluk', { sanal: 1, zaman: new Date().toISOString(), kanal: k.kanal, kisi_id: k.id, olay_tipi: 'toplu', metin_ozeti: metin.value.slice(0, 80), karar: { tur: 'toplu' }, prova: 1, gonderildi: 0 }); }
    const y = await depo.kaydet('toplu_mesajlar', is);
    ctx.basari(durum === 'simule' ? t('toplu.simule_edildi', 'Simüle edildi: {n} kişiye gidecekti', { n: acik.length }) : t('genel.kaydedildi', 'Kaydedildi'));
    git(`/toplu/${y.id}`);
  }
  const mod = await ctx.mod();
  kok.append(sayfaBas(t('toplu.yeni', 'Yeni toplu mesaj'), { geri: () => git('/toplu') }),
    alan(t('toplu.ad', 'Ad'), ad), el('div', { class: 'satir' }, alan(t('akis.hesap', 'Hesap'), hesap), alan(t('toplu.kanal', 'Kanal'), kanal)),
    el('h2', {}, t('toplu.hedef', 'Hedef')), secili.length ? el('p', { class: 'bant bant--mavi' }, `${secili.length} ${t('toplu.secili', 'seçili kişi')}`) : null, alan(t('toplu.hepsi', 'Şu etiketlerin hepsi'), hepsi), alan(t('toplu.herhangi', 'Herhangi biri'), herhangi), alan(t('toplu.haric', 'Hariç'), haric), ozet,
    el('h2', {}, t('toplu.mesaj', 'Mesaj')), alan(t('adim.metin', 'Metin'), metin), alan(t('toplu.butonlar_etiket', 'Butonlar'), butonlar, { ipucu: t('toplu.buton_ipucu', 'Instagram/WhatsApp en fazla 3 buton gösterir.') }),
    el('h2', {}, t('toplu.zaman', 'Zaman')), alan(t('toplu.planla', 'Planla (boş = hemen)'), zaman),
    el('div', { class: 'satir' }, btn(t('toplu.taslak', 'Taslak kaydet'), { onclick: () => kaydet('taslak') }), mod === 'yerel' ? btn('🧪 ' + t('toplu.simule', 'Simüle et'), { class: 'btn btn--birincil', onclick: () => kaydet('simule') }) : btn(t('toplu.kuyruga', 'Kuyruğa al'), { class: 'btn btn--birincil', onclick: () => kaydet('kuyrukta') })),
    mod === 'yerel' ? el('p', { class: 'kart__alt' }, t('toplu.yerel_not', 'Yerel modda gerçek gönderim yok; Worker bağlanınca "Kuyruğa al" görünür.')) : null);
}

async function detayCiz(kok, ctx, id) {
  const { depo, t, git, onayla } = ctx;
  const i = await depo.al('toplu_mesajlar', id);
  if (!i) { kok.appendChild(el('p', { class: 'durum-hata' }, t('toplu.yok', 'İş bulunamadı'))); return; }
  const s = i.sayim || { toplam: 0, gonderildi: 0, atlandi: 0, basarisiz: 0 };
  kok.append(sayfaBas(i.ad, { geri: () => git('/toplu'), eylemler: [rozet(i.durum, 'mavi'), i.prova ? rozet('prova', 'sari') : null] }),
    kart(el('div', { class: 'satir' }, el('span', { class: 'sayac' }, el('span', { class: 'sayac__deger' }, String(s.toplam)), el('span', { class: 'sayac__etiket' }, t('toplu.alici', 'alıcı'))), el('span', { class: 'sayac' }, el('span', { class: 'sayac__deger' }, String(s.gonderildi)), el('span', { class: 'sayac__etiket' }, t('toplu.gonderildi', 'gönderildi'))), el('span', { class: 'sayac' }, el('span', { class: 'sayac__deger' }, String(s.atlandi)), el('span', { class: 'sayac__etiket' }, t('toplu.atlandi', 'atlandı'))), el('span', { class: 'sayac' }, el('span', { class: 'sayac__deger' }, String(s.basarisiz)), el('span', { class: 'sayac__etiket' }, t('toplu.basarisiz', 'başarısız')))),
      el('p', { class: 'kart__alt' }, `${i.kanal || '—'} · ${i.planlanan ? t('toplu.planlanan', 'planlanan') + ': ' + goreliZaman(i.planlanan, t) : t('toplu.hemen', 'hemen')} · ${t('toplu.segment', 'segment')}: ${JSON.stringify(i.segment)}`),
      el('div', { class: 'kod' }, i.adimlar?.[0]?.text || ''), i.adimlar?.[0]?.choices ? el('div', { class: 'satir' }, ...i.adimlar[0].choices.map((c) => rozet(c.label, 'mavi'))) : null),
    el('div', { class: 'satir' }, ['kuyrukta', 'gonderiliyor'].includes(i.durum) ? btn(t('toplu.durdur', 'Durdur'), { class: 'btn btn--tehlike', onclick: async () => { await depo.kaydet('toplu_mesajlar', { ...i, durum: 'duraklatildi' }); git(`/toplu/${id}`); } }) : null, btn(t('genel.sil', 'Sil'), { class: 'btn btn--tehlike', onclick: async () => { if (await onayla(t('toplu.sil_onay', 'Bu iş silinsin mi?'), { tehlikeli: true })) { await depo.sil('toplu_mesajlar', id); git('/toplu'); } } })));
}
