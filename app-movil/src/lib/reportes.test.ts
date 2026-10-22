import { describe, expect, it } from 'vitest';
import { csvReporte, datosReporte, pctTotal, SIN_FILTROS, totalesReporte } from './reportes';

const fuente = {
  clientes: [{ id: 'C1', nombre: 'Ana Pérez', cedula: '8-1-1' }, { id: 'C2', nombre: 'Luis' }],
  polizas: [
    { id: 'P1', num: 'AU-1', clienteId: 'C1', aseg: 'ASSA', ramo: 'Auto', estado: 'Vigente', prima: 1000, comision: 100, saldo: 50 },
    { id: 'P2', num: 'VI-2', clienteId: 'C1', aseg: 'ASSA', ramo: 'Vida', estado: 'Vigente', primaMensual: 50, comision: '60', coCorCom: 10 },
    { id: 'P3', num: 'AU-3', clienteId: 'C2', aseg: 'Sura', ramo: 'Auto', estado: 'Cancelada', prima: 400, comision: 40 },
  ],
  pagos: [{ id: 'G1', polizaId: 'P1', fecha: '2026-10-12', monto: 80 }],
};

describe('reportes', () => {
  it('polizas: prima anual (mensual x 12), totales y filtros', () => {
    const f = datosReporte('pol', fuente, SIN_FILTROS);
    expect(f.map((r) => r.num)).toEqual(['AU-1', 'VI-2', 'AU-3']);
    const t = totalesReporte('pol', f);
    expect(t.prima).toBe(2000);
    expect(t.com).toBe(200);
    expect(t.saldo).toBe(50);
    expect(datosReporte('pol', fuente, { ...SIN_FILTROS, aseg: 'Sura' })).toHaveLength(1);
    expect(datosReporte('pol', fuente, { ...SIN_FILTROS, q: 'ana' })).toHaveLength(2);
  });

  it('comisiones por compañía sin canceladas, con % medio', () => {
    const f = datosReporte('com', fuente, SIN_FILTROS);
    expect(f).toEqual([{ aseg: 'ASSA', pols: 2, prima: 1600, com: 160, cedida: 10, pct: 10 }]);
    expect(pctTotal(totalesReporte('com', f))).toBe(10);
  });

  it('clientes, por ramo y pagos', () => {
    const c = datosReporte('cli', fuente, SIN_FILTROS);
    expect(c[0]).toMatchObject({ nombre: 'Ana Pérez', nPols: 2, act: 2, prima: 1600, com: 160 });
    const r = datosReporte('res', fuente, SIN_FILTROS);
    expect(r[0]).toMatchObject({ ramo: 'Auto', pols: 2, vig: 1, prima: 1400 });
    const g = datosReporte('pag', fuente, SIN_FILTROS, new Date(2026, 9, 22));
    expect(g[0]).toMatchObject({ cli: 'Ana Pérez', pol: 'AU-1', aseg: 'ASSA', monto: 80, est: 'Pendiente', dias: 10 });
  });

  it('CSV con BOM, encabezados y comillas', () => {
    const csv = csvReporte('res', datosReporte('res', fuente, SIN_FILTROS));
    expect(csv.startsWith('﻿"Ramo","Pólizas"')).toBe(true);
    expect(csv.split('\n')).toHaveLength(3);
  });
});
