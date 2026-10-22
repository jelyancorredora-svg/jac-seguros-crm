/*
 * Subida de archivos a Supabase Storage SIN tope propio de la app.
 *
 * - Hasta 6 MB: subida normal (una sola peticion).
 * - Mas de 6 MB: subida "por partes" (protocolo TUS que usa Supabase). Cada
 *   parte es de 6 MB; si se corta la señal, se pregunta a la nube cuanto
 *   llego y se sigue desde ahi, sin empezar de cero.
 *
 * El unico limite es el del plan de Supabase (tamaño maximo por archivo y
 * espacio total). Si se pasa, se explica con palabras claras.
 */

export const TROZO = 6 * 1024 * 1024;
const REINTENTOS = 6;

export type Progreso = (subido: number, total: number) => void;

export class ErrorSubida extends Error {}

export type OpcionesSubida = {
  url: string;          // https://<proyecto>.supabase.co
  apikey: string;
  token: () => Promise<string>;   // sesion vigente (se pide en cada parte)
  bucket: string;
  ruta: string;
  archivo: Blob;
  tipo: string;
  progreso?: Progreso;
  espera?: (ms: number) => Promise<void>;
  fetchFn?: typeof fetch;
};

const b64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
};

/** Mensaje claro segun lo que conteste la nube */
export function explicarError(status: number, cuerpo: string): string {
  const t = cuerpo.toLowerCase();
  if (status === 413 || t.includes('maximum allowed size') || t.includes('payload too large') || t.includes('too large')) {
    return 'El archivo es más grande de lo que permite tu plan de almacenamiento. Sube el límite por archivo en Supabase → Storage → Settings (ver la guía).';
  }
  if (t.includes('quota') || t.includes('storage limit') || t.includes('exceeded')) {
    return 'Tu espacio de almacenamiento en Supabase está lleno. Amplía el plan o libera espacio.';
  }
  if (status === 401 || status === 403) return 'Tu sesión venció o no tienes permiso. Vuelve a entrar.';
  if (status === 409 || t.includes('already exists')) return 'Ya existe un archivo con ese nombre en ese registro.';
  return 'No se pudo subir el archivo. Revisa la conexión e inténtalo de nuevo.';
}

const esperaReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function subirPorPartes(o: OpcionesSubida): Promise<void> {
  const f = o.fetchFn ?? fetch;
  const espera = o.espera ?? esperaReal;
  const total = o.archivo.size;
  const base = `${o.url}/storage/v1/upload/resumable`;
  const cab = async (extra: Record<string, string> = {}) => ({
    authorization: `Bearer ${await o.token()}`,
    apikey: o.apikey,
    'tus-resumable': '1.0.0',
    ...extra,
  });

  // 1. Crear la subida
  const meta = [
    `bucketName ${b64(o.bucket)}`, `objectName ${b64(o.ruta)}`,
    `contentType ${b64(o.tipo || 'application/octet-stream')}`, `cacheControl ${b64('3600')}`,
  ].join(',');
  const rc = await f(base, { method: 'POST', headers: await cab({ 'upload-length': String(total), 'upload-metadata': meta, 'x-upsert': 'false' }) });
  if (rc.status !== 201) throw new ErrorSubida(explicarError(rc.status, await rc.text().catch(() => '')));
  const loc = rc.headers.get('location');
  if (!loc) throw new ErrorSubida('La nube no devolvió dónde continuar la subida.');
  const destino = new URL(loc, o.url).toString();
  // Solo se sigue en tu propio proyecto (dominio normal o el de almacenamiento)
  const almacen = o.url.replace('.supabase.co', '.storage.supabase.co');
  if (!destino.startsWith(o.url + '/') && !destino.startsWith(almacen + '/')) throw new ErrorSubida('Destino de subida no válido.');

  // 2. Mandar las partes, retomando si algo falla
  let offset = 0;
  let fallos = 0;
  o.progreso?.(0, total);
  while (offset < total) {
    try {
      const parte = o.archivo.slice(offset, Math.min(offset + TROZO, total));
      const rp = await f(destino, {
        method: 'PATCH',
        headers: await cab({ 'upload-offset': String(offset), 'content-type': 'application/offset+octet-stream' }),
        body: parte,
      });
      if (rp.status !== 204) {
        const cuerpo = await rp.text().catch(() => '');
        if (rp.status === 413 || rp.status === 401 || rp.status === 403) throw new ErrorSubida(explicarError(rp.status, cuerpo));
        throw new Error(`parte ${rp.status}`);
      }
      offset = Number(rp.headers.get('upload-offset') ?? offset + parte.size);
      fallos = 0;
      o.progreso?.(offset, total);
    } catch (e) {
      if (e instanceof ErrorSubida) throw e;
      if (++fallos > REINTENTOS) throw new ErrorSubida('Se perdió la conexión demasiadas veces. Inténtalo de nuevo con mejor señal.');
      await espera(Math.min(30_000, 1000 * 2 ** fallos));
      // Preguntar cuanto llego realmente y seguir desde ahi
      try {
        const rh = await f(destino, { method: 'HEAD', headers: await cab() });
        const v = rh.headers.get('upload-offset');
        if (rh.ok && v !== null) offset = Number(v);
      } catch { /* se reintenta en la proxima vuelta */ }
    }
  }
}
