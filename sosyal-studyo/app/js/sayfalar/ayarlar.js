// Ayarlar & Kurulum: genel, kanallar, worker, yedek, gizlilik.
import { el, btn, kart, rozet, temizle, girdi, secim, alan, goreliZaman } from '../cekirdek/dom.js';
import { DILLER, suankiDil } from '../i18n.js';
import { KANALLAR } from '../paylasilan/kanallar.js';
import { tohumla } from '../depo/tohum.js';
import { indir, paylas, dosyadanOku, hatirlatmaGerekli } from '../depo/yedek.js';
import { yedekDogrula } from '../paylasilan/sema/yedek-belgesi.js';

export default {
  baslik: 'Ayarlar',
  async cizim(kok, ctx) {
    const { depo, t, git, modal, onayla } = ctx;
    temizle(kok);
    let sekme = ctx.param.sekme || 'genel';
    const sekmeler = el('div', { class: 'sekmeler' });
    const govde = el('div', {});
    for (const [k, ad] of [['genel', t('ayar.genel', 'Genel')], ['kanallar', t('ayar.kanallar', 'Kanallar')], ['worker', 'Worker'], ['yedek', t('ayar.yedek', 'Yedek')], ['gizlilik', t('ayar.gizlilik', 'Gizlilik')]]) sekmeler.appendChild(el('button', { class: 'sekme', 'aria-selected': String(sekme === k), onclick: (e) => { sekme = k; [...sekmeler.children].forEach((x) => x.setAttribute('aria-selected', String(x === e.currentTarget))); history.replaceState(null, '', `#/ayarlar/${k}`); ciz(); } }, ad));
    kok.append(el('h1', {}, t('nav.ayarlar', 'Ayarlar & Kurulum')), sekmeler, govde);

    async function genelCiz() {
      temizle(govde);
      const a = await depo.ayarlar();
      const meta = await depo.meta();
      govde.append(kart(alan(t('ayar.dil', 'Dil'), secim(DILLER, { value: suankiDil(), onchange: (e) => ctx.dilDegistir(e.target.value) })), alan(t('ayar.tema', 'Tema'), secim([['dark', t('ayar.koyu', 'Koyu')], ['light', t('ayar.acik', 'Açık')]], { value: document.documentElement.dataset.theme, onchange: (e) => { document.documentElement.dataset.theme = e.target.value; try { localStorage.setItem('ss-tema', e.target.value); } catch {} } })), alan(t('ayar.proje', 'Proje / işletme adı'), girdi({ value: a.isletme?.ad || '', onchange: (e) => depo.ayarKaydet('isletme', { ...(a.isletme || {}), ad: e.target.value }) })), alan(t('ayar.saat', 'Saat dilimi'), girdi({ value: a.isletme?.saatDilimi || Intl.DateTimeFormat().resolvedOptions().timeZone, onchange: (e) => depo.ayarKaydet('isletme', { ...(a.isletme || {}), saatDilimi: e.target.value }) }))),
        kart(el('h2', { class: 'kart__baslik' }, t('ayar.demo', 'Demo verisi')), el('p', { class: 'kart__alt' }, meta.tohumlandi ? t('ayar.demo_var', 'Demo verisi yüklü (demo rozetli kayıtlar).') : t('ayar.demo_yok', 'Demo verisi yüklü değil.')), el('div', { class: 'satir' }, btn(t('ayar.demo_yukle', 'Demo verisini yükle'), { class: 'btn btn--kucuk', onclick: async () => { await tohumla(depo, { zorla: true }); ctx.basari(t('ayar.demo_yuklendi', 'Demo yüklendi')); genelCiz(); } }), btn(t('ayar.demo_sil', 'Demo verisini temizle'), { class: 'btn btn--kucuk btn--tehlike', onclick: async () => { if (await onayla(t('ayar.demo_sil_onay', 'Demo rozetli bütün kayıtlar silinecek.'), { tehlikeli: true })) { const n = await depo.demoSil(); ctx.basari(t('ayar.demo_silindi', '{n} kayıt silindi', { n })); genelCiz(); } } }))),
        kart(el('h2', { class: 'kart__baslik' }, t('ayar.surum', 'Sürüm')), el('p', { class: 'kart__alt' }, `Sosyal Stüdyo ${ctx.uygulamaSurumu} · ${t('ayar.sema', 'şema')} ${meta.sema_surumu || 1} · ${depo.mod}${depo.kalici ? '' : ' (' + t('ayar.kalici_degil', 'kalıcı değil') + ')'}`), el('a', { href: 'https://github.com/Ferhat-Yasinoglu/ferhat-yasinoglu/tree/main/sosyal-studyo', target: '_blank', rel: 'noopener' }, 'GitHub')));
    }
    async function kanallarCiz() {
      temizle(govde);
      const hesaplar = await depo.listele('hesaplar');
      const kartlar = el('div', { class: 'izgara' });
      for (const h of hesaplar) {
        const k = KANALLAR[h.kanal] || {};
        kartlar.appendChild(kart(el('div', { class: 'satir satir--arasi' }, el('span', { class: 'kart__baslik' }, `${k.simge || ''} ${h.ad}`), rozet(h.durum === 'canli' ? t('kanal.canli', 'Canlı') : h.durum === 'prova' ? t('kanal.prova', 'Prova') : t('kanal.bagli_degil', 'Bağlı değil'), h.durum === 'canli' ? 'yesil' : h.durum === 'prova' ? 'mavi' : 'gri')), el('p', { class: 'kart__alt' }, `${h.kanal} · ${h.dis_id || '—'}${h.token_bitis ? ' · token ' + goreliZaman(h.token_bitis, t) : ''}${h.demo ? ' · demo' : ''}`),
          el('div', { class: 'satir' }, btn(h.durum === 'canli' ? t('kanal.provaya', 'Provaya al') : t('kanal.canliya', 'Canlıya al'), { class: 'btn btn--kucuk ' + (h.durum === 'canli' ? '' : 'btn--birincil'), onclick: async () => { if (h.durum === 'canli') { await depo.kaydet('hesaplar', { ...h, durum: 'prova' }); kanallarCiz(); return; } if ((await ctx.mod()) !== 'bagli') { ctx.hata(t('kanal.canli_worker', 'Canlıya almak için Worker bağlı olmalı.')); return; } if (await onayla(t('kanal.canli_onay', 'Bu hesap gerçek mesaj göndermeye başlayacak.'), { yazarakOnay: 'CANLI' })) { await depo.kaydet('hesaplar', { ...h, durum: 'canli' }); kanallarCiz(); } } }), btn(t('kanal.kur', 'Kurulum'), { class: 'btn btn--kucuk', onclick: () => git(`/ayarlar/kurulum/${h.kanal}`) }), btn(t('genel.sil', 'Sil'), { class: 'btn btn--kucuk btn--tehlike', onclick: async () => { if (await onayla(t('kanal.sil_onay', 'Hesap bağlantısı silinecek (kişiler kalır).'), { tehlikeli: true, yazarakOnay: 'delete' })) { await depo.sil('hesaplar', h.id); kanallarCiz(); } } }))));
      }
      const ekle = el('div', { class: 'izgara izgara--dar' }, ...Object.entries(KANALLAR).map(([k, b]) => kart(el('div', { class: 'satir satir--arasi' }, el('span', { class: 'kart__baslik' }, `${b.simge} ${b.ad}`), rozet(b.etiket.ad, b.etiket.renk)), el('p', { class: 'kart__alt' }, b.ozet), btn(b.kurulum_dk ? `${t('kanal.kur', 'Kur')} · ~${b.kurulum_dk} dk` : t('kanal.bilgi', 'Bilgi'), { class: 'btn btn--kucuk', onclick: () => git(`/ayarlar/kurulum/${k}`) }))));
      govde.append(hesaplar.length ? kartlar : el('p', { class: 'kart__alt' }, t('kanal.yok', 'Bağlı hesap yok.')), el('h2', {}, t('kanal.ekle', 'Kanal ekle')), ekle);
    }
    async function workerCiz() {
      temizle(govde);
      const a = await depo.ayarlar();
      const adres = girdi({ value: a.worker?.adres || '', placeholder: 'https://sosyal-studyo.<hesap>.workers.dev', inputmode: 'url' });
      const anahtar = girdi({ type: 'password', placeholder: t('worker.anahtar', 'Yönetici anahtarı (≥32 karakter)'), autocomplete: 'off' });
      const hatirla = el('label', { class: 'cip' }, el('input', { type: 'checkbox', checked: !!(await depo.gizli('yonetici')) }), ' ' + t('worker.hatirla', 'bu cihazda hatırla'));
      const sonuc = el('div', {});
      async function dogrula() {
        const url = adres.value.trim().replace(/\/$/, '');
        if (!/^https:\/\//.test(url)) { ctx.hata(t('worker.https', 'Adres https ile başlamalı')); return; }
        sonuc.replaceChildren(el('p', { class: 'kart__alt' }, '…'));
        try {
          const r = await fetch(url + '/health', { headers: { 'X-SS-Sema': '1' } }); const j = await r.json();
          const anahtarDeger = anahtar.value.trim() || (await depo.gizli('yonetici')) || '';
          const d = await fetch(url + '/api/durum', { headers: { Authorization: 'Bearer ' + anahtarDeger, 'X-SS-Sema': '1' } });
          if (d.status === 401) throw new Error(t('worker.401', 'Yönetici anahtarı yanlış (401).'));
          if (d.status === 429) throw new Error(t('worker.429', 'Çok fazla deneme; 15 dakika bekle.'));
          if (d.status === 503) throw new Error(t('worker.503', 'Worker eksik yapılandırılmış (503): D1 bağlı değil ya da secret eksik.'));
          const dj = await d.json();
          await depo.ayarKaydet('worker', { adres: url }); await depo.ayarKaydet('mod', 'bagli');
          if (hatirla.firstChild.checked && anahtar.value.trim()) await depo.gizliKaydet('yonetici', anahtar.value.trim()); else if (!hatirla.firstChild.checked) await depo.gizliSil('yonetici');
          sonuc.replaceChildren(kart(el('h2', { class: 'kart__baslik' }, '✓ ' + t('worker.bagli', 'Bağlandı')), el('p', { class: 'kart__alt' }, `${t('ayar.surum', 'Sürüm')} ${j.surum || '?'} · ${t('ayar.sema', 'şema')} ${j.sema} · ${j.prova ? 'PROVA' : 'CANLI'} · AI: ${j.saglayici || 'yok'}`), ...((dj.veri?.doktor || []).map((x) => el('div', { class: 'kart__alt' }, `${{ ok: '✓', warn: '!', fail: '✗' }[x.durum] || '·'} ${x.ad}: ${x.detay || ''}`)))));
          ctx.basari(t('worker.bagli', 'Bağlandı')); setTimeout(() => location.reload(), 800);
        } catch (e) { sonuc.replaceChildren(el('div', { class: 'bant bant--kirmizi' }, e.message.includes('fetch') ? t('worker.ag', 'Worker\'a ulaşılamadı: adres yanlış ya da ALLOWED_ORIGINS bu siteyi içermiyor: ') + location.origin : e.message)); }
      }
      govde.append(el('p', { class: 'kart__alt' }, t('worker.aciklama', 'Worker: Cloudflare\'de çalışan sunucusuz çalışma zamanı — webhook\'lar, akış motoru, kişiler, toplu mesaj, AI. Ücretsiz katman yeter. Kurulum rehberi depodaki sosyal-studyo/worker/README.md\'de.')),
        kart(alan(t('worker.adres', 'Worker adresi'), adres), alan(t('worker.anahtar_etiket', 'Yönetici anahtarı'), anahtar, { ipucu: t('worker.anahtar_ipucu', 'Tarayıcıda saklanmaz; "hatırla" işaretliyse yalnız bu cihazın IndexedDB\'sinde durur, yedeğe girmez.') }), hatirla, el('div', { class: 'satir', style: { marginTop: '8px' } }, btn(t('worker.baglan', 'Bağlan / doğrula'), { class: 'btn btn--birincil', onclick: dogrula }), a.mod === 'bagli' ? btn(t('worker.yerel', 'Yerel moda dön'), { onclick: async () => { await depo.ayarKaydet('mod', 'yerel'); location.reload(); } }) : null)), sonuc,
        kart(el('h2', { class: 'kart__baslik' }, t('worker.baglantilar', 'Bağlantılar')), el('a', { href: 'https://github.com/Ferhat-Yasinoglu/ferhat-yasinoglu/tree/main/sosyal-studyo/worker', target: '_blank', rel: 'noopener' }, 'worker/README.md — kurulum'), el('a', { href: 'https://dash.cloudflare.com/', target: '_blank', rel: 'noopener' }, 'Cloudflare paneli'), el('a', { href: 'https://github.com/Ferhat-Yasinoglu/ferhat-yasinoglu/actions', target: '_blank', rel: 'noopener' }, 'GitHub Actions')));
    }
    async function yedekCiz() {
      temizle(govde);
      const meta = await depo.meta(); const a = await depo.ayarlar();
      const h = hatirlatmaGerekli(meta, a);
      const onizleme = el('div', {});
      const dosya = el('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => { const f = dosya.files[0]; if (!f) return; try { const belge = await dosyadanOku(f); const d = await yedekDogrula(belge); if (!d.gecerli) { onizleme.replaceChildren(el('div', { class: 'bant bant--kirmizi' }, d.hatalar.join(' · '))); return; } const prova = await depo.iceAktar(belge, { prova: true }); const ozet = Object.entries(prova.rapor).filter(([, r]) => r.eklendi || r.guncellendi).map(([k, r]) => `${k}: +${r.eklendi} ↻${r.guncellendi}`).join(' · ') || t('yedek.degisiklik_yok', 'değişiklik yok'); onizleme.replaceChildren(kart(el('p', {}, `${t('yedek.dosya', 'Dosya')}: ${belge.olusturuldu} · ${t('ayar.sema', 'şema')} ${belge.sema_surumu}`), el('p', { class: 'kart__alt' }, ozet), el('div', { class: 'satir' }, btn(t('yedek.birlestir', 'Birleştir (yeni olan kazanır)'), { class: 'btn btn--birincil', onclick: async () => { const r = await depo.iceAktar(belge, { strateji: 'birlestir' }); ctx.basari(r.ok ? t('yedek.alindi', 'Yedek alındı') : r.hatalar.join()); yedekCiz(); } }), btn(t('yedek.degistir', 'Değiştir (mevcutu sil)'), { class: 'btn btn--tehlike', onclick: async () => { if (await onayla(t('yedek.degistir_onay', 'Yedekteki koleksiyonlar mevcut veriyi tümüyle değiştirecek.'), { tehlikeli: true, yazarakOnay: 'DEĞİŞTİR' })) { const r = await depo.iceAktar(belge, { strateji: 'degistir' }); ctx.basari(r.ok ? t('yedek.alindi', 'Yedek alındı') : r.hatalar.join()); yedekCiz(); } } })))); } catch (e) { onizleme.replaceChildren(el('div', { class: 'bant bant--kirmizi' }, e.message)); } } });
      govde.append(h.gerekli ? el('div', { class: 'bant bant--sari' }, '💾 ' + h.sebep) : el('div', { class: 'bant bant--mavi' }, '✓ ' + t('yedek.guncel', 'Yedek güncel')),
        kart(el('h2', { class: 'kart__baslik' }, t('yedek.al', 'Yedek al')), el('p', { class: 'kart__alt' }, `${t('yedek.son', 'Son yedek')}: ${meta.son_yedek ? goreliZaman(meta.son_yedek, t) : '—'} · ${meta.degisiklik_sayaci || 0} ${t('yedek.degisiklik', 'yedeklenmemiş değişiklik')}`), el('p', { class: 'kart__alt' }, t('yedek.aciklama', 'JSON dosyası: akışlar, kişiler, kurallar, içerik. Gizli anahtar ve mesaj içeriği girmez (isteğe bağlı).')), el('div', { class: 'satir' }, btn('⬇ ' + t('bant.yedek_indir', 'Yedeği indir'), { class: 'btn btn--birincil', onclick: async () => { await indir(await depo.disaAktar({ gunlukDahil: gunlukCb.checked })); ctx.basari(t('yedek.indirildi', 'Yedek indirildi')); ctx.yenileBantlar(); yedekCiz(); } }), btn('📤 ' + t('yedek.paylas', 'Paylaş (Drive, Dosyalar…)'), { onclick: async () => { const ok = await paylas(await depo.disaAktar({ gunlukDahil: gunlukCb.checked })); if (!ok) ctx.bildir(t('yedek.paylas_yok', 'Bu cihazda dosya paylaşımı yok; indir.')); else { ctx.yenileBantlar(); yedekCiz(); } } })), el('label', { class: 'cip' }, (function () { return gunlukCb; })(), ' ' + t('yedek.gunluk_dahil', 'günlük ve mesajlar dahil'))),
        kart(el('h2', { class: 'kart__baslik' }, t('yedek.geri', 'Geri yükle')), el('label', { class: 'btn' }, '⬆ ' + t('yedek.dosya_sec', 'Yedek dosyası seç'), dosya), onizleme),
        kart(el('h2', { class: 'kart__baslik' }, t('yedek.hatirlatma', 'Hatırlatma')), el('div', { class: 'satir' }, alan(t('yedek.aralik', 'Her N günde'), girdi({ type: 'number', value: a.yedek?.aralikGun ?? 7, onchange: (e) => depo.ayarKaydet('yedek', { ...(a.yedek || {}), aralikGun: Number(e.target.value) }) })), alan(t('yedek.esik', 'ya da N değişiklikte'), girdi({ type: 'number', value: a.yedek?.esikDegisiklik ?? 20, onchange: (e) => depo.ayarKaydet('yedek', { ...(a.yedek || {}), esikDegisiklik: Number(e.target.value) }) })))));
      var gunlukCb = el('input', { type: 'checkbox' });
    }
    async function gizlilikCiz() {
      temizle(govde);
      const a = await depo.ayarlar();
      govde.append(kart(el('h2', { class: 'kart__baslik' }, t('gizlilik.baslik', 'KVKK / GDPR')), el('p', { class: 'kart__alt' }, t('gizlilik.aciklama', 'Kişi verileri yerel modda yalnız bu cihazda, bağlı modda senin Cloudflare hesabındaki D1\'de durur. Üçüncü taraf analitik yok. Mesaj içeriği yedeğe yalnız işaretlersen girer.')), alan(t('gizlilik.mesaj', 'Mesaj saklama (gün, bağlı mod)'), girdi({ type: 'number', value: a.gunluk?.mesajSaklamaGun ?? 30, onchange: (e) => depo.ayarKaydet('gunluk', { ...(a.gunluk || {}), mesajSaklamaGun: Number(e.target.value) }) })), alan(t('gizlilik.gunluk', 'Günlük saklama (gün)'), girdi({ type: 'number', value: a.gunluk?.saklamaGun ?? 14, onchange: (e) => depo.ayarKaydet('gunluk', { ...(a.gunluk || {}), saklamaGun: Number(e.target.value) }) }))),
        kart(el('h2', { class: 'kart__baslik' }, t('gizlilik.sil', 'Verileri sil')), el('div', { class: 'satir' }, btn(t('gizlilik.gunluk_sil', 'Günlüğü temizle'), { class: 'btn btn--kucuk', onclick: async () => { const n = await depo.kaliciSil('gunluk'); ctx.basari(`${n} ${t('gizlilik.kayit', 'kayıt silindi')}`); } }), btn(t('gizlilik.kisi_sil', 'Tüm kişi verilerini sil'), { class: 'btn btn--kucuk btn--tehlike', onclick: async () => { if (await onayla(t('gizlilik.kisi_sil_onay', 'Bütün kişiler, sohbetler, puanlar ve koşular silinecek. Geri alınamaz.'), { tehlikeli: true, yazarakOnay: 'SİL' })) { let n = 0; for (const k of ['kisiler', 'sohbetler', 'mesajlar', 'puan_olaylari', 'kosular', 'gunluk']) n += await depo.kaliciSil(k); ctx.basari(`${n} ${t('gizlilik.kayit', 'kayıt silindi')}`); } } }))));
    }
    function ciz() { ({ genel: genelCiz, kanallar: kanallarCiz, worker: workerCiz, yedek: yedekCiz, gizlilik: gizlilikCiz }[sekme] || genelCiz)(); }
    ciz();
  },
};
