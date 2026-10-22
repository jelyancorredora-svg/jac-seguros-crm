import { describe, expect, it } from 'vitest';
import { asegDisponibles, calcular, conComision, depreciacion, edadDesde, fM, ordenar, type EntradaCot } from './cotizador';

/*
 * Valores esperados obtenidos ejecutando en node el cotpCalcAll + cotpRecalcCom
 * ORIGINALES del CRM web (index.html) con las mismas entradas.
 */
const base = (e: Partial<EntradaCot> & Pick<EntradaCot, 'ramo' | 'aseguradoras'>): EntradaCot => ({ sub: null, valor: 0, fpago: 'anual', ...e });
const resumen = (e: EntradaCot) => calcular(e).map((r) => [r.asegId, r.primaNeta, r.itbmsAmt, r.primaTotal, r.cuota, r.com]);

function igual(obt: Array<Array<string | number>>, esp: Array<Array<string | number>>) {
  expect(obt.length).toBe(esp.length);
  obt.forEach((fila, i) => fila.forEach((v, j) => (typeof v === 'number' ? expect(v).toBeCloseTo(esp[i][j] as number, 6) : expect(v).toBe(esp[i][j]))));
}

describe('cotizador: mismas primas que el CRM web', () => {
  it('vida temporal 20, 42 años, mensual', () => {
    igual(resumen(base({ ramo: 'vida', sub: 'temporal_20', valor: 100000, edadVida: 42, fpago: 'mensual', aseguradoras: ['ASSA', 'PALIG', 'FEDPA'] })), [
      ['FEDPA', 580, 0, 580, 48.333333333333336, 87],
      ['PALIG', 640, 0, 640, 53.333333333333336, 96],
      ['ASSA', 740, 0, 740, 61.666666666666664, 111],
    ]);
  });
  it('vida universal usa la tasa de vida_universal', () => {
    igual(resumen(base({ ramo: 'vida', sub: 'vida_universal', valor: 250000, edadVida: 28, aseguradoras: ['SURA', 'CHUBB'] })), [
      ['SURA', 2812.6, 0, 2812.6, 2812.6, 421.89],
      ['CHUBB', 3329.2, 0, 3329.2, 3329.2, 499.38],
    ]);
  });
  it('salud individual 45 años, trimestral', () => {
    igual(resumen(base({ ramo: 'salud', sub: 'individual', valor: 45, fpago: 'trimestral', aseguradoras: ['ASSA', 'CHUBB'] })), [
      ['ASSA', 2466.464, 123.3232, 2589.7872, 647.4468, 369.9696],
      ['CHUBB', 4599.4, 229.97, 4829.37, 1207.3425, 689.91],
    ]);
  });
  it('salud familiar 55 años con 2 dependientes, semestral', () => {
    igual(resumen(base({ ramo: 'salud', sub: 'familiar', valor: 55, deps: 2, fpago: 'semestral', aseguradoras: ['MAPFRE'] })), [
      ['MAPFRE', 5868.12, 293.406, 6161.526, 3080.763, 880.218],
    ]);
  });
  it('autos cobertura completa (tasa, minimo) y daños a terceros (fijo)', () => {
    igual(resumen(base({ ramo: 'autos', sub: 'cobertura_completa', valor: 25000, aseguradoras: ['MAPFRE', 'IS', 'FEDPA'] })), [
      ['IS', 775.25, 46.515, 821.765, 821.765, 116.2875],
      ['MAPFRE', 947.5, 56.85, 1004.35, 1004.35, 142.125],
      ['FEDPA', 1409.5, 84.57, 1494.07, 1494.07, 211.425],
    ]);
    igual(resumen(base({ ramo: 'autos', sub: 'danos_terceros', fpago: 'mensual', aseguradoras: ['ASSA', 'ANCON'] })), [
      ['ANCON', 94.5, 5.67, 100.17, 8.3475, 14.175],
      ['ASSA', 132, 7.92, 139.92, 11.66, 19.8],
    ]);
  });
  it('autos con prima de emision (base) no da NaN: base + valor × tasa', () => {
    const [r] = calcular(base({ ramo: 'autos', sub: 'cobertura_completa', valor: 25000, aseguradoras: ['ASSA'] }));
    expect(r.primaNeta).toBeCloseTo(385.63 + 25000 * 0.02205, 6);
  });
  it('viaje, hogar, AP, SOAT, fianzas, ciber y RC', () => {
    igual(resumen(base({ ramo: 'viaje', sub: 'europa', valor: 10, viajeros: 2, aseguradoras: ['ASSA', 'MAPFRE'] })), [
      ['MAPFRE', 84, 4.2, 88.2, 88.2, 12.6],
      ['ASSA', 90, 4.5, 94.5, 94.5, 13.5],
    ]);
    igual(resumen(base({ ramo: 'hogar', sub: 'apartamento', valor: 80000, aseguradoras: ['ASSA', 'GENERALI'] })), [
      ['ASSA', 68, 4.08, 72.08, 72.08, 10.2],
      ['GENERALI', 155.04, 9.3024, 164.3424, 164.3424, 23.256],
    ]);
    igual(resumen(base({ ramo: 'ap', sub: 'campo', valor: 50000, aseguradoras: ['SURA'] })), [['SURA', 576, 28.8, 604.8, 604.8, 86.4]]);
    igual(resumen(base({ ramo: 'soat', sub: 'moto', aseguradoras: ['ASSA', 'IS'] })), [
      ['IS', 58, 0, 58, 58, 8.7],
      ['ASSA', 62, 0, 62, 62, 9.3],
    ]);
    igual(resumen(base({ ramo: 'fianzas', sub: 'licitacion', valor: 100000, aseguradoras: ['ASSA'] })), [['ASSA', 1000, 0, 1000, 1000, 150]]);
    igual(resumen(base({ ramo: 'cyb', sub: 'grande', valor: 250000, aseguradoras: ['CHUBB'] })), [['CHUBB', 6525, 391.5, 6916.5, 6916.5, 978.75]]);
    // Sin valor se usa 50,000 como el web
    igual(resumen(base({ ramo: 'rc', sub: 'profesional', valor: 0, aseguradoras: ['ASSA'] })), [['ASSA', 533, 31.98, 564.98, 564.98, 79.95]]);
  });
});

describe('cotizador: auxiliares', () => {
  it('aseguradoras por ramo y sub-ramo', () => {
    expect(asegDisponibles('vida', 'temporal_20')).toHaveLength(18);
    expect(asegDisponibles('soat', 'moto').length).toBeGreaterThan(0);
    expect(asegDisponibles('autos', 'danos_terceros')).toContain('LAREGIONAL');
  });
  it('depreciacion SSRP', () => {
    expect(depreciacion(2026, 20000, 2026)).toEqual({ edad: 0, pct: 0, valor: 20000 });
    expect(depreciacion(2024, 20000, 2026)).toEqual({ edad: 2, pct: 0.32, valor: 13600 });
    expect(depreciacion(2010, 20000, 2026)?.pct).toBe(0.8);
    expect(depreciacion(0, 20000)).toBeNull();
  });
  it('edad, orden, comision y formato', () => {
    expect(edadDesde('1990-10-23', new Date(2026, 9, 22))).toBe(35);
    expect(edadDesde('1990-10-22', new Date(2026, 9, 22))).toBe(36);
    const rs = calcular(base({ ramo: 'vida', sub: 'temporal_20', valor: 100000, edadVida: 42, aseguradoras: ['ASSA', 'CHUBB', 'FEDPA'] }));
    expect(ordenar(rs, 'rating')[0].asegId).toBe('CHUBB');
    expect(conComision(rs, 20)[0].com).toBeCloseTo(116, 6);
    expect(fM(1234.5)).toBe('$1,234.50');
  });
});
