-- Sosyal Stüdyo D1 şeması, sürüm 1. Tek tablo, koleksiyon başına satır; JSON gövde + indekslenen anahtarlar.
-- k1/k2/k3 koleksiyona göre: kisiler(hesap_id, dis_id) · kosular(kisi_id, durum, devam_zamani)
-- gunluk(zaman, kisi_id) · gelen_kutusu(olay_id, durum) · mesajlar(sohbet_id, zaman) · sohbetler(kisi_id)
CREATE TABLE IF NOT EXISTS kayitlar (
  kol TEXT NOT NULL,
  id TEXT NOT NULL,
  veri TEXT NOT NULL,
  rev INTEGER NOT NULL DEFAULT 1,
  guncellendi TEXT NOT NULL,
  silindi INTEGER NOT NULL DEFAULT 0,
  degisiklik_no INTEGER NOT NULL,
  k1 TEXT, k2 TEXT, k3 TEXT,
  PRIMARY KEY (kol, id)
);
CREATE INDEX IF NOT EXISTS kayitlar_degisiklik ON kayitlar(kol, degisiklik_no);
CREATE INDEX IF NOT EXISTS kayitlar_k1 ON kayitlar(kol, k1);
CREATE INDEX IF NOT EXISTS kayitlar_k1_k2 ON kayitlar(kol, k1, k2);
CREATE INDEX IF NOT EXISTS kayitlar_k3 ON kayitlar(kol, k2, k3);
CREATE UNIQUE INDEX IF NOT EXISTS kisiler_hesap_dis ON kayitlar(k1, k2) WHERE kol = 'kisiler' AND silindi = 0;
CREATE UNIQUE INDEX IF NOT EXISTS gelen_kutusu_olay ON kayitlar(k1) WHERE kol = 'gelen_kutusu';

CREATE TABLE IF NOT EXISTS meta (
  anahtar TEXT PRIMARY KEY,
  deger TEXT NOT NULL
);
INSERT OR IGNORE INTO meta(anahtar, deger) VALUES ('sema_surumu', '1');
INSERT OR IGNORE INTO meta(anahtar, deger) VALUES ('son_degisiklik_no', '0');

CREATE TABLE IF NOT EXISTS sayaclar (
  gun TEXT NOT NULL,
  ad TEXT NOT NULL,
  sayi INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (gun, ad)
);
