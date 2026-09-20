// Hastalar: kayıt listesi, arama ve hasta kartı ekleme/düzenleme.
import { el, temizle, btn, btnS, girdi, secim, metinAlani, alan, rozet, sayfaBas, bosDurum, sirala } from '../cekirdek/dom.js';
import { CINSIYETLER, KAN_GRUPLARI, SIGORTALAR, tamAd, hastaYasi, hastaAra, bosHasta, hastaDogrula, listeyeCevir, tcGecerli } from '../paylasilan/hasta.js';
import { basHarfler } from '../paylasilan/metin.js';

/** Hasta rozetleri: alerji ve kronik hastalık tek bakışta görünsün. */
export function hastaRozetleri(h) {
  const r = [];
  for (const a of h.alerjiler || []) r.push(rozet(a, 'kirmizi', { title: 'Alerji' }));
  for (const k of (h.kronikHastaliklar || []).slice(0, 2)) r.push(rozet(k, 'mavi'));
  if (h.ornek) r.push(rozet('örnek', 'mor'));
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
      dogumTarihi: girdi({ name: 'dogumTarihi', value: String(deger.dogumTarihi || '').slice(0, 10), type: 'date' }),
      cinsiyet: secim(CINSIYETLER, { name: 'cinsiyet', value: deger.cinsiyet }),
      telefon: girdi({ name: 'telefon', value: deger.telefon, type: 'tel', autocomplete: 'off' }),
      eposta: girdi({ name: 'eposta', value: deger.eposta, type: 'email', autocomplete: 'off' }),
      kanGrubu: secim([['', '—'], ...KAN_GRUPLARI.map((k) => [k, k])], { name: 'kanGrubu', value: deger.kanGrubu }),
      sigorta: secim(SIGORTALAR, { name: 'sigorta', value: deger.sigorta }),
      adres: girdi({ name: 'adres', value: deger.adres }),
      alerjiler: girdi({ name: 'alerjiler', value: (deger.alerjiler || []).join(', '), placeholder: 'Penisilin, aspirin…' }),
      kronikHastaliklar: girdi({ name: 'kronikHastaliklar', value: (deger.kronikHastaliklar || []).join(', '), placeholder: 'Diyabet, astım…' }),
      surekliIlaclar: girdi({ name: 'surekliIlaclar', value: (deger.surekliIlaclar || []).join(', ') }),
      notlar: metinAlani({ name: 'notlar', value: deger.notlar, rows: 2 }),
    };
    govde.append(
      el('div', { class: 'izgara izgara--form' },
        alan('Ad', g.ad, { gerekli: true, hata: hatalar.ad }),
        alan('Soyad', g.soyad, { gerekli: true, hata: hatalar.soyad }),
        alan('Kimlik no', g.kimlikNo, { hata: hatalar.kimlikNo, ipucu: 'Zorunlu değil' }),
        alan('Doğum tarihi', g.dogumTarihi, { hata: hatalar.dogumTarihi }),
        alan('Cinsiyet', g.cinsiyet),
        alan('Telefon', g.telefon),
        alan('E-posta', g.eposta, { hata: hatalar.eposta }),
        alan('Kan grubu', g.kanGrubu),
        alan('Sigorta', g.sigorta)),
      alan('Adres', g.adres),
      el('div', { class: 'izgara izgara--form' },
        alan('Alerjiler', g.alerjiler, { ipucu: 'Virgülle ayır — reçete yazarken uyarır' }),
        alan('Kronik hastalıklar', g.kronikHastaliklar, { ipucu: 'Virgülle ayır' }),
        alan('Sürekli kullandığı ilaçlar', g.surekliIlaclar, { ipucu: 'Virgülle ayır' })),
      alan('Not', g.notlar));
    govde._oku = () => {
      const v = {};
      for (const x of govde.querySelectorAll('[name]')) v[x.name] = x.value.trim();
      for (const a of ['alerjiler', 'kronikHastaliklar', 'surekliIlaclar']) v[a] = listeyeCevir(v[a]);
      return v;
    };
  }
  ciz();

  const sonuc = await modal({
    baslik: mevcut ? 'Hastayı düzenle' : 'Yeni hasta',
    govde, genis: true,
    dugmeler: [
      { metin: 'Vazgeç', deger: null },
      { metin: 'Kaydet', sinif: 'btn--birincil', cb: () => {
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
    uyar('Kimlik numarası T.C. algoritmasına uymuyor — yine de kaydedildi.');
  }
  try {
    const y = await depo.kaydet('hastalar', { ...(mevcut || {}), ...sonuc });
    basari(mevcut ? 'Hasta güncellendi' : 'Hasta eklendi');
    return y;
  } catch (e) { hata(e.message || 'Kaydedilemedi'); return null; }
}

export default {
  baslik: 'Hastalar',
  async cizim(kok, ctx) {
    const { depo, git } = ctx;
    temizle(kok);

    const arama = girdi({ type: 'search', placeholder: 'Ad, soyad, telefon, kimlik no…', style: { flex: '1', minWidth: '220px', inlineSize: 'auto' } });
    const govde = el('div', {});

    kok.append(
      sayfaBas('Hastalar', {
        alt: 'Kayıtlar, alerjiler ve kronik hastalıklar.',
        eylemler: [btnS('arti', 'Hasta ekle', { class: 'btn btn--birincil', onclick: async () => { if (await hastaKutusu(ctx)) listele(); } })],
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
          simge: 'hasta', baslik: 'Henüz hasta yok',
          alt: 'İlk hastayı ekle ya da Ayarlar\'dan örnek verileri yükle.',
          eylem: btnS('arti', 'Hasta ekle', { class: 'btn btn--birincil', onclick: async () => { if (await hastaKutusu(ctx)) listele(); } }),
        }));
        return;
      }
      if (!liste.length) { govde.appendChild(bosDurum({ simge: 'ara', baslik: 'Eşleşen hasta yok', alt: 'Aramayı değiştir.' })); return; }

      const kap = el('div', { class: 'liste' });
      for (const h of liste) {
        const yas = hastaYasi(h);
        kap.appendChild(el('a', { class: 'liste__satir', href: `#/hasta/${h.id}` },
          el('span', { class: 'avatar' }, basHarfler(tamAd(h))),
          el('div', { class: 'liste__govde' },
            el('div', { class: 'liste__baslik' }, tamAd(h)),
            el('div', { class: 'liste__alt' }, [yas !== null ? `${yas} yaş` : null, h.telefon, h.kanGrubu].filter(Boolean).join(' · ') || '—'),
            el('div', { class: 'satir', style: { gap: '4px', marginBlockStart: '4px' } }, ...hastaRozetleri(h)))));
      }
      govde.append(el('p', { class: 'kart__alt' }, `${liste.length} hasta${liste.length !== hepsi.length ? ` (toplam ${hepsi.length})` : ''}`), kap);
      sirala(kap);
    }

    arama.oninput = listele;
    await listele();
    return depo.dinle('hastalar', () => listele());
  },
};
