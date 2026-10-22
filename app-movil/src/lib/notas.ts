/* Notas & Recordatorios (pg-not del CRM web): reglas puras, con pruebas. */
import type { Reg } from './datos';
import { normalizar } from './formato';

export type Nota = Reg & {
  titulo?: string; cuerpo?: string; fecha?: string; clienteId?: string;
  etiqueta?: string; color?: string; done?: boolean; estado?: string; cre?: string;
};

/** Los mismos cinco colores del selector del CRM web */
export const COLORES_NOTA: Array<[string, string]> = [
  ['#2563EB', '🔵 Azul'], ['#15803D', '🟢 Verde'], ['#D97706', '🟡 Amarillo'], ['#DC2626', '🔴 Rojo'], ['#7C3AED', '🟣 Morado'],
];

/** Estados del selector de cada nota (setNotaEstado) */
export const ESTADOS_NOTA: Array<[string, string]> = [
  ['pendiente', '● Normal'], ['en_seguimiento', '🔍 En Seguimiento'], ['delegado', '→ Delegado'],
  ['reenviado', '↩ Reenviado'], ['completado', '✓ Completado'], ['cancelada', '✗ Cancelada'],
];

export type FiltroNotas = '' | 'alert' | 'noalert';

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** AAAA-MM-DD + n dias (sin zona horaria) */
export function sumarDias(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export type Seccion = 'vencida' | 'pronto' | 'normal' | 'hecha';

/** Como renderNota del web: vencida (fecha <= hoy), pronto (proximos 7 dias), hecha o normal. */
export function seccionNota(n: Nota, hoy: string): Seccion {
  if (n.done) return 'hecha';
  const f = s(n.fecha);
  if (f && f <= hoy) return 'vencida';
  if (f && f > hoy && f <= sumarDias(hoy, 7)) return 'pronto';
  return 'normal';
}

export function clasificarNotas(notas: Nota[], hoy: string): { vencidas: Nota[]; pronto: Nota[] } {
  return {
    vencidas: notas.filter((n) => seccionNota(n, hoy) === 'vencida'),
    pronto: notas.filter((n) => seccionNota(n, hoy) === 'pronto'),
  };
}

/** Lista completa: mas recientes primero, buscador y filtro con/sin recordatorio */
export function filtrarNotas(notas: Nota[], q: string, filtro: FiltroNotas): Nota[] {
  let l = [...notas].sort((a, b) => s(b.cre || '2000').localeCompare(s(a.cre || '2000')));
  const t = normalizar(q);
  if (t) l = l.filter((n) => normalizar(s(n.titulo) + s(n.cuerpo) + s(n.etiqueta)).includes(t));
  if (filtro === 'alert') l = l.filter((n) => s(n.fecha));
  if (filtro === 'noalert') l = l.filter((n) => !s(n.fecha));
  return l;
}

/** Estado elegido en el selector: completado y cancelada cuentan como hecha */
export function conEstado(n: Nota, est: string): Nota {
  return { ...n, estado: est, done: est === 'completado' || est === 'cancelada' };
}

/** Valor que muestra el selector de estado (mismo criterio que el web) */
export function estadoVisible(n: Nota): string {
  if (n.estado === 'cancelada') return 'cancelada';
  if (n.done) return 'completado';
  return n.estado && ESTADOS_NOTA.some(([k]) => k === n.estado) ? n.estado : 'pendiente';
}
