// Akış adım tipleri ve doğrulama. botflow-mcp'nin yedi adımı (message, question,
// buttons, delay, tag, goto, end) + sekiz yeni (note, condition, ai_reply, score,
// webhook, comment_reply, private_reply, hide). Akış yayınlanırken doğrulanır,
// koşarken değil: goto dışarı taşan bir akış kimseyi sohbet ortasında bırakmaz.

export const ADIM_TIPLERI = [
  'message', 'question', 'buttons', 'delay', 'tag', 'goto', 'end', 'note',
  'condition', 'ai_reply', 'score', 'webhook', 'comment_reply', 'private_reply', 'hide',
];

export const KOSUL_TURLERI = ['tag', 'var', 'follows', 'time', 'score', 'channel', 'window_open'];

// Yorum tetikleyicisi olmadan anlamsız olan adımlar.
export const YORUM_ADIMLARI = new Set(['comment_reply', 'private_reply', 'hide']);

// Kanal sınırları: uyarı üretir, yayını engellemez (Telegram'da 3'ten çok buton sorun değil).
export const KANAL_SINIRLARI = {
  telegram:  { buton: 100, etiket: 64,  metin: 4096 },
  instagram: { buton: 3,   etiket: 20,  metin: 1000 },
  whatsapp:  { buton: 3,   etiket: 20,  metin: 4096 },
};

const DEGISKEN_ADI = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/;

/** Adım listesini doğrular. Dönen `hatalar` yayını engeller, `uyarilar` bilgidir. */
export function adimlariDogrula(adimlar, { kanal, tetikleyiciTipleri = [] } = {}) {
  const hatalar = [];
  const uyarilar = [];
  const hata = (i, m) => hatalar.push(`adim[${i}]: ${m}`);
  const uyar = (i, m) => uyarilar.push(`adim[${i}]: ${m}`);

  if (!Array.isArray(adimlar)) return { hatalar: ['adimlar bir liste olmalı'], uyarilar };
  const gercek = adimlar.filter((a) => a && a.type !== 'note');
  if (gercek.length === 0) hatalar.push('akışta en az bir adım olmalı');
  if (gercek.length > 100) hatalar.push('akışta en fazla 100 adım olabilir');

  const sinir = KANAL_SINIRLARI[kanal];
  const yorumTetigi = tetikleyiciTipleri.some((t) => t === 'comment' || t === 'live_comment');
  const son = adimlar.length - 1;
  const hedefKontrol = (i, ad, h) => {
    if (h === undefined || h === null) return;
    if (!Number.isInteger(h) || h < 0 || h > son) hata(i, `${ad} hedefi (${h}) akışın dışında`);
    else if (h === i) hata(i, `${ad} kendine işaret ediyor`);
  };
  const metinKontrol = (i, alan, deger, zorunlu = true) => {
    if (deger === undefined || deger === null || deger === '') {
      if (zorunlu) hata(i, `${alan} boş olamaz`);
      return;
    }
    if (typeof deger !== 'string') return hata(i, `${alan} metin olmalı`);
    if (deger.length > 4000) hata(i, `${alan} 4000 karakteri aşıyor`);
    else if (sinir && deger.length > sinir.metin) uyar(i, `${kanal} ${alan} sınırı ${sinir.metin} karakter`);
  };
  const saveAs = (i, v) => {
    if (v === undefined) return;
    if (typeof v !== 'string' || !DEGISKEN_ADI.test(v)) hata(i, `save_as geçersiz (harf, rakam, _; en fazla 40)`);
  };
  const secenekler = (i, liste, zorunlu) => {
    if (!Array.isArray(liste) || liste.length === 0) { if (zorunlu) hata(i, 'choices boş'); return; }
    if (liste.length > 10) hata(i, 'en fazla 10 seçenek');
    if (sinir && liste.length > sinir.buton) uyar(i, `${kanal} en fazla ${sinir.buton} buton gösterir`);
    const gorulen = new Set();
    liste.forEach((s, j) => {
      if (!s || typeof s.label !== 'string' || !s.label.trim()) return hata(i, `choices[${j}].label boş`);
      if (s.label.length > 64) hata(i, `choices[${j}].label 64 karakteri aşıyor`);
      else if (sinir && s.label.length > sinir.etiket) uyar(i, `${kanal} buton etiketi en fazla ${sinir.etiket} karakter`);
      const n = s.label.trim().toLowerCase();
      if (gorulen.has(n)) hata(i, `tekrar eden buton etiketi: ${s.label}`);
      gorulen.add(n);
      hedefKontrol(i, `choices[${j}].goto`, s.goto);
      if (s.url !== undefined && !/^https:\/\//.test(String(s.url))) hata(i, `choices[${j}].url https olmalı`);
    });
  };

  let ozelYanitSayisi = 0;
  adimlar.forEach((a, i) => {
    if (!a || typeof a !== 'object') return hata(i, 'adım bir nesne olmalı');
    if (!ADIM_TIPLERI.includes(a.type)) return hata(i, `bilinmeyen tip: ${a.type}`);
    switch (a.type) {
      case 'message':
        metinKontrol(i, 'text', a.text);
        if (a.media && !/^https:\/\//.test(String(a.media.url || ''))) hata(i, 'media.url https olmalı');
        break;
      case 'question':
        metinKontrol(i, 'text', a.text); saveAs(i, a.save_as);
        if (a.validate && !['none', 'phone', 'email', 'number'].includes(a.validate)) hata(i, 'validate geçersiz');
        break;
      case 'buttons':
        metinKontrol(i, 'text', a.text); saveAs(i, a.save_as); secenekler(i, a.choices, true);
        break;
      case 'delay':
        if (!Number.isFinite(a.seconds) || a.seconds < 0 || a.seconds > 604800) hata(i, 'seconds 0..604800 olmalı');
        else if (kanal === 'instagram' && a.seconds > 86400) uyar(i, 'Instagram 24 saat penceresi: bu gecikme mesajı iletilemeyebilir');
        break;
      case 'tag':
        if (!(a.add_tags?.length) && !(a.remove_tags?.length)) hata(i, 'add_tags ya da remove_tags gerekli');
        break;
      case 'goto': hedefKontrol(i, 'goto', a.goto); if (a.goto === undefined) hata(i, 'goto hedefi yok'); break;
      case 'end': case 'note': case 'hide': break;
      case 'condition':
        if (!a.check || !KOSUL_TURLERI.includes(a.check.kind)) hata(i, 'check.kind geçersiz');
        hedefKontrol(i, 'then', a.then); hedefKontrol(i, 'else', a.else);
        if (a.then === undefined || a.else === undefined) hata(i, 'then ve else gerekli');
        break;
      case 'ai_reply':
        saveAs(i, a.save_as);
        if (a.max_chars !== undefined && (a.max_chars < 40 || a.max_chars > 1000)) hata(i, 'max_chars 40..1000');
        hedefKontrol(i, 'on_skip_goto', a.on_skip_goto);
        if (!a.brief_id) uyar(i, 'brifing seçilmedi; genel brifing kullanılır');
        break;
      case 'score':
        if (!Number.isFinite(a.delta) || Math.abs(a.delta) > 1000) hata(i, 'delta -1000..1000');
        if (!a.reason) hata(i, 'reason gerekli');
        break;
      case 'webhook':
        if (!/^https:\/\//.test(String(a.url || ''))) hata(i, 'webhook.url https olmalı');
        else if (/^https:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.url)) hata(i, 'webhook özel ağa gidemez');
        saveAs(i, a.save_as); hedefKontrol(i, 'on_error_goto', a.on_error_goto);
        if (!a.save_as && a.on_error_goto === undefined) uyar(i, 'webhook sonucu kullanılmıyor');
        break;
      case 'comment_reply':
        if (!Array.isArray(a.texts) || !a.texts.length) hata(i, 'texts boş');
        else if (a.texts.length < 10) uyar(i, 'yorum yanıtı için en az 10 varyant önerilir (spam algısı)');
        if (!yorumTetigi) hata(i, 'comment_reply için akışta yorum tetikleyicisi olmalı');
        break;
      case 'private_reply':
        metinKontrol(i, 'text', a.text); secenekler(i, a.choices, false);
        if (!yorumTetigi) hata(i, 'private_reply için akışta yorum tetikleyicisi olmalı');
        if (++ozelYanitSayisi > 1) hata(i, 'bir akışta yalnız bir private_reply olabilir (Instagram: yorum başına tek DM)');
        break;
    }
    if (a.type === 'hide' && !yorumTetigi) hata(i, 'hide için akışta yorum tetikleyicisi olmalı');
  });
  return { hatalar, uyarilar };
}

/** Adım tipi için Türkçe ad ve simge (editör listeleri). */
export const ADIM_BILGI = {
  message:       { ad: 'Mesaj',           ikon: 'sohbet' },
  question:      { ad: 'Soru',            ikon: 'soru' },
  buttons:       { ad: 'Butonlar',        ikon: 'panel' },
  delay:         { ad: 'Gecikme',         ikon: 'saat' },
  tag:           { ad: 'Etiket',          ikon: 'etiket' },
  goto:          { ad: 'Atla',            ikon: 'git' },
  end:           { ad: 'Bitir',           ikon: 'durdur' },
  note:          { ad: 'Not',             ikon: 'kalem' },
  condition:     { ad: 'Koşul',           ikon: 'akis' },
  ai_reply:      { ad: 'AI cevabı',       ikon: 'parilti' },
  score:         { ad: 'Puan',            ikon: 'yildiz' },
  webhook:       { ad: 'Webhook',         ikon: 'zincir' },
  comment_reply: { ad: 'Yoruma yanıt',    ikon: 'sohbet' },
  private_reply: { ad: 'Yorum → DM',      ikon: 'gelen' },
  hide:          { ad: 'Yorumu gizle',    ikon: 'gozKapali' },
};
