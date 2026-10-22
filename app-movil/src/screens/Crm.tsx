import { useMemo, useState } from 'react';
import { datosCliente, datosPoliza } from '../lib/contacto';
import { BotonesContacto } from '../components/Contactar';
import { Fila, Hoja, Vacio, inicial } from '../components/Piezas';
import { ListaLarga } from '../components/Registro';
import { avanzarEtapa, llevarAPipeline, PIPE_ETAPAS, ventaCruzada, type OportunidadVC } from '../lib/crm';
import { ErrorDatos, fec, num, txt, type Reg } from '../lib/datos';
import { diasHasta, dinero, fecha, normalizar } from '../lib/formato';
import { polizaCancelada, prospectoAbierto, seguimientoProspecto } from '../lib/reglas';
import { AccionesFila, Prospectos, type Ctx } from './Modulos';

type Tab = 'pipe' | 'seg' | 'vc' | 'ren' | 'pros';
const TABS: Array<[Tab, string]> = [
  ['pipe', '📈 Pipeline'], ['seg', '📌 Seguimientos'], ['vc', '🔄 Venta cruzada'], ['ren', '🔔 Renovaciones'], ['pros', '🎯 Prospectos'],
];
const COLOR_PRIO: Record<string, string> = { Alta: '#DC2626', Media: '#D97706', Baja: '#16A34A' };

export function Crm({ ctx }: { ctx: Ctx }) {
  const [tab, setTab] = useState<Tab>('pipe');
  return (
    <>
      <div className="ag-tabs">
        {TABS.map(([k, t]) => <button key={k} type="button" className={tab === k ? 'activa' : ''} onClick={() => setTab(k)}>{t}</button>)}
      </div>
      {tab === 'pipe' && <Pipeline ctx={ctx} />}
      {tab === 'seg' && <Seguimientos ctx={ctx} />}
      {tab === 'vc' && <VentaCruzada ctx={ctx} />}
      {tab === 'ren' && <Renovaciones ctx={ctx} />}
      {tab === 'pros' && <Prospectos ctx={ctx} />}
    </>
  );
}

/* ---------------- etapa: mover (compartido) ---------------- */

export function MoverEtapa({ ctx, p, onCerrar }: { ctx: Ctx; p: Reg; onCerrar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  async function mover(e: string) {
    setOcupado(true);
    try {
      const r = await avanzarEtapa(ctx.cartera, p, e);
      ctx.poner('prospectos', r.prospecto);
      if (r.cliente) ctx.poner('clientes', r.cliente);
      ctx.avisar(r.mensaje);
      onCerrar();
    } catch (err) {
      ctx.avisar(err instanceof ErrorDatos ? err.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }
  return (
    <Hoja titulo={`Mover: ${txt(p, 'nombre')}`} onCerrar={onCerrar}>
      <div className="lista">
        {PIPE_ETAPAS.map((e) => (
          <button key={e.id} type="button" className="fila" disabled={ocupado || e.id === txt(p, 'etapaVenta')} onClick={() => mover(e.id)}>
            <span className="punto" style={{ background: e.color }} />
            <div className="fila-cuerpo"><div className="fila-titulo">{e.label}</div></div>
            {e.id === txt(p, 'etapaVenta') && <span className="etiqueta e-info">Actual</span>}
          </button>
        ))}
      </div>
      {ocupado && <p className="contador">Guardando…</p>}
    </Hoja>
  );
}

/* ---------------- pipeline (tablero) ---------------- */

type VistaPipe = 'tablero' | 'lista';
const leerVista = (): VistaPipe => { try { return localStorage.getItem('jac_crm_vista') === 'lista' ? 'lista' : 'tablero'; } catch { return 'tablero'; } };

function Pipeline({ ctx }: { ctx: Ctx }) {
  const [mover, setMover] = useState<Reg | null>(null);
  const [soloVC, setSoloVC] = useState(false);
  const [vista, setVistaE] = useState<VistaPipe>(leerVista);
  const setVista = (v: VistaPipe) => { setVistaE(v); try { localStorage.setItem('jac_crm_vista', v); } catch { /* sin almacenamiento */ } };
  const pros = ctx.cartera.prospectos.filter((p) => !soloVC || p.esVentaCruzada === true);
  const total = pros.filter((p) => txt(p, 'etapaVenta') !== 'Perdido').reduce((s, p) => s + (num(p, 'montoEstimado') ?? 0), 0);
  const ganados = pros.filter((p) => txt(p, 'etapaVenta') === 'Cliente ganado').length;
  const conv = pros.length ? Math.round((ganados / pros.length) * 100) : 0;
  return (
    <>
      <div className="kpis">
        <div className="kpi"><b>{pros.length}</b><span>Registros</span></div>
        <div className="kpi"><b className="kpi-dinero">{dinero(total)}</b><span>En pipeline</span></div>
        <div className="kpi"><b>{conv}%</b><span>Conversión</span></div>
        <button className="kpi" type="button" onClick={() => setSoloVC(!soloVC)}><b>{soloVC ? 'VC' : 'Todos'}</b><span>{soloVC ? 'Solo venta cruzada' : 'Tocar: solo venta cruzada'}</span></button>
      </div>
      <div className="filtros">
        <button type="button" className={vista === 'tablero' ? 'activa' : ''} onClick={() => setVista('tablero')}>🗂 Tablero</button>
        <button type="button" className={vista === 'lista' ? 'activa' : ''} onClick={() => setVista('lista')}>☰ Lista</button>
      </div>
      {vista === 'lista' ? <ListaPipeline ctx={ctx} pros={pros} onMover={setMover} /> : (<>
      <div className="pipe-saltos">
        {PIPE_ETAPAS.map((et) => {
          const n = pros.filter((p) => (txt(p, 'etapaVenta') || 'Contacto inicial') === et.id).length;
          return (
            <button key={et.id} type="button" style={{ borderColor: et.color, color: et.color }}
              onClick={() => document.getElementById('col-' + et.id)?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })}>
              {et.label} {n}
            </button>
          );
        })}
      </div>
      <div className="pipe">
        {PIPE_ETAPAS.map((et) => {
          const items = pros.filter((p) => (txt(p, 'etapaVenta') || 'Contacto inicial') === et.id);
          const monto = items.reduce((s, p) => s + (num(p, 'montoEstimado') ?? 0), 0);
          return (
            <div key={et.id} id={'col-' + et.id} className="pipe-col">
              <div className="pipe-cab" style={{ color: et.color, background: et.color + '1f' }}>
                {et.label} <span className="pipe-n" style={{ background: et.color + '33' }}>{items.length}</span>
                {monto > 0 && <div className="pipe-monto">{dinero(monto)}</div>}
              </div>
              <div className="pipe-cuerpo">
                {items.length ? items.map((p) => {
                  const pc = COLOR_PRIO[txt(p, 'prioridad')] ?? '#64748B';
                  const prob = Math.max(0, Math.min(100, num(p, 'probabilidad') ?? 0));
                  const seg = seguimientoProspecto(p);
                  const d = diasHasta(seg);
                  return (
                    <div key={p.id} className="pipe-card" style={{ borderLeftColor: pc }}>
                      <button type="button" className="pipe-card-cuerpo" onClick={() => ctx.abrir('prospectos', p.id)}>
                        <b>{txt(p, 'nombre')}{p.esVentaCruzada === true && <span className="etiqueta e-aviso"> VC</span>}</b>
                        <small>{Array.isArray(p.interes) && (p.interes as string[]).length ? (p.interes as string[]).slice(0, 2).join(' · ') : txt(p, 'fuente') || '—'}</small>
                        {num(p, 'montoEstimado') ? <span className="pipe-dinero">{dinero(num(p, 'montoEstimado'))}</span> : null}
                        {seg && <small className={d !== null && d <= 0 ? 'rojo' : ''}>📅 {fecha(seg)}</small>}
                        <div className="barra"><div className="barra-relleno" style={{ width: `${prob}%`, background: pc }} /></div>
                      </button>
                      <div className="pipe-acciones">
                        <button type="button" className="mini" onClick={() => setMover(p)}>Mover ➜</button>
                        <AccionesFila ctx={ctx} modulo="prospectos" r={p} />
                      </div>
                    </div>
                  );
                }) : <p className="sincro">—</p>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="sincro">Desliza a los lados para ver todas las etapas.</p>
      </>)}
      {mover && <MoverEtapa ctx={ctx} p={mover} onCerrar={() => setMover(null)} />}
    </>
  );
}

/* ---------------- pipeline (lista, como "☰ Lista" del CRM web) ---------------- */

type OrdenLista = 'seg' | 'monto' | 'nombre' | 'etapa' | 'prob';

function ListaPipeline({ ctx, pros, onMover }: { ctx: Ctx; pros: Reg[]; onMover: (p: Reg) => void }) {
  const [etapa, setEtapa] = useState('');
  const [q, setQ] = useState('');
  const [orden, setOrden] = useState<OrdenLista>('seg');
  const idxEtapa = (p: Reg) => PIPE_ETAPAS.findIndex((e) => e.id === (txt(p, 'etapaVenta') || 'Contacto inicial'));
  const lista = useMemo(() => {
    const t = normalizar(q);
    const l = pros.filter((p) => (!etapa || (txt(p, 'etapaVenta') || 'Contacto inicial') === etapa)
      && (!t || ['nombre', 'cel', 'email', 'fuente', 'cedula'].some((k) => normalizar(txt(p, k)).includes(t))
        || (Array.isArray(p.interes) && normalizar((p.interes as string[]).join(' ')).includes(t))));
    const cmp: Record<OrdenLista, (a: Reg, b: Reg) => number> = {
      seg: (a, b) => (seguimientoProspecto(a) || '9999').localeCompare(seguimientoProspecto(b) || '9999'),
      monto: (a, b) => (num(b, 'montoEstimado') ?? 0) - (num(a, 'montoEstimado') ?? 0),
      nombre: (a, b) => txt(a, 'nombre').localeCompare(txt(b, 'nombre'), 'es'),
      etapa: (a, b) => idxEtapa(a) - idxEtapa(b),
      prob: (a, b) => (num(b, 'probabilidad') ?? 0) - (num(a, 'probabilidad') ?? 0),
    };
    return l.sort(cmp[orden]);
  }, [pros, etapa, q, orden]);
  const total = lista.reduce((s, p) => s + (num(p, 'montoEstimado') ?? 0), 0);
  return (
    <>
      <input className="buscador" type="search" placeholder="Buscar nombre, teléfono, interés…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        <button type="button" className={`chip${!etapa ? ' azul' : ''}`} onClick={() => setEtapa('')}>Todas {pros.length}</button>
        {PIPE_ETAPAS.map((et) => {
          const n = pros.filter((p) => (txt(p, 'etapaVenta') || 'Contacto inicial') === et.id).length;
          return n > 0 && (
            <button key={et.id} type="button" className="chip" onClick={() => setEtapa(etapa === et.id ? '' : et.id)}
              style={etapa === et.id ? { background: et.color, borderColor: et.color, color: '#fff' } : { borderColor: et.color, color: et.color }}>
              {et.label} {n}
            </button>
          );
        })}
      </div>
      <label className="crm-orden">Ordenar por
        <select value={orden} onChange={(e) => setOrden(e.target.value as OrdenLista)}>
          <option value="seg">Próximo seguimiento</option>
          <option value="monto">Monto estimado</option>
          <option value="prob">Probabilidad</option>
          <option value="etapa">Etapa</option>
          <option value="nombre">Nombre</option>
        </select>
      </label>
      <p className="contador">{lista.length} registros · {dinero(total)}</p>
      <ListaLarga items={lista} vacio="No hay registros en esta vista." render={(p) => {
        const et = PIPE_ETAPAS[idxEtapa(p)] ?? PIPE_ETAPAS[0];
        const seg = seguimientoProspecto(p);
        const d = diasHasta(seg);
        const interes = Array.isArray(p.interes) ? (p.interes as string[]).slice(0, 2).join(', ') : '';
        return (
          <Fila key={p.id} inicial={inicial(txt(p, 'nombre'))}
            titulo={<>{txt(p, 'nombre') || 'Sin nombre'}{p.esVentaCruzada === true && <span className="etiqueta e-aviso"> VC</span>}</>}
            sub={[interes || txt(p, 'fuente'), txt(p, 'prioridad'), num(p, 'montoEstimado') ? dinero(num(p, 'montoEstimado')) : '',
              num(p, 'probabilidad') ? `${num(p, 'probabilidad')}%` : '', seg ? `📅 ${fecha(seg)}${d !== null && d < 0 ? ' ⚠' : ''}` : ''].filter(Boolean).join(' · ')}
            derecha={<span className="etiqueta" style={{ background: et.color + '22', color: et.color }}>{et.label}</span>}
            onClick={() => ctx.abrir('prospectos', p.id)}
            acciones={<>
              <button className="icono-accion" type="button" aria-label={`Mover ${txt(p, 'nombre')}`} onClick={() => onMover(p)}>➜</button>
              <AccionesFila ctx={ctx} modulo="prospectos" r={p} />
            </>} />
        );
      }} />
    </>
  );
}

/* ---------------- seguimientos ---------------- */

function Seguimientos({ ctx }: { ctx: Ctx }) {
  const grupos = useMemo(() => {
    const abiertos = ctx.cartera.prospectos.filter(prospectoAbierto);
    const g = { atrasados: [] as Reg[], hoy: [] as Reg[], semana: [] as Reg[], despues: [] as Reg[], sin: [] as Reg[] };
    for (const p of abiertos) {
      const d = diasHasta(seguimientoProspecto(p));
      if (d === null) g.sin.push(p);
      else if (d < 0) g.atrasados.push(p);
      else if (d === 0) g.hoy.push(p);
      else if (d <= 7) g.semana.push(p);
      else g.despues.push(p);
    }
    const orden = (a: Reg, b: Reg) => seguimientoProspecto(a).localeCompare(seguimientoProspecto(b));
    Object.values(g).forEach((l) => l.sort(orden));
    return g;
  }, [ctx.cartera.prospectos]);
  const bloque = (titulo: string, l: Reg[], clase: string) => l.length > 0 && (
    <>
      <h3 className="seccion">{titulo} ({l.length})</h3>
      <div className="lista">
        {l.map((p) => (
          <Fila key={p.id} acciones={<AccionesFila ctx={ctx} modulo="prospectos" r={p} />} inicial={inicial(txt(p, 'nombre'))} titulo={txt(p, 'nombre')}
            sub={[txt(p, 'etapaVenta'), seguimientoProspecto(p) && fecha(seguimientoProspecto(p)), num(p, 'montoEstimado') ? dinero(num(p, 'montoEstimado')) : ''].filter(Boolean).join(' · ')}
            derecha={clase ? <span className={`etiqueta ${clase}`}>{titulo.split(' ')[0]}</span> : undefined}
            onClick={() => ctx.abrir('prospectos', p.id)} />
        ))}
      </div>
    </>
  );
  const total = Object.values(grupos).reduce((s, l) => s + l.length, 0);
  if (!total) return <Vacio>No hay prospectos en curso.</Vacio>;
  return (
    <>
      {bloque('Atrasados', grupos.atrasados, 'e-peligro')}
      {bloque('Hoy', grupos.hoy, 'e-aviso')}
      {bloque('Próximos 7 días', grupos.semana, 'e-info')}
      {bloque('Más adelante', grupos.despues, '')}
      {bloque('Sin fecha de seguimiento', grupos.sin, '')}
    </>
  );
}

/* ---------------- venta cruzada ---------------- */

function VentaCruzada({ ctx }: { ctx: Ctx }) {
  const opps = useMemo(() => ventaCruzada(ctx.cartera), [ctx.cartera]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const enVC = ctx.cartera.prospectos.filter((p) => p.esVentaCruzada === true && prospectoAbierto(p)).length;
  async function alPipeline(o: OportunidadVC) {
    const k = o.cliente.id + o.ramo;
    setOcupado(k);
    try {
      ctx.poner('prospectos', await llevarAPipeline(o));
      ctx.avisar('✓ Llevado al pipeline');
    } catch (e) {
      ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
    } finally { setOcupado(null); }
  }
  return (
    <>
      <div className="kpis">
        <div className="kpi"><b>{opps.length}</b><span>Oportunidades</span></div>
        <div className="kpi"><b>{new Set(opps.map((o) => o.cliente.id)).size}</b><span>Clientes con potencial</span></div>
        <div className="kpi"><b>{enVC}</b><span>En pipeline (VC)</span></div>
      </div>
      <p className="contador">Detectadas automáticamente con las reglas de venta cruzada del CRM. "Al pipeline" las lleva al seguimiento.</p>
      {opps.length ? opps.slice(0, 150).map((o) => {
        const cl = o.cliente;
        const nombre1 = txt(cl, 'nombre').split(' ')[0];
        const msg = `Hola ${nombre1} 👋🏼\n\nTe contacto de *JAC Seguros*.\n\nBasado en tu perfil te recomiendo agregar *${o.ramo}* para complementar tu protección.\n\n¿Podemos hablar?`;
        const dVC = datosCliente(cl);
        const sc = Math.round(o.score);
        return (
          <div key={cl.id + o.ramo} className="tarjeta vc">
            <div className="ag-meta-cab">
              <button type="button" className="enlace" onClick={() => ctx.abrir('clientes', cl.id)}><b>{txt(cl, 'nombre')}</b></button>
              <span className="etiqueta" style={{ background: sc >= 70 ? '#D1FAE5' : sc >= 40 ? '#FEF3C7' : '#F1F5F9', color: sc >= 70 ? '#15803D' : sc >= 40 ? '#B45309' : '#64748B' }}>{sc}</span>
            </div>
            <p className="contador">Ofrecer <b>{o.ramo}</b> · {o.mensaje}</p>
            <div className="ag-anot-botones">
              <BotonesContacto ctx={ctx} d={{ ...dVC, wa: [{ motivo: 'Venta cruzada', msg }, ...(dVC.wa ?? [])] }} />
              <button type="button" className="mini" disabled={ocupado === cl.id + o.ramo} onClick={() => alPipeline(o)}>➜ Al pipeline</button>
            </div>
          </div>
        );
      }) : <Vacio>No hay oportunidades nuevas. 🎉</Vacio>}
    </>
  );
}

/* ---------------- renovaciones (igual que RRen del web) ---------------- */

function Renovaciones({ ctx }: { ctx: Ctx }) {
  const grupos = useMemo(() => {
    const pols = ctx.cartera.polizas.filter((p) => !polizaCancelada(p) && fec(p, 'fechaFin'));
    const d = (p: Reg) => diasHasta(fec(p, 'fechaFin')) as number;
    const g: Array<[string, string, Reg[]]> = [
      ['🚨 Urgentes ≤7 días', 'e-peligro', pols.filter((p) => d(p) >= 0 && d(p) <= 7)],
      ['⚠️ Próximas 8–30 días', 'e-aviso', pols.filter((p) => d(p) >= 8 && d(p) <= 30)],
      ['📅 31–60 días', 'e-info', pols.filter((p) => d(p) >= 31 && d(p) <= 60)],
      ['🔴 Vencidas (últimos 60 días)', 'e-peligro', pols.filter((p) => d(p) < 0 && d(p) >= -60)],
    ];
    g.forEach(([, , l]) => l.sort((a, b) => fec(a, 'fechaFin').localeCompare(fec(b, 'fechaFin'))));
    return g;
  }, [ctx.cartera.polizas]);
  const kpi = grupos.map(([t, , l]) => [t.split(' ').slice(1).join(' '), l.length] as const);
  if (!grupos.some(([, , l]) => l.length)) return <Vacio>🎉 Sin pólizas por renovar</Vacio>;
  return (
    <>
      <div className="kpis">{kpi.map(([t, n]) => <div key={t} className="kpi"><b>{n}</b><span>{t}</span></div>)}</div>
      {grupos.map(([titulo, clase, l]) => l.length > 0 && (
        <div key={titulo}>
          <h3 className="seccion">{titulo} ({l.length})</h3>
          <div className="lista">
            {l.map((p) => {
              const cl = ctx.cartera.clientes.find((c) => c.id === txt(p, 'clienteId'));
              const dd = diasHasta(fec(p, 'fechaFin')) as number;
              const nombre = txt(cl, 'nombre') || txt(p, 'nombreCliente') || '—';
              const msg = `Hola ${nombre.split(' ')[0]} 👋🏼\n\nTe escribo de *JAC Seguros*. Tu póliza *${txt(p, 'ramo')}* N.º ${txt(p, 'num')} con ${txt(p, 'aseg')} ${dd < 0 ? 'venció' : 'vence'} el ${fecha(fec(p, 'fechaFin'))}. ¿Te ayudo con la renovación?`;
              const dR = datosPoliza(p, ctx.cartera);
              return (
                <div key={p.id} className="fila">
                  <button type="button" className="fila-boton" onClick={() => ctx.abrir('polizas', p.id)}>
                    <div className="fila-cuerpo">
                      <div className="fila-titulo">{nombre}</div>
                      <div className="fila-sub">{[txt(p, 'ramo'), txt(p, 'aseg'), txt(p, 'num'), fecha(fec(p, 'fechaFin'))].filter(Boolean).join(' · ')}</div>
                    </div>
                    <span className={`etiqueta ${clase}`}>{dd < 0 ? `${-dd}d atrás` : `${dd}d`}</span>
                  </button>
                  <div className="fila-acciones"><BotonesContacto ctx={ctx} d={{ ...dR, wa: [{ motivo: 'Renovación (corto)', msg }, ...(dR.wa ?? [])] }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}
