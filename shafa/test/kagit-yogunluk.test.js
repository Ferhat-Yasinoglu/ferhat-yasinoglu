// Lacivert kâğıdın kipi ve sayfa bölünmesi içerikten hesaplanıyor: ekrandaki
// önizleme ile DOM dışında kurulan baskı kopyası aynı reçeteden aynı kâğıdı
// kurmalı. Buradaki eşikler yeni/kagit.md §6'daki A4 ölçümleri; tarayıcı
// denemesi aynı reçeteleri gerçekten basıp hiçbir şeyin kesilmediğine bakıyor.
import { describe, it, expect } from 'vitest';
import {
  kagitYogunlugu, ilacBirimi, ilacSatiri, kalemler, taniKalemleri, solBloklari, blokBoyu, KIP_OLCULERI, DEVAM_OLCULERI,
} from '../app/js/paylasilan/kagit-yogunluk.js';

/** Tipik satır: «Tab: Feldene (Piroxicam) 20 mg», tek satırlık kullanım. */
const satir = (i = 0, ek = {}) => ({
  ilacId: 'i' + i, ilacAdi: 'Feldene 20 mg Tablet', etkenMadde: 'Piroxicam', doz: '20 mg', form: 'tablet',
  adet: 10, kullanim: 'روزانه ۱ بار', zaman: 'بعد از غذا', sure: '۵ روز', yol: '', not: '', ...ek,
});
const satirlar = (n, ek) => Array.from({ length: n }, (_, i) => satir(i, ek));
/** yeni/kagit.md §6.4: 4 belirti, 6 tetkik, ölçümler, 2 tanı, iki satırlık not. */
const KLINIK = {
  belirtiler: 'Fever، Chills، Cough، Headache',
  laboratuvar: 'Hb، TLC & DLC، PT & INR، ESR، Blood Urea، Serum Creatinine',
  tani: 'Chronic hepatitis C، Type 2 diabetes mellitus', taniKodu: 'B18.2، E11.9',
  olcumler: { bp: '130/85', pr: '78', rr: '18', bw: '74', temp: '38.2', spo2: '97' }, kanGrubu: '0 Rh+',
  notlar: 'رژیم غذایی کم نمک و کم شکر.\nبعد از دو هفته دوباره مراجعه شود.',
};
const recete = (n, ek = {}) => ({ ...KLINIK, satirlar: satirlar(n, ek) });
const sayfaAraliklari = (y) => y.sayfalar.map((s) => [s.ilk, s.son]);

describe('ilacSatiri — kâğıttaki iki satır', () => {
  it('ad formdaki ad sütunuyla aynı (etken maddesiyle) ve güç sonda; adet ikinci satırın başında', () => {
    const x = ilacSatiri(satir());
    expect(x).toEqual({ kisa: 'Tab', ad: 'Feldene (Piroxicam) 20 mg', adet: 'N=10', kullanim: ['روزانه ۱ بار', 'بعد از غذا', '۵ روز'] });
  });
  it('gücü satırda olmayan eski satır adı olduğu gibi basıyor; boş alanlar atlanıyor', () => {
    const x = ilacSatiri({ ilacAdi: 'Nurofen 400 mg Tablet', form: 'tablet', adet: 2, kullanim: 'Günde 2×1' });
    expect(x.ad).toBe('Nurofen 400 mg');
    expect(x.kullanim).toEqual(['Günde 2×1']);
  });
});

describe('ilacBirimi', () => {
  const o = KIP_OLCULERI.rahat;
  it('kısa ad ve kullanım bir birim', () => expect(ilacBirimi(satir(), o)).toBe(1));
  it('ikinci satıra kırılan ad yarım birim ekliyor (sınırın bir harf üstü)', () => {
    const sinirda = 'A'.repeat(o.adSinir - 'Tab: '.length);
    expect(ilacBirimi({ ...satir(), ilacAdi: sinirda, etkenMadde: '', doz: '' }, o)).toBe(1);
    expect(ilacBirimi({ ...satir(), ilacAdi: sinirda + 'B', etkenMadde: '', doz: '' }, o)).toBe(1.5);
  });
  it('kırılan kullanım satırı da yarım birim', () => {
    expect(ilacBirimi(satir(0, { not: 'x'.repeat(o.kulSinir) }), o)).toBe(1.5);
  });
});

describe('kagitYogunlugu — kip seçimi', () => {
  it.each([
    [1, 'rahat'], [10, 'rahat'], [11, 'orta'], [15, 'orta'], [16, 'orta'], [17, 'sik'], [25, 'sik'],
  ])('%i ilaç ve tipik klinik içerik → %s, tek sayfa', (n, kip) => {
    const y = kagitYogunlugu(recete(n));
    expect(y.kip).toBe(kip);
    expect(sayfaAraliklari(y)).toEqual([[0, n]]);
    expect(y.sayfalar[0]).toMatchObject({ kip, duzen: 'tek', no: 1, toplam: 1 });
  });

  it('alerji satırı yarım birim: 10 ilaç + alerji rahata sığmıyor', () => {
    expect(kagitYogunlugu(recete(10), { alerjiler: [] }).kip).toBe('rahat');
    expect(kagitYogunlugu(recete(10), { alerjiler: ['Penicillin'] }).kip).toBe('orta');
  });

  it('uzun adlar kipi erken yükseltiyor', () => {
    const uzun = { ilacAdi: 'Iberet Folic-500 525 mg Tablet', etkenMadde: 'Ferrous Sulfate + Folic Acid + Ascorbic Acid + Vitamin B Complex', doz: '525 mg' };
    expect(kagitYogunlugu(recete(8, uzun)).kip).toBe('orta');
  });

  it('A5 sıkı kipe hiç inmiyor: ortanın üstü sayfalara bölünüyor', () => {
    const y = kagitYogunlugu(recete(20), null, { boyut: 'A5' });
    expect(y.sayfalar.map((s) => s.kip)).not.toContain('sik');
    expect(y.sayfalar.length).toBeGreaterThan(1);
    expect(kagitYogunlugu(recete(20)).kip).toBe('sik');
  });

  it('aynı girdi her zaman aynı sonucu veriyor (DOM yok, rastgelelik yok)', () => {
    expect(kagitYogunlugu(recete(26))).toEqual(kagitYogunlugu(recete(26)));
  });

  it('boş kâğıt hep rahat, tek sayfa, ilaçsız; başlıklar kalem çizgisi için duruyor', () => {
    const y = kagitYogunlugu(recete(30), null, { bos: true });
    expect(y.kip).toBe('rahat');
    expect(sayfaAraliklari(y)).toEqual([[0, 0]]);
    expect(y.sayfalar[0].sol.map((b) => b.tur)).toEqual(['belirtiler', 'lab', 'olcum', 'tani', 'not']);
  });
});

describe('kagitYogunlugu — sayfalara bölünme', () => {
  it('26 ilaç: ilk sayfa orta (devam satırına yarım birim), ikinci sayfa geniş düzende kalanı', () => {
    const y = kagitYogunlugu(recete(26));
    expect(y.kip).toBe('orta');
    expect(y.sayfalar.map((s) => [s.kip, s.duzen, s.ilk, s.son, s.no, s.toplam])).toEqual([
      ['orta', 'ilk', 0, 15, 1, 2], ['orta', 'genis', 15, 26, 2, 2],
    ]);
    // Klinik sütun ilk sayfada bitti: devam sayfasında sol sütun yok.
    expect(y.sayfalar[1].sol).toBeNull();
  });

  it('60 ilaç: her ilaç tam bir kez, sırayla; devam sayfası sütun kapasitesini aşmıyor', () => {
    const y = kagitYogunlugu(recete(60));
    const araliklar = sayfaAraliklari(y);
    expect(araliklar[0][0]).toBe(0);
    expect(araliklar.at(-1)[1]).toBe(60);
    for (let i = 1; i < araliklar.length; i++) expect(araliklar[i][0]).toBe(araliklar[i - 1][1]);
    for (const s of y.sayfalar.slice(1)) expect(s.son - s.ilk).toBeLessThanOrEqual(2 * DEVAM_OLCULERI.sutunKapasite);
    expect(y.sayfalar.length).toBe(3);
  });

  it('aşırı klinik içerik (30 belirti, 20 tetkik, 6 satır not) az ilaçta da kesilmiyor: devam sayfası «(cont.)» ile sürdürüyor', () => {
    const r = {
      ...recete(5),
      belirtiler: Array.from({ length: 30 }, (_, i) => `Symptom number ${i + 1}`).join('، '),
      laboratuvar: Array.from({ length: 20 }, (_, i) => `Laboratory test ${i + 1}`).join('، '),
      notlar: 'a\nb\nc\nd\ne\nf',
    };
    const y = kagitYogunlugu(r);
    expect(y.sayfalar.length).toBe(2);
    const [ilk, ikinci] = y.sayfalar;
    expect(ikinci.duzen).toBe('iki');
    expect(ikinci.sol.map((b) => b.tur)).toEqual(['not']);
    // Hiçbir kalem kaybolmadı ya da iki kez basılmadı.
    const hepsi = (tur) => y.sayfalar.flatMap((s) => (s.sol || []).filter((b) => b.tur === tur).flatMap((b) => b.kalemler));
    expect(hepsi('belirtiler')).toHaveLength(30);
    expect(hepsi('lab')).toHaveLength(20);
    // Her sayfanın sol sütunu kendi bütçesine sığıyor (tahmin).
    const butce = [KIP_OLCULERI.orta.govde - 4, DEVAM_OLCULERI.govde - 4 - 19];
    y.sayfalar.forEach((s, i) => {
      const boy = s.sol.reduce((t, b, j) => t + blokBoyu(b, 'orta', { ilk: j === 0 }), 0);
      expect(boy).toBeLessThanOrEqual(butce[i]);
    });
    expect(ilk.son).toBe(5);
  });

  it('bir liste sayfaya sığmıyorsa kalem kalem bölünüyor, kalanı «(cont.)» başlığıyla sürüyor', () => {
    const r = { ...recete(3), belirtiler: Array.from({ length: 90 }, (_, i) => `Symptom number ${i + 1}`).join('، ') };
    const y = kagitYogunlugu(r);
    const [ilk, ikinci] = y.sayfalar;
    const ilkBelirti = ilk.sol.find((b) => b.tur === 'belirtiler');
    expect(ilkBelirti.devam).toBeUndefined();
    expect(ikinci.sol[0]).toMatchObject({ tur: 'belirtiler', devam: true });
    expect(ilkBelirti.kalemler.length + ikinci.sol[0].kalemler.length).toBe(90);
    expect(ikinci.sol[0].kalemler[0]).toBe(`Symptom number ${ilkBelirti.kalemler.length + 1}`);
  });
});

describe('sol sütunun içeriği', () => {
  it('kalemler dizi de metin de alıyor; «،», «,» ve satır sonuyla bölüyor', () => {
    expect(kalemler('Fever، Chills, Cough\nHeadache')).toEqual(['Fever', 'Chills', 'Cough', 'Headache']);
    expect(kalemler([' Hb ', '', 'ESR'])).toEqual(['Hb', 'ESR']);
  });
  it('tanı kodu sayılar denkse kendi tanısının yanında, denk değilse sonda', () => {
    expect(taniKalemleri({ tani: 'A، B', taniKodu: 'X1، Y2' })).toEqual(['A · X1', 'B · Y2']);
    expect(taniKalemleri({ tani: 'A، B', taniKodu: 'X1' })).toEqual(['A', 'B', 'X1']);
    expect(taniKalemleri({ tani: 'A' })).toEqual(['A']);
  });
  it('rahatta boş bölüm kalem çizgisi için duruyor, sıkışık kiplerde basılmıyor; ölçüm ve not her zaman', () => {
    expect(solBloklari({}, 'rahat').map((b) => b.tur)).toEqual(['belirtiler', 'lab', 'olcum', 'tani', 'not']);
    expect(solBloklari({}, 'orta').map((b) => b.tur)).toEqual(['olcum', 'not']);
    expect(solBloklari({ tani: 'A' }, 'sik').map((b) => b.tur)).toEqual(['olcum', 'tani', 'not']);
  });
});
