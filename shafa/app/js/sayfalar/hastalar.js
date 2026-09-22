// Hastalar: kayıt listesi, arama ve hasta kartı ekleme/düzenleme.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, rozet, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { tarihSecici } from '../cekirdek/tarih-secici.js';
import { CINSIYETLER, KAN_GRUPLARI, SIGORTALAR, tamAd, hastaYasi, hastaAra, bosHasta, hastaDogrula, listeyeCevir, tcGecerli } from '../paylasilan/hasta.js';
import { basHarfler } from '../paylasilan/metin.js';
import { t, secenekleriCevir } from '../i18n.js';
import { dogrulaMetni, hataMetni } from '../hatalar.js';

/** Hasta rozetleri: alerji ve kronik hastalık tek bakışta görünsün. */
export function hastaRozetleri(h) {
  const r = [];
  for (const a of h.alerjiler || []) r.push(rozet(a, 'kirmizi', { title: t('hasta.alerji', 'Alerji') }));
  for (const k of (h.kronikHastaliklar || []).slice(0, 2)) r.push(rozet(k, 'mavi'));
  if (h.ornek) r.push(rozet(t('genel.ornek', 'örnek'), 'mor'));
  return r;
}

export async function hastaKutusu(ctx, mevcut = null) {
  const { depo, modal, basari, hata, uyar } = ctx;
  let deger = { ...bosHasta(), ...(mevcut || {}) };
  const govde = el('div', {});

  function ciz(hatalar = {}) {
    temizle(govde);
    const g = {
      ad: girdi({ name: 'ad', value: deger.ad, autocomplete: 'off' }),
      soyad: girdi({ name: 'soyad', value: deger.soyad, autocomplete: 'off' }),
      kimlikNo: girdi({ name: 'kimlikNo', value: deger.kimlikNo, inputmode: 'numeric', autocomplete: 'off' }),
      dogumTarihi: tarihSecici({ name: 'dogumTarihi', value: String(deger.dogumTarihi || '').slice(0, 10) }),
      cinsiyet: secim(secenekleriCevir(CINSIYETLER, 'cinsiyet'), { name: 'cinsiyet', value: deger.cinsiyet }),
      telefon: girdi({ name: 'telefon', value: deger.telefon, type: 'tel', autocomplete: 'off' }),
      eposta: girdi({ name: 'eposta', value: deger.eposta, type: 'email', autocomplete: 'off' }),
      kanGrubu: secim([['', '—'], ...KAN_GRUPLARI.map((k) => [k, k])], { name: 'kanGrubu', value: deger.kanGrubu }),
      sigorta: secim(secenekleriCevir(SIGORTALAR, 'sigorta'), { name: 'sigorta', value: deger.sigorta }),
      adres: girdi({ name: 'adres', value: deger.adres }),
      alerjiler: girdi({ name: 'alerjiler', value: (deger.alerjiler || []).join(', '), placeholder: t('hasta.alerji_yer', 'Penisilin, aspirin…') }),
      kronikHastaliklar: girdi({ name: 'kronikHastaliklar', value: (deger.kronikHastaliklar || []).join(', '), placeholder: t('hasta.kronik_yer', 'Diyabet, astım…') }),
      surekliIlaclar: girdi({ name: 'surekliIlaclar', value: (deger.surekliIlaclar || []).join(', ') }),
      notlar: metinAlani({ name: 'notlar', value: deger.notlar, rows: 2 }),
    };
    govde.append(
      el('div', { class: 'izgara izgara--form' },
        alan(t('hasta.ad', 'Ad'), g.ad, { gerekli: true, hata: dogrulaMetni(hatalar.ad) }),
        alan(t('hasta.soyad', 'Soyad'), g.soyad, { gerekli: true, hata: dogrulaMetni(hatalar.soyad) }),
        alan(t('hasta.kimlik_no', 'Kimlik no'), g.kimlikNo, { hata: dogrulaMetni(hatalar.kimlikNo), ipucu: t('genel.zorunlu_degil', 'Zorunlu değil') }),
        alan(t('hasta.dogum', 'Doğum tarihi'), g.dogumTarihi, { hata: dogrulaMetni(hatalar.dogumTarihi) }),
        alan(t('hasta.cinsiyet', 'Cinsiyet'), g.cinsiyet),
        alan(t('genel.telefon', 'Telefon'), g.telefon),
        alan(t('genel.eposta', 'E-posta'), g.eposta, { hata: dogrulaMetni(hatalar.eposta) }),
        alan(t('hasta.kan_grubu', 'Kan grubu'), g.kanGrubu),
        alan(t('hasta.sigorta', 'Sigorta'), g.sigorta)),
      alan(t('genel.adres', 'Adres'), g.adres),
      el('div', { class: 'izgara izgara--form' },
        alan(t('hasta.alerjiler', 'Alerjiler'), g.alerjiler, { ipucu: t('hasta.alerji_ipucu', 'Virgülle ayır — reçete yazarken uyarır') }),
        alan(t('hasta.kronik', 'Kronik hastalıklar'), g.kronikHastaliklar, { ipucu: t('genel.virgul', 'Virgülle ayır') }),
        alan(t('hasta.surekli_ilaclar', 'Sürekli kullandığı ilaçlar'), g.surekliIlaclar, { ipucu: t('genel.virgul', 'Virgülle ayır') })),
      alan(t('genel.not', 'Not'), g.notlar));
    govde._oku = () => {
      const v = {};
      for (const x of govde.querySelectorAll('[name]')) v[x.name] = x.value.trim();
      for (const a of ['alerjiler', 'kronikHastaliklar', 'surekliIlaclar']) v[a] = listeyeCevir(v[a]);
      return v;
    };
  }
  ciz();

  const sonuc = await modal({
    baslik: mevcut ? t('hasta.duzenle', 'Hastayı düzenle') : t('hasta.yeni', 'Yeni hasta'),
    govde, genis: true,
    dugmeler: [
      { metin: t('genel.vazgec', 'Vazgeç'), deger: null },
      { metin: t('genel.kaydet', 'Kaydet'), sinif: 'btn--birincil', cb: () => {
        const v = { ...deger, ...govde._oku() };
        const hatalar = hastaDogrula(v);
        if (Object.keys(hatalar).length) { deger = v; ciz(hatalar); return false; }
        return v;
      } },
    ],
  });
  if (!sonuc || typeof sonuc !== 'object') return null;

  // T.C. kimlik algoritması tutmuyorsa engellenmez, yalnız uyarılır:
  // yurt dışındaki hastalarda numara başka biçimde olabilir.
  if (sonuc.kimlikNo && sonuc.kimlikNo.length === 11 && !tcGecerli(sonuc.kimlikNo)) {
    uyar(t('hasta.tc_uyari', 'Kimlik numarası T.C. algoritmasına uymuyor — yine de kaydedildi.'));
  }
  try {
    const y = await depo.kaydet('hastalar', { ...(mevcut || {}), ...sonuc });
    basari(mevcut ? t('hasta.guncellendi', 'Hasta güncellendi') : t('hasta.eklendi', 'Hasta eklendi'));
    return y;
  } catch (e) { hata(hataMetni(e, t('genel.kaydedilemedi', 'Kaydedilemedi'))); return null; }
}

export default {
  baslik: 'Hastalar',
  async cizim(kok, ctx) {
    const { depo, git } = ctx;
    temizle(kok);

    const arama = girdi({ type: 'search', placeholder: t('hasta.ara', 'Ad, soyad, telefon, kimlik no…'), style: { flex: '1', minWidth: '220px', inlineSize: 'auto' } });
    const govde = el('div', {});

    kok.append(
      sayfaBas(t('nav.hastalar', 'Hastalar'), {
        alt: t('hasta.sayfa_alt', 'Kayıtlar, alerjiler ve kronik hastalıklar.'),
        eylemler: [btnS('arti', t('hasta.ekle', 'Hasta ekle'), { class: 'btn btn--birincil', onclick: async () => { if (await hastaKutusu(ctx)) listele(); } })],
      }),
      el('div', { class: 'satir', style: { marginBlockEnd: 'var(--b-4)' } }, arama),
      govde);

    // Çizim sırası: bkz. ilaclar.js — yarışan çizimler listeyi iki kez doldurmasın.
    let sira = 0;
    async function listele() {
      const benim = ++sira;
      const hepsi = await depo.listele('hastalar', { sirala: 'soyad' });
      if (benim !== sira) return;
      temizle(govde);
      const liste = hastaAra(hepsi, arama.value);

      if (!hepsi.length) {
        govde.appendChild(bosDurum({
          simge: 'hasta', baslik: t('hasta.bos', 'Henüz hasta yok'),
          alt: t('hasta.bos_alt', 'İlk hastayı ekle ya da Ayarlar\'dan örnek verileri yükle.'),
          eylem: btnS('arti', t('hasta.ekle', 'Hasta ekle'), { class: 'btn btn--birincil', onclick: async () => { if (await hastaKutusu(ctx)) listele(); } }),
        }));
        return;
      }
      if (!liste.length) { govde.appendChild(bosDurum({ simge: 'ara', baslik: t('hasta.eslesme_yok', 'Eşleşen hasta yok'), alt: t('genel.arama_degistir', 'Aramayı değiştir.') })); return; }

      const kap = el('div', { class: 'liste' });
      for (const h of liste) {
        const yas = hastaYasi(h);
        kap.appendChild(el('a', { class: 'liste__satir', href: `#/hasta/${h.id}` },
          el('span', { class: 'avatar' }, basHarfler(tamAd(h))),
          el('div', { class: 'liste__govde' },
            el('div', { class: 'liste__baslik' }, tamAd(h)),
            el('div', { class: 'liste__alt' }, [yas !== null ? t('hasta.yas', '{n} yaş', { n: yas }) : null, h.telefon, h.kanGrubu].filter(Boolean).join(' · ') || '—'),
            el('div', { class: 'satir', style: { gap: '4px', marginBlockStart: '4px' } }, ...hastaRozetleri(h)))));
      }
      govde.append(el('p', { class: 'kart__alt' }, t('hasta.sayim', '{n} hasta', { n: liste.length }) + (liste.length !== hepsi.length ? ' ' + t('genel.toplam', '(toplam {n})', { n: hepsi.length }) : '')), kap);
      sirala(kap);
    }

    arama.oninput = listele;
    await listele();
    return depo.dinle('hastalar', () => listele());
  },
};
