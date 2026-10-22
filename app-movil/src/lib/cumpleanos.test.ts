import { describe, expect, it } from 'vitest';
import {
  MENSAJE_WA_DEFECTO, cuando, cumpleEn, diaMes, enPestana, infoCumple, leerFechaNac, listaCumples,
  nombrePropio, ordenar, primerNombre, rellenarMensaje, yaFelicitado,
} from './cumpleanos';

const hoy = new Date(2026, 9, 22); // jueves 22 oct 2026

describe('fechas de nacimiento', () => {
  it('lee los formatos del CRM', () => {
    expect(leerFechaNac('1986-10-22')).toEqual({ y: 1986, m: 10, d: 22 });
    expect(leerFechaNac('05/03/1990')).toEqual({ y: 1990, m: 3, d: 5 });
    expect(leerFechaNac('2000-02-29')).toEqual({ y: 2000, m: 2, d: 29 });
    expect(leerFechaNac('1990-02-30')).toBeNull();
    expect(leerFechaNac('')).toBeNull();
    expect(leerFechaNac(null)).toBeNull();
    expect(leerFechaNac('0000-07-04')).toEqual({ y: null, m: 7, d: 4 });
  });
  it('29 de febrero se celebra el 28 en años no bisiestos', () => {
    const f = { y: 2000, m: 2, d: 29 };
    expect(cumpleEn(f, 2027)).toBe('2027-02-28');
    expect(cumpleEn(f, 2028)).toBe('2028-02-29');
    expect(infoCumple(f, new Date(2027, 1, 28))).toMatchObject({ delta: 0, edad: 27, anio: 2027 });
  });
});

describe('infoCumple', () => {
  it('hoy', () => {
    expect(infoCumple({ y: 1986, m: 10, d: 22 }, hoy)).toEqual({ fecha: '2026-10-22', delta: 0, proximo: '2026-10-22', dias: 0, edad: 40, anio: 2026 });
  });
  it('ya paso hace poco: la ocurrencia cercana es la de este año, el proximo el del siguiente', () => {
    const i = infoCumple({ y: 1990, m: 10, d: 1 }, hoy);
    expect(i).toMatchObject({ delta: -21, dias: 344, edad: 36, anio: 2026, proximo: '2027-10-01' });
  });
  it('a fin de año el de enero cuenta para el año que viene', () => {
    const i = infoCumple({ y: 1980, m: 1, d: 2 }, new Date(2026, 11, 30));
    expect(i).toMatchObject({ delta: 3, dias: 3, edad: 47, anio: 2027, fecha: '2027-01-02' });
  });
  it('sin año no hay edad', () => {
    expect(infoCumple({ y: null, m: 11, d: 1 }, hoy).edad).toBeNull();
  });
});

describe('mensaje', () => {
  it('nombres', () => {
    expect(nombrePropio('MARÍA JOSÉ DE LA O')).toBe('María José De La O');
    expect(nombrePropio('Ana McKay')).toBe('Ana McKay');
    expect(primerNombre('  JUAN  pérez ')).toBe('Juan');
    expect(primerNombre('')).toBe('Cliente');
  });
  it('rellena variables', () => {
    expect(rellenarMensaje('Hola {primerNombre} ({nombre}), {edad} años', { nombre: 'ANA RUIZ', edad: 30 })).toBe('Hola Ana (Ana Ruiz), 30 años');
    expect(rellenarMensaje('{EDAD}', { nombre: 'x', edad: null })).toBe('');
  });
  it('el texto por defecto es el del CRM web', () => {
    expect(rellenarMensaje(MENSAJE_WA_DEFECTO, { nombre: 'Ana', edad: 1 }).startsWith('🎂 ¡Feliz Cumpleaños, Ana! 🎉\n\nDesde *JAC Seguros* | *Jely An Castro*')).toBe(true);
  });
});

describe('felicitado', () => {
  it('por campo o por historial del año', () => {
    expect(yaFelicitado({ id: '1', cumpleFelicitado: '2026' }, 2026)).toBe(true);
    expect(yaFelicitado({ id: '1', cumpleFelicitado: '2025' }, 2026)).toBe(false);
    expect(yaFelicitado({ id: '1', historial: [{ fecha: '2026-10-22', accion: '🎂 Felicitación de cumpleaños enviada' }] }, 2026)).toBe(true);
    expect(yaFelicitado({ id: '1', historial: [{ fecha: '2026-03-01', tipo: 'Email', nota: '🎂 Email de cumpleaños enviado a x' }] }, 2026)).toBe(true);
    expect(yaFelicitado({ id: '1', historial: [{ fecha: '2025-10-22', accion: 'cumpleaños' }] }, 2026)).toBe(false);
  });
});

describe('lista y pestañas', () => {
  const cli = [
    { id: 'a', nombre: 'Ana', fNac: '1990-10-22', cumpleFelicitado: '2026' },
    { id: 'b', nombre: 'Beto', fNac: '1980-10-25' },
    { id: 'c', nombre: 'Caro', fNac: '1980-10-19' }, // lunes de esta semana
    { id: 'd', nombre: 'Dani', fNac: '1980-11-15' },
    { id: 'e', nombre: 'Eva', fNac: '1980-03-01' },
    { id: 'f', nombre: 'Sin fecha' },
  ];
  const l = listaCumples(cli, [{ id: 'p', nombre: 'Pros', fechaNac: '22/10/2000' }], hoy);
  const ids = (p: Parameters<typeof enPestana>[1]) => ordenar(l.filter((x) => enPestana(x, p, hoy)), p, hoy).map((x) => x.r.id);
  it('solo con fecha, marcando felicitados y prospectos', () => {
    expect(l.length).toBe(6);
    expect(l.find((x) => x.r.id === 'a')!.felicitado).toBe(true);
    expect(l.find((x) => x.r.id === 'p')!.modulo).toBe('prospectos');
  });
  it('pestañas', () => {
    expect(ids('hoy')).toEqual(['a', 'p']);
    expect(ids('semana')).toEqual(['c', 'a', 'p', 'b']);
    expect(ids('mes')).toEqual(['c', 'a', 'p', 'b']);
    expect(ids('30')).toEqual(['a', 'p', 'b', 'd']);
    expect(ids('todos')).toEqual(['c', 'a', 'p', 'b', 'd', 'e']);
  });
  it('textos', () => {
    expect(diaMes('2026-10-22')).toBe('22 de octubre');
    expect([cuando(0), cuando(1), cuando(-1), cuando(5), cuando(-3)]).toEqual(['¡Hoy!', 'mañana', 'ayer', 'en 5 días', 'hace 3 días']);
  });
});
