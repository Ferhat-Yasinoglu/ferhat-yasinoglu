// Hasta alanı: ad, yaş, kimlik doğrulama, arama ve alerji çakışması.
import { normalize, eslesir } from './metin.js';
import { yasHesapla, bugun as buGun } from './tarih.js';

export const CINSIYETLER = [['kadin', 'Kadın'], ['erkek', 'Erkek'], ['belirtilmemis', 'Belirtilmemiş']];
export const KAN_GRUPLARI = ['0 Rh+', '0 Rh−', 'A Rh+', 'A Rh−', 'B Rh+', 'B Rh−', 'AB Rh+', 'AB Rh−'];
export const SIGORTALAR = [['sgk', 'SGK'], ['ozel', 'Özel sigorta'], ['yok', 'Ücretli / sigortasız']];

export const tamAd = (h) => [h?.ad, h?.soyad].map((x) => String(x ?? '').trim()).filter(Boolean).join(' ');

export const hastaYasi = (h, referans = buGun()) => yasHesapla(h?.dogumTarihi, referans);

/** T.C. kimlik numarası algoritma denetimi. Zorunlu alan değil; yalnız uyarı içindir
 *  (yurt dışındaki hastalarda numara başka biçimde olabilir). */
export function tcGecerli(no) {
  const s = String(no ?? '').trim();
  if (!/^[1-9]\d{10}$/.test(s)) return false;
  const d = [...s].map(Number);
  const tek = d[0] + d[2] + d[4] + d[6] + d[8];
  const cift = d[1] + d[3] + d[5] + d[7];
  if ((tek * 7 - cift) % 10 !== d[9]) return false;
  return d.slice(0, 10).reduce((a, b) => a + b, 0) % 10 === d[10];
}

export function hastaAra(liste, q) {
  const s = String(q ?? '').trim();
  if (!s) return [...liste];
  return liste.filter((h) => eslesir(`${tamAd(h)} ${h.kimlikNo || ''} ${h.telefon || ''}`, s));
}

/** Hastanın alerjileri arasında bu ilaca uyan var mı?
 *  Alerji metni ilacın adında ya da etken maddesinde geçiyorsa eşleşme sayılır —
 *  kaba ama reçete yazarken "penisilin" uyarısını yakalamaya yeter. */
export function alerjiCakismasi(hasta, ilac) {
  const hedef = normalize(`${ilac?.ad ?? ''} ${ilac?.etkenMadde ?? ''}`);
  if (!hedef) return null;
  for (const a of hasta?.alerjiler || []) {
    const n = normalize(a);
    if (n.length >= 3 && hedef.includes(n)) return a;
  }
  return null;
}

export function bosHasta() {
  return {
    ad: '', soyad: '', kimlikNo: '', dogumTarihi: '', cinsiyet: 'belirtilmemis',
    telefon: '', eposta: '', adres: '', kanGrubu: '', alerjiler: [],
    kronikHastaliklar: [], surekliIlaclar: [], sigorta: 'sgk', notlar: '',
  };
}

/** Alan → hata kodu. Metni arayüz çevirir (bkz. hatalar.js). */
export function hastaDogrula(hasta) {
  const h = {};
  if (!String(hasta.ad ?? '').trim()) h.ad = 'ad_gerekli';
  if (!String(hasta.soyad ?? '').trim()) h.soyad = 'soyad_gerekli';
  if (hasta.kimlikNo && !/^\d{5,20}$/.test(String(hasta.kimlikNo).trim())) h.kimlikNo = 'kimlik_bicim';
  if (hasta.dogumTarihi && !/^\d{4}-\d{2}-\d{2}$/.test(String(hasta.dogumTarihi).slice(0, 10))) h.dogumTarihi = 'tarih_gecersiz';
  if (hasta.dogumTarihi && yasHesapla(hasta.dogumTarihi) === null) h.dogumTarihi = 'dogum_gelecek';
  if (hasta.eposta && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(hasta.eposta).trim())) h.eposta = 'eposta_gecersiz';
  return h;
}

/** Virgül ya da satırla ayrılmış metni listeye çevirir (alerji, kronik hastalık alanları). */
export function listeyeCevir(metin) {
  return String(metin ?? '').split(/[,\n;]/).map((x) => x.trim()).filter(Boolean);
}
