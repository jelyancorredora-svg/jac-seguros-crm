import { describe, expect, it } from 'vitest';
import {
  agrupar, aplicarEdiciones, cfgNormal, comisionesDesdeTareas, crearOrigen, csvComisiones, kpis, msgComision, ponerTasa,
  porAseguradora, porPoliza, quitarTasa, resolverPct, resumenTramos, tasaDe, textoDias, tramoDe, validarTramos, vistaCobro,
} from './comisiones';

/*
 * Valores esperados calculados ejecutando el codigo del CRM web
 * (override window.renderCom, origen(), agrupar(), getComRate...) en Node
 * con este mismo fixture y hoy = 2026-10-22.
 */
const HOY = '2026-10-22';
const polizas = [
  { id: 'P1', num: '1-30-123456', clienteId: 'C1', aseg: 'ASSA', ramo: 'VIDA', prima: 1000, comision: 150, comPct: 15, estado: 'Vigente' },
  { id: 'P2', num: 'AUTO-998877', clienteId: 'C2', aseg: 'SURA', ramo: 'AUTOS/VEHÍCULOS', prima: 500, comision: 50, comPct: 10, participacion: 50, estado: 'Vencida' },
  { id: 'P3', num: '777', clienteId: 'C1', aseg: 'ASSA', ramo: 'SALUD', prima: 2000, comision: 300, estado: 'Cancelada' },
  { id: 'P4', num: '5550001112', nombreCliente: 'Pedro Gómez Ruiz Díaz', aseg: '', prima: 300, comision: '30', estado: 'renovada' },
  { id: 'P5', num: '5550009999', nombreCliente: 'Luisa Paz', aseg: '', prima: 400, comision: 20, estado: '' },
];
const clientes = [{ id: 'C1', nombre: 'Ana María Pérez López' }, { id: 'C2', nombre: 'Beto Ruiz' }];
const comisiones = [
  { id: 'COM1', aseg: 'ASSA', fecha: '2026-10-10', monto: 100, estado: 'pendiente', polizaId: 'P1' },
  { id: 'COM2', aseg: 'SURA', fecha: '2026-08-01', monto: '55.5', estado: 'pendiente', titulo: 'Comisión póliza AUTO-998877' },
  { id: 'COM3', aseg: 'ASSA', fecha: '2026-05-01', monto: 20, estado: 'pendiente', clienteNom: 'beto ruiz' },
  { id: 'COM4', aseg: 'X', fecha: '2026-10-30', monto: 5, estado: 'pendiente' },
  { id: 'COM5', aseg: 'ASSA', fecha: '2026-01-01', monto: 70, estado: 'cobrada', fechaCobro: '2026-10-02' },
  { id: 'COM6', aseg: 'ASSA', mes: 'julio', monto: 30, estado: 'cobrada' },
  { id: 'COM8', aseg: 'ASSA', fecha: '2026-10-05', monto: 8, estado: 'cobrada', titulo: 'Cobro 1-30-123456 x' },
  { id: 'COM7', aseg: 'IS', fecha: '2026-07-15', monto: 12, estado: 'pendiente', clienteNom: 'Desconocido Total' },
];
const totales = (g: ReturnType<typeof agrupar>) => (['t30', 't60', 't90', 't90m'] as const).map((k) => [k, g[k].filas.length, g[k].total]);

describe('comisiones (igual que el CRM web)', () => {
  it('KPIs', () => {
    expect(kpis(polizas, comisiones, HOY)).toEqual({ nPolizas: 3, carteraAnual: 220, nPend: 5, tPend: 192.5, nCob: 3, tCob: 108, tMes: 78 });
  });

  it('por cobrar: tramos y orden', () => {
    const v = vistaCobro(comisiones, 'cobrar', '', HOY);
    expect(totales(v.grupos)).toEqual([['t30', 2, 105], ['t60', 0, 0], ['t90', 1, 55.5], ['t90m', 2, 32]]);
    expect(v.lista.map((x) => [x.r.id, x.dias])).toEqual([['COM3', 174], ['COM7', 99], ['COM2', 82], ['COM1', 12], ['COM4', -8]]);
    expect(vistaCobro(comisiones, 'cobrar', 't90m', HOY).lista.map((x) => [x.r.id, x.dias])).toEqual([['COM3', 174], ['COM7', 99]]);
    expect(vistaCobro(comisiones, 'cobrar', 't30', HOY).lista.map((x) => [x.r.id, x.dias])).toEqual([['COM1', 12], ['COM4', -8]]);
  });

  it('cobradas: agrupa por fecha de cobro', () => {
    const v = vistaCobro(comisiones, 'cobradas', '', HOY);
    expect(totales(v.grupos)).toEqual([['t30', 3, 108], ['t60', 0, 0], ['t90', 0, 0], ['t90m', 0, 0]]);
    expect(v.lista.map((x) => [x.r.id, x.dias])).toEqual([['COM5', 20], ['COM6', null], ['COM8', null]]);
    expect(vistaCobro(comisiones, 'cobradas', 't90m', HOY).lista).toEqual([]);
  });

  it('por aseguradora y por póliza', () => {
    expect(porAseguradora(polizas).map((a) => [a.aseg, a.n, a.prima, a.com, +a.pctEfectivo.toFixed(1)]))
      .toEqual([['ASSA', 1, 1000, 150, 15], ['SURA', 1, 500, 50, 10], ['Sin aseguradora', 1, 400, 20, 5]]);
    const pp = porPoliza(polizas, clientes);
    expect(pp.filas.map((r) => [r.p.id, r.nom, r.com, r.part])).toEqual([
      ['P1', 'Ana María Pérez López', 150, 100], ['P2', 'Beto Ruiz', 50, 50], ['P5', 'Luisa Paz', 20, 100]]);
    expect([pp.tPrima, pp.tCom]).toEqual([1900, 220]);
  });

  it('origen de cada línea (póliza y cliente)', () => {
    const o = crearOrigen(polizas, clientes);
    expect(comisiones.map((c) => { const x = o(c); return [c.id, x.pol?.id ?? null, x.cliNombre || null]; })).toEqual([
      ['COM1', 'P1', 'Ana María Pérez López'], ['COM2', null, null], ['COM3', null, 'Beto Ruiz'], ['COM4', null, null],
      ['COM5', null, null], ['COM6', null, null], ['COM8', 'P1', 'Ana María Pérez López'], ['COM7', null, 'Desconocido Total']]);
    const m = msgComision(comisiones[0], o(comisiones[0]));
    expect(m).toContain('Hola Ana 👋🏼');
    expect(m).toContain('• Póliza: 1-30-123456\n• Aseguradora: ASSA\n• Ramo: VIDA\n• Fecha: 10 oct 2026\n');
  });

  it('tramos de antigüedad', () => {
    expect([tramoDe(null), tramoDe(-5), tramoDe(30), tramoDe(31), tramoDe(90), tramoDe(91)]).toEqual(['t30', 't30', 't30', 't60', 't90', 't90m']);
    expect([textoDias(null), textoDias(-3), textoDias(4)]).toEqual(['—', 'en 3d', '4d']);
  });

  it('tasas comRates (getComRate / saveComRate / delComRate)', () => {
    let r = ponerTasa([], 'ASSA', '', 12);
    r = ponerTasa(r, 'ASSA', 'Vida', 20);
    r = ponerTasa(r, 'ASSA', 'Vida', 25);
    expect(r).toEqual([{ aseg: 'ASSA', ramo: '', pct: 12 }, { aseg: 'ASSA', ramo: 'Vida', pct: 25 }]);
    expect([tasaDe(r, 'ASSA', 'Vida'), tasaDe(r, 'ASSA', 'Salud'), tasaDe(r, 'SURA', 'Vida')]).toEqual([25, 12, null]);
    expect(quitarTasa(r, 'ASSA', '')).toEqual([{ aseg: 'ASSA', ramo: 'Vida', pct: 25 }]);
  });

  it('comisCfg: guardar, tramos y resolución', () => {
    const c = cfgNormal({ asegs: { ASSA: { com: 10 } } });
    aplicarEdiciones(c, 'asegs', [{ k: 'ASSA', campo: 'com', v: '' }, { k: 'SURA', campo: 'itbms', v: '6' }]);
    expect(c.asegs).toEqual({ SURA: { itbms: 6 } });
    aplicarEdiciones(c, 'combos', [{ k: 'ASSA||VIDA', campo: 'com', v: '' }]);
    expect(c.combos).toEqual({ 'ASSA||VIDA': {} });
    expect(validarTramos([{ d: 1, h: 3, com: 60 }, { d: 2, h: '', com: 5 }])).toEqual({ error: 'El tramo que empieza en el año 2 se solapa con el anterior. Corrige los rangos.' });
    const v = validarTramos([{ d: 2, h: '', com: '10' }, { d: '1', h: 1, com: 60 }, { d: 5, h: '', com: '' }]);
    expect(v).toEqual({ tramos: [{ d: 1, h: 1, com: 60 }, { d: 2, h: null, com: 10 }] });
    if ('tramos' in v) c.combos['ASSA||VIDA'].tramos = v.tramos;
    expect(resumenTramos(c.combos['ASSA||VIDA'])).toBe('año 1: 60% · año 2+: 10%');
    c.ramos.VIDA = { com: 3, itbms: 5 };
    expect(resolverPct(c, 'ASSA', 'VIDA', 1)).toEqual({ com: 60, itbms: 5, origen: 'aseguradora + ramo' });
    expect(resolverPct(c, 'ASSA', 'VIDA', 4)).toEqual({ com: 10, itbms: 5, origen: 'aseguradora + ramo' });
    expect(resolverPct(c, 'SURA', 'VIDA', 1)).toEqual({ com: 3, itbms: 6, origen: 'ramo' });
  });

  it('comisiones que aún están en Tareas', () => {
    const tareas = [
      { id: 'auto_comision_1', titulo: 'Cobrar comisión ASSA $1,250.50', polizaId: 'P1', fechaLimite: '2026-09-01' },
      { id: 'T2', _autoTipo: 'comision', titulo: 'Comisión sin monto' },
      { id: 'auto_comision_3', titulo: 'Comisión B/. 40', desc: 'póliza 1-30-123456' },
      { id: 'T4', titulo: 'Llamar a cliente $50' },
    ];
    const r = comisionesDesdeTareas(tareas, [{ id: 'COMx', _tareaId: 'auto_comision_3' }], crearOrigen(polizas, clientes), HOY);
    expect([r.candidatas, r.convertibles, r.quitar]).toEqual([3, 2, ['auto_comision_1']]);
    expect(r.nuevas[0]).toEqual({
      aseg: 'ASSA', fecha: '2026-09-01', ramo: 'VIDA', pct: 15, monto: 1250.5, estado: 'pendiente', polizaId: 'P1',
      clienteNom: 'Ana María Pérez López', _tareaId: 'auto_comision_1', _origen: 'tarea automática',
    });
    expect(r.muestra.map((m) => m.origen)).toEqual(['N° 1-30-123456', 'sin monto legible', 'N° 1-30-123456']);
  });

  it('CSV', () => {
    const csv = csvComisiones(polizas, clientes, comisiones);
    expect(csv.startsWith('﻿"Desglose Pólizas"')).toBe(true);
    expect(csv).toContain('"","","","TOTAL","","","550.00","0.00",""');
    expect(csv).toContain('"SURA","55.5","2026-08-01","pendiente","","",""');
  });
});
