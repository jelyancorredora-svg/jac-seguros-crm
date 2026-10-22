import { describe, expect, it } from 'vitest';
import { clasificarNotas, conEstado, estadoVisible, filtrarNotas, seccionNota, sumarDias, type Nota } from './notas';

const HOY = '2026-10-22';
const N = (id: string, x: Partial<Nota>): Nota => ({ id, titulo: id, ...x });

describe('notas', () => {
  it('suma dias cruzando meses', () => {
    expect(sumarDias('2026-10-28', 7)).toBe('2026-11-04');
  });

  it('clasifica en vencidas/hoy, proximos 7 dias y el resto', () => {
    const notas = [
      N('ayer', { fecha: '2026-10-21' }), N('hoy', { fecha: HOY }), N('en7', { fecha: '2026-10-29' }),
      N('en8', { fecha: '2026-10-30' }), N('sin', {}), N('hecha', { fecha: '2026-10-01', done: true }),
    ];
    const { vencidas, pronto } = clasificarNotas(notas, HOY);
    expect(vencidas.map((n) => n.id)).toEqual(['ayer', 'hoy']);
    expect(pronto.map((n) => n.id)).toEqual(['en7']);
    expect(seccionNota(notas[3], HOY)).toBe('normal');
    expect(seccionNota(notas[5], HOY)).toBe('hecha');
  });

  it('filtra con/sin recordatorio, busca y ordena por creacion', () => {
    const notas = [N('a', { cre: '2026-01-01', fecha: HOY }), N('b', { cre: '2026-05-01', cuerpo: 'Llamar póliza' }), N('c', {})];
    expect(filtrarNotas(notas, '', '').map((n) => n.id)).toEqual(['b', 'a', 'c']);
    expect(filtrarNotas(notas, '', 'alert').map((n) => n.id)).toEqual(['a']);
    expect(filtrarNotas(notas, '', 'noalert').map((n) => n.id)).toEqual(['b', 'c']);
    expect(filtrarNotas(notas, 'POLIZA', '').map((n) => n.id)).toEqual(['b']);
  });

  it('completado y cancelada cuentan como hecha', () => {
    expect(conEstado(N('x', {}), 'cancelada').done).toBe(true);
    expect(conEstado(N('x', { done: true }), 'pendiente').done).toBe(false);
    expect(estadoVisible(N('x', { done: true }))).toBe('completado');
    expect(estadoVisible(N('x', {}))).toBe('pendiente');
  });
});
