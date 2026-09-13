// Simülatör: akışı telefon çerçevesinde koşturur. Saf koşucuyu kullanır; hiçbir
// gönderim yapmaz. Koşu ve günlük `sanal:1` ile depoya yazılır ki Sohbetler ve
// Analitik "simülatör verisi" olarak gösterebilsin.
import { el, btn, btnS, temizle, girdi } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { baslat, ilerlet } from '../paylasilan/akis/kosucu.js';
import { pencereAcik } from '../paylasilan/kanallar.js';
import { ADIM_BILGI } from '../paylasilan/akis/adimlar.js';

export function simulator(kok, { akis, depo, t, kanal = 'telegram', tetikTipi = 'keyword', kisiAdi = null }) {
  kisiAdi = kisiAdi || t('sim.kisi', 'Deneme Kişi');
  temizle(kok);
  const durumSatiri = el('div', { class: 'satir satir--arasi kart__alt' });
  const ekran = el('div', { class: 'telefon__ekran', 'aria-live': 'polite' });
  const metin = girdi({ placeholder: t('sim.yaz', 'Bir mesaj yaz…'), 'aria-label': 'Mesaj' });
  const gonder = btn(simge('sag'), { class: 'btn btn--birincil btn--ikon', 'aria-label': t('sim.gonder', 'Gönder') });
  const atla = btnS('ileri', t('sim.atla', 'Gecikmeyi atla'), { class: 'btn btn--kucuk', hidden: true });
  const yeniden = btnS('yenile', t('sim.yeniden', 'Baştan'), { class: 'btn btn--kucuk' });
  const kanalSec = el('select', { class: 'input', 'aria-label': 'Kanal', style: { width: 'auto', minHeight: '32px' } }, ...['telegram', 'instagram', 'whatsapp'].map((k) => el('option', { value: k, selected: k === kanal }, k)));
  const tetikSec = el('select', { class: 'input', 'aria-label': 'Olay', style: { width: 'auto', minHeight: '32px' } }, ...[['keyword', t('sim.olay_dm', 'DM')], ['comment', t('sim.olay_yorum', 'Yorum')], ['start', '/start'], ['story_reply', t('sim.olay_story', 'Story yanıtı')]].map(([k, ad]) => el('option', { value: k, selected: k === tetikTipi }, ad)));
  const panel = el('div', { class: 'kod', style: { fontSize: '.75rem' } });
  kok.append(
    el('div', { class: 'satir' }, kanalSec, tetikSec, yeniden, atla),
    el('div', { class: 'telefon' }, ekran, el('form', { class: 'satir', onsubmit: (e) => { e.preventDefault(); metinGonder(); } }, metin, gonder)),
    durumSatiri,
    el('details', { class: 'katlanir' }, el('summary', {}, t('sim.panel', 'Değişkenler, etiketler, günlük')), panel),
  );

  let kosu = null, kisi = null, yorumSayaci = 0;
  const ctx = { simdi: () => new Date().toISOString(), pencereAcik: (k) => pencereAcik(k), ai: async (a) => a.fallback_text ? null : `[AI cevabı — Worker bağlı değil] ${a.instruction || ''}`.trim(), webhook: async () => ({ simulator: true }) };

  const balon = (text, tur, ek) => { const b = el('div', { class: `balon balon--${tur}` }, text || null); if (ek) b.appendChild(ek); ekran.appendChild(b); ekran.scrollTop = ekran.scrollHeight; return b; };
  // Sistem satırı: solda küçük simge, yanında metin. Simge adı verilmezse düz metin.
  const sistem = (m, ad) => { const b = balon('', 'sistem'); if (ad) b.appendChild(simge(ad, { boy: 14 })); b.appendChild(document.createTextNode(m)); return b; };

  async function gunluk(olay_tipi, ozet, karar) {
    try { await depo.kaydet('gunluk', { sanal: 1, zaman: new Date().toISOString(), kanal: kanalSec.value, hesap_id: akis.hesap_id || null, kisi_id: kisi?.id, akis_id: akis.id, olay_tipi, metin_ozeti: String(ozet).slice(0, 200), karar, prova: 1, gonderildi: 0 }); } catch {}
  }
  function paneliYaz() {
    panel.textContent = JSON.stringify({ adim: kosu?.adim, bekleme: kosu?.bekleme, durum: kosu?.durum, degiskenler: kosu?.degiskenler, etiketler: kisi?.etiketler, puan: kisi?.puan, iz: kosu?.adim_izi?.map((i) => i.adim).join('→') }, null, 1);
    durumSatiri.replaceChildren(el('span', {}, `${t('sim.adim', 'Adım')} ${kosu ? kosu.adim + 1 : '–'}/${akis.adimlar.length} · ${kosu?.durum || '—'}${kosu?.bekleme ? ' · ' + kosu.bekleme : ''}`), el('span', { class: 'satir' }, simge('yildiz', { boy: 13 }), String(kisi?.puan || 0), simge('etiket', { boy: 13 }), (kisi?.etiketler || []).join(', ') || '—'));
    atla.hidden = kosu?.bekleme !== 'delay';
  }
  function eylemleriCiz(eylemler) {
    for (const e of eylemler) {
      if (e.tip === 'mesaj') {
        let butonlar = null;
        if (e.choices?.length) butonlar = el('div', { class: 'balon__butonlar' }, ...e.choices.map((c) => btn(c.label, { onclick: () => butonBas(c, e.adim) })));
        { const b = balon('', 'giden', butonlar); if (e.kaynak === 'ai') b.insertBefore(simge('parilti', { boy: 14 }), b.firstChild); b.insertBefore(document.createTextNode(e.text), butonlar || null); }
      } else if (e.tip === 'yorum_yanit') balon(t('sim.yorum_yanit', 'Yoruma yanıt') + ': ' + e.text, 'giden');
      else if (e.tip === 'ozel_yanit') balon(t('sim.ozel', 'Yorum → DM') + ': ' + e.text, 'giden', e.choices?.length ? el('div', { class: 'balon__butonlar' }, ...e.choices.map((c) => btn(c.label, { onclick: () => butonBas(c, e.adim) }))) : null);
      else if (e.tip === 'gizle') sistem(t('sim.gizle', 'yorum gizlendi'), 'gozKapali');
      else if (e.tip === 'etiket') sistem(e.add ? '+' + e.add.join(', ') : '−' + e.remove.join(', '), 'etiket');
      else if (e.tip === 'puan') sistem(`${e.delta > 0 ? '+' : ''}${e.delta} (${e.reason})`, 'yildiz');
      else if (e.tip === 'bekle') sistem(`${e.saniye} sn ${t('sim.bekleniyor', 'bekleniyor')}`, 'saat');
      else if (e.tip === 'webhook') sistem(`webhook ${e.basarili ? 'ok' : 'hata: ' + e.hata}`, 'zincir');
      else if (e.tip === 'gunluk') sistem(e.mesaj, 'kalem');
    }
  }
  async function uygula(r, olay, ozet) {
    kosu = r.kosu; kisi = r.kisi; eylemleriCiz(r.eylemler); paneliYaz();
    await gunluk(olay, ozet, { tur: 'akis', akisId: akis.id, adim: kosu.adim, durum: kosu.durum });
    if (kosu.durum === 'finished') sistem(t('sim.bitti', 'akış bitti'), 'basari');
    if (kosu.durum === 'failed') sistem(kosu.hata || t('sim.hata', 'akış hata verdi'), 'hata');
  }
  async function basla() {
    temizle(ekran);
    kisi = { id: 'kisi_sanal', sanal: 1, ad: kisiAdi, kullanici_adi: kisiAdi.toLowerCase().replace(/\s+/g, '.'), kanal: kanalSec.value, etiketler: [], degiskenler: {}, puan: 0, son_gelen: tetikSec.value === 'comment' ? null : new Date().toISOString(), takip_ediyor: true };
    const olayTipi = tetikSec.value;
    const yorumId = olayTipi === 'comment' ? 'yorum_' + (++yorumSayaci) : undefined;
    sistem(`${t('sim.basladi', 'akış başladı')} · ${kanalSec.value} · ${olayTipi}`, 'oynat');
    if (olayTipi === 'comment') balon('fiyat?', 'gelen');
    const r = await baslat({ akis, kisi, hesap_id: akis.hesap_id || 'hes_sanal', tetik: olayTipi, baglam: yorumId ? { yorumId } : {} }, ctx);
    await uygula(r, olayTipi, 'başlat');
  }
  async function metinGonder() {
    const text = metin.value.trim(); if (!text) return; metin.value = '';
    balon(text, 'gelen');
    if (!kosu || kosu.durum !== 'waiting') { sistem(t('sim.bekleyen_yok', 'Akış beklemede değil; Baştan düğmesiyle yeniden başlat.'), 'bilgi'); return; }
    if (kisi) kisi.son_gelen = new Date().toISOString();
    const r = await ilerlet(kosu, kisi, { tur: kosu.bekleme === 'window' ? 'pencere' : 'metin', text }, ctx);
    if (kosu.bekleme === 'window' && r.kosu.bekleme !== 'window') { /* pencere açıldı */ }
    await uygula(r, 'dm', text);
  }
  async function butonBas(c, adim) {
    balon(c.label, 'gelen');
    if (!kosu || kosu.durum !== 'waiting') return;
    if (kisi) kisi.son_gelen = new Date().toISOString();
    const r = await ilerlet(kosu, kisi, { tur: 'buton', label: c.label, value: c.value, adim }, ctx);
    await uygula(r, 'buton', c.label);
  }
  atla.onclick = async () => { if (kosu?.bekleme !== 'delay') return; const r = await ilerlet(kosu, kisi, { tur: 'zaman' }, ctx); await uygula(r, 'zaman', 'gecikme atlandı'); };
  yeniden.onclick = basla; kanalSec.onchange = basla; tetikSec.onchange = basla;
  basla();
  return () => {};
}

export const adimOzeti = (a) => {
  const b = ADIM_BILGI[a.type] || { ad: a.type, ikon: 'bilgi' };
  const m = a.text || a.texts?.[0] || a.reason || a.url || (a.add_tags ? '+' + a.add_tags.join(', ') : '') || (a.remove_tags ? '−' + a.remove_tags.join(', ') : '') || (a.seconds !== undefined ? `${a.seconds} sn` : '') || (a.goto !== undefined ? `→ ${a.goto + 1}` : '') || (a.check ? `${a.check.kind} → evet ${a.then + 1} / hayır ${a.else + 1}` : '') || a.instruction || '';
  return { ...b, metin: m };
};
