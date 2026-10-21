/* Reglas puras sobre los registros: mismo criterio que el CRM web. */
import type { Poliza, Prospecto, Siniestro, Tarea } from './tipos';

export const prospectoAbierto = (p: Prospecto) => !/^(cliente ganado|perdido)$/i.test(p.etapa_venta ?? '');

const TAREA_CERRADA = /^(hecho|completad[ao]|realizado|finalizado|cancelada|done)$/i;
export const tareaAbierta = (t: Tarea) =>
  !TAREA_CERRADA.test(t.estado ?? '') && !TAREA_CERRADA.test(t.etapa_tarea ?? '');

export const polizaVigente = (p: Poliza) => /^(vigente|activa|renovada)$/i.test(p.estado ?? '');

const SINIESTRO_CERRADO = /^(pagado|rechazado|cerrado)$/i;
export const siniestroAbierto = (s: Siniestro) => !SINIESTRO_CERRADO.test(s.estado ?? '');
