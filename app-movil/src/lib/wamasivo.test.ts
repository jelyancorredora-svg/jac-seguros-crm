import { describe, expect, it } from 'vitest';
import type { Reg } from './datos';
import { FILTROS_INICIALES, diasCumple, fmtWANum, generarWam, mensajeWam, opcionesWam, rellenar } from './wamasivo';

const hoy = new Date(2026, 9, 22, 10, 0);
const clientes: Reg[] = [
  { id: 'C1', nombre: 'Ana Pérez', cel: '6123-4567', fNac: '1990-10-22' },
  { id: 'C2', nombre: 'Luis Gómez', cel: '', tel: '2223344', fNac: '1985-10-30' },
  { id: 'C3', nombre: 'Sin Teléfono', fNac: '1980-10-23' },
  { id: 'C4', nombre: 'Marta Ruiz', cel: '50769998888', fNac: '1970-12-01' },
];
const polizas: Reg[] = [
  { id: 'P1', clienteId: 'C1', ramo: 'AUTO', aseg: 'ASSA', num: 'A-1', fechaFin: '2026-11-01', prima: 1234.5, estado: 'Vigente' },
  { id: 'P2', clienteId: 'C2', ramo: 'VIDA', aseg: 'MAPFRE', fechaFin: '2026-10-25', estado: 'Vigente' },
  { id: 'P3', clienteId: 'C4', ramo: 'AUTO', aseg: 'ASSA', fechaFin: '2026-10-23', estado: 'Cancelada' },
  { id: 'P4', clienteId: 'C3', ramo: 'AUTO', aseg: 'ASSA', fechaFin: '2026-10-24', estado: 'Vigente' },
  { id: 'P5', clienteId: 'X', nombreCliente: 'Pedro Sol', celCliente: '6555-0000', ramo: 'SALUD', aseg: 'SURA', fechaFin: '2026-10-22' },
  { id: 'P6', clienteId: 'C1', ramo: 'HOGAR', aseg: 'ASSA', fechaFin: '2026-10-21' },
  { id: 'P7', clienteId: 'C1', ramo: 'HOGAR', aseg: 'ASSA', fechaFin: '2027-01-30' },
];

describe('WhatsApp masivo', () => {
  it('renovaciones: excluye canceladas, vencidas, fuera de rango y sin telefono; ordena por dias', () => {
    const l = generarWam(clientes, polizas, FILTROS_INICIALES, hoy);
    expect(l.map((x) => x.id)).toEqual(['P5_undefined', 'P2_C2', 'P1_C1']);
    expect(l[0].nombre).toBe('Pedro Sol');
    expect(l[1].tel).toBe('2223344');
    expect(l[2].info).toBe('AUTO · ASSA · 1 Nov 2026');
    expect(l[2].url.startsWith('https://wa.me/50761234567?text=')).toBe(true);
    expect(l[0].msg).toContain('tu póliza *vence hoy*');
    expect(l[2].msg).toContain('vence en *10 días*');
    expect(l[2].msg).toContain('• Prima actual: B/. 1,234.50');
    expect(l[2].msg).toContain('• Vence: *1 Nov 2026*');
  });

  it('filtra por dias, ramo y aseguradora', () => {
    expect(generarWam(clientes, polizas, { ...FILTROS_INICIALES, dias: 7 }, hoy).map((x) => x.id)).toEqual(['P5_undefined', 'P2_C2']);
    expect(generarWam(clientes, polizas, { ...FILTROS_INICIALES, ramo: 'AUTO' }, hoy).map((x) => x.id)).toEqual(['P1_C1']);
    expect(generarWam(clientes, polizas, { ...FILTROS_INICIALES, aseg: 'MAPFRE' }, hoy).map((x) => x.id)).toEqual(['P2_C2']);
  });

  it('cobro usa el texto original con el monto', () => {
    const l = generarWam(clientes, polizas, { ...FILTROS_INICIALES, tipo: 'cobro' }, hoy);
    expect(l.find((x) => x.id === 'P1_C1')!.msg).toContain('póliza de *AUTO* por *$1,234.50*');
    expect(l.find((x) => x.id === 'P2_C2')!.msg).toContain('por *—*');
  });

  it('cumpleaños dentro del periodo', () => {
    expect(diasCumple('1990-10-22', hoy)).toBe(0);
    expect(diasCumple('1990-10-21', hoy)).toBe(364);
    const l = generarWam(clientes, polizas, { ...FILTROS_INICIALES, tipo: 'bday' }, hoy);
    expect(l.map((x) => x.id)).toEqual(['C1']);
    expect(l[0].info).toBe('Cumpleaños en HOY · 22 Oct 1990');
    expect(l[0].msg.startsWith('🎂 ¡Feliz Cumpleaños, Ana! 🎉')).toBe(true);
    expect(generarWam(clientes, polizas, { ...FILTROS_INICIALES, tipo: 'bday', bdayDias: 30 }, hoy).map((x) => x.id)).toEqual(['C1', 'C2']);
  });

  it('personalizado: todos los clientes con telefono y sustitucion de variables', () => {
    const l = generarWam(clientes, polizas, { ...FILTROS_INICIALES, tipo: 'custom', custom: 'Hola {NOMBRE} / {{nombre}} / {{poliza}}' }, hoy);
    expect(l.map((x) => x.id)).toEqual(['C1', 'C2', 'C4']);
    expect(l[0].msg.startsWith('Hola Ana / Ana / {{poliza}}\n\n📞 +507 6292-6010')).toBe(true);
    expect(mensajeWam('custom', { nombre: '', cel: '', tel: '' }, null, '')).toContain('Hola Cliente, te contacta JAC Seguros.');
  });

  it('rellena variables de poliza y arma numeros como el web', () => {
    const t = rellenar('{{nombre}} {{poliza}} {{vence}} {{dias}} {{x}}', { cli: { nombre: 'Ana Pérez' }, pol: polizas[0] }, hoy);
    expect(t).toBe('Ana A-1 1 Nov 2026 10 {{x}}');
    expect(fmtWANum('6123-4567')).toBe('50761234567');
    expect(fmtWANum('+507 6123 4567')).toBe('50761234567');
    expect(opcionesWam(polizas)).toEqual({ ramos: ['AUTO', 'HOGAR', 'SALUD', 'VIDA'], asegs: ['ASSA', 'MAPFRE', 'SURA'] });
  });
});
