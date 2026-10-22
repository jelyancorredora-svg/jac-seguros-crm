import { useDeferredValue, useMemo, useState } from 'react';
import { Vacio } from '../../components/Piezas';
import { dinero, fecha, hoyISO } from '../../lib/formato';
import {
  actividad, COLS, CONTEOS, csvReporte, datosReporte, opcionesCampo, pctTotal, PESTANAS_REP, SIN_FILTROS, totalesReporte,
  type FiltrosRep, type TipoRep,
} from '../../lib/reportes';
import type { Ctx } from '../Modulos';

/* Replica de "📊 Reportes" del CRM web (pg-rep, version con filtros, totales y pestaña Por ramo) */

const MAX_FILAS = 600;
const NOMBRE: Record<TipoRep, string> = { pol: 'pólizas', pag: 'cobros', cli: 'clientes', com: 'líneas', res: 'líneas' };

function descargar(nombre: string, contenido: string) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function celda(k: string, v: string | number | undefined, numerica: boolean): string {
  if (!numerica) return v === undefined || v === '' ? '—' : String(v);
  const x = Number(v) || 0;
  if (k === 'pct') return x ? `${x}%` : '—';
  if (k === 'dias') return x > 0 ? `${x}d` : x < 0 ? `en ${-x}d` : 'hoy';
  if (CONTEOS.includes(k)) return String(x);
  return dinero(x);
}

function claseCelda(k: string, v: string | number | undefined): string {
  const x = Number(v) || 0;
  if (k === 'saldo' && x > 0) return 'rep-saldo';
  if (k === 'com' && x > 0) return 'rep-com';
  if (k === 'cc' && v && v !== '—') return 'rep-cc';
  if (k === 'est') return String(v) === 'Vigente' ? 'rep-vig' : String(v) === 'Vencida' ? 'rep-ven' : 'rep-otro';
  if (k === 'dias' && x > 90) return 'rep-atraso';
  return '';
}

export function Reportes({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const [tipo, setTipo] = useState<TipoRep>('pol');
  const [fl, setFl] = useState<FiltrosRep>(SIN_FILTROS);
  const q = useDeferredValue(fl.q);
  const filtros = useMemo(() => ({ ...fl, q }), [fl, q]);
  const filas = useMemo(
    () => datosReporte(tipo, { polizas: cartera.polizas, clientes: cartera.clientes, pagos: cartera.pagos }, filtros),
    [tipo, cartera.polizas, cartera.clientes, cartera.pagos, filtros],
  );
  const tot = useMemo(() => totalesReporte(tipo, filas), [tipo, filas]);
  const ops = useMemo(() => ({
    aseg: opcionesCampo(cartera.polizas, 'aseg'), ramo: opcionesCampo(cartera.polizas, 'ramo'), estado: opcionesCampo(cartera.polizas, 'estado'),
  }), [cartera.polizas]);
  const cols = COLS[tipo];
  const filtrado = !!(fl.q || fl.aseg || fl.ramo || fl.estado);
  const poner = (k: keyof FiltrosRep, v: string) => setFl((f) => ({ ...f, [k]: v }));
  const titulo = PESTANAS_REP.find(([k]) => k === tipo)?.[1] ?? '';

  return (
    <div className="rep">
      <div className="ag-tabs no-imprimir">
        {PESTANAS_REP.map(([k, t]) => <button key={k} type="button" className={tipo === k ? 'activa' : ''} onClick={() => setTipo(k)}>{t}</button>)}
      </div>
      <div className="botonera fila-botones no-imprimir">
        <button className="boton rep-excel" type="button" disabled={!filas.length}
          onClick={() => descargar(`reporte_crm_${tipo}_${hoyISO()}.csv`, csvReporte(tipo, filas))}>⬇ Excel/CSV</button>
        <button className="boton rep-pdf" type="button" onClick={() => window.print()}>🖨 PDF</button>
      </div>

      <div className="rep-filtros no-imprimir">
        <input className="buscador" type="search" placeholder="Buscar póliza, cliente, cédula…" value={fl.q}
          onChange={(e) => poner('q', e.target.value)} maxLength={80} autoCapitalize="none" spellCheck={false} />
        <div className="rep-selects">
          <label className="campo"><span>Compañía</span>
            <select value={fl.aseg} onChange={(e) => poner('aseg', e.target.value)}>
              <option value="">Todas</option>{ops.aseg.map((x) => <option key={x}>{x}</option>)}
            </select></label>
          <label className="campo"><span>Ramo</span>
            <select value={fl.ramo} onChange={(e) => poner('ramo', e.target.value)}>
              <option value="">Todas</option>{ops.ramo.map((x) => <option key={x}>{x}</option>)}
            </select></label>
          <label className="campo"><span>Estado</span>
            <select value={fl.estado} onChange={(e) => poner('estado', e.target.value)}>
              <option value="">Todas</option>{ops.estado.map((x) => <option key={x}>{x}</option>)}
            </select></label>
        </div>
        {filtrado && <button className="boton secundario rep-quitar" type="button" onClick={() => setFl(SIN_FILTROS)}>Quitar filtros</button>}
      </div>

      <h2 className="solo-imprimir">Reporte JAC Seguros · {titulo} · {fecha(hoyISO())}</h2>
      <p className="contador rep-resumen">
        <b>{filas.length}</b> {NOMBRE[tipo]}{filtrado ? ' (filtrado)' : ''}
        {tot.prima !== undefined && <> · prima {dinero(tot.prima)}</>}
        {tot.com !== undefined && <> · comisión <b className="verde-t">{dinero(tot.com)}</b></>}
        {tot.monto !== undefined && <> · {dinero(tot.monto)}</>}
      </p>

      {filas.length ? (
        <div className="tabla-scroll rep-marco">
          <table className="tabla rep-tabla">
            <thead>
              <tr>{cols.map(([t, , n]) => <th key={t} className={n ? 'rep-n' : ''}>{t}</th>)}</tr>
            </thead>
            <tbody>
              {filas.slice(0, MAX_FILAS).map((r, i) => (
                <tr key={i}>
                  {cols.map(([t, k, n]) => <td key={t} className={`${n ? 'rep-n ' : ''}${claseCelda(k, r[k])}`}>{celda(k, r[k], !!n)}</td>)}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                {cols.map(([t, k, n], i) => {
                  if (i === 0) return <td key={t}>TOTAL ({filas.length})</td>;
                  if (!n) return <td key={t} />;
                  const v = tot[k] ?? 0;
                  const txt = k === 'pct' ? (pctTotal(tot) === null ? '—' : `${pctTotal(tot)}%`)
                    : CONTEOS.includes(k) ? String(Math.round(v)) : dinero(v);
                  return <td key={t} className="rep-n">{txt}</td>;
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      ) : <Vacio>Sin datos para este reporte.</Vacio>}
      {filas.length > MAX_FILAS && (
        <p className="contador">Se muestran {MAX_FILAS} de {filas.length} para que la página no se atasque. El Excel se los lleva todos.</p>
      )}
    </div>
  );
}

/** pg-hist del CRM web: historial de actividad de un cliente o de una póliza */
export function HistorialActividad({ ctx, tipo, id }: { ctx: Ctx; tipo: 'pol' | 'cli'; id: string }) {
  const c = ctx.cartera;
  const items = useMemo(
    () => actividad(tipo, id, { polizas: c.polizas, clientes: c.clientes, pagos: c.pagos, tareas: c.tareas }, dinero),
    [tipo, id, c.polizas, c.clientes, c.pagos, c.tareas],
  );
  if (!items.length) return <Vacio>Sin actividad registrada</Vacio>;
  return (
    <div className="rep-hist">
      {items.map((it, i) => (
        <div key={i} className={`rep-hist-item rep-h-${it.tipo}`}>
          <div className="rep-hist-icono">{it.icono}</div>
          <div>
            <div className="rep-hist-desc">{it.desc}</div>
            {it.sub && <div className="rep-hist-sub">{it.sub}</div>}
            <div className="rep-hist-fecha">{it.fecha ? fecha(it.fecha.slice(0, 10)) : 'Sin fecha'}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
