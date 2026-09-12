// Kişiler & Puanlar: kişi listesi, etiketler, puan kuralları, liderlik tablosu, CSV.
import { el, btn, kart, rozet, temizle, girdi, secim, alan, goreliZaman } from '../cekirdek/dom.js';
import { bos } from '../cekirdek/durum.js';
import { normalize } from '../paylasilan/metin.js';
import { pencereAcik } from '../paylasilan/kanallar.js';

export function csvYap(satirlar, alanlar) {
  const kacir = (v) => { const s = v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [alanlar.join(','), ...satirlar.map((r) => alanlar.map((a) => kacir(r[a])).join(','))].join('\n');
}
export function csvOku(metin) {
  const satirlar = []; let alan = '', satir = [], tirnak = false;
  for (let i = 0; i < metin.length; i++) {
    const c = metin[i];
    if (tirnak) { if (c === '"' && metin[i + 1] === '"') { alan += '"'; i++; } else if (c === '"') tirnak = false; else alan += c; }
    else if (c === '"') tirnak = true; else if (c === ',' || c === ';') { satir.push(alan); alan = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && metin[i + 1] === '\n') i++; satir.push(alan); satirlar.push(satir); satir = []; alan = ''; } else alan += c;
  }
  if (alan || satir.length) { satir.push(alan); satirlar.push(satir); }
  const [baslik, ...govde] = satirlar.filter((s) => s.some((x) => x.trim()));
  return govde.map((s) => Object.fromEntries(baslik.map((b, i) => [b.trim(), (s[i] || '').trim()])));
}

export default {
  baslik: 'Kişiler',
  async cizim(kok, ctx) {
    const { depo, t, git, modal, onayla, sor } = ctx;
    temizle(kok);
    let sekme = ctx.param.sekme || 'kisiler';
    const sekmeler = el('div', { class: 'sekmeler' });
    const govde = el('div', {});
    for (const [k, ad] of [['kisiler', t('kisiler.kisiler', 'Kişiler')], ['etiketler', t('kisiler.etiketler', 'Etiketler')], ['puanlar', t('kisiler.puanlar', 'Puanlar')]]) sekmeler.appendChild(el('button', { class: 'sekme', 'aria-selected': String(sekme === k), onclick: (e) => { sekme = k; [...sekmeler.children].forEach((x) => x.setAttribute('aria-selected', String(x === e.currentTarget))); history.replaceState(null, '', `#/kisiler${k === 'kisiler' ? '' : '/' + k}`); ciz(); } }, ad));
    kok.append(el('h1', {}, t('nav.kisiler', 'Kişiler & Puanlar')), sekmeler, govde);

    async function kisilerCiz() {
      temizle(govde);
      const etiketler = await depo.listele('etiketler');
      const arama = girdi({ type: 'search', placeholder: t('kisiler.ara', 'Ad, kullanıcı adı…') });
      const kanal = secim([['', t('akislar.tum_kanallar', 'Tüm kanallar')], ['telegram', 'Telegram'], ['instagram', 'Instagram'], ['whatsapp', 'WhatsApp']]);
      const etiket = secim([['', t('kisiler.tum_etiketler', 'Tüm etiketler')], ...etiketler.map((e) => [e.ad, e.ad])]);
      const pencere = el('label', { class: 'cip' }, el('input', { type: 'checkbox' }), ' ' + t('kisiler.pencere_acik', 'penceresi açık'));
      const liste = el('div', { class: 'liste' });
      const secili = new Set();
      const topluBar = el('div', { class: 'satir', hidden: true });
      async function listele() {
        temizle(liste); secili.clear(); topluBar.hidden = true;
        let kisiler = await depo.listele('kisiler', { sirala: 'son_gelen', azalan: true });
        const q = normalize(arama.value);
        kisiler = kisiler.filter((k) => (!q || normalize(`${k.ad} ${k.kullanici_adi || ''}`).includes(q)) && (!kanal.value || k.kanal === kanal.value) && (!etiket.value || (k.etiketler || []).includes(etiket.value)) && (!pencere.firstChild.checked || pencereAcik(k)));
        if (!kisiler.length) { liste.appendChild(bos({ simge: '👥', baslik: t('kisiler.bos', 'Kişi yok'), aciklama: t('kisiler.bos_aciklama', 'Botuna ilk mesaj gelince burada görünür; yerel modda elle ekleyebilir ya da CSV alabilirsin.') })); return; }
        for (const k of kisiler) {
          const cb = el('input', { type: 'checkbox', 'aria-label': 'Seç', onchange: (e) => { e.target.checked ? secili.add(k.id) : secili.delete(k.id); topluBar.hidden = secili.size === 0; } });
          liste.appendChild(el('div', { class: 'liste__satir' }, cb, el('div', { class: 'avatar' }, (k.ad || '?').slice(0, 1).toUpperCase()), el('a', { class: 'liste__govde', href: `#/kisi/${k.id}`, style: { textDecoration: 'none', color: 'inherit' } }, el('div', { class: 'liste__baslik' }, `${k.ad || k.kullanici_adi || k.dis_id}${k.demo ? ' · demo' : ''}`), el('div', { class: 'liste__alt' }, `${k.kanal} · ${(k.etiketler || []).join(', ') || '—'} · ⭐ ${k.puan || 0}`)), el('div', { style: { textAlign: 'end' } }, el('div', { class: 'kart__alt' }, goreliZaman(k.son_gelen, t)), pencereAcik(k) ? rozet('✅', 'yesil') : rozet('❌', 'gri'))));
        }
      }
      topluBar.append(btn(t('kisiler.etiket_ekle', 'Etiket ekle'), { class: 'btn btn--kucuk', onclick: async () => { const e = await sor(t('kisiler.etiket_adi', 'Etiket adı')); if (!e) return; for (const id of secili) { const k = await depo.al('kisiler', id); if (k && !(k.etiketler || []).includes(e)) await depo.kaydet('kisiler', { ...k, etiketler: [...(k.etiketler || []), e] }); } listele(); } }),
        btn(t('kisiler.etiket_kaldir', 'Etiket kaldır'), { class: 'btn btn--kucuk', onclick: async () => { const e = await sor(t('kisiler.etiket_adi', 'Etiket adı')); if (!e) return; for (const id of secili) { const k = await depo.al('kisiler', id); if (k) await depo.kaydet('kisiler', { ...k, etiketler: (k.etiketler || []).filter((x) => x !== e) }); } listele(); } }),
        btn(t('kisiler.topluya', 'Toplu mesaja gönder'), { class: 'btn btn--kucuk', onclick: () => { sessionStorage.setItem('ss-secili-kisiler', JSON.stringify([...secili])); git('/toplu/yeni'); } }));
      const disa = btn('⬇ CSV', { class: 'btn btn--kucuk', onclick: async () => { const kisiler = await depo.listele('kisiler'); const csv = csvYap(kisiler.map((k) => ({ ...k, etiketler: (k.etiketler || []).join('|'), degiskenler: JSON.stringify(k.degiskenler || {}) })), ['id', 'kanal', 'dis_id', 'ad', 'kullanici_adi', 'etiketler', 'puan', 'son_gelen', 'degiskenler']); const b = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }); const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = 'kisiler.csv'; l.click(); } });
      const ice = el('label', { class: 'btn btn--kucuk' }, '⬆ CSV', el('input', { type: 'file', accept: '.csv,text/csv', hidden: true, onchange: async (e) => { const f = e.target.files[0]; if (!f) return; const satirlar = csvOku(await f.text()); let n = 0; for (const s of satirlar) { if (!s.ad && !s.kullanici_adi && !s.dis_id) continue; await depo.kaydet('kisiler', { hesap_id: s.hesap_id || 'hes_yerel', kanal: s.kanal || 'telegram', dis_id: s.dis_id || s.kullanici_adi || String(Date.now() + n), ad: s.ad || s.kullanici_adi, kullanici_adi: s.kullanici_adi || '', etiketler: (s.etiketler || '').split('|').map((x) => x.trim()).filter(Boolean), puan: Number(s.puan || 0), degiskenler: {}, kaynak: 'csv' }); n++; } ctx.basari(t('kisiler.ice_aktarildi', '{n} kişi alındı', { n })); listele(); } }));
      const ekle = btn('+ ' + t('kisiler.ekle', 'Kişi ekle'), { class: 'btn btn--birincil btn--kucuk', onclick: async () => { const f = el('div', {}, alan('Ad', girdi({ name: 'ad' })), alan('Kullanıcı adı', girdi({ name: 'kullanici_adi' })), alan('Kanal', secim([['telegram', 'Telegram'], ['instagram', 'Instagram'], ['whatsapp', 'WhatsApp']], { name: 'kanal' })), alan('Etiketler (virgül)', girdi({ name: 'etiketler' }))); const r = await modal({ baslik: t('kisiler.ekle', 'Kişi ekle'), govde: f, dugmeler: [{ metin: t('genel.vazgec', 'Vazgeç'), deger: null }, { metin: t('genel.ekle', 'Ekle'), sinif: 'btn--birincil', cb: () => { const v = (n) => f.querySelector(`[name=${n}]`).value.trim(); return v('ad') ? { ad: v('ad'), kullanici_adi: v('kullanici_adi'), kanal: v('kanal'), etiketler: v('etiketler').split(',').map((x) => x.trim()).filter(Boolean) } : false; } }] }); if (r && typeof r === 'object') { await depo.kaydet('kisiler', { ...r, hesap_id: 'hes_yerel', dis_id: 'yerel_' + Date.now(), degiskenler: {}, puan: 0, kaynak: 'elle', son_gelen: new Date().toISOString() }); listele(); } } });
      govde.append(el('div', { class: 'satir' }, arama, kanal, etiket, pencere), el('div', { class: 'satir', style: { margin: '8px 0' } }, ekle, disa, ice), topluBar, liste);
      arama.oninput = listele; kanal.onchange = listele; etiket.onchange = listele; pencere.firstChild.onchange = listele;
      await listele();
    }
    async function etiketlerCiz() {
      temizle(govde);
      const etiketler = await depo.listele('etiketler', { sirala: 'ad' });
      const kisiler = await depo.listele('kisiler');
      const liste = el('div', { class: 'liste' });
      for (const e of etiketler) {
        const n = kisiler.filter((k) => (k.etiketler || []).includes(e.ad)).length;
        liste.appendChild(el('div', { class: 'liste__satir' }, rozet(e.ad, e.renk || 'gri'), el('div', { class: 'liste__govde' }, el('div', { class: 'liste__alt' }, `${n} ${t('kisiler.kisi', 'kişi')}${e.sistem ? ' · ' + t('kisiler.sistem', 'sistem') : ''}`)),
          btn('✎', { class: 'btn btn--kucuk btn--ikon', disabled: !!e.sistem, onclick: async () => { const yeni = await sor(t('kisiler.yeniden_adlandir', 'Yeni ad'), { varsayilan: e.ad }); if (!yeni || yeni === e.ad) return; await depo.kaydet('etiketler', { ...e, ad: yeni }); for (const k of kisiler) if ((k.etiketler || []).includes(e.ad)) await depo.kaydet('kisiler', { ...k, etiketler: k.etiketler.map((x) => (x === e.ad ? yeni : x)) }); etiketlerCiz(); } }),
          btn('✕', { class: 'btn btn--kucuk btn--ikon', disabled: !!e.sistem, onclick: async () => { if (await onayla(t('kisiler.etiket_sil', '"{ad}" etiketi {n} kişiden kaldırılacak.', { ad: e.ad, n }), { tehlikeli: true })) { await depo.sil('etiketler', e.id); for (const k of kisiler) if ((k.etiketler || []).includes(e.ad)) await depo.kaydet('kisiler', { ...k, etiketler: k.etiketler.filter((x) => x !== e.ad) }); etiketlerCiz(); } } })));
      }
      govde.append(btn('+ ' + t('kisiler.etiket_yeni', 'Etiket'), { class: 'btn btn--birincil btn--kucuk', onclick: async () => { const ad = await sor(t('kisiler.etiket_adi', 'Etiket adı')); if (ad) { await depo.kaydet('etiketler', { ad: ad.trim(), renk: ['altin', 'mavi', 'yesil', 'mor', 'sari'][etiketler.length % 5] }); etiketlerCiz(); } } }), el('div', { style: { height: '8px' } }), liste);
    }
    async function puanlarCiz() {
      temizle(govde);
      const kurallar = await depo.listele('puan_kurallari');
      const kisiler = (await depo.listele('kisiler')).sort((a, b) => (b.puan || 0) - (a.puan || 0)).slice(0, 50);
      const tablo = el('table', { class: 'tablo' }, el('thead', {}, el('tr', {}, el('th', {}, t('puan.olay', 'Olay')), el('th', {}, t('puan.puan', 'Puan')), el('th', {}, t('puan.tavan', 'Günlük tavan')), el('th', {}, ''))),
        el('tbody', {}, ...kurallar.map((k) => el('tr', {}, el('td', {}, k.olay), el('td', {}, girdi({ type: 'number', value: k.puan, style: { width: '80px' }, onchange: (e) => depo.kaydet('puan_kurallari', { ...k, puan: Number(e.target.value) }) })), el('td', {}, girdi({ type: 'number', value: k.gunlukTavan, style: { width: '80px' }, onchange: (e) => depo.kaydet('puan_kurallari', { ...k, gunlukTavan: Number(e.target.value) }) })), el('td', {}, el('input', { type: 'checkbox', checked: !!k.aktif, onchange: (e) => depo.kaydet('puan_kurallari', { ...k, aktif: e.target.checked ? 1 : 0 }) }))))));
      const liderlik = el('ol', { class: 'liste', style: { padding: 0, margin: 0, listStyle: 'none' } }, ...kisiler.map((k, i) => el('li', { class: 'liste__satir' }, el('span', { class: 'avatar' }, String(i + 1)), el('div', { class: 'liste__govde' }, el('div', { class: 'liste__baslik' }, k.ad || k.kullanici_adi), el('div', { class: 'liste__alt' }, k.kanal)), el('strong', {}, `⭐ ${k.puan || 0}`))));
      const png = btn('🖼️ ' + t('puan.png', 'Liderlik tablosunu PNG indir'), { class: 'btn btn--kucuk', onclick: () => liderlikPng(kisiler.slice(0, 10)) });
      govde.append(el('h2', {}, t('puan.kurallar', 'Puan kuralları')), el('div', { class: 'tablo-kap' }, tablo), el('h2', {}, t('puan.liderlik', 'Liderlik tablosu')), png, el('div', { style: { height: '8px' } }), kisiler.length ? liderlik : el('p', { class: 'kart__alt' }, t('puan.bos', 'Henüz puan yok.')));
    }
    function liderlikPng(liste) {
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d');
      g.fillStyle = '#111014'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#f6d678'; g.font = 'bold 72px sans-serif'; g.fillText(t('puan.liderlik', 'Liderlik tablosu'), 80, 160);
      g.font = '44px sans-serif';
      liste.forEach((k, i) => { g.fillStyle = i < 3 ? '#f6d678' : '#f4f1eb'; g.fillText(`${i + 1}.  ${(k.ad || k.kullanici_adi || '').slice(0, 22)}`, 80, 300 + i * 96); g.textAlign = 'end'; g.fillText(`⭐ ${k.puan || 0}`, 1000, 300 + i * 96); g.textAlign = 'start'; });
      g.fillStyle = '#7a7670'; g.font = '32px sans-serif'; g.fillText('Sosyal Stüdyo', 80, 1280);
      c.toBlob((b) => { const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = 'liderlik.png'; l.click(); }, 'image/png');
    }
    function ciz() { if (sekme === 'kisiler') kisilerCiz(); else if (sekme === 'etiketler') etiketlerCiz(); else puanlarCiz(); }
    ciz();
  },
};
