/* Şemsi tarih seçici.
 *
 * Tarayıcının kendi <input type="date"> takvimi MİLADİ. Hekim ve hastaları
 * şemsi kullanıyor: doğum tarihini «۱۳۶۵» diye biliyor, reçetenin gününü
 * şemsi söylüyor. Miladi bir kutu ona her seferinde kafadan çevirtiyordu —
 * doğum tarihinde bu düpedüz hata kaynağı.
 *
 * Bu yüzden kutu da takvim de şemsi. DEPOYA GİREN DEĞER DEĞİŞMİYOR: gizli
 * alanda miladi ISO (YYYY-MM-DD) duruyor, formu okuyan kod (govde._oku,
 * formVerisi) onu görüyor. Sıralama, reçete numarası ve sahtecilik özeti
 * ISO'ya bağlı; onlara dokunulmadı.
 *
 * Çevrim paylasilan/tarih.js'te ve Intl'in kendi takvimiyle doğrulanıyor,
 * yani yazılan ile görünen hiçbir tarihte ayrışamaz.
 *
 * Arayüz sağdan sola (index.html'de dir="rtl"): ileri/geri okları da ona
 * göre, "önceki" sağı gösteriyor.
 */
import { el, temizle, btn, btnS, girdi } from './dom.js';
import { simge } from './simge.js';
import {
  bugun, semsiye, semsiden, semsiAyGunu, semsiAyAdi, semsiGunAdlari, semsiAyBasiSutunu,
} from '../paylasilan/tarih.js';
import { t } from '../i18n.js';

/** «۱۴۰۵/۰۶/۳۱» ya da «1405-6-31» → { yil, ay, gun }. Olmazsa null. */
export function semsiMetniCozumle(metin) {
  // Farsça/Arapça rakamlar da kabul: hekim telefonun kendi klavyesiyle
  // yazarsa bunlar geliyor.
  const latin = String(metin ?? '')
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .trim();
  const m = latin.match(/^(\d{4})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{1,2})$/);
  if (!m) return null;
  return { yil: Number(m[1]), ay: Number(m[2]), gun: Number(m[3]) };
}

/** Depoya ancak bu kalıba uyan bir değer girebilir. */
const ISO_KALIBI = /^\d{4}-\d{2}-\d{2}$/;

const iki = (n) => String(n).padStart(2, '0');
const semsiMetni = (iso) => {
  const p = semsiye(iso);
  return p ? `${p.yil}/${iki(p.ay)}/${iki(p.gun)}` : '';
};

/**
 * @param {object} sec
 * @param {string} sec.value   Miladi ISO başlangıç değeri ('' olabilir)
 * @param {string} sec.name    Gizli alanın adı — formu okuyan kod bunu görür
 * @param {function} sec.degisti  (iso) => void
 * @returns {HTMLElement} `.value` ile ISO okunup yazılabilen sarmalayıcı
 */
export function tarihSecici({ value = '', name = '', degisti = () => {}, id = '', etiket = '' } = {}) {
  let iso = /^\d{4}-\d{2}-\d{2}$/.test(String(value).slice(0, 10)) ? String(value).slice(0, 10) : '';
  let acik = false;
  let odak = null;          // Takvimde gezinilen gün { yil, ay, gun }
  let kutuKok = null;
  let gozcu = null;         // Alan DOM'dan koparsa takvimi kapatan gözcü

  const gizli = el('input', { type: 'hidden', name: name || undefined, value: iso });
  const yazi = girdi({
    type: 'text', inputmode: 'numeric', autocomplete: 'off', id: id || undefined,
    dir: 'ltr', placeholder: '1405/06/31', value: semsiMetni(iso),
    // aria-label BİLEREK koşullu: alan() bu kutuyu bir <label> içine alıyor
    // ve ad oradan geliyor. Sabit bir aria-label onu eziyordu — doğum tarihi
    // ekran okuyucuya «تاریخ تولد» yerine «تاریخ (هجری شمسی)» diye
    // tanıtılıyordu. Etiketsiz kullanılacak yerlerde çağıran etiket verir.
    'aria-label': etiket || undefined,
  });
  // Dolgulu takvim: üst çubuktaki tarih kutusuyla aynı çizim.
  const dugme = btn(simge('takvim', { boy: 18, dolu: true }), {
    class: 'tarih-secici__dugme',
    'aria-label': t('tarih.takvim_ac', 'Takvimi aç'),
    'aria-expanded': 'false',
  });
  const kok = el('div', { class: 'tarih-secici' }, yazi, dugme, gizli);

  Object.defineProperty(kok, 'value', {
    get: () => iso,
    set: (v) => { ayarla(/^\d{4}-\d{2}-\d{2}$/.test(String(v).slice(0, 10)) ? String(v).slice(0, 10) : '', true); },
  });

  function ayarla(yeni, sessiz = false) {
    iso = yeni;
    gizli.value = yeni;
    yazi.value = semsiMetni(yeni);
    yazi.classList.remove('input--hata');
    if (!sessiz) degisti(iso);
  }

  /* --- Elle yazma --- */
  yazi.addEventListener('input', () => {
    const ham = yazi.value.trim();
    if (!ham) { iso = ''; gizli.value = ''; yazi.classList.remove('input--hata'); degisti(''); return; }
    const p = semsiMetniCozumle(ham);
    const ceviri = p ? semsiden(p.yil, p.ay, p.gun) : '';
    const cevrilen = ISO_KALIBI.test(ceviri) ? ceviri : '';
    // Yarım yazılan metin («1405/0») henüz yanlış değil; kırmızı yalnız
    // dört haneli yıl yazılmış AMA böyle bir gün yoksa (31 حوت gibi).
    yazi.classList.toggle('input--hata', Boolean(p) && !cevrilen);
    // Yazarken önceki GEÇERLİ değer korunuyor: «1405/0» yazılırken her yarım
    // adımda kâğıttaki tarihi silmek anlamsız olurdu. Karşılığı hiç olmayan
    // metnin depoya taşınması odaktan çıkışta (blur) ele alınıyor.
    if (cevrilen && cevrilen !== iso) { iso = cevrilen; gizli.value = cevrilen; degisti(cevrilen); }
    // Takvim açıkken elle yazılan da oraya yansısın: yoksa takvim eski ayda
    // kalıyor ve bir gün tıklanınca yazılanı eziyordu.
    if (acik && cevrilen) { odak = semsiye(cevrilen) || odak; kutuCiz({ odakla: false }); }
  });
  // Odaktan çıkarken metni düzgün biçime çekiyoruz: «1405/6/3» → «1405/06/03».
  yazi.addEventListener('blur', () => {
    const ham = yazi.value.trim();
    if (!ham) return;
    if (iso) { yazi.value = semsiMetni(iso); yazi.classList.remove('input--hata'); return; }
    // Geçerli bir karşılığı yok: metni SİLMİYORUZ (hekimin yazdığı kaybolmasın)
    // ama gizli alana da aynısını yazıyoruz ki doğrulayıcılar ISO kalıbına
    // uymadığını görüp uyarsın. Önce gizli alan boş kalıyordu ve kutuda tarih
    // görünürken hasta doğum tarihsiz, sessizce kaydediliyordu.
    gizli.value = ham;
    yazi.classList.add('input--hata');
  });
  yazi.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && !acik) { e.preventDefault(); ac(); }
  });

  /* --- Takvim --- */
  dugme.addEventListener('click', () => (acik ? kapat() : ac()));

  function ac() {
    if (acik) return;
    acik = true;
    dugme.setAttribute('aria-expanded', 'true');
    odak = semsiye(iso) || semsiye(bugun());
    kutuKok = el('div', {
      class: 'tarih-kutu', role: 'dialog', 'aria-modal': 'false',
      'aria-label': t('tarih.takvim', 'Takvim'),
    });
    // Modal kendi odak tuzağını kuruyor. Takvim gövdeye eklenince tuzağın
    // DIŞINDA kalıyor ve içinden Tab'lamak odağı doğrudan modalın düğmelerine
    // atıyordu. Modal varsa takvim onun içine giriyor; konumlandırma `fixed`
    // olduğu için kırpılma derdi yok.
    (kok.closest('[role="dialog"]') || document.body).appendChild(kutuKok);
    kutuCiz({ odakla: false });
    yerlestir();
    addEventListener('scroll', yerlestir, true);
    addEventListener('resize', yerlestir);
    addEventListener('pointerdown', disariTikla, true);
    addEventListener('keydown', kacisTusu, true);
    // Takvim GÖVDEYE ekleniyor, alan ise sayfanın içinde. Takvim açıkken
    // başka bir sayfaya geçilirse (ya da ekran yeniden çizilirse) alan yok
    // oluyor, takvim ortada kalıyordu — üstüne pencere dinleyicileri de
    // asılı kalıyordu. İki kapı: adres değişimi ve alanın bağını yitirmesi.
    addEventListener('hashchange', kapat);
    kutuKok.querySelector('[data-odak]')?.focus();
    // Ekran yeniden çizilince (ciz()) alan yenisiyle değişiyor; eskisi
    // koptuğu anda takvim kapanır.
    if (typeof MutationObserver === 'function') {
      gozcu = new MutationObserver(() => { if (!kok.isConnected) kapat(); });
      gozcu.observe(document.body, { childList: true, subtree: true });
    }
  }

  function kapat({ odagiGeriVer = false } = {}) {
    if (!acik) return;
    acik = false;
    dugme.setAttribute('aria-expanded', 'false');
    removeEventListener('scroll', yerlestir, true);
    removeEventListener('resize', yerlestir);
    removeEventListener('pointerdown', disariTikla, true);
    removeEventListener('keydown', kacisTusu, true);
    removeEventListener('hashchange', kapat);
    gozcu?.disconnect();
    gozcu = null;
    kutuKok?.remove();
    kutuKok = null;
    if (odagiGeriVer) yazi.focus();
  }

  const disariTikla = (e) => { if (!kok.contains(e.target) && !kutuKok?.contains(e.target)) kapat(); };
  const kacisTusu = (e) => {
    if (e.key !== 'Escape' || !acik) return;
    // Takvim modalın İÇİNDE de açılıyor. Olay durdurulmazsa aynı Escape hem
    // takvimi hem modalı kapatıyor, yarım doldurulmuş hasta formu uyarısız
    // gidiyordu. İlk Escape yalnız üstteki katmanı kapatır.
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    kapat({ odagiGeriVer: true });
  };

  /* Takvim gövdeye eklendi (position: fixed): kartın ya da pencerenin
     `overflow` kuralları onu kırpamasın. Yeri her kaydırmada yenileniyor. */
  function yerlestir() {
    if (!kutuKok) return;
    if (!kok.isConnected) { kapat(); return; }
    const r = kok.getBoundingClientRect();
    const boy = kutuKok.offsetHeight || 320;
    const en = kutuKok.offsetWidth || 290;
    const altBosluk = innerHeight - r.bottom - 12;
    const ustBosluk = r.top - 12;
    // Sığan yan seçiliyor; ikisi de sığmıyorsa GENİŞ olan. Önce yalnız
    // "alta sığıyor mu" bakılıyordu ve sığmayınca yukarı açılıp alanın
    // üstünü tamamen kapatıyordu.
    const altta = boy <= altBosluk || altBosluk >= ustBosluk;
    kutuKok.style.maxBlockSize = Math.max(200, (altta ? altBosluk : ustBosluk)) + 'px';
    kutuKok.style.insetBlockStart = (altta ? r.bottom + 6 : Math.max(6, r.top - 6 - Math.min(boy, ustBosluk))) + 'px';
    /* inset-inline-start SAĞDAN SOLA arayüzde SAĞ kenardan ölçer.
       getBoundingClientRect ise hep fiziksel veriyor. İkisi karıştırılınca
       takvim alanın metrelerce solunda açılıyordu (ekran görüntüsü yakaladı).
       Kutunun başlangıç kenarı alanın başlangıç kenarına hizalanıyor; ekrandan
       taşarsa içeri çekiliyor. */
    const sagdanSola = getComputedStyle(kok).direction === 'rtl';
    const ham = sagdanSola ? innerWidth - r.right : r.left;
    kutuKok.style.insetInlineStart = Math.min(Math.max(6, ham), Math.max(6, innerWidth - en - 6)) + 'px';
  }

  function kaydir(gun = 0, ay = 0, yil = 0, { odakla = true } = {}) {
    let { yil: y, ay: a, gun: g } = odak;
    if (ay || yil) {
      a += ay; y += yil;
      while (a > 12) { a -= 12; y++; }
      while (a < 1) { a += 12; y--; }
      g = Math.min(g, semsiAyGunu(y, a));
    }
    odak = { yil: y, ay: a, gun: g };
    if (gun) {
      // Gün kaydırmasını takvimin kendisine yaptırıyoruz: ay ve yıl sınırları
      // kendiliğinden doğru geçilsin.
      const su = semsiden(odak.yil, odak.ay, odak.gun);
      if (su) {
        const d = new Date(su + 'T00:00:00Z');
        d.setUTCDate(d.getUTCDate() + gun);
        odak = semsiye(d.toISOString().slice(0, 10)) || odak;
      }
    }
    // Kutu baştan çiziliyor, yani basılan gezinme düğmesi de yenisiyle
    // değişiyor ve odak kayboluyor. Etiketinden bulup geri veriyoruz ki
    // klavyeyle arka arkaya basmak çalışsın; odak güne kaçarsa ikinci basış
    // ayı ilerletmek yerine o günü seçip takvimi kapatıyordu.
    const basilanEtiket = !odakla && kutuKok?.contains(document.activeElement)
      ? document.activeElement.getAttribute('aria-label') : null;
    kutuCiz({ odakla });
    if (basilanEtiket) {
      kutuKok?.querySelector(`.tarih-kutu__ok[aria-label="${CSS.escape(basilanEtiket)}"]`)?.focus();
    }
    // Ay/yıl değişince ızgaranın satır sayısı değişebiliyor; kutunun boyu
    // da onunla. Yeniden yerleştirilmezse ekran kenarından taşıyor.
    yerlestir();
  }

  function sec(y, a, g) {
    ayarla(semsiden(y, a, g));
    kapat({ odagiGeriVer: true });
  }

  function kutuCiz({ odakla = false } = {}) {
    if (!kutuKok) return;
    temizle(kutuKok);
    const { yil: sy, ay: sa } = odak;
    const seciliP = semsiye(iso);
    const bugunP = semsiye(bugun());

    const gezinme = (ad, simgeAdi, dy, da) => btn(simge(simgeAdi, { boy: 16 }), {
      class: 'btn btn--ikon btn--sade tarih-kutu__ok', 'aria-label': ad,
      // odakla: false — tıklanan düğme odakta kalsın; odak ızgaraya kaçınca
      // düğmeye ikinci basış ayı ilerletmek yerine günü seçiyordu.
      onclick: () => kaydir(0, da, dy, { odakla: false }),
    });
    kutuKok.appendChild(el('div', { class: 'tarih-kutu__bas' },
      // Sağdan sola: "önceki" sağı gösterir.
      gezinme(t('tarih.onceki_yil', 'Önceki yıl'), 'sag', -1, 0),
      gezinme(t('tarih.onceki_ay', 'Önceki ay'), 'sag', 0, -1),
      el('div', { class: 'tarih-kutu__ad', 'aria-live': 'polite', 'aria-atomic': 'true' },
        el('b', {}, semsiAyAdi(sa)),
        el('span', { dir: 'ltr' }, String(sy))),
      gezinme(t('tarih.sonraki_ay', 'Sonraki ay'), 'sol', 0, 1),
      gezinme(t('tarih.sonraki_yil', 'Sonraki yıl'), 'sol', 1, 0)));

    const izgara = el('div', {
      class: 'tarih-kutu__izgara', role: 'group',
      'aria-label': `${semsiAyAdi(sa)} ${sy}`,
    });
    for (const g of semsiGunAdlari()) {
      izgara.appendChild(el('span', { class: 'tarih-kutu__gunadi', 'aria-hidden': 'true', title: g.tam }, g.kisa));
    }
    for (let i = 0; i < semsiAyBasiSutunu(sy, sa); i++) izgara.appendChild(el('span', {}));
    for (let g = 1; g <= semsiAyGunu(sy, sa); g++) {
      const secili = seciliP && seciliP.yil === sy && seciliP.ay === sa && seciliP.gun === g;
      const bugunMu = bugunP && bugunP.yil === sy && bugunP.ay === sa && bugunP.gun === g;
      izgara.appendChild(btn(String(g), {
        class: 'tarih-kutu__gun' + (secili ? ' tarih-kutu__gun--secili' : '') + (bugunMu ? ' tarih-kutu__gun--bugun' : ''),
        dir: 'ltr',
        // Ad yalnız gün sayısı olunca ekran okuyucu ay/yıl değişimini hiç
        // duyurmuyordu; tam tarih adda, görünen metin yine sayı.
        'aria-label': `${g} ${semsiAyAdi(sa)} ${sy}`,
        'aria-pressed': secili ? 'true' : 'false',
        'aria-current': bugunMu ? 'date' : undefined,
        tabindex: g === odak.gun ? '0' : '-1',
        dataset: g === odak.gun ? { odak: '' } : {},
        onclick: () => sec(sy, sa, g),
      }));
    }
    izgara.addEventListener('keydown', izgaraTusu);
    kutuKok.appendChild(izgara);
    if (odakla) izgara.querySelector('[data-odak]')?.focus();

    kutuKok.appendChild(el('div', { class: 'tarih-kutu__ayak' },
      btnS('takvim', t('tarih.bugun', 'Bugün'), {
        class: 'btn btn--kucuk', onclick: () => { const p = semsiye(bugun()); sec(p.yil, p.ay, p.gun); },
      }),
      iso ? btnS('kapat', t('tarih.temizle', 'Temizle'), {
        class: 'btn btn--kucuk btn--sade', onclick: () => { ayarla(''); kapat({ odagiGeriVer: true }); },
      }) : null));
  }

  function izgaraTusu(e) {
    // Sağdan sola: sağ ok geriye, sol ok ileriye gider.
    const adim = {
      ArrowRight: -1, ArrowLeft: 1, ArrowUp: -7, ArrowDown: 7,
    }[e.key];
    if (adim !== undefined) { e.preventDefault(); kaydir(adim); return; }
    if (e.key === 'PageUp') { e.preventDefault(); kaydir(0, e.shiftKey ? 0 : -1, e.shiftKey ? -1 : 0); return; }
    if (e.key === 'PageDown') { e.preventDefault(); kaydir(0, e.shiftKey ? 0 : 1, e.shiftKey ? 1 : 0); return; }
    if (e.key === 'Home') { e.preventDefault(); odak = { ...odak, gun: 1 }; kutuCiz({ odakla: true }); yerlestir(); return; }
    if (e.key === 'End') {
      e.preventDefault();
      odak = { ...odak, gun: semsiAyGunu(odak.yil, odak.ay) };
      kutuCiz({ odakla: true }); yerlestir();
    }
  }

  return kok;
}
