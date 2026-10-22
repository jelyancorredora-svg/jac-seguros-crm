import { useMemo, useState } from 'react';
import { Fila, Vacio } from '../components/Piezas';
import { fec, num, txt, type Reg } from '../lib/datos';
import { ESTADOS_COMERCIALES } from '../lib/esquema';
import { diasHasta, dinero, fecha, hoyISO } from '../lib/formato';
import { estadoComercial, polizaCancelada } from '../lib/reglas';
import type { Ctx } from './Modulos';

/* Replica del modulo "Informes" del CRM web (pg-inf) */

type Tab = 'resumen' | 'prod' | 'ren' | 'cli' | 'aseg';
const TABS: Array<[Tab, string]> = [
  ['resumen', '📋 Resumen'], ['prod', '🏆 Producción'], ['ren', '🔔 Renovaciones'], ['cli', '👥 Clientes'], ['aseg', '🏛 Aseguradoras'],
];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const prima = (p: Reg) => num(p, 'prima') ?? 0;
const comision = (p: Reg) => num(p, 'comision') ?? 0;

function Barras({ datos, formato = (v: number) => String(v) }: { datos: Array<[string, number]>; formato?: (v: number) => string }) {
  const max = Math.max(1, ...datos.map(([, v]) => v));
  return (
    <div className="barras">
      {datos.map(([k, v]) => (
        <div key={k} className="barras-fila">
          <span className="barras-et">{k}</span>
          <div className="barras-pista"><div className="barras-valor" style={{ width: `${(v / max) * 100}%` }} /></div>
          <b>{formato(v)}</b>
        </div>
      ))}
    </div>
  );
}

function exportarCSV(polizas: Reg[], nombreCliente: (p: Reg) => string) {
  const c = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const filas = [['Póliza', 'Cliente', 'Aseguradora', 'Ramo', 'Prima', 'Comisión', 'Estado', 'Inicio', 'Vencimiento']]
    .concat(polizas.map((p) => [txt(p, 'num'), nombreCliente(p), txt(p, 'aseg'), txt(p, 'ramo'), String(prima(p)), String(comision(p)),
      txt(p, 'estado'), fec(p, 'fechaInicio'), fec(p, 'fechaFin')]));
  const csv = '﻿' + filas.map((f) => f.map(c).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `JAC_Informe_${hoyISO()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function Informes({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const [tab, setTab] = useState<Tab>('resumen');
  const nombreCliente = useMemo(() => {
    const m = new Map(cartera.clientes.map((c) => [c.id, txt(c, 'nombre')]));
    return (p: Reg) => m.get(txt(p, 'clienteId')) || txt(p, 'nombreCliente') || '—';
  }, [cartera.clientes]);

  return (
    <div className="informe">
      <div className="botonera fila-botones no-imprimir">
        <button className="boton secundario" type="button" onClick={() => exportarCSV(cartera.polizas, nombreCliente)}>📊 Exportar Excel</button>
        <button className="boton secundario" type="button" onClick={() => window.print()}>📄 Imprimir / PDF</button>
      </div>
      <div className="ag-tabs no-imprimir">
        {TABS.map(([k, t]) => <button key={k} type="button" className={tab === k ? 'activa' : ''} onClick={() => setTab(k)}>{t}</button>)}
      </div>
      <h2 className="solo-imprimir">Informe JAC Seguros · {fecha(hoyISO())}</h2>
      {tab === 'resumen' && <Resumen ctx={ctx} />}
      {tab === 'prod' && <Produccion ctx={ctx} nombreCliente={nombreCliente} />}
      {tab === 'ren' && <RenovacionesInf ctx={ctx} nombreCliente={nombreCliente} />}
      {tab === 'cli' && <ClientesInf ctx={ctx} />}
      {tab === 'aseg' && <Aseguradoras ctx={ctx} />}
    </div>
  );
}

function Resumen({ ctx }: { ctx: Ctx }) {
  const { polizas, clientes } = ctx.cartera;
  const r = useMemo(() => {
    const hoy = hoyISO();
    const cuenta = (f: (p: Reg) => string) => {
      const m = new Map<string, number>();
      for (const p of polizas) m.set(f(p) || 'Otros', (m.get(f(p) || 'Otros') ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };
    const conInicio = polizas.filter((p) => fec(p, 'fechaInicio'));
    const anios = [...new Set(conInicio.map((p) => fec(p, 'fechaInicio').slice(0, 4)))].sort().reverse();
    const anio = anios[0] ?? String(new Date().getFullYear());
    const porMes = MESES.map((m, i): [string, number] => {
      const k = `${anio}-${String(i + 1).padStart(2, '0')}`;
      return [m, conInicio.filter((p) => fec(p, 'fechaInicio').startsWith(k)).reduce((s, p) => s + comision(p), 0)];
    });
    return {
      total: polizas.length,
      vigentes: polizas.filter((p) => txt(p, 'estado') === 'Vigente').length,
      vencidas: polizas.filter((p) => txt(p, 'estado') === 'Vencida' || (fec(p, 'fechaFin') && fec(p, 'fechaFin') < hoy)).length,
      prima: polizas.reduce((s, p) => s + prima(p), 0),
      com: polizas.reduce((s, p) => s + comision(p), 0),
      porRamo: cuenta((p) => txt(p, 'ramo')), porAseg: cuenta((p) => txt(p, 'aseg')), porMes, anio,
    };
  }, [polizas]);
  return (
    <>
      <div className="kpis">
        <div className="kpi"><b>{r.total}</b><span>📋 Total pólizas</span></div>
        <div className="kpi"><b className="verde-t">{r.vigentes}</b><span>✅ Vigentes</span></div>
        <div className="kpi alerta"><b>{r.vencidas}</b><span>🔴 Vencidas</span></div>
        <div className="kpi"><b>{clientes.length}</b><span>👥 Total clientes</span></div>
        <div className="kpi"><b className="kpi-dinero">{dinero(r.prima)}</b><span>💰 Prima total</span></div>
        <div className="kpi"><b className="kpi-dinero verde-t">{dinero(r.com)}</b><span>💵 Comisión total</span></div>
      </div>
      <h3 className="seccion">📈 Pólizas por ramo</h3>
      <div className="tarjeta"><Barras datos={r.porRamo.slice(0, 15)} /></div>
      <h3 className="seccion">🏛 Pólizas por aseguradora</h3>
      <div className="tarjeta"><Barras datos={r.porAseg.slice(0, 15)} /></div>
      <h3 className="seccion">💵 Comisiones por mes ({r.anio})</h3>
      <div className="tarjeta"><Barras datos={r.porMes} formato={(v) => (v ? dinero(v) : '—')} /></div>
    </>
  );
}

function Produccion({ ctx, nombreCliente }: { ctx: Ctx; nombreCliente: (p: Reg) => string }) {
  const { polizas } = ctx.cartera;
  const anios = useMemo(() => {
    const a = [...new Set(polizas.map((p) => fec(p, 'fechaInicio').slice(0, 4)).filter(Boolean))].sort().reverse();
    const actual = String(new Date().getFullYear());
    return [...new Set([...a, actual])].sort().reverse();
  }, [polizas]);
  const [anio, setAnio] = useState(() => {
    const a = polizas.map((p) => fec(p, 'fechaInicio').slice(0, 4)).filter(Boolean).sort().reverse();
    return a[0] ?? String(new Date().getFullYear());
  });
  const [mes, setMes] = useState('');
  const lista = polizas.filter((p) => { const fi = fec(p, 'fechaInicio'); return fi.startsWith(anio) && (!mes || fi.slice(5, 7) === mes); })
    .sort((a, b) => fec(b, 'fechaInicio').localeCompare(fec(a, 'fechaInicio')));
  const tp = lista.reduce((s, p) => s + prima(p), 0);
  const tc = lista.reduce((s, p) => s + comision(p), 0);
  return (
    <>
      <div className="dos no-imprimir">
        <label className="campo"><span>Año</span>
          <select value={anio} onChange={(e) => setAnio(e.target.value)}>{anios.map((a) => <option key={a}>{a}</option>)}</select></label>
        <label className="campo"><span>Mes</span>
          <select value={mes} onChange={(e) => setMes(e.target.value)}>
            <option value="">Todos</option>
            {MESES.map((m, i) => <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
          </select></label>
      </div>
      <div className="tarjeta"><b>{lista.length} pólizas</b> · Prima total: <b>{dinero(tp)}</b> · Comisión: <b className="verde-t">{dinero(tc)}</b></div>
      {lista.length ? (
        <div className="lista">
          {lista.map((p) => (
            <Fila key={p.id} titulo={`${txt(p, 'num') || '—'} · ${nombreCliente(p)}`}
              sub={[txt(p, 'aseg'), txt(p, 'ramo'), fecha(fec(p, 'fechaInicio')), `Prima ${dinero(prima(p))}`, `Com. ${dinero(comision(p))}`].filter(Boolean).join(' · ')}
              derecha={<span className={`etiqueta ${txt(p, 'estado') === 'Vigente' ? 'e-ok' : txt(p, 'estado') === 'Vencida' ? 'e-peligro' : 'e-neutra'}`}>{txt(p, 'estado') || '—'}</span>}
              onClick={() => ctx.abrir('polizas', p.id)} />
          ))}
        </div>
      ) : <Vacio>Sin pólizas en este período.</Vacio>}
    </>
  );
}

function RenovacionesInf({ ctx, nombreCliente }: { ctx: Ctx; nombreCliente: (p: Reg) => string }) {
  const hoy = hoyISO();
  const en90 = new Date(); en90.setDate(en90.getDate() + 90);
  const lim = en90.toISOString().slice(0, 10);
  const pols = ctx.cartera.polizas.filter((p) => !polizaCancelada(p) && fec(p, 'fechaFin'));
  const pronto = pols.filter((p) => fec(p, 'fechaFin') >= hoy && fec(p, 'fechaFin') <= lim).sort((a, b) => fec(a, 'fechaFin').localeCompare(fec(b, 'fechaFin')));
  const venc = pols.filter((p) => fec(p, 'fechaFin') < hoy).sort((a, b) => fec(b, 'fechaFin').localeCompare(fec(a, 'fechaFin'))).slice(0, 30);
  const fila = (p: Reg) => {
    const d = diasHasta(fec(p, 'fechaFin')) as number;
    return (
      <Fila key={p.id} titulo={`${nombreCliente(p)} · ${txt(p, 'num') || '—'}`}
        sub={[txt(p, 'aseg'), txt(p, 'ramo'), dinero(prima(p)), fecha(fec(p, 'fechaFin'))].join(' · ')}
        derecha={<span className={`etiqueta ${d < 0 ? 'e-peligro' : d <= 7 ? 'e-peligro' : d <= 30 ? 'e-aviso' : 'e-ok'}`}>{d}d</span>}
        onClick={() => ctx.abrir('polizas', p.id)} />
    );
  };
  return (
    <>
      <h3 className="seccion">Vencen en los próximos 90 días ({pronto.length})</h3>
      {pronto.length ? <div className="lista">{pronto.map(fila)}</div> : <Vacio>Nada en los próximos 90 días.</Vacio>}
      <h3 className="seccion">Vencidas recientes ({venc.length})</h3>
      {venc.length ? <div className="lista">{venc.map(fila)}</div> : <Vacio>Sin pólizas vencidas.</Vacio>}
    </>
  );
}

function ClientesInf({ ctx }: { ctx: Ctx }) {
  const { clientes, polizas } = ctx.cartera;
  const hoy = new Date();
  const mes = hoy.getMonth() + 1;
  const cumple = clientes.filter((c) => { const f = fec(c, 'fNac') || fec(c, 'fechaNac'); return f && +f.split('-')[1] === mes; })
    .sort((a, b) => (fec(a, 'fNac') || fec(a, 'fechaNac')).slice(8).localeCompare((fec(b, 'fNac') || fec(b, 'fechaNac')).slice(8)));
  const porEstado = new Map<string, number>();
  for (const c of clientes) porEstado.set(estadoComercial(c), (porEstado.get(estadoComercial(c)) ?? 0) + 1);
  const etq = (e: string) => ESTADOS_COMERCIALES.find(([v]) => v === e)?.[1] ?? e;
  const nuevos = new Array(12).fill(0) as number[];
  const anio = String(hoy.getFullYear());
  const primeraPol = new Map<string, string>();
  for (const p of polizas) {
    const fi = fec(p, 'fechaInicio'); const id = txt(p, 'clienteId');
    if (fi && id && (!primeraPol.has(id) || fi < primeraPol.get(id)!)) primeraPol.set(id, fi);
  }
  for (const c of clientes) {
    const f = fec(c, 'fechaCreacion') || fec(c, 'createdAt') || primeraPol.get(c.id) || '';
    if (f.startsWith(anio)) nuevos[+f.slice(5, 7) - 1]++;
  }
  return (
    <>
      <h3 className="seccion">🎂 Cumpleaños de este mes ({cumple.length})</h3>
      {cumple.length ? (
        <div className="lista">
          {cumple.map((c) => <Fila key={c.id} titulo={`🎂 ${txt(c, 'nombre')}`} sub={fecha(fec(c, 'fNac') || fec(c, 'fechaNac')).replace(/ \d{4}$/, '')}
            onClick={() => ctx.abrir('clientes', c.id)} />)}
        </div>
      ) : <Vacio>Nadie cumple años este mes.</Vacio>}
      <h3 className="seccion">Clientes por estado comercial</h3>
      <div className="tarjeta"><Barras datos={[...porEstado.entries()].sort((a, b) => b[1] - a[1]).map(([e, n]) => [etq(e), n])} /></div>
      <h3 className="seccion">Clientes nuevos por mes ({anio})</h3>
      <div className="tarjeta"><Barras datos={MESES.map((m, i) => [m, nuevos[i]])} /></div>
    </>
  );
}

function Aseguradoras({ ctx }: { ctx: Ctx }) {
  const filas = useMemo(() => {
    const m = new Map<string, { n: number; prima: number; com: number; vig: number; ven: number }>();
    for (const p of ctx.cartera.polizas) {
      const a = txt(p, 'aseg') || 'Otra';
      if (!m.has(a)) m.set(a, { n: 0, prima: 0, com: 0, vig: 0, ven: 0 });
      const x = m.get(a)!;
      x.n++; x.prima += prima(p); x.com += comision(p);
      if (txt(p, 'estado') === 'Vigente') x.vig++; else if (txt(p, 'estado') === 'Vencida') x.ven++;
    }
    return [...m.entries()].sort((a, b) => b[1].prima - a[1].prima);
  }, [ctx.cartera.polizas]);
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead><tr><th>Aseguradora</th><th>Pól.</th><th>Prima</th><th>Comisión</th><th>Vig.</th><th>Venc.</th></tr></thead>
        <tbody>
          {filas.map(([a, x]) => (
            <tr key={a}><td><b>{a}</b></td><td>{x.n}</td><td>{dinero(x.prima)}</td><td className="verde-t">{dinero(x.com)}</td><td className="verde-t">{x.vig}</td><td className="rojo-t">{x.ven}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
