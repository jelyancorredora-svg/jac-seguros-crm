import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase', () => ({ db: {} }));
import type { Cartera } from './datos';
import { ventaCruzada } from './crm';

const base = { siniestros: [], pagos: [], vehiculos: [], comisiones: [], tareas: [], cargadoEn: 0 };
describe('venta cruzada (igual que computeVC del web)', () => {
  it('detecta ramos que faltan y no repite lo que ya esta en el pipeline', () => {
    const c = {
      ...base,
      clientes: [{ id: 'C1', nombre: 'Ana', tipo: 'Persona Natural' }, { id: 'C2', nombre: 'Empresa X', tipo: 'Empresa' }],
      polizas: [{ id: 'P1', clienteId: 'C1', ramo: 'AUTOS/VEHÍCULOS', estado: 'Vigente' }],
      prospectos: [{ id: 'PR1', clienteIdVinculado: 'C1', esVentaCruzada: true, interes: ['SOAT'], etapaVenta: 'Cotización' }],
      meta: { vcReglas: [] },
    } as unknown as Cartera;
    const o = ventaCruzada(c).map((x) => `${x.cliente.id}:${x.ramo}`);
    expect(o).toContain('C1:ACCIDENTES PERSONALES');
    expect(o).not.toContain('C1:SOAT');
    expect(o).toContain('C2:RESPONSABILIDAD CIVIL');
  });
});
