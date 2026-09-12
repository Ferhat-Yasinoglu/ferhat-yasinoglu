// Büyüme Araçları: yorum kuralları (reply-bot motoru), hoş geldin butonları, referans linkleri, oyunlaştırma.
import { el, btn, kart, rozet, temizle, girdi, secim, alan, metinAlani, sayfaBas, btnS } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { kurallariAyristir, karar } from '../paylasilan/kurallar.js';

export default {
  baslik: 'Büyüme Araçları',
  async cizim(kok, ctx) {
    const { depo, t, git, modal, onayla, sor } = ctx;
    temizle(kok);
    let sekme = ctx.param.sekme || 'yorumlar';
    const sekmeler = el('div', { class: 'sekmeler' });
    const govde = el('div', {});
    for (const [k, ad] of [['yorumlar', t('buyume.yorumlar', 'Yorum yanıtları')], ['hosgeldin', t('buyume.hosgeldin', 'Hoş geldin butonları')], ['referans', t('buyume.referans', 'Referans linkleri')], ['oyun', t('buyume.oyun', 'Oyunlaştırma')]]) sekmeler.appendChild(el('button', { class: 'sekme', 'aria-selected': String(sekme === k), onclick: (e) => { sekme = k; [...sekmeler.children].forEach((x) => x.setAttribute('aria-selected', String(x === e.currentTarget))); history.replaceState(null, '', `#/buyume/${k}`); ciz(); } }, ad));
    kok.append(sayfaBas(t('nav.buyume', 'Büyüme Araçları'), { alt: t('buyume.alt', 'Yorumdan DM\'e, hoş geldin mesajı, referans linki ve oyun.') }), sekmeler, govde);

    async function yorumlarCiz() {
      temizle(govde);
      const kurallar = await depo.listele('kurallar', { sirala: 'sira' });
      const liste = el('div', { class: 'liste' });
      kurallar.forEach((k, i) => liste.appendChild(el('div', { class: 'liste__satir' }, el('span', { class: 'adim__no' }, String(i + 1)), el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, k.name, ' ', k.hide ? rozet('gizle', 'kirmizi') : k.ignore ? rozet('yoksay', 'gri') : rozet(`${(Array.isArray(k.reply) ? k.reply : [k.reply]).filter(Boolean).length} yanıt`, 'yesil'), k.channels?.length ? rozet(k.channels.join('/'), 'mavi') : null), el('div', { class: 'liste__alt' }, (k.keywords || []).join(', ') || k.pattern || '')),
        btn(simge('yukari'), { class: 'btn btn--kucuk btn--ikon', disabled: i === 0, onclick: async () => { await depo.kaydet('kurallar', { ...k, sira: i - 1 }); await depo.kaydet('kurallar', { ...kurallar[i - 1], sira: i }); yorumlarCiz(); } }),
        btn(simge('kalem'), { class: 'btn btn--kucuk btn--ikon', onclick: () => kuralDuzenle(k) }),
        btn(simge('kapat'), { class: 'btn btn--kucuk btn--ikon', onclick: async () => { await depo.sil('kurallar', k.id); yorumlarCiz(); } }))));
      const deneme = girdi({ placeholder: t('buyume.dene', 'Bir yorum yaz ve dene: "fiyat nedir?"') });
      const kanalSec = secim([['instagram', 'Instagram'], ['whatsapp', 'WhatsApp'], ['telegram', 'Telegram']]);
      const sonuc = el('div', { class: 'kod' }, '—');
      const dene = () => { const { kurallar: k } = kurallariAyristir(kurallar.map(({ id, rev, olusturuldu, guncellendi, silindi, sira, demo, ...r }) => r)); const c = karar(k, { text: deneme.value, kanal: kanalSec.value, username: 'deneme' }); sonuc.textContent = JSON.stringify(c, null, 1); };
      deneme.oninput = dene; kanalSec.onchange = dene;
      govde.append(el('p', { class: 'kart__alt' }, t('buyume.yorum_aciklama', 'Sıralı liste: ilk eşleşen kural kazanır. Anahtar kelimeler Türkçe\'ye duyarlıdır; regex isteğe bağlı. Instagram günde 150–300 yorum yanıtı sınırı — çeşitlilik için en az 10 varyant.')),
        el('div', { class: 'satir', style: { marginBottom: '8px' } }, btnS('arti', t('buyume.kural_ekle', 'Kural ekle'), { class: 'btn btn--birincil btn--kucuk', onclick: () => kuralDuzenle({ name: '', keywords: [], reply: [], sira: kurallar.length }) }), !kurallar.length ? btn(t('buyume.ornek_yukle', 'Örnek 27 kuralı yükle (4 dil)'), { class: 'btn btn--kucuk', onclick: async () => { const r = await fetch('./data/kurallar-ornek.json'); const liste = await r.json(); let i = 0; for (const k of liste) await depo.kaydet('kurallar', { ...k, sira: i++ }); yorumlarCiz(); } }) : null, btnS('indir', 'JSON', { class: 'btn btn--kucuk', onclick: () => { const b = new Blob([JSON.stringify(kurallar.map(({ id, rev, olusturuldu, guncellendi, silindi, sira, ...r }) => r), null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = 'rules.json'; l.click(); } })),
        liste.children.length ? liste : el('p', { class: 'kart__alt' }, t('buyume.kural_yok', 'Kural yok.')),
        el('h2', {}, t('buyume.dene_baslik', 'Bir yorum dene')), el('div', { class: 'satir' }, deneme, kanalSec), sonuc);
      async function kuralDuzenle(k) {
        const f = el('div', {}, alan('Ad (konu-dil)', girdi({ name: 'name', value: k.name || '', placeholder: 'is-tr' })), alan('Anahtar kelimeler (virgül)', girdi({ name: 'keywords', value: (k.keywords || []).join(', ') })), alan('Regex (isteğe bağlı)', girdi({ name: 'pattern', value: k.pattern || '' })), alan('Yanıt varyantları (satır başına bir)', metinAlani({ name: 'reply', rows: 6, value: (Array.isArray(k.reply) ? k.reply : k.reply ? [k.reply] : []).join('\n') })), alan('Yorum → DM özel yanıt (yalnız Instagram, yorum başına 1)', girdi({ name: 'privateReply', value: k.privateReply || '' })), alan('Kanallar (boş = hepsi)', girdi({ name: 'channels', value: (k.channels || []).join(', '), placeholder: 'instagram, whatsapp' })), el('div', { class: 'satir' }, el('label', { class: 'cip' }, el('input', { type: 'checkbox', name: 'hide', checked: !!k.hide }), ' gizle'), el('label', { class: 'cip' }, el('input', { type: 'checkbox', name: 'ignore', checked: !!k.ignore }), ' yoksay')));
        const r = await modal({ baslik: t('buyume.kural', 'Kural'), govde: f, genis: true, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.kaydet', 'Kaydet'), sinif: 'btn--birincil', cb: () => { const v = (n) => f.querySelector(`[name=${n}]`); const y = { ...k, name: v('name').value.trim(), keywords: v('keywords').value.split(',').map((s) => s.trim()).filter(Boolean), pattern: v('pattern').value.trim() || undefined, reply: v('reply').value.split('\n').map((s) => s.trim()).filter(Boolean), privateReply: v('privateReply').value.trim() || undefined, channels: v('channels').value.split(',').map((s) => s.trim()).filter(Boolean), hide: v('hide').checked || undefined, ignore: v('ignore').checked || undefined }; if (!y.channels.length) delete y.channels; const { hatalar } = kurallariAyristir([y]); if (hatalar.length) { ctx.hata(hatalar.join('; ')); return false; } return y; } }] });
        if (r && typeof r === 'object') { await depo.kaydet('kurallar', r); yorumlarCiz(); }
      }
    }
    async function hosgeldinCiz() {
      temizle(govde);
      const liste = await depo.listele('hos_geldin', { sirala: 'sira' });
      const akislar = await depo.listele('akislar');
      govde.append(el('p', { class: 'kart__alt' }, t('buyume.hg_aciklama', 'Instagram "ice breaker": sohbet açılınca görünen en fazla 4 soru; her biri bir akış başlatır. Bağlı modda kaydedince Meta\'ya yazılır.')),
        el('div', { class: 'liste' }, ...liste.map((h) => el('div', { class: 'liste__satir' }, el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, h.soru), el('div', { class: 'liste__alt' }, '→ ' + (akislar.find((a) => a.id === h.akis_id)?.ad || '—'))), btn(simge('kapat'), { class: 'btn btn--kucuk btn--ikon', onclick: async () => { await depo.sil('hos_geldin', h.id); hosgeldinCiz(); } })))),
        el('div', { style: { height: '8px' } }), btnS('arti', t('buyume.hg_ekle', 'Soru ekle'), { class: 'btn btn--birincil btn--kucuk', disabled: liste.length >= 4, onclick: async () => { const f = el('div', {}, alan('Soru (≤80 kr)', girdi({ name: 'soru', maxlength: 80 })), alan('Akış', secim(akislar.map((a) => [a.id, a.ad]), { name: 'akis' }))); const r = await modal({ baslik: t('buyume.hg_ekle', 'Soru ekle'), govde: f, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.ekle', 'Ekle'), sinif: 'btn--birincil', cb: () => ({ soru: f.querySelector('[name=soru]').value.trim(), akis_id: f.querySelector('[name=akis]').value }) }] }); if (r?.soru) { await depo.kaydet('hos_geldin', { ...r, sira: liste.length }); hosgeldinCiz(); } } }));
    }
    async function referansCiz() {
      temizle(govde);
      const liste = await depo.listele('referans_linkleri');
      const hesaplar = await depo.listele('hesaplar');
      const akislar = await depo.listele('akislar');
      govde.append(el('p', { class: 'kart__alt' }, t('buyume.ref_aciklama', 'Telegram: t.me/<bot>?start=ref_<kod>. Instagram: ig.me/m/<kullanıcı>?ref=<kod>. Linkten gelen kişi "ref_link" tetikleyicili akışa girer, kaynağı kaydedilir.')),
        el('div', { class: 'izgara' }, ...liste.map((r) => kart(el('div', { class: 'satir satir--arasi' }, el('span', { class: 'kart__baslik' }, r.ad), rozet(r.kaynak || 'bio', 'gri')), el('div', { class: 'kopyala' }, r.link, btn('⧉', { class: 'btn btn--kucuk', onclick: () => navigator.clipboard?.writeText(r.link).then(() => ctx.basari(t('genel.kopyalandi', 'Kopyalandı'))) })), el('div', { class: 'kart__alt' }, `${r.tiklama || 0} ${t('buyume.tiklama', 'tıklama')} · ${r.kisi || 0} ${t('kisiler.kisi', 'kişi')} · → ${akislar.find((a) => a.id === r.akis_id)?.ad || '—'}`), btn(t('genel.sil', 'Sil'), { class: 'btn btn--kucuk btn--tehlike', onclick: async () => { await depo.sil('referans_linkleri', r.id); referansCiz(); } })))),
        el('div', { style: { height: '8px' } }), btnS('arti', t('buyume.ref_ekle', 'Link oluştur'), { class: 'btn btn--birincil btn--kucuk', onclick: async () => { const f = el('div', {}, alan('Ad', girdi({ name: 'ad', placeholder: 'Bio linki' })), alan('Kaynak', secim([['bio', 'Bio'], ['story', 'Story'], ['reklam', 'Reklam'], ['diger', 'Diğer']], { name: 'kaynak' })), alan('Hesap', secim(hesaplar.map((h) => [h.id, `${h.ad} (${h.kanal})`]), { name: 'hesap' })), alan('Akış', secim(akislar.map((a) => [a.id, a.ad]), { name: 'akis' }))); const r = await modal({ baslik: t('buyume.ref_ekle', 'Link oluştur'), govde: f, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.ekle', 'Oluştur'), sinif: 'btn--birincil', cb: () => { const v = (n) => f.querySelector(`[name=${n}]`).value; const h = hesaplar.find((x) => x.id === v('hesap')); const kod = Math.random().toString(36).slice(2, 8); const kullanici = (h?.dis_id || 'bot').replace(/^@/, ''); return { ad: v('ad').trim() || 'Link', kaynak: v('kaynak'), hesap_id: v('hesap'), akis_id: v('akis'), kod, link: h?.kanal === 'instagram' ? `https://ig.me/m/${kullanici}?ref=${kod}` : `https://t.me/${kullanici}?start=ref_${kod}`, tiklama: 0, kisi: 0 }; } }] }); if (r && typeof r === 'object') { await depo.kaydet('referans_linkleri', r); referansCiz(); } } }));
    }
    async function oyunCiz() {
      temizle(govde);
      const ayar = await depo.ayarlar();
      const oyun = ayar.oyun || { aktif: 0, yalnizTakipciler: 0, oduller: [] };
      const oduller = el('div', { class: 'liste' }, ...(oyun.oduller || []).map((o, i) => el('div', { class: 'liste__satir' }, el('strong', { class: 'satir' }, simge('yildiz', { boy: 14 }), String(o.puan)), el('div', { class: 'liste__govde' }, o.odul), btn(simge('kapat'), { class: 'btn btn--kucuk btn--ikon', onclick: async () => { oyun.oduller.splice(i, 1); await depo.ayarKaydet('oyun', oyun); oyunCiz(); } }))));
      govde.append(el('p', { class: 'kart__alt' }, t('buyume.oyun_aciklama', 'Yorum, story tepkisi, DM ve akış tamamlama puan kazandırır; puan kuralları Kişiler & Puanlar sekmesinde. Burada ödülleri ve genel ayarları belirle.')),
        el('div', { class: 'satir' }, el('label', { class: 'cip' }, el('input', { type: 'checkbox', checked: !!oyun.aktif, onchange: async (e) => { oyun.aktif = e.target.checked ? 1 : 0; await depo.ayarKaydet('oyun', oyun); } }), ' ' + t('buyume.oyun_aktif', 'Oyunlaştırma açık')), el('label', { class: 'cip' }, el('input', { type: 'checkbox', checked: !!oyun.yalnizTakipciler, onchange: async (e) => { oyun.yalnizTakipciler = e.target.checked ? 1 : 0; await depo.ayarKaydet('oyun', oyun); } }), ' ' + t('buyume.yalniz_takipci', 'yalnız takipçiler (Instagram)'))),
        el('h2', {}, t('buyume.oduller', 'Ödüller')), oduller.children.length ? oduller : el('p', { class: 'kart__alt' }, '—'), el('div', { style: { height: '8px' } }),
        btnS('arti', t('buyume.odul_ekle', 'Ödül ekle'), { class: 'btn btn--birincil btn--kucuk', onclick: async () => { const f = el('div', {}, alan('Puan', girdi({ name: 'puan', type: 'number', value: 50 })), alan('Ödül', girdi({ name: 'odul', placeholder: '%10 indirim kodu' }))); const r = await modal({ baslik: t('buyume.odul_ekle', 'Ödül ekle'), govde: f, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.ekle', 'Ekle'), sinif: 'btn--birincil', cb: () => ({ puan: Number(f.querySelector('[name=puan]').value), odul: f.querySelector('[name=odul]').value.trim() }) }] }); if (r?.odul) { oyun.oduller = [...(oyun.oduller || []), r].sort((a, b) => a.puan - b.puan); await depo.ayarKaydet('oyun', oyun); oyunCiz(); } } }),
        el('div', { style: { height: '12px' } }), btn(t('puan.kurallar', 'Puan kuralları →'), { class: 'btn btn--kucuk', onclick: () => git('/kisiler/puanlar') }));
    }
    function ciz() { ({ yorumlar: yorumlarCiz, hosgeldin: hosgeldinCiz, referans: referansCiz, oyun: oyunCiz }[sekme] || yorumlarCiz)(); }
    ciz();
  },
};
