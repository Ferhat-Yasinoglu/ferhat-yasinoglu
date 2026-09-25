// Reçetede ilaç arama: hekimin kendi ilaçları + hazır liste, süzgeçler.
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import {
  havuz, aramaDizini, ilacSuz, katalogIndeksi, grupBul, markaMi, listeKaydi, SONUC_SINIRI,
} from '../app/js/paylasilan/ilac-listesi.js';

const liste = JSON.parse(await readFile(new URL('../app/veri/ilaclar.json', import.meta.url), 'utf8'));
const katalog = liste.ilaclar;
const indeks = katalogIndeksi(katalog);
const bul = (hid) => katalog.find((x) => x.hid === hid);

/* Hekimin kendi kayıtları: biri listeden seçilmiş, biri elle eklenmiş ticari
   ad, biri listede hiç olmayan jenerik. */
const kendi = [
  { id: 'k1', ...listeKaydi(bul('h0001')) },
  { id: 'k2', ad: 'Brufen', etkenMadde: 'Ibuprofen', form: 'tablet', doz: '400 mg' },
  { id: 'k3', ad: 'Amoxicillin', etkenMadde: 'Amoxicillin', form: 'surup', doz: '125 mg/5 ml (kendi)' },
];
const dizin = aramaDizini(havuz(kendi, katalog), indeks);
const ara = (q, suzgec, sec) => ilacSuz(dizin, q, suzgec, sec);

describe('ilacSuz', () => {
  it('çizilen sonuç en çok 40, toplam eşleşen sayısı ayrıca veriliyor', () => {
    const r = ara('', {});
    expect(r.sonuclar).toHaveLength(SONUC_SINIRI);
    expect(SONUC_SINIRI).toBe(40);
    expect(r.toplam).toBe(dizin.length);
  });

  it('hem kendi kayıtlarında hem listede arıyor; etken maddeyle markayı buluyor', () => {
    const r = ara('piroxicam', {});
    expect(r.sonuclar.some((x) => x.ad === 'Feldene' && x.katalog)).toBe(true);
    const b = ara('ibuprofen', {});
    expect(b.sonuclar[0]).toMatchObject({ id: 'k2' });            // önce kendi kaydı
    expect(b.sonuclar.slice(1).every((x) => x.katalog)).toBe(true);
  });

  it('kelime sırası önemsiz, büyük/küçük harf önemsiz', () => {
    expect(ara('500 PARACETAMOL', {}).sonuclar[0]).toMatchObject({ id: 'k1' });
  });

  // Kademeler sözcük başı eşleşenlerin içinde: «amox»un yalnız ortasında
  // geçtiği Vigamox (Moxifloxacin, yaygın) hepsinin ardında.
  it('sıra: sık yazdıkları, öbür kendi kayıtları, listenin yaygınları, gerisi', () => {
    const r = ara('amox', {}, { sikIdler: ['k3'] });
    expect(r.sonuclar[0].id).toBe('k3');
    const listeden = r.sonuclar.filter((x) => x.katalog);
    expect(listeden.at(-1)).toMatchObject({ ad: 'Vigamox', sik: 1 });
    const basta = listeden.slice(0, -1);
    const ilkSeyrek = basta.findIndex((x) => !x.sik);
    expect(ilkSeyrek).toBeGreaterThan(0);
    expect(basta.slice(ilkSeyrek).every((x) => !x.sik)).toBe(true);
  });

  // «omepraz» aranınca yaygın diye önde duran Nexium (Esomeprazole) ilk
  // satırdaydı; hekim ona dokunup yanlış ilacı ekliyordu.
  it('adı ya da etken maddesi sorguyla BAŞLAYAN, yalnız ortasında geçenden önce (kademeden de önce)', () => {
    const r = ara('omepraz', {}).sonuclar;
    const nexium = r.findIndex((x) => x.ad === 'Nexium');
    expect(nexium).toBeGreaterThan(0);
    expect(r.slice(0, nexium).every((x) => x.etkenMadde === 'Omeprazole')).toBe(true);
    expect(r.slice(0, nexium).map((x) => x.ad)).toEqual(expect.arrayContaining(['Omeprazole', 'Risek']));
    expect(r.slice(nexium).every((x) => x.etkenMadde === 'Esomeprazole')).toBe(true);
    // Etken maddenin ikinci sözcüğü de sözcük başı: «clav» → Augmentin.
    expect(ara('clav', {}).sonuclar[0].etkenMadde).toMatch(/Clavulanic/);
  });

  it('kademe içinde adı sorguyla başlayan önce, sonra ad, sonra doz sayısı', () => {
    const kucuk = aramaDizini([
      { id: 'a', ad: 'Zeta', etkenMadde: 'Amoxicillin', form: 'tablet', doz: '1 mg' },
      { id: 'b', ad: 'Amoxil', etkenMadde: 'Amoxicillin', form: 'kapsul', doz: '1,000 mg' },
      { id: 'c', ad: 'Amoxil', etkenMadde: 'Amoxicillin', form: 'kapsul', doz: '250 mg' },
      { id: 'd', ad: 'Acemox', etkenMadde: 'Amoxicillin', form: 'kapsul', doz: '500 mg' },
    ], indeks);
    // «Acemox» alfabede önde ama adı «amox» ile başlamıyor; 1,000 mg 250'den sonra.
    expect(ilacSuz(kucuk, 'amox').sonuclar.map((x) => x.id)).toEqual(['c', 'b', 'd', 'a']);
    expect(ilacSuz(kucuk, '').sonuclar.map((x) => x.id)).toEqual(['d', 'c', 'b', 'a']);
  });

  it('grup süzgeci', () => {
    const r = ara('', { grup: 'antibiyotik' }, { sinir: 1000 });
    expect(r.toplam).toBeGreaterThan(80);
    for (const x of r.sonuclar) expect(grupBul(x, indeks)).toBe('antibiyotik');
    // Hekimin elle eklediği Amoxicillin şurubu da grubu etken maddeden buluyor.
    expect(r.sonuclar.some((x) => x.id === 'k3')).toBe(true);
  });

  it('şekil süzgeci', () => {
    const r = ara('', { form: 'damla' }, { sinir: 1000 });
    expect(r.toplam).toBeGreaterThan(10);
    expect(r.sonuclar.every((x) => x.form === 'damla')).toBe(true);
  });

  it('marka süzgeci üç durumlu: hepsi / ticari / jenerik', () => {
    const hepsi = ara('ibuprofen', {}).toplam;
    const marka = ara('ibuprofen', { marka: 'marka' }, { sinir: 1000 }).sonuclar;
    const jenerik = ara('ibuprofen', { marka: 'jenerik' }, { sinir: 1000 }).sonuclar;
    expect(marka.length + jenerik.length).toBe(hepsi);
    expect(marka.some((x) => x.id === 'k2')).toBe(true);           // Brufen ≠ Ibuprofen → ticari
    expect(jenerik.every((x) => !x.marka)).toBe(true);
    expect(jenerik.length).toBeGreaterThan(0);
  });

  it('süzgeçler birlikte çalışıyor', () => {
    const r = ara('', { grup: 'tanaffus', form: 'sprey', marka: 'marka' }, { sinir: 1000 }).sonuclar;
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) expect([x.form, grupBul(x, indeks), markaMi(x, indeks)]).toEqual(['sprey', 'tanaffus', true]);
  });

  it('kayda dönüşmüş satır ikinci kez çıkmıyor', () => {
    expect(ara('', {}, { sinir: 1000 }).sonuclar.filter((x) => x.hid === 'h0001' || x.hazirId === 'h0001')).toHaveLength(1);
  });
});

describe('grupBul ve markaMi', () => {
  it('önce kaydın kendi grubu, sonra liste satırı (kimlik ya da ad|doz|şekil), sonra etken madde', () => {
    expect(grupBul({ grup: 'qalb', etkenMadde: 'Paracetamol' }, indeks)).toBe('qalb');
    const h = bul('h0010');
    expect(grupBul({ hazirId: 'h0010' }, indeks)).toBe(h.grup);
    expect(grupBul({ ad: h.ad, doz: h.doz, form: h.form }, indeks)).toBe(h.grup);
    expect(grupBul({ ad: 'X', etkenMadde: 'Clavulanic acid + Amoxicillin' }, indeks)).toBe('antibiyotik');
    expect(grupBul({ ad: 'Bilinmeyen', etkenMadde: 'Yokmadde' }, indeks)).toBe('');
  });

  it('liste satırının marka bilgisi kaydın adından önce gelir', () => {
    const vitC = bul('h0110');                                      // «Vitamin C (Ascorbic acid)», jenerik
    expect(vitC.ad).not.toBe(vitC.etkenMadde);
    expect(markaMi({ ...listeKaydi(vitC) }, indeks)).toBe(false);
    expect(markaMi({ ad: 'Kendi', etkenMadde: 'Kendi' }, indeks)).toBe(false);
    expect(markaMi({ ad: 'Kendi', etkenMadde: '' }, indeks)).toBe(false);
    expect(markaMi({ ad: 'Brufen', etkenMadde: 'Ibuprofen' }, indeks)).toBe(true);
  });
});
