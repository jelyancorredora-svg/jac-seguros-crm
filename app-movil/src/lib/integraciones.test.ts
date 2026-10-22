import { afterEach, describe, expect, it } from 'vitest';

/* Navegador minimo para estas pruebas (el entorno de pruebas es Node) */
const datos = new Map<string, string>();
const g = globalThis as unknown as Record<string, unknown>;
g.sessionStorage = {
  getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, String(v)),
  removeItem: (k: string) => void datos.delete(k), clear: () => datos.clear(),
};
const loc = { origin: 'https://crm.jacsegurospa.com', pathname: '/app/', search: '', hash: '' };
g.location = loc;
g.history = {
  replaceState: (_s: unknown, _t: string, url: string) => {
    const u = new URL(url, loc.origin);
    loc.pathname = u.pathname; loc.search = u.search; loc.hash = u.hash;
  },
};
import { enviarEmailJS, parametrosCorreo, plantillaEJS } from './emailjs';
import { capturarRetorno, enlaceAgregarGcal, eventosDelCRM, eventoTarea, guardarEvento, tokenGcal, urlConexion } from './gcal';

describe('EmailJS', () => {
  const cfg = { 'ejs-pub': 'PUB', 'ejs-svc': 'svc_1', 'ejs-tpl-general': 'tpl_g', 'ejs-tpl-ren': 'tpl_r' };
  it('elige la plantilla como el web', () => {
    expect(plantillaEJS(cfg)).toBe('tpl_g');
    expect(plantillaEJS(cfg, 'ren')).toBe('tpl_r');
    expect(plantillaEJS(cfg, 'bday')).toBe('tpl_g');
    expect(plantillaEJS({ 'ejs-pub': 'x' })).toBe('');
  });
  it('manda service_id, template_id, user_id y parametros', async () => {
    let cuerpo: Record<string, unknown> = {};
    const f = (async (_u: string, init: RequestInit) => { cuerpo = JSON.parse(String(init.body)); return new Response('OK'); }) as unknown as typeof fetch;
    await enviarEmailJS(cfg, 'tpl_g', parametrosCorreo('a@b.com', 'Hola', 'Texto'), f);
    expect(cuerpo).toMatchObject({ service_id: 'svc_1', template_id: 'tpl_g', user_id: 'PUB' });
    expect(cuerpo.template_params).toMatchObject({ to_email: 'a@b.com', subject: 'Hola', message: 'Texto', company: 'JAC Seguros' });
  });
  it('explica el error si EmailJS rechaza', async () => {
    const f = (async () => new Response('The template ID is invalid', { status: 400 })) as unknown as typeof fetch;
    await expect(enviarEmailJS(cfg, 'mal', {}, f)).rejects.toThrow(/no aceptó/);
  });
});

describe('Google Calendar', () => {
  afterEach(() => sessionStorage.clear());
  it('evento de tarea con hora (30 min) y de dia completo', () => {
    expect(eventoTarea({ id: 'T1', titulo: 'Llamar', fechaLimite: '2026-10-22', hora: '10:30' })).toMatchObject({
      summary: 'Llamar', start: { dateTime: '2026-10-22T10:30:00', timeZone: 'America/Panama' }, end: { dateTime: '2026-10-22T11:00:00' },
    });
    expect(eventoTarea({ id: 'T2', titulo: 'Todo el día', fechaLimite: '2026-10-22' })).toMatchObject({ start: { date: '2026-10-22' }, end: { date: '2026-10-23' } });
    expect(eventoTarea({ id: 'T3' })).toBeNull();
  });
  it('renovaciones, cumpleaños y cobros con las mismas claves que el web', () => {
    const hoy = new Date('2026-10-22T15:00:00Z');
    const ev = eventosDelCRM({
      polizas: [{ id: 'P1', nombreCliente: 'María', aseg: 'ASSA', num: 'A1', ramo: 'AUTOS', fechaFin: '2026-11-01', saldo: 150, fechaFact: '2026-10-25' },
        { id: 'P2', fechaFin: '2027-05-01', estado: 'Cancelada' }],
      clientes: [{ id: 'C1', nombre: 'Ana', fNac: '1990-10-25' }, { id: 'C2', nombre: 'Luis', fNac: '1990-12-25' }],
    }, hoy);
    expect(ev.map((x) => x.k).sort()).toEqual(['cum_C1', 'pag_P1', 'ren_P1']);
    expect(ev.find((x) => x.k === 'ren_P1')?.e.summary).toBe('🔄 Renueva: María (ASSA)');
  });
  it('solo acepta la vuelta de Google con el mismo "state"', () => {
    const url = new URL(urlConexion('123.apps.googleusercontent.com', 'https://crm.jacsegurospa.com/app/'));
    expect(url.searchParams.get('redirect_uri')).toBe('https://crm.jacsegurospa.com/app/');
    const st = url.searchParams.get('state')!;
    history.replaceState(null, '', `/app/#access_token=TOK&expires_in=3599&state=${st}`);
    expect(capturarRetorno()).toBe('conectado');
    expect(tokenGcal()).toBe('TOK');
    expect(location.hash).toBe('');
    urlConexion('x');
    history.replaceState(null, '', '/app/#access_token=MALO&state=otro');
    expect(capturarRetorno()).toBe('rechazado');
  });
  it('si el evento ya no existe en Google, lo crea de nuevo', async () => {
    const llamadas: string[] = [];
    const f = (async (_u: string, init: RequestInit) => {
      llamadas.push(String(init.method));
      return init.method === 'PATCH' ? new Response('', { status: 404 }) : new Response(JSON.stringify({ id: 'NUEVO' }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await guardarEvento('t', eventoTarea({ id: 'T', fechaLimite: '2026-10-22' })!, 'VIEJO', f)).toBe('NUEVO');
    expect(llamadas).toEqual(['PATCH', 'POST']);
  });
  it('enlace de un toque', () => {
    expect(enlaceAgregarGcal('Cita', '2026-10-22', '09:00')).toContain('dates=20261022T090000%2F20261022T093000');
  });
});
