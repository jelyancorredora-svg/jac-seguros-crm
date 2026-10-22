import { agregarAdjunto, adjuntos, ErrorDatos, guardarRegistro, txt, type Cartera, type Reg } from './datos';
import { CAMPOS, type Modulo } from './esquema';
import { normalizar } from './formato';

/*
 * Importacion de un "paquete" (.jacimp): datos + archivos de uno o varios
 * clientes, preparados a partir de documentos (polizas, cedulas, registros).
 *
 * Reglas:
 *  - Cada registro se busca primero en el CRM (cliente por cedula o nombre,
 *    poliza por numero + aseguradora, vehiculo por placa).
 *  - Si ya existe, SOLO se completan los campos que estan vacios. Nada de lo
 *    que ya escribiste se cambia.
 *  - Si no existe, se crea con el mismo formato que el CRM web.
 *  - Un archivo no se sube dos veces (se compara por nombre en la ficha).
 *  - Nada se guarda hasta que apruebas el resumen.
 */

type Archivo = { nombre: string; tipo: string; b64: string };
type Item = { match: Record<string, string>; cliente?: string; datos: Record<string, unknown>; archivos?: string[] };
export type Paquete = {
  version: 1;
  descripcion?: string;
  clientes?: Item[];
  polizas?: Item[];
  vehiculos?: Item[];
  archivos?: Archivo[];
};

const MAX_ARCHIVO = 2.5 * 1024 * 1024;
const TIPOS_OK = /^(application\/pdf|image\/(jpeg|png|webp|heic))$/;
const PROHIBIDOS = new Set(['id', 'archivos', 'historial', 'historialWA', 'tareas', 'cotizaciones', 'amparos', 'clienteId', 'creadoDesde']);

/** "04-736-1335" y "4-736-1335" son la misma cedula */
export const normCedula = (c: string) =>
  c.toUpperCase().replace(/[^0-9A-Z-]/g, '').split('-').map((p) => p.replace(/^0+(?=\d)/, '')).join('-');
const normNum = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '');

/* ---------------- validacion del paquete (es un archivo externo) ---------------- */

function limpiarDatos(mod: Modulo, d: unknown): Record<string, unknown> {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new ErrorDatos('Paquete dañado.');
  const conocidos = new Set(CAMPOS[mod].map((c) => c.k));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>).slice(0, 80)) {
    if (PROHIBIDOS.has(k) || !/^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(k)) continue;
    if (typeof v === 'number' && isFinite(v)) out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, conocidos.has(k) ? 3000 : 500);
  }
  return out;
}

export function leerPaquete(texto: string): Paquete {
  let p: Paquete;
  try {
    p = JSON.parse(texto) as Paquete;
  } catch {
    throw new ErrorDatos('El archivo no es un paquete de importación válido.');
  }
  if (!p || p.version !== 1) throw new ErrorDatos('Versión de paquete no reconocida.');
  const items = (mod: Modulo, l: unknown) => (Array.isArray(l) ? l.slice(0, 500) : []).map((x: Item) => ({
    match: Object.fromEntries(Object.entries(x?.match ?? {}).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, String(v).slice(0, 200)])),
    cliente: typeof x?.cliente === 'string' ? x.cliente.slice(0, 50) : undefined,
    datos: limpiarDatos(mod, x?.datos),
    archivos: Array.isArray(x?.archivos) ? x.archivos.filter((a): a is string => typeof a === 'string').slice(0, 30) : [],
  }));
  const archivos = (Array.isArray(p.archivos) ? p.archivos : []).filter((a) =>
    a && typeof a.nombre === 'string' && typeof a.b64 === 'string' && TIPOS_OK.test(a.tipo ?? ''));
  for (const a of archivos) {
    if ((a.b64.length * 3) / 4 > MAX_ARCHIVO) throw new ErrorDatos(`"${a.nombre}" supera 2.5 MB.`);
  }
  return {
    version: 1, descripcion: typeof p.descripcion === 'string' ? p.descripcion.slice(0, 300) : undefined,
    clientes: items('clientes', p.clientes), polizas: items('polizas', p.polizas), vehiculos: items('vehiculos', p.vehiculos), archivos,
  };
}

/* ---------------- plan: que se crea, que se completa ---------------- */

export type Paso = {
  modulo: Modulo;
  etiqueta: string;
  existente: Reg | null;
  /** Campos que se agregan (solo los vacios si ya existe) */
  campos: Record<string, unknown>;
  /** Archivos que se suben (los que ya estan, se omiten) */
  archivos: Archivo[];
  omitidos: string[];
  /** Cedula del cliente al que pertenece (polizas y vehiculos) */
  cliente?: string;
};

const vacio = (v: unknown) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);

function buscarCliente(c: Cartera, m: Record<string, string>): Reg | null {
  if (m.cedula) {
    const k = normCedula(m.cedula);
    const r = c.clientes.find((x) => txt(x, 'cedula') && normCedula(txt(x, 'cedula')) === k);
    if (r) return r;
  }
  if (m.nombre) {
    const n = normalizar(m.nombre).split(/\s+/).sort().join(' ');
    return c.clientes.find((x) => normalizar(txt(x, 'nombre')).split(/\s+/).sort().join(' ') === n) ?? null;
  }
  return null;
}

function buscar(c: Cartera, mod: Modulo, m: Record<string, string>): Reg | null {
  if (mod === 'clientes') return buscarCliente(c, m);
  if (mod === 'polizas' && m.num) {
    const n = normNum(m.num);
    const cands = c.polizas.filter((p) => normNum(txt(p, 'num')) === n);
    return cands.find((p) => !m.aseg || normalizar(txt(p, 'aseg')).includes(normalizar(m.aseg))) ?? cands[0] ?? null;
  }
  if (mod === 'vehiculos' && m.placa) {
    const n = normNum(m.placa);
    return c.vehiculos.find((v) => normNum(txt(v, 'placa')) === n) ?? null;
  }
  return null;
}

export function planificar(p: Paquete, c: Cartera): Paso[] {
  const porNombre = new Map((p.archivos ?? []).map((a) => [a.nombre, a]));
  const pasos: Paso[] = [];
  const agregar = (mod: Modulo, it: Item, etiqueta: string) => {
    const ex = buscar(c, mod, it.match);
    const campos: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(it.datos)) if (!ex || vacio(ex[k])) campos[k] = v;
    const yaSubidos = new Set(ex ? adjuntos(ex).map((f) => normalizar(f.name ?? '')) : []);
    const archivos: Archivo[] = [];
    const omitidos: string[] = [];
    for (const n of it.archivos ?? []) {
      const a = porNombre.get(n);
      if (!a) omitidos.push(`${n} (no viene en el paquete)`);
      else if (yaSubidos.has(normalizar(n))) omitidos.push(`${n} (ya estaba en la ficha)`);
      else archivos.push(a);
    }
    pasos.push({ modulo: mod, etiqueta, existente: ex, campos, archivos, omitidos, cliente: it.cliente });
  };
  for (const it of p.clientes ?? []) agregar('clientes', it, String(it.datos.nombre ?? it.match.nombre ?? it.match.cedula));
  for (const it of p.polizas ?? []) agregar('polizas', it, `Póliza ${it.match.num ?? ''} ${it.match.aseg ?? ''}`.trim());
  for (const it of p.vehiculos ?? []) agregar('vehiculos', it, `Vehículo ${it.match.placa ?? ''}`);
  return pasos;
}

/* ---------------- ejecucion ---------------- */

function aArchivo(a: Archivo): File {
  const bin = atob(a.b64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new File([u], a.nombre, { type: a.tipo });
}

export async function ejecutar(
  pasos: Paso[], c: Cartera, poner: (m: Modulo, r: Reg) => void, progreso: (t: string) => void,
): Promise<string[]> {
  const hecho: string[] = [];
  const clientes = new Map<string, Reg>(); // cedula normalizada -> cliente
  for (const x of c.clientes) if (txt(x, 'cedula')) clientes.set(normCedula(txt(x, 'cedula')), x);

  for (const p of pasos) {
    progreso(p.etiqueta);
    let r = p.existente;
    const campos = { ...p.campos };
    if (p.modulo !== 'clientes' && p.cliente) {
      const cl = clientes.get(normCedula(p.cliente));
      if (cl && (!r || vacio(r.clienteId))) {
        campos.clienteId = cl.id;
        if (p.modulo === 'polizas') Object.assign(campos, { nombreCliente: txt(cl, 'nombre'), cedCliente: txt(cl, 'cedula'), celCliente: txt(cl, 'cel'), emailCliente: txt(cl, 'email') });
        if (p.modulo === 'vehiculos') Object.assign(campos, { clienteNom: txt(cl, 'nombre'), clienteDoc: txt(cl, 'cedula') });
      }
    }
    if (!r) {
      r = await guardarRegistro(p.modulo, null, { ...campos, archivos: [] });
      hecho.push(`➕ Creado: ${p.etiqueta}`);
    } else if (Object.keys(campos).length) {
      r = await guardarRegistro(p.modulo, r.id, campos);
      hecho.push(`✏️ Completado: ${p.etiqueta} (${Object.keys(campos).length} campos)`);
    } else {
      hecho.push(`✓ Ya estaba completo: ${p.etiqueta}`);
    }
    poner(p.modulo, r);
    if (p.modulo === 'clientes' && txt(r, 'cedula')) clientes.set(normCedula(txt(r, 'cedula')), r);
    for (const a of p.archivos) {
      progreso(`Subiendo ${a.nombre}`);
      r = await agregarAdjunto(p.modulo, r.id, aArchivo(a));
      poner(p.modulo, r);
      hecho.push(`📎 ${a.nombre} → ${p.etiqueta}`);
    }
  }
  return hecho;
}

