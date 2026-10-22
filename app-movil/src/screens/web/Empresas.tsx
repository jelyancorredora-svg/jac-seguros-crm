import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Icono } from '../../components/Icono';
import { Fila, Hoja, Vacio, inicial } from '../../components/Piezas';
import { ListaLarga } from '../../components/Registro';
import { actualizarCon, ErrorDatos, guardarMeta, num, txt, type Reg } from '../../lib/datos';
import {
  asegurados, claveAsegurado, coincide, colorAseg, enlaceSeguro, esColectiva, estadoPoliza, msgAsegurado, msgAseguradora,
  msgCobro, msgEmpresa, msgRenovacion, nombreCorto, nombreTres, pct, polizasDeAseguradora, quitarAsegurado,
  reemplazarAsegurado, waTexto, type Aseguradora, type Asegurado,
} from '../../lib/empresas';
import { dinero, enlaceCorreo, esCorreo, fecha, limpiarTexto, normalizar, nuevoId } from '../../lib/formato';
import { esEmpresa } from '../../lib/reglas';
import { AccionesFila, NuevoRegistro, polizasPorCliente, type Ctx } from '../Modulos';

/* Replica de "🏢 Empresas & Colectivos" (pg-emp) y "🏛 Aseguradoras" (pg-aseg) del CRM web */

type Tab = 'emp' | 'col' | 'asd' | 'aseg';
type FormAsd = { polId: string | null; a: Asegurado | null };
type BorrarAsd = { polId: string; a: Asegurado };

const prima = (p: Reg) => num(p, 'prima') ?? 0;
const clienteDe = (ctx: Ctx, p: Reg) => ctx.cartera.clientes.find((c) => c.id === txt(p, 'clienteId'));
const nombreEmpresa = (ctx: Ctx, p: Reg) => txt(clienteDe(ctx, p), 'nombre') || txt(p, 'nombreCliente');

function Buscar({ q, setQ, ph }: { q: string; setQ: (s: string) => void; ph: string }) {
  return (
    <input className="buscador" type="search" placeholder={ph} value={q} onChange={(e) => setQ(e.target.value)}
      autoCapitalize="none" spellCheck={false} maxLength={80} />
  );
}

function Flotante({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button className="flotante" type="button" aria-label={texto} onClick={onClick}>
      <Icono nombre="mas" tam={26} />
    </button>
  );
}

function EnlaceWA({ href, texto = '💬', etiqueta, clase = 'icono-accion emp-wa' }: { href: string | null; texto?: string; etiqueta: string; clase?: string }) {
  if (!href) return null;
  return <a className={clase} href={href} target="_blank" rel="noopener noreferrer" aria-label={etiqueta}>{texto}</a>;
}

export function Empresas({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const [tab, setTab] = useState<Tab>('emp');
  const [asdLista, setAsdLista] = useState<string | null>(null);
  const [asdForm, setAsdForm] = useState<FormAsd | null>(null);
  const [asdBorrar, setAsdBorrar] = useState<BorrarAsd | null>(null);
  const [asegForm, setAsegForm] = useState<Aseguradora | 'nueva' | null>(null);
  const [asegBorrar, setAsegBorrar] = useState<Aseguradora | null>(null);
  const [nueva, setNueva] = useState<'empresa' | 'poliza' | null>(null);

  const emp = useMemo(() => cartera.clientes.filter(esEmpresa), [cartera.clientes]);
  const col = useMemo(() => cartera.polizas.filter(esColectiva), [cartera.polizas]);
  const totAsd = useMemo(() => cartera.polizas.reduce((s, p) => s + asegurados(p).length, 0), [cartera.polizas]);
  const asegs = cartera.meta.aseguradoras as Aseguradora[];

  const kpis: Array<[Tab, number, string, string]> = [
    ['emp', emp.length, 'Empresas', '🏢'], ['col', col.length, 'Colectivas', '👥'],
    ['asd', totAsd, 'Asegurados', '📋'], ['aseg', asegs.length, 'Aseguradoras', '🏛'],
  ];

  return (
    <>
      <p className="contador">
        {tab === 'aseg' ? `${asegs.length} aseguradoras · 21 habilitadas en Panamá` : `${emp.length} empresas · ${col.length} pólizas colectivas`}
      </p>
      <div className="kpis kpis-4" role="tablist">
        {kpis.map(([k, n, t, ico]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`kpi${tab === k ? ' kpi-sel' : ''}`} onClick={() => setTab(k)}>
            <b>{n}</b><span className="emp-kpi-t"><i aria-hidden="true">{ico}</i>{t}</span>
          </button>
        ))}
      </div>

      {tab === 'emp' && <TabEmpresas ctx={ctx} emp={emp} onNueva={() => setNueva('empresa')} />}
      {tab === 'col' && <TabColectivas ctx={ctx} col={col} verAsd={setAsdLista} onNueva={() => setNueva('poliza')} />}
      {tab === 'asd' && <TabAsegurados ctx={ctx} editar={(polId, a) => setAsdForm({ polId, a })} borrar={(polId, a) => setAsdBorrar({ polId, a })}
        nuevo={() => setAsdForm({ polId: null, a: null })} hayColectivas={col.length > 0} />}
      {tab === 'aseg' && <TabAseguradoras ctx={ctx} asegs={asegs} editar={setAsegForm} borrar={setAsegBorrar} />}

      {asdLista && !asdForm && !asdBorrar && (
        <ListaAsegurados ctx={ctx} polId={asdLista} onCerrar={() => setAsdLista(null)}
          nuevo={() => setAsdForm({ polId: asdLista, a: null })}
          editar={(a) => setAsdForm({ polId: asdLista, a })} borrar={(a) => setAsdBorrar({ polId: asdLista, a })} />
      )}
      {asdForm && <FormAsegurado ctx={ctx} {...asdForm} colectivas={col} onCerrar={() => setAsdForm(null)} />}
      {asdBorrar && <BorrarAsegurado ctx={ctx} {...asdBorrar} onCerrar={() => setAsdBorrar(null)} />}
      {asegForm && <FormAseguradora ctx={ctx} a={asegForm === 'nueva' ? null : asegForm} onCerrar={() => setAsegForm(null)} />}
      {asegBorrar && <BorrarAseguradora ctx={ctx} a={asegBorrar} onCerrar={() => setAsegBorrar(null)} />}
      {nueva === 'empresa' && (
        <NuevoRegistro ctx={ctx} modulo="clientes" titulo="Nueva empresa" base={{ tipo: 'Empresa', tipoDoc: 'RUC' }}
          onCerrar={() => setNueva(null)} />
      )}
      {nueva === 'poliza' && (
        <NuevoRegistro ctx={ctx} modulo="polizas" titulo="Nueva póliza colectiva" base={{ ramo: 'SALUD/MÉDICOS', asegurados: [] }}
          onCerrar={() => setNueva(null)} />
      )}
    </>
  );
}

/* ====================== 🏢 Empresas ====================== */

function TabEmpresas({ ctx, emp, onNueva }: { ctx: Ctx; emp: Reg[]; onNueva: () => void }) {
  const [q, setQ] = useState('');
  const pols = useMemo(() => polizasPorCliente(ctx.cartera), [ctx.cartera]);
  const t = normalizar(q);
  const lista = emp.filter((c) => coincide(t, txt(c, 'nombre'), txt(c, 'cedula'), txt(c, 'email'), txt(c, 'ciudad'), txt(c, 'cel')));
  const primaDe = (c: Reg) => (pols.get(c.id) ?? []).reduce((s, p) => s + prima(p), 0);
  const total = lista.reduce((s, c) => s + primaDe(c), 0);
  return (
    <>
      <Buscar q={q} setQ={setQ} ph="Empresa, RUC, correo, celular o ciudad" />
      <p className="contador">
        {lista.length === emp.length ? `${emp.length} empresas` : `${lista.length} de ${emp.length} empresas`} · Prima {dinero(total)}
      </p>
      <ListaLarga items={lista} vacio="Sin empresas" render={(c) => {
        const ps = pols.get(c.id) ?? [];
        const tel = txt(c, 'cel') || txt(c, 'tel');
        const correo = enlaceCorreo(txt(c, 'email'));
        return (
          <Fila key={c.id} inicial={inicial(txt(c, 'nombre'))} titulo={txt(c, 'nombre') || 'Sin nombre'}
            sub={<>
              {[txt(c, 'cedula'), tel, txt(c, 'ciudad')].filter(Boolean).join(' · ') || '—'}
              <span className="emp-linea">
                <span className={`etiqueta ${ps.length ? 'e-ok' : 'e-neutra'}`}>{ps.length ? `${ps.length} pólizas` : 'Sin pólizas'}</span>
                <b>{dinero(primaDe(c))}</b>
              </span>
            </>}
            onClick={() => ctx.abrir('clientes', c.id)}
            acciones={<>
              <EnlaceWA href={waTexto(tel, msgEmpresa(txt(c, 'nombre')))} etiqueta={`WhatsApp a ${txt(c, 'nombre')}`} />
              {correo && <a className="icono-accion" href={correo} aria-label={`Correo a ${txt(c, 'nombre')}`}>📧</a>}
              <AccionesFila ctx={ctx} modulo="clientes" r={c} />
            </>} />
        );
      }} />
      <Flotante texto="Nueva empresa" onClick={onNueva} />
    </>
  );
}

/* ====================== 👥 Pólizas colectivas ====================== */

const RAMOS: Array<[string, string]> = [['', 'Todas'], ['SALUD/MÉDICOS', '🏥 Salud'], ['VIDA', '❤️ Vida'], ['ACCIDENTES PERSONALES', '🩹 Acc. personales']];

function TabColectivas({ ctx, col, verAsd, onNueva }: { ctx: Ctx; col: Reg[]; verAsd: (id: string) => void; onNueva: () => void }) {
  const [q, setQ] = useState('');
  const [ramo, setRamo] = useState('');
  const t = normalizar(q);
  const lista = col.filter((p) => (!ramo || txt(p, 'ramo') === ramo) &&
    coincide(t, txt(p, 'num'), nombreEmpresa(ctx, p), txt(p, 'aseg'), txt(p, 'ramo')));
  const total = lista.reduce((s, p) => s + prima(p), 0);
  const nAsd = lista.reduce((s, p) => s + asegurados(p).length, 0);
  return (
    <>
      <Buscar q={q} setQ={setQ} ph="Póliza, empresa o aseguradora" />
      <div className="filtros">
        {RAMOS.map(([k, n]) => (
          <button key={k} type="button" className={ramo === k ? 'activa' : ''} onClick={() => setRamo(k)}>
            {n} ({k ? col.filter((p) => txt(p, 'ramo') === k).length : col.length})
          </button>
        ))}
      </div>
      <p className="contador">
        {lista.length === col.length ? `${col.length} pólizas colectivas` : `${lista.length} de ${col.length} pólizas colectivas`} · Prima {dinero(total)} · {nAsd} asegurados
      </p>
      <Paginada items={lista} vacio="Sin pólizas colectivas" render={(p) => {
        const cl = clienteDe(ctx, p);
        const nombre = nombreEmpresa(ctx, p);
        const tel = txt(cl, 'cel') || txt(cl, 'tel') || txt(p, 'celCliente');
        const correo = enlaceCorreo(txt(cl, 'email'));
        const est = estadoPoliza(p);
        const n = asegurados(p).length;
        return (
          <div key={p.id} className="emp-pol">
            <button type="button" className="emp-pol-cuerpo" onClick={() => ctx.abrir('polizas', p.id)}>
              <div className="emp-pol-cab">
                <span className={`etiqueta ${est.clase}`}>{est.texto}</span>
                <span className="emp-num">{txt(p, 'num') || '—'}</span>
                <b className="emp-aseg" style={{ color: colorAseg(txt(p, 'aseg')) }}>{txt(p, 'aseg')}</b>
              </div>
              <div className="fila-titulo">{nombreTres(nombre)}</div>
              <div className="emp-pol-pie">
                <span className="fila-sub">{txt(p, 'ramo')} · Vence {fecha(txt(p, 'fechaFin').slice(0, 10))}</span>
                <b>{dinero(prima(p))}</b>
              </div>
            </button>
            <div className="emp-botones">
              <button type="button" className="mini" onClick={() => verAsd(p.id)}>{n ? `📋 ${n} aseg.` : '+ Asegurado'}</button>
              <EnlaceWA href={waTexto(tel, msgRenovacion(p, nombre))} texto="💬 Reno." clase="mini verde" etiqueta="WhatsApp de renovación" />
              <EnlaceWA href={waTexto(tel, msgCobro(p, nombre))} texto="💬 Cobro" clase="mini verde" etiqueta="WhatsApp de cobro" />
              {correo && <a className="mini" href={correo} aria-label="Correo a la empresa">📧</a>}
              <span className="emp-derecha"><AccionesFila ctx={ctx} modulo="polizas" r={p} /></span>
            </div>
          </div>
        );
      }} />
      <Flotante texto="Nueva póliza colectiva" onClick={onNueva} />
    </>
  );
}

/* ====================== 📋 Asegurados ====================== */

/** Lista paginada de tarjetas (sin el marco de .lista) */
function Paginada<T>({ items, render, vacio, paso = 40 }: { items: T[]; render: (x: T) => ReactNode; vacio: string; paso?: number }) {
  const [n, setN] = useState(paso);
  if (!items.length) return <Vacio>{vacio}</Vacio>;
  return (
    <>
      {items.slice(0, n).map(render)}
      {items.length > n && (
        <button className="boton secundario mas-abajo" type="button" onClick={() => setN(n + paso * 2)}>Ver más ({items.length - n} restantes)</button>
      )}
    </>
  );
}

function FilaAsegurado({ a, sub, onClick, editar, borrar }: {
  a: Asegurado; sub: ReactNode; onClick?: () => void; editar: () => void; borrar: () => void;
}) {
  const nombre = a.nombre || 'Sin nombre';
  return (
    <Fila inicial={inicial(nombre)} titulo={nombre} sub={sub} onClick={onClick ?? editar}
      acciones={<>
        <EnlaceWA href={waTexto(a.cel ?? '', msgAsegurado(nombre))} etiqueta={`WhatsApp a ${nombre}`} />
        <button className="icono-accion" type="button" aria-label={`Editar ${nombre}`} onClick={editar}>✏️</button>
        <button className="icono-accion rojo" type="button" aria-label={`Eliminar ${nombre}`} onClick={borrar}>🗑️</button>
      </>} />
  );
}

function TabAsegurados({ ctx, editar, borrar, nuevo, hayColectivas }: {
  ctx: Ctx; editar: (polId: string, a: Asegurado) => void; borrar: (polId: string, a: Asegurado) => void;
  nuevo: () => void; hayColectivas: boolean;
}) {
  const [q, setQ] = useState('');
  const [pol, setPol] = useState('');
  const todos = useMemo(() => ctx.cartera.polizas.flatMap((p) => asegurados(p).map((a, i) => ({ p, a, k: `${p.id}-${claveAsegurado(a) || i}` }))), [ctx.cartera.polizas]);
  const conAsd = useMemo(() => ctx.cartera.polizas.filter((p) => asegurados(p).length > 0), [ctx.cartera.polizas]);
  const t = normalizar(q);
  const lista = todos.filter(({ p, a }) => (!pol || p.id === pol) &&
    coincide(t, a.nombre, a.cedula, a.cargo, a.cel, a.email, txt(p, 'num'), nombreEmpresa(ctx, p)));
  return (
    <>
      <Buscar q={q} setQ={setQ} ph="Nombre, documento, cargo o póliza" />
      {conAsd.length > 1 && (
        <label className="campo"><span>Póliza</span>
          <select value={pol} onChange={(e) => setPol(e.target.value)}>
            <option value="">Todas las pólizas ({todos.length})</option>
            {conAsd.map((p) => (
              <option key={p.id} value={p.id}>{`${txt(p, 'num') || 'Sin número'} · ${nombreTres(nombreEmpresa(ctx, p))} (${asegurados(p).length})`}</option>
            ))}
          </select>
        </label>
      )}
      <p className="contador">{lista.length === todos.length ? `${todos.length} asegurados` : `${lista.length} de ${todos.length} asegurados`}</p>
      <ListaLarga items={lista} vacio="Sin asegurados" render={({ p, a, k }) => (
        <FilaAsegurado key={k} a={a}
          sub={<>
            {[a.cedula, a.cargo, a.cel].filter(Boolean).join(' · ') || '—'}
            <span className="emp-linea"><span className="emp-num">{txt(p, 'num') || '—'}</span> {nombreTres(nombreEmpresa(ctx, p))}</span>
          </>}
          onClick={() => ctx.abrir('polizas', p.id)}
          editar={() => editar(p.id, a)} borrar={() => borrar(p.id, a)} />
      )} />
      {hayColectivas && <Flotante texto="Nuevo asegurado" onClick={nuevo} />}
    </>
  );
}

/** Hoja con los asegurados de una póliza (botón "📋 N aseg." / "+ Asegurado") */
function ListaAsegurados({ ctx, polId, onCerrar, nuevo, editar, borrar }: {
  ctx: Ctx; polId: string; onCerrar: () => void; nuevo: () => void; editar: (a: Asegurado) => void; borrar: (a: Asegurado) => void;
}) {
  const p = ctx.cartera.polizas.find((x) => x.id === polId);
  if (!p) return null;
  const lista = asegurados(p);
  return (
    <Hoja titulo={`📋 Asegurados · ${txt(p, 'num') || 'Póliza'}`} onCerrar={onCerrar}>
      <p className="contador">{nombreTres(nombreEmpresa(ctx, p))} · {txt(p, 'aseg')} · {lista.length} asegurados</p>
      {lista.length ? (
        <div className="lista emp-hoja-lista">
          {lista.map((a, i) => (
            <FilaAsegurado key={claveAsegurado(a) || i} a={a} sub={[a.cedula, a.cargo, a.cel].filter(Boolean).join(' · ') || '—'}
              editar={() => editar(a)} borrar={() => borrar(a)} />
          ))}
        </div>
      ) : <Vacio>Sin asegurados</Vacio>}
      <div className="botonera">
        <button className="boton" type="button" onClick={nuevo}>+ Asegurado</button>
        <button className="boton secundario" type="button" onClick={() => { onCerrar(); ctx.abrir('polizas', polId); }}>Ver póliza</button>
      </div>
    </Hoja>
  );
}

function FormAsegurado({ ctx, polId, a, colectivas, onCerrar }: FormAsd & { ctx: Ctx; colectivas: Reg[]; onCerrar: () => void }) {
  const [pol, setPol] = useState(polId ?? '');
  const [v, setV] = useState({
    nombre: a?.nombre ?? '', cedula: a?.cedula ?? '', fNac: (a?.fNac ?? '').slice(0, 10), cargo: a?.cargo ?? '', cel: a?.cel ?? '', email: a?.email ?? '',
  });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const cambia = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    const nombre = limpiarTexto(v.nombre, 160);
    if (!nombre) return setError('Nombre obligatorio');
    if (!pol) return setError('Elige la póliza colectiva.');
    if (v.email.trim() && !esCorreo(v.email)) return setError('El correo no es válido.');
    setOcupado(true);
    setError('');
    const datos: Asegurado = {
      nombre, cedula: limpiarTexto(v.cedula, 40), fNac: v.fNac, cargo: limpiarTexto(v.cargo, 80),
      cel: limpiarTexto(v.cel, 30), email: limpiarTexto(v.email, 120),
    };
    try {
      const r = await actualizarCon('polizas', pol, (actual) => {
        const l = asegurados(actual);
        if (!a) return { asegurados: [...l, { id: nuevoId('ASD'), ...datos }] };
        const clave = claveAsegurado(a);
        if (!l.some((x) => claveAsegurado(x) === clave)) throw new ErrorDatos('Este asegurado ya no existe en la póliza.');
        return { asegurados: reemplazarAsegurado(l, clave, { ...datos, id: a.id || nuevoId('ASD') }) };
      });
      ctx.poner('polizas', r);
      ctx.avisar(a ? '✓ Asegurado actualizado' : '✓ Asegurado agregado');
      onCerrar();
    } catch (e) {
      setError(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }

  return (
    <Hoja titulo={a ? '✏️ Editar asegurado' : '+ Asegurado Colectivo'} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        {polId === null && (
          <label className="campo"><span>Póliza colectiva *</span>
            <select value={pol} onChange={(e) => setPol(e.target.value)}>
              <option value="">— Seleccionar —</option>
              {colectivas.map((p) => (
                <option key={p.id} value={p.id}>{`${txt(p, 'num') || 'Sin número'} · ${nombreTres(nombreEmpresa(ctx, p))} · ${txt(p, 'aseg')}`}</option>
              ))}
            </select>
          </label>
        )}
        <label className="campo"><span>Nombre completo *</span><input value={v.nombre} onChange={cambia('nombre')} maxLength={160} /></label>
        <label className="campo"><span>Documento</span><input value={v.cedula} onChange={cambia('cedula')} maxLength={40} /></label>
        <label className="campo"><span>Fecha de nacimiento</span><input type="date" value={v.fNac} onChange={cambia('fNac')} /></label>
        <label className="campo"><span>Cargo / Relación</span><input value={v.cargo} onChange={cambia('cargo')} placeholder="Empleado, Cónyuge, Hijo..." maxLength={80} /></label>
        <label className="campo"><span>Celular</span><input type="tel" inputMode="tel" value={v.cel} onChange={cambia('cel')} maxLength={30} /></label>
        <label className="campo"><span>Email</span><input type="email" value={v.email} onChange={cambia('email')} maxLength={120} autoCapitalize="none" /></label>
        {error && <div className="error" role="alert">{error}</div>}
        <div className="botonera">
          <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : a ? '💾 Guardar' : '💾 Agregar'}</button>
          <button className="boton secundario" type="button" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
        </div>
      </form>
    </Hoja>
  );
}

function BorrarAsegurado({ ctx, polId, a, onCerrar }: BorrarAsd & { ctx: Ctx; onCerrar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  async function eliminar() {
    setOcupado(true);
    setError('');
    try {
      const r = await actualizarCon('polizas', polId, (actual) => ({ asegurados: quitarAsegurado(asegurados(actual), claveAsegurado(a)) }));
      ctx.poner('polizas', r);
      ctx.avisar('Eliminado');
      onCerrar();
    } catch (e) {
      setError(e instanceof ErrorDatos ? e.message : 'No se pudo eliminar.');
      setOcupado(false);
    }
  }
  return (
    <Hoja titulo="¿Eliminar asegurado?" onCerrar={onCerrar}>
      <p className="texto-largo"><b>{a.nombre || 'Sin nombre'}</b>{a.cedula ? ` · ${a.cedula}` : ''}</p>
      <p className="texto-largo">Se quita de la póliza en la app, en el CRM web y en todos tus dispositivos. No se puede deshacer.</p>
      {error && <p className="error">{error}</p>}
      <div className="botonera">
        <button className="boton peligro" type="button" onClick={eliminar} disabled={ocupado}>{ocupado ? 'Eliminando…' : '🗑️ Sí, eliminar'}</button>
        <button className="boton secundario" type="button" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
      </div>
    </Hoja>
  );
}

/* ====================== 🏛 Aseguradoras ====================== */

const claveAseg = (a: Aseguradora) => String(a.id || a.nombre || '');
const listaAseg = (l: unknown): Aseguradora[] => (Array.isArray(l) ? (l as Aseguradora[]) : []);

function TabAseguradoras({ ctx, asegs, editar, borrar }: {
  ctx: Ctx; asegs: Aseguradora[]; editar: (a: Aseguradora | 'nueva') => void; borrar: (a: Aseguradora) => void;
}) {
  const [q, setQ] = useState('');
  const t = normalizar(q);
  const lista = asegs.filter((a) => coincide(t, a.nombre, a.ruc, a.codInt, a.email));
  return (
    <>
      {asegs.length > 6 && <Buscar q={q} setQ={setQ} ph="Nombre, RUC o código" />}
      {!asegs.length ? (
        <Vacio>Sin aseguradoras. <button type="button" className="mini" onClick={() => editar('nueva')}>+ Agregar</button></Vacio>
      ) : !lista.length ? <Vacio>Sin resultados</Vacio> : (
        <div className="emp-asegs">
          {lista.map((a, i) => {
            const nombre = String(a.nombre ?? '');
            const corto = nombreCorto(nombre) || nombre;
            const nPol = polizasDeAseguradora(a, ctx.cartera.polizas);
            const tel = String(a.tel ?? '');
            const wa = tel ? waTexto(tel.replace(/\D/g, '').slice(-8), msgAseguradora()) : null;
            const pago = enlaceSeguro(a.linkPago);
            const correo = enlaceCorreo(String(a.email ?? ''));
            const itbms = pct(a.itbmsPct);
            const ret = pct(a.retPct);
            return (
              <div key={claveAseg(a) || i} className="tarjeta emp-aseg-card">
                <div className="emp-aseg-cab">
                  <div>
                    <div className="emp-aseg-nombre" style={{ color: colorAseg(corto) }}>{corto}</div>
                    <div className="emp-aseg-largo">{nombre}</div>
                  </div>
                  <div className="fila-acciones">
                    <button className="icono-accion" type="button" aria-label={`Editar ${corto}`} onClick={() => editar(a)}>✏️</button>
                    <button className="icono-accion rojo" type="button" aria-label={`Eliminar ${corto}`} onClick={() => borrar(a)}>🗑️</button>
                  </div>
                </div>
                {a.ruc && <div className="emp-aseg-dato">RUC: {String(a.ruc)}</div>}
                {tel && <div className="emp-aseg-dato">📞 {tel}</div>}
                {a.email && <div className="emp-aseg-dato">📧 {correo ? <a href={correo}>{String(a.email)}</a> : String(a.email)}</div>}
                {a.banco && <div className="emp-aseg-dato">🏦 {String(a.banco)}</div>}
                {a.dir && <div className="emp-aseg-dato">📍 {String(a.dir)}</div>}
                <div className="chips emp-chips">
                  {a.codInt && <span className="etiqueta e-info">Cód: {String(a.codInt)}</span>}
                  {itbms > 0 && <span className="etiqueta e-neutra">ITBMS {itbms}%</span>}
                  {ret > 0 && <span className="etiqueta e-aviso">Ret. {ret}%</span>}
                  {nPol > 0 && <span className="etiqueta e-ok">{nPol} pólizas</span>}
                </div>
                {(wa || pago) && (
                  <div className="emp-botones">
                    <EnlaceWA href={wa} texto="💬 WhatsApp" clase="mini verde" etiqueta={`WhatsApp a ${corto}`} />
                    {pago && <a className="mini" href={pago} target="_blank" rel="noopener noreferrer">💳 Pagar</a>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Flotante texto="Nueva aseguradora" onClick={() => editar('nueva')} />
    </>
  );
}

const CAMPOS_ASEG: Array<[keyof Aseguradora & string, string, string?]> = [
  ['nombre', 'Nombre *'], ['ruc', 'RUC'], ['email', 'Email', 'email'], ['tel', 'Teléfono', 'tel'],
  ['codInt', 'Cód. Intermediario'], ['banco', 'Cuenta Bancaria'], ['linkPago', 'Link de Pago', 'url'],
  ['itbmsPct', '% ITBMS', 'number'], ['retPct', '% Retención', 'number'], ['dir', 'Dirección'],
];

function FormAseguradora({ ctx, a, onCerrar }: { ctx: Ctx; a: Aseguradora | null; onCerrar: () => void }) {
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(CAMPOS_ASEG.map(([k]) => [k, a?.[k] === undefined || a?.[k] === null ? '' : String(a[k])])));
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    const nombre = limpiarTexto(v.nombre ?? '', 200);
    if (!nombre) return setError('Nombre obligatorio');
    if (v.email.trim() && !esCorreo(v.email)) return setError('El correo no es válido.');
    if (v.linkPago.trim() && !enlaceSeguro(v.linkPago)) return setError('El link de pago debe empezar con https://');
    setOcupado(true);
    setError('');
    const d: Aseguradora = {
      nombre, ruc: limpiarTexto(v.ruc, 40), email: limpiarTexto(v.email, 120), tel: limpiarTexto(v.tel, 30),
      codInt: limpiarTexto(v.codInt, 40), banco: limpiarTexto(v.banco, 120), linkPago: limpiarTexto(v.linkPago, 500),
      itbmsPct: pct(v.itbmsPct), retPct: pct(v.retPct), dir: limpiarTexto(v.dir, 300),
    };
    try {
      const clave = a ? claveAseg(a) : '';
      const nuevo = await guardarMeta<Aseguradora[]>('aseguradoras', [], (l) => {
        const lista = listaAseg(l);
        if (!a) return [...lista, { id: nuevoId('A'), ...d }];
        if (!lista.some((x) => claveAseg(x) === clave)) throw new ErrorDatos('Esta aseguradora ya no existe en el CRM.');
        return lista.map((x) => (claveAseg(x) === clave ? { ...x, ...d } : x));
      });
      ctx.ponerMeta('aseguradoras', nuevo);
      ctx.avisar(a ? '✓ Actualizada' : '✓ Agregada');
      onCerrar();
    } catch (e) {
      setError(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }

  return (
    <Hoja titulo={a ? 'Editar Aseguradora' : 'Nueva Aseguradora'} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        {CAMPOS_ASEG.map(([k, l, tipo]) => (
          <label key={k} className="campo"><span>{l}</span>
            <input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}
              type={tipo === 'number' ? 'number' : tipo === 'email' ? 'email' : tipo === 'tel' ? 'tel' : tipo === 'url' ? 'url' : 'text'}
              step={tipo === 'number' ? '0.1' : undefined} inputMode={tipo === 'number' ? 'decimal' : tipo === 'tel' ? 'tel' : undefined}
              autoCapitalize={tipo === 'email' || tipo === 'url' ? 'none' : undefined} maxLength={k === 'linkPago' ? 500 : 300} />
          </label>
        ))}
        {error && <div className="error" role="alert">{error}</div>}
        <div className="botonera">
          <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : '💾 Guardar'}</button>
          <button className="boton secundario" type="button" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
        </div>
      </form>
    </Hoja>
  );
}

function BorrarAseguradora({ ctx, a, onCerrar }: { ctx: Ctx; a: Aseguradora; onCerrar: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const nPol = polizasDeAseguradora(a, ctx.cartera.polizas);
  async function eliminar() {
    setOcupado(true);
    setError('');
    try {
      const clave = claveAseg(a);
      const nuevo = await guardarMeta<Aseguradora[]>('aseguradoras', [], (l) => listaAseg(l).filter((x) => claveAseg(x) !== clave));
      ctx.ponerMeta('aseguradoras', nuevo);
      ctx.avisar('Eliminada');
      onCerrar();
    } catch (e) {
      setError(e instanceof ErrorDatos ? e.message : 'No se pudo eliminar.');
      setOcupado(false);
    }
  }
  return (
    <Hoja titulo="¿Eliminar aseguradora?" onCerrar={onCerrar}>
      <p className="texto-largo"><b>{String(a.nombre ?? '')}</b></p>
      <p className="texto-largo">Se elimina del catálogo en la app, en el CRM web y en todos tus dispositivos. No se puede deshacer.</p>
      {nPol > 0 && <div className="nota">Sus {nPol} póliza{nPol > 1 ? 's' : ''} no se borra{nPol > 1 ? 'n' : ''}: conservan el nombre de la aseguradora.</div>}
      {error && <p className="error">{error}</p>}
      <div className="botonera">
        <button className="boton peligro" type="button" onClick={eliminar} disabled={ocupado}>{ocupado ? 'Eliminando…' : '🗑️ Sí, eliminar'}</button>
        <button className="boton secundario" type="button" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
      </div>
    </Hoja>
  );
}
