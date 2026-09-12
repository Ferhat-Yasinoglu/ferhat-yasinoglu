// Gelen olayı tetikleyicilerle eşler. botflow-mcp'nin kuralları korunur:
// - Bir cevap bekleniyorsa cevap kazanır (kişi "fiyat" yazınca kendi akışını raydan çıkarmaz).
// - Eşleşen bir tetikleyici, bekleyen ama cevap istemeyen (delay/window) koşuyu bastırır.
// - Aynı akış için yeniden başlatma süresi dolmadıysa tetiklenmez.
import { eslesir } from '../metin.js';
import { cevapBekliyor } from './kosucu.js';

export const TETIKLEYICI_TIPLERI = [
  'start', 'keyword', 'any_message', 'comment', 'live_comment',
  'story_reply', 'story_reaction', 'story_mention', 'ref_link', 'welcome_button',
];

export const TETIKLEYICI_BILGI = {
  start:          { ad: 'Telegram /start',    kanallar: ['telegram'] },
  keyword:        { ad: 'DM anahtar kelime',  kanallar: ['telegram', 'instagram', 'whatsapp'] },
  any_message:    { ad: 'Herhangi bir mesaj', kanallar: ['telegram', 'instagram', 'whatsapp'] },
  comment:        { ad: 'Gönderi yorumu',     kanallar: ['instagram'] },
  live_comment:   { ad: 'Canlı yayın yorumu', kanallar: ['instagram'] },
  story_reply:    { ad: 'Story yanıtı',       kanallar: ['instagram'] },
  story_reaction: { ad: 'Story tepkisi',      kanallar: ['instagram'] },
  story_mention:  { ad: 'Story bahsi',        kanallar: ['instagram'] },
  ref_link:       { ad: 'Referans linki',     kanallar: ['telegram', 'instagram'] },
  welcome_button: { ad: 'Hoş geldin butonu',  kanallar: ['instagram'] },
};

// Olay tipi → hangi tetikleyici tiplerine bakılır (öncelik sırasıyla).
const OLAY_TETIK = {
  start:          ['ref_link', 'start', 'any_message'],
  dm:             ['keyword', 'any_message'],
  comment:        ['comment'],
  live_comment:   ['live_comment'],
  story_reply:    ['story_reply', 'story_reaction', 'keyword', 'any_message'],
  story_mention:  ['story_mention'],
  welcome_button: ['welcome_button'],
  ref_link:       ['ref_link'],
};

function tekilEslesme(tet, olay) {
  if (tet.tip === 'ref_link') return !!olay.ref && (!tet.anahtar_kelimeler?.length || tet.anahtar_kelimeler.includes(olay.ref));
  if (tet.tip === 'welcome_button') return !!olay.payload && (!tet.anahtar_kelimeler?.length || tet.anahtar_kelimeler.includes(olay.payload));
  if (tet.tip === 'story_reaction') return /^[\p{Emoji}\s]+$/u.test(String(olay.text || ''));
  if (tet.tip === 'comment' || tet.tip === 'live_comment') {
    if (tet.gonderi_idleri?.length && !tet.gonderi_idleri.includes(olay.gonderiId)) return false;
    return eslesir(olay.text, tet.anahtar_kelimeler, tet.eslesme || 'contains');
  }
  if (tet.tip === 'start') return true;
  if (tet.tip === 'any_message') return true;
  return eslesir(olay.text, tet.anahtar_kelimeler, tet.eslesme || 'contains');
}

/**
 * olay: {tip:'dm'|'comment'|'story_reply'|..., text, kanal, hesap_id, ref?, payload?, gonderiId?}
 * tetikleyiciler: aktif tetikleyici listesi; akislar: id→akış (yayında olanlar)
 * aktifKosu: kişinin bekleyen koşusu ya da null; sonBaslatmalar: {akis_id → ISO}
 * Döner: {karar:'cevap'|'tetik'|'yok', tetik?, akis?, bastir?: kosu}
 */
export function esle({ olay, tetikleyiciler, akislar, aktifKosu, sonBaslatmalar = {}, simdi }) {
  const zaman = simdi ? Date.parse(simdi()) : Date.now();
  // Kural 1: cevap bekleyen koşu varsa metin/buton olayı ona gider.
  if (aktifKosu && cevapBekliyor(aktifKosu) && (olay.tip === 'dm' || olay.tip === 'story_reply')) {
    return { karar: 'cevap', kosu: aktifKosu };
  }
  const sira = OLAY_TETIK[olay.tip] || ['any_message'];
  const adaylar = tetikleyiciler.filter((t) => t.aktif !== 0 && t.aktif !== false && sira.includes(t.tip) && (!t.hesap_id || !olay.hesap_id || t.hesap_id === olay.hesap_id));
  // Özel tipler önce (keyword, any_message'dan önce gelir).
  adaylar.sort((a, b) => sira.indexOf(a.tip) - sira.indexOf(b.tip));
  for (const tet of adaylar) {
    const akis = akislar[tet.akis_id];
    if (!akis || akis.durum !== 'yayinda') continue;
    if (!tekilEslesme(tet, olay)) continue;
    const son = sonBaslatmalar[tet.akis_id];
    const yeniden = tet.yeniden_baslatma_sn ?? 0;
    if (son && yeniden > 0 && zaman - Date.parse(son) < yeniden * 1000) continue;
    return { karar: 'tetik', tetik: tet, akis, bastir: aktifKosu && aktifKosu.durum === 'waiting' ? aktifKosu : null };
  }
  return { karar: 'yok' };
}

/** Hesapta aynı anahtar kelimenin iki yayında akışta kullanılıp kullanılmadığı (yayınlama denetimi). */
export function cakismaBul(tetikleyiciler, akislar) {
  const gorulen = new Map();
  const cakismalar = [];
  for (const t of tetikleyiciler) {
    if (!['keyword', 'comment'].includes(t.tip) || akislar[t.akis_id]?.durum !== 'yayinda') continue;
    for (const k of t.anahtar_kelimeler || []) {
      const anahtar = `${t.hesap_id || '*'}|${t.tip}|${k.toLowerCase()}`;
      if (gorulen.has(anahtar) && gorulen.get(anahtar) !== t.akis_id) cakismalar.push({ kelime: k, akislar: [gorulen.get(anahtar), t.akis_id] });
      gorulen.set(anahtar, t.akis_id);
    }
  }
  return cakismalar;
}
