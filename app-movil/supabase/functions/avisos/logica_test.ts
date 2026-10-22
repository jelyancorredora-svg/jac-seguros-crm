import { assertEquals } from 'jsr:@std/assert@1';
import { avisoResumen, avisosReuniones, avisosTareas, local } from './logica.ts';

// 2026-10-22 15:00 UTC = 10:00 en Panama
const ahora = new Date('2026-10-22T15:00:00Z');

Deno.test('hora de Panama', () => {
  assertEquals(local(ahora), { fecha: '2026-10-22', min: 600, ms: Date.parse('2026-10-22T10:00:00Z') });
});

Deno.test('tarea con hora avisa a su hora y con recordatorio antes', () => {
  const t = [
    { id: 'A', titulo: 'Llamar a Ana', fecha_limite: '2026-10-22', estado: 'pendiente', extra: { hora: '10:00' } },
    { id: 'B', titulo: 'Visita', fecha_limite: '2026-10-22', estado: 'pendiente', extra: { hora: '10:30', reminder: '30' } },
    { id: 'C', titulo: 'Más tarde', fecha_limite: '2026-10-22', estado: 'pendiente', extra: { hora: '15:00' } },
    { id: 'D', titulo: 'Hecha', fecha_limite: '2026-10-22', estado: 'completada', extra: { hora: '10:00' } },
    { id: 'E', titulo: 'Sin hora', fecha_limite: '2026-10-22', estado: 'pendiente', extra: {} },
    { id: 'F', titulo: 'Mañana 9am, 1 día antes', fecha_limite: '2026-10-23', estado: 'pendiente', extra: { reminder: '1440' } },
  ];
  const a = avisosTareas(t, ahora);
  assertEquals(a.map((x) => x.tag).sort(), ['t-A', 't-B']);
  assertEquals(a.find((x) => x.tag === 't-B')!.title, '⏰ En 30 min');
  // a las 9:10 avisa la F (vence mañana 9:00, aviso 1 dia antes)
  assertEquals(avisosTareas(t, new Date('2026-10-22T14:10:00Z')).map((x) => x.tag), ['t-F']);
});

Deno.test('reunion 30 min antes', () => {
  const r = [{ id: 'r1', titulo: 'Junta', fecha: '2026-10-22', hora: '10:30', lugar: 'Oficina' }, { id: 'r2', fecha: '2026-10-22', hora: '12:00' }];
  assertEquals(avisosReuniones(r, ahora).map((x) => x.body), ['Junta · Oficina']);
});

Deno.test('resumen solo en la manana y si hay algo', () => {
  const r = { vencenHoy: 1, vencenSemana: 3, tareasHoy: 2, reunionesHoy: 0, seguimientosHoy: 0, cumpleHoy: 1 };
  assertEquals(avisoResumen(r, ahora), null);
  assertEquals(avisoResumen(r, new Date('2026-10-22T12:35:00Z'))!.body, '1 póliza vence hoy · 3 vencen en 7 días · 2 tareas · 🎂 1 cumpleaños');
  assertEquals(avisoResumen({ vencenHoy: 0, vencenSemana: 0, tareasHoy: 0, reunionesHoy: 0, seguimientosHoy: 0, cumpleHoy: 0 }, new Date('2026-10-22T12:35:00Z')), null);
});
