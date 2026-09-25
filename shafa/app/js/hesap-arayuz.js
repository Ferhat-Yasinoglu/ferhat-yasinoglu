// Ayarlar'daki «Hesap» kartı. Şimdilik yalnız DURUMU gösteriyor: sunucu var
// mı, giriş yapılmış mı, son eşitleme ve kalıcı bir hata. Giriş, kayıt,
// kurtarma ve parola formları bir sonraki adımda buraya geliyor; akışların
// kendisi (senkron/hesap-servisi.js) hazır ve testli.
import { el, kart, rozet } from './cekirdek/dom.js';
import { simge } from './cekirdek/simge.js';
import { tarihSaatMetni } from './paylasilan/tarih.js';
import { raporToplami } from './paylasilan/senkron.js';
import { hataMetni } from './hatalar.js';
import { t } from './i18n.js';

/** İnen kayıtları tek cümleye indirir (açılıştaki sessiz turun bildirimi). */
export function senkronOzeti(sonuc) {
  const { eklendi, guncellendi } = raporToplami(sonuc?.rapor);
  return t('hesap.indi', '{n} kayıt öbür cihazlardan geldi.', { n: eklendi + guncellendi });
}

/** durum: HesapServisi.hesapDurumu() */
export function hesapKarti(durum) {
  const alt = (metin) => el('p', { class: 'kart__alt' }, metin);
  let govde;
  if (!durum.sunucuVar) {
    // Sunucu adresi henüz koda yazılmadı: dürüstçe söyle, kutu gösterme.
    govde = [alt(t('hesap.kapali', 'Hesaplar henüz açık değil. Kayıtlar yalnız bu cihazda; şimdilik tek yedek dosya yedeği.'))];
  } else if (durum.girisli) {
    govde = [
      alt(t('hesap.girisli', 'Giriş yapıldı: {u}', { u: durum.kullanici })),
      alt(durum.sonEsitleme
        ? t('hesap.son', 'Son eşitleme: {t}', { t: tarihSaatMetni(durum.sonEsitleme) })
        : t('hesap.hic', 'Henüz eşitlenmedi.')),
    ];
  } else {
    govde = [alt(t('hesap.cikisli', 'Bu cihaz bir hesaba bağlı değil.'))];
  }
  const hata = durum.hataKodu && (durum.kaliciHata || durum.girisli)
    ? el('div', { class: 'uyari uyari--hata' }, simge('hata', { boy: 16 }),
      el('span', {}, hataMetni({ kod: durum.hataKodu, veri: durum.hataVeri }, t('hata.senkron_olmadi', 'Eşitleme olmadı.'))))
    : null;
  return kart({},
    el('div', { class: 'kart__bas' },
      el('h2', {}, t('hesap.baslik', 'Hesap')),
      durum.girisli ? rozet(t('hesap.bagli', 'bağlı'), 'yesil') : null),
    ...govde,
    hata);
}
