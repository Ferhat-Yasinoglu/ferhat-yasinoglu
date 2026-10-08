// Gönderi metni: birleştirme ve marka sesi denetimi. SAF modül (tarayıcı, Worker, test).
//
// Kurallar fy-ajans/.claude/skills/icerik-uret/SKILL.md'den: sıcak, «sen» dili, kısa cümle,
// abartı yok; emoji en fazla bir; büyük harfle bağırma yok; kanca ilk satırda ve «daha fazla»
// kesmesinden önce okunmalı; değer gerçekten bir şey anlatmalı; tek çağrı; 4–5 niş etiket.
// Buradaki sınırlar Meta'nın yayımladığı kurallardan: açıklama en çok 2.200 karakter,
// en çok 30 etiket. «Daha fazla» kesmesi resmî bir sayı değil; 125 karakter yaygın gözlem,
// o yüzden yalnız UYARI, hata değil.

export const EN_COK_KARAKTER = 2200;
export const EN_COK_ETIKET = 30;
export const EN_COK_ETIKETLEME = 20; // @kullanıcı etiketlemesi (Instagram açıklaması)
export const KANCA_GORUNEN = 125;
export const ETIKET_HEDEF = { enAz: 3, enCok: 5 };

/** Çok genel etiketler: hedef kitleyi bulmaz, yığın gibi görünür. */
export const GENEL_ETIKETLER = new Set(['#ai', '#tech', '#technology', '#love', '#instagood', '#follow', '#like', '#viral', '#trending', '#business', '#startup', '#software', '#coding', '#programming', '#yazilim', '#teknoloji']);

// Unicode emoji (bayraklar ve tuş kapakları dahil); # ve rakamlar tek başına sayılmaz.
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}{2}/gu;
// Etiket: # + harf/rakam/alt çizgi (Türkçe, Dari, Almanca harfler dahil); yalnız rakamdan oluşan geçersiz.
const ETIKET = /(^|[^\p{L}\p{N}_&])#([\p{L}\p{N}_]+)/gu;
const ETIKETLEME = /(^|[^\p{L}\p{N}_.])@([\p{L}\p{N}_.]{2,})/gu;
// Baskı kalıpları: marka sesi «sınırlı süre» gibi aceleye getirme yapmaz (icerik-uret adım 2).
const BASKI = /sınırlı süre|son (gün|şans|fırsat)|hemen (al|indir|kaydol)|kaçırma|acele et|limited time|last chance|don'?t miss|hurry|nur (heute|noch)|letzte chance|jetzt (kaufen|zugreifen)|فرصت محدود|عجله کنید|آخرین فرصت/iu

export const normalEtiket = (e) => {
  const t = String(e || '').trim().replace(/^#+/, '').replace(/\s+/g, '');
  return t ? '#' + t : '';
};

export function etiketleriAyikla(metin) {
  const sonuc = [];
  for (const m of String(metin || '').matchAll(ETIKET)) sonuc.push('#' + m[2]);
  return sonuc;
}

/** Parçaları Instagram/Facebook'un sevdiği biçimde birleştirir: boş satırla ayrılmış bloklar, etiketler en sonda. */
export function birlestir({ kanca = '', deger = '', cagri = '', etiketler = [], baglanti = '' } = {}) {
  const temiz = (s) => String(s || '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();
  const bloklar = [temiz(kanca), temiz(deger), temiz(cagri)].filter(Boolean);
  if (baglanti) bloklar.push(String(baglanti).trim());
  const e = [...new Set(etiketler.map(normalEtiket).filter(Boolean))];
  if (e.length) bloklar.push(e.join(' '));
  return bloklar.join('\n\n');
}

/** Metnin sayıları: karakter, etiket, emoji, satır. */
export function say(metin) {
  const m = String(metin || '');
  return {
    karakter: [...m].length,
    etiket: etiketleriAyikla(m).length,
    etiketleme: (m.match(ETIKETLEME) || []).length,
    emoji: (m.match(EMOJI) || []).length,
    satir: m ? m.split('\n').length : 0,
  };
}

/** Bir kelime «bağırıyor» mu: 4+ harf, hepsi büyük, kısaltma listesinde değil. */
const KISALTMALAR = new Set(['PWA', 'API', 'GPS', 'UTM', 'PDF', 'APK', 'CRM', 'FYOS', 'MCP', 'SQL', 'JSON', 'HTML', 'CSS', 'DM', 'AI', 'KI', 'QR', 'A4', 'WIFI', 'USB', 'NRW', 'FAQ', 'SSS', 'TR', 'DE', 'EN', 'FA']);
export function bagiranKelimeler(metin) {
  const sonuc = [];
  for (const k of String(metin || '').split(/[\s.,;:!?()«»"'’\-–—/]+/)) {
    const harfler = k.replace(/[^\p{L}]/gu, '');
    if (harfler.length >= 4 && harfler === harfler.toLocaleUpperCase('tr') && harfler !== harfler.toLocaleLowerCase('tr') && !KISALTMALAR.has(harfler)) sonuc.push(k);
  }
  return sonuc;
}

/**
 * Marka sesi ve platform denetimi. Döner: { hatalar: [...], uyarilar: [...] } — her öğe { kod, deger? }.
 * Hata: platform reddeder ya da gönderi kırılır. Uyarı: yayınlanır ama marka sesine ya da erişime zarar verir.
 * Metinler burada değil, arayüzün sözlüğünde (kod → cümle); Worker aynı kodları döndürebilir.
 */
export function denetle({ kanca = '', deger = '', cagri = '', etiketler = [], baglanti = '' } = {}, { kanal = 'instagram' } = {}) {
  const hatalar = [];
  const uyarilar = [];
  const tam = birlestir({ kanca, deger, cagri, etiketler, baglanti });
  const s = say(tam);

  if (!tam.trim()) hatalar.push({ kod: 'bos' });
  if (s.karakter > EN_COK_KARAKTER) hatalar.push({ kod: 'uzun', deger: s.karakter - EN_COK_KARAKTER });
  if (s.etiket > EN_COK_ETIKET) hatalar.push({ kod: 'cok_etiket', deger: s.etiket });
  if (s.etiketleme > EN_COK_ETIKETLEME) hatalar.push({ kod: 'cok_etiketleme', deger: s.etiketleme });

  if (!String(kanca).trim() && tam.trim()) uyarilar.push({ kod: 'kanca_yok' });
  const kancaUzunluk = [...String(kanca).trim()].length;
  if (kancaUzunluk > KANCA_GORUNEN) uyarilar.push({ kod: 'kanca_uzun', deger: kancaUzunluk });
  if (/\n/.test(String(kanca).trim())) uyarilar.push({ kod: 'kanca_cok_satir' });

  if (s.emoji > 1) uyarilar.push({ kod: 'cok_emoji', deger: s.emoji });
  const bagiran = bagiranKelimeler([kanca, deger, cagri].join(' '));
  if (bagiran.length) uyarilar.push({ kod: 'bagirma', deger: bagiran.slice(0, 3).join(', ') });
  if (/!{2,}|\?{2,}/.test(tam)) uyarilar.push({ kod: 'cok_unlem' });
  const baski = BASKI.exec([kanca, deger, cagri].join(' '));
  if (baski) uyarilar.push({ kod: 'baski', deger: baski[0] });

  const e = [...new Set(etiketler.map(normalEtiket).filter(Boolean))];
  if (e.length && e.length < ETIKET_HEDEF.enAz) uyarilar.push({ kod: 'az_etiket', deger: e.length });
  if (e.length > ETIKET_HEDEF.enCok) uyarilar.push({ kod: 'fazla_etiket', deger: e.length });
  const genel = e.filter((x) => GENEL_ETIKETLER.has(x.toLowerCase()));
  if (genel.length) uyarilar.push({ kod: 'genel_etiket', deger: genel.join(' ') });

  // Instagram açıklamasında bağlantı tıklanmaz; «profildeki bağlantı» daha dürüst bir çağrıdır.
  if (kanal === 'instagram' && /https?:\/\/\S+/i.test([kanca, deger, cagri, baglanti].join(' '))) uyarilar.push({ kod: 'ig_baglanti' });

  // Değer kısmı: en az bir cümle; yalnız tek satır slogan ise «değer» yok demektir.
  const degerSatir = String(deger).split('\n').map((x) => x.trim()).filter(Boolean).length;
  if (String(deger).trim() && degerSatir < 2 && [...String(deger).trim()].length < 60) uyarilar.push({ kod: 'deger_kisa' });

  return { hatalar, uyarilar, sayilar: s, metin: tam };
}

/** Kancadan sonraki görünen kısım: Instagram'ın «daha fazla» kesmesini taklit eder (yaklaşık). */
export function onizlemeKesiti(metin, uzunluk = KANCA_GORUNEN) {
  const m = String(metin || '');
  const karakterler = [...m];
  if (karakterler.length <= uzunluk) return { gorunen: m, kesik: false };
  let kes = uzunluk;
  const bosluk = m.lastIndexOf(' ', uzunluk);
  if (bosluk > uzunluk * 0.6) kes = bosluk;
  return { gorunen: karakterler.slice(0, kes).join('').trimEnd() + '…', kesik: true };
}
