// Toplu mesaj: cron her çalışmada kuyruktaki işlerden bir parça gönderir (≤40 alıcı, Worker alt istek sınırı).
// Pencere kapalı alıcılar atlanır ve nedeni yazılır; 429'da retry_after kadar beklenir (sonraki parça).
import { pencereAcik } from '../../app/js/paylasilan/kanallar.js';
import { doldur } from '../../app/js/paylasilan/metin.js';
import { eylemleriGonder } from './motor.js';
import { simdi } from './db.js';

export async function topluParcaGonder(env, db, { fetchFn = fetch, parca = 40 } = {}) {
  const isler = (await db.listele('toplu_mesajlar')).filter((i) => (i.durum === 'kuyrukta' && (!i.planlanan || i.planlanan <= simdi())) || i.durum === 'gonderiliyor');
  const hesaplar = await db.listele('hesaplar');
  let toplam = 0;
  for (const is of isler) {
    const hesap = hesaplar.find((h) => h.id === is.hesap_id) || null;
    const alicilar = is.alicilar_donduruldu || [];
    let imlec = is.imlec || 0;
    const sayim = is.sayim || { toplam: alicilar.length, gonderildi: 0, atlandi: 0, basarisiz: 0 };
    if (is.durum === 'kuyrukta') await db.kaydet('toplu_mesajlar', { ...is, durum: 'gonderiliyor', baslangic: simdi(), sayim });
    const son = Math.min(alicilar.length, imlec + parca);
    for (; imlec < son; imlec++) {
      const kisi = await db.al('kisiler', alicilar[imlec]);
      if (!kisi) { sayim.atlandi++; continue; }
      if (kisi.kanal !== 'telegram' && !pencereAcik(kisi)) { sayim.atlandi++; await db.kaydet('toplu_kalemleri', { toplu_id: is.id, kisi_id: kisi.id, durum: 'atlandi', hata: '24 saat penceresi kapalı', zaman: simdi() }); continue; }
      const adim = is.adimlar?.[0] || { type: 'message', text: '' };
      const eylem = { tip: 'mesaj', text: doldur(adim.text, { ad: kisi.ad, username: kisi.kullanici_adi, ...(kisi.degiskenler || {}) }), choices: adim.choices, adim: 0 };
      const r = await eylemleriGonder(env, db, { hesap, kisi, olay: { kanal: kisi.kanal, hesap_id: is.hesap_id, tip: 'toplu', text: '' }, eylemler: [eylem], fetchFn });
      const g = r[0] || {};
      if (g.hata) { sayim.basarisiz++; await db.kaydet('toplu_kalemleri', { toplu_id: is.id, kisi_id: kisi.id, durum: 'basarisiz', hata: g.hata, zaman: simdi() }); if (/429|Too Many/i.test(g.hata)) break; }
      else { sayim.gonderildi++; }
      toplam++;
    }
    const bitti = imlec >= alicilar.length;
    await db.kaydet('toplu_mesajlar', { ...is, durum: bitti ? 'bitti' : 'gonderiliyor', imlec, sayim, bitis: bitti ? simdi() : null, prova: hesap?.durum === 'canli' && String(env.PROVA) === '0' ? 0 : 1 });
  }
  return toplam;
}
