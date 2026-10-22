/* Reportes (pg-rep del CRM web, version final con filtros y totales): logica pura, con pruebas. */
import type { Reg } from './datos';
import { fecha } from './formato';

export type TipoRep = 'pol' | 'pag' | 'cli' | 'com' | 'res';
export type FiltrosRep = { q: string; aseg: string; ramo: string; estado: string };
export const SIN_FILTROS: FiltrosRep = { q: '', aseg: '', ramo: '', estado: '' };

export const PESTANAS_REP: Array<[TipoRep, string]> = [
  ['pol', '📄 Pólizas'], ['pag', '💳 Pagos'], ['cli', '👤 Clientes'], ['com', '💰 Comisiones'], ['res', '📁 Por ramo'],
];

/** [titulo, clave, 'n' si es numerica] — mismas columnas que el web */
export type Col = [string, string, 'n'?];
export const COLS: Record<TipoRep, Col[]> = {
  pol: [['Póliza', 'num'], ['Compañía', 'aseg'], ['Ramo', 'ramo'], ['Cliente', 'cli'], ['Cédula', 'ced'],
    ['Estado', 'est'], ['Inicio', 'ini'], ['Vence', 'fin'], ['Prima año', 'prima', 'n'],
    ['Cuota', 'cuota', 'n'], ['% com', 'pct', 'n'], ['Comisión', 'com', 'n'],
    ['Co-corretaje', 'cc'], ['Pagado', 'pagado', 'n'], ['Saldo', 'saldo', 'n'], ['Forma', 'forma']],
  pag: [['Vence', 'fecha'], ['Cliente', 'cli'], ['Póliza', 'pol'], ['Compañía', 'aseg'],
    ['Concepto', 'cuota'], ['Monto', 'monto', 'n'], ['Estado', 'est'], ['Días', 'dias', 'n']],
  cli: [['Cliente', 'nombre'], ['Cédula', 'ced'], ['Teléfono', 'tel'], ['Correo', 'email'],
    ['Pólizas', 'nPols', 'n'], ['Vigentes', 'act', 'n'], ['Prima año', 'prima', 'n'], ['Comisión', 'com', 'n']],
  com: [['Compañía', 'aseg'], ['Pólizas', 'pols', 'n'], ['Prima año', 'prima', 'n'],
    ['Comisión tuya', 'com', 'n'], ['Cedida', 'cedida', 'n'], ['% medio', 'pct', 'n']],
  res: [['Ramo', 'ramo'], ['Pólizas', 'pols', 'n'], ['Vigentes', 'vig', 'n'],
    ['Prima año', 'prima', 'n'], ['Comisión', 'com', 'n']],
};

/** Columnas que son conteos (sin formato de dinero) */
export const CONTEOS = ['nPols', 'act', 'pols', 'vig', 'dias'];

export type FilaRep = Record<string, string | number>;
type Fuente = { polizas: Reg[]; clientes: Reg[]; pagos: Reg[] };

const s = (r: Reg | undefined, k: string) => {
  const v = r?.[k];
  return v === null || v === undefined || typeof v === 'object' ? '' : String(v);
};
const n = (v: unknown) => parseFloat(String(v ?? '')) || 0;
const r2 = (x: number) => +x.toFixed(2);
const f = (v: string) => (v ? fecha(v.slice(0, 10)) : '—');

/** Un numero de poliza de verdad, nunca el identificador interno */
export function numeroPoliza(p: Reg): string {
  const x = s(p, 'num').trim();
  if (!x || /^RESTORE\d{10,}$/i.test(x) || /^[a-f0-9]{16,}$/i.test(x)) return '(sin número)';
  return x;
}
/** La prima del año, siempre la misma medida */
export function primaAnual(p: Reg): number {
  const a = n(p.prima);
  if (a > 0) return a;
  const m = n(p.primaMensual);
  return m > 0 ? r2(m * 12) : 0;
}
const cuota = (p: Reg) => n(p.letraPrima) || n(p.cuotaMensual) || 0;

function nombreCliente(p: Reg, clientes: Map<string, Reg>): string {
  return s(p, 'nombreCliente') || s(clientes.get(s(p, 'clienteId')), 'nombre') || '—';
}

export function cumpleFiltros(p: Reg, fl: FiltrosRep, clientes: Map<string, Reg>): boolean {
  if (fl.aseg && s(p, 'aseg') !== fl.aseg) return false;
  if (fl.ramo && s(p, 'ramo') !== fl.ramo) return false;
  if (fl.estado && s(p, 'estado') !== fl.estado) return false;
  if (fl.q) {
    const t = `${numeroPoliza(p)} ${nombreCliente(p, clientes)} ${s(p, 'aseg')} ${s(p, 'ramo')} ${s(p, 'cedCliente')}`.toLowerCase();
    if (!t.includes(fl.q.toLowerCase())) return false;
  }
  return true;
}

/** Valores distintos de un campo de las polizas, para los selectores */
export function opcionesCampo(polizas: Reg[], campo: 'aseg' | 'ramo' | 'estado'): string[] {
  return [...new Set(polizas.map((p) => s(p, campo)).filter(Boolean))].sort();
}

export function datosReporte(tipo: TipoRep, fuente: Fuente, fl: FiltrosRep, ahora: Date = new Date()): FilaRep[] {
  const cli = new Map(fuente.clientes.map((c) => [c.id, c]));
  const L = fuente.polizas.filter((p) => cumpleFiltros(p, fl, cli));
  if (tipo === 'pol') {
    return L.map((p) => ({
      num: numeroPoliza(p), aseg: s(p, 'aseg') || '—', ramo: s(p, 'ramo') || '—', cli: nombreCliente(p, cli),
      ced: s(p, 'cedCliente') || '—', est: s(p, 'estado') || '—',
      ini: f(s(p, 'fechaInicio')), fin: f(s(p, 'fechaFin')),
      prima: primaAnual(p), cuota: cuota(p), pct: n(p.comPct), com: n(p.comision), cc: s(p, 'coCor') || '—',
      pagado: n(p.pagado), saldo: n(p.saldo), forma: s(p, 'formaPago') || s(p, 'periodo') || '—',
    })).sort((a, b) => (b.prima as number) - (a.prima as number));
  }
  if (tipo === 'pag') {
    // Igual que el web: los cobros no se filtran por compania/ramo/estado
    const pol = new Map(fuente.polizas.map((p) => [p.id, p]));
    const hoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    return fuente.pagos.map((g) => {
      const p = pol.get(s(g, 'polizaId')) ?? ({ id: '' } as Reg);
      const fe = s(g, 'fecha').slice(0, 10);
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fe);
      const d = m ? Math.round((hoy - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 864e5) : 0;
      return {
        fecha: f(fe), cli: s(g, 'cliente') || nombreCliente(p, cli), pol: s(p, 'num') ? numeroPoliza(p) : '—',
        aseg: s(g, 'aseg') || s(p, 'aseg') || '—', cuota: s(g, 'cuota') || s(g, 'referencia') || '—',
        monto: n(g.monto), est: s(g, 'estado') || 'Pendiente', dias: d,
      };
    }).sort((a, b) => b.dias - a.dias);
  }
  if (tipo === 'cli') {
    return fuente.clientes.map((c) => {
      const pl = L.filter((p) => s(p, 'clienteId') === c.id);
      return {
        nombre: s(c, 'nombre') || '—', ced: s(c, 'cedula') || '—', tel: s(c, 'cel') || s(c, 'tel') || '—', email: s(c, 'email') || '—',
        nPols: pl.length, act: pl.filter((p) => s(p, 'estado') === 'Vigente').length,
        prima: r2(pl.reduce((t, p) => t + primaAnual(p), 0)), com: r2(pl.reduce((t, p) => t + n(p.comision), 0)),
      };
    }).filter((r) => r.nPols > 0).sort((a, b) => b.com - a.com);
  }
  if (tipo === 'com') {
    const m = new Map<string, { aseg: string; pols: number; prima: number; com: number; cedida: number; pct: number }>();
    for (const p of L) {
      if (s(p, 'estado') === 'Cancelada') continue;
      const k = s(p, 'aseg') || 'Sin compañía';
      const x = m.get(k) ?? { aseg: k, pols: 0, prima: 0, com: 0, cedida: 0, pct: 0 };
      x.pols++; x.prima += primaAnual(p); x.com += n(p.comision); x.cedida += n(p.coCorCom);
      m.set(k, x);
    }
    return [...m.values()].map((x) => ({
      ...x, prima: r2(x.prima), com: r2(x.com), cedida: r2(x.cedida), pct: x.prima > 0 ? r2((x.com / x.prima) * 100) : 0,
    })).sort((a, b) => b.com - a.com);
  }
  const r = new Map<string, { ramo: string; pols: number; vig: number; prima: number; com: number }>();
  for (const p of L) {
    const k = s(p, 'ramo') || 'Sin ramo';
    const x = r.get(k) ?? { ramo: k, pols: 0, vig: 0, prima: 0, com: 0 };
    x.pols++; if (s(p, 'estado') === 'Vigente') x.vig++;
    x.prima += primaAnual(p); x.com += n(p.comision);
    r.set(k, x);
  }
  return [...r.values()].map((x) => ({ ...x, prima: r2(x.prima), com: r2(x.com) })).sort((a, b) => b.prima - a.prima);
}

/** Suma de cada columna numerica */
export function totalesReporte(tipo: TipoRep, filas: FilaRep[]): Record<string, number> {
  const t: Record<string, number> = {};
  for (const c of COLS[tipo]) if (c[2] === 'n') t[c[1]] = 0;
  for (const fila of filas) for (const k of Object.keys(t)) t[k] += n(fila[k]);
  for (const k of Object.keys(t)) t[k] = r2(t[k]);
  return t;
}

/** % de comision del total: comision / prima */
export function pctTotal(t: Record<string, number>): number | null {
  return t.prima > 0 ? r2((t.com / t.prima) * 100) : null;
}

/** CSV con BOM: exactamente lo que se ve (todas las filas) */
export function csvReporte(tipo: TipoRep, filas: FilaRep[]): string {
  const cols = COLS[tipo];
  const c = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = [cols.map((x) => c(x[0])).join(',')]
    .concat(filas.map((r) => cols.map((x) => c(r[x[1]])).join(',')));
  return '﻿' + lineas.join('\n');
}

/* ---------------- pg-hist: historial de actividad de un cliente o poliza ---------------- */

export type ItemHist = { fecha: string; tipo: 'pago' | 'tarea' | 'poliza'; icono: string; desc: string; sub: string };

export function actividad(tipo: 'pol' | 'cli', id: string, fuente: Fuente & { tareas: Reg[] }, dinero: (v: number) => string): ItemHist[] {
  const items: ItemHist[] = [];
  const tarea = (t: Reg): ItemHist => ({
    fecha: s(t, 'fechaCreacion'), tipo: 'tarea', icono: s(t, 'estado') === 'done' ? '✅' : '📋',
    desc: s(t, 'titulo') || s(t, 'desc') || 'Tarea', sub: s(t, 'desc'),
  });
  const pago = (g: Reg): ItemHist => ({ fecha: s(g, 'fecha'), tipo: 'pago', icono: '💳', desc: 'Pago: ' + dinero(n(g.monto)), sub: s(g, 'notas') });
  if (tipo === 'pol') {
    fuente.tareas.filter((t) => s(t, '_autoRef') === id).forEach((t) => items.push(tarea(t)));
    fuente.pagos.filter((g) => s(g, 'polizaId') === id).forEach((g) => items.push(pago(g)));
  } else {
    const pols = fuente.polizas.filter((p) => s(p, 'clienteId') === id);
    const pids = new Set(pols.map((p) => p.id));
    pols.forEach((p) => items.push({
      fecha: s(p, 'fechaIni') || s(p, 'fechaInicio') || s(p, 'fechaCreacion'), tipo: 'poliza', icono: '📄',
      desc: `Póliza ${s(p, 'num') || p.id} — ${s(p, 'aseg')} ${s(p, 'ramo')}`.trim(), sub: 'Estado: ' + (s(p, 'estado') || 'Activa'),
    }));
    fuente.tareas.filter((t) => s(t, '_autoRef') === id || pids.has(s(t, '_autoRef'))).forEach((t) => items.push(tarea(t)));
    fuente.pagos.filter((g) => pids.has(s(g, 'polizaId')) || s(g, 'cliente') === id).forEach((g) => items.push(pago(g)));
  }
  return items.sort((a, b) => b.fecha.localeCompare(a.fecha));
}
