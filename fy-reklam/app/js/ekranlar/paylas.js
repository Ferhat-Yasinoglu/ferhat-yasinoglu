// Paylaş: son görsel JPEG olarak üretilir; indir, telefonun paylaşım menüsü, metni kopyala,
// Business Suite'te aç. Worker bağlıysa Instagram'a / Facebook'a doğrudan yayınla (PROVA etiketiyle).
// Her eylem kayda yazılır: bu cihaza (IndexedDB) ve bağlıysa ortak kayda (Worker).
import { h, doldur, kopyala, indir, bildir } from '../dom.js';
import { simge } from '../simge.js';
import { urunBul, metin as urunMetni } from '../paylasilan/urunler.js';
import { birlestir, denetle } from '../paylasilan/metin.js';
import { BICIMLER, svgUret, jpegUret } from '../sablon/cizim.js';
import * as depo from '../depo.js';
import { kayitYaz, gorselYukle, yayinla, kanallar, SunucuHatasi } from '../api.js';
import { BUSINESS_SUITE } from '../ayar.js';
import { adimGostergesi, kanalCipi } from './ortak.js';
import { varsayilanGonderi } from './metin.js';

const KANAL_SIMGE = { instagram: 'instagram', facebook: 'facebook' };

export async function paylasEkrani(kap, a, ctx) {
  const { t, git } = ctx;
  const taslak = await depo.al('taslaklar', a.yol[1]);
  if (!taslak) { git('#/taslaklar'); return; }
  const urun = urunBul(taslak.urun);
  if (!urun) { git('#/projeler'); return; }
  const g = taslak.gonderi || varsayilanGonderi(urun, taslak.dil);
  const metin = birlestir(g);
  const d = denetle(g);
  const bicim = BICIMLER[taslak.bicim] || BICIMLER.dikey;
  const dosyaAdi = `fy-${urun.anahtar}-${taslak.dil}-${taslak.bicim}.jpg`;

  // --- görsel --------------------------------------------------------------------
  const onizleme = h('div', { class: ['onizleme', `onizleme--${taslak.bicim}`, 'onizleme--yukleniyor'] });
  const boyutNotu = h('p', { class: 'g-note' }, t('paylas.uretiliyor'));
  let jpeg = null;
  let jpegUrl = null;
  async function uret() {
    try {
      const svg = await svgUret(taslak, urun, { gomulu: true });
      jpeg = await jpegUret(svg, bicim);
      jpegUrl = URL.createObjectURL(jpeg);
      onizleme.className = `onizleme onizleme--${taslak.bicim}`;
      doldur(onizleme, h('img', { src: jpegUrl, alt: t('paylas.gorsel_alt', { urun: urun.ad }), width: bicim.w, height: bicim.h }));
      boyutNotu.textContent = t('paylas.gorsel_bilgi', { w: bicim.w, h: bicim.h, kb: Math.round(jpeg.size / 1024) });
      for (const b of eylemDugmeleri) b.disabled = false;
    } catch (e) {
      onizleme.classList.remove('onizleme--yukleniyor');
      doldur(onizleme, h('p', { class: 'denetim__oge denetim__oge--hata', style: { padding: '16px' } }, simge('uyari'), String(e.message || e)));
      boyutNotu.textContent = '';
    }
  }

  // --- kayıt --------------------------------------------------------------------
  async function kaydaYaz(kanal, { durum = 'yapildi', dis_id = '', hata = '' } = {}) {
    const k = { urun: urun.anahtar, kanal, bicim: taslak.bicim, dil: taslak.dil, baslik: (taslak.baslik || urun.ad).replace(/\*/g, ''), durum, dis_id, hata, kim: ctx.kullanici?.eposta || '', zaman: new Date().toISOString(), taslak: taslak.id };
    await depo.kaydet('kayit', k);
    if (ctx.kip === 'bagli' && ['indir', 'paylas', 'kopyala', 'business_suite'].includes(kanal)) {
      try { await kayitYaz({ urun: k.urun, kanal, bicim: k.bicim, baslik: k.baslik }); } catch { /* ortak kayıt yazılamadı; yerel kayıt duruyor */ }
    }
    if (taslak.durum === 'taslak') { taslak.durum = 'paylasildi'; await depo.kaydet('taslaklar', taslak); }
  }

  // --- eylemler ------------------------------------------------------------------
  const indirDugmesi = h('button', { class: 'btn btn--birincil', type: 'button', disabled: true, onclick: async () => { indir(jpeg, dosyaAdi); await kaydaYaz('indir'); bildir(t('paylas.indirildi'), 'basari'); } }, simge('indir', { boyut: 18 }), t('paylas.indir'));
  const paylasDugmesi = h('button', { class: 'btn btn--hayalet', type: 'button', disabled: true, onclick: async () => {
    const dosya = new File([jpeg], dosyaAdi, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [dosya] })) {
      try { await navigator.share({ files: [dosya], text: metin, title: urun.ad }); await kaydaYaz('paylas'); } catch (e) { if (e?.name !== 'AbortError') bildir(t('paylas.paylasilamadi'), 'hata'); }
    } else bildir(t('paylas.paylasim_yok'), 'hata');
  } }, simge('paylas', { boyut: 18 }), t('paylas.paylas'));
  const kopyalaDugmesi = h('button', { class: 'btn btn--hayalet', type: 'button', onclick: async () => { const ok = await kopyala(metin); if (ok) await kaydaYaz('kopyala'); bildir(ok ? t('metin.kopyalandi') : t('metin.kopyalanamadi'), ok ? 'basari' : 'hata'); } }, simge('kopyala', { boyut: 18 }), t('metin.kopyala'));
  const suiteDugmesi = h('a', { class: 'btn btn--hayalet', href: BUSINESS_SUITE, target: '_blank', rel: 'noopener', onclick: () => { kaydaYaz('business_suite'); } }, simge('harici', { boyut: 18 }), t('paylas.business_suite'));
  const eylemDugmeleri = [indirDugmesi, paylasDugmesi];

  // --- doğrudan yayınlama (Worker bağlıysa) -----------------------------------------
  const yayinKutusu = h('div', { class: 'sutun' });
  async function yayinKutusunuDoldur() {
    if (ctx.kip !== 'bagli') {
      doldur(yayinKutusu, h('p', { class: 'kart__alt' }, t('paylas.yayin_yerel')));
      return;
    }
    let k;
    try { k = await kanallar(); } catch { doldur(yayinKutusu, h('p', { class: 'kart__alt' }, t('paylas.kanal_okunamadi'))); return; }
    const satir = (kanal, bilgi) => {
      const acik = bilgi.bagli;
      const durumu = !acik ? 'kapali' : (k.prova ? 'prova' : 'calisir');
      const dugme = h('button', { class: 'btn btn--kucuk btn--birincil', type: 'button', disabled: !acik || !jpeg || d.hatalar.length > 0, onclick: () => yayinla_(kanal, dugme) }, simge(KANAL_SIMGE[kanal], { boyut: 16 }), t(`paylas.yayinla_${kanal}`));
      if (!jpeg) eylemDugmeleri.push(dugme);
      return h('div', { class: 'satir satir--arasi', style: { padding: '10px 0', borderBlockEnd: '1px solid rgb(var(--line) / .06)' } },
        h('span', { class: 'satir' }, simge(KANAL_SIMGE[kanal], { boyut: 20 }), h('b', {}, t(`kanal_ad.${kanal}`)), kanalCipi(durumu, t)),
        dugme);
    };
    doldur(yayinKutusu,
      satir('instagram', k.instagram), satir('facebook', k.facebook),
      k.prova ? h('p', { class: 'g-note' }, t('paylas.prova_not')) : null,
      k.instagram?.kota ? h('p', { class: 'g-note' }, t('paylas.kota', { k: k.instagram.kota.kullanilan, s: k.instagram.kota.sinir })) : null);
  }

  async function yayinla_(kanal, dugme) {
    if (!confirm(t('paylas.yayinla_onay', { kanal: t(`kanal_ad.${kanal}`) }))) return;
    dugme.disabled = true;
    const eski = dugme.textContent;
    dugme.replaceChildren(h('span', { class: 'donen', style: { width: '16px', height: '16px' } }), ' ', t('paylas.yayinlaniyor'));
    try {
      const y = await gorselYukle(jpeg);
      const altMetin = `${urun.ad}: ${urunMetni(urun, 'ozet', taslak.dil)}`.slice(0, 1000); // Instagram alt_text (erişilebilirlik, ≤1000)
      const govde = { kanal, gorseller: [y.id], metin, altMetin, urun: urun.anahtar, baslik: (taslak.baslik || urun.ad).replace(/\*/g, '') };
      let sonuc;
      try { sonuc = await yayinla(govde); } catch (e) {
        // Aynı metin son 24 saatte bu kanalda yayınlanmış: sunucu 409 döner; kullanıcı bilerek istiyorsa zorlanır.
        if (e instanceof SunucuHatasi && e.kod === 'tekrar' && confirm(t('paylas.tekrar_onay'))) sonuc = await yayinla({ ...govde, zorla: true });
        else throw e;
      }
      await kaydaYaz(kanal, { durum: sonuc.sonuc?.prova ? 'prova' : 'yayinlandi', dis_id: sonuc.sonuc?.dis_id || '' });
      taslak.durum = 'yayinlandi'; await depo.kaydet('taslaklar', taslak);
      bildir(sonuc.sonuc?.prova ? t('paylas.prova_tamam') : t('paylas.yayinlandi', { kanal: t(`kanal_ad.${kanal}`) }), 'basari');
    } catch (e) {
      const kod = e instanceof SunucuHatasi ? (e.veri?.kod || e.kod) : 'ag';
      await kaydaYaz(kanal, { durum: 'hata', hata: kod });
      bildir(t(`yayin_hata.${kod}`, {}, t('yayin_hata.meta')), 'hata');
    } finally {
      dugme.disabled = false;
      dugme.replaceChildren(simge(KANAL_SIMGE[kanal], { boyut: 16 }), ' ', eski.trim());
    }
  }

  doldur(kap,
    h('header', { class: 'g-head' },
      h('div', { class: 'g-head__ust' },
        h('a', { class: 'btn btn--ikon btn--sade', href: `#/metin/${taslak.id}`, 'aria-label': t('geri') }, simge('geri')),
        h('span', { class: 'icon-box icon-box--renk', style: { '--renk': urun.renk, width: '36px', height: '36px' } }, simge(urun.simge, { boyut: 18 })),
        h('h1', { style: { fontSize: 'var(--fs-h2)' } }, t('paylas.baslik')),
        h('span', { class: 'sag' }, adimGostergesi(3, t))),
      h('p', {}, t('paylas.aciklama'))),
    h('div', { class: 'iki-sutun' },
      h('div', { class: 'sutun', style: { gap: 'var(--space-5)' } },
        onizleme, boyutNotu,
        h('div', { class: 'dugmeler' }, indirDugmesi, paylasDugmesi, kopyalaDugmesi, suiteDugmesi),
        h('p', { class: 'g-note' }, t('paylas.elle_not'))),
      h('div', { class: 'sutun' },
        h('div', { class: 'glass' }, h('p', { class: 'eyebrow eyebrow--xs', style: { marginBottom: '12px' } }, t('paylas.metin')), h('div', { class: 'metin-onizleme', dir: 'auto' }, metin),
          d.hatalar.length ? h('p', { class: 'denetim__oge denetim__oge--hata', style: { marginTop: '12px' } }, simge('uyari'), t('paylas.metin_hatali')) : null),
        h('div', { class: 'glass glass--sik' }, h('p', { class: 'eyebrow eyebrow--xs', style: { marginBottom: '8px' } }, t('paylas.dogrudan')), yayinKutusu))));

  uret();
  yayinKutusunuDoldur();
}
