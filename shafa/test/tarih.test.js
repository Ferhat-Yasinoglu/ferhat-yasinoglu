import { describe, it, expect } from 'vitest';
import {
  isoGun, gunFarki, tarihMetni, yasHesapla, goreliGun,
  semsiye, semsiden, semsiAyGunu, semsiAyAdi, semsiGunAdlari, semsiAyBasiSutunu,
} from '../app/js/paylasilan/tarih.js';
import { semsiMetniCozumle } from '../app/js/cekirdek/tarih-secici.js';

describe('isoGun', () => {
  it('yerel saate göre gün verir', () => {
    expect(isoGun(new Date(2026, 8, 20, 23, 30))).toBe('2026-09-20');
  });
  it('geçersiz tarihte boş döner', () => {
    expect(isoGun(new Date('olmaz'))).toBe('');
  });
});

describe('gunFarki', () => {
  it('gün farkını verir', () => {
    expect(gunFarki('2026-09-20', '2026-09-25')).toBe(5);
    expect(gunFarki('2026-09-25', '2026-09-20')).toBe(-5);
    expect(gunFarki('2026-02-28', '2026-03-01')).toBe(1); // 2026 artık yıl değil
  });
  it('eksik değerde null döner', () => {
    expect(gunFarki('', '2026-01-01')).toBe(null);
  });
});

describe('yasHesapla', () => {
  it('doğum günü gelmediyse bir eksiltir', () => {
    expect(yasHesapla('2000-12-31', '2026-09-20')).toBe(25);
    expect(yasHesapla('2000-01-01', '2026-09-20')).toBe(26);
    expect(yasHesapla('2000-09-20', '2026-09-20')).toBe(26);
  });
  it('gelecekteki doğum tarihinde null döner', () => {
    expect(yasHesapla('2030-01-01', '2026-09-20')).toBe(null);
  });
});

describe('tarihMetni / goreliGun', () => {
  // Hekim ve hastaları şemsi takvim kullanıyor: gösterilen tarih o takvimde.
  // Depoda tarih miladi ISO kalıyor — reçete numarası ve sahtecilik özeti
  // ona bağlı, bu yüzden burada yalnız GÖSTERİM deneniyor.
  it('şemsi takvimde yıl/ay/gün yazar', () => {
    expect(tarihMetni('2026-09-22')).toBe('1405/06/31');
    expect(tarihMetni('2026-03-21')).toBe('1405/01/01');   // nevruz: yıl başı
    expect(tarihMetni('2026-03-20')).toBe('1404/12/29');   // bir gün öncesi eski yıl
  });
  it('doğum tarihi gibi eski günleri de çevirir', () => {
    expect(tarihMetni('1985-04-12')).toBe('1364/01/23');
  });
  it('rakamlar Latin: uygulamanın geri kalanı da öyle', () => {
    expect(tarihMetni('2026-09-22')).toMatch(/^[0-9/]+$/);
  });
  it('geçersiz ya da boş tarihte tire döner', () => {
    expect(tarihMetni('')).toBe('—');
    expect(tarihMetni('abc')).toBe('—');
    expect(tarihMetni(null)).toBe('—');
  });
  it('uzaklığı kod olarak verir (cümleyi arayüz kurar)', () => {
    expect(goreliGun('2026-09-20', '2026-09-20')).toEqual({ kod: 'bugun', gun: 0 });
    expect(goreliGun('2026-09-21', '2026-09-20')).toEqual({ kod: 'yarin', gun: 1 });
    expect(goreliGun('2026-09-19', '2026-09-20')).toEqual({ kod: 'dun', gun: 1 });
    expect(goreliGun('2026-09-25', '2026-09-20')).toEqual({ kod: 'sonra', gun: 5 });
    expect(goreliGun('2026-09-10', '2026-09-20')).toEqual({ kod: 'once', gun: 10 });
  });
  it('geçersiz tarihte kod yok döner', () => {
    expect(goreliGun('', '2026-09-20')).toEqual({ kod: 'yok', gun: 0 });
  });
});

describe('şemsi ↔ miladi çevrim', () => {
  it('iki yönü de bilinen bir günde tutuyor', () => {
    expect(semsiye('2026-09-22')).toEqual({ yil: 1405, ay: 6, gun: 31 });
    expect(semsiden(1405, 6, 31)).toBe('2026-09-22');
  });

  /* ASIL DENETİM. Çevrim takvim kurallarını elle yazmıyor, Intl'e sorup
     düzeltiyor. Bu testin işi o düzeltmenin HER GÜN çalıştığını göstermek:
     bir tek günde bile şaşarsa hekim yanlış tarihli reçete yazar.
     1900–2100 arası 73.414 günün tamamı gidiş-dönüş deneniyor. */
  it('1900–2100 arası her gün gidiş-dönüş aynı günü veriyor', () => {
    const gun = 86400000;
    const bas = Math.round(Date.UTC(1900, 0, 1) / gun);
    const son = Math.round(Date.UTC(2100, 11, 31) / gun);
    let sayi = 0;
    const kacaklar = [];
    for (let n = bas; n <= son; n++) {
      const iso = new Date(n * gun).toISOString().slice(0, 10);
      const p = semsiye(iso);
      if (semsiden(p.yil, p.ay, p.gun) !== iso) kacaklar.push(iso);
      sayi++;
    }
    expect(sayi).toBeGreaterThan(73000);
    expect(kacaklar).toEqual([]);
  });

  it('artık yılda 30 حوت var, artık olmayanda yok', () => {
    // 1403 ve 1408 artık: son ay 30 gün çekiyor.
    expect(semsiAyGunu(1403, 12)).toBe(30);
    expect(semsiAyGunu(1408, 12)).toBe(30);
    expect(semsiAyGunu(1405, 12)).toBe(29);
    expect(semsiden(1403, 12, 30)).toBe('2025-03-20');
    // Olmayan gün boş döner — kutu bunu kırmızıya boyuyor.
    expect(semsiden(1405, 12, 30)).toBe('');
    expect(semsiden(1405, 12, 31)).toBe('');
  });

  it('ilk altı ay 31, sonraki beşi 30 gün', () => {
    const uzunluklar = Array.from({ length: 12 }, (_, i) => semsiAyGunu(1405, i + 1));
    expect(uzunluklar).toEqual([31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29]);
  });

  /* semsiden'in sözleşmesi kesin: ya YYYY-MM-DD ya boş. Denetlenmediğinde
     şemsi yıl 378'den küçükken üç haneli bir metin çıkıyordu ('761-09-22');
     daha sinsisi 379–999 arası yıllar DÖRT haneli ama bambaşka bir ISO
     veriyordu (405 → '1026-09-22') ve bütün doğrulama düzeneğini geçiyordu. */
  it('her zaman ya YYYY-MM-DD ya boş döner — arada bir şey yok', () => {
    for (const y of [1, 99, 140, 377, 378, 999, 1000, 1405, 2000, 2999]) {
      const r = semsiden(y, 6, 31);
      expect(r === '' || /^\d{4}-\d{2}-\d{2}$/.test(r)).toBe(true);
    }
    // Miladi karşılığı dört haneye sığmayanlar boş dönüyor.
    expect(semsiden(140, 6, 31)).toBe('');
    expect(semsiden(378, 6, 31)).toBe('');
  });

  it('geçersiz girdide boş ya da null döner', () => {
    expect(semsiye('')).toBe(null);
    expect(semsiye('abc')).toBe(null);
    expect(semsiden(1405, 13, 1)).toBe('');
    expect(semsiden(1405, 0, 1)).toBe('');
    expect(semsiden(1405, 6, 0)).toBe('');
    expect(semsiden(NaN, 6, 1)).toBe('');
  });

  /* Ay adları AFGANİSTAN'ınki. İran'ın adları (فروردین، اردیبهشت…) gelirse
     hekim tanımadığı bir takvime bakar — `fa-AF` yerine `fa-IR` yazılması
     ya da yerelin düşmesi bunu sessizce yapardı. */
  it('ay adları Afganistan takvimindeki adlar', () => {
    expect(semsiAyAdi(1)).toBe('حمل');
    expect(semsiAyAdi(6)).toBe('سنبله');   // CLDR'deki izafet hemzesi silinmiş
    expect(semsiAyAdi(12)).toBe('حوت');
    expect(semsiAyAdi(6)).not.toContain('\u0654');
  });

  it('hafta شنبه ile başlıyor ve ayın 1\'i doğru sütuna düşüyor', () => {
    // Farsçada `short` tam adı veriyor ve yedi sütuna sığmıyor; başlıklarda
    // tek harfli biçim kullanılıyor, tam ad ekran okuyucuya kalıyor.
    expect(semsiGunAdlari()[0]).toEqual({ kisa: 'ش', tam: 'شنبه' });
    expect(semsiGunAdlari()).toHaveLength(7);
    expect(semsiGunAdlari().every((g) => g.kisa.length === 1)).toBe(true);
    // 1405/07/01 = 2026-09-23, çarşamba → şanbe'den saymaya göre 4. sütun.
    expect(semsiden(1405, 7, 1)).toBe('2026-09-23');
    expect(semsiAyBasiSutunu(1405, 7)).toBe(4);
  });
});

describe('semsiMetniCozumle', () => {
  it('ayraç ne olursa olsun okuyor', () => {
    for (const metin of ['1405/06/31', '1405-06-31', '1405.6.31', ' 1405 / 6 / 31 ']) {
      expect(semsiMetniCozumle(metin)).toEqual({ yil: 1405, ay: 6, gun: 31 });
    }
  });
  it('Farsça ve Arapça rakamları da okuyor', () => {
    // Hekim telefonun kendi klavyesiyle yazarsa bunlar geliyor.
    expect(semsiMetniCozumle('۱۴۰۵/۰۶/۳۱')).toEqual({ yil: 1405, ay: 6, gun: 31 });
    expect(semsiMetniCozumle('١٤٠٥/٠٦/٣١')).toEqual({ yil: 1405, ay: 6, gun: 31 });
  });
  it('yarım ya da bozuk metinde null', () => {
    for (const metin of ['', '1405', '1405/06', 'abc', '1405/06/31/2', null]) {
      expect(semsiMetniCozumle(metin)).toBe(null);
    }
  });
  it('yıl TAM dört hane olmalı', () => {
    // Dolu bir kutuda «1405»in bir rakamını silmek en sıradan tuş vuruşu.
    // Üç hane kabul edilirken bu geçerli sayılıp başka bir yıla çeviriyordu
    // (405 → 1026) ve değer sessizce kaydediliyordu.
    for (const metin of ['405/06/31', '140/06/31', '14/06/31', '14050/06/31']) {
      expect(semsiMetniCozumle(metin)).toBe(null);
    }
    expect(semsiMetniCozumle('1405/06/31')).toEqual({ yil: 1405, ay: 6, gun: 31 });
  });
});
