// Yerel sunucu (sunucu/yerel.mjs): tek bir bozuk istek süreci düşürmemeli ve
// sunucu yalnız bu bilgisayardan erişilebilir olmalı. Tarayıcı denemesi aynı
// sunucuyu kendi sürecinde açıyor; orada bir çöküş denemenin kendisi demek.
import { describe, it, expect, afterEach } from 'vitest';
import { request } from 'node:http';
import { yerelSunucu } from '../../sunucu/yerel.mjs';

/** Ham yol (fetch '%E0'ı düzeltmeye kalkar; http.request olduğu gibi gönderir). */
const iste = (port, yol) => new Promise((tamam, hata) => {
  const r = request({ host: '127.0.0.1', port, path: yol }, (y) => {
    let govde = '';
    y.on('data', (p) => { govde += p; }).on('end', () => tamam({ durum: y.statusCode, govde }));
  });
  r.on('error', hata).end();
});

describe('yerel sunucu', () => {
  let sunucu;
  afterEach(() => new Promise((c) => { sunucu?.closeAllConnections?.(); sunucu?.close(() => c()); }));

  it('bozuk yüzde kodlu adres 400 alır, sunucu ayakta kalır', async () => {
    sunucu = yerelSunucu();
    await new Promise((c) => sunucu.listen(0, '127.0.0.1', c));
    const { port } = sunucu.address();
    for (const yol of ['/%E0', '/js/%E0%A4%A.js', '/%']) expect((await iste(port, yol)).durum).toBe(400);
    expect(await iste(port, '/v1/durum')).toEqual({ durum: 200, govde: '{"ok":true}' });
    expect((await iste(port, '/index.html')).durum).toBe(200);
  });
});
