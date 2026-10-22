/* Cumpleaños: logica pura (sin red ni estado), por eso tiene pruebas. */
import type { Reg } from './datos';

export const TEL_JAC = '+507 6292-6010';
export const LEGAL_SSRP = 'Regulado y supervisado por la Superintendencia de Seguros y Reaseguros de Panamá.';
export const ACCION_CUMPLE = '🎂 Felicitación de cumpleaños enviada';

/** Mismo texto que la plantilla 🎂 Cumpleaños del WhatsApp masivo del CRM web (wamBuildMsg 'bday'). */
export const MENSAJE_WA_DEFECTO =
  '🎂 ¡Feliz Cumpleaños, {primerNombre}! 🎉\n\n'
  + 'Desde *JAC Seguros* | *Jely An Castro* te deseamos un maravilloso día lleno de salud, felicidad y bendiciones. '
  + '¡Que cumplas muchos más! 🌟\n\n'
  + `📞 ${TEL_JAC}\n🌐 www.jacsegurospa.com\n_Jely An Castro Pérez · JAC Seguros_`;

/** Mismo texto que la tarjeta de cumpleaños del CRM web. */
export const MENSAJE_TARJETA_DEFECTO =
  'En este día tan especial, todo el equipo de JAC Seguros | Jely An Castro te desea un cumpleaños lleno de salud, felicidad y muchas bendiciones.';

const DIA = 86_400_000;
const p2 = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${p2(m)}-${p2(d)}`;
const bisiesto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

export type FechaNac = { y: number | null; m: number; d: number };

/** 'AAAA-MM-DD', 'AAAA/MM/DD' o 'DD/MM/AAAA' (como guarda el CRM web). */
export function leerFechaNac(v: unknown): FechaNac | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const s = v.trim();
  let y: number, m: number, d: number;
  let r = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(s);
  if (r) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s))) [y, m, d] = [+r[3], +r[2], +r[1]];
  else return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (d > new Date(Date.UTC(2024, m, 0)).getUTCDate()) return null; // 2024 es bisiesto: 29-feb vale
  return { y: y >= 1900 ? y : null, m, d };
}

/** Dia del cumpleaños en el año dado. El 29 de febrero se celebra el 28 en años no bisiestos. */
export function cumpleEn(f: FechaNac, anio: number): string {
  const d = f.m === 2 && f.d === 29 && !bisiesto(anio) ? 28 : f.d;
  return iso(anio, f.m, d);
}

const diasEntre = (desde: Date, hasta: string) => {
  const [y, m, d] = hasta.split('-').map(Number);
  return Math.round((utc(y, m, d) - utc(desde.getFullYear(), desde.getMonth() + 1, desde.getDate())) / DIA);
};

export type InfoCumple = {
  /** Ocurrencia mas cercana a hoy (pasada o futura) */
  fecha: string;
  /** Dias hasta esa ocurrencia (negativo si ya paso) */
  delta: number;
  /** Proximo cumpleaños (hoy o en adelante) y dias que faltan */
  proximo: string;
  dias: number;
  /** Años que cumple en la ocurrencia mas cercana (null si no se sabe el año) */
  edad: number | null;
  /** Año de esa ocurrencia: es el que se marca como felicitado */
  anio: number;
};

export function infoCumple(f: FechaNac, hoy: Date = new Date()): InfoCumple {
  const a = hoy.getFullYear();
  const ocurrencias = [a - 1, a, a + 1].map((y) => ({ y, fecha: cumpleEn(f, y), delta: diasEntre(hoy, cumpleEn(f, y)) }));
  const cercana = ocurrencias.reduce((x, o) => (Math.abs(o.delta) < Math.abs(x.delta) ? o : x));
  const prox = ocurrencias.find((o) => o.delta >= 0)!;
  const edad = f.y !== null ? cercana.y - f.y : null;
  return {
    fecha: cercana.fecha, delta: cercana.delta, proximo: prox.fecha, dias: prox.delta,
    edad: edad !== null && edad >= 0 && edad <= 120 ? edad : null, anio: cercana.y,
  };
}

/** 'MARIA JOSÉ pérez' -> 'Maria José Pérez' (respeta palabras con mayusculas mezcladas como McKay). */
export function nombrePropio(s: string): string {
  return s.trim().split(/\s+/).map((w) => (w === w.toUpperCase() || w === w.toLowerCase()
    ? w.toLowerCase().replace(/(^|['-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase())
    : w)).join(' ');
}

export function primerNombre(nombre: string): string {
  return nombrePropio(nombre).split(' ')[0] || 'Cliente';
}

export function rellenarMensaje(plantilla: string, v: { nombre: string; edad: number | null }): string {
  return plantilla
    .replace(/{primerNombre}/gi, primerNombre(v.nombre))
    .replace(/{nombre}/gi, nombrePropio(v.nombre) || 'Cliente')
    .replace(/{edad}/gi, v.edad !== null ? String(v.edad) : '');
}

type Hist = { fecha?: unknown; accion?: unknown; nota?: unknown };

/** Ya se felicito para el cumpleaños del año dado (campo cumpleFelicitado o una entrada del historial). */
export function yaFelicitado(r: Reg, anio: number): boolean {
  if (String(r.cumpleFelicitado ?? '') === String(anio)) return true;
  const h = Array.isArray(r.historial) ? (r.historial as Hist[]) : [];
  return h.some((e) => e && typeof e === 'object'
    && String(e.fecha ?? '').startsWith(String(anio))
    && /cumplea/i.test(`${String(e.accion ?? '')} ${String(e.nota ?? '')}`));
}

export type ItemCumple = InfoCumple & {
  r: Reg;
  modulo: 'clientes' | 'prospectos';
  nombre: string;
  tel: string;
  felicitado: boolean;
  nac: FechaNac;
};

export function listaCumples(clientes: Reg[], prospectos: Reg[], hoy: Date = new Date()): ItemCumple[] {
  const out: ItemCumple[] = [];
  const meter = (r: Reg, modulo: ItemCumple['modulo']) => {
    const nac = leerFechaNac(r.fNac) ?? leerFechaNac(r.fechaNac);
    if (!nac) return;
    const info = infoCumple(nac, hoy);
    out.push({
      ...info, r, modulo, nac,
      nombre: String(r.nombre ?? '').trim() || 'Sin nombre',
      tel: String(r.cel ?? '') || String(r.tel ?? ''),
      felicitado: yaFelicitado(r, info.anio),
    });
  };
  clientes.forEach((r) => meter(r, 'clientes'));
  prospectos.forEach((r) => meter(r, 'prospectos'));
  return out.sort((a, b) => a.dias - b.dias || a.nombre.localeCompare(b.nombre, 'es'));
}

export type Pestana = 'hoy' | 'semana' | 'mes' | '30' | 'todos';

/** Lunes a domingo de la semana de hoy */
function semana(hoy: Date): [number, number] {
  const dow = (hoy.getDay() + 6) % 7; // 0 = lunes
  return [-dow, 6 - dow];
}

export function enPestana(x: ItemCumple, p: Pestana, hoy: Date = new Date()): boolean {
  if (p === 'hoy') return x.delta === 0;
  if (p === 'semana') { const [a, b] = semana(hoy); return x.delta >= a && x.delta <= b; }
  if (p === 'mes') return x.nac.m === hoy.getMonth() + 1;
  if (p === '30') return x.dias <= 30;
  return true;
}

/** Orden de la pestaña: por mes en 'todos' (empezando por el mes actual), si no por fecha. */
export function ordenar(xs: ItemCumple[], p: Pestana, hoy: Date = new Date()): ItemCumple[] {
  const mes = hoy.getMonth() + 1;
  const clave = (x: ItemCumple) => p === 'todos'
    ? ((x.nac.m - mes + 12) % 12) * 100 + x.nac.d
    : x.delta;
  return [...xs].sort((a, b) => clave(a) - clave(b) || a.nombre.localeCompare(b.nombre, 'es'));
}

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** '22 de octubre' */
export function diaMes(isoFecha: string): string {
  const [, m, d] = isoFecha.split('-').map(Number);
  return `${d} de ${MESES[m - 1].toLowerCase()}`;
}

/** 'hoy', 'mañana', 'en 5 días', 'ayer', 'hace 3 días' */
export function cuando(delta: number): string {
  if (delta === 0) return '¡Hoy!';
  if (delta === 1) return 'mañana';
  if (delta === -1) return 'ayer';
  return delta > 0 ? `en ${delta} días` : `hace ${-delta} días`;
}
