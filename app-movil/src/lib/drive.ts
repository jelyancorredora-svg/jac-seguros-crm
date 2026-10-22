/*
 * 📁 Archivos en TU Google Drive (el espacio de tu plan de Google).
 *
 * - Todo va a una carpeta "JAC Seguros CRM — Archivos" en tu Drive.
 * - Permiso minimo "drive.file": la app SOLO ve los archivos que ella misma
 *   sube; no puede leer ni tocar nada mas de tu Drive.
 * - Los archivos quedan privados (solo tu cuenta los abre).
 * - La ficha guarda {drive: id, url} y el CRM web los abre con el mismo enlace.
 */

const API = 'https://www.googleapis.com/drive/v3';
const SUBIR = 'https://www.googleapis.com/upload/drive/v3/files';
export const NOMBRE_CARPETA = 'JAC Seguros CRM — Archivos';

export class ErrorDrive extends Error {}

/** Preferencia de donde guardar (se carga desde crm_meta "integraciones") */
export const prefDrive: { archivosEn: 'supabase' | 'drive'; carpeta: string } = { archivosEn: 'supabase', carpeta: '' };

function explicar(status: number, cuerpo: string): string {
  if (status === 401) return 'El permiso de Google venció. Toca "Conectar con Google" y vuelve a subirlo.';
  if (status === 403 && /storageQuotaExceeded|quota/i.test(cuerpo)) return 'Tu Google Drive está lleno. Libera espacio o cambia a guardar en la nube del CRM.';
  if (status === 403 && /insufficient|scope|PERMISSION/i.test(cuerpo)) return 'Falta el permiso de Google Drive. Toca "Conectar con Google" otra vez y acepta Drive.';
  if (status === 403 && /accessNotConfigured|has not been used|disabled/i.test(cuerpo)) return 'La API de Google Drive no está activada en tu proyecto de Google (ver Configuración → Archivos).';
  return `Google Drive respondió ${status}. Inténtalo de nuevo.`;
}

async function pedir(f: typeof fetch, url: string, init: RequestInit): Promise<Response> {
  const r = await f(url, init);
  if (!r.ok && r.status !== 308) throw new ErrorDrive(explicar(r.status, await r.text().catch(() => '')));
  return r;
}

/** Busca o crea la carpeta del CRM. Devuelve su id. */
export async function carpetaCRM(token: string, conocida: string, f: typeof fetch = fetch): Promise<string> {
  const h = { Authorization: 'Bearer ' + token };
  if (conocida) {
    const r = await f(`${API}/files/${encodeURIComponent(conocida)}?fields=id,trashed`, { headers: h });
    if (r.ok) {
      const j = (await r.json()) as { id?: string; trashed?: boolean };
      if (j.id && !j.trashed) return j.id;
    } else if (r.status === 401 || r.status === 403) throw new ErrorDrive(explicar(r.status, await r.text().catch(() => '')));
  }
  const q = encodeURIComponent(`name = '${NOMBRE_CARPETA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const rb = await pedir(f, `${API}/files?q=${q}&fields=files(id)&pageSize=1`, { headers: h });
  const jb = (await rb.json()) as { files?: Array<{ id: string }> };
  if (jb.files?.[0]?.id) return jb.files[0].id;
  const rc = await pedir(f, `${API}/files?fields=id`, {
    method: 'POST', headers: { ...h, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: NOMBRE_CARPETA, mimeType: 'application/vnd.google-apps.folder' }),
  });
  return ((await rc.json()) as { id: string }).id;
}

export type SubidoDrive = { id: string; url: string };

/**
 * Subida "reanudable" de Google: se abre una sesion y se manda el archivo.
 * Si se corta la señal, se pregunta a Google cuanto llego y se sigue.
 */
export async function subirADrive(
  token: string, carpeta: string, archivo: Blob, nombre: string, tipo: string,
  progreso?: (subido: number, total: number) => void, f: typeof fetch = fetch,
): Promise<SubidoDrive> {
  const total = archivo.size;
  const ini = await pedir(f, `${SUBIR}?uploadType=resumable&fields=id,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': tipo || 'application/octet-stream', 'X-Upload-Content-Length': String(total),
    },
    body: JSON.stringify({ name: nombre, parents: carpeta ? [carpeta] : undefined, mimeType: tipo || undefined }),
  });
  const sesion = ini.headers.get('location');
  if (!sesion || !sesion.startsWith('https://www.googleapis.com/')) throw new ErrorDrive('Google Drive no abrió la subida. Inténtalo de nuevo.');

  const TROZO = 8 * 1024 * 1024; // multiplo de 256 KB, como pide Google
  let desde = 0;
  let fallos = 0;
  progreso?.(0, total);
  for (;;) {
    const hasta = Math.min(desde + TROZO, total);
    try {
      const r = await f(sesion, {
        method: 'PUT',
        headers: { 'Content-Range': total ? `bytes ${desde}-${hasta - 1}/${total}` : 'bytes */0' },
        body: archivo.slice(desde, hasta),
      });
      if (r.status === 200 || r.status === 201) {
        const j = (await r.json()) as { id: string; webViewLink?: string };
        progreso?.(total, total);
        return { id: j.id, url: j.webViewLink || `https://drive.google.com/file/d/${j.id}/view` };
      }
      if (r.status === 308) {
        const rango = r.headers.get('range');
        desde = rango ? Number(rango.split('-')[1]) + 1 : hasta;
        fallos = 0;
        progreso?.(desde, total);
        continue;
      }
      if (r.status === 401 || r.status === 403) throw new ErrorDrive(explicar(r.status, await r.text().catch(() => '')));
      throw new Error('parte ' + r.status);
    } catch (e) {
      if (e instanceof ErrorDrive) throw e;
      if (++fallos > 5) throw new ErrorDrive('Se perdió la conexión demasiadas veces. Inténtalo con mejor señal.');
      await new Promise((ok) => setTimeout(ok, Math.min(20_000, 1000 * 2 ** fallos)));
      // ¿Cuanto llego? (Google contesta 308 con "Range")
      try {
        const r = await f(sesion, { method: 'PUT', headers: { 'Content-Range': `bytes */${total}` } });
        if (r.status === 200 || r.status === 201) {
          const j = (await r.json()) as { id: string; webViewLink?: string };
          return { id: j.id, url: j.webViewLink || `https://drive.google.com/file/d/${j.id}/view` };
        }
        const rango = r.headers.get('range');
        desde = rango ? Number(rango.split('-')[1]) + 1 : 0;
      } catch { /* se reintenta */ }
    }
  }
}

export async function borrarDeDrive(token: string, id: string, f: typeof fetch = fetch): Promise<void> {
  const r = await f(`${API}/files/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok && r.status !== 404) throw new ErrorDrive(explicar(r.status, await r.text().catch(() => '')));
}

/** Espacio de tu cuenta de Google (Drive + Gmail + Fotos comparten el espacio del plan) */
export async function espacioDrive(token: string, f: typeof fetch = fetch): Promise<{ usado: number; limite: number } | null> {
  const r = await f(`${API}/about?fields=storageQuota`, { headers: { Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const q = ((await r.json()) as { storageQuota?: { usage?: string; limit?: string } }).storageQuota;
  return q ? { usado: Number(q.usage ?? 0), limite: Number(q.limit ?? 0) } : null;
}
