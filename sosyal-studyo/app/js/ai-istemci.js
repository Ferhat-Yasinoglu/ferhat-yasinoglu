// AI istemcisi: bütün AI özellikleri Worker üzerinden gider (anahtar tarayıcıya inmez).
// Yerel modda özellik nazikçe kapalıdır; sayfalar `mevcut()` ile düğmeleri pasifler.
export const AI_OZELLIKLERI = ['fikir_uret', 'senaryo_yaz', 'kanca_oner', 'karusel_uret', 'video_analiz', 'ajan_cevap', 'varyant_uret', 'akis_uret', 'metin_iyilestir'];

export function aiIstemci(depo, t) {
  return {
    async mevcut() { const a = await depo.ayarlar(); return (a.mod === 'bagli') && !!a.worker?.adres; },
    async iste(ozellik, girdi) {
      const a = await depo.ayarlar();
      if (a.mod !== 'bagli' || !a.worker?.adres) throw new Error(t('ai.yerel', 'AI özellikleri için Worker\'ı bağla (Ayarlar → Worker).'));
      const anahtar = await depo.gizli('yonetici');
      const r = await fetch(`${a.worker.adres.replace(/\/$/, '')}/api/ai/${ozellik}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${anahtar || ''}`, 'X-SS-Sema': '1' }, body: JSON.stringify(girdi) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.mesaj || `Worker ${r.status}`);
      return j.veri;
    },
  };
}
