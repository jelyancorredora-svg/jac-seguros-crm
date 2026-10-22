import { describe, expect, it } from 'vitest';
import {
  asegurados, claveAsegurado, enlaceSeguro, esColectiva, estadoPoliza, nombreCorto, polizasDeAseguradora, quitarAsegurado,
  reemplazarAsegurado, waTexto,
} from './empresas';

const hoy = new Date(2026, 9, 22);

describe('empresas', () => {
  it('reconoce pólizas colectivas por ramo (igual que REmp)', () => {
    expect(esColectiva({ id: '1', ramo: 'VIDA' })).toBe(true);
    expect(esColectiva({ id: '2', ramo: 'AUTOS/VEHÍCULOS' })).toBe(false);
  });

  it('estado como statusB()', () => {
    expect(estadoPoliza({ id: 'a', estado: 'Cancelada' }, hoy).texto).toBe('Cancelada');
    expect(estadoPoliza({ id: 'a', fechaFin: '2026-10-25' }, hoy).texto).toBe('🚨 3d');
    expect(estadoPoliza({ id: 'a', fechaFin: '2026-11-10', estado: 'vigente' }, hoy).texto).toBe('⚠️ 19d');
    expect(estadoPoliza({ id: 'a', fechaFin: '2026-01-01' }, hoy).texto).toBe('🔴 Vencida');
    expect(estadoPoliza({ id: 'a', fechaFin: '2026-01-01', estado: 'vigente' }, hoy).texto).toBe('✓ Vigente');
    expect(estadoPoliza({ id: 'a', fechaFin: '2027-06-01' }, hoy).texto).toBe('✓ Vigente');
  });

  it('asegurados: lee, quita y reemplaza por id o cédula', () => {
    const p = { id: 'P1', asegurados: [{ id: 'ASD1', nombre: 'Ana' }, { cedula: '8-1-1', nombre: 'Luis' }, null] };
    const l = asegurados(p);
    expect(l).toHaveLength(2);
    expect(claveAsegurado(l[1])).toBe('8-1-1');
    expect(quitarAsegurado(l, '8-1-1').map((a) => a.nombre)).toEqual(['Ana']);
    expect(reemplazarAsegurado(l, 'ASD1', { nombre: 'Ana María' })[0]).toEqual({ id: 'ASD1', nombre: 'Ana María' });
    expect(asegurados({ id: 'x' })).toEqual([]);
  });

  it('aseguradoras: nombre corto y conteo de pólizas', () => {
    expect(nombreCorto('ASSA COMPAÑIA DE SEGUROS, S.A.')).toBe('ASSA');
    expect(nombreCorto('MAPFRE PANAMÁ, S.A.')).toBe('MAPFRE PANAMÁ');
    const pols = [{ id: '1', aseg: 'ASSA' }, { id: '2', aseg: 'SURA' }, { id: '3', aseg: 'ASSA' }];
    expect(polizasDeAseguradora({ nombre: 'ASSA COMPAÑIA DE SEGUROS, S.A.' }, pols)).toBe(2);
  });

  it('solo enlaces seguros', () => {
    expect(enlaceSeguro('https://pago.assa.com/x')).toBe('https://pago.assa.com/x');
    expect(enlaceSeguro('javascript:alert(1)')).toBeNull();
    expect(enlaceSeguro('http://x.com')).toBeNull();
    expect(waTexto('6292-6010', 'Hola')).toBe('https://wa.me/50762926010?text=Hola');
    expect(waTexto('', 'Hola')).toBeNull();
  });
});
