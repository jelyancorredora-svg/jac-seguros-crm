import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Fila, Hoja, Vacio } from '../../components/Piezas';
import { ListaLarga } from '../../components/Registro';
import {
  actualizarCon, eliminarRegistro, ErrorDatos, guardarMeta, guardarRegistro, txt, type Reg,
} from '../../lib/datos';
import {
  aCorreo, agenciasCfg, aplicarEdiciones, aseguradorasCfg, asegsFormulario, cfgNormal, colorDias, comisionesDesdeTareas,
  crearOrigen, csvComisiones, fmtWeb, kpis, mesEtiqueta, msgComision, n, nombreCorto, ponerTasa, porAseguradora, porPoliza,
  quitarTasa, RAMOS_CFG, RAMOS_TASA, resumenTramos, SEP, SSRP, tasaDe, textoDias, TRAMOS, validarTramos, vistaCobro,
  type ClaveTramo, type ComisCfg, type Edicion, type GrupoCfg, type Origen, type Tasa,
} from '../../lib/comisiones';
import { dinero, enlaceCorreo, enlaceWhatsApp, esCorreo, fecha, hoyISO } from '../../lib/formato';
import type { Ctx } from '../Modulos';

/*
 * Replica del modulo "💰 Comisiones" del CRM web (pagina pg-com, render
 * window.renderCom del bloque "Comisiones y Pagos, cada uno en su sitio"):
 * KPIs, pestañas Por cobrar / Cobradas / Por póliza / Por aseguradora,
 * antigüedad a 30/60/90 días, cobrar en lote, registrar / editar / eliminar,
 * comisiones que aún viven en Tareas, y exportar. Se agrega la pestaña de
 * tasas (S.comRates) y la configuración de % (S.comisCfg) que el web tiene en
 * la página vieja de Comisiones y en Configuración.
 */

type Vista = 'cobrar' | 'cobradas' | 'pol' | 'aseg' | 'cfg';
const VISTAS: Array<[Vista, string]> = [
  ['cobrar', '⏳ Por cobrar'], ['cobradas', '✅ Cobradas'], ['pol', '📋 Por póliza'], ['aseg', '🏛 Por aseguradora'], ['cfg', '⚙️ Tasas y %'],
];

const msgError = (e: unknown, def: string) => (e instanceof ErrorDatos ? e.message : def);

function Pestanas<T extends string>({ opciones, valor, cambiar }: { opciones: Array<[T, string]>; valor: T; cambiar: (v: T) => void }) {
  return (
    <div className="filtros">
      {opciones.map(([k, t]) => (
        <button key={k} type="button" className={valor === k ? 'activa' : ''} onClick={() => cambiar(k)}>{t}</button>
      ))}
    </div>
  );
}

type HojaAbierta =
  | { t: 'nueva' }
  | { t: 'editar'; c: Reg }
  | { t: 'eliminar'; c: Reg }
  | { t: 'lote'; k: ClaveTramo }
  | { t: 'tareas' }
  | null;

export function ComisionesWeb({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const [vista, setVista] = useState<Vista>('cobrar');
  const [tramo, setTramo] = useState<ClaveTramo | ''>('');
  const [hoja, setHoja] = useState<HojaAbierta>(null);
  const [ocupado, setOcupado] = useState('');
  const [imprimir, setImprimir] = useState(false);
  const hoy = hoyISO();

  const origen = useMemo(() => crearOrigen<Reg, Reg>(cartera.polizas, cartera.clientes), [cartera.polizas, cartera.clientes]);
  const k = useMemo(() => kpis(cartera.polizas, cartera.comisiones, hoy), [cartera.polizas, cartera.comisiones, hoy]);
  const deTareas = useMemo(() => cartera.comisiones.filter((c) => c._origen === 'recordatorio de tarea').length, [cartera.comisiones]);

  useEffect(() => {
    if (!imprimir) return;
    const t = setTimeout(() => { window.print(); setImprimir(false); }, 60);
    return () => clearTimeout(t);
  }, [imprimir]);

  function cambiarVista(v: Vista) { setVista(v); setTramo(''); }

  async function marcar(c: Reg, cobrar: boolean) {
    setOcupado(c.id);
    try {
      const r = await actualizarCon('comisiones', c.id, () => (cobrar
        ? { estado: 'cobrada', fechaCobro: hoyISO() }
        : { estado: 'pendiente', fechaCobro: undefined }));
      ctx.poner('comisiones', r);
      ctx.avisar(cobrar ? '✓ Comisión cobrada' : 'Vuelve a por cobrar');
    } catch (e) {
      ctx.avisar(msgError(e, 'No se pudo guardar.'));
    }
    setOcupado('');
  }

  function exportar() {
    const csv = csvComisiones(cartera.polizas, cartera.clientes, cartera.comisiones);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `JAC_Comisiones_${hoy}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    ctx.avisar('✅ Excel descargado');
  }

  return (
    <div className="comw">
      <div className="no-imprimir">
        {deTareas > 0 && (
          <div className="nota">ℹ️ <b>{deTareas}</b> comisiones se rescataron del módulo de Tareas, donde vivían como recordatorios sueltos. Aquí tienen sus datos completos.</div>
        )}
        <div className="botonera fila-botones">
          <button className="boton secundario" type="button" onClick={exportar}>📥 Excel</button>
          <button className="boton secundario" type="button" onClick={() => setImprimir(true)}>📄 PDF</button>
        </div>

        <div className="kpis comw-kpis">
          <div className="kpi"><span>Mi comisión de cartera</span><b className="kpi-dinero">{dinero(k.carteraAnual)}</b><small>{k.nPolizas} pólizas activas</small></div>
          <div className="kpi"><span>Por cobrar</span><b className="kpi-dinero comw-ambar">{dinero(k.tPend)}</b><small>{k.nPend} registros</small></div>
          <div className="kpi"><span>Cobradas</span><b className="kpi-dinero verde-t">{dinero(k.tCob)}</b><small>{k.nCob} registros</small></div>
          <div className="kpi"><span>Cobrado este mes</span><b className="kpi-dinero comw-morado">{dinero(k.tMes)}</b></div>
        </div>

        <Pestanas opciones={VISTAS} valor={vista} cambiar={cambiarVista} />

        {(vista === 'cobrar' || vista === 'cobradas') && (
          <VistaCobro ctx={ctx} vista={vista} tramo={tramo} setTramo={setTramo} origen={origen} ocupado={ocupado}
            marcar={marcar} setHoja={setHoja} />
        )}
        {vista === 'pol' && <VistaPoliza ctx={ctx} />}
        {vista === 'aseg' && <VistaAseg ctx={ctx} />}
        {vista === 'cfg' && <Configuracion ctx={ctx} />}

        {vista !== 'cfg' && (
          <div className="botonera comw-pie">
            <button className="boton" type="button" onClick={() => setHoja({ t: 'nueva' })}>+ Registrar comisión</button>
            <button className="boton secundario" type="button" onClick={() => setHoja({ t: 'tareas' })}>🔎 Comisiones que aún están en Tareas</button>
          </div>
        )}
      </div>

      {imprimir && <Reporte ctx={ctx} />}

      {(hoja?.t === 'nueva' || hoja?.t === 'editar') && (
        <FormComision ctx={ctx} c={hoja.t === 'editar' ? hoja.c : null} onCerrar={() => setHoja(null)} />
      )}
      {hoja?.t === 'eliminar' && <EliminarComision ctx={ctx} c={hoja.c} onCerrar={() => setHoja(null)} />}
      {hoja?.t === 'lote' && <CobrarLote ctx={ctx} k={hoja.k} onCerrar={() => setHoja(null)} />}
      {hoja?.t === 'tareas' && <DesdeTareas ctx={ctx} origen={origen} onCerrar={() => setHoja(null)} />}
    </div>
  );
}

/* ====================== por cobrar / cobradas ====================== */

function VistaCobro({ ctx, vista, tramo, setTramo, origen, ocupado, marcar, setHoja }: {
  ctx: Ctx; vista: 'cobrar' | 'cobradas'; tramo: ClaveTramo | ''; setTramo: (k: ClaveTramo | '') => void;
  origen: (r: Reg) => Origen<Reg, Reg>; ocupado: string; marcar: (c: Reg, cobrar: boolean) => void; setHoja: (h: HojaAbierta) => void;
}) {
  const hoy = hoyISO();
  const { grupos, lista } = useMemo(() => vistaCobro(ctx.cartera.comisiones, vista, tramo, hoy), [ctx.cartera.comisiones, vista, tramo, hoy]);
  return (
    <>
      <div className="comw-tramos">
        {TRAMOS.map((t) => {
          const g = grupos[t.k];
          const on = tramo === t.k;
          return (
            <button key={t.k} type="button" className={`comw-tramo${on ? ' activa' : ''}`} aria-pressed={on}
              style={{ borderColor: on ? t.col : undefined, boxShadow: on ? `0 0 0 2px ${t.col}33` : undefined }}
              onClick={() => setTramo(on ? '' : t.k)}>
              <span style={{ color: t.col }}>{t.et}</span>
              <b>{dinero(g.total)}</b>
              <small>{g.filas.length} registro{g.filas.length === 1 ? '' : 's'}</small>
            </button>
          );
        })}
      </div>
      {vista === 'cobrar' && tramo && (
        <div className="comw-lote">
          <button className="boton comw-verde" type="button" onClick={() => setHoja({ t: 'lote', k: tramo })}>✅ Marcar todo el tramo como cobrado</button>
          <span>{lista.length} registros seleccionados</span>
        </div>
      )}
      <ListaLarga items={lista} vacio={vista === 'cobrar' ? 'Nada por cobrar ✓' : 'Todavía no hay comisiones cobradas'}
        render={(x) => (
          <FilaComision key={x.r.id} ctx={ctx} c={x.r} dias={x.dias} o={origen(x.r)} ocupado={ocupado === x.r.id}
            marcar={marcar} editar={() => setHoja({ t: 'editar', c: x.r })} eliminar={() => setHoja({ t: 'eliminar', c: x.r })} />
        )} />
    </>
  );
}

function FilaComision({ ctx, c, dias, o, ocupado, marcar, editar, eliminar }: {
  ctx: Ctx; c: Reg; dias: number | null; o: Origen<Reg, Reg>; ocupado: boolean;
  marcar: (c: Reg, cobrar: boolean) => void; editar: () => void; eliminar: () => void;
}) {
  const cob = c.estado === 'cobrada';
  const fechaTxt = txt(c, 'fecha') ? fmtWeb(txt(c, 'fecha')) : txt(c, 'mes') || '—';
  const pct = n(c.pct);
  let wa: string | null = null;
  let mail: string | null = null;
  if (o.cli) {
    const tel = txt(o.cli, 'cel') || txt(o.cli, 'tel');
    const base = enlaceWhatsApp(tel);
    if (base) wa = `${base}?text=${encodeURIComponent(msgComision(c, o))}`;
    const em = txt(o.cli, 'email');
    if (em && esCorreo(em)) {
      mail = `${enlaceCorreo(em)}?subject=${encodeURIComponent('Confirmación de su póliza — JAC Seguros')}&body=${encodeURIComponent(aCorreo(msgComision(c, o)))}`;
    }
  }
  const partes: ReactNode[] = [];
  if (o.pol) {
    partes.push(<button key="p" type="button" className="comw-enlace" onClick={() => ctx.abrir('polizas', o.pol!.id)}>N° <b>{txt(o.pol, 'num') || '—'}</b></button>);
  }
  if (o.cliNombre) {
    partes.push(o.cli
      ? <button key="c" type="button" className="comw-enlace" onClick={() => ctx.abrir('clientes', o.cli!.id)}>{nombreCorto(o.cliNombre)}</button>
      : <span key="c">{nombreCorto(o.cliNombre)}</span>);
  }
  if (o.pol && txt(o.pol, 'ramo')) partes.push(<span key="r">{txt(o.pol, 'ramo')}</span>);
  return (
    <div className={`comw-item${cob ? ' cobrada' : ''}`}>
      <button type="button" className="comw-item-cuerpo" onClick={() => ctx.abrir('comisiones', c.id)}>
        <div className="comw-item-top">
          <b>{txt(c, 'aseg') || '—'}</b>
          <span className={cob ? 'verde-t' : 'comw-ambar'}>{dinero(n(c.monto))}</span>
        </div>
        <div className="fila-sub">
          {fechaTxt} · <b style={{ color: colorDias(dias) }}>{textoDias(dias)}</b>{pct ? ` · ${pct}%` : ''}
        </div>
      </button>
      <div className="comw-origen">
        {partes.length ? partes.flatMap((p, i) => (i ? [<span key={`s${i}`}> · </span>, p] : [p])) : <span className="comw-gris">sin póliza vinculada</span>}
      </div>
      <div className="comw-acciones">
        {cob ? (
          <button type="button" className="mini" disabled={ocupado} onClick={() => marcar(c, false)} aria-label="Volver a por cobrar">↶ Por cobrar</button>
        ) : (
          <button type="button" className="mini verde" disabled={ocupado} onClick={() => marcar(c, true)}>✅ Cobrada</button>
        )}
        {wa && <a className="icono-accion comw-wa" href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp al cliente">💬</a>}
        {mail && <a className="icono-accion" href={mail} aria-label="Correo al cliente">📧</a>}
        <button className="icono-accion" type="button" onClick={editar} aria-label="Editar comisión">✏️</button>
        <button className="icono-accion rojo" type="button" onClick={eliminar} aria-label="Eliminar comisión">🗑️</button>
      </div>
    </div>
  );
}

/* ====================== por póliza / por aseguradora ====================== */

function VistaPoliza({ ctx }: { ctx: Ctx }) {
  const r = useMemo(() => porPoliza(ctx.cartera.polizas, ctx.cartera.clientes), [ctx.cartera.polizas, ctx.cartera.clientes]);
  return (
    <>
      <div className="tarjeta comw-total">
        <span>TOTAL {r.filas.length} PÓLIZAS ACTIVAS</span>
        <div><small>Prima</small> <b>{dinero(r.tPrima)}</b></div>
        <div><small>Mi comisión</small> <b className="verde-t">{dinero(r.tCom)}</b></div>
      </div>
      <ListaLarga items={r.filas} vacio="Sin pólizas activas." render={(x) => (
        <Fila key={x.p.id} titulo={nombreCorto(x.nom)}
          sub={<span className="comw-envuelve">{`${txt(x.p, 'num') || '—'} · ${txt(x.p, 'aseg') || '—'} · ${txt(x.p, 'ramo') || '—'}`}<br />{`Prima ${dinero(x.prima)} · % com. ${x.pct ? x.pct + '%' : '—'} · Part. ${x.part}%`}</span>}
          derecha={<b className="verde-t comw-der">{dinero(x.com)}</b>}
          onClick={() => ctx.abrir('polizas', x.p.id)} />
      )} />
    </>
  );
}

function VistaAseg({ ctx }: { ctx: Ctx }) {
  const filas = useMemo(() => porAseguradora(ctx.cartera.polizas), [ctx.cartera.polizas]);
  if (!filas.length) return <Vacio>Sin pólizas activas.</Vacio>;
  return (
    <div className="tabla-scroll">
      <table className="tabla">
        <thead><tr><th>Aseguradora</th><th>Pólizas</th><th>Prima</th><th>Mi comisión</th><th>% efectivo</th></tr></thead>
        <tbody>
          {filas.map((a) => (
            <tr key={a.aseg}>
              <td><b>{a.aseg}</b></td><td>{a.n}</td><td>{dinero(a.prima)}</td>
              <td className="verde-t"><b>{dinero(a.com)}</b></td><td>{a.pctEfectivo.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ====================== registrar / editar (OCom / editCom / SCom) ====================== */

function FormComision({ ctx, c, onCerrar }: { ctx: Ctx; c: Reg | null; onCerrar: () => void }) {
  const asegs = useMemo(() => {
    const l = asegsFormulario(ctx.cartera.meta.aseguradoras);
    const actual = c ? txt(c, 'aseg') : '';
    return actual && !l.includes(actual) ? [actual, ...l] : l;
  }, [ctx.cartera.meta.aseguradoras, c]);
  const [v, setV] = useState(() => ({
    aseg: c ? txt(c, 'aseg') : asegs[0],
    ramo: c ? txt(c, 'ramo') : '',
    fecha: c ? txt(c, 'fecha').slice(0, 10) : '',
    pct: c && c.pct !== null && c.pct !== undefined ? String(c.pct) : '',
    monto: c && c.monto !== null && c.monto !== undefined ? String(c.monto) : '',
    estado: c ? txt(c, 'estado') || 'pendiente' : 'pendiente',
  }));
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  /* comAutoRate: al elegir aseguradora o ramo se pone la tasa configurada */
  function cambiar(campo: 'aseg' | 'ramo', valor: string) {
    const nv = { ...v, [campo]: valor };
    const pct = tasaDe(ctx.cartera.meta.comRates as Tasa[], nv.aseg, nv.ramo);
    if (pct !== null) nv.pct = String(pct);
    setV(nv);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const monto = parseFloat(v.monto.replace(',', '.'));
    if (!v.aseg || !monto) return setError('Aseguradora y monto obligatorios');
    const pct = parseFloat(v.pct.replace(',', '.')) || null;
    const cambios = { aseg: v.aseg, fecha: v.fecha, mes: v.fecha ? mesEtiqueta(v.fecha) : '', ramo: v.ramo || '', pct, monto, estado: v.estado };
    setOcupado(true);
    setError('');
    try {
      const r = await guardarRegistro('comisiones', c?.id ?? null, cambios);
      ctx.poner('comisiones', r);
      ctx.avisar(c ? '✓ Actualizada' : '✓ Registrada');
      onCerrar();
    } catch (err) {
      setError(msgError(err, 'No se pudo guardar.'));
      setOcupado(false);
    }
  }

  const ramos = v.ramo && !RAMOS_TASA.includes(v.ramo) ? [v.ramo, ...RAMOS_TASA] : RAMOS_TASA;
  return (
    <Hoja titulo={c ? 'Editar comisión' : 'Registrar comisión'} onCerrar={onCerrar}>
      <form onSubmit={guardar} noValidate>
        <label className="campo"><span>Aseguradora *</span>
          <select value={v.aseg} onChange={(e) => cambiar('aseg', e.target.value)}>
            {asegs.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="campo"><span>Ramo / Producto</span>
          <select value={v.ramo} onChange={(e) => cambiar('ramo', e.target.value)}>
            <option value="">—</option>
            {ramos.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="campo"><span>Fecha de registro</span>
          <input type="date" value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} />
        </label>
        <div className="dos">
          <label className="campo"><span>% Comisión</span>
            <input inputMode="decimal" value={v.pct} onChange={(e) => setV({ ...v, pct: e.target.value })} maxLength={12} />
          </label>
          <label className="campo"><span>Monto ($) *</span>
            <input inputMode="decimal" value={v.monto} onChange={(e) => setV({ ...v, monto: e.target.value })} maxLength={14} />
          </label>
        </div>
        <label className="campo"><span>Estado</span>
          <select value={v.estado} onChange={(e) => setV({ ...v, estado: e.target.value })}>
            <option value="pendiente">Pendiente</option>
            <option value="cobrada">Cobrada</option>
          </select>
        </label>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="botonera">
          <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : c ? '💾 Actualizar' : '💾 Guardar'}</button>
          <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
        </div>
      </form>
    </Hoja>
  );
}

function EliminarComision({ ctx, c, onCerrar }: { ctx: Ctx; c: Reg; onCerrar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  async function eliminar() {
    setOcupado(true);
    try {
      await eliminarRegistro('comisiones', c.id);
      ctx.quitar('comisiones', c.id);
      ctx.avisar('Eliminada');
      onCerrar();
    } catch (e) {
      setError(msgError(e, 'No se pudo eliminar.'));
      setOcupado(false);
    }
  }
  return (
    <Hoja titulo="¿Eliminar esta comisión?" onCerrar={onCerrar}>
      <p className="texto-largo"><b>{txt(c, 'aseg') || '—'} · {dinero(n(c.monto))}</b>{txt(c, 'fecha') ? ` · ${fmtWeb(txt(c, 'fecha'))}` : ''}</p>
      <p className="texto-largo">Se elimina en la app, en el CRM web y en todos tus dispositivos. No se puede deshacer.</p>
      {error && <p className="error">{error}</p>}
      <div className="botonera">
        <button className="boton peligro" type="button" onClick={eliminar} disabled={ocupado}>{ocupado ? 'Eliminando…' : '🗑️ Sí, eliminar'}</button>
        <button className="boton secundario" type="button" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
      </div>
    </Hoja>
  );
}

/* ====================== cobrar un tramo entero (jacComCobrarTramo) ====================== */

function CobrarLote({ ctx, k, onCerrar }: { ctx: Ctx; k: ClaveTramo; onCerrar: () => void }) {
  const hoy = hoyISO();
  const { grupos } = useMemo(() => vistaCobro(ctx.cartera.comisiones, 'cobrar', '', hoy), [ctx.cartera.comisiones, hoy]);
  const lote = grupos[k].filas.map((x) => x.r);
  const t = TRAMOS.find((x) => x.k === k)!;
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  async function hacer() {
    setOcupado(true);
    let hechas = 0;
    for (const c of lote) {
      try {
        ctx.poner('comisiones', await actualizarCon('comisiones', c.id, () => ({ estado: 'cobrada', fechaCobro: hoyISO() })));
        hechas++;
      } catch (e) {
        setError(msgError(e, 'No se pudo guardar.'));
      }
    }
    ctx.avisar(`✓ ${hechas} comisiones cobradas`);
    if (hechas === lote.length) onCerrar();
    else setOcupado(false);
  }
  if (!lote.length) {
    return (
      <Hoja titulo="Cobrar tramo" onCerrar={onCerrar}>
        <p className="texto-largo">Ese tramo está vacío</p>
        <div className="botonera"><button className="boton secundario" type="button" onClick={onCerrar}>Cerrar</button></div>
      </Hoja>
    );
  }
  return (
    <Hoja titulo="Marcar tramo como cobrado" onCerrar={onCerrar}>
      <p className="texto-largo">¿Marcar como cobradas las {lote.length} comisiones de {t.et} ({dinero(grupos[k].total)})?</p>
      {error && <p className="error">{error}</p>}
      <div className="botonera">
        <button className="boton comw-verde" type="button" onClick={hacer} disabled={ocupado}>{ocupado ? 'Guardando…' : '✅ Sí, marcar cobradas'}</button>
        <button className="boton secundario" type="button" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
      </div>
    </Hoja>
  );
}

/* ====================== comisiones que aún están en Tareas ====================== */

function DesdeTareas({ ctx, origen, onCerrar }: { ctx: Ctx; origen: (r: Reg) => Origen<Reg, Reg>; onCerrar: () => void }) {
  const r = useMemo(() => comisionesDesdeTareas(ctx.cartera.tareas, ctx.cartera.comisiones, origen, hoyISO()),
    [ctx.cartera.tareas, ctx.cartera.comisiones, origen]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  async function pasar() {
    setOcupado(true);
    let creadas = 0;
    let quitadas = 0;
    for (const nueva of r.nuevas) {
      try {
        ctx.poner('comisiones', await guardarRegistro('comisiones', null, nueva));
        creadas++;
        const tid = String(nueva._tareaId);
        await eliminarRegistro('tareas', tid);
        ctx.quitar('tareas', tid);
        quitadas++;
      } catch (e) {
        setError(msgError(e, 'No se pudo completar.'));
      }
    }
    ctx.avisar(`✓ ${creadas} comisiones creadas · ${quitadas} tareas retiradas`);
    onCerrar();
  }
  return (
    <Hoja titulo="Comisiones dentro de Tareas" onCerrar={onCerrar}>
      <p className="texto-largo"><b>Comisiones que todavía viven como tareas: {r.candidatas}</b></p>
      <p className="fila-sub comw-envuelve">Convertibles a comisión: <b>{r.convertibles}</b> · sin monto legible: <b>{r.candidatas - r.convertibles}</b></p>
      {r.muestra.length > 0 && (
        <div className="lista comw-muestra">
          {r.muestra.map((m, i) => (
            <div key={i} className="comw-muestra-fila">{m.tit} — <b>{dinero(m.monto)}</b> · {m.aseg || 'sin aseguradora'} · {m.origen}</div>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      <div className="botonera">
        <button className="boton" type="button" onClick={pasar} disabled={ocupado || !r.nuevas.length}>
          {ocupado ? 'Pasando…' : 'Pasarlas al módulo de Comisiones'}
        </button>
        <button className="boton secundario" type="button" onClick={onCerrar} disabled={ocupado}>Cerrar</button>
      </div>
    </Hoja>
  );
}

/* ====================== tasas (comRates) y % (comisCfg) ====================== */

function Configuracion({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <Tasas ctx={ctx} />
      <ConfigPct ctx={ctx} />
    </>
  );
}

function Tasas({ ctx }: { ctx: Ctx }) {
  const rates = ctx.cartera.meta.comRates as Tasa[];
  const asegs = useMemo(() => asegsFormulario(ctx.cartera.meta.aseguradoras), [ctx.cartera.meta.aseguradoras]);
  const [f, setF] = useState({ aseg: '', ramo: '', pct: '' });
  const [editando, setEditando] = useState<Tasa | null>(null);
  const [borrar, setBorrar] = useState<Tasa | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function guardar() {
    const pct = parseFloat(f.pct.replace(',', '.'));
    if (!f.aseg || !pct) return ctx.avisar('Aseguradora y % son obligatorios');
    setOcupado(true);
    try {
      const v = await guardarMeta<Tasa[]>('comRates', [], (a) => {
        let x = Array.isArray(a) ? a : [];
        if (editando && ((editando.aseg ?? '') !== f.aseg || (editando.ramo ?? '') !== f.ramo)) {
          x = quitarTasa(x, editando.aseg ?? '', editando.ramo ?? '');
        }
        return ponerTasa(x, f.aseg, f.ramo, pct);
      });
      ctx.ponerMeta('comRates', v);
      ctx.avisar('✓ Tasa guardada');
      setF({ aseg: '', ramo: '', pct: '' });
      setEditando(null);
    } catch (e) {
      ctx.avisar(msgError(e, 'No se pudo guardar.'));
    }
    setOcupado(false);
  }

  async function eliminar(t: Tasa) {
    setOcupado(true);
    try {
      const v = await guardarMeta<Tasa[]>('comRates', [], (a) => quitarTasa(Array.isArray(a) ? a : [], t.aseg ?? '', t.ramo ?? ''));
      ctx.ponerMeta('comRates', v);
      ctx.avisar('Tasa eliminada');
      setBorrar(null);
    } catch (e) {
      ctx.avisar(msgError(e, 'No se pudo eliminar.'));
    }
    setOcupado(false);
  }

  const asegOpc = f.aseg && !asegs.includes(f.aseg) ? [f.aseg, ...asegs] : asegs;
  const ramoOpc = f.ramo && !RAMOS_TASA.includes(f.ramo) ? [f.ramo, ...RAMOS_TASA] : RAMOS_TASA;
  return (
    <>
      <h3 className="seccion">⚙️ Tasas de Comisión por Aseguradora/Ramo</h3>
      <div className="tarjeta">
        <label className="campo"><span>Aseguradora</span>
          <select value={f.aseg} onChange={(e) => setF({ ...f, aseg: e.target.value })}>
            <option value="">— Seleccionar —</option>
            {asegOpc.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <div className="dos">
          <label className="campo"><span>Ramo (opcional)</span>
            <select value={f.ramo} onChange={(e) => setF({ ...f, ramo: e.target.value })}>
              <option value="">Todos los ramos</option>
              {ramoOpc.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="campo"><span>% Comisión</span>
            <input inputMode="decimal" placeholder="15" value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} maxLength={8} />
          </label>
        </div>
        <div className="botonera">
          <button className="boton" type="button" onClick={guardar} disabled={ocupado}>💾 Guardar Tasa</button>
          {editando && <button className="boton secundario" type="button" onClick={() => { setEditando(null); setF({ aseg: '', ramo: '', pct: '' }); }}>Cancelar edición</button>}
        </div>
      </div>
      {rates.length ? (
        <div className="lista">
          {rates.map((t, i) => (
            <Fila key={`${t.aseg}|${t.ramo}|${i}`} titulo={t.aseg || '—'} sub={t.ramo || 'Todos'}
              derecha={<b className="comw-azul">{t.pct}%</b>}
              onClick={() => { setEditando(t); setF({ aseg: t.aseg ?? '', ramo: t.ramo ?? '', pct: String(t.pct ?? '') }); }}
              acciones={(
                <>
                  <button className="icono-accion" type="button" aria-label={`Editar tasa ${t.aseg}`}
                    onClick={() => { setEditando(t); setF({ aseg: t.aseg ?? '', ramo: t.ramo ?? '', pct: String(t.pct ?? '') }); }}>✏️</button>
                  <button className="icono-accion rojo" type="button" aria-label={`Eliminar tasa ${t.aseg}`} onClick={() => setBorrar(t)}>🗑️</button>
                </>
              )} />
          ))}
        </div>
      ) : <Vacio>Sin tasas configuradas</Vacio>}
      {borrar && (
        <Hoja titulo="¿Eliminar tasa?" onCerrar={() => setBorrar(null)}>
          <p className="texto-largo"><b>{borrar.aseg} · {borrar.ramo || 'Todos'} · {borrar.pct}%</b></p>
          <div className="botonera">
            <button className="boton peligro" type="button" onClick={() => eliminar(borrar)} disabled={ocupado}>🗑️ Sí, eliminar</button>
            <button className="boton secundario" type="button" onClick={() => setBorrar(null)} disabled={ocupado}>Cancelar</button>
          </div>
        </Hoja>
      )}
    </>
  );
}

const TABS_CFG: Array<[GrupoCfg, string]> = [['ramos', 'Por ramo'], ['asegs', 'Por aseguradora'], ['combos', 'Aseguradora + ramo'], ['cocor', 'Co-corretaje']];

function ConfigPct({ ctx }: { ctx: Ctx }) {
  const meta = ctx.cartera.meta;
  const cfg = useMemo(() => cfgNormal(JSON.parse(JSON.stringify(meta.comisCfg ?? {})), meta.ramosCfg), [meta.comisCfg, meta.ramosCfg]);
  const [tab, setTab] = useState<GrupoCfg>('ramos');
  const [ed, setEd] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [guardadoA, setGuardadoA] = useState('');
  const [nc, setNc] = useState({ aseg: '', ramo: '' });
  const [tramos, setTramos] = useState<{ grupo: GrupoCfg; clave: string } | null>(null);
  const [borrarCombo, setBorrarCombo] = useState('');
  const asegs = useMemo(() => aseguradorasCfg(meta.aseguradoras), [meta.aseguradoras]);

  async function escribir(fn: (c: ComisCfg) => ComisCfg): Promise<boolean> {
    setOcupado(true);
    try {
      const v = await guardarMeta<Record<string, unknown>>('comisCfg', {}, (a) => fn(cfgNormal(a, meta.ramosCfg)));
      ctx.ponerMeta('comisCfg', v);
      setOcupado(false);
      return true;
    } catch (e) {
      ctx.avisar(msgError(e, 'No se pudo guardar.'));
      setOcupado(false);
      return false;
    }
  }

  async function guardar(silencioso = false) {
    const ediciones: Edicion[] = Object.entries(ed).map(([key, v]) => {
      const [k, campo] = key.split('\u0000');
      return { k, campo: campo as Edicion['campo'], v };
    });
    if (!ediciones.length) {
      if (!silencioso) ctx.avisar('Porcentajes guardados');
      return true;
    }
    const ok = await escribir((c) => aplicarEdiciones(c, tab, ediciones));
    if (ok) {
      setEd({});
      if (!silencioso) {
        ctx.avisar('Porcentajes guardados');
        setGuardadoA(new Date().toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' }));
      }
    }
    return ok;
  }

  async function cambiarTab(t: GrupoCfg) {
    if (await guardar(true)) { setTab(t); setGuardadoA(''); }
  }

  async function agregarCombo() {
    if (!nc.aseg || !nc.ramo) return ctx.avisar('Elige aseguradora y ramo');
    if (!(await guardar(true))) return;
    const k = nc.aseg + SEP + nc.ramo;
    if (await escribir((c) => { if (!c.combos[k]) c.combos[k] = {}; return c; })) setNc({ aseg: '', ramo: '' });
  }

  async function quitarCombo(k: string) {
    if (await escribir((c) => { delete c.combos[k]; return c; })) {
      setBorrarCombo('');
      setEd((e) => Object.fromEntries(Object.entries(e).filter(([x]) => !x.startsWith(k + '\u0000'))));
    }
  }

  const filas: Array<[string, string]> = tab === 'ramos' ? RAMOS_CFG.map((r) => [r, r])
    : tab === 'asegs' ? asegs.map((a) => [a, a])
      : tab === 'combos' ? Object.keys(cfg.combos).sort().map((k) => [k, k.split(SEP).join(' · ')])
        : agenciasCfg(cfg).map((a) => [a, a]);
  const campos: Array<['com' | 'itbms' | 'part', string]> = tab === 'cocor' ? [['part', '% Participación']] : [['com', '% Comisión'], ['itbms', '% ITBMS']];
  const valor = (k: string, campo: string) => {
    const key = k + '\u0000' + campo;
    if (key in ed) return ed[key];
    const x = cfg[tab][k]?.[campo];
    return x === undefined || x === null ? '' : String(x);
  };

  return (
    <>
      <h3 className="seccion">Comisión, ITBMS y co-corretaje</h3>
      <p className="fila-sub comw-envuelve comw-ayuda">
        Al crear una póliza se busca primero la combinación aseguradora + ramo, luego la aseguradora, luego el ramo. Lo que escribas a mano en la póliza nunca se sobrescribe.
      </p>
      <Pestanas opciones={TABS_CFG} valor={tab} cambiar={(t) => { void cambiarTab(t); }} />
      {filas.length ? (
        <div className="lista">
          {filas.map(([k, et]) => {
            const res = tab === 'cocor' ? '' : resumenTramos(cfg[tab][k]);
            return (
              <div key={k} className="comw-cfg-fila">
                <div className="comw-cfg-et">
                  <b>{et}</b>
                  {res && <small className="comw-morado">{res}</small>}
                </div>
                <div className="comw-cfg-campos">
                  {campos.map(([campo, l]) => (
                    <label key={campo}>
                      <span>{l}</span>
                      <input inputMode="decimal" placeholder="—" maxLength={8} value={valor(k, campo)}
                        onChange={(e) => setEd({ ...ed, [k + '\u0000' + campo]: e.target.value })} />
                    </label>
                  ))}
                  {tab !== 'cocor' && (
                    <button type="button" className="mini" title="Comisión distinta según el año de vigencia"
                      onClick={() => setTramos({ grupo: tab, clave: k })}>{res ? '⏱ tramos' : '⏱'}</button>
                  )}
                  {tab === 'combos' && (
                    <button type="button" className="icono-accion rojo" aria-label={`Quitar ${et}`} onClick={() => setBorrarCombo(k)}>✕</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : <Vacio>{tab === 'cocor' ? 'Sin agencias.' : 'Sin registros todavía.'}</Vacio>}
      <p className="fila-sub comw-envuelve comw-ayuda">
        {tab === 'ramos' && 'Base general. Se usa cuando no hay nada más específico.'}
        {tab === 'asegs' && 'Manda sobre el ramo. Útil cuando una compañía te paga distinto en todo.'}
        {tab === 'combos' && 'Lo más específico: manda sobre aseguradora y sobre ramo.'}
        {tab === 'cocor' && 'Al elegir la agencia en una póliza, este porcentaje se coloca solo en Part. CoCor.'}
      </p>
      {tab === 'combos' && (
        <div className="tarjeta">
          <b>Agregar combinación</b>
          <label className="campo"><span>Aseguradora</span>
            <select value={nc.aseg} onChange={(e) => setNc({ ...nc, aseg: e.target.value })}>
              <option value="">Aseguradora…</option>
              {asegs.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="campo"><span>Ramo</span>
            <select value={nc.ramo} onChange={(e) => setNc({ ...nc, ramo: e.target.value })}>
              <option value="">Ramo…</option>
              {RAMOS_CFG.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <button className="boton secundario" type="button" onClick={agregarCombo} disabled={ocupado}>Agregar</button>
        </div>
      )}
      <div className="botonera">
        <button className="boton comw-verde" type="button" onClick={() => { void guardar(); }} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
        {guardadoA && <p className="fila-sub">Guardado · {guardadoA}</p>}
      </div>
      {tramos && (
        <EditorTramos ctx={ctx} cfg={cfg} grupo={tramos.grupo} clave={tramos.clave} escribir={escribir}
          antes={() => guardar(true)} onCerrar={() => setTramos(null)} />
      )}
      {borrarCombo && (
        <Hoja titulo="¿Quitar combinación?" onCerrar={() => setBorrarCombo('')}>
          <p className="texto-largo"><b>{borrarCombo.split(SEP).join(' · ')}</b></p>
          <div className="botonera">
            <button className="boton peligro" type="button" onClick={() => quitarCombo(borrarCombo)} disabled={ocupado}>🗑️ Sí, eliminar</button>
            <button className="boton secundario" type="button" onClick={() => setBorrarCombo('')} disabled={ocupado}>Cancelar</button>
          </div>
        </Hoja>
      )}
    </>
  );
}

type TramoEd = { d: string; h: string; com: string };

function EditorTramos({ ctx, cfg, grupo, clave, escribir, antes, onCerrar }: {
  ctx: Ctx; cfg: ComisCfg; grupo: GrupoCfg; clave: string;
  escribir: (fn: (c: ComisCfg) => ComisCfg) => Promise<boolean>; antes: () => Promise<boolean>; onCerrar: () => void;
}) {
  const [filas, setFilas] = useState<TramoEd[]>(() => {
    const o = cfg[grupo][clave];
    const t = o && Array.isArray(o.tramos) && o.tramos.length ? o.tramos : null;
    return t
      ? t.map((x) => ({ d: String(x.d ?? ''), h: x.h === null || x.h === undefined ? '' : String(x.h), com: String(x.com ?? '') }))
      : [{ d: '1', h: '1', com: '' }, { d: '2', h: '', com: '' }];
  });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const poner = (i: number, campo: keyof TramoEd, v: string) => setFilas(filas.map((f, j) => (j === i ? { ...f, [campo]: v } : f)));

  function agregar() {
    const ult = filas[filas.length - 1];
    const desde = ult && ult.h !== '' ? parseInt(ult.h, 10) + 1 : (parseInt(ult?.d ?? '', 10) || 1) + 1;
    setFilas([...filas, { d: String(desde), h: '', com: '' }]);
  }

  async function guardar() {
    const r = validarTramos(filas.map((f) => ({ d: f.d, h: f.h, com: f.com })));
    if ('error' in r) return setError(r.error);
    setOcupado(true);
    if (!(await antes())) return setOcupado(false);
    const ok = await escribir((c) => {
      if (!c[grupo][clave]) c[grupo][clave] = {};
      if (r.tramos.length) c[grupo][clave].tramos = r.tramos;
      else delete c[grupo][clave].tramos;
      return c;
    });
    if (ok) { ctx.avisar('Tramos guardados'); onCerrar(); } else setOcupado(false);
  }

  return (
    <Hoja titulo="Comisión por año" onCerrar={onCerrar}>
      <p className="fila-sub comw-envuelve">{clave.split(SEP).join(' · ')}</p>
      <div className="comw-tramos-ed">
        <div className="comw-tramos-cab"><span>Desde año</span><span>Hasta año</span><span>% Comisión</span><span /></div>
        {filas.map((f, i) => (
          <div key={i} className="comw-tramos-fila">
            <input inputMode="numeric" value={f.d} onChange={(e) => poner(i, 'd', e.target.value)} aria-label="Desde año" maxLength={3} />
            <input inputMode="numeric" value={f.h} placeholder="∞" onChange={(e) => poner(i, 'h', e.target.value)} aria-label="Hasta año" maxLength={3} />
            <input inputMode="decimal" value={f.com} placeholder="—" onChange={(e) => poner(i, 'com', e.target.value)} aria-label="% Comisión" maxLength={8} />
            <button type="button" className="icono-accion rojo" aria-label="Quitar tramo" onClick={() => setFilas(filas.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>
      <p className="fila-sub comw-envuelve">Deja «Hasta año» vacío para «en adelante». Ejemplo: año 1 al 1 = 80%, año 2 al 5 = 20%, año 6 en adelante = 5%.</p>
      {error && <p className="error">{error}</p>}
      <div className="botonera">
        <button className="boton secundario" type="button" onClick={agregar}>+ Tramo</button>
        <button className="boton comw-verde" type="button" onClick={guardar} disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Hoja>
  );
}

/* ====================== reporte para imprimir / PDF (exportComPDF) ====================== */

function Reporte({ ctx }: { ctx: Ctx }) {
  const { polizas, clientes } = ctx.cartera;
  const cli = new Map(clientes.map((c) => [c.id, c]));
  let total = 0;
  const filas = polizas.map((p) => {
    const mi = n(p.comision);
    total += mi;
    return { p, mi, nom: txt(cli.get(txt(p, 'clienteId')), 'nombre') || txt(p, 'nombreCliente') || '—' };
  });
  return (
    <div className="comw-imp">
      <h2>JAC Seguros · Reporte de Comisiones</h2>
      <p>Jely An Castro, corredora de seguros · jcastro@jacsegurospa.com · Panamá</p>
      <p className="comw-imp-ssrp">{SSRP}</p>
      <p>Generado: {fecha(hoyISO())}</p>
      <table className="tabla">
        <thead><tr><th>Cliente</th><th>Ramo</th><th>Aseg.</th><th>Prima</th><th>%Com</th><th>%Part</th><th>Mi Comisión</th><th>Estado</th></tr></thead>
        <tbody>
          {filas.map(({ p, mi, nom }) => (
            <tr key={p.id}>
              <td>{nom}</td><td>{txt(p, 'ramo')}</td><td>{txt(p, 'aseg')}</td><td>{dinero(n(p.prima))}</td>
              <td>{n(p.comPct)}%</td><td>{n(p.participacion) || 100}%</td><td>{dinero(mi)}</td><td>{txt(p, 'estado')}</td>
            </tr>
          ))}
          <tr><td colSpan={6} /><td><b>TOTAL: {dinero(total)}</b></td><td /></tr>
        </tbody>
      </table>
    </div>
  );
}
