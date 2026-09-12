// İlk açılışta demo verisini yükler; kullanıcı silene kadar `demo:1` işaretiyle durur.
import { demoTohumu } from '../paylasilan/demo-veri.js';

export async function tohumla(depo, { zorla = false } = {}) {
  const m = await depo.meta();
  if (m.tohumlandi && !zorla) return 0;
  let n = 0;
  for (const [kol, liste] of Object.entries(demoTohumu())) {
    for (const k of liste) { await depo.kaydet(kol, { ...k, demo: 1 }); n++; }
  }
  await depo.metaKaydet({ tohumlandi: 1 });
  return n;
}
