import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ db: {} }));
import type { Cartera } from './datos';
import { leerPaquete, normCedula, planificar } from './importar';

const cartera = {
  clientes: [{ id: 'C1', nombre: 'CAMARGO FALCON ADA LUZ', cedula: '4-736-1335', cel: '6000-0000', archivos: [{ name: 'CEDULA.jpg' }] }],
  polizas: [], vehiculos: [{ id: 'V1', placa: 'ED-3410' }], siniestros: [], pagos: [], prospectos: [], comisiones: [], tareas: [],
  meta: {}, cargadoEn: 0,
} as unknown as Cartera;

describe('importar', () => {
  it('normaliza cedulas', () => {
    expect(normCedula('04-736-1335')).toBe('4-736-1335');
    expect(normCedula(' 8-0123-0456 ')).toBe('8-123-456');
  });
  it('hace match y solo completa lo vacio', () => {
    const p = leerPaquete(JSON.stringify({
      version: 1,
      clientes: [{ match: { cedula: '04-736-1335' }, datos: { nombre: 'Ada Luz', cel: '6211-9106', email: 'a@b.com', id: 'X', historial: 'no' }, archivos: ['CEDULA.jpg', 'LIC.jpg'] }],
      polizas: [{ match: { num: '02B3336377', aseg: 'ASSA' }, cliente: '4-736-1335', datos: { num: '02B3336377', prima: 970.62 } }],
      vehiculos: [{ match: { placa: 'ED3410' }, datos: { placa: 'ED3410', marca: 'Mercedes' } }],
      archivos: [{ nombre: 'CEDULA.jpg', tipo: 'image/jpeg', b64: 'AA==' }, { nombre: 'LIC.jpg', tipo: 'image/jpeg', b64: 'AA==' },
        { nombre: 'malo.exe', tipo: 'application/x-msdownload', b64: 'AA==' }],
    }));
    const [cli, pol, veh] = planificar(p, cartera);
    expect(cli.existente?.id).toBe('C1');
    expect(cli.campos).toEqual({ email: 'a@b.com' }); // nombre y cel ya tenian valor; id/historial se ignoran
    expect(cli.archivos.map((a) => a.nombre)).toEqual(['LIC.jpg']);
    expect(cli.omitidos[0]).toContain('ya estaba');
    expect(pol.existente).toBeNull();
    expect(veh.existente?.id).toBe('V1');
    expect(veh.campos).toEqual({ marca: 'Mercedes' });
    expect(p.archivos?.some((a) => a.nombre === 'malo.exe')).toBe(false);
  });
  it('rechaza archivos que no son paquetes', () => {
    expect(() => leerPaquete('hola')).toThrow();
    expect(() => leerPaquete('{"version":2}')).toThrow();
  });
});
