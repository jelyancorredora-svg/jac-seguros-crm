/*
 * 📅 Google Calendar, igual que la integracion del CRM web:
 * - Se conecta con TU Client ID de Google (el mismo que guardaste en el web,
 *   crm_meta "integraciones".googleClientId) y permiso calendar.events.
 * - Manda a tu calendario principal las tareas de la agenda y, ademas,
 *   renovaciones (30 dias), cumpleaños (7 dias) y cobros (30 dias).
 * - Recuerda que ya mando cada cosa con los MISMOS datos que el web
 *   (gcalEventId en cada tarea y "gcalRefs" en crm_meta), asi web y app
 *   nunca duplican eventos: si ya existe, lo actualiza.
 *
 * En el iPhone (app de inicio) no se pueden usar ventanas emergentes, asi
 * que la conexion es por redireccion: se va a Google y vuelve a la app con
 * un permiso que dura 1 hora (como en el web) y vive solo en esta pestaña.
 */
import type { Reg } from './datos';

const ALCANCE = 'https://www.googleapis.com/auth/calendar.events';
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const K_TOKEN = 'jac_gcal_token';
const K_ESTADO = 'jac_gcal_estado';
const K_SALIDA = 'jac_gcal_salida';
export const TZ = 'America/Panama';

const txt = (r: Reg | null | undefined, k: string): string => {
  const v = r?.[k];
  return v === null || v === undefined ? '' : String(v).trim();
};

/** Direccion a la que vuelve Google (debe estar autorizada en Google Cloud) */
export function urlRetorno(loc: Pick<Location, 'origin' | 'pathname'> = location): string {
  return loc.origin + loc.pathname.replace(/index\.html$/, '');
}

export function urlConexion(clientId: string, retorno = urlRetorno()): string {
  const estado = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem(K_ESTADO, estado); sessionStorage.setItem(K_SALIDA, String(Date.now())); } catch { /* sin almacenamiento */ }
  const q = new URLSearchParams({
    client_id: clientId.trim(), redirect_uri: retorno, response_type: 'token', scope: ALCANCE,
    include_granted_scopes: 'true', state: estado,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

/**
 * Al abrir la app: si venimos de Google, guarda el permiso y limpia la
 * direccion. Solo acepta la respuesta si el "state" es el que pedimos.
 */
export function capturarRetorno(): 'conectado' | 'rechazado' | null {
  const h = location.hash.startsWith('#') ? location.hash.slice(1) : '';
  if (!h || (!h.includes('access_token=') && !h.includes('error='))) return null;
  const p = new URLSearchParams(h);
  history.replaceState(null, '', location.pathname + location.search);
  let esperado = '';
  try { esperado = sessionStorage.getItem(K_ESTADO) ?? ''; sessionStorage.removeItem(K_ESTADO); } catch { /* nada */ }
  const tok = p.get('access_token');
  if (!tok || !esperado || p.get('state') !== esperado) return 'rechazado';
  const dura = Math.max(60, Number(p.get('expires_in')) || 3600);
  try { sessionStorage.setItem(K_TOKEN, JSON.stringify({ t: tok, exp: Date.now() + (dura - 60) * 1000 })); } catch { return 'rechazado'; }
  return 'conectado';
}

/**
 * La app web pide la contraseña cada vez que se reabre. Unica excepcion: la
 * vuelta de Google que TU pediste en esta misma pestaña hace menos de 5 min
 * (se usa una sola vez). Igual se revisan caducidad y verificacion en dos pasos.
 */
export function vueltaDeGoogleReciente(): boolean {
  try {
    const t = Number(sessionStorage.getItem(K_SALIDA) ?? 0);
    sessionStorage.removeItem(K_SALIDA);
    return retornoGcal.v === 'conectado' && t > 0 && Date.now() - t < 5 * 60_000;
  } catch { return false; }
}

/** Resultado de la vuelta desde Google al abrir la app (lo lee la pantalla de Configuración) */
export const retornoGcal: { v: 'conectado' | 'rechazado' | null } = { v: null };

export function tokenGcal(): string | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(K_TOKEN) ?? 'null') as { t: string; exp: number } | null;
    return v && v.exp > Date.now() ? v.t : null;
  } catch { return null; }
}
export function minutosRestantes(): number {
  try {
    const v = JSON.parse(sessionStorage.getItem(K_TOKEN) ?? 'null') as { exp: number } | null;
    return v ? Math.max(0, Math.round((v.exp - Date.now()) / 60000)) : 0;
  } catch { return 0; }
}
export function desconectarGcal() {
  try { sessionStorage.removeItem(K_TOKEN); } catch { /* nada */ }
}

/* ---------------- que se manda ---------------- */

export type CuerpoEvento = {
  summary: string; description: string;
  start: { date?: string; dateTime?: string; timeZone?: string };
  end: { date?: string; dateTime?: string; timeZone?: string };
};

const masDias = (f: string, n: number) => new Date(Date.parse(f + 'T12:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);

/** Evento de una tarea (gcalUpsertEvent del web; el fin de un dia completo es el dia siguiente, como pide Google) */
export function eventoTarea(t: Reg): CuerpoEvento | null {
  const fecha = (txt(t, 'fecha') || txt(t, 'fechaLimite')).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const base = {
    summary: txt(t, 'texto') || txt(t, 'titulo') || txt(t, 'nm') || 'Tarea CRM',
    description: 'JAC CRM: ' + (txt(t, 'tipoAgenda') || txt(t, 'tipo') || 'tarea'),
  };
  const h = /^(\d{1,2}):(\d{2})/.exec(txt(t, 'hora'));
  if (h) {
    const ini = `${fecha}T${h[1].padStart(2, '0')}:${h[2]}:00`;
    const fin = new Date(Date.parse(ini + 'Z') + 30 * 60_000).toISOString().slice(0, 19);
    return { ...base, start: { dateTime: ini, timeZone: TZ }, end: { dateTime: fin, timeZone: TZ } };
  }
  return { ...base, start: { date: fecha }, end: { date: masDias(fecha, 1) } };
}

export const tareaParaCalendario = (t: Reg) =>
  !!(txt(t, 'fecha') || txt(t, 'fechaLimite')) && !['Eliminada', 'Cancelada'].includes(txt(t, 'etapaTarea'));

const hoy0 = (hoy: Date) => Date.parse(hoy.toISOString().slice(0, 10) + 'T00:00:00Z');
const dias = (f: string, hoy: Date) => Math.round((Date.parse(f + 'T00:00:00Z') - hoy0(hoy)) / 86_400_000);
const n = (v: unknown) => { const x = parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')); return Number.isFinite(x) ? x : 0; };

/** Renovaciones, cumpleaños y cobros (jacGcalEventosDelCRM del web) */
export function eventosDelCRM(c: { polizas: Reg[]; clientes: Reg[] }, hoy = new Date()): Array<{ k: string; e: CuerpoEvento }> {
  const out: Array<{ k: string; e: CuerpoEvento }> = [];
  const dia = (f: string, titulo: string, desc: string, k: string) =>
    out.push({ k, e: { summary: titulo, description: desc, start: { date: f }, end: { date: masDias(f, 1) } } });
  const mon = (v: number) => 'B/.' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  for (const p of c.polizas) {
    if (txt(p, 'estado').toLowerCase() === 'cancelada') continue;
    const ff = (txt(p, 'fechaFin') || txt(p, 'vencimiento')).slice(0, 10);
    const nom = txt(p, 'nombreCliente') || txt(p, 'cliente') || '(sin cliente)';
    if (/^\d{4}-\d{2}-\d{2}$/.test(ff)) {
      const d = dias(ff, hoy);
      if (d >= 0 && d <= 30) dia(ff, `🔄 Renueva: ${nom} (${txt(p, 'aseg') || txt(p, 'aseguradora')})`, `Póliza ${txt(p, 'num') || '(sin nº)'} — ${txt(p, 'ramo')}. Generado por el CRM de JAC Seguros.`, 'ren_' + p.id);
    }
    const saldo = n(p.saldo);
    if (saldo > 0.05 && !txt(p, 'estadoCartera').toLowerCase().includes('pagad')) {
      const venc = (txt(p, 'fechaFact') || ff).slice(0, 10);
      const d = /^\d{4}-\d{2}-\d{2}$/.test(venc) ? dias(venc, hoy) : null;
      if (d !== null && d <= 30) dia(masDias(hoy.toISOString().slice(0, 10), Math.max(0, d)), `💵 Cobrar: ${nom} ${mon(saldo)}`, `Póliza ${txt(p, 'num') || '(sin nº)'} — ${txt(p, 'aseg')}. Generado por el CRM de JAC Seguros.`, 'pag_' + p.id);
    }
  }
  const año = Number(hoy.toISOString().slice(0, 4));
  for (const cl of c.clientes) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(txt(cl, 'fNac') || txt(cl, 'fechaNac') || txt(cl, 'dob'));
    if (!m) continue;
    let prox = `${año}-${m[2]}-${m[3]}`;
    if (dias(prox, hoy) < 0) prox = `${año + 1}-${m[2]}-${m[3]}`;
    if (dias(prox, hoy) <= 7) dia(prox, `🎂 Cumpleaños: ${txt(cl, 'nombre') || '(sin nombre)'}`, 'Cumpleaños de un cliente. Generado por el CRM de JAC Seguros.', 'cum_' + cl.id);
  }
  return out;
}

/* ---------------- enviar ---------------- */

export class ErrorGcal extends Error {}

/** Crea o actualiza un evento. Si el que estaba ya no existe en Google, lo crea de nuevo. */
export async function guardarEvento(token: string, e: CuerpoEvento, id: string | undefined, f: typeof fetch = fetch): Promise<string | null> {
  const pedir = (metodo: 'POST' | 'PATCH', url: string) => f(url, {
    method: metodo, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(e),
  });
  let r = id ? await pedir('PATCH', `${API}/${encodeURIComponent(id)}`) : await pedir('POST', API);
  if (id && (r.status === 404 || r.status === 410)) r = await pedir('POST', API);
  if (r.status === 401) throw new ErrorGcal('El permiso de Google venció. Vuelve a conectar.');
  if (r.status === 403) throw new ErrorGcal('Google no dio permiso para el calendario. Revisa la configuración.');
  if (!r.ok) return null;
  const j = (await r.json().catch(() => ({}))) as { id?: string };
  return j.id ?? null;
}

/** Enlace "Agregar a Google Calendar" (no necesita conectar nada) */
export function enlaceAgregarGcal(titulo: string, fecha: string, hora: string, detalle = ''): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const d = fecha.replace(/-/g, '');
  const h = /^(\d{1,2}):(\d{2})/.exec(hora || '');
  let fechas: string;
  if (h) {
    const ini = `${fecha}T${h[1].padStart(2, '0')}:${h[2]}:00`;
    const fin = new Date(Date.parse(ini + 'Z') + 30 * 60_000).toISOString().slice(0, 19);
    fechas = `${ini.replace(/[-:]/g, '')}/${fin.replace(/[-:]/g, '')}`;
  } else {
    fechas = `${d}/${masDias(fecha, 1).replace(/-/g, '')}`;
  }
  const q = new URLSearchParams({ action: 'TEMPLATE', text: titulo || 'Tarea CRM', dates: fechas, ctz: TZ, details: detalle || 'JAC CRM' });
  return `https://calendar.google.com/calendar/render?${q}`;
}
