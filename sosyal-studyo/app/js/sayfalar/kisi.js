// Kişi kartı: kimlik, etiketler, değişkenler, puan geçmişi, olaylar, silme (KVKK).
import { el, btn, kart, rozet, temizle, girdi, goreliZaman, sayfaBas } from '../cekirdek/dom.js';
import { simge } from '../cekirdek/simge.js';
import { pencereAcik, pencereKalan } from '../paylasilan/kanallar.js';

export default {
  baslik: 'Kişi',
  async cizim(kok, ctx) {
    const { depo, t, git, onayla, sor } = ctx;
    temizle(kok);
    const k = await depo.al('kisiler', ctx.param.id);
    if (!k) { kok.appendChild(el('p', { class: 'durum-hata' }, t('kisi.yok', 'Kişi bulunamadı'))); return; }
    const puanlar = await depo.listele('puan_olaylari', { filtre: { kisi_id: k.id }, sirala: 'olusturuldu', azalan: true });
    const olaylar = await depo.listele('gunluk', { filtre: { kisi_id: k.id }, sirala: 'zaman', azalan: true, limit: 20 });
    const kosular = await depo.listele('kosular', { filtre: { kisi_id: k.id, durum: 'waiting' } });
    const kalan = pencereKalan(k);
    const etiketKap = el('div', { class: 'satir' });
    function etiketleriCiz(kisi) { temizle(etiketKap); for (const e of kisi.etiketler || []) etiketKap.appendChild(el('span', { class: 'cip' }, e, btn(simge('kapat'), { onclick: async () => { const y = await depo.kaydet('kisiler', { ...kisi, etiketler: kisi.etiketler.filter((x) => x !== e) }); etiketleriCiz(y); } }))); etiketKap.appendChild(btn('+', { class: 'btn btn--kucuk', onclick: async () => { const e = await sor(t('kisiler.etiket_adi', 'Etiket adı')); if (e && !(kisi.etiketler || []).includes(e)) { const y = await depo.kaydet('kisiler', { ...kisi, etiketler: [...(kisi.etiketler || []), e] }); etiketleriCiz(y); } } })); }
    etiketleriCiz(k);
    const degiskenler = el('div', { class: 'tablo-kap' }, el('table', { class: 'tablo' }, el('tbody', {}, ...Object.entries(k.degiskenler || {}).map(([a, v]) => el('tr', {}, el('th', {}, a), el('td', {}, String(v)))))));
    kok.append(
      el('div', { class: 'sayfa-bas' }, btn(simge('sol'), { class: 'btn btn--ikon btn--sade', 'aria-label': t('geri', 'Geri'), onclick: () => history.back() }), el('div', { class: 'avatar' }, (k.ad || '?').slice(0, 1).toUpperCase()), el('div', { class: 'sayfa-bas__govde' }, el('h1', {}, k.ad || k.kullanici_adi), el('p', { class: 'sayfa-bas__alt' }, [k.kanal, k.kullanici_adi ? '@' + k.kullanici_adi : ''].filter(Boolean).join(' · ')))),
      el('div', { class: 'satir', style: { marginBottom: '12px' } }, rozet(k.kanal, 'mavi'), kalan === null ? rozet('∞ ' + t('kisi.pencere_sinirsiz', 'pencere sınırsız'), 'yesil') : pencereAcik(k) ? rozet(`${Math.ceil(kalan)} sa`, 'yesil') : rozet(simge('hata', { boy: 18 }), t('sohbet.kapandi', 'pencere kapalı'), 'kirmizi'), k.takip_ediyor === true ? rozet(t('kisi.takip', 'takip ediyor'), 'altin') : k.takip_ediyor === false ? rozet(t('kisi.takip_yok', 'takip etmiyor'), 'gri') : null, k.demo ? rozet('Demo', 'gri') : null),
      kart(el('h2', { class: 'kart__baslik' }, t('kisi.kimlik', 'Kimlik')), el('p', { class: 'kart__alt' }, `@${k.kullanici_adi || '—'} · ${k.dis_id} · ${t('kisi.kaynak', 'kaynak')}: ${k.kaynak || '—'} · ${t('kisi.son', 'son mesaj')}: ${goreliZaman(k.son_gelen, t)}`), kosular.length ? el('p', {}, simge('oynat'), '' + t('kisi.aktif_akis', 'Aktif akış var')) : null),
      kart(el('h2', { class: 'kart__baslik' }, t('kisi.etiketler', 'Etiketler')), etiketKap),
      kart(el('h2', { class: 'kart__baslik' }, t('kisi.degiskenler', 'Değişkenler')), Object.keys(k.degiskenler || {}).length ? degiskenler : el('p', { class: 'kart__alt' }, '—')),
      kart(el('h2', { class: 'kart__baslik' }, simge('yildiz'), `${t('kisi.puan', 'Puan')}: ${k.puan || 0}`), el('div', { class: 'satir' }, btn('+5', { class: 'btn btn--kucuk', onclick: () => puanEkle(5) }), btn('−5', { class: 'btn btn--kucuk', onclick: () => puanEkle(-5) })), ...puanlar.slice(0, 10).map((p) => el('div', { class: 'kart__alt' }, `${p.delta > 0 ? '+' : ''}${p.delta} · ${p.neden} · ${goreliZaman(p.olusturuldu, t)}`))),
      kart(el('h2', { class: 'kart__baslik' }, t('kisi.olaylar', 'Son olaylar')), ...(olaylar.length ? olaylar.map((o) => el('div', { class: 'kart__alt' }, `${goreliZaman(o.zaman, t)} · ${o.olay_tipi}: ${o.metin_ozeti || ''} → ${o.karar?.tur || ''}`)) : [el('p', { class: 'kart__alt' }, '—')])),
      el('div', { class: 'satir' }, btn(t('sohbet.ac', 'Sohbeti aç'), { onclick: () => git('/sohbetler') }), btn(t('kisi.sil', 'Kişiyi sil (KVKK)'), { class: 'btn btn--tehlike', onclick: async () => { if (await onayla(t('kisi.sil_onay', 'Kişi ve verileri silinecek, geri alınamaz.'), { tehlikeli: true, yazarakOnay: 'SİL' })) { await depo.sil('kisiler', k.id); for (const p of puanlar) await depo.sil('puan_olaylari', p.id); git('/kisiler'); } } })),
    );
    async function puanEkle(delta) { const y = await depo.kaydet('kisiler', { ...(await depo.al('kisiler', k.id)), puan: (k.puan || 0) + delta }); await depo.kaydet('puan_olaylari', { kisi_id: k.id, delta, neden: 'elle', kaynak: 'manuel', olay_anahtari: 'manuel:' + Date.now() }); k.puan = y.puan; ctx.basari(`${t('kisi.puan', 'Puan')}: ${y.puan}`); ctx.git(`/kisi/${k.id}`); }
  },
};
