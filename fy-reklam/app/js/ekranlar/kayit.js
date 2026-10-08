// Kayıt: kim, ne zaman, hangi ürünü, hangi kanaldan paylaştı. Bağlı kipte ortak kayıt (Worker) +
// bu cihazın kaydı birleştirilir; yerel kipte yalnız bu cihaz.
import { h, doldur, zamanMetni } from '../dom.js';
import { simge } from '../simge.js';
import { urunBul } from '../paylasilan/urunler.js';
import * as depo from '../depo.js';
import { kayitlar } from '../api.js';
import { dil } from '../i18n.js';
import { bosDurum } from './ortak.js';

const KANAL_SIMGE = { instagram: 'instagram', facebook: 'facebook', indir: 'indir', paylas: 'paylas', kopyala: 'kopyala', business_suite: 'harici' };
const DURUM_SINIF = { yayinlandi: 'chip--ok', prova: 'chip--uyari', hata: 'chip--hata', gonderiliyor: 'chip--secili', yapildi: '' };

export async function kayitEkrani(kap, a, ctx) {
  const { t } = ctx;
  const liste = h('div', { class: 'glass glass--sik' });
  const not = h('p', { class: 'g-note' });

  async function ciz() {
    const yerel = await depo.listele('kayit', 200);
    let ortak = [];
    if (ctx.kip === 'bagli') {
      try { ortak = (await kayitlar(200)).kayitlar || []; not.textContent = t('kayit.ortak_not'); } catch { not.textContent = t('kayit.ortak_okunamadi'); }
    } else not.textContent = t('kayit.yerel_not');
    // Aynı eylem iki kaynakta da olabilir (yerel + ortak): zaman ve kanal yakınsa biri gösterilir.
    const hepsi = [...ortak.map((k) => ({ ...k, kaynak: 'ortak' })), ...yerel.map((k) => ({ ...k, kaynak: 'yerel' }))]
      .sort((x, y) => (x.zaman < y.zaman ? 1 : -1));
    // Sunucu zamanı sayı (epoch ms), bu cihazınki ISO metni; SQLite biçimi («YYYY-MM-DD HH:MM:SS», UTC) de olabilir.
    const an = (z) => {
      if (typeof z === 'number') return z < 1e12 ? z * 1000 : z;
      const m = String(z || '').trim();
      if (/^\d+$/.test(m)) return an(Number(m));
      return Date.parse(/[zZ]$|[+-]\d\d:\d\d$/.test(m) ? m : m.replace(' ', 'T') + 'Z');
    };
    const tekil = [];
    for (const k of hepsi) {
      const es = tekil.find((x) => (k.dis_id && x.dis_id === k.dis_id) || (x.kanal === k.kanal && x.urun === k.urun && Math.abs(an(x.zaman) - an(k.zaman)) < 60_000));
      if (!es) tekil.push(k);
    }
    if (!tekil.length) { doldur(liste, bosDurum({ simgeAdi: 'kayit', baslik: t('kayit.bos'), aciklama: t('kayit.bos_aciklama') })); return; }
    doldur(liste, ...tekil.slice(0, 200).map((k) => {
      const u = urunBul(k.urun);
      return h('div', { class: 'kayit' },
        h('span', { class: 'icon-box', style: { width: '40px', height: '40px', color: u ? u.renk : undefined } }, simge(KANAL_SIMGE[k.kanal] || 'paylas', { boyut: 18 })),
        h('div', { class: 'sutun', style: { gap: '2px' } },
          h('span', { class: 'satir', style: { gap: '8px' } }, h('b', {}, u?.ad || k.urun), h('span', { class: 'soluk kucuk' }, t(`kanal_eylem.${k.kanal}`, {}, k.kanal)), k.durum && k.durum !== 'yapildi' ? h('span', { class: ['chip', DURUM_SINIF[k.durum] || ''] }, t(`kayit_durum.${k.durum}`, {}, k.durum)) : null),
          h('span', { class: 'kart__alt' }, [k.baslik, k.kim, k.hata ? t(`yayin_hata.${k.hata}`, {}, k.hata) : ''].filter(Boolean).join(' · '))),
        h('span', { class: 'kayit__zaman' }, zamanMetni(new Date(an(k.zaman)).toISOString(), dil())));
    }));
  }

  doldur(kap,
    h('header', { class: 'g-head g-head--yan' },
      h('div', {}, h('p', { class: 'eyebrow' }, t('kayit.ust')), h('h1', { style: { marginTop: '10px' } }, t('kayit.baslik'))),
      h('p', {}, t('kayit.aciklama'))),
    not, liste);
  ciz();
}
