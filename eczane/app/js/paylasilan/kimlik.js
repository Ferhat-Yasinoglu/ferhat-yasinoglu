// Kimlik ve zaman: her kaydın id'si ve zaman damgası buradan çıkar.
// Saf modül — tarayıcıda da testte de aynı çalışır.

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
