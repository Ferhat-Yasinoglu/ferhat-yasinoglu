// Panel: günün özeti — kaç ilaç, kaç hasta, neyin stoğu bitiyor, neyin tarihi geçiyor.
import { el, temizle, btnS, kart, sayacKutusu, sayfaBas, bosDurum, sirala, rozet } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { ilacEtiketi, stokDurumu, sktDurumu } from '../paylasilan/ilac.js';
import { trTarih, goreliGun } from '../paylasilan/tarih.js';
import { tamAd } from '../paylasilan/hasta.js';
import { basHarfler } from '../paylasilan/metin.js';
import { receteOzet, DURUM_ADLARI } from '../paylasilan/recete.js';
import { t } from '../i18n.js';

const DURUM_RENGI = { bekliyor: 'sari', kismi: 'mavi', tamamlandi: 'yesil', bos: 'gri' };

/** Kısa liste kartı: başlık + en çok 6 satır + "hepsini gör" bağlantısı. */
function listeKarti({ baslik, simgeAdi, satirlar, bos, tumuYol, tumuAd }) {
  const kap = el('div', { class: 'liste' });
  for (const s of satirlar.slice(0, 6)) {
    kap.appendChild(el('a', { class: 'liste__satir', href: '#' + s.yol },
      el('span', { class: 'avatar' }, s.harf || simge(simgeAdi, { boy: 18 })),
      el('div', { class: 'liste__govde' },
        el('div', { class: 'liste__baslik' }, s.baslik),
        el('div', { class: 'liste__alt' }, s.alt)),
      s.rozet ? el('div', { class: 'liste__son' }, s.rozet) : null));
  }
  sirala(kap);
  return kart({},
    el('div', { class: 'kart__bas' },
      el('h2', {}, baslik),
      satirlar.length > 6 && tumuYol ? el('a', { class: 'kart__alt', href: '#' + tumuYol }, tumuAd || t('genel.hepsini_gor', 'Hepsini gör')) : null),
    satirlar.length ? kap : bosDurum({ simge: simgeAdi, baslik: bos }));
}

export default {
  baslik: 'Panel',
  async cizim(kok, ctx) {
    const { depo, git } = ctx;

    let sira = 0;
    async function ciz() {
      const benim = ++sira;
      const [ilaclar, hastalar, receteler] = await Promise.all([
        depo.listele('ilaclar'), depo.listele('hastalar'), depo.listele('receteler'),
      ]);
      if (benim !== sira) return;
      temizle(kok);

      const azalan = ilaclar.filter((i) => stokDurumu(i) === 'kritik');
      const tukenen = ilaclar.filter((i) => stokDurumu(i) === 'yok');
      const sktYakin = ilaclar.filter((i) => sktDurumu(i) === 'yaklasiyor')
        .sort((a, b) => String(a.sonKullanma).localeCompare(String(b.sonKullanma)));
      const sktGecti = ilaclar.filter((i) => sktDurumu(i) === 'gecti');
      const bekleyen = receteler.filter((r) => ['bekliyor', 'kismi'].includes(receteOzet(r).durum));

      kok.append(sayfaBas(t('nav.panel', 'Panel'), {
        alt: t('panel.alt', 'Stok, hasta ve reçete durumu.'),
        eylemler: [
          btnS('recete', t('recete.yaz', 'Reçete yaz'), { class: 'btn btn--birincil', onclick: () => git('/recete/yeni') }),
          btnS('arti', t('ilac.ekle', 'İlaç ekle'), { class: 'btn', onclick: () => git('/ilaclar') }),
          btnS('hasta', t('hasta.ekle', 'Hasta ekle'), { class: 'btn', onclick: () => git('/hastalar') }),
        ],
      }));

      kok.appendChild(el('div', { class: 'izgara', style: { marginBlockEnd: 'var(--b-5)' } },
        sayacKutusu({ baslik: t('panel.ilac_cesidi', 'İlaç çeşidi'), deger: ilaclar.length, alt: t('panel.kutu_stok', '{n} kutu stok', { n: ilaclar.reduce((a, i) => a + Number(i.stok || 0), 0) }), simge: 'ilac', tur: 'vurgu', yol: '/ilaclar' }),
        sayacKutusu({ baslik: t('nav.hasta', 'Hasta'), deger: hastalar.length, alt: t('panel.kayitli', 'kayıtlı'), simge: 'hasta', tur: 'vurgu', yol: '/hastalar' }),
        sayacKutusu({ baslik: t('panel.stok_uyarisi', 'Stok uyarısı'), deger: azalan.length + tukenen.length, alt: t('panel.stok_alt', '{a} tükendi · {b} azaldı', { a: tukenen.length, b: azalan.length }), simge: 'kutu', tur: (azalan.length + tukenen.length) ? 'uyari' : 'notr', yol: '/ilaclar?suzgec=azalan' }),
        sayacKutusu({ baslik: t('ilac.son_kullanma', 'Son kullanma'), deger: sktYakin.length + sktGecti.length, alt: t('panel.skt_alt', '{a} geçti · {b} yaklaşıyor', { a: sktGecti.length, b: sktYakin.length }), simge: 'takvim', tur: sktGecti.length ? 'hata' : sktYakin.length ? 'uyari' : 'notr', yol: '/ilaclar?suzgec=skt_yakin' }),
        sayacKutusu({ baslik: t('panel.bekleyen_recete', 'Bekleyen reçete'), deger: bekleyen.length, alt: t('panel.recete_toplam', '{n} reçete toplam', { n: receteler.length }), simge: 'recete', tur: bekleyen.length ? 'uyari' : 'notr', yol: '/receteler?suzgec=acik' })));

      const stokSatirlari = [...tukenen, ...azalan].map((i) => ({
        yol: `/ilac/${i.id}`, baslik: ilacEtiketi(i),
        alt: `${t('ilac.stok', 'Stok')} ${i.stok ?? 0}${i.kritikStok ? ` · ${t('panel.esik', 'eşik {n}', { n: i.kritikStok })}` : ''}`,
        rozet: rozet(stokDurumu(i) === 'yok' ? t('panel.tukendi', 'Tükendi') : t('panel.azaldi', 'Azaldı'), stokDurumu(i) === 'yok' ? 'kirmizi' : 'sari'),
      }));
      const sktSatirlari = [...sktGecti, ...sktYakin].map((i) => ({
        yol: `/ilac/${i.id}`, baslik: ilacEtiketi(i),
        alt: `${trTarih(i.sonKullanma)} · ${goreliGun(i.sonKullanma)}`,
        rozet: rozet(sktDurumu(i) === 'gecti' ? t('panel.gecti', 'Geçti') : t('panel.yakin', 'Yakın'), sktDurumu(i) === 'gecti' ? 'kirmizi' : 'sari'),
      }));

      kok.appendChild(listeKarti({ baslik: t('panel.stok_uyarilari', 'Stok uyarıları'), simgeAdi: 'kutu', satirlar: stokSatirlari, bos: t('panel.stok_yeterli', 'Stoklar yeterli'), tumuYol: '/ilaclar?suzgec=azalan' }));
      kok.appendChild(listeKarti({ baslik: t('ilac.son_kullanma', 'Son kullanma tarihi'), simgeAdi: 'takvim', satirlar: sktSatirlari, bos: t('panel.skt_yok', 'Yaklaşan son kullanma yok'), tumuYol: '/ilaclar?suzgec=skt_yakin' }));

      if (bekleyen.length) {
        const hastaAdi = (id) => tamAd(hastalar.find((h) => h.id === id)) || t('nav.hasta', 'Hasta');
        kok.appendChild(listeKarti({
          baslik: t('panel.bekleyen_receteler', 'Bekleyen reçeteler'), simgeAdi: 'recete',
          satirlar: bekleyen.map((r) => {
            const o = receteOzet(r);
            return { yol: `/recete/${r.id}`, baslik: hastaAdi(r.hastaId), alt: `${r.receteNo || trTarih(r.tarih)} · ${t('panel.ilac_bekliyor', '{n} ilaç bekliyor', { n: o.bekleyen })}`, rozet: rozet(t('durum.' + o.durum, DURUM_ADLARI[o.durum]), DURUM_RENGI[o.durum]) };
          }),
          bos: t('panel.bekleyen_yok', 'Bekleyen reçete yok'),
        }));
      }

      if (hastalar.length) {
        const son = [...hastalar].sort((a, b) => String(b.olusturuldu).localeCompare(String(a.olusturuldu))).slice(0, 6);
        kok.appendChild(listeKarti({
          baslik: t('panel.son_hastalar', 'Son eklenen hastalar'), simgeAdi: 'hasta',
          satirlar: son.map((h) => ({ yol: `/hasta/${h.id}`, baslik: tamAd(h), alt: h.telefon || '—', harf: basHarfler(tamAd(h)) })),
          bos: t('panel.hasta_yok', 'Hasta yok'), tumuYol: '/hastalar',
        }));
      }

      if (!ilaclar.length && !hastalar.length) {
        kok.appendChild(kart({}, bosDurum({
          simge: 'bilgi', baslik: t('panel.bos', 'Uygulama boş'),
          alt: t('panel.bos_alt', 'İlaç ve hasta ekleyerek başla. Denemek istersen Ayarlar\'dan örnek verileri yükleyebilirsin — sonra tek tuşla silinir.'),
          eylem: btnS('ayarlar', t('panel.ayarlara_git', 'Ayarlar\'a git'), { class: 'btn btn--birincil', onclick: () => git('/ayarlar') }),
        })));
      }
    }

    await ciz();
    const birak = [depo.dinle('ilaclar', ciz), depo.dinle('hastalar', ciz), depo.dinle('receteler', ciz)];
    return () => birak.forEach((f) => f());
  },
};
