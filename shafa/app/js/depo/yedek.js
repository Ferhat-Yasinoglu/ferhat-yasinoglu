// Yedek: bütün veriyi tek JSON dosyasına yazar, geri okur.
// Veriler yalnız bu cihazda durduğu için yedek tek güvencedir; uygulama
// belirli aralıklarla hatırlatır. Dosya hasta bilgisi içerir, arayüz bunu söyler.
import { KOLEKSIYONLAR, DUSEN_KOLEKSIYONLAR, SEMA_SURUMU, YEDEKLENEN } from './sema.js';
import { simdi } from '../paylasilan/kimlik.js';
import { ayarlariBirlestir } from '../paylasilan/senkron.js';

export const YEDEK_BICIMI = 'shafa-yedek';
/** Uygulama "Eczane" adıyla çıkmıştı; o sürümün yedekleri hâlâ kabul edilir.
 *  Kullanıcının elindeki dosyayı adı değişti diye reddetmek olmaz. */
const ESKI_BICIMLER = ['eczane-yedek'];

/** Belgeyi derler. Meta'ya DOKUNMAZ: eşitleme de bu belgeyi kullanıyor ama
 *  "yedek alındı" saymamalı. Buluttaki kopya Google hesabı ile bizim kodumuzun
 *  doğruluğuna bağlı; elde duran dosyanın yerini tutmuyor, o yüzden yedek
 *  hatırlatması eşitlemeyle susmuyor. */
export async function belgeDerle(depo) {
  const koleksiyonlar = {};
  for (const ad of YEDEKLENEN) koleksiyonlar[ad] = await depo.listele(ad, { silinmisDahil: true });
  return {
    bicim: YEDEK_BICIMI,
    semaSurumu: SEMA_SURUMU,
    uygulamaSurumu: globalThis.UYGULAMA_SURUMU || '',
    olusturuldu: simdi(),
    koleksiyonlar,
  };
}

export async function yedekOlustur(depo) {
  const belge = await belgeDerle(depo);
  await depo.metaKaydet({ sonYedek: belge.olusturuldu, degisiklikSayaci: 0 });
  return belge;
}

export function yedekDogrula(belge) {
  const hatalar = [];
  if (!belge || typeof belge !== 'object') hatalar.push('Dosya okunamadı.');
  else {
    if (belge.bicim !== YEDEK_BICIMI && !ESKI_BICIMLER.includes(belge.bicim)) hatalar.push('Bu dosya bir Shafa yedeği değil.');
    if (!belge.koleksiyonlar || typeof belge.koleksiyonlar !== 'object') hatalar.push('Yedekte koleksiyon yok.');
    else {
      for (const ad of Object.keys(belge.koleksiyonlar)) {
        // Uygulamadan düşmüş koleksiyonlar (stok hareketleri) eski yedeklerde
        // var: hata değil, sessizce atlanır. Yoksa doktorun elindeki yedek
        // "bilinmeyen koleksiyon" diye reddedilirdi.
        if (DUSEN_KOLEKSIYONLAR.includes(ad)) continue;
        if (!KOLEKSIYONLAR[ad]) hatalar.push(`Bilinmeyen koleksiyon: ${ad}`);
        else if (!Array.isArray(belge.koleksiyonlar[ad])) hatalar.push(`${ad} bir liste değil.`);
      }
    }
    if (Number(belge.semaSurumu) > SEMA_SURUMU) hatalar.push('Yedek bu sürümden yeni; önce uygulamayı güncelle.');
  }
  return { gecerli: hatalar.length === 0, hatalar };
}

/**
 * strateji: 'birlestir' (daha yeni güncellenmiş kazanır) | 'degistir' (koleksiyonu boşaltıp yaz)
 * prova: true ise hiçbir şey yazılmaz, yalnız rapor döner.
 */
export async function iceAktar(depo, belge, { strateji = 'birlestir', prova = false } = {}) {
  const dogrulama = yedekDogrula(belge);
  if (!dogrulama.gecerli) return { ok: false, hatalar: dogrulama.hatalar };

  const rapor = {};
  const cakisan = [];
  for (const [ad, kayitlar] of Object.entries(belge.koleksiyonlar)) {
    if (DUSEN_KOLEKSIYONLAR.includes(ad)) continue;
    const r = { eklendi: 0, guncellendi: 0, atlandi: 0 };
    if (!prova && strateji === 'degistir') await depo.kaliciSil(ad);
    for (const k of kayitlar) {
      if (!k?.id) { r.atlandi++; continue; }
      const eski = strateji === 'degistir' ? null : await depo._oku(ad, k.id);
      // Ayarlar tek bir kayıt: bütün antet alanları ve reçete doğrulama
      // anahtarı aynı zarfı paylaşıyor. "Yenisi kazansın" deseydik öbür
      // cihazda boş bırakılmış bir antet buradakini siler, kaybeden anahtarla
      // basılmış reçeteler de bir daha doğrulanamazdı. Bu yüzden ayarlar
      // zarfa bakmadan ALAN ALAN birleşiyor (paylasilan/senkron.js).
      if (ad === 'ayarlar' && strateji !== 'degistir') {
        const { sonuc, cakisan: c, degisti } = ayarlariBirlestir(eski, k);
        cakisan.push(...c);
        if (!degisti) { r.atlandi++; continue; }
        if (eski) r.guncellendi++; else r.eklendi++;
        if (!prova) await depo._yaz(ad, { ...sonuc, rev: Math.max(eski?.rev || 0, k.rev || 0) + 1 });
        continue;
      }
      if (eski) {
        if ((eski.guncellendi || '') >= (k.guncellendi || '')) { r.atlandi++; continue; }
        r.guncellendi++;
      } else r.eklendi++;
      if (!prova) await depo._yaz(ad, { ...k, rev: Math.max(eski?.rev || 0, k.rev || 0) + 1 });
    }
    rapor[ad] = r;
    if (!prova) depo._yay(ad, { tur: 'temizle' });
  }
  return { ok: true, rapor, cakisan };
}

/** Yedek eskidi mi? 20 değişiklik ya da 7 gün. */
export function hatirlatmaGerekli(meta) {
  const sayac = Number(meta?.degisiklikSayaci || 0);
  if (sayac >= 20) return { gerekli: true, sebep: 'degisiklik', sayac };
  if (!meta?.sonYedek) return { gerekli: sayac > 0, sebep: 'hic', sayac };
  const gun = (Date.now() - Date.parse(meta.sonYedek)) / 86400000;
  return { gerekli: gun >= 7 && sayac > 0, sebep: 'sure', gun: Math.floor(gun), sayac };
}

export function dosyaAdi(tarih = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `shafa-yedek-${tarih.getFullYear()}${p(tarih.getMonth() + 1)}${p(tarih.getDate())}.json`;
}

/** Tarayıcıda indirme başlatır. */
export function indir(belge) {
  const metin = JSON.stringify(belge, null, 2);
  const b = new Blob([metin], { type: 'application/json' });
  const u = URL.createObjectURL(b);
  const a = document.createElement('a');
  a.href = u; a.download = dosyaAdi();
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
