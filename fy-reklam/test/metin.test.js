// Gönderi metni: birleştirme, sayım ve marka sesi denetimi (paylasilan/metin.js).
import { describe, it, expect } from 'vitest';
import { birlestir, say, denetle, etiketleriAyikla, normalEtiket, bagiranKelimeler, onizlemeKesiti, EN_COK_KARAKTER } from '../app/js/paylasilan/metin.js';

const temiz = { kanca: 'Eczane kasası elektrik gidince de satar.', deger: 'Stok parti ve son kullanma tarihine göre.\nBarkodlu kasa, alış, borç.\nKayıt önce cihazda, sonra eşitlenir.', cagri: 'Deneyin: dawayar.pages.dev', etiketler: ['#eczane', '#afganistan', '#çevrimdışı', '#pwa'] };

describe('birleştir', () => {
  it('bloklar boş satırla ayrılır, etiketler en sonda', () => {
    const m = birlestir(temiz);
    expect(m.split('\n\n')).toHaveLength(4);
    expect(m.endsWith('#eczane #afganistan #çevrimdışı #pwa')).toBe(true);
  });
  it('boş parçalar atlanır, etiketler tekilleşir ve # ile başlar', () => {
    expect(birlestir({ kanca: 'a', etiketler: ['x', '#x', ' #y '] })).toBe('a\n\n#x #y');
  });
  it('bağlantı çağrıdan sonra, etiketlerden önce', () => {
    const m = birlestir({ kanca: 'k', cagri: 'c', baglanti: 'https://x.y', etiketler: ['#e'] });
    expect(m).toBe('k\n\nc\n\nhttps://x.y\n\n#e');
  });
});

describe('say ve etiketler', () => {
  it('karakter kod noktasına göre sayılır (emoji 1)', () => {
    expect(say('ab🙂').karakter).toBe(3);
    expect(say('ab🙂🇩🇪').emoji).toBe(2);
  });
  it('etiketler Türkçe ve Dari harflerle ayıklanır; renk kodu etiket değil', () => {
    expect(etiketleriAyikla('#çevrimdışı ve #داکتر ama &#39; değil')).toEqual(['#çevrimdışı', '#داکتر']);
  });
  it('normalEtiket boşluk ve fazla # temizler', () => {
    expect(normalEtiket('## sosyal medya ')).toBe('#sosyalmedya');
    expect(normalEtiket('   ')).toBe('');
  });
});

describe('denetle', () => {
  it('temiz metin: hata yok, uyarı yok', () => {
    const d = denetle(temiz);
    expect(d.hatalar).toEqual([]);
    expect(d.uyarilar).toEqual([]);
  });
  it('2200 karakter aşımı hata', () => {
    const d = denetle({ ...temiz, deger: 'a'.repeat(EN_COK_KARAKTER) });
    expect(d.hatalar.map((h) => h.kod)).toContain('uzun');
  });
  it('30+ etiket hata, 6 etiket yalnız uyarı', () => {
    expect(denetle({ ...temiz, etiketler: Array.from({ length: 31 }, (_, i) => `#e${i}`) }).hatalar.map((h) => h.kod)).toContain('cok_etiket');
    const d = denetle({ ...temiz, etiketler: ['#a', '#b', '#c', '#d', '#e', '#f'] });
    expect(d.hatalar).toEqual([]);
    expect(d.uyarilar.map((u) => u.kod)).toContain('fazla_etiket');
  });
  it('emoji, bağırma, genel etiket ve Instagram bağlantısı uyarı verir', () => {
    const d = denetle({ ...temiz, kanca: 'HEMEN İNDİR 🙂🙂 https://dawayar.pages.dev', etiketler: ['#ai', '#tech', '#eczane'] }, { kanal: 'instagram' });
    const kodlar = d.uyarilar.map((u) => u.kod);
    expect(kodlar).toEqual(expect.arrayContaining(['cok_emoji', 'bagirma', 'genel_etiket', 'ig_baglanti']));
    expect(d.hatalar).toEqual([]);
  });
  it('Facebook kanalında bağlantı uyarısı yok', () => {
    const d = denetle({ ...temiz, baglanti: 'https://dawayar.pages.dev' }, { kanal: 'facebook' });
    expect(d.uyarilar.map((u) => u.kod)).not.toContain('ig_baglanti');
  });
  it('kısaltmalar bağırma sayılmaz, Türkçe İ doğru', () => {
    expect(bagiranKelimeler('PWA ve API ile GPS; İNDİRİM var')).toEqual(['İNDİRİM']);
  });
  it('uzun kanca ve çok satırlı kanca uyarı', () => {
    const d = denetle({ ...temiz, kanca: 'x'.repeat(130) + '\ny' });
    expect(d.uyarilar.map((u) => u.kod)).toEqual(expect.arrayContaining(['kanca_uzun', 'kanca_cok_satir']));
  });
});

describe('etiketleme ve baskı kalıbı', () => {
  it('21 @etiketleme hata, 20 değil', () => {
    const yirmi = Array.from({ length: 20 }, (_, i) => `@kisi${i}`).join(' ');
    expect(denetle({ ...temiz, deger: yirmi }).hatalar.map((h) => h.kod)).not.toContain('cok_etiketleme');
    expect(denetle({ ...temiz, deger: yirmi + ' @fazla' }).hatalar.map((h) => h.kod)).toContain('cok_etiketleme');
  });
  it('«sınırlı süre» ve «last chance» baskı uyarısı verir, e-posta adresi etiketleme sayılmaz', () => {
    expect(denetle({ ...temiz, cagri: 'Sınırlı süre! Hemen al.' }).uyarilar.map((u) => u.kod)).toContain('baski');
    expect(denetle({ ...temiz, cagri: 'Last chance today' }).uyarilar.map((u) => u.kod)).toContain('baski');
    expect(say('yaz: ali@ornek.af').etiketleme).toBe(0);
    expect(denetle(temiz).uyarilar.map((u) => u.kod)).not.toContain('baski');
  });
});

describe('önizleme kesiti', () => {
  it('kısa metin kesilmez', () => { expect(onizlemeKesiti('kısa')).toEqual({ gorunen: 'kısa', kesik: false }); });
  it('uzun metin boşlukta kesilir ve … alır', () => {
    const k = onizlemeKesiti('kelime '.repeat(40), 125);
    expect(k.kesik).toBe(true);
    expect(k.gorunen.endsWith('…')).toBe(true);
    expect([...k.gorunen].length).toBeLessThanOrEqual(126);
  });
});
