import type { Reg } from './datos';
import { diasHasta } from './formato';
import { polizaVigente, prospectoAbierto, seguimientoProspecto, tareaAbierta } from './reglas';

export type Resumen = { vencenSemana: number; vencenHoy: number; tareas: number; seguimientos: number };

/** Lo que tocara atender el dia `desplazamiento` (0 = hoy). Puro, con pruebas. */
export function resumenDelDia(c: { polizas: Reg[]; tareas: Reg[]; prospectos: Reg[] }, desplazamiento: number, ahora = new Date()): Resumen {
  const dia = (iso: unknown) => {
    const d = diasHasta(typeof iso === 'string' ? iso : null, ahora);
    return d === null ? null : d - desplazamiento;
  };
  let vencenSemana = 0, vencenHoy = 0;
  for (const p of c.polizas) {
    if (!polizaVigente(p)) continue;
    const d = dia(p.fechaFin);
    if (d === null) continue;
    if (d === 0) vencenHoy++;
    if (d >= 0 && d <= 7) vencenSemana++;
  }
  const tareas = c.tareas.filter((x) => tareaAbierta(x) && dia(x.fechaLimite) === 0).length;
  const seguimientos = c.prospectos.filter((p) => prospectoAbierto(p) && dia(seguimientoProspecto(p)) === 0).length;
  return { vencenSemana, vencenHoy, tareas, seguimientos };
}

export function textoAviso(r: Resumen): string | null {
  const partes: string[] = [];
  if (r.vencenHoy) partes.push(`${r.vencenHoy} póliza${r.vencenHoy > 1 ? 's vencen' : ' vence'} hoy`);
  else if (r.vencenSemana) partes.push(`${r.vencenSemana} póliza${r.vencenSemana > 1 ? 's vencen' : ' vence'} esta semana`);
  if (r.tareas) partes.push(`${r.tareas} tarea${r.tareas > 1 ? 's' : ''} para hoy`);
  if (r.seguimientos) partes.push(`${r.seguimientos} prospecto${r.seguimientos > 1 ? 's' : ''} por contactar`);
  return partes.length ? partes.join(' · ') : null;
}
