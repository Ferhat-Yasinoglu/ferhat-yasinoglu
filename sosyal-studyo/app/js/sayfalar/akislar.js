// Akışlar listesi.
import { el, btn, kart, rozet, temizle, girdi, secim, goreliZaman } from '../cekirdek/dom.js';
import { bos } from '../cekirdek/durum.js';
import { DEMO_AKIS, DEMO_TETIKLEYICILER } from '../paylasilan/demo-veri.js';
import { TETIKLEYICI_BILGI } from '../paylasilan/akis/tetikleyici.js';

export default {
  baslik: 'Akışlar',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    const arama = girdi({ placeholder: t('akislar.ara', 'Ara…'), type: 'search' });
    const kanalSec = secim([['', t('akislar.tum_kanallar', 'Tüm kanallar')], ['telegram', 'Telegram'], ['instagram', 'Instagram'], ['whatsapp', 'WhatsApp']]);
    const liste = el('div', { class: 'izgara' });
    kok.append(el('h1', {}, t('nav.akislar', 'Akışlar')), el('div', { class: 'satir' }, arama, kanalSec), liste,
      btn('+ ' + t('akislar.yeni', 'Yeni akış'), { class: 'btn btn--birincil btn--sabit', onclick: () => git('/akislar/yeni') }));

    async function ciz() {
      temizle(liste);
      const akislar = await depo.listele('akislar', { sirala: 'guncellendi', azalan: true });
      const tetler = await depo.listele('tetikleyiciler');
      const gunluk = await depo.listele('gunluk', { filtre: (g) => g.olay_tipi === 'başlat' || g.metin_ozeti === 'başlat' });
      const q = arama.value.trim().toLowerCase();
      const gorunen = akislar.filter((a) => (!q || a.ad.toLowerCase().includes(q)) && (!kanalSec.value || !a.kanal || a.kanal === kanalSec.value));
      if (!akislar.length) {
        liste.appendChild(bos({ simge: '⚡', baslik: t('akislar.bos', 'Henüz akış yok'), aciklama: t('akislar.bos_aciklama', 'İlk akışını 3 dakikada kur ya da demo akışı geri yükle.'), eylem: { metin: t('akislar.demo_yukle', 'Demo akışı geri yükle'), cb: async () => { await depo.kaydet('akislar', DEMO_AKIS); for (const tt of DEMO_TETIKLEYICILER) await depo.kaydet('tetikleyiciler', tt); ciz(); } } }));
        return;
      }
      for (const a of gorunen) {
        const tt = tetler.filter((x) => x.akis_id === a.id);
        const baslatma = gunluk.filter((g) => g.akis_id === a.id).length;
        liste.appendChild(kart(
          el('div', { class: 'satir satir--arasi' }, el('h2', { class: 'kart__baslik' }, a.ad), a.demo ? rozet('Demo', 'gri') : null),
          el('div', { class: 'satir' }, rozet(a.durum === 'yayinda' ? t('akis.yayinda', 'Yayında') : t('akis.taslak', 'Taslak'), a.durum === 'yayinda' ? 'yesil' : 'gri'), a.kanal ? rozet(a.kanal, 'mavi') : rozet(t('akis.tum', 'Tüm kanallar'), 'gri'), ...tt.slice(0, 2).map((x) => rozet(`${TETIKLEYICI_BILGI[x.tip]?.ad || x.tip}${x.anahtar_kelimeler?.length ? ' · ' + x.anahtar_kelimeler.slice(0, 2).join(', ') : ''}`, 'altin'))),
          el('div', { class: 'kart__alt' }, `${a.adimlar?.length || 0} ${t('akis.adim', 'adım')} · ${baslatma} ${t('akis.baslatma', 'başlatma')} · ${goreliZaman(a.guncellendi, t)}`),
          el('div', { class: 'satir' }, btn(t('akis.ac', 'Aç'), { class: 'btn btn--birincil btn--kucuk', onclick: () => git(`/akis/${a.id}`) }), btn(t('akis.test', 'Test'), { class: 'btn btn--kucuk', onclick: () => git(`/akis/${a.id}/test`) }), btn('⋯', { class: 'btn btn--kucuk btn--ikon', 'aria-label': 'Menü', onclick: (e) => menu(e.currentTarget, a) })),
        ));
      }
      if (!gorunen.length) liste.appendChild(el('p', { class: 'kart__alt' }, t('akislar.eslesme_yok', 'Aramaya uyan akış yok.')));
    }
    function menu(hedef, a) {
      document.querySelectorAll('.acilir__menu').forEach((m) => m.remove());
      const m = el('div', { class: 'acilir__menu' },
        btn(t('akis.cogalt', 'Çoğalt'), { onclick: async () => { const { id, rev, demo, ...k } = a; await depo.kaydet('akislar', { ...k, ad: a.ad + ' (kopya)', durum: 'taslak' }); m.remove(); ciz(); } }),
        btn(t('akis.disa', 'JSON dışa aktar'), { onclick: () => { const blob = new Blob([JSON.stringify({ akis: a }, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `${a.ad}.json`; l.click(); m.remove(); } }),
        btn(t('akis.sil', 'Sil'), { class: 'btn btn--tehlike', onclick: async () => { m.remove(); if (await ctx.onayla(t('akis.sil_onay', '"{ad}" silinsin mi?', { ad: a.ad }), { tehlikeli: true })) { await depo.sil('akislar', a.id); for (const x of await depo.listele('tetikleyiciler', { filtre: { akis_id: a.id } })) await depo.sil('tetikleyiciler', x.id); ciz(); } } }));
      const kap = el('div', { class: 'acilir' }, m); hedef.parentElement.appendChild(kap);
      setTimeout(() => document.addEventListener('click', () => kap.remove(), { once: true }), 0);
    }
    arama.oninput = ciz; kanalSec.onchange = ciz;
    await ciz();
    return depo.dinle('akislar', ciz);
  },
};
