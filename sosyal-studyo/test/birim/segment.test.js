// Toplu mesaj segmenti: "son N günde yazanlar" süzgeci.
import { describe, expect, it } from 'vitest';
import { aliciSec } from '../../app/js/sayfalar/toplu.js';

const SIMDI = Date.parse('2026-09-13T12:00:00.000Z');
const gunOnce = (n) => new Date(SIMDI - n * 86400000).toISOString();

const KISILER = [
  { id: 'a', kanal: 'telegram', etiketler: ['musteri'], son_gelen: gunOnce(1) },
  { id: 'b', kanal: 'telegram', etiketler: ['musteri'], son_gelen: gunOnce(45) },
  { id: 'c', kanal: 'telegram', etiketler: [], son_gelen: gunOnce(10) },
  { id: 'd', kanal: 'telegram', etiketler: ['musteri'] },              // hiç yazmamış
];

describe('aliciSec: son N gün', () => {
  it('sonGun verilmezse herkes gelir', () => {
    expect(aliciSec(KISILER, {}, SIMDI).map((k) => k.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('son 30 günde yazanlar süzülür', () => {
    expect(aliciSec(KISILER, { sonGun: 30 }, SIMDI).map((k) => k.id)).toEqual(['a', 'c']);
  });

  it('hiç yazmamış kişi segmente girmez', () => {
    expect(aliciSec(KISILER, { sonGun: 365 }, SIMDI).map((k) => k.id)).not.toContain('d');
  });

  it('etiket ve son gün birlikte daraltır', () => {
    expect(aliciSec(KISILER, { sonGun: 30, etiketHepsi: ['musteri'] }, SIMDI).map((k) => k.id)).toEqual(['a']);
  });

  it('sınır günü dahildir', () => {
    expect(aliciSec(KISILER, { sonGun: 45 }, SIMDI).map((k) => k.id)).toContain('b');
  });

  it('elle seçim süzgeci atlar', () => {
    expect(aliciSec(KISILER, { sonGun: 1, secili: ['b', 'd'] }, SIMDI).map((k) => k.id)).toEqual(['b', 'd']);
  });
});
