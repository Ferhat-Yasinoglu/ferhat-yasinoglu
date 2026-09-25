// Kimlik ve zaman: her kaydın id'si ve zaman damgası buradan çıkar.
// Saf modül — tarayıcıda da testte de aynı çalışır.
import { KOD_ALFABE } from './dogrulama.js';

const ALFABE = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Çakışmaya karşı rastgele id: `ila_k3f9x2…`. crypto yoksa Math.random'a düşer. */
export function yeniId(onek = 'kyt') {
  const uz = 10;
  let govde = '';
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const b = new Uint8Array(uz);
    c.getRandomValues(b);
    for (const x of b) govde += ALFABE[x % ALFABE.length];
  } else {
    for (let i = 0; i < uz; i++) govde += ALFABE[Math.floor(Math.random() * ALFABE.length)];
  }
  return `${onek}_${govde}`;
}

/* Kasa kodu. Hekim ARTIK PAROLA YAZMIYOR: giriş düğmesine basınca uygulama
   bunu kendi üretiyor. Kod yalnız ikinci cihaz eklenirken görünüyor ve elle
   geçirilebilsin diye birbirine benzeyen harfler (I, O, 0, 1) alfabede yok;
   dörtlü gruplara da bölünüyor. 20 harf × 32 seçenek = 100 bit.

   crypto yoksa BİLEREK düşülmüyor: `yeniId` Math.random'a düşebilir çünkü orada
   çakışmama yetiyor. Burada üretilen şey bir ŞİFRELEME ANAHTARI — tahmin
   edilebilir olması sessiz bir güvenlik kaybı olurdu, hata vermek yeğ.

   Alfabe TEK kaynaktan (dogrulama.js): kurtarma kodunu okuyan kurtarmaNormal
   (hesap-kurallari.js) alfabe dışındaki her harfi atıyor. İki kopya ayrışsaydı
   üretilen koddan harf silinir, kod 24 harf olmaz ve kurtarma kalıcı bozulurdu. */

export function kasaKoduUret(uzunluk = 20) {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) throw new Error('crypto yok: kasa kodu güvenle üretilemez');
  const b = new Uint8Array(uzunluk);
  c.getRandomValues(b);
  let kod = '';
  for (let i = 0; i < uzunluk; i++) {
    if (i && i % 4 === 0) kod += '-';
    kod += KOD_ALFABE[b[i] % KOD_ALFABE.length];
  }
  return kod;
}

// Zaman damgası tekdüze artar: aynı milisaniyede iki kayıt oluşursa (ver + geri
// al gibi arka arkaya işlemler) ikincisi bir milisaniye ileri atılır. Yoksa
// hareket geçmişi eşit damgalarda kararsız sıralanıyor, "önce ne oldu"
// sorusunun cevabı ekrana rastgele çıkıyordu. Duvar saati yakalayınca
// kendiliğinden hizaya döner.
let sonDamga = 0;

export function simdi() {
  const t = Math.max(Date.now(), sonDamga + 1);
  sonDamga = t;
  return new Date(t).toISOString();
}
