/* Reglas puras sobre los registros: mismo criterio que el CRM web. */
import type { Reg } from './datos';

const t = (r: Reg, k: string) => (r[k] === null || r[k] === undefined ? '' : String(r[k]));

export const polizaVigente = (p: Reg) => /^(vigente|activa|renovada)$/i.test(t(p, 'estado'));
export const polizaCancelada = (p: Reg) => /^cancelad/i.test(t(p, 'estado'));

/** En la agenda web: una tarea sale mientras no este 'completada'. */
export const tareaCompletada = (x: Reg) =>
  /^(completad[ao])$/i.test(t(x, 'estado')) || /^(hecho|completado|realizado|finalizado)$/i.test(t(x, 'etapaTarea'));
const TAREA_CERRADA = /^(hecho|completad[ao]|realizado|finalizado|cancelada|eliminada|done)$/i;
export const tareaAbierta = (x: Reg) => !TAREA_CERRADA.test(t(x, 'estado')) && !TAREA_CERRADA.test(t(x, 'etapaTarea'));

export const prospectoAbierto = (p: Reg) =>
  !/^(cliente ganado|perdido)$/i.test(t(p, 'etapaVenta')) && !/^(ganado|perdido)$/i.test(t(p, 'estado'));
/** Fecha de seguimiento de un prospecto, como la lee la agenda web. */
export const seguimientoProspecto = (p: Reg) => t(p, 'proxContacto') || t(p, 'fechaSeg') || t(p, 'fSeguimiento');

const SINIESTRO_CERRADO = /^(pagado|rechazado|cerrado)$/i;
export const siniestroAbierto = (s: Reg) => !SINIESTRO_CERRADO.test(t(s, 'estado'));

export const esEmpresa = (c: Reg) => t(c, 'tipo') === 'Empresa' || t(c, 'tipo') === 'Persona Jurídica';
export const estadoComercial = (c: Reg) => t(c, 'estadoComercial') || 'activo';
