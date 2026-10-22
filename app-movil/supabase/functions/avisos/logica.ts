/*
 * Que avisar y cuando. Sin red ni base: solo reglas, para poder probarlas.
 * Hora de Panama (UTC-5, sin horario de verano).
 */

export type Tarea = { id: string; titulo?: string | null; estado?: string | null; etapa_tarea?: string | null; fecha_limite?: string | null; extra?: Record<string, unknown> | null };
export type Reunion = { id?: string; titulo?: string; fecha?: string; hora?: string; lugar?: string; tipo?: string };
export type Resumen = { vencenHoy: number; vencenSemana: number; tareasHoy: number; reunionesHoy: number; seguimientosHoy: number; cumpleHoy: number };
export type Aviso = { clave: string; title: string; body: string; tag: string };

export const OFFSET_MIN = -5 * 60;
const VENTANA_MIN = 45; // el cron corre cada 5 min; si se atrasa, igual avisa

/** Fecha y minutos del dia en Panama */
export function local(ahora: Date): { fecha: string; min: number; ms: number } {
  const ms = ahora.getTime() + OFFSET_MIN * 60_000;
  const d = new Date(ms);
  return { fecha: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), ms };
}

/** Momento (ms en "hora local como UTC") de una fecha + HH:MM */
function momento(fecha: string, hora: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(fecha);
  const h = /^(\d{1,2}):(\d{2})/.exec(hora);
  if (!m || !h) return null;
  return Date.parse(`${m[1]}T${h[1].padStart(2, '0')}:${h[2]}:00Z`);
}

const CERRADA = /^(hecho|completad[ao]|realizado|finalizado|cancelada|eliminada|done)$/i;
export const tareaAbierta = (t: Tarea) => !CERRADA.test(t.estado ?? '') && !CERRADA.test(t.etapa_tarea ?? '');

function textoMin(m: number): string {
  if (m >= 1440) return `${Math.round(m / 1440)} día${m >= 2880 ? 's' : ''}`;
  if (m >= 60) return `${Math.round(m / 60)} hora${m >= 120 ? 's' : ''}`;
  return `${m} min`;
}
const corto = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function avisosTareas(tareas: Tarea[], ahora: Date): Aviso[] {
  const { ms } = local(ahora);
  const out: Aviso[] = [];
  for (const t of tareas) {
    if (!tareaAbierta(t) || !t.fecha_limite) continue;
    const ex = (t.extra ?? {}) as Record<string, unknown>;
    const hora = typeof ex.hora === 'string' && ex.hora ? ex.hora : '';
    const rem = typeof ex.reminder === 'string' && /^\d+$/.test(ex.reminder) ? Number(ex.reminder) : typeof ex.reminder === 'number' ? ex.reminder : null;
    if (!hora && rem === null) continue; // sin hora ni recordatorio: va en el resumen diario
    const due = momento(t.fecha_limite, hora || '09:00'); // el CRM web usa las 9:00 si no hay hora
    if (due === null) continue;
    const at = due - (rem ?? 0) * 60_000;
    if (ms < at || ms >= at + VENTANA_MIN * 60_000) continue;
    out.push({
      clave: `t:${t.id}:${new Date(at).toISOString().slice(0, 16)}`,
      title: rem ? `⏰ En ${textoMin(rem)}` : '⏰ Tarea ahora',
      body: corto(`${t.titulo || 'Tarea'}${hora ? ' · ' + hora : ''}`),
      tag: `t-${t.id}`,
    });
  }
  return out;
}

export function avisosReuniones(reuniones: Reunion[], ahora: Date, antes = 30): Aviso[] {
  const { ms } = local(ahora);
  const out: Aviso[] = [];
  for (const r of reuniones) {
    if (!r || !r.fecha || !r.hora) continue;
    const due = momento(r.fecha, r.hora);
    if (due === null) continue;
    const at = due - antes * 60_000;
    if (ms < at || ms >= at + VENTANA_MIN * 60_000) continue;
    out.push({
      clave: `r:${r.id ?? ''}:${r.fecha}T${r.hora}`,
      title: `👥 Reunión a las ${r.hora}`,
      body: corto(`${r.titulo || 'Reunión'}${r.tipo === 'virtual' ? ' · virtual' : r.lugar ? ' · ' + r.lugar : ''}`),
      tag: `r-${r.id ?? r.fecha + r.hora}`,
    });
  }
  return out;
}

/** Resumen diario entre 7:30 y 8:15 a. m. */
export function avisoResumen(r: Resumen, ahora: Date): Aviso | null {
  const { fecha, min } = local(ahora);
  if (min < 7 * 60 + 30 || min >= 8 * 60 + 15) return null;
  const partes: string[] = [];
  if (r.vencenHoy) partes.push(`${r.vencenHoy} póliza${r.vencenHoy > 1 ? 's vencen' : ' vence'} hoy`);
  if (r.vencenSemana > r.vencenHoy) partes.push(`${r.vencenSemana} vencen en 7 días`);
  if (r.tareasHoy) partes.push(`${r.tareasHoy} tarea${r.tareasHoy > 1 ? 's' : ''}`);
  if (r.reunionesHoy) partes.push(`${r.reunionesHoy} reunión${r.reunionesHoy > 1 ? 'es' : ''}`);
  if (r.seguimientosHoy) partes.push(`${r.seguimientosHoy} seguimiento${r.seguimientosHoy > 1 ? 's' : ''}`);
  if (r.cumpleHoy) partes.push(`🎂 ${r.cumpleHoy} cumpleaños`);
  if (!partes.length) return null;
  return { clave: `resumen:${fecha}`, title: '☀️ Tu día en JAC Seguros', body: partes.join(' · '), tag: `resumen-${fecha}` };
}

export type Cumpleanero = { id: string; nombre?: string | null; f_nac?: string | null };

/**
 * Cumpleaños de hoy, uno por cliente, a partir de las 8:00 a. m. (con la misma
 * ventana que las tareas por si el cron se atrasa). Si son mas de 5, un solo
 * aviso con la lista para no llenar el telefono.
 */
export function avisosCumple(clientes: Cumpleanero[], ahora: Date): Aviso[] {
  const { fecha, min } = local(ahora);
  if (min < 8 * 60 || min >= 8 * 60 + VENTANA_MIN) return [];
  const hoy = clientes.filter((c) => typeof c.f_nac === 'string' && c.f_nac.slice(5, 10) === fecha.slice(5, 10));
  const edad = (c: Cumpleanero) => Number(fecha.slice(0, 4)) - Number(String(c.f_nac).slice(0, 4));
  const nom = (c: Cumpleanero) => (c.nombre || 'Cliente').trim();
  if (hoy.length > 5) {
    return [{
      clave: `cumple:${fecha}`, title: `🎂 ${hoy.length} clientes cumplen años hoy`,
      body: corto(hoy.map(nom).join(', '), 160), tag: `cumple-${fecha}`,
    }];
  }
  return hoy.map((c) => {
    const e = edad(c);
    return {
      clave: `c:${c.id}:${fecha}`,
      title: `🎂 Hoy cumple ${corto(nom(c), 40)}`,
      body: `${e > 0 && e < 120 ? `Cumple ${e} años · ` : ''}Envíale tu felicitación y su tarjeta desde Más → Cumpleaños.`,
      tag: `cumple-${c.id}`,
    };
  });
}

/** Suma dias a una fecha AAAA-MM-DD */
export function masDias(fecha: string, n: number): string {
  return new Date(Date.parse(fecha + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
}
