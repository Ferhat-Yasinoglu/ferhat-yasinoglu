// Sohbetler: iki panelli gelen kutusu. Masaüstünde solda konuşma listesi, ortada mesajlar,
// geniş ekranda sağda kişi bilgisi. Telefonda tek panel: liste ↔ sohbet.
// Yerel modda simülatör koşuları da sohbet gibi görünür (yalnız okunur).
import { el, btn, temizle, girdi, rozet, goreliZaman, metinAlani, ekle } from '../cekirdek/dom.js';
import { bos } from '../cekirdek/durum.js';
import { pencereKalan } from '../paylasilan/kanallar.js';

export default {
  baslik: 'Sohbetler',
  async cizim(kok, ctx) {
    const { depo, t, git } = ctx;
    temizle(kok);
    kok.closest('.icerik')?.classList.add('icerik--genis');
    const seciliId = ctx.param.id ? decodeURIComponent(ctx.param.id) : null;

    const kap = el('div', { class: 'sohbet' + (seciliId ? ' sohbet--sohbette' : '') });
    const liste = el('div', { class: 'sohbet__liste' });
    const panel = el('div', { class: 'sohbet__panel' });
    const bilgi = el('aside', { class: 'sohbet__bilgi', 'aria-label': t('sohbet.kisi_bilgi', 'Kişi bilgisi') });
    kap.append(liste, panel, bilgi);
    kok.appendChild(kap);

    // --- Liste ---
    const arama = girdi({ type: 'search', placeholder: t('sohbet.ara', 'Ad ya da kullanıcı adı…') });
    let sekme = 'acik';
    const sekmeler = el('div', { class: 'sekmeler', style: { marginBlockEnd: '0', marginBlockStart: '8px' } });
    for (const [k, ad] of [['acik', t('sohbet.acik', 'Açık')], ['kapali', t('sohbet.kapali', 'Kapalı')], ['sanal', t('sohbet.sanal', 'Simülatör')]]) {
      sekmeler.appendChild(el('button', { class: 'sekme', 'aria-selected': String(sekme === k), onclick: (e) => { sekme = k; [...sekmeler.children].forEach((x) => x.setAttribute('aria-selected', String(x === e.currentTarget))); listeCiz(); } }, ad));
    }
    const listeGovde = el('div');
    liste.append(el('div', { class: 'sohbet__ara' }, arama, sekmeler), listeGovde);

    async function satirlariGetir() {
      const [kisiler, sohbetler, gunluk, akislar] = await Promise.all([depo.listele('kisiler'), depo.listele('sohbetler'), depo.listele('gunluk', { sirala: 'zaman', azalan: true }), depo.listele('akislar')]);
      const akisAd = Object.fromEntries(akislar.map((a) => [a.id, a.ad]));
      const sanal = new Map();
      for (const g of gunluk) if (g.sanal) { const k = g.akis_id || 'x'; if (!sanal.has(k)) sanal.set(k, { id: 'sanal:' + k, sanal: 1, akis_id: k, son_zaman: g.zaman, son_mesaj_ozeti: g.metin_ozeti, kanal: g.kanal }); }
      const ham = sekme === 'sanal' ? [...sanal.values()] : sohbetler.filter((s) => (sekme === 'acik' ? s.durum !== 'kapali' : s.durum === 'kapali'));
      ham.sort((a, b) => String(b.son_zaman || '').localeCompare(String(a.son_zaman || '')));
      return ham.map((s) => ({ s, kisi: s.sanal ? { ad: t('sim.kisi', 'Deneme Kişi') + ' · ' + (akisAd[s.akis_id] || ''), kanal: s.kanal } : kisiler.find((k) => k.id === s.kisi_id) || { ad: '?' } }));
    }

    async function listeCiz() {
      temizle(listeGovde);
      const q = arama.value.trim().toLowerCase();
      const satirlar = (await satirlariGetir()).filter(({ kisi }) => !q || `${kisi.ad} ${kisi.kullanici_adi || ''}`.toLowerCase().includes(q));
      if (!satirlar.length) {
        listeGovde.appendChild(bos({ simge: '💬', baslik: sekme === 'sanal' ? t('sohbet.sanal_bos', 'Simülatör sohbeti yok') : t('sohbet.bos', 'Henüz sohbet yok'), aciklama: sekme === 'sanal' ? t('sohbet.sanal_aciklama', 'Bir akışın Test sekmesinde konuş; koşular burada görünür.') : t('sohbet.bos_aciklama', 'Gerçek sohbetler bağlı modda görünür — botuna /start yaz.'), eylem: { metin: t('nav.akislar', 'Akışlar'), cb: () => git('/akislar') } }));
        return;
      }
      for (const { s, kisi } of satirlar) {
        const okunmamis = !s.sanal && s.okunmamis > 0;
        listeGovde.appendChild(el('button', { class: 'sohbet__oge', 'aria-current': String(s.id === seciliId), onclick: () => git(`/sohbet/${encodeURIComponent(s.id)}`) },
          el('div', { class: 'avatar' }, (kisi.ad || '?').slice(0, 1).toUpperCase()),
          el('div', { class: 'sohbet__oge-govde' },
            el('div', { class: 'sohbet__oge-ad' }, el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, kisi.ad), kanalRozeti(kisi.kanal, s.sanal)),
            el('div', { class: 'sohbet__oge-son', style: okunmamis ? { fontWeight: '650', color: 'rgb(var(--metin))' } : null }, (s.son_mesaj_ozeti || '').replace(/^\[prova\]\s*/, ''))),
          el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' } }, el('span', { class: 'sohbet__oge-zaman' }, goreliZaman(s.son_zaman, t)), okunmamis ? el('span', { class: 'sohbet__okunmamis' }, String(s.okunmamis)) : null)));
      }
    }
    arama.oninput = listeCiz;

    // --- Panel ---
    async function panelCiz() {
      temizle(panel); temizle(bilgi);
      if (!seciliId) { panel.appendChild(bos({ simge: '💬', baslik: t('sohbet.sec', 'Bir sohbet seç'), aciklama: t('sohbet.sec_aciklama', 'Soldaki listeden bir konuşma aç. Yeni mesajlar burada anında görünür.') })); return; }
      const sanal = seciliId.startsWith('sanal:');
      const sohbet = sanal ? null : await depo.al('sohbetler', seciliId);
      const kisi = sohbet ? await depo.al('kisiler', sohbet.kisi_id) : null;
      const gunluk = await depo.listele('gunluk', { sirala: 'zaman', filtre: sanal ? (g) => g.sanal && g.akis_id === seciliId.slice(6) : (g) => g.sohbet_id === seciliId || (kisi && g.kisi_id === kisi.id) });
      const mesajlar = sanal ? [] : await depo.listele('mesajlar', { filtre: { sohbet_id: seciliId }, sirala: 'zaman' });
      const ad = kisi ? kisi.ad : t('sohbet.sanal', 'Simülatör');

      panel.appendChild(el('div', { class: 'sohbet__bas' },
        btn('←', { class: 'btn btn--ikon btn--sade', 'aria-label': t('geri', 'Geri'), onclick: () => git('/sohbetler') }),
        el('div', { class: 'avatar avatar--kucuk' }, ad.slice(0, 1).toUpperCase()),
        el('div', { style: { flex: '1', minWidth: '0' } }, el('div', { style: { fontWeight: '650' } }, ad), el('div', { class: 'kart__alt' }, sanal ? t('sohbet.sanal_aciklama_kisa', 'Test koşusu') : kisi ? [kisi.kanal, kisi.kullanici_adi ? '@' + kisi.kullanici_adi : ''].filter(Boolean).join(' · ') : '')),
        kisi ? btn('👤', { class: 'btn btn--ikon btn--sade', 'aria-label': t('sohbet.kisi_kart', 'Kişi kartı'), title: t('sohbet.kisi_kart', 'Kişi kartı'), onclick: () => git(`/kisi/${kisi.id}`) }) : null,
        sanal ? btn('⚡', { class: 'btn btn--ikon btn--sade', 'aria-label': t('sohbet.akisa_git', 'Akışa git'), title: t('sohbet.akisa_git', 'Akışa git'), onclick: () => git(`/akis/${seciliId.slice(6)}/test`) }) : null));

      // Akış: mesajlar + günlük kararları zamana göre birleşir, gün ayraçları eklenir.
      const akis = el('div', { class: 'sohbet__akis' });
      const ogeler = [...mesajlar.map((m) => ({ z: m.zaman || m.olusturuldu, tur: 'mesaj', m })), ...gunluk.map((g) => ({ z: g.zaman, tur: 'gunluk', g }))].sort((a, b) => String(a.z || '').localeCompare(String(b.z || '')));
      let sonGun = '';
      for (const o of ogeler) {
        const gun = (o.z || '').slice(0, 10);
        if (gun && gun !== sonGun) { sonGun = gun; akis.appendChild(el('div', { class: 'sohbet__gun' }, gunEtiketi(gun, t))); }
        if (o.tur === 'mesaj') {
          const prova = /^\[prova\]\s*/.test(o.m.metin || '');
          const metin = (o.m.metin || '').replace(/^\[prova\]\s*/, '').replace(/^⚠️\s*/, '');
          akis.appendChild(el('div', { class: `balon balon--${o.m.yon === 'gelen' ? 'gelen' : 'giden'}` }, metin, prova ? el('span', { class: 'balon__zaman' }, '🧪 prova') : null, el('span', { class: 'balon__zaman' }, saat(o.z))));
        } else {
          const g = o.g; const karar = g.karar?.tur || '';
          akis.appendChild(el('div', { class: 'balon balon--sistem' }, `${saat(g.zaman)} · ${olayAdi(g.olay_tipi, t)} → ${kararAdi(karar, t)}${g.prova ? ' · prova' : ''}`));
        }
      }
      if (!ogeler.length) akis.appendChild(el('div', { class: 'balon balon--sistem' }, t('sohbet.mesaj_yok', 'Henüz mesaj yok.')));
      panel.appendChild(akis);
      requestAnimationFrame(() => { akis.scrollTop = akis.scrollHeight; });

      // Yazma alanı
      const kutu = metinAlani({ rows: 1, placeholder: sanal ? t('sohbet.sanal_yaz', 'Simülatörde konuşmak için akışın Test sekmesini kullan.') : !depo.komut ? t('sohbet.yerel_gonderim_kisa', 'Gönderim bağlı modda çalışır.') : t('sohbet.yaz', 'Mesaj yaz…'), disabled: sanal || !depo.komut || !kisi, style: { resize: 'none' } });
      kutu.addEventListener('input', () => { kutu.style.height = 'auto'; kutu.style.height = Math.min(140, kutu.scrollHeight) + 'px'; });
      const gonder = async () => {
        const metin = kutu.value.trim(); if (!metin || !kisi) return;
        try { await depo.komut('mesaj_gonder', { kisi_id: kisi.id, metin }); kutu.value = ''; kutu.style.height = 'auto'; ctx.basari(t('sohbet.gonderildi', 'Gönderildi')); setTimeout(panelCiz, 500); } catch (err) { ctx.hata(err.message); }
      };
      kutu.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gonder(); } });
      panel.appendChild(el('div', { class: 'sohbet__yaz' }, kutu, btn('➤', { class: 'btn btn--birincil btn--ikon', 'aria-label': t('sohbet.gonder', 'Gönder'), disabled: sanal || !depo.komut || !kisi, onclick: gonder })));

      // Sağ panel: kişi bilgisi
      if (kisi) {
        const kalan = pencereKalan(kisi);
        ekle(bilgi, [
          el('div', { style: { textAlign: 'center', paddingBlock: '8px' } }, el('div', { class: 'avatar', style: { width: '64px', height: '64px', fontSize: '1.5rem', marginInline: 'auto' } }, ad.slice(0, 1).toUpperCase()), el('div', { style: { fontWeight: '650', marginBlockStart: '8px', fontSize: 'var(--f-l)' } }, ad), el('div', { class: 'kart__alt' }, kisi.kullanici_adi ? '@' + kisi.kullanici_adi : '')),
          bilgiSatiri(t('kisi.kanal', 'Kanal'), kanalRozeti(kisi.kanal)),
          bilgiSatiri(t('kisi.puan', 'Puan'), el('strong', {}, String(kisi.puan || 0))),
          bilgiSatiri(t('kisi.pencere', '24 saat penceresi'), kalan === null ? rozet('∞', 'yesil') : kalan > 0 ? rozet(`${Math.ceil(kalan)} sa`, 'yesil') : rozet(t('sohbet.kapandi', 'kapalı'), 'kirmizi')),
          el('div', {}, el('div', { class: 'field__etiket', style: { marginBlockEnd: '6px' } }, t('kisi.etiketler', 'Etiketler')), el('div', { class: 'satir' }, ...((kisi.etiketler || []).length ? kisi.etiketler.map((e) => rozet(e, 'vurgu')) : [el('span', { class: 'kart__alt' }, '—')]))),
          Object.keys(kisi.degiskenler || {}).length ? el('div', {}, el('div', { class: 'field__etiket', style: { marginBlockEnd: '6px' } }, t('kisi.degiskenler', 'Bilgiler')), ...Object.entries(kisi.degiskenler).map(([k, v]) => bilgiSatiri(k, String(v)))) : null,
          btn(t('sohbet.kisi_kart', 'Kişi kartı'), { class: 'btn btn--tam', onclick: () => git(`/kisi/${kisi.id}`) })]);
      }
    }

    await Promise.all([listeCiz(), panelCiz()]);
    const dur = [depo.dinle('sohbetler', listeCiz), depo.dinle('mesajlar', () => { listeCiz(); if (seciliId) panelCiz(); }), depo.dinle('gunluk', () => { listeCiz(); if (seciliId) panelCiz(); })];
    return () => { kok.closest('.icerik')?.classList.remove('icerik--genis'); dur.forEach((d) => typeof d === 'function' && d()); };
  },
};

function kanalRozeti(kanal, sanal) {
  if (sanal) return rozet('🧪', 'gri');
  const r = { telegram: ['Telegram', 'mavi'], instagram: ['Instagram', 'mor'], whatsapp: ['WhatsApp', 'yesil'], tiktok: ['TikTok', 'gri'] }[kanal] || [kanal || '—', 'gri'];
  return rozet(r[0], r[1]);
}
function bilgiSatiri(etiket, deger) { return el('div', { class: 'satir satir--arasi', style: { paddingBlock: '6px', borderBlockEnd: '1px solid rgb(var(--cizgi) / .06)' } }, el('span', { class: 'kart__alt' }, etiket), deger); }
function saat(iso) { try { return new Date(iso).toLocaleTimeString(document.documentElement.lang || 'tr', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } }
function gunEtiketi(gun, t) {
  const bugun = new Date().toISOString().slice(0, 10);
  const dun = new Date(Date.now() - 86400e3).toISOString().slice(0, 10);
  if (gun === bugun) return t('zaman.bugun', 'Bugün');
  if (gun === dun) return t('zaman.dun', 'Dün');
  try { return new Intl.DateTimeFormat(document.documentElement.lang || 'tr', { day: 'numeric', month: 'long' }).format(new Date(gun)); } catch { return gun; }
}
function olayAdi(tip, t) { return { dm: t('olay.dm', 'mesaj'), start: '/start', buton: t('olay.buton', 'buton'), comment: t('olay.yorum', 'yorum'), zaman: t('olay.zaman', 'zamanlayıcı'), story_reply: t('olay.story', 'story') }[tip] || tip; }
function kararAdi(k, t) { return { akis: t('karar.akis', 'akış başladı'), cevap: t('karar.cevap', 'akışa cevap'), kural: t('karar.kural', 'kural'), ajan: t('karar.ajan', 'AI ajan'), yok: t('karar.yok', 'eşleşme yok') }[k] || k || '—'; }
