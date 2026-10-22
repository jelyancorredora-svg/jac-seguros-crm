import { describe, expect, it } from 'vitest';
import { explicarError, subirPorPartes, TROZO } from './subida';

/** Servidor TUS de mentira: guarda los bytes y puede fallar una vez a mitad */
function servidor({ fallarEnParte = -1, limite = Infinity } = {}) {
  let recibido = 0;
  let total = 0;
  let parte = 0;
  const llamadas: string[] = [];
  const f = (async (_url: string, init: RequestInit) => {
    const h = init.headers as Record<string, string>;
    llamadas.push(`${init.method} ${h['upload-offset'] ?? ''}`);
    if (init.method === 'POST') {
      total = Number(h['upload-length']);
      if (total > limite) return new Response('{"message":"The object exceeded the maximum allowed size"}', { status: 413 });
      return new Response(null, { status: 201, headers: { location: 'https://x.supabase.co/storage/v1/upload/resumable/abc' } });
    }
    if (init.method === 'HEAD') return new Response(null, { status: 200, headers: { 'upload-offset': String(recibido) } });
    if (init.method === 'PATCH') {
      parte++;
      const b = init.body as Blob;
      if (Number(h['upload-offset']) !== recibido) return new Response('offset', { status: 409 });
      if (parte === fallarEnParte) {
        recibido += Math.floor(b.size / 2); // llego la mitad y se corto
        throw new TypeError('Failed to fetch');
      }
      recibido += b.size;
      return new Response(null, { status: 204, headers: { 'upload-offset': String(recibido) } });
    }
    return new Response(null, { status: 405 });
  }) as unknown as typeof fetch;
  return { f, llamadas, get recibido() { return recibido; }, get total() { return total; } };
}

const base = (archivo: Blob, f: typeof fetch, progreso?: (a: number, b: number) => void) => ({
  url: 'https://x.supabase.co', apikey: 'k', token: async () => 't', bucket: 'adjuntos', ruta: 'u/clientes/C1/F1-video.mp4',
  archivo, tipo: 'video/mp4', progreso, espera: async () => {}, fetchFn: f,
});

describe('subida por partes', () => {
  it('sube un archivo de 20 MB en partes de 6 MB', async () => {
    const s = servidor();
    const avance: number[] = [];
    await subirPorPartes(base(new Blob([new Uint8Array(20 * 1024 * 1024)]), s.f, (a) => avance.push(a)));
    expect(s.recibido).toBe(20 * 1024 * 1024);
    expect(s.llamadas.filter((l) => l.startsWith('PATCH'))).toHaveLength(Math.ceil(20 / 6));
    expect(avance.at(-1)).toBe(20 * 1024 * 1024);
  });

  it('si se corta la señal, pregunta cuanto llego y sigue desde ahi', async () => {
    const s = servidor({ fallarEnParte: 2 });
    await subirPorPartes(base(new Blob([new Uint8Array(3 * TROZO + 100)]), s.f));
    expect(s.recibido).toBe(3 * TROZO + 100);
    expect(s.llamadas).toContain('HEAD ');
  });

  it('explica cuando el plan no permite un archivo tan grande', async () => {
    const s = servidor({ limite: 10 * 1024 * 1024 });
    await expect(subirPorPartes(base(new Blob([new Uint8Array(12 * 1024 * 1024)]), s.f))).rejects.toThrow(/plan de almacenamiento/);
    expect(explicarError(400, 'quota exceeded')).toMatch(/lleno/);
  });
});
