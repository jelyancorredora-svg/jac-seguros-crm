import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ db: {} }));
import { aFila, aObjeto } from './datos';

describe('conversion igual que el CRM web', () => {
  it('columnas a su lugar y el resto a extra', () => {
    const f = aFila({ id: 'C1', nombre: 'Ana', fNac: '05/03/1990', celSec: '', estadoCivil: 'Casado/a', archivos: [{ name: 'a.pdf' }] }, 'clientes');
    expect(f.nombre).toBe('Ana');
    expect(f.f_nac).toBe('1990-03-05');
    expect(f.cel_sec).toBeNull();
    expect(f.extra).toEqual({ estadoCivil: 'Casado/a', archivos: [{ name: 'a.pdf' }] });
  });
  it('ida y vuelta conserva los campos', () => {
    const o = aObjeto({ id: 'P1', fecha_fin: '2026-12-01', prima: 100, extra: { saldo: 20 }, updated_at: 'x', obs: null });
    expect(o).toEqual({ id: 'P1', fechaFin: '2026-12-01', prima: 100, saldo: 20 });
  });
});
