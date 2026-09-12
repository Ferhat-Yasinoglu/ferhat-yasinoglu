// Akışlar listesi: filtre çipleri, kart başına adım önizlemesi, tetikleyici ve son 7 gün başlatma sayısı.
import { el, btn, rozet, temizle, girdi, goreliZaman, sayfaBas, btnS } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { bos } from '../cekirdek/durum.js';
import { DEMO_AKIS, DEMO_TETIKLEYICILER } from '../paylasilan/demo-veri.js';
import { TETIKLEYICI_BILGI } from '../paylasilan/akis/tetikleyici.js';
import { ADIM_BILGI } from '../paylasilan/akis/adimlar.js';

export default {
  baslik: 'Akışlar',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    const arama = girdi({ placeholder: t('akislar.ara', 'Akış ara…'), type: 'search', style: { maxWidth: '360px' } });
    let durumFiltre = '', kanalFiltre = '';
    const cipler = el('div', { class: 'satir' });
    const liste = el('div', { class: 'izgara' });
    const cip = (ad, aktif, cb) => el('button', { type: 'button', class: 'cip' + (aktif ? ' cip--secili' : ''), onclick: cb }, ad);
    function ciplerCiz() {
      temizle(cipler);
      cipler.append(
        cip(t('akislar.hepsi', 'Hepsi'), !durumFiltre, () => { durumFiltre = ''; ciplerCiz(); ciz(); }),
        cip(t('akis.yayinda', 'Yayında'), durumFiltre === 'yayinda', () => { durumFiltre = durumFiltre === 'yayinda' ? '' : 'yayinda'; ciplerCiz(); ciz(); }),
        cip(t('akis.taslak', 'Taslak'), durumFiltre === 'taslak', () => { durumFiltre = durumFiltre === 'taslak' ? '' : 'taslak'; ciplerCiz(); ciz(); }),
        el('span', { style: { width: '1px', height: '22px', background: 'rgb(var(--cizgi) / .12)' } }),
        ...[['telegram', 'Telegram'], ['instagram', 'Instagram'], ['whatsapp', 'WhatsApp']].map(([k, ad]) => cip(ad, kanalFiltre === k, () => { kanalFiltre = kanalFiltre === k ? '' : k; ciplerCiz(); ciz(); })));
    }
    kok.append(
      sayfaBas(t('nav.akislar', 'Akışlar'), { alt: t('akislar.alt', 'Gelen mesajlara otomatik cevap veren adım dizileri.'), eylemler: [btnS('arti', t('akislar.yeni', 'Yeni akış'), { class: 'btn btn--birincil', onclick: () => git('/akislar/yeni') })] }),
      el('div', { class: 'satir', style: { marginBlockEnd: '16px' } }, arama, cipler),
      liste);
    ciplerCiz();

    async function ciz() {
      temizle(liste);
      const [akislar, tetler, gunluk] = await Promise.all([depo.listele('akislar', { sirala: 'guncellendi', azalan: true }), depo.listele('tetikleyiciler'), depo.listele('gunluk', { filtre: (g) => g.karar?.tur === 'akis' || g.olay_tipi === 'başlat' || g.metin_ozeti === 'başlat' })]);
      const esik = Date.now() - 7 * 86400e3;
      const q = arama.value.trim().toLowerCase();
      const gorunen = akislar.filter((a) => (!q || a.ad.toLowerCase().includes(q)) && (!durumFiltre || a.durum === durumFiltre) && (!kanalFiltre || !a.kanal || a.kanal === kanalFiltre));
      if (!akislar.length) {
        liste.appendChild(bos({ simge: 'akis', baslik: t('akislar.bos', 'Henüz akış yok'), aciklama: t('akislar.bos_aciklama', 'İlk akışını 3 dakikada kur ya da demo akışı geri yükle.'), eylem: { metin: t('akislar.demo_yukle', 'Demo akışı geri yükle'), cb: async () => { await depo.kaydet('akislar', DEMO_AKIS); for (const tt of DEMO_TETIKLEYICILER) await depo.kaydet('tetikleyiciler', tt); ciz(); } } }));
        return;
      }
      for (const a of gorunen) {
        const tt = tetler.filter((x) => x.akis_id === a.id);
        const baslatma = gunluk.filter((g) => g.akis_id === a.id && Date.parse(g.zaman || 0) > esik).length;
        const yayinda = a.durum === 'yayinda';
        const onizleme = (a.adimlar || []).slice(0, 4).map((s) => ADIM_BILGI[s.type]?.ad || s.type).join(' → ') + ((a.adimlar || []).length > 4 ? ' → …' : '');
        liste.appendChild(el('section', { class: 'kart kart--tik', onclick: () => git(`/akis/${a.id}`) },
          el('div', { class: 'satir satir--arasi', style: { alignItems: 'flex-start' } },
            el('div', { style: { minWidth: '0', flex: '1' } }, el('h2', { class: 'kart__baslik', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, a.ad), el('div', { class: 'kart__alt' }, onizleme || t('akis.adim_yok_kisa', 'Adım yok'))),
            rozet(yayinda ? t('akis.yayinda', 'Yayında') : t('akis.taslak', 'Taslak'), yayinda ? 'yesil' : 'gri')),
          el('div', { class: 'satir' },
            a.kanal ? rozet(a.kanal, 'mavi') : rozet(t('akis.tum', 'Tüm kanallar'), 'gri'),
            ...tt.slice(0, 2).map((x) => rozet(`${TETIKLEYICI_BILGI[x.tip]?.ad || x.tip}${x.anahtar_kelimeler?.length ? ' · ' + x.anahtar_kelimeler.slice(0, 2).join(', ') : ''}`, x.aktif ? 'vurgu' : 'gri')),
            !tt.length ? rozet(t('akis.tetik_yok_kisa', 'tetikleyici yok'), 'sari') : null,
            a.demo ? rozet('Demo', 'gri') : null),
          el('div', { class: 'satir satir--arasi', onclick: (e) => e.stopPropagation() },
            el('span', { class: 'kart__alt' }, `${a.adimlar?.length || 0} ${t('akis.adim', 'adım')} · ${baslatma} ${t('akis.baslatma_7', 'başlatma / 7 gün')} · ${goreliZaman(a.guncellendi, t)}`),
            el('div', { class: 'satir' }, btn(t('akis.test', 'Test'), { class: 'btn btn--kucuk', onclick: () => git(`/akis/${a.id}/test`) }), btn(simge('daha'), { class: 'btn btn--kucuk btn--ikon btn--sade', 'aria-label': t('genel.daha', 'Daha'), onclick: (e) => menu(e.currentTarget, a) })))));
      }
      if (!gorunen.length) liste.appendChild(el('p', { class: 'kart__alt' }, t('akislar.eslesme_yok', 'Aramaya uyan akış yok.')));
    }
    function menu(hedef, a) {
      document.querySelectorAll('.acilir__menu').forEach((m) => m.remove());
      const m = el('div', { class: 'acilir__menu' },
        btn('⧉ ' + t('akis.cogalt', 'Çoğalt'), { onclick: async () => { const { id, rev, demo, ...k } = a; await depo.kaydet('akislar', { ...k, ad: a.ad + ' (kopya)', durum: 'taslak' }); m.remove(); ciz(); } }),
        btnS('indir', t('akis.disa', 'JSON indir'), { onclick: () => { const blob = new Blob([JSON.stringify({ akis: a }, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `${a.ad}.json`; l.click(); m.remove(); } }),
        btnS('cop', t('akis.sil', 'Sil'), { style: { color: 'rgb(var(--kirmizi))' }, onclick: async () => { m.remove(); if (await ctx.onayla(t('akis.sil_onay', '"{ad}" silinsin mi?', { ad: a.ad }), { tehlikeli: true })) { await depo.sil('akislar', a.id); for (const x of await depo.listele('tetikleyiciler', { filtre: { akis_id: a.id } })) await depo.sil('tetikleyiciler', x.id); ciz(); } } }));
      const kap = el('div', { class: 'acilir' }, m); hedef.parentElement.appendChild(kap);
      setTimeout(() => document.addEventListener('click', () => kap.remove(), { once: true }), 0);
    }
    arama.oninput = ciz;
    await ciz();
    return depo.dinle('akislar', ciz);
  },
};
