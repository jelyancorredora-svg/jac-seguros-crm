import { describe, expect, it } from 'vitest';
import { carpetaCRM, subirADrive } from './drive';
import { medidas } from './imagen';

describe('fotos', () => {
  it('reduce al lado maximo manteniendo la proporcion', () => {
    expect(medidas(4032, 3024)).toEqual({ w: 2000, h: 1500 });
    expect(medidas(800, 600)).toEqual({ w: 800, h: 600 });
  });
});

describe('Google Drive', () => {
  it('crea la carpeta del CRM si no existe', async () => {
    const pasos: string[] = [];
    const f = (async (u: string, init?: RequestInit) => {
      pasos.push((init?.method ?? 'GET') + ' ' + u.split('?')[0].replace('https://www.googleapis.com/drive/v3', ''));
      if (u.includes('?q=')) return new Response(JSON.stringify({ files: [] }));
      return new Response(JSON.stringify({ id: 'CARP' }));
    }) as unknown as typeof fetch;
    expect(await carpetaCRM('t', '', f)).toBe('CARP');
    expect(pasos).toEqual(['GET /files', 'POST /files']);
  });

  it('sube por partes y retoma despues de un corte', async () => {
    const total = 20 * 1024 * 1024;
    let recibido = 0;
    let cortes = 0;
    const f = (async (u: string, init: RequestInit) => {
      const h = init.headers as Record<string, string>;
      if (init.method === 'POST') return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=X' } });
      const cr = h['Content-Range'];
      if (cr.startsWith('bytes */')) return new Response(null, { status: 308, headers: recibido ? { range: `bytes=0-${recibido - 1}` } : {} });
      const [a, b] = cr.slice(6).split('/')[0].split('-').map(Number);
      expect(a).toBe(recibido);
      if (a > 0 && cortes === 0) { cortes++; throw new TypeError('Failed to fetch'); }
      recibido = b + 1;
      if (recibido >= total) return new Response(JSON.stringify({ id: 'ARCH', webViewLink: 'https://drive.google.com/file/d/ARCH/view' }), { status: 200 });
      return new Response(null, { status: 308, headers: { range: `bytes=0-${b}` } });
      void u;
    }) as unknown as typeof fetch;
    const r = await subirADrive('t', 'CARP', new Blob([new Uint8Array(total)]), 'poliza.pdf', 'application/pdf', undefined, f);
    expect(r).toEqual({ id: 'ARCH', url: 'https://drive.google.com/file/d/ARCH/view' });
    expect(cortes).toBe(1);
  }, 30_000);

  it('explica cuando Drive esta lleno', async () => {
    const f = (async () => new Response('{"error":{"errors":[{"reason":"storageQuotaExceeded"}]}}', { status: 403 })) as unknown as typeof fetch;
    await expect(subirADrive('t', 'C', new Blob(['x']), 'a.txt', 'text/plain', undefined, f)).rejects.toThrow(/Drive está lleno/);
  });
});
