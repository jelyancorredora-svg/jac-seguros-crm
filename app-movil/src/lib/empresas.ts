/* Reglas puras del modulo "Empresas & Colectivos" y "Aseguradoras" del CRM web (REmp / RAseg). */
import type { Reg } from './datos';
import { diasHasta, enlaceWhatsApp, fecha, normalizar } from './formato';

/* Lectores minimos (sin importar datos.ts, que arrastra el cliente de Supabase) */
const txt = (r: Reg | undefined | null, k: string): string => {
  const v = r?.[k];
  return v === null || v === undefined || typeof v === 'object' ? '' : String(v);
};
const num = (r: Reg | undefined | null, k: string): number | null => {
  const v = r?.[k];
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : null;
};

/** Ramos que el CRM web trata como pólizas colectivas */
export const RAMOS_COLECTIVOS = ['SALUD/MÉDICOS', 'VIDA', 'ACCIDENTES PERSONALES'] as const;
export const esColectiva = (p: Reg) => (RAMOS_COLECTIVOS as readonly string[]).includes(txt(p, 'ramo'));

/** Colores por aseguradora (ACOL del CRM web) */
const ACOL: Record<string, string> = {
  ASSA: '#005F9E', SURA: '#E85D04', IS: '#1A3A6B', MAPFRE: '#C8102E', PALIG: '#2D6A4F', UNIVIVIR: '#7B2D8B', FEDPA: '#8B5E00',
  'Ancón': '#3D405B', 'WW Medical': '#0D7377', Acerta: '#5C4033', Generali: '#C62828', Chubb: '#2E7D32', Aliados: '#0277BD',
  'La Regional': '#E65100', General: '#4E342E', VUMI: '#00548B', 'VUMI-LA REGIONAL DE SEGUROS': '#00548B',
};
export const colorAseg = (a: string) => ACOL[a] ?? '#64748B';

/** Estado de la póliza como statusB() del CRM web */
export function estadoPoliza(p: Reg, hoy: Date = new Date()): { texto: string; clase: string } {
  const d = diasHasta(txt(p, 'fechaFin').slice(0, 10), hoy) ?? 0;
  const est = txt(p, 'estado').toLowerCase();
  if (est === 'cancelada') return { texto: 'Cancelada', clase: 'e-neutra' };
  if (est === 'pendiente') return { texto: 'Pendiente', clase: 'e-aviso' };
  if (est === 'suspendida') return { texto: 'Suspendida', clase: 'e-neutra' };
  const venc = { texto: '🔴 Vencida', clase: 'e-peligro' };
  if (est === 'vencida' || (est !== 'vigente' && d < 0)) return venc;
  if (d >= 0 && d <= 7) return { texto: `🚨 ${d}d`, clase: 'e-peligro' };
  if (d >= 0 && d <= 30) return { texto: `⚠️ ${d}d`, clase: 'e-aviso' };
  return { texto: '✓ Vigente', clase: 'e-ok' };
}

/* ---------------- asegurados de una póliza colectiva ---------------- */

export type Asegurado = { id?: string; nombre?: string; cedula?: string; fNac?: string; cargo?: string; cel?: string; email?: string };

export function asegurados(p: Reg | undefined | null): Asegurado[] {
  const a = p?.asegurados;
  return Array.isArray(a) ? (a as Asegurado[]).filter((x) => x && typeof x === 'object') : [];
}

/** Clave con la que el web identifica a un asegurado (id o, en los viejos, la cédula) */
export const claveAsegurado = (a: Asegurado) => String(a.id || a.cedula || '');

export const quitarAsegurado = (lista: Asegurado[], clave: string) => lista.filter((a) => claveAsegurado(a) !== clave);
export const reemplazarAsegurado = (lista: Asegurado[], clave: string, nuevo: Asegurado) =>
  lista.map((a) => (claveAsegurado(a) === clave ? { ...a, ...nuevo } : a));

/* ---------------- aseguradoras (crm_meta 'aseguradoras') ---------------- */

export type Aseguradora = {
  id?: string; nombre?: string; ruc?: string; email?: string; tel?: string; codInt?: string; banco?: string;
  linkPago?: string; itbmsPct?: number | string; retPct?: number | string; dir?: string; [k: string]: unknown;
};

/** Nombre corto como lo calcula RAseg() */
export const nombreCorto = (nombre: string) =>
  nombre.replace(/COMPAÑIA DE SEGUROS.*|S\.A\..*|DE PANAMÁ.*|,.*$/gi, '').trim();

export function polizasDeAseguradora(a: Aseguradora, polizas: Reg[]): number {
  const n = String(a.nombre ?? '');
  const corto = nombreCorto(n);
  const primero = n.split(',')[0].trim();
  return polizas.filter((p) => txt(p, 'aseg') === corto || txt(p, 'aseg') === primero).length;
}

export const pct = (v: unknown): number => {
  const n = parseFloat(String(v ?? ''));
  return isFinite(n) ? n : 0;
};

/** Solo enlaces https (el link de pago lo escribe el usuario) */
export const enlaceSeguro = (u: string | undefined) => (u && /^https:\/\/[^\s"'<>]+$/i.test(u.trim()) ? u.trim() : null);

/* ---------------- WhatsApp (mismos textos que el CRM web) ---------------- */

export function waTexto(tel: string, msg: string): string | null {
  const base = enlaceWhatsApp(tel);
  return base ? `${base}?text=${encodeURIComponent(msg)}` : null;
}

const primerNombre = (s: string) => s.trim().split(' ')[0] ?? '';
const dineroWeb = (n: number | null) => '$' + (n ?? 0).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const msgEmpresa = (nombre: string) =>
  `Hola ${primerNombre(nombre)} 👋🏼\n\nTe saluda *Jely An Castro* de *JAC Seguros | Jely An Castro*.\n\n¿En qué podemos ayudarte hoy?\n\n_📞 +507 6292-6010_`;

export const msgAsegurado = (nombre: string) =>
  `Hola ${primerNombre(nombre)} 👋🏼, te contactamos de *JAC Seguros | Jely An Castro*.\n\n_JAC Seguros · 📞 +507 6292-6010_`;

export const msgAseguradora = () => 'Hola, soy Jely An Castro de JAC Seguros | Jely An Castro. Me comunico para...';

export function msgRenovacion(p: Reg, cliente: string): string {
  return `Hola ${primerNombre(cliente)} 👋🏼\n\nTe contacto de *JAC Seguros | Jely An Castro* para informarte que tu póliza de *${txt(p, 'ramo')}* con *${txt(p, 'aseg')}* (N° ${txt(p, 'num')}) vence el *${fecha(txt(p, 'fechaFin').slice(0, 10))}*.\n\nPara renovarla sin interrupciones comunícate conmigo 😊\n\n_Jely An Castro Pérez · 📞 +507 6292-6010_`;
}

export function msgCobro(p: Reg, cliente: string): string {
  return `Hola ${primerNombre(cliente)} 👋🏼\n\nTe recordamos el pago de tu póliza de *${txt(p, 'ramo')}* con *${txt(p, 'aseg')}* (N° ${txt(p, 'num')}) por *${dineroWeb(num(p, 'prima'))}*.\n\n_Jely An Castro Pérez · JAC Seguros · 📞 +507 6292-6010_`;
}

/* ---------------- busqueda ---------------- */

export const coincide = (t: string, ...campos: Array<string | undefined>) =>
  !t || campos.some((c) => normalizar(c).includes(t));

/** Nombre de la empresa como lo muestra el web: 3 primeras palabras */
export const nombreTres = (s: string) => (s || '—').split(' ').slice(0, 3).join(' ');

