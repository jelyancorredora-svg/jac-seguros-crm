import { describe, expect, it } from 'vitest';
import {
  correoPoliza, datosPago, datosPoliza, datosTarea, enlaceWA, entradaComms, numeroWA, waCliente, waRenovacion,
} from './contacto';

const hoy = new Date('2026-10-22T15:00:00Z');
const cli = { id: 'C1', nombre: 'María González Pérez', cel: '6123-4567', email: 'maria@ejemplo.com' };
const pol = { id: 'P1', clienteId: 'C1', num: 'AUTO-1', ramo: 'AUTOS', aseg: 'ASSA', fechaFin: '2026-10-27', prima: 850 };
const cart = { clientes: [cli], prospectos: [{ id: 'PR1', nombre: 'Ana Ruiz', cel: '60001111' }], polizas: [pol] };

describe('mensajes iguales al CRM web', () => {
  it('cliente (openWAForCli)', () => {
    expect(waCliente(cli)).toBe('Hola María 👋🏼\n\nTe saluda *Jely An Castro* de *JAC Seguros | Jely An Castro*.\n\n¿En qué podemos ayudarte hoy?\n\n_📞 +507 6292-6010_');
  });
  it('renovacion (waRenMsg final) con urgencia y firma', () => {
    const m = waRenovacion(pol, cli, hoy);
    expect(m).toContain('vence en *5 días*');
    expect(m).toContain('• Vence: *27 Oct 2026*');
    expect(m).toContain('• Prima actual: B/. 850.00');
    expect(m).toContain('Regulado y supervisado por la Superintendencia');
  });
  it('correo de poliza con dias', () => {
    expect(correoPoliza(pol, cli, hoy).asunto).toBe('⚠️ Tu póliza AUTOS vence en 5 días — JAC Seguros');
  });
});

describe('a quien y desde donde', () => {
  it('poliza: renovacion, cobro y general, y registra en el cliente', () => {
    const d = datosPoliza(pol, cart, hoy);
    expect(d.wa?.map((w) => w.motivo)).toEqual(['Renovación', 'Cobro', 'Póliza']);
    expect(d.registro).toEqual({ modulo: 'clientes', id: 'C1', prefijo: 'Póliza AUTO-1' });
    expect(d.email).toBe('maria@ejemplo.com');
  });
  it('pago: busca el cliente por la poliza', () => {
    expect(datosPago({ id: 'PG1', polizaId: 'P1', monto: 75 }, cart).tel).toBe('6123-4567');
  });
  it('tarea: contacto del prospecto relacionado', () => {
    const d = datosTarea({ id: 'T1', titulo: 'Llamar', tipoRel: 'prospecto', relId: 'PR1' }, cart);
    expect(d?.registro?.modulo).toBe('prospectos');
    expect(datosTarea({ id: 'T2', titulo: 'Sin nadie' }, cart)).toBeNull();
  });
  it('numero de WhatsApp como el web', () => {
    expect(numeroWA('6123-4567')).toBe('50761234567');
    expect(numeroWA('+507 6123 4567')).toBe('50761234567');
    expect(numeroWA('3001234567', '57')).toBe('573001234567');
    expect(numeroWA('573001234567', '57')).toBe('573001234567');
    expect(numeroWA('0015551234567')).toBe('15551234567');
    expect(enlaceWA('', 'x')).toBeNull();
  });
  it('registro con la forma de waClick', () => {
    const e = entradaComms('whatsapp', 'Renovación', 'hola', 'María');
    expect(e).toMatchObject({ tipo: 'whatsapp', msgType: 'Renovación', accion: '💬 WhatsApp — Renovación', mensaje: 'hola' });
  });
});
