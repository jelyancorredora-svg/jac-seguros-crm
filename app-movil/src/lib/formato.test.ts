import { describe, expect, it } from 'vitest';
import {
  diasHasta, dinero, enlaceCorreo, enlaceWhatsApp, esCorreo, fecha, limpiarTexto, normalizar,
  nuevoId, telefonoInternacional,
} from './formato';

describe('formato', () => {
  it('formatea fechas ISO sin mover el dia', () => {
    expect(fecha('2026-10-01')).toBe('1 oct 2026');
    expect(fecha('')).toBe('—');
    expect(fecha('basura')).toBe('—');
  });

  it('cuenta dias hasta el vencimiento', () => {
    const hoy = new Date(2026, 9, 21);
    expect(diasHasta('2026-10-21', hoy)).toBe(0);
    expect(diasHasta('2026-11-20', hoy)).toBe(30);
    expect(diasHasta('2026-10-20', hoy)).toBe(-1);
    expect(diasHasta(null, hoy)).toBeNull();
  });

  it('normaliza telefonos de Panama', () => {
    expect(telefonoInternacional('6123-4567')).toBe('50761234567');
    expect(telefonoInternacional('+507 6123 4567')).toBe('50761234567');
    expect(telefonoInternacional('123')).toBeNull();
    expect(enlaceWhatsApp('61234567')).toBe('https://wa.me/50761234567');
  });

  it('valida correos y no arma enlaces con correos invalidos', () => {
    expect(esCorreo('ana@jac.com')).toBe(true);
    expect(esCorreo('ana@jac')).toBe(false);
    expect(enlaceCorreo('javascript:alert(1)')).toBeNull();
  });

  it('busca sin acentos', () => {
    expect(normalizar('  José PÉREZ ')).toBe('jose perez');
  });

  it('genera ids unicos con prefijo', () => {
    const a = nuevoId('T'), b = nuevoId('T');
    expect(a).toMatch(/^T[0-9a-z]+[0-9A-Z]{3}$/);
    expect(a).not.toBe(b);
  });

  it('limpia caracteres de control y limita longitud', () => {
    expect(limpiarTexto(' hola\u0000 ')).toBe('hola');
    expect(limpiarTexto('x'.repeat(50), 10)).toHaveLength(10);
  });

  it('formatea dinero', () => {
    expect(dinero(1234.5)).toContain('1,234.50');
    expect(dinero(null)).toBe('—');
  });
});
