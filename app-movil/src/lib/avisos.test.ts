import { describe, expect, it } from 'vitest';
import { resumenDelDia, textoAviso } from './resumen';
import type { Poliza, Prospecto, Tarea } from './tipos';

const hoy = new Date(2026, 9, 21, 7, 0);
const pol = (fin: string, estado = 'Vigente') => ({ id: fin, fecha_fin: fin, estado }) as Poliza;
const tar = (f: string, etapa = 'Por Hacer') => ({ id: f, fecha_limite: f, etapa_tarea: etapa, estado: 'pendiente' }) as Tarea;
const pro = (f: string) => ({ id: f, f_seguimiento: f, etapa_venta: 'Cotización' }) as Prospecto;

describe('avisos', () => {
  const c = {
    polizas: [pol('2026-10-21'), pol('2026-10-25'), pol('2026-10-25', 'Cancelada'), pol('2026-12-01')],
    tareas: [tar('2026-10-21'), tar('2026-10-21', 'Hecho'), tar('2026-10-22')],
    prospectos: [pro('2026-10-22')],
  };

  it('cuenta lo de hoy', () => {
    expect(resumenDelDia(c, 0, hoy)).toEqual({ vencenSemana: 2, vencenHoy: 1, tareas: 1, seguimientos: 0 });
  });

  it('cuenta lo de mañana', () => {
    expect(resumenDelDia(c, 1, hoy)).toEqual({ vencenSemana: 1, vencenHoy: 0, tareas: 1, seguimientos: 1 });
  });

  it('el texto no lleva nombres, solo cantidades', () => {
    expect(textoAviso({ vencenSemana: 2, vencenHoy: 1, tareas: 3, seguimientos: 0 }))
      .toBe('1 póliza vence hoy · 3 tareas para hoy');
    expect(textoAviso({ vencenSemana: 0, vencenHoy: 0, tareas: 0, seguimientos: 0 })).toBeNull();
  });
});
