import { useMemo, useState, type FormEvent } from 'react';
import { datosPago, datosPoliza, datosProspecto, datosTarea, type Datos } from '../lib/contacto';
import { BotonesContacto } from '../components/Contactar';
import { enlaceAgregarGcal } from '../lib/gcal';
import { Fila, Hoja, Vacio } from '../components/Piezas';
import { FichaCampos } from '../components/Registro';
import {
  eliminarTarea, ErrorDatos, fec, guardarMeta, guardarRegistro, num, txt, type Cartera, type Reg,
} from '../lib/datos';
import { COLOR_ETAPA_TAREA, COLOR_PRIORIDAD, PRIORIDADES_AGENDA } from '../lib/esquema';
import { dinero, enlaceCorreo, enlaceWhatsApp, fecha, hoyISO, normalizar } from '../lib/formato';
import { polizaCancelada, prospectoAbierto, seguimientoProspecto, tareaAbierta, tareaCompletada } from '../lib/reglas';
import type { Ctx } from './Modulos';

/*
 * Replica de la Agenda del CRM web (modulo "pg-cal"): mismos datos, mismas
 * reglas y mismas claves en la base (tareas, calReuniones, calNotas,
 * calMetas y calDiarios en crm_meta).
 */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DNAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const FRASES = ['La disciplina es el puente entre metas y logros.', 'El éxito es la suma de pequeños esfuerzos repetidos cada día.',
  'Hoy es un buen día para tener un buen día.', 'Cada día es una nueva oportunidad.', 'La felicidad es la clave del éxito.'];

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const claveDiario = (y: number, m: number, d: number) => `d_${y}_${m + 1}_${d}`;

type Pestana = 'agenda' | 'semana' | 'tareas' | 'metas' | 'diario' | 'reun' | 'notas' | 'alertas' | 'historial' | 'cobros';
const PESTANAS: Array<[Pestana, string]> = [
  ['agenda', '📅 Agenda'], ['semana', '📆 Semana'], ['tareas', '✅ Tareas'], ['metas', '🎯 Metas'], ['diario', '📝 Diario'],
  ['reun', '👥 Reuniones'], ['notas', '📋 Notas'], ['alertas', '🔔 Alertas'], ['historial', '🕓 Historial'], ['cobros', '💰 Cobros'],
];

const CREAR: Array<[string, string, string]> = [
  ['cita', 'Cita', '📅'], ['visita', 'Visita', '🏠'], ['llamada', 'Llamada', '📞'], ['correo', 'Mensaje por correo', '✉️'],
  ['mensajeria', 'Envío de mensajería', '📦'], ['whatsapp', 'Mensaje por WhatsApp', '💬'],
];

type Evento = { tipo: 'pol' | 'tar' | 'pro'; id: string; nm: string; r: Reg };

function eventosPorDia(c: Cartera, desde: string, hasta: string): Map<string, Evento[]> {
  const m = new Map<string, Evento[]>();
  const add = (d: string, e: Evento) => {
    if (!d || d < desde || d > hasta) return;
    if (!m.has(d)) m.set(d, []);
    m.get(d)!.push(e);
  };
  for (const p of c.polizas) {
    if (polizaCancelada(p)) continue;
    const cl = c.clientes.find((x) => x.id === txt(p, 'clienteId'));
    add(fec(p, 'fechaFin') || fec(p, 'vencimiento'), { tipo: 'pol', id: p.id, r: p,
      nm: (txt(cl, 'nombre') || txt(p, 'nombreCliente') || 'Póliza') + (txt(p, 'num') ? ' #' + txt(p, 'num') : '') });
  }
  for (const t of c.tareas) {
    if (tareaCompletada(t) || txt(t, 'etapaTarea') === 'Eliminada') continue;
    add(fec(t, 'fechaLimite'), { tipo: 'tar', id: t.id, r: t, nm: txt(t, 'titulo') || txt(t, 'desc') || 'Tarea' });
  }
  for (const p of c.prospectos) {
    if (!prospectoAbierto(p)) continue;
    add(seguimientoProspecto(p).slice(0, 10), { tipo: 'pro', id: p.id, r: p, nm: txt(p, 'nombre') || 'Prospecto' });
  }
  return m;
}

/* ============================================================ */

export function Agenda({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const hoy = new Date();
  const [mes, setMes] = useState(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [sel, setSel] = useState(hoy.getDate());
  const [tab, setTab] = useState<Pestana>('agenda');
  const [hoja, setHoja] = useState<null | { t: 'tarea'; r: Reg | null; tipoAgenda?: string } | { t: 'dia' } | { t: 'reun'; r: Reg | null } | { t: 'nota'; r: Reg | null } | { t: 'meta' } | { t: 'crear' }>(null);

  const y = mes.getFullYear(), m = mes.getMonth();
  const ultimo = new Date(y, m + 1, 0).getDate();
  const diaSel = Math.min(sel, ultimo);
  const fechaSel = iso(y, m, diaSel);
  const evs = useMemo(() => eventosPorDia(cartera, iso(y, m, 1), iso(y, m, ultimo)), [cartera, y, m, ultimo]);

  const ir = (d: number) => { setMes(new Date(y, m + d, 1)); setSel(1); };
  const irHoy = () => { setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); setSel(hoy.getDate()); };
  const irFecha = (f: string) => {
    const [a, b, c] = f.split('-').map(Number);
    setMes(new Date(a, b - 1, 1)); setSel(c);
  };

  const setMeta = (clave: 'calReuniones' | 'calNotas' | 'calMetas' | 'calDiarios', v: unknown) =>
    ctx.ponerMeta(clave, v);

  async function marcarHecha(t: Reg) {
    try {
      ctx.poner('tareas', await guardarRegistro('tareas', t.id, { etapaTarea: 'Hecho', estado: 'completada' }));
      ctx.avisar('✓ Tarea completada');
    } catch (e) { ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.'); }
  }

  return (
    <div className="agenda">
      {/* Cabecera estilo libreta: dia grande, como el CRM web */}
      <div className="ag-cabeza">
        <div className="ag-dia">
          <div className="ag-num">{diaSel}</div>
          <div>
            <div className="ag-nombre">{DNAMES[new Date(y, m, diaSel).getDay()]}</div>
            <div className="ag-mes">{MESES[m]} {y}</div>
          </div>
        </div>
        <div className="ag-botones">
          <button type="button" className="ag-redondo azul" aria-label="Agregar tarea" onClick={() => setHoja({ t: 'tarea', r: null })}>+</button>
          <button type="button" className="ag-redondo verde" aria-label="Crear cita, visita, llamada…" onClick={() => setHoja({ t: 'crear' })}>✚</button>
          <button type="button" className="ag-hoy" onClick={irHoy}>Hoy</button>
        </div>
      </div>

      <div className="ag-tabs">
        {PESTANAS.map(([k, t]) => (
          <button key={k} type="button" className={tab === k ? 'activa' : ''} onClick={() => setTab(k)}>{t}</button>
        ))}
      </div>

      {tab === 'agenda' && (
        <>
          <div className="ag-nav">
            <button type="button" onClick={() => ir(-1)} aria-label="Mes anterior">◀</button>
            <b>{MESES[m]} {y}</b>
            <button type="button" onClick={() => ir(1)} aria-label="Mes siguiente">▶</button>
          </div>
          <div className="ag-grid ag-dias">{DIAS.map((d) => <div key={d}>{d}</div>)}</div>
          <div className="ag-grid">
            {Array.from({ length: new Date(y, m, 1).getDay() }, (_, i) => <div key={'v' + i} />)}
            {Array.from({ length: ultimo }, (_, i) => {
              const d = i + 1;
              const e = evs.get(iso(y, m, d)) ?? [];
              const esHoy = y === hoy.getFullYear() && m === hoy.getMonth() && d === hoy.getDate();
              return (
                <button key={d} type="button" className={`ag-celda${d === diaSel ? ' sel' : ''}${esHoy ? ' hoy' : ''}`}
                  onClick={() => { if (d === diaSel) setHoja({ t: 'dia' }); setSel(d); }}>
                  <span>{d}</span>
                  <span className="ag-puntos">
                    {e.some((x) => x.tipo === 'pol') && <i className="p-pol" />}
                    {e.some((x) => x.tipo === 'tar') && <i className="p-tar" />}
                    {e.some((x) => x.tipo === 'pro') && <i className="p-pro" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="ag-leyenda">
            <span><i className="p-pol" />Póliza vence</span><span><i className="p-tar" />Tarea</span><span><i className="p-pro" />Seguimiento</span>
          </div>
          <div className="seccion-fila">
            <h3 className="seccion">Eventos del día</h3>
            <button className="mini" type="button" onClick={() => setHoja({ t: 'dia' })}>Ver día completo</button>
          </div>
          <EventosDia ctx={ctx} evs={evs.get(fechaSel) ?? []} onTarea={(r) => setHoja({ t: 'tarea', r })} onHecha={marcarHecha} />
          <Reuniones ctx={ctx} fecha={fechaSel} soloDia onEditar={(r) => setHoja({ t: 'reun', r })} />
        </>
      )}

      {tab === 'semana' && <Semana ctx={ctx} onTarea={(r) => setHoja({ t: 'tarea', r })} />}
      {tab === 'tareas' && <TareasAgenda ctx={ctx} onTarea={(r) => setHoja({ t: 'tarea', r })} onHecha={marcarHecha} />}
      {tab === 'metas' && <Metas ctx={ctx} onNueva={() => setHoja({ t: 'meta' })} setMeta={setMeta} />}
      {tab === 'diario' && <Diario ctx={ctx} y={y} m={m} d={diaSel} setMeta={setMeta} irFecha={irFecha} />}
      {tab === 'reun' && (
        <>
          <button className="boton mas-abajo" type="button" onClick={() => setHoja({ t: 'reun', r: null })}>+ Nueva reunión</button>
          <Reuniones ctx={ctx} fecha={fechaSel} onEditar={(r) => setHoja({ t: 'reun', r })} />
        </>
      )}
      {tab === 'notas' && <Notas ctx={ctx} fecha={fechaSel} onEditar={(r) => setHoja({ t: 'nota', r })} />}
      {tab === 'alertas' && <Alertas ctx={ctx} />}
      {tab === 'historial' && <HistorialAgenda ctx={ctx} />}
      {tab === 'cobros' && <Cobros ctx={ctx} />}

      {hoja?.t === 'dia' && <DiaCompleto ctx={ctx} fecha={fechaSel} onCerrar={() => setHoja(null)} />}
      {hoja?.t === 'tarea' && (
        <EditarTarea ctx={ctx} r={hoja.r} fecha={fechaSel} tipoAgenda={hoja.tipoAgenda} onCerrar={() => setHoja(null)} />
      )}
      {hoja?.t === 'crear' && (
        <Hoja titulo="Crear" onCerrar={() => setHoja(null)}>
          <div className="lista">
            {CREAR.map(([k, l, ic]) => (
              <Fila key={k} titulo={`${ic} ${l}`} onClick={() => setHoja({ t: 'tarea', r: null, tipoAgenda: k })} />
            ))}
          </div>
        </Hoja>
      )}
      {hoja?.t === 'reun' && <EditarReunion ctx={ctx} r={hoja.r} fecha={fechaSel} setMeta={setMeta} onCerrar={() => setHoja(null)} />}
      {hoja?.t === 'nota' && <EditarNota ctx={ctx} r={hoja.r} fecha={fechaSel} setMeta={setMeta} onCerrar={() => setHoja(null)} />}
      {hoja?.t === 'meta' && <NuevaMeta ctx={ctx} setMeta={setMeta} onCerrar={() => setHoja(null)} />}
    </div>
  );
}

/* ---------------- eventos de un dia ---------------- */

function Prio({ p }: { p: string }) {
  if (!p) return null;
  return <span className="prio" style={{ background: COLOR_PRIORIDAD[p] ?? '#94A3B8' }}>{p}</span>;
}

function EventosDia({ ctx, evs, onTarea, onHecha }: {
  ctx: Ctx; evs: Evento[]; onTarea: (r: Reg) => void; onHecha: (r: Reg) => void;
}) {
  if (!evs.length) return <div className="vacio">✨ Sin eventos este día</div>;
  return (
    <div className="ag-eventos">
      {evs.map((e) => (
        <div key={e.tipo + e.id} className={`ag-ev ev-${e.tipo}`}>
          <button type="button" className="ag-ev-cuerpo"
            onClick={() => (e.tipo === 'tar' ? onTarea(e.r) : ctx.abrir(e.tipo === 'pol' ? 'polizas' : 'prospectos', e.id))}>
            <span className="ag-ev-tag">{e.tipo === 'pol' ? 'VENCE' : e.tipo === 'tar' ? 'TAREA' : 'SEGUIM.'}</span>
            <span className="ag-ev-nm">{e.nm} {e.tipo === 'tar' && <Prio p={txt(e.r, 'prioridad')} />}
              {e.tipo === 'tar' && txt(e.r, 'hora') && <small> · {txt(e.r, 'hora')}</small>}
              {e.tipo === 'tar' && txt(e.r, 'reminder') && txt(e.r, 'reminder') !== 'ninguno' && ' 🔔'}</span>
          </button>
          <ContactoDe ctx={ctx} d={e.tipo === 'tar' ? datosTarea(e.r, ctx.cartera) : e.tipo === 'pol' ? datosPoliza(e.r, ctx.cartera) : datosProspecto(e.r)} />
          {e.tipo === 'tar' && (
            <button type="button" className="ag-check" aria-label="Marcar realizada" onClick={() => onHecha(e.r)}>✓</button>
          )}
        </div>
      ))}
    </div>
  );
}

function DiaCompleto({ ctx, fecha: f, onCerrar }: { ctx: Ctx; fecha: string; onCerrar: () => void }) {
  const reuniones = ctx.cartera.meta.calReuniones.filter((r) => txt(r, 'fecha') === f);
  const tareas = ctx.cartera.tareas.filter((t) => fec(t, 'fechaLimite') === f && txt(t, 'etapaTarea') !== 'Eliminada');
  const items = [
    ...reuniones.map((r) => ({ hora: txt(r, 'hora'), t: '🤝 ' + (txt(r, 'titulo') || 'Reunión'), c: '#1D4ED8' })),
    ...tareas.map((t) => ({ hora: txt(t, 'hora'), t: '✅ ' + (txt(t, 'titulo') || txt(t, 'desc') || 'Tarea'), c: COLOR_PRIORIDAD[txt(t, 'prioridad')] ?? '#16A34A' })),
  ];
  const sinHora = items.filter((x) => !x.hora);
  const conHora = items.filter((x) => x.hora).sort((a, b) => a.hora.localeCompare(b.hora));
  const [a, b, c] = f.split('-').map(Number);
  const titulo = new Date(a, b - 1, c).toLocaleDateString('es-PA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Hoja titulo={`📅 ${titulo}`} onCerrar={onCerrar}>
      {sinHora.length > 0 && (
        <>
          <h3 className="seccion">Todo el día</h3>
          {sinHora.map((x, i) => <div key={i} className="ag-bloque" style={{ borderLeftColor: x.c }}>{x.t}</div>)}
        </>
      )}
      <h3 className="seccion">Horario</h3>
      <div className="ag-horas">
        {Array.from({ length: 24 }, (_, h) => {
          const en = conHora.filter((x) => parseInt(x.hora, 10) === h);
          return (
            <div key={h} className="ag-hora">
              <span>{String(h).padStart(2, '0')}:00</span>
              <div>{en.map((x, i) => <div key={i} className="ag-bloque" style={{ borderLeftColor: x.c }}><b>{x.hora}</b> {x.t}</div>)}</div>
            </div>
          );
        })}
      </div>
    </Hoja>
  );
}

/* ---------------- semana ---------------- */

function Semana({ ctx, onTarea }: { ctx: Ctx; onTarea: (r: Reg) => void }) {
  const [desp, setDesp] = useState(0);
  const lunes = new Date();
  lunes.setHours(0, 0, 0, 0);
  const dow = lunes.getDay();
  lunes.setDate(lunes.getDate() - (dow === 0 ? 6 : dow - 1) + desp * 7);
  const dias = Array.from({ length: 7 }, (_, i) => new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i));
  const k = (d: Date) => iso(d.getFullYear(), d.getMonth(), d.getDate());
  const evs = useMemo(() => eventosPorDia(ctx.cartera, k(dias[0]), k(dias[6])), [ctx.cartera, desp]); // eslint-disable-line react-hooks/exhaustive-deps
  const corto = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const hoyK = hoyISO();
  return (
    <>
      <div className="ag-nav">
        <button type="button" onClick={() => setDesp(desp - 1)} aria-label="Semana anterior">◀</button>
        <b>{dias[0].getDate()} {corto[dias[0].getMonth()]} — {dias[6].getDate()} {corto[dias[6].getMonth()]} {dias[6].getFullYear()}</b>
        <button type="button" onClick={() => setDesp(desp + 1)} aria-label="Semana siguiente">▶</button>
      </div>
      {dias.map((d, i) => {
        const e = evs.get(k(d)) ?? [];
        return (
          <div key={i} className={`ag-semdia${k(d) === hoyK ? ' hoy' : ''}`}>
            <div className="ag-semdia-cab">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][i]} <b>{d.getDate()}</b></div>
            {e.length ? e.map((x) => (
              <button key={x.tipo + x.id} type="button" className={`ag-chip ev-${x.tipo}`}
                onClick={() => (x.tipo === 'tar' ? onTarea(x.r) : ctx.abrir(x.tipo === 'pol' ? 'polizas' : 'prospectos', x.id))}>
                {x.tipo === 'pol' ? '📋' : x.tipo === 'tar' ? '✅' : '👤'} {x.nm.slice(0, 60)}
              </button>
            )) : <span className="ag-nada">—</span>}
          </div>
        );
      })}
    </>
  );
}

/* ---------------- tareas ---------------- */

function TareasAgenda({ ctx, onTarea, onHecha }: { ctx: Ctx; onTarea: (r: Reg) => void; onHecha: (r: Reg) => void }) {
  const [f, setF] = useState<'all' | 'hoy' | 'sem' | 'ven' | 'cerradas'>('all');
  const hoy = hoyISO();
  const fin = new Date(); fin.setDate(fin.getDate() + 7);
  const finK = iso(fin.getFullYear(), fin.getMonth(), fin.getDate());
  const lista = ctx.cartera.tareas.filter((t) => {
    if (txt(t, '_autoTipo') === 'comision') return false;
    if (f === 'cerradas') return !tareaAbierta(t);
    if (!tareaAbierta(t)) return false;
    const d = fec(t, 'fechaLimite');
    if (f === 'all') return true;
    if (!d) return false;
    if (f === 'hoy') return d === hoy;
    if (f === 'sem') return d >= hoy && d <= finK;
    return d < hoy;
  }).sort((a, b) => (fec(a, 'fechaLimite') || '2099').localeCompare(fec(b, 'fechaLimite') || '2099') * (f === 'cerradas' ? -1 : 1));
  return (
    <>
      <div className="filtros">
        {([['all', 'Todas'], ['hoy', 'Hoy'], ['sem', 'Esta semana'], ['ven', 'Vencidas'], ['cerradas', 'Cerradas']] as const).map(([k, t]) => (
          <button key={k} type="button" className={f === k ? 'activa' : ''} onClick={() => setF(k)}>{t}</button>
        ))}
      </div>
      <p className="contador">{lista.length} tareas</p>
      {lista.length ? (
        <div className="ag-eventos">
          {lista.slice(0, 300).map((t) => {
            const venc = f !== 'cerradas' && fec(t, 'fechaLimite') && fec(t, 'fechaLimite') < hoy;
            const cl = ctx.cartera.clientes.find((c) => c.id === txt(t, 'clienteId'));
            return (
              <div key={t.id} className={`ag-ev ${venc ? 'ev-venc' : 'ev-tar'}`}>
                <button type="button" className="ag-ev-cuerpo" onClick={() => onTarea(t)}>
                  <span className="ag-ev-nm"><Prio p={txt(t, 'prioridad')} /> {txt(t, 'titulo') || txt(t, 'desc') || 'Tarea'}</span>
                  <small className="ag-ev-sub">
                    {[txt(t, 'paraQuien') && '👤 ' + txt(t, 'paraQuien'), cl && txt(cl, 'nombre'),
                      fec(t, 'fechaLimite') && '📅 ' + fecha(fec(t, 'fechaLimite')) + (venc ? ' ⚠ VENCIDA' : ''),
                      txt(t, 'etapaTarea')].filter(Boolean).join(' · ')}
                  </small>
                </button>
                <ContactoDe ctx={ctx} d={datosTarea(t, ctx.cartera)} />
                {tareaAbierta(t) && <button type="button" className="ag-check" aria-label="Marcar realizada" onClick={() => onHecha(t)}>✓</button>}
              </div>
            );
          })}
        </div>
      ) : <Vacio>Sin tareas pendientes 🎉</Vacio>}
    </>
  );
}

export function EditarTarea({ ctx, r, fecha: f, tipoAgenda, onCerrar }: {
  ctx: Ctx; r: Reg | null; fecha: string; tipoAgenda?: string; onCerrar: () => void;
}) {
  const crear = tipoAgenda ? CREAR.find(([k]) => k === tipoAgenda) : undefined;
  const vinculo = r ? (txt(r, 'clienteId') ? 'c:' + txt(r, 'clienteId') : txt(r, 'prospectoId') ? 'p:' + txt(r, 'prospectoId') : '') : '';
  const [v, setV] = useState({
    titulo: txt(r, 'titulo'), desc: r ? txt(r, 'desc') : '', fechaLimite: r ? fec(r, 'fechaLimite') : f, hora: txt(r, 'hora'),
    prioridad: txt(r, 'prioridad'), estado: txt(r, 'estado') || 'pendiente', etapaTarea: txt(r, 'etapaTarea') || 'Por Hacer',
    reminder: txt(r, 'reminder') || 'ninguno', vinculo,
  });
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [borrar, setBorrar] = useState(false);
  const nombreVinculo = v.vinculo.startsWith('c:') ? txt(ctx.cartera.clientes.find((c) => c.id === v.vinculo.slice(2)), 'nombre')
    : v.vinculo.startsWith('p:') ? txt(ctx.cartera.prospectos.find((c) => c.id === v.vinculo.slice(2)), 'nombre') : '';
  const t = normalizar(q);
  const candidatos = t.length >= 2 ? [
    ...ctx.cartera.clientes.filter((c) => normalizar(txt(c, 'nombre')).includes(t)).slice(0, 6).map((c) => ['c:' + c.id, txt(c, 'nombre'), 'Cliente']),
    ...ctx.cartera.prospectos.filter((c) => normalizar(txt(c, 'nombre')).includes(t)).slice(0, 4).map((c) => ['p:' + c.id, txt(c, 'nombre'), 'Prospecto']),
  ] : [];

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!v.titulo.trim()) return setError('Escribe un título.');
    setOcupado(true);
    const clienteId = v.vinculo.startsWith('c:') ? v.vinculo.slice(2) : '';
    const prospectoId = v.vinculo.startsWith('p:') ? v.vinculo.slice(2) : '';
    try {
      let n: Reg;
      if (r) {
        const cerrada = /^completad/.test(v.estado);
        n = await guardarRegistro('tareas', r.id, {
          titulo: v.titulo, desc: v.desc, fechaLimite: v.fechaLimite, hora: v.hora, prioridad: v.prioridad, estado: v.estado,
          etapaTarea: cerrada ? 'Hecho' : v.etapaTarea, reminder: v.reminder, reminderSent: false, clienteId, prospectoId,
        });
      } else {
        // Mismo formato que crea la agenda del CRM web
        const titulo = crear ? `${crear[2]} ${crear[1]}: ${v.titulo.trim()}` : v.titulo.trim();
        n = await guardarRegistro('tareas', null, {
          titulo, desc: v.desc || v.titulo, fechaLimite: v.fechaLimite, prioridad: v.prioridad || (crear ? 'Media' : ''),
          etapaTarea: 'Por hacer', fechaCreacion: hoyISO(), estado: 'pendiente', hora: v.hora, reminder: v.reminder,
          clienteId, prospectoId, ...(crear ? { tipoAgenda: crear[0] } : {}),
        });
      }
      ctx.poner('tareas', n);
      ctx.avisar(r ? '✓ Tarea guardada' : '✓ Creada');
      onCerrar();
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }

  async function eliminar() {
    if (!r) return;
    setOcupado(true);
    try {
      await eliminarTarea(r.id);
      ctx.quitar('tareas', r.id);
      ctx.avisar('Tarea eliminada');
      onCerrar();
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo eliminar.');
      setOcupado(false);
    }
  }

  async function rapido(cambios: Record<string, unknown>, aviso: string) {
    if (!r) return;
    setOcupado(true);
    try {
      ctx.poner('tareas', await guardarRegistro('tareas', r.id, cambios));
      ctx.avisar(aviso);
      onCerrar();
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }

  return (
    <Hoja titulo={r ? '✏️ Editar evento / tarea' : crear ? `${crear[2]} Nueva ${crear[1]}` : '➕ Nueva tarea / evento'} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <label className="campo"><span>Título *</span>
          <input value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })} maxLength={300} placeholder={crear?.[1]} /></label>
        <label className="campo"><span>Descripción / notas</span>
          <textarea value={v.desc} onChange={(e) => setV({ ...v, desc: e.target.value })} maxLength={3000} /></label>
        <div className="dos">
          <label className="campo"><span>Fecha</span>
            <input type="date" value={v.fechaLimite} onChange={(e) => setV({ ...v, fechaLimite: e.target.value })} /></label>
          <label className="campo"><span>Hora</span>
            <input type="time" value={v.hora} onChange={(e) => setV({ ...v, hora: e.target.value })} /></label>
        </div>
        <div className="dos">
          <label className="campo"><span>Prioridad</span>
            <select value={v.prioridad} onChange={(e) => setV({ ...v, prioridad: e.target.value })}>
              {!PRIORIDADES_AGENDA.some(([x]) => x === v.prioridad) && <option value={v.prioridad}>{v.prioridad}</option>}
              {PRIORIDADES_AGENDA.map(([x, l]) => <option key={x} value={x}>{l}</option>)}
            </select></label>
          <label className="campo"><span>Recordatorio 🔔</span>
            <select value={v.reminder} onChange={(e) => setV({ ...v, reminder: e.target.value })}>
              {[['ninguno', 'Sin recordatorio'], ['15', '15 min antes'], ['30', '30 min antes'], ['60', '1 hora antes'], ['120', '2 horas antes'], ['1440', '1 día antes']]
                .map(([x, l]) => <option key={x} value={x}>{l}</option>)}
            </select></label>
        </div>
        {r && (
          <div className="dos">
            <label className="campo"><span>Estado</span>
              <select value={v.estado} onChange={(e) => setV({ ...v, estado: e.target.value })}>
                {!['pendiente', 'en_proceso', 'completado', 'completada'].includes(v.estado) && <option value={v.estado}>{v.estado}</option>}
                <option value="pendiente">⏳ Pendiente</option><option value="en_proceso">🔄 En proceso</option>
                <option value="completado">✅ Completado</option>
                {v.estado === 'completada' && <option value="completada">✅ Completada</option>}
              </select></label>
            <label className="campo"><span>Etapa</span>
              <select value={v.etapaTarea} onChange={(e) => setV({ ...v, etapaTarea: e.target.value })}>
                {!Object.keys(COLOR_ETAPA_TAREA).includes(v.etapaTarea) && <option value={v.etapaTarea}>{v.etapaTarea}</option>}
                {Object.keys(COLOR_ETAPA_TAREA).filter((x) => x !== 'Eliminada').map((x) => <option key={x}>{x}</option>)}
              </select></label>
          </div>
        )}
        <fieldset className="grupo"><legend>Vincular a</legend>
          {v.vinculo ? (
            <button className="boton secundario" type="button" onClick={() => setV({ ...v, vinculo: '' })}>{nombreVinculo || 'Vinculado'} ✕</button>
          ) : (
            <>
              <input className="buscador" placeholder="Buscar cliente o prospecto" value={q} onChange={(e) => setQ(e.target.value)} />
              {candidatos.length > 0 && (
                <div className="lista">
                  {candidatos.map(([id, n, tipo]) => <Fila key={id} titulo={n} sub={tipo} onClick={() => { setV({ ...v, vinculo: id }); setQ(''); }} />)}
                </div>
              )}
            </>
          )}
        </fieldset>
        {error && <div className="error">{error}</div>}
        <div className="botonera">
          <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : '💾 Guardar'}</button>
          {r && tareaAbierta(r) && (
            <>
              <button className="boton secundario" type="button" disabled={ocupado} onClick={() => rapido({ etapaTarea: 'Hecho', estado: 'completada' }, '✓ Tarea completada')}>✓ Marcar realizada</button>
              <button className="boton secundario" type="button" disabled={ocupado} onClick={() => rapido({ fechaLimite: v.fechaLimite, etapaTarea: 'Reprogramada' }, '📅 Tarea reprogramada')}>📅 Reprogramar a la fecha elegida</button>
              <button className="boton secundario" type="button" disabled={ocupado} onClick={() => rapido({ etapaTarea: 'Cancelada', estado: 'cancelada' }, 'Tarea cancelada')}>Cancelar tarea</button>
            </>
          )}
          {enlaceAgregarGcal(v.titulo, v.fechaLimite, v.hora, v.desc) && (
            <a className="boton secundario" href={enlaceAgregarGcal(v.titulo, v.fechaLimite, v.hora, v.desc)!} target="_blank" rel="noopener noreferrer">📅 Agregar a Google Calendar</a>
          )}
          {r && !borrar && <button className="boton peligro" type="button" disabled={ocupado} onClick={() => setBorrar(true)}>🗑️ Eliminar</button>}
          {borrar && <button className="boton peligro" type="button" disabled={ocupado} onClick={eliminar}>Confirmar: eliminar definitivamente</button>}
        </div>
        {r && <><FichaCampos modulo="tareas" r={r} /></>}
      </form>
    </Hoja>
  );
}

/* ---------------- metas ---------------- */

function Metas({ ctx, onNueva, setMeta }: { ctx: Ctx; onNueva: () => void; setMeta: (k: 'calMetas', v: unknown) => void }) {
  const metas = ctx.cartera.meta.calMetas;
  const activas = metas.filter((x) => txt(x, 'estado') !== 'completada');
  const logros = metas.filter((x) => txt(x, 'estado') === 'completada');
  async function cambiar(id: string, accion: 'logro' | 'borrar') {
    try {
      const v = await guardarMeta<Reg[]>('calMetas', [], (l) => accion === 'borrar'
        ? l.filter((x) => x.id !== id)
        : l.map((x) => (x.id === id ? { ...x, estado: 'completada', fechaCompleta: hoyISO() } : x)));
      setMeta('calMetas', v);
      ctx.avisar(accion === 'borrar' ? 'Meta eliminada' : '⭐ ¡Logro registrado!');
    } catch (e) { ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.'); }
  }
  return (
    <>
      <button className="boton mas-abajo" type="button" onClick={onNueva}>+ Nueva meta</button>
      <h3 className="seccion">Metas activas</h3>
      {activas.length ? activas.map((mt) => {
        const pct = Math.round(((num(mt, 'tareasHechas') ?? 0) / Math.max(1, num(mt, 'tareasTotales') ?? 1)) * 100);
        const venc = fec(mt, 'fechaLimite') && fec(mt, 'fechaLimite') < hoyISO();
        return (
          <div key={mt.id} className="tarjeta">
            <div className="ag-meta-cab">
              <b>{txt(mt, 'titulo') || 'Meta'}</b>
              <span>
                <button type="button" className="mini" onClick={() => cambiar(mt.id, 'logro')}>✔ Logro</button>
                <button type="button" className="mini rojo" onClick={() => cambiar(mt.id, 'borrar')}>✕</button>
              </span>
            </div>
            {fec(mt, 'fechaLimite') && <p className={`contador${venc ? ' rojo' : ''}`}>📅 {fecha(fec(mt, 'fechaLimite'))}{venc ? ' — VENCIDA' : ''}</p>}
            <div className="barra"><div className="barra-relleno" style={{ width: `${pct}%` }} /></div>
            <p className="contador derecha">{pct}% completado</p>
          </div>
        );
      }) : <Vacio>No hay metas activas.</Vacio>}
      <h3 className="seccion">🏆 Logros</h3>
      {logros.length ? logros.map((mt) => (
        <div key={mt.id} className="ag-bloque" style={{ borderLeftColor: '#10B981' }}>
          ⭐ <b>{txt(mt, 'titulo')}</b>{fec(mt, 'fechaCompleta') && <small> · Completado {fecha(fec(mt, 'fechaCompleta'))}</small>}
        </div>
      )) : <p className="sincro">Aún no hay logros registrados</p>}
    </>
  );
}

function NuevaMeta({ ctx, setMeta, onCerrar }: { ctx: Ctx; setMeta: (k: 'calMetas', v: unknown) => void; onCerrar: () => void }) {
  const [t, setT] = useState('');
  const [f, setF] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!t.trim()) return;
    setOcupado(true);
    try {
      const v = await guardarMeta<Reg[]>('calMetas', [], (l) => [...l,
        { id: 'm' + Date.now(), titulo: t.trim(), fechaLimite: f, estado: 'activa', tareasHechas: 0, tareasTotales: 0 }]);
      setMeta('calMetas', v);
      ctx.avisar('✓ Meta creada');
      onCerrar();
    } catch (err) { ctx.avisar(err instanceof ErrorDatos ? err.message : 'No se pudo guardar.'); setOcupado(false); }
  }
  return (
    <Hoja titulo="Nueva meta" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <label className="campo"><span>Título de la meta</span><input value={t} onChange={(e) => setT(e.target.value)} maxLength={200} /></label>
        <label className="campo"><span>Fecha límite</span><input type="date" value={f} onChange={(e) => setF(e.target.value)} /></label>
        <div className="botonera"><button className="boton" type="submit" disabled={ocupado || !t.trim()}>Guardar</button></div>
      </form>
    </Hoja>
  );
}

/* ---------------- diario ---------------- */

type EntradaDiario = { ts: number | null; texto: string; clienteId?: string; prospectoId?: string; contactoLibre?: { nombre?: string; telefono?: string; email?: string } | null };

function entradas(diarios: Record<string, unknown>, clave: string): EntradaDiario[] {
  const v = diarios[clave];
  if (!v) return [];
  if (typeof v === 'string') return v.trim() ? [{ ts: null, texto: v }] : [];
  return Array.isArray(v) ? (v as EntradaDiario[]) : [];
}

function Diario({ ctx, y, m, d, setMeta, irFecha }: {
  ctx: Ctx; y: number; m: number; d: number; setMeta: (k: 'calDiarios', v: unknown) => void; irFecha: (f: string) => void;
}) {
  const clave = claveDiario(y, m, d);
  const [texto, setTexto] = useState('');
  const [vinculo, setVinculo] = useState('');
  const [otro, setOtro] = useState({ nombre: '', telefono: '', email: '' });
  const [hist, setHist] = useState(false);
  const [editar, setEditar] = useState<{ clave: string; ts: number; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const diarios = ctx.cartera.meta.calDiarios;

  const lista = hist
    ? Object.keys(diarios).flatMap((k) => {
      const mm = k.match(/^d_(\d+)_(\d+)_(\d+)$/);
      if (!mm) return [];
      return entradas(diarios, k).map((e) => ({ e, clave: k, f: iso(+mm[1], +mm[2] - 1, +mm[3]) }));
    }).sort((a, b) => (b.e.ts ?? 0) - (a.e.ts ?? 0))
    : entradas(diarios, clave).slice().reverse().map((e) => ({ e, clave, f: iso(y, m, d) }));

  async function escribir(cambiar: (v: Record<string, unknown>) => Record<string, unknown>, aviso: string) {
    setOcupado(true);
    try {
      const v = await guardarMeta<Record<string, unknown>>('calDiarios', {}, cambiar);
      setMeta('calDiarios', v);
      ctx.avisar(aviso);
      return true;
    } catch (e) {
      ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
      return false;
    } finally { setOcupado(false); }
  }

  async function guardar() {
    const t = texto.trim();
    if (!t) return ctx.avisar('Escribe algo antes de guardar');
    const entrada: EntradaDiario = {
      ts: Date.now(), texto: t,
      clienteId: vinculo.startsWith('c:') ? vinculo.slice(2) : '',
      prospectoId: vinculo.startsWith('p:') ? vinculo.slice(2) : '',
      contactoLibre: vinculo === 'otro' && (otro.nombre || otro.telefono || otro.email) ? otro : null,
    };
    // Se AGREGA como anotacion nueva; nunca se borra lo anterior.
    if (await escribir((v) => ({ ...v, [clave]: [...entradas(v, clave), entrada] }), 'Guardado ✓')) {
      setTexto('');
    }
  }

  const contacto = (e: EntradaDiario) => {
    const c = ctx.cartera.clientes.find((x) => x.id === e.clienteId) ?? ctx.cartera.prospectos.find((x) => x.id === e.prospectoId);
    const tel = c ? txt(c, 'cel') || txt(c, 'tel') : e.contactoLibre?.telefono;
    const mail = c ? txt(c, 'email') : e.contactoLibre?.email;
    return { nombre: c ? txt(c, 'nombre') : e.contactoLibre?.nombre, wa: enlaceWhatsApp(tel), mail: enlaceCorreo(mail) };
  };

  return (
    <>
      <div className="tarjeta ag-papel">
        <div className="ag-diario-fecha">{DNAMES[new Date(y, m, d).getDay()]}, {d} de {MESES[m]} de {y}</div>
        <div className="ag-frase">“{FRASES[d % FRASES.length]}”</div>
        <label className="campo"><span>Vincular a (opcional)</span>
          <select value={vinculo} onChange={(e) => setVinculo(e.target.value)}>
            <option value="">-- Sin vincular --</option>
            <option value="otro">Otro contacto...</option>
            <optgroup label="Clientes">{ctx.cartera.clientes.map((c) => <option key={c.id} value={'c:' + c.id}>{txt(c, 'nombre')}</option>)}</optgroup>
            <optgroup label="Prospectos">{ctx.cartera.prospectos.map((c) => <option key={c.id} value={'p:' + c.id}>{txt(c, 'nombre')}</option>)}</optgroup>
          </select></label>
        {vinculo === 'otro' && (
          <>
            <label className="campo"><span>Nombre del contacto</span><input value={otro.nombre} onChange={(e) => setOtro({ ...otro, nombre: e.target.value })} /></label>
            <label className="campo"><span>Teléfono (para WhatsApp)</span><input type="tel" value={otro.telefono} onChange={(e) => setOtro({ ...otro, telefono: e.target.value })} /></label>
            <label className="campo"><span>Email</span><input type="email" value={otro.email} onChange={(e) => setOtro({ ...otro, email: e.target.value })} /></label>
          </>
        )}
        <label className="campo"><span>Nueva anotación</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={5000}
            placeholder="Escribe una nueva anotación... (se guarda con fecha y hora, sin borrar lo anterior)" /></label>
        <button className="boton" type="button" disabled={ocupado} onClick={guardar}>💾 Guardar anotación</button>
      </div>
      <button className="boton secundario mas-abajo" type="button" onClick={() => setHist(!hist)}>
        {hist ? '📅 Ver día actual' : '🕐 Ver anotaciones anteriores'}
      </button>
      {lista.length ? lista.map(({ e, clave: k, f }, i) => {
        const c = contacto(e);
        return (
          <div key={k + (e.ts ?? i)} className="ag-anot" onClick={hist ? () => { setHist(false); irFecha(f); } : undefined}>
            <div className="ag-anot-cuando">
              {e.ts ? new Date(e.ts).toLocaleString('es-PA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : hist ? fecha(f) : 'Anotación anterior (sin hora registrada)'}
            </div>
            <div className="texto-largo">{e.texto}</div>
            {c.nombre && <div className="contador">👤 {c.nombre}</div>}
            <div className="ag-anot-botones" onClick={(ev) => ev.stopPropagation()}>
              {c.wa && <a className="mini" href={c.wa} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>}
              {c.mail && <a className="mini" href={c.mail}>✉️ Email</a>}
              {e.ts && <button className="mini" type="button" onClick={() => setEditar({ clave: k, ts: e.ts as number, texto: e.texto })}>✎ Editar</button>}
              {e.ts && <button className="mini rojo" type="button" disabled={ocupado}
                onClick={() => escribir((v) => ({ ...v, [k]: entradas(v, k).filter((x) => x.ts !== e.ts) }), 'Anotación eliminada')}>🗑</button>}
            </div>
          </div>
        );
      }) : <Vacio>{hist ? 'Sin anotaciones anteriores' : 'Sin anotaciones todavía para este día.'}</Vacio>}
      {editar && (
        <Hoja titulo="Editar anotación" onCerrar={() => setEditar(null)}>
          <label className="campo"><span>Anotación</span>
            <textarea value={editar.texto} onChange={(e) => setEditar({ ...editar, texto: e.target.value })} maxLength={5000} /></label>
          <div className="botonera">
            <button className="boton" type="button" disabled={ocupado || !editar.texto.trim()} onClick={async () => {
              const ok = await escribir((v) => ({ ...v, [editar.clave]: entradas(v, editar.clave).map((x) => (x.ts === editar.ts ? { ...x, texto: editar.texto.trim() } : x)) }), 'Anotación actualizada');
              if (ok) setEditar(null);
            }}>Guardar</button>
          </div>
        </Hoja>
      )}
    </>
  );
}

/* ---------------- reuniones ---------------- */

function Reuniones({ ctx, fecha: f, soloDia, onEditar }: { ctx: Ctx; fecha: string; soloDia?: boolean; onEditar: (r: Reg) => void }) {
  const todas = ctx.cartera.meta.calReuniones;
  const delDia = todas.filter((r) => txt(r, 'fecha') === f).sort((a, b) => txt(a, 'hora').localeCompare(txt(b, 'hora')));
  const futuras = todas.filter((r) => txt(r, 'fecha') > f).sort((a, b) => (txt(a, 'fecha') + txt(a, 'hora')).localeCompare(txt(b, 'fecha') + txt(b, 'hora')));
  if (soloDia && !delDia.length) return null;
  return (
    <>
      <h3 className="seccion">Reuniones del día</h3>
      {delDia.length ? delDia.map((r) => <TarjetaReunion key={r.id} ctx={ctx} r={r} onEditar={onEditar} />)
        : <Vacio>👥 No hay reuniones para este día.</Vacio>}
      {!soloDia && futuras.length > 0 && (
        <>
          <h3 className="seccion">📅 Próximas reuniones ({futuras.length})</h3>
          {futuras.map((r) => <TarjetaReunion key={r.id} ctx={ctx} r={r} onEditar={onEditar} conFecha />)}
        </>
      )}
    </>
  );
}

function TarjetaReunion({ ctx, r, onEditar, conFecha }: { ctx: Ctx; r: Reg; onEditar: (r: Reg) => void; conFecha?: boolean }) {
  const cl = ctx.cartera.clientes.find((c) => c.id === txt(r, 'clienteId'));
  const msg = `Hola! Te recuerdo nuestra reunión: ${txt(r, 'titulo')}${txt(r, 'hora') ? ' a las ' + txt(r, 'hora') : ''}${txt(r, 'lugar') ? ' en ' + txt(r, 'lugar') : ''}.`;
  const waBase = enlaceWhatsApp(txt(cl, 'cel') || txt(cl, 'tel'));
  const zoom = txt(r, 'zoom');
  return (
    <div className="tarjeta ag-reun" onClick={() => onEditar(r)}>
      <div className="chips">
        {conFecha && <span className="chip ambar">📅 {fecha(txt(r, 'fecha'))}</span>}
        {txt(r, 'hora') && <span className="chip azul">🕐 {txt(r, 'hora')}</span>}
      </div>
      <b>{txt(r, 'titulo')}</b>
      {txt(r, 'tipo') === 'virtual'
        ? zoom && /^https:\/\//.test(zoom) && <div className="contador">🔗 <a href={zoom} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{zoom}</a></div>
        : txt(r, 'lugar') && <div className="contador">📍 {txt(r, 'lugar')}</div>}
      {txt(r, 'partic') && <div className="contador">👥 {txt(r, 'partic')}</div>}
      {txt(r, 'notas') && <div className="contador"><i>{txt(r, 'notas')}</i></div>}
      {cl && <span className="chip">👤 {txt(cl, 'nombre')}</span>}
      {waBase && (
        <div className="ag-anot-botones" onClick={(e) => e.stopPropagation()}>
          <a className="mini verde" href={`${waBase}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">💬 Recordar por WhatsApp</a>
        </div>
      )}
    </div>
  );
}

function EditarReunion({ ctx, r, fecha: f, setMeta, onCerrar }: {
  ctx: Ctx; r: Reg | null; fecha: string; setMeta: (k: 'calReuniones', v: unknown) => void; onCerrar: () => void;
}) {
  const [v, setV] = useState({
    titulo: txt(r, 'titulo'), fecha: txt(r, 'fecha') || f, hora: txt(r, 'hora'), tipo: txt(r, 'tipo') || 'presencial',
    lugar: txt(r, 'lugar'), zoom: txt(r, 'zoom'), partic: txt(r, 'partic'), clienteId: txt(r, 'clienteId'), notas: txt(r, 'notas'),
  });
  const [ocupado, setOcupado] = useState(false);
  const [borrar, setBorrar] = useState(false);
  async function escribir(cambiar: (l: Reg[]) => Reg[], aviso: string) {
    setOcupado(true);
    try {
      setMeta('calReuniones', await guardarMeta<Reg[]>('calReuniones', [], cambiar));
      ctx.avisar(aviso);
      onCerrar();
    } catch (e) { ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.'); setOcupado(false); }
  }
  function guardar(e: FormEvent) {
    e.preventDefault();
    if (!v.titulo.trim()) return ctx.avisar('El título es requerido');
    if (v.zoom && !/^https:\/\//.test(v.zoom)) return ctx.avisar('El link de Zoom debe empezar con https://');
    const datos = { ...v, titulo: v.titulo.trim() };
    void escribir((l) => (r ? l.map((x) => (x.id === r.id ? { id: r.id, ...datos } : x)) : [...l, { id: 'r' + Date.now(), ...datos }]),
      v.fecha !== f ? `✓ Reunión guardada para el ${fecha(v.fecha)}` : '✓ Reunión guardada');
  }
  return (
    <Hoja titulo={r ? 'Editar reunión' : 'Nueva reunión'} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <label className="campo"><span>Título *</span><input value={v.titulo} onChange={(e) => setV({ ...v, titulo: e.target.value })} maxLength={200} /></label>
        <div className="dos">
          <label className="campo"><span>Fecha *</span><input type="date" value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} /></label>
          <label className="campo"><span>Hora</span><input type="time" value={v.hora} onChange={(e) => setV({ ...v, hora: e.target.value })} /></label>
        </div>
        <label className="campo"><span>Tipo de reunión</span>
          <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value })}>
            <option value="presencial">Presencial</option><option value="virtual">Virtual (Zoom)</option>
          </select></label>
        {v.tipo === 'virtual'
          ? <label className="campo"><span>Link de Zoom</span><input type="url" value={v.zoom} onChange={(e) => setV({ ...v, zoom: e.target.value })} placeholder="https://zoom.us/j/..." /></label>
          : <label className="campo"><span>Dirección</span><input value={v.lugar} onChange={(e) => setV({ ...v, lugar: e.target.value })} /></label>}
        <label className="campo"><span>Participantes</span><input value={v.partic} onChange={(e) => setV({ ...v, partic: e.target.value })} /></label>
        <label className="campo"><span>Cliente (opcional)</span>
          <select value={v.clienteId} onChange={(e) => setV({ ...v, clienteId: e.target.value })}>
            <option value="">-- Sin cliente --</option>
            {ctx.cartera.clientes.map((c) => <option key={c.id} value={c.id}>{txt(c, 'nombre')}</option>)}
          </select></label>
        <label className="campo"><span>Comentarios</span><textarea value={v.notas} onChange={(e) => setV({ ...v, notas: e.target.value })} /></label>
        <div className="botonera">
          <button className="boton" type="submit" disabled={ocupado}>Guardar</button>
          {r && !borrar && <button className="boton peligro" type="button" onClick={() => setBorrar(true)}>🗑 Eliminar</button>}
          {r && borrar && <button className="boton peligro" type="button" disabled={ocupado}
            onClick={() => escribir((l) => l.filter((x) => x.id !== r.id), 'Reunión eliminada')}>Confirmar: eliminar</button>}
        </div>
      </form>
    </Hoja>
  );
}

/* ---------------- notas ---------------- */

const COLORES_NOTA = ['#FEF9C3', '#DCFCE7', '#DBEAFE', '#FCE7F3', '#FEE2E2', '#EDE9FE'];

function Notas({ ctx, fecha: f, onEditar }: { ctx: Ctx; fecha: string; onEditar: (r: Reg | null) => void }) {
  const notas = ctx.cartera.meta.calNotas.filter((n) => txt(n, 'fecha') === f);
  return (
    <>
      <button className="boton mas-abajo" type="button" onClick={() => onEditar(null)}>+ Nueva nota</button>
      {notas.length ? (
        <div className="ag-notas">
          {notas.map((n) => (
            <button key={n.id} type="button" className="ag-nota" style={{ background: txt(n, 'color') || '#FEF9C3' }} onClick={() => onEditar(n)}>
              {txt(n, 'texto')}
            </button>
          ))}
        </div>
      ) : <Vacio>📋 No hay notas para este día.</Vacio>}
    </>
  );
}

function EditarNota({ ctx, r, fecha: f, setMeta, onCerrar }: {
  ctx: Ctx; r: Reg | null; fecha: string; setMeta: (k: 'calNotas', v: unknown) => void; onCerrar: () => void;
}) {
  const [texto, setTexto] = useState(txt(r, 'texto'));
  const [color, setColor] = useState(txt(r, 'color') || COLORES_NOTA[0]);
  const [ocupado, setOcupado] = useState(false);
  async function escribir(cambiar: (l: Reg[]) => Reg[], aviso: string) {
    setOcupado(true);
    try {
      setMeta('calNotas', await guardarMeta<Reg[]>('calNotas', [], cambiar));
      ctx.avisar(aviso);
      onCerrar();
    } catch (e) { ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.'); setOcupado(false); }
  }
  return (
    <Hoja titulo={r ? 'Editar nota' : 'Nueva nota'} onCerrar={onCerrar}>
      <label className="campo"><span>Nota *</span><textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={5} maxLength={3000} /></label>
      <div className="campo"><span className="etq">Color</span>
        <div className="ag-colores">
          {COLORES_NOTA.map((c) => (
            <button key={c} type="button" aria-label={`Color ${c}`} className={c === color ? 'sel' : ''} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>
      </div>
      <div className="botonera">
        <button className="boton" type="button" disabled={ocupado || !texto.trim()} onClick={() => escribir(
          (l) => (r ? l.map((x) => (x.id === r.id ? { id: r.id, texto, color, fecha: f } : x)) : [...l, { id: 'n' + Date.now(), texto, color, fecha: f }]),
          '✓ Nota guardada')}>Guardar</button>
        {r && <button className="boton peligro" type="button" disabled={ocupado} onClick={() => escribir((l) => l.filter((x) => x.id !== r.id), 'Nota eliminada')}>Eliminar</button>}
      </div>
    </Hoja>
  );
}

/* ---------------- alertas (igual que jacAlertas del CRM web) ---------------- */

function Alertas({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const a = useMemo(() => {
    const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
    const dias = (f: string) => { const d = new Date(f + 'T12:00:00'); d.setHours(0, 0, 0, 0); return Math.round((d.getTime() - hoy0.getTime()) / 864e5); };
    const ren: Array<{ d: number; r: Reg }> = [];
    const pag: Array<{ monto: number; d: number | null; r: Reg }> = [];
    for (const p of cartera.polizas) {
      if (polizaCancelada(p)) continue;
      const ff = fec(p, 'fechaFin') || fec(p, 'vencimiento');
      if (ff) { const d = dias(ff); if (d <= 30 && d >= -30) ren.push({ d, r: p }); }
      const saldo = num(p, 'saldo') ?? 0;
      if (saldo > 0.05 && !/pagad/i.test(txt(p, 'estadoCartera'))) {
        const v = fec(p, 'fechaFact') || ff;
        pag.push({ monto: saldo, d: v ? dias(v) : null, r: p });
      }
    }
    const tar = cartera.tareas.filter((t) => !/^complet/i.test(txt(t, 'estado')) && fec(t, 'fechaLimite') && dias(fec(t, 'fechaLimite')) <= 0)
      .map((t) => ({ d: dias(fec(t, 'fechaLimite')), r: t }));
    const cum: Array<{ d: number; r: Reg; edad: number }> = [];
    const h = new Date();
    for (const c of cartera.clientes) {
      const fn = fec(c, 'fNac') || fec(c, 'fechaNac'); if (!fn) continue;
      const [yy, mm, dd] = fn.split('-').map(Number);
      let prox = new Date(h.getFullYear(), mm - 1, dd);
      if (prox < hoy0) prox = new Date(h.getFullYear() + 1, mm - 1, dd);
      const d = Math.round((prox.getTime() - hoy0.getTime()) / 864e5);
      if (d <= 7) cum.push({ d, r: c, edad: prox.getFullYear() - yy });
    }
    ren.sort((x, y) => x.d - y.d); pag.sort((x, y) => y.monto - x.monto); tar.sort((x, y) => x.d - y.d); cum.sort((x, y) => x.d - y.d);
    return { ren, pag, tar, cum };
  }, [cartera]);
  const cuando = (d: number) => (d < 0 ? `venció hace ${-d} día${d === -1 ? '' : 's'}` : d === 0 ? 'hoy' : `en ${d} día${d === 1 ? '' : 's'}`);
  const total = a.ren.length + a.pag.length + a.tar.length + a.cum.length;
  if (!total) return <Vacio>Sin alertas por ahora ✨</Vacio>;
  return (
    <>
      <p className="contador">Renovaciones, pagos, tareas y cumpleaños · {total}</p>
      {a.ren.length > 0 && <GrupoAlerta titulo="Renovaciones" color="#D97706" n={a.ren.length}>
        {a.ren.slice(0, 40).map(({ d, r }) => (
          <Fila key={r.id} titulo={txt(r, 'nombreCliente') || '(sin cliente)'} sub={`${txt(r, 'num') || '(sin nº)'} · ${txt(r, 'aseg')} · ${cuando(d)}`}
            onClick={() => ctx.abrir('polizas', r.id)} />
        ))}</GrupoAlerta>}
      {a.pag.length > 0 && <GrupoAlerta titulo="Pagos pendientes" color="#DC2626" n={a.pag.length}>
        {a.pag.slice(0, 40).map(({ monto, d, r }) => (
          <Fila key={r.id} titulo={`${dinero(monto)} · ${txt(r, 'nombreCliente') || '(sin cliente)'}`}
            sub={`${txt(r, 'num')} · ${txt(r, 'aseg')}${d !== null ? ' · ' + cuando(d) : ''}`} onClick={() => ctx.abrir('polizas', r.id)} />
        ))}</GrupoAlerta>}
      {a.tar.length > 0 && <GrupoAlerta titulo="Tareas vencidas o de hoy" color="#7C3AED" n={a.tar.length}>
        {a.tar.slice(0, 40).map(({ d, r }) => (
          <Fila key={r.id} titulo={txt(r, 'titulo') || txt(r, 'desc') || 'Tarea'} sub={cuando(d)} onClick={() => ctx.abrir('tareas', r.id)} />
        ))}</GrupoAlerta>}
      {a.cum.length > 0 && <GrupoAlerta titulo="Cumpleaños" color="#DB2777" n={a.cum.length}>
        {a.cum.map(({ d, r, edad }) => (
          <Fila key={r.id} titulo={`🎂 ${txt(r, 'nombre')}`} sub={`${d === 0 ? 'hoy' : `en ${d} día${d === 1 ? '' : 's'}`} · cumple ${edad}`}
            onClick={() => ctx.abrir('clientes', r.id)} />
        ))}</GrupoAlerta>}
    </>
  );
}

function GrupoAlerta({ titulo, color, n, children }: { titulo: string; color: string; n: number; children: React.ReactNode }) {
  return (
    <>
      <h3 className="seccion"><span className="punto" style={{ background: color }} /> {titulo} <span className="etiqueta e-neutra">{n}</span></h3>
      <div className="lista">{children}</div>
    </>
  );
}

/* ---------------- historial de la agenda ---------------- */

function HistorialAgenda({ ctx }: { ctx: Ctx }) {
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [tipo, setTipo] = useState('');
  const items = useMemo(() => {
    const out: Array<{ tipo: string; fecha: string; texto: string; etapa: string; color: string; id: string }> = [];
    for (const t of ctx.cartera.tareas) {
      const e = txt(t, 'etapaTarea');
      if (!['Hecho', 'Cancelada', 'Reprogramada', 'Eliminada'].includes(e)) continue;
      out.push({ tipo: 'tarea', fecha: fec(t, 'fechaLimite') || fec(t, 'fechaCreacion'), texto: txt(t, 'texto') || txt(t, 'titulo') || '(tarea sin texto)', etapa: e, color: COLOR_ETAPA_TAREA[e] ?? '#94A3B8', id: t.id });
    }
    const hoy = hoyISO();
    for (const r of ctx.cartera.meta.calReuniones) {
      const f = txt(r, 'fecha');
      if (f && f < hoy) out.push({ tipo: 'reunion', fecha: f, texto: txt(r, 'titulo') || txt(r, 'notas') || '(reunión)', etapa: txt(r, 'tipo') || 'Reunión', color: '#2563EB', id: r.id });
    }
    for (const k of Object.keys(ctx.cartera.meta.calDiarios)) {
      const m = k.match(/^d_(\d+)_(\d+)_(\d+)$/);
      const f = m ? iso(+m[1], +m[2] - 1, +m[3]) : '';
      entradas(ctx.cartera.meta.calDiarios, k).forEach((e, i) => out.push({ tipo: 'diario', fecha: f, texto: e.texto || '(sin texto)', etapa: 'Diario', color: '#CA8A04', id: k + '_' + (e.ts ?? i) }));
    }
    for (const n of ctx.cartera.meta.calNotas) out.push({ tipo: 'nota', fecha: txt(n, 'fecha'), texto: txt(n, 'texto') || '(sin texto)', etapa: 'Nota', color: '#CA8A04', id: n.id });
    return out.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [ctx.cartera]);
  const t = q.toLowerCase();
  const lista = items.filter((it) => (!tipo || it.tipo === tipo) && (!desde || !it.fecha || it.fecha >= desde) && (!hasta || !it.fecha || it.fecha <= hasta) && (!t || it.texto.toLowerCase().includes(t)));
  const ic: Record<string, string> = { tarea: '✅', reunion: '🤝', diario: '📓', nota: '📝' };
  return (
    <>
      <input className="buscador" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="dos">
        <label className="campo"><span>Desde</span><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label className="campo"><span>Hasta</span><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
      </div>
      <label className="campo"><span>Tipo</span>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos</option><option value="tarea">Tareas</option><option value="reunion">Reuniones</option>
          <option value="diario">Diario</option><option value="nota">Notas</option>
        </select></label>
      <p className="contador">{lista.length} resultado(s)</p>
      {lista.length ? lista.slice(0, 300).map((it) => (
        <div key={it.tipo + it.id} className="ag-bloque" style={{ borderLeftColor: it.color }}>
          <div className="ag-hist-cab"><span style={{ color: it.color }}>{ic[it.tipo]} {it.etapa}</span><small>{fecha(it.fecha)}</small></div>
          <div className="texto-largo">{it.texto}</div>
        </div>
      )) : <Vacio>Sin resultados</Vacio>}
    </>
  );
}

/* ---------------- 💰 Cobros (calRenderCobros del CRM web) ---------------- */

function Cobros({ ctx }: { ctx: Ctx }) {
  const c = ctx.cartera;
  const coms = c.tareas.filter((t) => t._autoTipo === 'comision' && txt(t, 'estado') !== 'completada');
  const pags = c.pagos.filter((p) => !txt(p, 'estado') || txt(p, 'estado') === 'Pendiente');
  if (!coms.length && !pags.length) return <Vacio>Sin cobros pendientes 🎉</Vacio>;
  return (
    <>
      {coms.length > 0 && (
        <>
          <h3 className="seccion">Comisiones por cobrar ({coms.length})</h3>
          <div className="lista">
            {coms.map((t) => <Fila key={t.id} titulo={txt(t, 'titulo') || txt(t, 'desc')} sub={txt(t, 'desc')} onClick={() => ctx.abrir('tareas', t.id)} />)}
          </div>
        </>
      )}
      {pags.length > 0 && (
        <>
          <h3 className="seccion">Pagos pendientes de clientes ({pags.length})</h3>
          <div className="lista">
            {pags.map((p) => {
              const pol = c.polizas.find((x) => x.id === txt(p, 'polizaId'));
              const cl = pol ? c.clientes.find((x) => x.id === txt(pol, 'clienteId')) : undefined;
              const nom = cl ? txt(cl, 'nombre') : txt(p, 'cliente') || 'Cliente';
              const dp = datosPago(p, c);
              const msg = `Hola ${nom.split(' ')[0]}, le contacto de JAC Seguros por pago pendiente.`;
              return (
                <Fila key={p.id} titulo={nom}
                  sub={[cl ? txt(cl, 'cedula') : txt(pol, 'cedCliente'), txt(pol, 'aseg'), num(p, 'monto') ? dinero(num(p, 'monto')) : ''].filter(Boolean).join(' · ')}
                  onClick={() => (cl ? ctx.abrir('clientes', cl.id) : ctx.abrir('pagos', p.id))}
                  acciones={(
                    <>
                      <BotonesContacto ctx={ctx} d={{ ...dp, wa: [{ motivo: 'Pago pendiente', msg }, ...(dp.wa ?? [])] }} />
                    </>
                  )} />
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

/** 💬 / 📧 del cliente o prospecto relacionado con un evento de la agenda */
function ContactoDe({ ctx, d }: { ctx: Ctx; d: Datos | null }) {
  if (!d) return null;
  return <div className="fila-acciones"><BotonesContacto ctx={ctx} d={d} /></div>;
}
