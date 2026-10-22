import COLUMNAS from './columnas.json';
import { PREFIJO_ID, type Modulo } from './esquema';
import { limpiarTexto, nuevoId } from './formato';
import { db } from './supabase';

/*
 * Lectura y escritura sobre las MISMAS tablas que usa crm.jacsegurospa.com,
 * con la misma conversion que su sincronizacion (aFila / aObjeto):
 *
 *  - Cada registro es un objeto con claves camelCase, igual que en el web.
 *  - Lo que tiene columna va a la columna (snake_case); lo demas va al JSON
 *    'extra'. Asi se ven y se editan TODOS los campos, no solo las columnas.
 *  - Al editar se relee la fila de la base y se le aplican solo los cambios:
 *    nunca se pisa lo que el web guardo en otros campos.
 */

export type Reg = { id: string; [k: string]: unknown };

type Tipo = 'text' | 'date' | 'numeric' | 'boolean';
const COLS = COLUMNAS as unknown as Record<string, Array<[string, Tipo]>>;

export const TABLA: Record<Modulo, string> = {
  clientes: 'clientes', polizas: 'polizas', siniestros: 'siniestros', vehiculos: 'vehiculos', pagos: 'pagos',
  prospectos: 'prospectos', comisiones: 'comisiones', tareas: 'tareas',
};

export class ErrorDatos extends Error {}

/* ---------------- conversion fila <-> objeto (copia del CRM web) ---------------- */

const snake = (c: string) => c.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());

function aFecha(v: unknown): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function aNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : null;
}

export function aFila(obj: Record<string, unknown>, tabla: string): Record<string, unknown> {
  const def = COLS[tabla] || [];
  const fila: Record<string, unknown> = {};
  const usados = new Set<string>();
  const extra: Record<string, unknown> = {};
  for (const [col, tipo] of def) {
    const origen = Object.keys(obj).find((k) => snake(k) === col);
    if (origen === undefined) continue;
    usados.add(origen);
    let v = obj[origen];
    if (v === '') v = null;
    if (v !== null && typeof v === 'object') {
      extra[origen] = v;
      v = null;
    } else if (tipo === 'date') v = aFecha(v);
    else if (tipo === 'numeric') v = aNum(v);
    else if (tipo === 'boolean') v = v === true || v === 'true' || v === 1;
    else if (v !== null && v !== undefined) v = String(v);
    fila[col] = v ?? null;
  }
  for (const k of Object.keys(obj)) if (!usados.has(k)) extra[k] = obj[k];
  fila.extra = extra;
  fila.id = String(obj.id);
  return fila;
}

export function aObjeto(fila: Record<string, unknown>): Reg {
  const o: Record<string, unknown> = {};
  for (const c of Object.keys(fila)) {
    if (c === 'extra' || c === 'created_at' || c === 'updated_at' || fila[c] === null) continue;
    o[c.replace(/_([a-z])/g, (_m, l: string) => l.toUpperCase())] = fila[c];
  }
  const ex = (fila.extra && typeof fila.extra === 'object' ? fila.extra : {}) as Record<string, unknown>;
  for (const e of Object.keys(ex)) if (e !== 'id') o[e] = ex[e];
  o.id = String(fila.id);
  return o as Reg;
}

/* ---------------- lectura ---------------- */

function mensajeError(e: { message?: string; code?: string }): string {
  if (e.code === 'PGRST301' || /jwt/i.test(e.message ?? '')) return 'Tu sesión venció. Vuelve a entrar.';
  if (e.code === '42501') return 'No tienes permiso para esta acción.';
  return 'No se pudo conectar con el CRM. Revisa tu internet.';
}

/**
 * Version de cada fila (updated_at) tal como la conoce este dispositivo.
 * La sincronizacion la compara con la base para traer solo lo que cambio.
 */
export const versiones = new Map<string, Map<string, string>>();

/** Tabla completa, por paginas de 1000. Si una pagina falla, falla todo (nunca media tabla). */
async function leerTabla(tabla: string): Promise<Reg[]> {
  const filas: Reg[] = [];
  const v = new Map<string, string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from(tabla).select('*').order('id').range(desde, desde + 999);
    if (error) throw new ErrorDatos(mensajeError(error));
    for (const f of data ?? []) {
      const r = aObjeto(f as Record<string, unknown>);
      filas.push(r);
      v.set(r.id, String((f as Record<string, unknown>).updated_at ?? ''));
    }
    if (!data || data.length < 1000) {
      versiones.set(tabla, v);
      return filas;
    }
  }
}

/** Lista liviana (id + updated_at) de una tabla; null si la lectura fallo. */
export async function leerVersiones(tabla: string): Promise<Map<string, string> | null> {
  const v = new Map<string, string>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from(tabla).select('id,updated_at').order('id').range(desde, desde + 999);
    if (error) return null;
    for (const f of data ?? []) v.set(String(f.id), String(f.updated_at ?? ''));
    if (!data || data.length < 1000) return v;
  }
}

/** Trae filas concretas por id (en bloques de 100). */
export async function leerFilas(tabla: string, ids: string[]): Promise<Array<{ r: Reg; v: string }>> {
  const out: Array<{ r: Reg; v: string }> = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await db.from(tabla).select('*').in('id', ids.slice(i, i + 100));
    if (error) throw new ErrorDatos(mensajeError(error));
    for (const f of data ?? []) out.push({ r: aObjeto(f as Record<string, unknown>), v: String((f as Record<string, unknown>).updated_at ?? '') });
  }
  return out;
}

/* Claves de crm_meta que usa la app (agenda y catalogos) */
export const CLAVES_META = [
  'calReuniones', 'calNotas', 'calMetas', 'calDiarios', 'aseguradoras', 'ramosCfg', 'vcReglas',
  'encomiendas', 'mensajero', 'mensajeroTel', 'mensajeroEmail',
  'notas', 'comRates', 'etiquetas', 'plantillas', 'comisCfg',
] as const;
export type Meta = {
  calReuniones: Reg[];
  calNotas: Reg[];
  calMetas: Reg[];
  calDiarios: Record<string, unknown>;
  aseguradoras: Array<{ nombre?: string }>;
  ramosCfg: unknown;
  /** Reglas de venta cruzada del CRM web: {tiene, ofrecer, tipo, msg} */
  vcReglas: Array<{ tiene?: string; ofrecer?: string; tipo?: string; msg?: string }>;
  /** Mensajero: asignaciones (encomiendas) y datos del mensajero */
  encomiendas: Reg[];
  mensajero: string;
  mensajeroTel: string;
  mensajeroEmail: string;
  /** Notas & Recordatorios del CRM web: {id, titulo, cuerpo, fecha, clienteId, etiqueta, color, done, cre} */
  notas: Reg[];
  /** Tasas de comision: {aseg, ramo, pct} (ramo vacio = todos) */
  comRates: Array<{ aseg?: string; ramo?: string; pct?: number }>;
  /** Etiquetas {id, nombre, color} */
  etiquetas: Reg[];
  /** Plantillas de WhatsApp {id, nombre, tipo, texto} */
  plantillas: Reg[];
  /** Configuracion de comisiones por aseguradora/ramo (forma libre del CRM web) */
  comisCfg: Record<string, unknown>;
};

export async function leerMeta(): Promise<Meta> {
  const { data, error } = await db.from('crm_meta').select('clave,valor').in('clave', CLAVES_META as unknown as string[]);
  if (error) throw new ErrorDatos(mensajeError(error));
  const m: Record<string, unknown> = {};
  for (const f of data ?? []) m[f.clave as string] = f.valor;
  const lista = (v: unknown) => (Array.isArray(v) ? (v as Reg[]) : []);
  return {
    calReuniones: lista(m.calReuniones),
    calNotas: lista(m.calNotas),
    calMetas: lista(m.calMetas),
    calDiarios: m.calDiarios && typeof m.calDiarios === 'object' && !Array.isArray(m.calDiarios) ? (m.calDiarios as Record<string, unknown>) : {},
    aseguradoras: Array.isArray(m.aseguradoras) ? (m.aseguradoras as Array<{ nombre?: string }>) : [],
    ramosCfg: m.ramosCfg ?? null,
    vcReglas: Array.isArray(m.vcReglas) ? (m.vcReglas as Meta['vcReglas']) : [],
    encomiendas: lista(m.encomiendas),
    mensajero: typeof m.mensajero === 'string' ? m.mensajero : 'Francisco Flores',
    mensajeroTel: typeof m.mensajeroTel === 'string' ? m.mensajeroTel : '66714215',
    mensajeroEmail: typeof m.mensajeroEmail === 'string' ? m.mensajeroEmail : '',
    notas: lista(m.notas),
    comRates: Array.isArray(m.comRates) ? (m.comRates as Meta['comRates']) : [],
    etiquetas: lista(m.etiquetas),
    plantillas: lista(m.plantillas),
    comisCfg: m.comisCfg && typeof m.comisCfg === 'object' && !Array.isArray(m.comisCfg) ? (m.comisCfg as Record<string, unknown>) : {},
  };
}

export type Cartera = Record<Modulo, Reg[]> & { meta: Meta; cargadoEn: number };

export async function cargarCartera(): Promise<Cartera> {
  const mods = Object.keys(TABLA) as Modulo[];
  const [tablas, meta] = await Promise.all([Promise.all(mods.map((m) => leerTabla(TABLA[m]))), leerMeta()]);
  const c = { meta, cargadoEn: Date.now() } as Cartera;
  mods.forEach((m, i) => (c[m] = tablas[i]));
  c.clientes.sort((a, b) => txt(a, 'nombre').localeCompare(txt(b, 'nombre'), 'es'));
  return c;
}

/* ---------------- acceso comodo a campos ---------------- */

export const txt = (r: Reg | undefined | null, k: string): string => {
  const v = r?.[k];
  return v === null || v === undefined ? '' : typeof v === 'object' ? '' : String(v);
};
export const num = (r: Reg | undefined | null, k: string): number | null => aNum(r?.[k]);
export const fec = (r: Reg | undefined | null, k: string): string => aFecha(r?.[k]) ?? '';

/* ---------------- escritura ---------------- */

/**
 * Crea (id = null) o actualiza un registro con los campos dados.
 * Devuelve el registro tal como quedo en la base.
 */
export async function guardarRegistro(modulo: Modulo, id: string | null, cambios: Record<string, unknown>): Promise<Reg> {
  const tabla = TABLA[modulo];
  const limpio: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(cambios)) {
    limpio[k] = typeof v === 'string' ? limpiarTexto(v, 5000) : v;
  }

  if (id === null) {
    const obj = { id: nuevoId(PREFIJO_ID[modulo]), ...limpio, creadoDesde: 'app-movil' };
    const fila = aFila(obj, tabla);
    const { error } = await db.from(tabla).insert(fila);
    if (error) throw new ErrorDatos(mensajeError(error));
    return aObjeto(fila);
  }

  return actualizarCon(modulo, id, () => limpio);
}

/**
 * Actualiza un registro partiendo SIEMPRE de lo que hay en la base en este
 * momento: `cambiar` recibe la version actual y devuelve solo los campos a cambiar.
 */
export async function actualizarCon(modulo: Modulo, id: string, cambiar: (actual: Reg) => Record<string, unknown>): Promise<Reg> {
  const tabla = TABLA[modulo];
  const { data, error: e1 } = await db.from(tabla).select('*').eq('id', id).maybeSingle();
  if (e1) throw new ErrorDatos(mensajeError(e1));
  if (!data) throw new ErrorDatos('Este registro ya no existe en el CRM.');
  const actual = aObjeto(data as Record<string, unknown>);
  const obj = { ...actual, ...cambiar(actual), id };
  const fila = { ...aFila(obj, tabla), updated_at: new Date().toISOString() };
  const { error, count } = await db.from(tabla).update(fila, { count: 'exact' }).eq('id', id);
  if (error) throw new ErrorDatos(mensajeError(error));
  if (count === 0) throw new ErrorDatos('No tienes permiso para modificar este registro.');
  marcarVersion(tabla, id, String(fila.updated_at));
  return aObjeto(fila);
}

/** Lo que escribe este dispositivo no hace falta volver a bajarlo. */
function marcarVersion(tabla: string, id: string, v: string) {
  if (!versiones.has(tabla)) versiones.set(tabla, new Map());
  versiones.get(tabla)!.set(id, v);
}

/* ---------------- historial / acciones (igual que el CRM web) ---------------- */

export type EntradaHistorial = { id?: string; fecha?: string; accion?: string; nota?: string; resultado?: string; tipo?: string };

export function historial(r: Reg): EntradaHistorial[] {
  const h = r.historial;
  return Array.isArray(h) ? (h as EntradaHistorial[]).filter((x) => x && typeof x === 'object') : [];
}

/** Registra una accion en el historial (se agrega; nunca se borra lo anterior). */
export async function registrarAccion(modulo: Modulo, id: string, e: EntradaHistorial, otros: Record<string, unknown> = {}): Promise<Reg> {
  const entrada = {
    ...(modulo === 'clientes' ? { id: nuevoId('H') } : {}),
    fecha: e.fecha || new Date().toISOString().slice(0, 10),
    accion: limpiarTexto(e.accion ?? '', 500),
    resultado: limpiarTexto(e.resultado ?? '', 2000),
    tipo: e.tipo || 'manual',
  };
  return actualizarCon(modulo, id, (a) => {
    const lista = historial(a);
    // Clientes: lo nuevo arriba (unshift); prospectos: al final (push). Igual que el web.
    return { historial: modulo === 'clientes' ? [entrada, ...lista] : [...lista, entrada], ...otros };
  });
}

/** Solo para tareas (la agenda del CRM permite eliminarlas). */
/**
 * Elimina un registro de cualquier modulo (igual que el boton 🗑 del CRM web).
 * Se pide a la base que devuelva lo borrado: si no devuelve nada es que no
 * habia permiso o ya no existia, y se avisa en vez de fingir que se borro.
 */
export async function eliminarRegistro(m: Modulo, id: string): Promise<void> {
  const tabla = TABLA[m];
  const { data, error } = await db.from(tabla).delete().eq('id', id).select('id');
  if (error) throw new ErrorDatos(mensajeError(error));
  if (!data?.length) throw new ErrorDatos('No se pudo eliminar: ya no existe o no tienes permiso.');
  versiones.get(tabla)?.delete(id);
}

export const eliminarTarea = (id: string) => eliminarRegistro('tareas', id);

/**
 * Modifica una lista de crm_meta (reuniones, notas, metas, diario).
 * Lee el valor actual de la base justo antes de escribir, para no borrar
 * lo que se haya agregado desde la computadora.
 */
export async function guardarMeta<T>(clave: (typeof CLAVES_META)[number], vacio: T, cambiar: (actual: T) => T): Promise<T> {
  const { data, error } = await db.from('crm_meta').select('valor').eq('clave', clave).maybeSingle();
  if (error) throw new ErrorDatos(mensajeError(error));
  const actual = (data?.valor ?? vacio) as T;
  const nuevo = cambiar(JSON.parse(JSON.stringify(actual)) as T);
  const { error: e2 } = await db.from('crm_meta').upsert({ clave, valor: nuevo }, { onConflict: 'clave' });
  if (e2) throw new ErrorDatos(mensajeError(e2));
  return nuevo;
}

/* ---------------- documentos adjuntos ---------------- */

export type Adjunto = { id?: string; name?: string; type?: string; path?: string; size?: number };

export function adjuntos(r: Reg): Adjunto[] {
  const a = r.archivos;
  const lista = Array.isArray(a) ? a : a && typeof a === 'object' ? [a] : [];
  return (lista as Adjunto[]).filter((f) => f && typeof f === 'object');
}

/** Enlace para abrir un adjunto: temporal (5 min) si esta en el deposito privado. */
export async function enlaceAdjunto(f: Adjunto & { b64?: string }): Promise<string> {
  if (!f.path && f.b64 && /^data:/.test(f.b64)) {
    // Archivo guardado dentro de la ficha (aun no subido al deposito).
    const coma = f.b64.indexOf(',');
    const tipo = f.b64.slice(5, f.b64.indexOf(';')) || 'application/octet-stream';
    const bin = atob(f.b64.slice(coma + 1));
    const u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u], { type: tipo }));
  }
  if (!f.path) throw new ErrorDatos('Este archivo aún no se ha subido a la nube desde la computadora.');
  const { data, error } = await db.storage.from('adjuntos').createSignedUrl(f.path, 300);
  if (error || !data?.signedUrl) throw new ErrorDatos('No se pudo abrir el archivo.');
  return data.signedUrl;
}

export const MAX_ADJUNTO = 2.5 * 1024 * 1024; // mismo limite que el CRM web

/** Sube un archivo al deposito privado y lo agrega a la ficha (igual que el CRM web). */
export async function agregarAdjunto(modulo: Modulo, id: string, archivo: File): Promise<Reg> {
  if (archivo.size > MAX_ADJUNTO) throw new ErrorDatos(`"${archivo.name.slice(0, 30)}" supera 2.5 MB.`);
  const { data: s } = await db.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) throw new ErrorDatos('Tu sesión venció. Vuelve a entrar.');
  const fid = nuevoId('F');
  const ruta = `${uid}/${modulo}/${id}/${fid}-${archivo.name.replace(/[^\w.-]/g, '_')}`;
  const { error } = await db.storage.from('adjuntos').upload(ruta, archivo, {
    contentType: archivo.type || 'application/octet-stream', upsert: false,
  });
  if (error) throw new ErrorDatos('No se pudo subir el archivo.');
  const nuevo = {
    id: fid, name: archivo.name, type: archivo.type, size: archivo.size, b64: '', path: ruta,
    fecha: new Date().toISOString().slice(0, 10),
  };
  try {
    return await actualizarCon(modulo, id, (a) => ({ archivos: [...adjuntos(a), nuevo] }));
  } catch (e) {
    await db.storage.from('adjuntos').remove([ruta]);
    throw e;
  }
}

export async function eliminarAdjunto(modulo: Modulo, id: string, f: Adjunto): Promise<Reg> {
  const r = await actualizarCon(modulo, id, (a) => ({
    archivos: adjuntos(a).filter((x) => (f.id ? x.id !== f.id : x.path !== f.path || x.name !== f.name)),
  }));
  if (f.path) await db.storage.from('adjuntos').remove([f.path]);
  return r;
}
