// Akış düzenleyici: dikey adım listesi, adım formu, tetikleyici paneli, doğrulama, yayın, simülatör.
import { el, btn, kart, rozet, temizle, girdi, secim, alan, metinAlani } from '../cekirdek/dom.js';
import { ADIM_BILGI, ADIM_TIPLERI, KOSUL_TURLERI, adimlariDogrula } from '../paylasilan/akis/adimlar.js';
import { TETIKLEYICI_BILGI, TETIKLEYICI_TIPLERI, cakismaBul } from '../paylasilan/akis/tetikleyici.js';
import { simulator, adimOzeti } from '../bilesenler/simulator.js';

const SECENEK_ALANLARI = ['label', 'value', 'goto', 'add_tags', 'url'];

function adimFormu(adim, adimlar, i, t) {
  const f = el('div', {});
  const hedefSecim = (deger, ad) => secim([['', '—'], ...adimlar.map((a, j) => [String(j), `${j + 1} · ${adimOzeti(a).ad}: ${(adimOzeti(a).metin || '').slice(0, 30)}`])], { value: deger === undefined ? '' : String(deger), name: ad });
  const listeGirdi = (ad, deger) => girdi({ name: ad, value: (deger || []).join(', '), placeholder: 'etiket1, etiket2' });
  const tipSec = secim(ADIM_TIPLERI.map((k) => [k, `${ADIM_BILGI[k].simge} ${ADIM_BILGI[k].ad}`]), { value: adim.type, name: 'type' });
  const govde = el('div', {});
  function govdeCiz(tip) {
    temizle(govde);
    const a = adim.type === tip ? adim : { type: tip };
    const ekle = (...x) => govde.append(...x);
    switch (tip) {
      case 'message': ekle(alan(t('adim.metin', 'Metin'), metinAlani({ name: 'text', value: a.text || '' }), { ipucu: '{{ad}}, {{username}} ve kaydedilen değişkenler kullanılabilir.' }), alan(t('adim.medya', 'Medya URL (isteğe bağlı, https)'), girdi({ name: 'media_url', value: a.media?.url || '' }))); break;
      case 'question': ekle(alan(t('adim.metin', 'Soru'), metinAlani({ name: 'text', value: a.text || '' })), alan(t('adim.save_as', 'Cevabı kaydet (değişken adı)'), girdi({ name: 'save_as', value: a.save_as || '', placeholder: 'butce' })), alan(t('adim.dogrula', 'Doğrulama'), secim([['none', 'Yok'], ['phone', 'Telefon'], ['email', 'E-posta'], ['number', 'Sayı']], { name: 'validate', value: a.validate || 'none' })), alan(t('adim.retry', 'Geçersizse tekrar sor metni'), girdi({ name: 'retry_text', value: a.retry_text || '' }))); break;
      case 'buttons': case 'private_reply': {
        ekle(alan(t('adim.metin', 'Metin'), metinAlani({ name: 'text', value: a.text || '' })));
        if (tip === 'buttons') ekle(alan(t('adim.save_as', 'Seçimi kaydet (değişken adı)'), girdi({ name: 'save_as', value: a.save_as || '' })));
        const satirlar = el('div', { class: 'onay-listesi' });
        const satirEkle = (c = {}) => satirlar.appendChild(el('div', { class: 'satir', dataset: { secenek: '1' } }, girdi({ name: 'c_label', value: c.label || '', placeholder: t('adim.buton', 'Buton metni'), style: { flex: '2' } }), hedefSecim(c.goto, 'c_goto'), girdi({ name: 'c_tags', value: (c.add_tags || []).join(', '), placeholder: 'etiketler', style: { flex: '1' } }), btn('✕', { class: 'btn btn--ikon btn--kucuk', onclick: (e) => e.currentTarget.parentElement.remove() })));
        (a.choices || []).forEach(satirEkle);
        ekle(el('div', { class: 'field' }, el('span', { class: 'field__etiket' }, t('adim.secenekler', 'Seçenekler (buton · hedef adım · etiketler)')), satirlar, btn('+ ' + t('adim.secenek_ekle', 'Seçenek ekle'), { class: 'btn btn--kucuk', onclick: () => satirEkle() })));
        break; }
      case 'delay': ekle(alan(t('adim.saniye', 'Saniye'), girdi({ name: 'seconds', type: 'number', min: 0, max: 604800, value: a.seconds ?? 60 }), { ipucu: '3600 = 1 saat, 86400 = 1 gün' })); break;
      case 'tag': ekle(alan(t('adim.etiket_ekle', 'Etiket ekle'), listeGirdi('add_tags', a.add_tags)), alan(t('adim.etiket_sil', 'Etiket kaldır'), listeGirdi('remove_tags', a.remove_tags))); break;
      case 'goto': ekle(alan(t('adim.hedef', 'Hedef adım'), hedefSecim(a.goto, 'goto'))); break;
      case 'end': case 'hide': break;
      case 'note': ekle(alan(t('adim.not', 'Not (koşucu atlar)'), metinAlani({ name: 'text', value: a.text || '' }))); break;
      case 'condition': {
        const kind = secim(KOSUL_TURLERI.map((k) => [k, k]), { name: 'kind', value: a.check?.kind || 'tag' });
        ekle(alan(t('adim.kosul', 'Koşul türü'), kind), alan('any (virgül)', listeGirdi('k_any', a.check?.any)), alan('all', listeGirdi('k_all', a.check?.all)), alan('none', listeGirdi('k_none', a.check?.none)),
          alan('var: name / op / value', el('div', { class: 'satir' }, girdi({ name: 'k_name', value: a.check?.name || '', placeholder: 'name' }), secim([['set', 'set'], ['unset', 'unset'], ['eq', 'eq'], ['ne', 'ne'], ['contains', 'contains'], ['gt', 'gt'], ['lt', 'lt'], ['gte', 'gte']], { name: 'k_op', value: a.check?.op || 'eq' }), girdi({ name: 'k_value', value: a.check?.value ?? '', placeholder: 'value' }))),
          alan('channel in (virgül)', listeGirdi('k_in', a.check?.in)),
          alan(t('adim.evet', 'Evet ise →'), hedefSecim(a.then, 'then')), alan(t('adim.hayir', 'Hayır ise →'), hedefSecim(a.else, 'else')));
        break; }
      case 'ai_reply': ekle(alan(t('adim.talimat', 'Talimat'), metinAlani({ name: 'instruction', value: a.instruction || '' })), alan(t('adim.save_as', 'Cevabı kaydet'), girdi({ name: 'save_as', value: a.save_as || '' })), alan('max_chars', girdi({ name: 'max_chars', type: 'number', value: a.max_chars ?? 400 })), alan(t('adim.yedek_metin', 'Model susarsa metin'), girdi({ name: 'fallback_text', value: a.fallback_text || '' })), alan(t('adim.susarsa', 'Model susarsa →'), hedefSecim(a.on_skip_goto, 'on_skip_goto'))); break;
      case 'score': ekle(alan(t('adim.delta', 'Puan (±)'), girdi({ name: 'delta', type: 'number', value: a.delta ?? 1 })), alan(t('adim.sebep', 'Sebep'), girdi({ name: 'reason', value: a.reason || '' })), alan('once_per', secim([['run', 'koşu başına'], ['day', 'gün başına'], ['event', 'her seferinde']], { name: 'once_per', value: a.once_per || 'run' }))); break;
      case 'webhook': ekle(alan('URL (https)', girdi({ name: 'url', value: a.url || '' })), alan('Yöntem', secim([['POST', 'POST'], ['GET', 'GET']], { name: 'method', value: a.method || 'POST' })), alan('Gövde (JSON, {{degisken}} kullanılabilir)', metinAlani({ name: 'body', value: a.body || '' })), alan(t('adim.save_as', 'Sonucu kaydet'), girdi({ name: 'save_as', value: a.save_as || '' })), alan(t('adim.hata_ise', 'Hata olursa →'), hedefSecim(a.on_error_goto, 'on_error_goto'))); break;
      case 'comment_reply': ekle(alan(t('adim.varyantlar', 'Yanıt varyantları (her satır bir varyant; en az 10 önerilir)'), metinAlani({ name: 'texts', rows: 8, value: (a.texts || []).join('\n') }))); break;
    }
  }
  govdeCiz(adim.type);
  tipSec.onchange = () => govdeCiz(tipSec.value);
  f.append(alan(t('adim.tip', 'Adım tipi'), tipSec), govde);
  f.oku = () => {
    const v = (n) => f.querySelector(`[name="${n}"]`)?.value ?? '';
    const liste = (n) => v(n).split(',').map((s) => s.trim()).filter(Boolean);
    const sayi = (n) => (v(n) === '' ? undefined : Number(v(n)));
    const tip = tipSec.value;
    const a = { type: tip };
    if (['message', 'question', 'buttons', 'private_reply', 'note'].includes(tip)) a.text = v('text');
    if (tip === 'message' && v('media_url')) a.media = { tip: 'image', url: v('media_url') };
    if (['question', 'buttons', 'ai_reply', 'webhook'].includes(tip) && v('save_as')) a.save_as = v('save_as');
    if (tip === 'question') { if (v('validate') !== 'none') a.validate = v('validate'); if (v('retry_text')) a.retry_text = v('retry_text'); }
    if (tip === 'buttons' || tip === 'private_reply') {
      a.choices = [...f.querySelectorAll('[data-secenek]')].map((s) => { const g = (n) => s.querySelector(`[name="${n}"]`).value; const c = { label: g('c_label').trim() }; if (g('c_goto') !== '') c.goto = Number(g('c_goto')); const tg = g('c_tags').split(',').map((x) => x.trim()).filter(Boolean); if (tg.length) c.add_tags = tg; return c; }).filter((c) => c.label);
    }
    if (tip === 'delay') a.seconds = Number(v('seconds') || 0);
    if (tip === 'tag') { const ek = liste('add_tags'), sil = liste('remove_tags'); if (ek.length) a.add_tags = ek; if (sil.length) a.remove_tags = sil; }
    if (tip === 'goto') a.goto = sayi('goto');
    if (tip === 'condition') { const kind = v('kind'); a.check = { kind }; if (kind === 'tag') { for (const k of ['any', 'all', 'none']) { const l = liste('k_' + k); if (l.length) a.check[k] = l; } } if (kind === 'var') { a.check.name = v('k_name'); a.check.op = v('k_op'); a.check.value = v('k_value'); } if (kind === 'score') { a.check.op = v('k_op') === 'lt' ? 'lt' : 'gte'; a.check.value = Number(v('k_value') || 0); } if (kind === 'channel') a.check.in = liste('k_in'); a.then = sayi('then'); a.else = sayi('else'); }
    if (tip === 'ai_reply') { a.instruction = v('instruction'); a.max_chars = sayi('max_chars'); if (v('fallback_text')) a.fallback_text = v('fallback_text'); a.on_skip_goto = sayi('on_skip_goto'); if (a.on_skip_goto === undefined) delete a.on_skip_goto; }
    if (tip === 'score') { a.delta = Number(v('delta') || 0); a.reason = v('reason'); a.once_per = v('once_per'); }
    if (tip === 'webhook') { a.url = v('url'); a.method = v('method'); if (v('body')) a.body = v('body'); a.on_error_goto = sayi('on_error_goto'); if (a.on_error_goto === undefined) delete a.on_error_goto; }
    if (tip === 'comment_reply') a.texts = v('texts').split('\n').map((s) => s.trim()).filter(Boolean);
    return a;
  };
  return f;
}

function tetikFormu(tet, hesaplar, t) {
  const f = el('div', {},
    alan(t('tetik.tip', 'Tip'), secim(TETIKLEYICI_TIPLERI.map((k) => [k, `${TETIKLEYICI_BILGI[k].ad} (${TETIKLEYICI_BILGI[k].kanallar.join('/')})`]), { name: 'tip', value: tet.tip || 'keyword' })),
    alan(t('akis.hesap', 'Hesap'), secim([['', t('akis.tum', 'Tüm hesaplar')], ...hesaplar.map((h) => [h.id, `${h.ad} (${h.kanal})`])], { name: 'hesap_id', value: tet.hesap_id || '' })),
    alan(t('tetik.kelimeler', 'Anahtar kelimeler / ref kodları / payload (virgül)'), girdi({ name: 'kelimeler', value: (tet.anahtar_kelimeler || []).join(', ') })),
    alan(t('tetik.eslesme', 'Eşleşme'), secim([['contains', 'İçeren'], ['exact', 'Tam'], ['any', 'Herhangi']], { name: 'eslesme', value: tet.eslesme || 'contains' })),
    alan(t('tetik.gonderiler', 'Yalnız şu gönderiler (id, virgül; boş = tümü)'), girdi({ name: 'gonderiler', value: (tet.gonderi_idleri || []).join(', ') })),
    alan(t('tetik.yeniden', 'Aynı kişide yeniden başlatma (saniye; 0 = sınırsız)'), girdi({ name: 'yeniden', type: 'number', value: tet.yeniden_baslatma_sn ?? 3600 })),
  );
  f.oku = () => { const v = (n) => f.querySelector(`[name="${n}"]`).value; return { ...tet, tip: v('tip'), hesap_id: v('hesap_id') || null, anahtar_kelimeler: v('kelimeler').split(',').map((s) => s.trim()).filter(Boolean), eslesme: v('eslesme'), gonderi_idleri: v('gonderiler').split(',').map((s) => s.trim()).filter(Boolean), yeniden_baslatma_sn: Number(v('yeniden') || 0), aktif: tet.aktif ?? 1 }; };
  return f;
}

export default {
  baslik: 'Akış',
  async cizim(kok, ctx) {
    const { depo, t, git, modal, onayla } = ctx;
    temizle(kok);
    let akis = await depo.al('akislar', ctx.param.id);
    if (!akis) { kok.appendChild(el('p', { class: 'durum-hata' }, t('akis.yok', 'Akış bulunamadı.'))); return; }
    const hesaplar = await depo.listele('hesaplar');
    let sekme = ctx.param.sekme || 'adimlar';
    let kirli = false;
    const baslikGirdi = girdi({ value: akis.ad, 'aria-label': 'Akış adı', style: { fontSize: '1.2rem', fontWeight: '700' } });
    baslikGirdi.oninput = () => { akis.ad = baslikGirdi.value; kirli = true; };
    const durumRozet = el('span');
    const dogrulamaKutu = el('div', {});
    const govde = el('div', {});
    const sekmeler = el('div', { class: 'sekmeler', role: 'tablist' });
    const kaydetBtn = btn(t('genel.kaydet', 'Kaydet'), { class: 'btn btn--birincil', onclick: () => kaydet() });
    const yayinBtn = btn('', { onclick: () => yayinDegistir() });

    function durumYaz() { durumRozet.replaceChildren(rozet(akis.durum === 'yayinda' ? t('akis.yayinda', 'Yayında') : t('akis.taslak', 'Taslak'), akis.durum === 'yayinda' ? 'yesil' : 'gri')); yayinBtn.textContent = akis.durum === 'yayinda' ? t('akis.taslaga_al', 'Taslağa al') : t('akis.yayinla', 'Yayınla'); }
    async function dogrula(goster = true) {
      const tetler = await depo.listele('tetikleyiciler', { filtre: { akis_id: akis.id } });
      const r = adimlariDogrula(akis.adimlar, { kanal: akis.kanal, tetikleyiciTipleri: tetler.map((x) => x.tip) });
      const tum = await depo.listele('tetikleyiciler'); const akislar = Object.fromEntries((await depo.listele('akislar')).map((a) => [a.id, a]));
      const cak = cakismaBul(tum, { ...akislar, [akis.id]: { ...akis, durum: 'yayinda' } }).filter((c) => c.akislar.includes(akis.id));
      for (const c of cak) r.uyarilar.push(t('akis.cakisma', '"{k}" kelimesi başka bir yayında akışta da var: {a}', { k: c.kelime, a: akislar[c.akislar.find((x) => x !== akis.id)]?.ad }));
      if (!tetler.length) r.uyarilar.push(t('akis.tetik_yok', 'Tetikleyici yok: akış yalnız elle ya da başka akıştan başlatılabilir.'));
      if (goster) { temizle(dogrulamaKutu); if (r.hatalar.length) dogrulamaKutu.appendChild(el('div', { class: 'bant bant--kirmizi' }, el('ul', {}, ...r.hatalar.map((h) => el('li', {}, h))))); if (r.uyarilar.length) dogrulamaKutu.appendChild(el('div', { class: 'bant bant--sari' }, el('ul', {}, ...r.uyarilar.map((h) => el('li', {}, h))))); if (!r.hatalar.length && !r.uyarilar.length) dogrulamaKutu.appendChild(el('div', { class: 'bant bant--mavi' }, '✓ ' + t('akis.gecerli', 'Akış geçerli.'))); }
      return r;
    }
    async function kaydet(sessiz = false) {
      try { akis = await depo.kaydet('akislar', akis); kirli = false; if (!sessiz) ctx.basari(t('genel.kaydedildi', 'Kaydedildi')); }
      catch (e) { ctx.hata(e.message); }
    }
    async function yayinDegistir() {
      if (akis.durum === 'yayinda') { akis.durum = 'taslak'; await kaydet(); durumYaz(); return; }
      const r = await dogrula(true);
      if (r.hatalar.length) { ctx.hata(t('akis.yayin_hata', 'Yayınlamak için önce hataları düzelt.')); return; }
      akis.durum = 'yayinda'; akis.surum = (akis.surum || 0) + 1; akis.yayin_tarihi = new Date().toISOString(); await kaydet(); durumYaz(); ctx.basari(t('akis.yayinlandi', 'Akış yayında'));
    }
    async function adimDuzenle(i) {
      const f = adimFormu(akis.adimlar[i] || { type: 'message' }, akis.adimlar, i, t);
      const r = await modal({ baslik: `${t('adim.duzenle', 'Adım')} ${i + 1}`, govde: f, genis: true, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.tamam', 'Tamam'), sinif: 'btn--birincil', cb: () => f.oku() }] });
      if (r && typeof r === 'object') { akis.adimlar[i] = r; kirli = true; await kaydet(true); adimlariCiz(); }
    }
    async function adimEkle(sonra) {
      const f = adimFormu({ type: 'message', text: '' }, akis.adimlar, sonra + 1, t);
      const r = await modal({ baslik: t('adim.ekle', 'Adım ekle'), govde: f, genis: true, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.ekle', 'Ekle'), sinif: 'btn--birincil', cb: () => f.oku() }] });
      if (r && typeof r === 'object') { akis.adimlar.splice(sonra + 1, 0, r); hedefleriKaydir(sonra + 1, +1); kirli = true; await kaydet(true); adimlariCiz(); }
    }
    // Araya adım girince/silince sonraki hedef indeksleri kayar.
    function hedefleriKaydir(esik, delta) {
      const k = (v) => (Number.isInteger(v) && v >= esik ? v + delta : v);
      for (const a of akis.adimlar) { for (const alanAdi of ['goto', 'then', 'else', 'on_skip_goto', 'on_error_goto']) if (a[alanAdi] !== undefined) a[alanAdi] = k(a[alanAdi]); for (const c of a.choices || []) if (c.goto !== undefined) c.goto = k(c.goto); }
    }
    function adimlariCiz() {
      temizle(govde);
      const liste = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } });
      akis.adimlar.forEach((a, i) => {
        const o = adimOzeti(a);
        const dallar = [];
        if (a.goto !== undefined) dallar.push(`→ ${a.goto + 1}`);
        if (a.then !== undefined) dallar.push(`evet → ${a.then + 1} · hayır → ${a.else + 1}`);
        for (const c of a.choices || []) if (c.goto !== undefined) dallar.push(`${c.label} → ${c.goto + 1}`);
        liste.appendChild(el('div', { class: 'adim' }, el('div', { class: 'adim__no' }, String(i + 1)),
          el('div', { class: 'adim__govde', onclick: () => adimDuzenle(i), style: { cursor: 'pointer' } }, el('div', { class: 'adim__tur' }, `${o.simge} ${o.ad}`), el('div', { class: 'adim__ozet' }, o.metin || '—'), dallar.length ? el('div', { class: 'adim__dallar' }, dallar.join(' · ')) : null, a.choices?.length && !dallar.length ? el('div', { class: 'adim__dallar' }, a.choices.map((c) => c.label).join(' | ')) : null),
          el('div', { class: 'adim__eylemler' },
            btn('↑', { title: 'Yukarı', disabled: i === 0, onclick: () => { [akis.adimlar[i - 1], akis.adimlar[i]] = [akis.adimlar[i], akis.adimlar[i - 1]]; indeksDegistir(i, i - 1); kaydet(true); adimlariCiz(); } }),
            btn('↓', { title: 'Aşağı', disabled: i === akis.adimlar.length - 1, onclick: () => { [akis.adimlar[i + 1], akis.adimlar[i]] = [akis.adimlar[i], akis.adimlar[i + 1]]; indeksDegistir(i, i + 1); kaydet(true); adimlariCiz(); } }),
            btn('+', { title: t('adim.sonra_ekle', 'Altına ekle'), onclick: () => adimEkle(i) }),
            btn('⧉', { title: t('akis.cogalt', 'Çoğalt'), onclick: () => { akis.adimlar.splice(i + 1, 0, structuredClone(a)); hedefleriKaydir(i + 1, +1); kaydet(true); adimlariCiz(); } }),
            btn('✕', { title: t('genel.sil', 'Sil'), onclick: () => { akis.adimlar.splice(i, 1); hedefleriKaydir(i + 1, -1); kaydet(true); adimlariCiz(); } }))));
      });
      govde.append(liste, el('div', { class: 'satir', style: { marginTop: '12px' } }, btn('+ ' + t('adim.ekle', 'Adım ekle'), { class: 'btn btn--birincil', onclick: () => adimEkle(akis.adimlar.length - 1) }), btn('✓ ' + t('akis.dogrula', 'Doğrula'), { onclick: () => dogrula(true) })));
    }
    // İki adım yer değiştirince onlara işaret eden hedefler de değişir.
    function indeksDegistir(a, b) {
      const k = (v) => (v === a ? b : v === b ? a : v);
      for (const s of akis.adimlar) { for (const alanAdi of ['goto', 'then', 'else', 'on_skip_goto', 'on_error_goto']) if (s[alanAdi] !== undefined) s[alanAdi] = k(s[alanAdi]); for (const c of s.choices || []) if (c.goto !== undefined) c.goto = k(c.goto); }
    }
    async function tetikleyicileriCiz() {
      temizle(govde);
      const tetler = await depo.listele('tetikleyiciler', { filtre: { akis_id: akis.id } });
      const liste = el('div', { class: 'liste' });
      for (const x of tetler) {
        liste.appendChild(el('div', { class: 'liste__satir' }, el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, `${TETIKLEYICI_BILGI[x.tip]?.ad || x.tip}${x.hesap_id ? ' · ' + (hesaplar.find((h) => h.id === x.hesap_id)?.ad || '') : ''}`), el('div', { class: 'liste__alt' }, `${x.eslesme || 'contains'} · ${(x.anahtar_kelimeler || []).join(', ') || '—'} · ${t('tetik.yeniden_kisa', 'yeniden')}: ${x.yeniden_baslatma_sn || 0} sn`)),
          btn(x.aktif ? '⏸' : '▶', { class: 'btn btn--kucuk btn--ikon', title: x.aktif ? 'Duraklat' : 'Etkinleştir', onclick: async () => { await depo.kaydet('tetikleyiciler', { ...x, aktif: x.aktif ? 0 : 1 }); tetikleyicileriCiz(); } }),
          btn('✎', { class: 'btn btn--kucuk btn--ikon', title: t('genel.duzenle', 'Düzenle'), onclick: async () => { const f = tetikFormu(x, hesaplar, t); const r = await modal({ baslik: t('tetik.duzenle', 'Tetikleyici'), govde: f, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.kaydet', 'Kaydet'), sinif: 'btn--birincil', cb: () => f.oku() }] }); if (r && typeof r === 'object') { await depo.kaydet('tetikleyiciler', r); tetikleyicileriCiz(); } } }),
          btn('✕', { class: 'btn btn--kucuk btn--ikon', title: t('genel.sil', 'Sil'), onclick: async () => { await depo.sil('tetikleyiciler', x.id); tetikleyicileriCiz(); } })));
      }
      govde.append(liste.children.length ? liste : el('p', { class: 'kart__alt' }, t('akis.tetik_yok', 'Tetikleyici yok: akış yalnız elle ya da başka akıştan başlatılabilir.')),
        el('div', { class: 'satir', style: { marginTop: '12px' } }, btn('+ ' + t('tetik.ekle', 'Tetikleyici ekle'), { class: 'btn btn--birincil', disabled: tetler.length >= 4, onclick: async () => { const f = tetikFormu({ akis_id: akis.id }, hesaplar, t); const r = await modal({ baslik: t('tetik.ekle', 'Tetikleyici ekle'), govde: f, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.ekle', 'Ekle'), sinif: 'btn--birincil', cb: () => f.oku() }] }); if (r && typeof r === 'object') { await depo.kaydet('tetikleyiciler', r); tetikleyicileriCiz(); } } }), el('span', { class: 'kart__alt' }, t('tetik.en_fazla', 'En fazla 4 tetikleyici.'))));
    }
    function sekmeCiz() {
      temizle(sekmeler);
      for (const [k, ad] of [['adimlar', t('akis.adimlar', 'Adımlar')], ['tetikleyiciler', t('akis.tetikleyiciler', 'Tetikleyiciler')], ['test', t('akis.test', 'Test')]]) sekmeler.appendChild(el('button', { class: 'sekme', role: 'tab', 'aria-selected': String(sekme === k), onclick: () => { sekme = k; history.replaceState(null, '', `#/akis/${akis.id}${k === 'adimlar' ? '' : '/' + k}`); sekmeCiz(); } }, ad));
      if (sekme === 'adimlar') adimlariCiz(); else if (sekme === 'tetikleyiciler') tetikleyicileriCiz(); else { temizle(govde); simulator(govde, { akis, depo, t, kanal: akis.kanal || 'telegram' }); }
    }
    durumYaz();
    kok.append(
      el('div', { class: 'satir' }, btn('←', { class: 'btn btn--ikon btn--sade', 'aria-label': 'Geri', onclick: () => git('/akislar') }), el('h1', { style: { margin: 0, flex: 1 } }, baslikGirdi), durumRozet),
      el('div', { class: 'satir', style: { marginBottom: '12px' } }, kaydetBtn, yayinBtn, btn(t('akis.disa', 'JSON'), { onclick: () => { const blob = new Blob([JSON.stringify({ akis }, null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(blob); const l = document.createElement('a'); l.href = u; l.download = `${akis.ad}.json`; l.click(); } }), btn(t('genel.sil', 'Sil'), { class: 'btn btn--tehlike', onclick: async () => { if (await onayla(t('akis.sil_onay', '"{ad}" silinsin mi?', { ad: akis.ad }), { tehlikeli: true })) { await depo.sil('akislar', akis.id); git('/akislar'); } } })),
      dogrulamaKutu, sekmeler, govde,
    );
    sekmeCiz();
    return () => { if (kirli) kaydet(true); };
  },
};
