import { useMemo, useState, type ReactNode } from 'react';
import { Icono } from '../components/Icono';
import { Accion, EtiquetaEstado, Fila, Hoja, Vacio, inicial } from '../components/Piezas';
import { Adjuntos, FichaCampos, FormRegistro, Historial, ListaLarga } from '../components/Registro';
import { avanzarEtapa } from '../lib/crm';
import { HistorialActividad } from './web/Reportes';
import { eliminarRegistro, ErrorDatos, fec, guardarRegistro, num, txt, type Cartera, type Reg } from '../lib/datos';
import { ESTADOS_COMERCIALES, ETAPAS_VENTA, type Modulo } from '../lib/esquema';
import {
  diasHasta, dinero, enlaceCorreo, enlaceLlamada, enlaceWhatsApp, fecha, hoyISO, normalizar,
} from '../lib/formato';
import {
  esEmpresa, estadoComercial, polizaCancelada, polizaVigente, prospectoAbierto, seguimientoProspecto, siniestroAbierto,
  tareaAbierta,
} from '../lib/reglas';

/* Lo que toda pantalla necesita */
export type Ctx = {
  cartera: Cartera;
  abrir: (m: Modulo, id: string) => void;
  avisar: (t: string) => void;
  /** Mete o reemplaza un registro en la cartera en memoria */
  poner: (m: Modulo, r: Reg) => void;
  quitar: (m: Modulo, id: string) => void;
  /** Vuelve a la pantalla anterior */
  volver: () => void;
  ponerMeta: (clave: keyof Cartera['meta'], v: unknown) => void;
};

const busca = (r: Reg, t: string, claves: string[]) => claves.some((k) => normalizar(txt(r, k)).includes(t));

function Filtros<T extends string>({ opciones, valor, cambiar }: {
  opciones: Array<[T, string]>; valor: T; cambiar: (v: T) => void;
}) {
  return (
    <div className="filtros">
      {opciones.map(([k, t]) => (
        <button key={k} type="button" className={valor === k ? 'activa' : ''} onClick={() => cambiar(k)}>{t}</button>
      ))}
    </div>
  );
}

function Buscador({ q, setQ, ph }: { q: string; setQ: (s: string) => void; ph: string }) {
  return (
    <input className="buscador" type="search" placeholder={ph} value={q} onChange={(e) => setQ(e.target.value)}
      autoCapitalize="none" spellCheck={false} maxLength={80} />
  );
}

function Contador({ n, total, que }: { n: number; total: number; que: string }) {
  return <p className="contador">{n === total ? `${total} ${que}` : `${n} de ${total} ${que}`}</p>;
}

function BotonNuevo({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button className="flotante" type="button" aria-label={texto} onClick={onClick}>
      <Icono nombre="mas" tam={26} />
    </button>
  );
}

const wa = (r: Reg | undefined, k = 'cel') => {
  const tel = txt(r, k);
  const cod = txt(r, 'codPais');
  if (!tel) return null;
  const d = tel.replace(/\D/g, '');
  return cod && cod !== '507' && !d.startsWith(cod) ? enlaceWhatsApp('+' + cod + d) : enlaceWhatsApp(tel);
};

function Contacto({ r }: { r: Reg | undefined }) {
  return (
    <div className="acciones">
      <Accion icono="llamar" texto="Llamar" href={enlaceLlamada(txt(r, 'cel') || txt(r, 'tel'))} />
      <Accion icono="chat" texto="WhatsApp" href={wa(r)} />
      <Accion icono="correo" texto="Correo" href={enlaceCorreo(txt(r, 'email'))} />
    </div>
  );
}

/* Seleccionar un cliente al crear una poliza, siniestro o vehiculo */
function ElegirCliente({ cartera, valor, cambiar }: { cartera: Cartera; valor: string; cambiar: (id: string) => void }) {
  const [q, setQ] = useState('');
  const elegido = cartera.clientes.find((c) => c.id === valor);
  const t = normalizar(q);
  const lista = t.length >= 2 ? cartera.clientes.filter((c) => busca(c, t, ['nombre', 'cedula', 'alias'])).slice(0, 8) : [];
  return (
    <fieldset className="grupo">
      <legend>Cliente *</legend>
      {elegido ? (
        <button className="boton secundario" type="button" onClick={() => cambiar('')}>{txt(elegido, 'nombre')} ✕</button>
      ) : (
        <>
          <input className="buscador" placeholder="Escribe nombre o cédula" value={q} onChange={(e) => setQ(e.target.value)} />
          {lista.length > 0 && (
            <div className="lista">
              {lista.map((c) => (
                <Fila key={c.id} titulo={txt(c, 'nombre')} sub={txt(c, 'cedula')} onClick={() => { cambiar(c.id); setQ(''); }} />
              ))}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}

/* Datos del cliente que el CRM web copia dentro de polizas, siniestros y vehiculos */
function copiaCliente(m: Modulo, c: Reg | undefined): Record<string, unknown> {
  if (!c) return {};
  if (m === 'polizas') return { clienteId: c.id, nombreCliente: txt(c, 'nombre'), cedCliente: txt(c, 'cedula'), celCliente: txt(c, 'cel'), emailCliente: txt(c, 'email') };
  if (m === 'siniestros') return { clienteId: c.id, cliente: txt(c, 'nombre'), cel: txt(c, 'cel') };
  if (m === 'vehiculos') return { clienteId: c.id, clienteNom: txt(c, 'nombre'), clienteDoc: txt(c, 'cedula') };
  return { clienteId: c.id };
}

/** Formulario de alta que pide cliente cuando hace falta */
export function NuevoRegistro({ ctx, modulo, titulo, clienteId, base, onCerrar, onCreado }: {
  ctx: Ctx; modulo: Modulo; titulo: string; clienteId?: string; base?: Record<string, unknown>;
  onCerrar: () => void; onCreado?: (r: Reg) => void;
}) {
  const pideCliente = ['polizas', 'siniestros', 'vehiculos'].includes(modulo) && !clienteId;
  const [cid, setCid] = useState(clienteId ?? '');
  const cliente = ctx.cartera.clientes.find((c) => c.id === cid);
  return (
    <FormRegistro modulo={modulo} titulo={titulo} r={null} cartera={ctx.cartera}
      fijos={{ ...(base ?? {}), ...copiaCliente(modulo, cliente) }}
      extra={pideCliente ? <ElegirCliente cartera={ctx.cartera} valor={cid} cambiar={setCid} /> : null}
      validar={() => (pideCliente && !cid ? 'Elige el cliente.' : null)}
      onCerrar={onCerrar}
      onGuardado={(r) => {
        ctx.poner(modulo, r);
        ctx.avisar('✓ Guardado');
        onCerrar();
        onCreado?.(r);
      }} />
  );
}

/* ---------------- editar / guardar / eliminar (igual que el CRM web) ---------------- */

const NOMBRE_MODULO: Record<Modulo, string> = {
  clientes: 'cliente', polizas: 'póliza', pagos: 'pago', siniestros: 'siniestro', vehiculos: 'vehículo',
  comisiones: 'comisión', prospectos: 'prospecto', tareas: 'tarea',
};

function nombreRegistro(m: Modulo, r: Reg): string {
  if (m === 'polizas') return `Póliza ${txt(r, 'num') || ''}`.trim();
  if (m === 'vehiculos') return txt(r, 'placa') || 'Vehículo';
  if (m === 'pagos') return `Pago ${dinero(num(r, 'monto'))}${txt(r, 'cliente') ? ' · ' + txt(r, 'cliente') : ''}`;
  if (m === 'comisiones') return `Comisión ${txt(r, 'aseg')} ${txt(r, 'mes')}`.trim();
  return txt(r, 'nombre') || txt(r, 'titulo') || NOMBRE_MODULO[m];
}

/** Hoja de confirmacion para eliminar un registro */
function ConfirmarEliminar({ ctx, modulo, r, onCerrar, alEliminar }: {
  ctx: Ctx; modulo: Modulo; r: Reg; onCerrar: () => void; alEliminar?: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const nPol = modulo === 'clientes' ? (polizasPorCliente(ctx.cartera).get(r.id)?.length ?? 0) : 0;
  async function eliminar() {
    setOcupado(true);
    setError('');
    try {
      await eliminarRegistro(modulo, r.id);
      ctx.quitar(modulo, r.id);
      const n = NOMBRE_MODULO[modulo];
      ctx.avisar(`🗑️ ${n[0].toUpperCase() + n.slice(1)} eliminad${['polizas', 'comisiones', 'tareas'].includes(modulo) ? 'a' : 'o'}`);
      onCerrar();
      alEliminar?.();
    } catch (e) {
      setError(e instanceof ErrorDatos ? e.message : 'No se pudo eliminar.');
      setOcupado(false);
    }
  }
  return (
    <Hoja titulo={`¿Eliminar ${NOMBRE_MODULO[modulo]}?`} onCerrar={onCerrar}>
      <p className="texto-largo"><b>{nombreRegistro(modulo, r)}</b></p>
      <p className="texto-largo">Se elimina en la app, en el CRM web y en todos tus dispositivos. No se puede deshacer.</p>
      {nPol > 0 && <div className="nota">Sus {nPol} póliza{nPol > 1 ? 's' : ''} no se borra{nPol > 1 ? 'n' : ''}: quedará{nPol > 1 ? 'n' : ''} como póliza{nPol > 1 ? 's' : ''} sin cliente.</div>}
      {error && <p className="error">{error}</p>}
      <div className="botonera">
        <button className="boton peligro" type="button" onClick={eliminar} disabled={ocupado}>{ocupado ? 'Eliminando…' : '🗑️ Sí, eliminar'}</button>
        <button className="boton secundario" type="button" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
      </div>
    </Hoja>
  );
}

/** Barra de la ficha: ✏️ Editar (el formulario tiene 💾 Guardar) y 🗑️ Eliminar */
function Editar({ ctx, modulo, r, titulo }: { ctx: Ctx; modulo: Modulo; r: Reg; titulo: string }) {
  const [abierto, setAbierto] = useState<'editar' | 'eliminar' | null>(null);
  return (
    <>
      <div className="botonera acciones-ficha">
        <button className="boton" type="button" onClick={() => setAbierto('editar')}>✏️ Editar</button>
        <button className="boton peligro" type="button" onClick={() => setAbierto('eliminar')}>🗑️ Eliminar</button>
      </div>
      {abierto === 'editar' && (
        <FormRegistro modulo={modulo} titulo={titulo} r={r} cartera={ctx.cartera} onCerrar={() => setAbierto(null)}
          onGuardado={(n) => { ctx.poner(modulo, n); setAbierto(null); ctx.avisar('✓ Cambios guardados'); }} />
      )}
      {abierto === 'eliminar' && (
        <ConfirmarEliminar ctx={ctx} modulo={modulo} r={r} onCerrar={() => setAbierto(null)} alEliminar={ctx.volver} />
      )}
    </>
  );
}

/** ✏️ y 🗑️ al final de cada fila de las listas */
export function AccionesFila({ ctx, modulo, r }: { ctx: Ctx; modulo: Modulo; r: Reg }) {
  const [abierto, setAbierto] = useState<'editar' | 'eliminar' | null>(null);
  const titulo = `Editar ${NOMBRE_MODULO[modulo]}`;
  return (
    <>
      <button className="icono-accion" type="button" aria-label={`Editar ${nombreRegistro(modulo, r)}`} onClick={() => setAbierto('editar')}>✏️</button>
      <button className="icono-accion rojo" type="button" aria-label={`Eliminar ${nombreRegistro(modulo, r)}`} onClick={() => setAbierto('eliminar')}>🗑️</button>
      {abierto === 'editar' && (
        <FormRegistro modulo={modulo} titulo={titulo} r={r} cartera={ctx.cartera} onCerrar={() => setAbierto(null)}
          onGuardado={(n) => { ctx.poner(modulo, n); setAbierto(null); ctx.avisar('✓ Cambios guardados'); }} />
      )}
      {abierto === 'eliminar' && <ConfirmarEliminar ctx={ctx} modulo={modulo} r={r} onCerrar={() => setAbierto(null)} />}
    </>
  );
}

/** 📜 Historial de actividad (pólizas, pagos y tareas), como el visor del CRM web */
function VerActividad({ ctx, tipo, id }: { ctx: Ctx; tipo: 'cli' | 'pol'; id: string }) {
  const [ver, setVer] = useState(false);
  return (
    <>
      <button className="boton secundario mas-abajo" type="button" onClick={() => setVer(!ver)}>{ver ? 'Ocultar actividad' : '📜 Ver historial de actividad'}</button>
      {ver && <HistorialActividad ctx={ctx} tipo={tipo} id={id} />}
    </>
  );
}

function Seccion({ titulo, n, accion, children }: { titulo: string; n?: number; accion?: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="seccion-fila">
        <h3 className="seccion">{titulo}{n !== undefined ? ` (${n})` : ''}</h3>
        {accion}
      </div>
      {children}
    </>
  );
}

function MasPeque({ onClick, texto }: { onClick: () => void; texto: string }) {
  return <button className="mini" type="button" onClick={onClick}>+ {texto}</button>;
}

/* ====================== CLIENTES ====================== */

type TabCli = 'todos' | 'personal' | 'empresa' | 'vip' | 'ganado' | 'perdido' | 'inactivo';
type FiltrosCli = { provincia: string; origen: string; polizas: '' | 'vigentes' | 'sin' | 'vencidas'; ramo: string; aseg: string; cumple: boolean; orden: 'nombre' | 'polizas' | 'prima' };
const FC0: FiltrosCli = { provincia: '', origen: '', polizas: '', ramo: '', aseg: '', cumple: false, orden: 'nombre' };

/** Pólizas de cada cliente (vinculadas por clienteId) */
export function polizasPorCliente(c: Cartera): Map<string, Reg[]> {
  const m = new Map<string, Reg[]>();
  for (const p of c.polizas) {
    const id = txt(p, 'clienteId');
    if (!id) continue;
    if (!m.has(id)) m.set(id, []);
    m.get(id)!.push(p);
  }
  return m;
}

const valores = (lista: Reg[], k: string) => [...new Set(lista.map((r) => txt(r, k)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));

function cuantosFiltros(f: Record<string, unknown>, base: Record<string, unknown>) {
  return Object.keys(base).filter((k) => k !== 'orden' && f[k] !== base[k]).length;
}

export function Clientes({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const [tab, setTab] = useState<TabCli>('todos');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [f, setF] = useState<FiltrosCli>(FC0);
  const [verFiltros, setVerFiltros] = useState(false);
  const pols = useMemo(() => polizasPorCliente(cartera), [cartera]);
  const cuenta = useMemo(() => {
    const c = { todos: cartera.clientes.length, personal: 0, empresa: 0, vip: 0, ganado: 0, perdido: 0, inactivo: 0 };
    for (const x of cartera.clientes) {
      if (esEmpresa(x)) c.empresa++; else c.personal++;
      const e = estadoComercial(x) as keyof typeof c;
      if (e in c && e !== 'todos') c[e]++;
    }
    return c;
  }, [cartera.clientes]);
  const mesHoy = new Date().getMonth() + 1;
  const lista = useMemo(() => {
    const t = normalizar(q);
    const dig = q.replace(/\D/g, '');
    const prima = (c: Reg) => (pols.get(c.id) ?? []).filter(polizaVigente).reduce((s, p) => s + (num(p, 'total') ?? num(p, 'prima') ?? 0), 0);
    const r = cartera.clientes.filter((c) => {
      if (tab === 'empresa' && !esEmpresa(c)) return false;
      if (tab === 'personal' && esEmpresa(c)) return false;
      if (['vip', 'ganado', 'perdido', 'inactivo'].includes(tab) && estadoComercial(c) !== tab) return false;
      if (f.provincia && txt(c, 'provincia') !== f.provincia) return false;
      if (f.origen && txt(c, 'origenCliente') !== f.origen) return false;
      const ps = pols.get(c.id) ?? [];
      if (f.polizas === 'vigentes' && !ps.some(polizaVigente)) return false;
      if (f.polizas === 'sin' && ps.length) return false;
      if (f.polizas === 'vencidas' && !ps.some((p) => /vencida/i.test(txt(p, 'estado')) || (diasHasta(fec(p, 'fechaFin')) ?? 1) < 0)) return false;
      if (f.ramo && !ps.some((p) => txt(p, 'ramo') === f.ramo)) return false;
      if (f.aseg && !ps.some((p) => txt(p, 'aseg') === f.aseg)) return false;
      if (f.cumple) { const fn = fec(c, 'fNac'); if (!fn || +fn.slice(5, 7) !== mesHoy) return false; }
      if (!t) return true;
      return busca(c, t, ['nombre', 'alias', 'cedula', 'email', 'ciudad']) ||
        (dig.length >= 4 && (txt(c, 'cel') + txt(c, 'tel')).replace(/\D/g, '').includes(dig));
    });
    if (f.orden === 'polizas') r.sort((a, b) => (pols.get(b.id)?.length ?? 0) - (pols.get(a.id)?.length ?? 0));
    else if (f.orden === 'prima') r.sort((a, b) => prima(b) - prima(a));
    return r;
  }, [cartera.clientes, tab, q, f, pols, mesHoy]);
  const n = cuantosFiltros(f, FC0);

  return (
    <>
      <div className="busca-fila">
        <Buscador q={q} setQ={setQ} ph="Nombre, cédula, correo, celular o ciudad" />
        <button type="button" className={`boton-filtro${n ? ' activo' : ''}`} onClick={() => setVerFiltros(true)}>⚙️{n ? ` ${n}` : ''}</button>
      </div>
      <Filtros<TabCli> valor={tab} cambiar={setTab} opciones={[
        ['todos', `👥 Todos (${cuenta.todos})`], ['personal', `🧑 Personales (${cuenta.personal})`],
        ['empresa', `🏢 Empresas (${cuenta.empresa})`], ['vip', `⭐ VIP (${cuenta.vip})`],
        ['ganado', `✅ Ganados (${cuenta.ganado})`], ['perdido', `❌ Perdidos (${cuenta.perdido})`],
        ['inactivo', `⚫ Inactivos (${cuenta.inactivo})`],
      ]} />
      <Contador n={lista.length} total={cartera.clientes.length} que="clientes" />
      <ListaLarga items={lista} vacio="No se encontraron clientes." render={(c) => {
        const ps = pols.get(c.id) ?? [];
        const vig = ps.filter(polizaVigente).length;
        return (
          <Fila acciones={<AccionesFila ctx={ctx} modulo="clientes" r={c} />} key={c.id} inicial={inicial(txt(c, 'nombre'))} titulo={txt(c, 'nombre') || 'Sin nombre'}
            sub={[txt(c, 'cedula'), txt(c, 'cel')].filter(Boolean).join(' · ')}
            derecha={<span className={`etiqueta ${vig ? 'e-ok' : ps.length ? 'e-aviso' : 'e-neutra'}`}>{ps.length} pól.{ps.length && vig !== ps.length ? ` · ${vig} vig.` : ''}</span>}
            onClick={() => ctx.abrir('clientes', c.id)} />
        );
      }} />
      <BotonNuevo texto="Nuevo cliente" onClick={() => setNuevo(true)} />
      {verFiltros && (
        <Hoja titulo="Filtrar y ordenar clientes" onCerrar={() => setVerFiltros(false)}>
          <label className="campo"><span>Ordenar por</span>
            <select value={f.orden} onChange={(e) => setF({ ...f, orden: e.target.value as FiltrosCli['orden'] })}>
              <option value="nombre">Nombre (A–Z)</option><option value="polizas">Más pólizas</option><option value="prima">Mayor prima vigente</option>
            </select></label>
          <label className="campo"><span>Pólizas</span>
            <select value={f.polizas} onChange={(e) => setF({ ...f, polizas: e.target.value as FiltrosCli['polizas'] })}>
              <option value="">Todas</option><option value="vigentes">Con pólizas vigentes</option><option value="vencidas">Con pólizas vencidas</option><option value="sin">Sin pólizas</option>
            </select></label>
          <label className="campo"><span>Con póliza del ramo</span>
            <select value={f.ramo} onChange={(e) => setF({ ...f, ramo: e.target.value })}><option value="">Cualquiera</option>{valores(cartera.polizas, 'ramo').map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="campo"><span>Con póliza de la aseguradora</span>
            <select value={f.aseg} onChange={(e) => setF({ ...f, aseg: e.target.value })}><option value="">Cualquiera</option>{valores(cartera.polizas, 'aseg').map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="campo"><span>Provincia</span>
            <select value={f.provincia} onChange={(e) => setF({ ...f, provincia: e.target.value })}><option value="">Todas</option>{valores(cartera.clientes, 'provincia').map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="campo"><span>Origen del cliente</span>
            <select value={f.origen} onChange={(e) => setF({ ...f, origen: e.target.value })}><option value="">Todos</option>{valores(cartera.clientes, 'origenCliente').map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="campo casilla"><input type="checkbox" checked={f.cumple} onChange={(e) => setF({ ...f, cumple: e.target.checked })} /> <span>Cumplen años este mes</span></label>
          <div className="botonera">
            <button className="boton" type="button" onClick={() => setVerFiltros(false)}>Ver {lista.length} clientes</button>
            <button className="boton secundario" type="button" onClick={() => setF(FC0)}>Limpiar filtros</button>
          </div>
        </Hoja>
      )}
      {nuevo && <NuevoRegistro ctx={ctx} modulo="clientes" titulo="Nuevo cliente"
        base={{ tipo: 'Persona Natural', tipoDoc: 'Cédula', estadoComercial: 'activo', estadoCli: 'activo', codPais: '507', alias: '', historialWA: [], archivos: [] }}
        onCerrar={() => setNuevo(false)} onCreado={(r) => ctx.abrir('clientes', r.id)} />}
    </>
  );
}

/* ---------------- vincular cliente <-> póliza ---------------- */

const normDoc = (s: string) => s.toUpperCase().replace(/[^0-9A-Z-]/g, '').split('-').map((x) => x.replace(/^0+(?=\d)/, '')).join('-');

/** Pólizas sin cliente vinculado que parecen ser de este cliente (por cédula o nombre) */
export function polizasSueltasDe(c: Cartera, cli: Reg): Reg[] {
  const ced = txt(cli, 'cedula') ? normDoc(txt(cli, 'cedula')) : '';
  const nom = normalizar(txt(cli, 'nombre'));
  const ids = new Set(c.clientes.map((x) => x.id));
  return c.polizas.filter((p) => {
    if (ids.has(txt(p, 'clienteId'))) return false;
    const docs = ['cedCliente', 'docAsegurado', 'docTomador'].map((k) => txt(p, k)).filter(Boolean).map(normDoc);
    return (ced && docs.includes(ced)) || (nom && [txt(p, 'nombreCliente'), txt(p, 'nombreAsegurado'), txt(p, 'tomador')].some((x) => normalizar(x) === nom));
  });
}

async function vincular(ctx: Ctx, p: Reg, cli: Reg) {
  try {
    ctx.poner('polizas', await guardarRegistro('polizas', p.id, copiaCliente('polizas', cli)));
    ctx.avisar(`✓ Póliza vinculada a ${txt(cli, 'nombre')}`);
  } catch {
    ctx.avisar('No se pudo vincular.');
  }
}

export function ClienteFicha({ ctx, c }: { ctx: Ctx; c: Reg }) {
  const { cartera } = ctx;
  const [crear, setCrear] = useState<Modulo | null>(null);
  const polizas = cartera.polizas.filter((p) => txt(p, 'clienteId') === c.id)
    .sort((a, b) => fec(b, 'fechaFin').localeCompare(fec(a, 'fechaFin')));
  const ids = new Set(polizas.map((p) => p.id));
  const siniestros = cartera.siniestros.filter((s) => txt(s, 'clienteId') === c.id);
  const vehiculos = cartera.vehiculos.filter((v) => txt(v, 'clienteId') === c.id);
  const pagos = cartera.pagos.filter((p) => txt(p, 'clienteId') === c.id || ids.has(txt(p, 'polizaId')))
    .sort((a, b) => fec(b, 'fecha').localeCompare(fec(a, 'fecha')));
  const tareas = cartera.tareas.filter((t) => txt(t, 'clienteId') === c.id && tareaAbierta(t));
  const prima = polizas.filter(polizaVigente).reduce((s, p) => s + (num(p, 'total') ?? num(p, 'prima') ?? 0), 0);
  const sueltas = polizasSueltasDe(cartera, c);

  return (
    <>
      <Contacto r={c} />
      <div className="chips">
        <span className="chip">{esEmpresa(c) ? '🏢 Empresa' : '🧑 Personal'}</span>
        <span className="chip">{ESTADOS_COMERCIALES.find(([v]) => v === estadoComercial(c))?.[1]}</span>
        <span className="chip">{polizas.length} póliza{polizas.length === 1 ? '' : 's'} · {polizas.filter(polizaVigente).length} vigente{polizas.filter(polizaVigente).length === 1 ? '' : 's'}</span>
        {prima > 0 && <span className="chip">{dinero(prima)} en primas</span>}
      </div>

      <Seccion titulo="Pólizas" n={polizas.length} accion={<MasPeque texto="Póliza" onClick={() => setCrear('polizas')} />}>
        {polizas.length ? (
          <div className="lista">
            {polizas.map((p) => <FilaPoliza key={p.id} p={p} ctx={ctx} />)}
          </div>
        ) : <Vacio>Sin pólizas.</Vacio>}
        {sueltas.length > 0 && (
          <div className="tarjeta aviso-tarjeta">
            <b>🔗 {sueltas.length} póliza{sueltas.length > 1 ? 's' : ''} con su cédula o nombre sin vincular</b>
            {sueltas.map((p) => (
              <div key={p.id} className="fila-suelta">
                <span>{txt(p, 'num')} · {txt(p, 'aseg')} · {txt(p, 'ramo')}</span>
                <button type="button" className="mini" onClick={() => vincular(ctx, p, c)}>Vincular</button>
              </div>
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Vehículos" n={vehiculos.length} accion={<MasPeque texto="Vehículo" onClick={() => setCrear('vehiculos')} />}>
        {vehiculos.length > 0 && (
          <div className="lista">
            {vehiculos.map((v) => (
              <Fila acciones={<AccionesFila ctx={ctx} modulo="vehiculos" r={v} />} key={v.id} titulo={txt(v, 'placa') || 'Sin placa'}
                sub={[fec(v, 'soat') && `SOAT ${fecha(fec(v, 'soat'))}`, fec(v, 'imp') && `Imp. ${fecha(fec(v, 'imp'))}`].filter(Boolean).join(' · ')}
                onClick={() => ctx.abrir('vehiculos', v.id)} />
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Siniestros" n={siniestros.length} accion={<MasPeque texto="Siniestro" onClick={() => setCrear('siniestros')} />}>
        {siniestros.length > 0 && (
          <div className="lista">
            {siniestros.map((s) => (
              <Fila acciones={<AccionesFila ctx={ctx} modulo="siniestros" r={s} />} key={s.id} titulo={txt(s, 'nombre') || 'Siniestro'} sub={[txt(s, 'aseg'), fecha(fec(s, 'fechaSin'))].filter(Boolean).join(' · ')}
                derecha={<EtiquetaEstado estado={txt(s, 'estado') || null} />} onClick={() => ctx.abrir('siniestros', s.id)} />
            ))}
          </div>
        )}
      </Seccion>

      <Seccion titulo="Tareas pendientes" n={tareas.length} accion={<MasPeque texto="Tarea" onClick={() => setCrear('tareas')} />}>
        {tareas.length > 0 && (
          <div className="lista">
            {tareas.map((t) => (
              <Fila key={t.id} titulo={txt(t, 'titulo') || 'Tarea'} sub={fecha(fec(t, 'fechaLimite'))}
                derecha={<EtiquetaEstado estado={txt(t, 'etapaTarea') || null} />} onClick={() => ctx.abrir('tareas', t.id)} />
            ))}
          </div>
        )}
      </Seccion>

      {pagos.length > 0 && (
        <Seccion titulo="Pagos" n={pagos.length}>
          <ListaLarga items={pagos} paso={10} vacio="" render={(p) => <FilaPago key={p.id} p={p} ctx={ctx} />} />
        </Seccion>
      )}

      <Historial modulo="clientes" r={c} avisar={ctx.avisar} alCambiar={(n) => ctx.poner('clientes', n)} />
      <Adjuntos modulo="clientes" r={c} avisar={ctx.avisar} alCambiar={(n) => ctx.poner('clientes', n)} />
      <FichaCampos modulo="clientes" r={c} />
      <Editar ctx={ctx} modulo="clientes" r={c} titulo="Editar cliente" />
      <VerActividad ctx={ctx} tipo="cli" id={c.id} />

      {crear === 'polizas' && <NuevoRegistro ctx={ctx} modulo="polizas" titulo="Nueva póliza" clienteId={c.id}
        base={{ tipo: 'Póliza', nueva: 'Nueva', estado: 'Vigente', etapa: 'Nueva', moneda: 'USD', participacion: 100, archivos: [] }}
        onCerrar={() => setCrear(null)} />}
      {crear === 'vehiculos' && <NuevoRegistro ctx={ctx} modulo="vehiculos" titulo="Nuevo vehículo" clienteId={c.id} onCerrar={() => setCrear(null)} />}
      {crear === 'siniestros' && <NuevoRegistro ctx={ctx} modulo="siniestros" titulo="Nuevo siniestro" clienteId={c.id}
        base={{ estado: 'En proceso', amparos: [], archivos: [] }} onCerrar={() => setCrear(null)} />}
      {crear === 'tareas' && <NuevoRegistro ctx={ctx} modulo="tareas" titulo="Nueva tarea"
        base={{ clienteId: c.id, tipoRel: 'cliente', relId: c.id, etapaTarea: 'Por Hacer', estado: 'pendiente', fechaLimite: hoyISO(), fechaCreacion: hoyISO() }}
        onCerrar={() => setCrear(null)} />}
    </>
  );
}

/* ====================== PÓLIZAS ====================== */

function EtiquetaPol({ p }: { p: Reg }) {
  const d = diasHasta(fec(p, 'fechaFin'));
  if (polizaVigente(p) && d !== null && d <= 30) {
    return <span className={`etiqueta ${d < 0 ? 'e-peligro' : d === 0 ? 'e-peligro' : 'e-aviso'}`}>{d < 0 ? 'Vencida' : d === 0 ? 'Vence hoy' : `${d} días`}</span>;
  }
  return <EtiquetaEstado estado={txt(p, 'estado') || null} />;
}

export function FilaPoliza({ p, ctx, conCliente }: { p: Reg; ctx: Ctx; conCliente?: boolean }) {
  return (
    <Fila acciones={<AccionesFila ctx={ctx} modulo="polizas" r={p} />} titulo={conCliente ? txt(p, 'nombreCliente') || 'Sin nombre' : `${txt(p, 'ramo') || 'Póliza'} · ${txt(p, 'num')}`}
      sub={[conCliente ? txt(p, 'ramo') : '', txt(p, 'aseg'), fecha(fec(p, 'fechaFin'))].filter(Boolean).join(' · ')}
      derecha={<EtiquetaPol p={p} />} onClick={() => ctx.abrir('polizas', p.id)} />
  );
}

type FiltroPol = 'vencen' | 'vigentes' | 'vencidas' | 'canceladas' | 'todas';
type FiltrosPol = { aseg: string; ramo: string; estado: string; forma: string; mes: string; sinCliente: boolean; orden: 'vence' | 'prima' | 'cliente' | 'recientes' };
const FP0: FiltrosPol = { aseg: '', ramo: '', estado: '', forma: '', mes: '', sinCliente: false, orden: 'vence' };

export function Polizas({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const [tab, setTab] = useState<FiltroPol>('vencen');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [f, setF] = useState<FiltrosPol>(FP0);
  const [verFiltros, setVerFiltros] = useState(false);
  const idsCli = useMemo(() => new Set(cartera.clientes.map((c) => c.id)), [cartera.clientes]);
  const sinCliente = useMemo(() => cartera.polizas.filter((p) => !idsCli.has(txt(p, 'clienteId'))).length, [cartera.polizas, idsCli]);
  const lista = useMemo(() => {
    const t = normalizar(q);
    const r = cartera.polizas.filter((p) => {
      const d = diasHasta(fec(p, 'fechaFin'));
      if (tab === 'vencen' && !(polizaVigente(p) && d !== null && d >= 0 && d <= 30)) return false;
      if (tab === 'vigentes' && !polizaVigente(p)) return false;
      if (tab === 'vencidas' && !(/vencida/i.test(txt(p, 'estado')) || (polizaVigente(p) && d !== null && d < 0))) return false;
      if (tab === 'canceladas' && !polizaCancelada(p)) return false;
      if (f.aseg && txt(p, 'aseg') !== f.aseg) return false;
      if (f.ramo && txt(p, 'ramo') !== f.ramo) return false;
      if (f.estado && txt(p, 'estado') !== f.estado) return false;
      if (f.forma && txt(p, 'formaPago') !== f.forma) return false;
      if (f.mes && !fec(p, 'fechaFin').startsWith(f.mes)) return false;
      if (f.sinCliente && idsCli.has(txt(p, 'clienteId'))) return false;
      return !t || busca(p, t, ['nombreCliente', 'num', 'aseg', 'ramo', 'subramo', 'riesgo', 'nombreAsegurado', 'tomador', 'cedCliente', 'docAsegurado']);
    });
    const tot = (p: Reg) => num(p, 'total') ?? num(p, 'prima') ?? 0;
    if (f.orden === 'prima') r.sort((a, b) => tot(b) - tot(a));
    else if (f.orden === 'cliente') r.sort((a, b) => txt(a, 'nombreCliente').localeCompare(txt(b, 'nombreCliente'), 'es'));
    else if (f.orden === 'recientes') r.sort((a, b) => fec(b, 'fechaInicio').localeCompare(fec(a, 'fechaInicio')));
    else r.sort((a, b) => (tab === 'vencen' || tab === 'vigentes' ? 1 : -1) * fec(a, 'fechaFin').localeCompare(fec(b, 'fechaFin')));
    return r;
  }, [cartera.polizas, tab, q, f, idsCli]);
  const total = lista.reduce((s, p) => s + (num(p, 'total') ?? num(p, 'prima') ?? 0), 0);
  const n = cuantosFiltros(f, FP0);

  return (
    <>
      <div className="busca-fila">
        <Buscador q={q} setQ={setQ} ph="Cliente, cédula, número, aseguradora, ramo…" />
        <button type="button" className={`boton-filtro${n ? ' activo' : ''}`} onClick={() => setVerFiltros(true)}>⚙️{n ? ` ${n}` : ''}</button>
      </div>
      <Filtros<FiltroPol> valor={tab} cambiar={setTab} opciones={[
        ['vencen', '🔔 Vencen en 30 días'], ['vigentes', 'Vigentes'], ['vencidas', 'Vencidas'], ['canceladas', 'Canceladas'], ['todas', 'Todas'],
      ]} />
      <p className="contador">{lista.length} de {cartera.polizas.length} pólizas{total ? ` · ${dinero(total)}` : ''}</p>
      {sinCliente > 0 && !f.sinCliente && (
        <button type="button" className="aviso-linea" onClick={() => { setTab('todas'); setF({ ...f, sinCliente: true }); }}>
          🔗 {sinCliente} pólizas sin cliente vinculado — ver
        </button>
      )}
      <ListaLarga items={lista} vacio="No hay pólizas en esta vista." render={(p) => <FilaPoliza key={p.id} p={p} ctx={ctx} conCliente />} />
      <BotonNuevo texto="Nueva póliza" onClick={() => setNuevo(true)} />
      {verFiltros && (
        <Hoja titulo="Filtrar y ordenar pólizas" onCerrar={() => setVerFiltros(false)}>
          <label className="campo"><span>Ordenar por</span>
            <select value={f.orden} onChange={(e) => setF({ ...f, orden: e.target.value as FiltrosPol['orden'] })}>
              <option value="vence">Fecha de vencimiento</option><option value="prima">Mayor prima</option><option value="cliente">Cliente (A–Z)</option><option value="recientes">Más recientes (inicio)</option>
            </select></label>
          <label className="campo"><span>Aseguradora</span>
            <select value={f.aseg} onChange={(e) => setF({ ...f, aseg: e.target.value })}><option value="">Todas</option>{valores(cartera.polizas, 'aseg').map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="campo"><span>Ramo</span>
            <select value={f.ramo} onChange={(e) => setF({ ...f, ramo: e.target.value })}><option value="">Todos</option>{valores(cartera.polizas, 'ramo').map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="campo"><span>Estado</span>
            <select value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}><option value="">Todos</option>{valores(cartera.polizas, 'estado').map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="campo"><span>Forma de pago</span>
            <select value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })}><option value="">Todas</option>{valores(cartera.polizas, 'formaPago').map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="campo"><span>Vence en el mes</span>
            <input type="month" value={f.mes} onChange={(e) => setF({ ...f, mes: e.target.value })} /></label>
          <label className="campo casilla"><input type="checkbox" checked={f.sinCliente} onChange={(e) => setF({ ...f, sinCliente: e.target.checked })} /> <span>Solo pólizas sin cliente vinculado</span></label>
          <div className="botonera">
            <button className="boton" type="button" onClick={() => setVerFiltros(false)}>Ver {lista.length} pólizas</button>
            <button className="boton secundario" type="button" onClick={() => setF(FP0)}>Limpiar filtros</button>
          </div>
        </Hoja>
      )}
      {nuevo && <NuevoRegistro ctx={ctx} modulo="polizas" titulo="Nueva póliza"
        base={{ tipo: 'Póliza', nueva: 'Nueva', estado: 'Vigente', etapa: 'Nueva', moneda: 'USD', participacion: 100, archivos: [] }}
        onCerrar={() => setNuevo(false)} onCreado={(r) => ctx.abrir('polizas', r.id)} />}
    </>
  );
}

function VincularCliente({ ctx, p, actual }: { ctx: Ctx; p: Reg; actual?: Reg }) {
  const [abierto, setAbierto] = useState(false);
  const [cid, setCid] = useState('');
  const sugeridos = useMemo(() => {
    if (actual) return [];
    const docs = ['cedCliente', 'docAsegurado', 'docTomador'].map((k) => txt(p, k)).filter(Boolean).map(normDoc);
    const noms = [txt(p, 'nombreCliente'), txt(p, 'nombreAsegurado'), txt(p, 'tomador')].filter(Boolean).map(normalizar);
    return ctx.cartera.clientes.filter((c) => (txt(c, 'cedula') && docs.includes(normDoc(txt(c, 'cedula')))) || noms.includes(normalizar(txt(c, 'nombre')))).slice(0, 5);
  }, [ctx.cartera.clientes, p, actual]);
  return (
    <>
      {!actual && (
        <div className="tarjeta aviso-tarjeta">
          <b>🔗 Esta póliza no está vinculada a un cliente</b>
          {txt(p, 'nombreCliente') && <p className="contador">Nombre en la póliza: {txt(p, 'nombreCliente')}</p>}
          {sugeridos.map((c) => (
            <div key={c.id} className="fila-suelta">
              <span>{txt(c, 'nombre')} · {txt(c, 'cedula')}</span>
              <button type="button" className="mini" onClick={() => vincular(ctx, p, c)}>Vincular</button>
            </div>
          ))}
          <button type="button" className="mini" onClick={() => setAbierto(true)}>Buscar otro cliente…</button>
        </div>
      )}
      {actual && <button type="button" className="mini mas-abajo" onClick={() => setAbierto(true)}>🔁 Cambiar cliente vinculado</button>}
      {abierto && (
        <Hoja titulo="Vincular a un cliente" onCerrar={() => setAbierto(false)}>
          <ElegirCliente cartera={ctx.cartera} valor={cid} cambiar={setCid} />
          <div className="botonera">
            <button className="boton" type="button" disabled={!cid} onClick={async () => {
              const c = ctx.cartera.clientes.find((x) => x.id === cid);
              if (c) await vincular(ctx, p, c);
              setAbierto(false);
            }}>Vincular</button>
          </div>
        </Hoja>
      )}
    </>
  );
}

export function PolizaFicha({ ctx, p }: { ctx: Ctx; p: Reg }) {
  const { cartera } = ctx;
  const [pago, setPago] = useState(false);
  const cliente = cartera.clientes.find((c) => c.id === txt(p, 'clienteId'));
  const pagos = cartera.pagos.filter((x) => txt(x, 'polizaId') === p.id).sort((a, b) => fec(b, 'fecha').localeCompare(fec(a, 'fecha')));
  const pagado = pagos.filter((x) => /pagad|cobrad/i.test(txt(x, 'estado'))).reduce((s, x) => s + (num(x, 'monto') ?? 0), 0);
  const siniestros = cartera.siniestros.filter((s) => txt(p, 'num') && txt(s, 'poliza') === txt(p, 'num'));
  const contacto = cliente ?? ({ id: '', cel: txt(p, 'celCliente'), email: txt(p, 'emailCliente') } as Reg);

  return (
    <>
      <Contacto r={contacto} />
      <div className="chips">
        <EtiquetaPol p={p} />
        <span className="chip">{txt(p, 'aseg')}</span>
        <span className="chip">{txt(p, 'ramo')}</span>
        {num(p, 'total') !== null && <span className="chip">{dinero(num(p, 'total'))}</span>}
      </div>
      {cliente && (() => {
        const otras = ctx.cartera.polizas.filter((x) => txt(x, 'clienteId') === cliente.id);
        return (
          <div className="lista">
            <Fila inicial={inicial(txt(cliente, 'nombre'))} titulo={txt(cliente, 'nombre')}
              sub={`Ver ficha del cliente · ${otras.length} póliza${otras.length === 1 ? '' : 's'} en total`}
              onClick={() => ctx.abrir('clientes', cliente.id)} />
          </div>
        );
      })()}
      <VincularCliente ctx={ctx} p={p} actual={cliente} />
      <Seccion titulo="Pagos" n={pagos.length} accion={<MasPeque texto="Pago" onClick={() => setPago(true)} />}>
        {pagado > 0 && <p className="contador">Pagado: {dinero(pagado)}</p>}
        {pagos.length > 0 && <ListaLarga items={pagos} paso={12} vacio="" render={(x) => <FilaPago key={x.id} p={x} ctx={ctx} />} />}
      </Seccion>
      {siniestros.length > 0 && (
        <Seccion titulo="Siniestros" n={siniestros.length}>
          <div className="lista">
            {siniestros.map((s) => (
              <Fila key={s.id} titulo={txt(s, 'nombre')} sub={fecha(fec(s, 'fechaSin'))}
                derecha={<EtiquetaEstado estado={txt(s, 'estado') || null} />} onClick={() => ctx.abrir('siniestros', s.id)} />
            ))}
          </div>
        </Seccion>
      )}
      <Adjuntos modulo="polizas" r={p} avisar={ctx.avisar} alCambiar={(n) => ctx.poner('polizas', n)} />
      <FichaCampos modulo="polizas" r={p} />
      <Editar ctx={ctx} modulo="polizas" r={p} titulo="Editar póliza" />
      <VerActividad ctx={ctx} tipo="pol" id={p.id} />
      {pago && <NuevoRegistro ctx={ctx} modulo="pagos" titulo={`Pago · ${txt(p, 'num')}`}
        base={{
          polizaId: p.id, clienteId: txt(p, 'clienteId'), aseg: txt(p, 'aseg'), ramo: txt(p, 'ramo'),
          cliente: txt(cliente, 'nombre') || txt(p, 'nombreCliente'), periodo: txt(p, 'periodo'), fecha: hoyISO(),
          estado: 'Pagado', monto: num(p, 'letraPrima') ?? num(p, 'cuotaMensual') ?? '',
        }}
        onCerrar={() => setPago(false)} />}
    </>
  );
}

/* ====================== PAGOS ====================== */

function FilaPago({ p, ctx }: { p: Reg; ctx: Ctx }) {
  return (
    <Fila acciones={<AccionesFila ctx={ctx} modulo="pagos" r={p} />} titulo={dinero(num(p, 'monto'))}
      sub={[fecha(fec(p, 'fecha')), txt(p, 'cliente'), txt(p, 'cuota') || txt(p, 'metodo')].filter(Boolean).join(' · ')}
      derecha={<EtiquetaEstado estado={txt(p, 'estado') || null} />} onClick={() => ctx.abrir('pagos', p.id)} />
  );
}

type FiltroPago = 'pendientes' | 'pagados' | 'todos';

const NUM_PAGOS: Record<string, number> = { Mensual: 12, Trimestral: 4, Semestral: 2, Anual: 1 };

/** Datos que el CRM web copia de la poliza al registrar un pago (onPC / SPag) */
function datosPagoDePoliza(c: Cartera, pol: Reg | undefined): Record<string, unknown> {
  if (!pol) return {};
  const cl = c.clientes.find((x) => x.id === txt(pol, 'clienteId'));
  const per = txt(pol, 'periodo');
  const n = NUM_PAGOS[per || 'Anual'] ?? 1;
  return {
    polizaId: pol.id, aseg: txt(pol, 'aseg'), ramo: txt(pol, 'ramo'), cliente: txt(cl, 'nombre') || txt(pol, 'nombreCliente'),
    ...(per ? { periodo: per } : {}),
    cuota: n > 1 ? `Cuota ${per}` : 'Prima Anual',
  };
}

function ElegirPoliza({ cartera, valor, cambiar }: { cartera: Cartera; valor: string; cambiar: (id: string) => void }) {
  const [q, setQ] = useState('');
  const elegida = cartera.polizas.find((p) => p.id === valor);
  const t = normalizar(q);
  const lista = t.length >= 2 ? cartera.polizas.filter((p) => busca(p, t, ['num', 'nombreCliente', 'tomador', 'aseg'])).slice(0, 8) : [];
  return (
    <fieldset className="grupo">
      <legend>Póliza</legend>
      {elegida ? (
        <button className="boton secundario" type="button" onClick={() => cambiar('')}>
          {txt(elegida, 'num') || elegida.id} · {txt(elegida, 'nombreCliente') || txt(elegida, 'aseg')} ✕
        </button>
      ) : (
        <>
          <input className="buscador" placeholder="Número de póliza o cliente" value={q} onChange={(e) => setQ(e.target.value)} />
          {lista.length > 0 && (
            <div className="lista">
              {lista.map((p) => (
                <Fila key={p.id} titulo={txt(p, 'num') || p.id} sub={[txt(p, 'nombreCliente'), txt(p, 'aseg')].filter(Boolean).join(' · ')}
                  onClick={() => { cambiar(p.id); setQ(''); }} />
              ))}
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}

/** + Registrar pago (formulario del CRM web: poliza, monto, fecha, cuota, estado, frecuencia, notas) */
export function NuevoPago({ ctx, polizaId, onCerrar }: { ctx: Ctx; polizaId?: string; onCerrar: () => void }) {
  const [pid, setPid] = useState(polizaId ?? '');
  const pol = ctx.cartera.polizas.find((p) => p.id === pid);
  const sugerida = pol ? (num(pol, 'letraPrima') || num(pol, 'prima')) : null;
  return (
    <FormRegistro modulo="pagos" titulo="💳 Registrar pago" r={null} cartera={ctx.cartera}
      fijos={{ estado: 'Pendiente', fecha: hoyISO(), ...datosPagoDePoliza(ctx.cartera, pol) }}
      extra={(
        <>
          <ElegirPoliza cartera={ctx.cartera} valor={pid} cambiar={setPid} />
          {sugerida ? <div className="nota">Cuota de la póliza: <b>{dinero(sugerida)}</b></div> : null}
        </>
      )}
      onCerrar={onCerrar}
      onGuardado={(r) => { ctx.poner('pagos', r); ctx.avisar('✓ Pago registrado'); onCerrar(); }} />
  );
}

/** 📋 Cuotas Pendientes del mes (RTpp del CRM web) */
function CuotasDelMes({ ctx, onCobro }: { ctx: Ctx; onCobro: (polizaId: string) => void }) {
  const c = ctx.cartera;
  const mes = hoyISO().slice(0, 7);
  const mesLabel = new Date().toLocaleString('es-PA', { month: 'long', year: 'numeric' });
  const filas = useMemo(() => c.polizas
    .filter((p) => !['Cancelada', 'Anulada'].includes(txt(p, 'estado')) && ((num(p, 'letraPrima') ?? 0) > 0 || (num(p, 'numPagos') ?? 0) > 0))
    .sort((a, b) => txt(a, 'nombreCliente').localeCompare(txt(b, 'nombreCliente'), 'es'))
    .map((pol) => {
      const cli = c.clientes.find((x) => x.id === txt(pol, 'clienteId'));
      const nombre = txt(pol, 'nombreCliente') || txt(cli, 'nombre');
      const lp = num(pol, 'letraPrima') ?? 0, pr = num(pol, 'prima') ?? 0;
      const cuota = lp > 0 ? dinero(lp) : pr > 0 ? dinero(pr) : '—';
      const pagado = c.pagos.some((pg) => txt(pg, 'polizaId') === pol.id && (txt(pg, 'periodo') || txt(pg, 'fecha')).slice(0, 7) === mes);
      const wa = enlaceWhatsApp(txt(cli, 'cel') || txt(cli, 'tel') || txt(pol, 'telAsegurado'));
      const msg = `Estimado/a ${nombre}, le recordamos el cobro de su póliza ${txt(pol, 'num')} (${txt(pol, 'aseg')}), cuota ${cuota}, correspondiente a ${mesLabel}.`;
      return { pol, nombre, cuota, pagado, wa: wa ? `${wa}?text=${encodeURIComponent(msg)}` : null };
    }), [c, mes, mesLabel]);
  const pend = filas.filter((f) => !f.pagado).length;
  if (!filas.length) return <Vacio>Sin cuotas configuradas. Edite las pólizas y defina Num. de Pagos y Letra/Prima.</Vacio>;
  return (
    <>
      <p className="contador">{mes} · {pend} pendiente{pend === 1 ? '' : 's'} · {filas.length - pend} cobrada{filas.length - pend === 1 ? '' : 's'}</p>
      <ListaLarga items={filas} vacio="" render={(f) => (
        <Fila key={f.pol.id} titulo={f.nombre || 'Sin nombre'}
          sub={[txt(f.pol, 'num'), txt(f.pol, 'aseg'), txt(f.pol, 'ramo'), f.cuota, `vence ${fecha(fec(f.pol, 'fechaFin'))}`].filter(Boolean).join(' · ')}
          derecha={<span className={`etiqueta ${f.pagado ? 'e-ok' : 'e-aviso'}`}>{f.pagado ? 'Cobrado' : 'Pendiente'}</span>}
          onClick={() => ctx.abrir('polizas', f.pol.id)}
          acciones={(
            <>
              {f.wa && <a className="icono-accion" style={{ display: 'grid', placeItems: 'center', background: 'var(--ok-f)' }} href={f.wa} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${f.nombre}`}>💬</a>}
              {!f.pagado && <button className="icono-accion" type="button" aria-label={`Registrar cobro de ${f.nombre}`} onClick={() => onCobro(f.pol.id)}>＋</button>}
            </>
          )} />
      )} />
    </>
  );
}

export function Pagos({ ctx }: { ctx: Ctx }) {
  const [vista, setVista] = useState<'cuotas' | 'registrados'>('cuotas');
  const [f, setF] = useState<FiltroPago>('todos');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState<{ polizaId?: string } | null>(null);
  const lista = useMemo(() => {
    const t = normalizar(q);
    return ctx.cartera.pagos.filter((p) => {
      const pag = /pagad|cobrad/i.test(txt(p, 'estado'));
      if (f === 'pendientes' && pag) return false;
      if (f === 'pagados' && !pag) return false;
      return !t || busca(p, t, ['cliente', 'aseg', 'ramo', 'referencia', 'notas', 'cuota']);
    }).sort((a, b) => fec(b, 'fecha').localeCompare(fec(a, 'fecha')));
  }, [ctx.cartera.pagos, f, q]);
  const total = lista.reduce((s, p) => s + (num(p, 'monto') ?? 0), 0);
  return (
    <>
      <Filtros valor={vista} cambiar={setVista} opciones={[['cuotas', '📋 Cuotas del mes'], ['registrados', '💰 Pagos registrados']]} />
      {vista === 'cuotas' ? (
        <CuotasDelMes ctx={ctx} onCobro={(polizaId) => setNuevo({ polizaId })} />
      ) : (
        <>
          <Buscador q={q} setQ={setQ} ph="Cliente, aseguradora o referencia" />
          <Filtros<FiltroPago> valor={f} cambiar={setF} opciones={[['todos', 'Todos'], ['pendientes', 'Pendientes'], ['pagados', 'Pagados']]} />
          <p className="contador">{lista.length} pagos · {dinero(total)}</p>
          <ListaLarga items={lista} vacio="No hay pagos registrados." render={(p) => <FilaPago key={p.id} p={p} ctx={ctx} />} />
        </>
      )}
      <BotonNuevo texto="Registrar pago" onClick={() => setNuevo({})} />
      {nuevo && <NuevoPago ctx={ctx} polizaId={nuevo.polizaId} onCerrar={() => setNuevo(null)} />}
    </>
  );
}

export function PagoFicha({ ctx, p }: { ctx: Ctx; p: Reg }) {
  const pol = ctx.cartera.polizas.find((x) => x.id === txt(p, 'polizaId'));
  return (
    <>
      {pol && (
        <div className="lista">
          <FilaPoliza p={pol} ctx={ctx} conCliente />
        </div>
      )}
      <FichaCampos modulo="pagos" r={p} />
      <Editar ctx={ctx} modulo="pagos" r={p} titulo="Editar pago" />
    </>
  );
}

/* ====================== SINIESTROS ====================== */

export function Siniestros({ ctx }: { ctx: Ctx }) {
  const [abiertos, setAbiertos] = useState<'abiertos' | 'todos'>('abiertos');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const lista = useMemo(() => {
    const t = normalizar(q);
    return ctx.cartera.siniestros
      .filter((s) => (abiertos === 'abiertos' ? siniestroAbierto(s) : true))
      .filter((s) => !t || busca(s, t, ['cliente', 'asegurado', 'numSin', 'numCia', 'nombre', 'aseg', 'poliza']))
      .sort((a, b) => fec(b, 'fechaSin').localeCompare(fec(a, 'fechaSin')));
  }, [ctx.cartera.siniestros, abiertos, q]);
  return (
    <>
      <Buscador q={q} setQ={setQ} ph="Cliente, número, póliza o aseguradora" />
      <Filtros valor={abiertos} cambiar={setAbiertos} opciones={[['abiertos', 'Abiertos'], ['todos', 'Todos']]} />
      <Contador n={lista.length} total={ctx.cartera.siniestros.length} que="siniestros" />
      <ListaLarga items={lista} vacio="No hay siniestros en esta vista." render={(s) => (
        <Fila acciones={<AccionesFila ctx={ctx} modulo="siniestros" r={s} />} key={s.id} titulo={txt(s, 'cliente') || txt(s, 'asegurado') || 'Siniestro'}
          sub={[txt(s, 'nombre'), txt(s, 'aseg'), fecha(fec(s, 'fechaSin'))].filter(Boolean).join(' · ')}
          derecha={<EtiquetaEstado estado={txt(s, 'estado') || null} />} onClick={() => ctx.abrir('siniestros', s.id)} />
      )} />
      <BotonNuevo texto="Nuevo siniestro" onClick={() => setNuevo(true)} />
      {nuevo && <NuevoRegistro ctx={ctx} modulo="siniestros" titulo="Nuevo siniestro" base={{ estado: 'En proceso', amparos: [], archivos: [] }}
        onCerrar={() => setNuevo(false)} onCreado={(r) => ctx.abrir('siniestros', r.id)} />}
    </>
  );
}

export function SiniestroFicha({ ctx, s }: { ctx: Ctx; s: Reg }) {
  const cliente = ctx.cartera.clientes.find((c) => c.id === txt(s, 'clienteId'));
  return (
    <>
      <Contacto r={cliente ?? ({ id: '', cel: txt(s, 'cel') } as Reg)} />
      <div className="chips"><EtiquetaEstado estado={txt(s, 'estado') || null} /><span className="chip">{txt(s, 'aseg')}</span></div>
      {cliente && (
        <div className="lista">
          <Fila inicial={inicial(txt(cliente, 'nombre'))} titulo={txt(cliente, 'nombre')} sub="Ver ficha del cliente"
            onClick={() => ctx.abrir('clientes', cliente.id)} />
        </div>
      )}
      <Adjuntos modulo="siniestros" r={s} avisar={ctx.avisar} alCambiar={(n) => ctx.poner('siniestros', n)} />
      <FichaCampos modulo="siniestros" r={s} />
      <Editar ctx={ctx} modulo="siniestros" r={s} titulo="Editar siniestro" />
    </>
  );
}

/* ====================== VEHÍCULOS ====================== */

export function Vehiculos({ ctx }: { ctx: Ctx }) {
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const lista = useMemo(() => {
    const t = normalizar(q);
    return ctx.cartera.vehiculos.filter((v) => !t || busca(v, t, ['placa', 'clienteNom', 'clienteDoc']))
      .sort((a, b) => txt(a, 'placa').localeCompare(txt(b, 'placa')));
  }, [ctx.cartera.vehiculos, q]);
  const proximo = (v: Reg) => {
    const ds = ['soat', 'tecno', 'imp'].map((k) => diasHasta(fec(v, k))).filter((d): d is number => d !== null && d <= 30);
    return ds.length ? Math.min(...ds) : null;
  };
  return (
    <>
      <Buscador q={q} setQ={setQ} ph="Placa o cliente" />
      <Contador n={lista.length} total={ctx.cartera.vehiculos.length} que="vehículos" />
      <ListaLarga items={lista} vacio="No hay vehículos." render={(v) => {
        const d = proximo(v);
        return (
          <Fila acciones={<AccionesFila ctx={ctx} modulo="vehiculos" r={v} />} key={v.id} titulo={txt(v, 'placa') || 'Sin placa'} sub={txt(v, 'clienteNom')}
            derecha={d !== null ? <span className={`etiqueta ${d < 0 ? 'e-peligro' : 'e-aviso'}`}>{d < 0 ? 'Vencido' : `${d} días`}</span> : undefined}
            onClick={() => ctx.abrir('vehiculos', v.id)} />
        );
      }} />
      <BotonNuevo texto="Nuevo vehículo" onClick={() => setNuevo(true)} />
      {nuevo && <NuevoRegistro ctx={ctx} modulo="vehiculos" titulo="Nuevo vehículo" onCerrar={() => setNuevo(false)} />}
    </>
  );
}

export function VehiculoFicha({ ctx, v }: { ctx: Ctx; v: Reg }) {
  const cliente = ctx.cartera.clientes.find((c) => c.id === txt(v, 'clienteId'));
  return (
    <>
      {cliente && (
        <div className="lista">
          <Fila inicial={inicial(txt(cliente, 'nombre'))} titulo={txt(cliente, 'nombre')} sub="Ver ficha del cliente"
            onClick={() => ctx.abrir('clientes', cliente.id)} />
        </div>
      )}
      <Adjuntos modulo="vehiculos" r={v} avisar={ctx.avisar} alCambiar={(n) => ctx.poner('vehiculos', n)} />
      <FichaCampos modulo="vehiculos" r={v} />
      <Editar ctx={ctx} modulo="vehiculos" r={v} titulo="Editar vehículo" />
    </>
  );
}

/* ====================== COMISIONES ====================== */

export function Comisiones({ ctx }: { ctx: Ctx }) {
  const [f, setF] = useState<'pendiente' | 'cobrada' | 'todas'>('pendiente');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const lista = useMemo(() => {
    const t = normalizar(q);
    return ctx.cartera.comisiones.filter((c) => (f === 'todas' ? true : (txt(c, 'estado') || 'pendiente') === f))
      .filter((c) => !t || busca(c, t, ['aseg', 'ramo', 'mes', 'polizaNum']))
      .sort((a, b) => (fec(b, 'fecha') || txt(b, 'mes')).localeCompare(fec(a, 'fecha') || txt(a, 'mes')));
  }, [ctx.cartera.comisiones, f, q]);
  const total = lista.reduce((s, c) => s + (num(c, 'monto') ?? 0), 0);
  return (
    <>
      <Buscador q={q} setQ={setQ} ph="Aseguradora, ramo o mes" />
      <Filtros valor={f} cambiar={setF} opciones={[['pendiente', 'Pendientes'], ['cobrada', 'Cobradas'], ['todas', 'Todas']]} />
      <p className="contador">{lista.length} comisiones · {dinero(total)}</p>
      <ListaLarga items={lista} vacio="No hay comisiones en esta vista." render={(c) => (
        <Fila acciones={<AccionesFila ctx={ctx} modulo="comisiones" r={c} />} key={c.id} titulo={`${dinero(num(c, 'monto'))} · ${txt(c, 'aseg')}`}
          sub={[txt(c, 'ramo'), txt(c, 'mes') || fecha(fec(c, 'fecha')), txt(c, 'polizaNum')].filter(Boolean).join(' · ')}
          derecha={<EtiquetaEstado estado={txt(c, 'estado') === 'cobrada' ? 'Cobrada' : 'Pendiente'} />}
          onClick={() => ctx.abrir('comisiones', c.id)} />
      )} />
      <BotonNuevo texto="Nueva comisión" onClick={() => setNuevo(true)} />
      {nuevo && <NuevoRegistro ctx={ctx} modulo="comisiones" titulo="Nueva comisión" base={{ estado: 'pendiente', fecha: hoyISO() }}
        onCerrar={() => setNuevo(false)} />}
    </>
  );
}

export function ComisionFicha({ ctx, c }: { ctx: Ctx; c: Reg }) {
  const pol = ctx.cartera.polizas.find((x) => x.id === txt(c, 'polizaId'));
  return (
    <>
      {pol && <div className="lista"><FilaPoliza p={pol} ctx={ctx} conCliente /></div>}
      <FichaCampos modulo="comisiones" r={c} />
      <Editar ctx={ctx} modulo="comisiones" r={c} titulo="Editar comisión" />
    </>
  );
}

/* ====================== PROSPECTOS ====================== */

export function Prospectos({ ctx }: { ctx: Ctx }) {
  const [f, setF] = useState<'curso' | 'ganados' | 'perdidos'>('curso');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const lista = useMemo(() => {
    const t = normalizar(q);
    return ctx.cartera.prospectos.filter((p) => {
      const e = txt(p, 'etapaVenta');
      if (f === 'curso' && !prospectoAbierto(p)) return false;
      if (f === 'ganados' && e !== 'Cliente ganado') return false;
      if (f === 'perdidos' && e !== 'Perdido') return false;
      return !t || busca(p, t, ['nombre', 'cel', 'email', 'fuente', 'cedula']);
    }).sort((a, b) => (seguimientoProspecto(a) || '9999').localeCompare(seguimientoProspecto(b) || '9999'));
  }, [ctx.cartera.prospectos, f, q]);
  return (
    <>
      <Buscador q={q} setQ={setQ} ph="Nombre, celular, correo o fuente" />
      <Filtros valor={f} cambiar={setF} opciones={[['curso', 'En curso'], ['ganados', 'Ganados'], ['perdidos', 'Perdidos']]} />
      <Contador n={lista.length} total={ctx.cartera.prospectos.length} que="prospectos" />
      <ListaLarga items={lista} vacio="No hay prospectos en esta vista." render={(p) => {
        const d = diasHasta(seguimientoProspecto(p));
        return (
          <Fila acciones={<AccionesFila ctx={ctx} modulo="prospectos" r={p} />} key={p.id} inicial={inicial(txt(p, 'nombre'))} titulo={txt(p, 'nombre') || 'Sin nombre'}
            sub={[txt(p, 'etapaVenta'), txt(p, 'fuente'), seguimientoProspecto(p) ? `seguir ${fecha(seguimientoProspecto(p))}` : ''].filter(Boolean).join(' · ')}
            derecha={f === 'curso' && d !== null && d <= 0 ? <span className="etiqueta e-peligro">Contactar</span> : undefined}
            onClick={() => ctx.abrir('prospectos', p.id)} />
        );
      }} />
      <BotonNuevo texto="Nuevo prospecto" onClick={() => setNuevo(true)} />
      {nuevo && <NuevoRegistro ctx={ctx} modulo="prospectos" titulo="Nuevo prospecto"
        base={{
          tipo: 'Personal', tipoDoc: 'Cédula', codPais: '507', fuente: 'Referido', etapaVenta: 'Contacto inicial', prioridad: 'Media',
          probabilidad: 0, montoEstimado: 0, fContacto: hoyISO(), esVentaCruzada: false, clienteIdVinculado: '',
          historial: [{ fecha: hoyISO(), accion: '✨ Prospecto creado', resultado: '', tipo: 'sistema' }],
          tareas: [], archivos: [], etiquetas: [], interes: [], asegPreferidas: [], cotizaciones: [],
        }}
        onCerrar={() => setNuevo(false)} onCreado={(r) => ctx.abrir('prospectos', r.id)} />}
    </>
  );
}

export function ProspectoFicha({ ctx, p }: { ctx: Ctx; p: Reg }) {
  const [etapa, setEtapa] = useState(false);
  const [tarea, setTarea] = useState(false);
  const prob = Math.max(0, Math.min(100, num(p, 'probabilidad') ?? 0));
  async function avanzar(e: string) {
    try {
      const r = await avanzarEtapa(ctx.cartera, p, e);
      ctx.poner('prospectos', r.prospecto);
      if (r.cliente) ctx.poner('clientes', r.cliente);
      ctx.avisar(r.mensaje);
    } catch {
      ctx.avisar('No se pudo guardar.');
    }
    setEtapa(false);
  }
  return (
    <>
      <Contacto r={p} />
      <div className="tarjeta">
        <dl className="datos">
          <dt>Etapa</dt><dd>{txt(p, 'etapaVenta') || '—'}</dd>
          <dt>Probabilidad</dt><dd>{prob}%</dd>
        </dl>
        <div className="barra"><div className="barra-relleno" style={{ width: `${prob}%` }} /></div>
        {num(p, 'montoEstimado') ? <p className="contador">Valor estimado: {dinero(num(p, 'montoEstimado'))}</p> : null}
        {Array.isArray(p.interes) && (p.interes as unknown[]).length > 0 && <p className="contador">Interés: {(p.interes as unknown[]).join(' · ')}</p>}
      </div>
      <div className="botonera">
        <button className="boton" type="button" onClick={() => setEtapa(true)}>Avanzar etapa</button>
        <button className="boton secundario" type="button" onClick={() => setTarea(true)}>+ Tarea</button>
      </div>
      <Historial modulo="prospectos" r={p} avisar={ctx.avisar} alCambiar={(n) => ctx.poner('prospectos', n)} conSeguimiento />
      <Adjuntos modulo="prospectos" r={p} avisar={ctx.avisar} alCambiar={(n) => ctx.poner('prospectos', n)} />
      <FichaCampos modulo="prospectos" r={p} />
      <Editar ctx={ctx} modulo="prospectos" r={p} titulo="Editar prospecto" />
      {etapa && (
        <Hoja titulo="Avanzar etapa" onCerrar={() => setEtapa(false)}>
          <div className="lista">
            {ETAPAS_VENTA.filter(([e]) => e !== txt(p, 'etapaVenta')).map(([e]) => (
              <Fila key={e} titulo={`→ ${e}`} onClick={() => avanzar(e)} />
            ))}
          </div>
        </Hoja>
      )}
      {tarea && <NuevoRegistro ctx={ctx} modulo="tareas" titulo="Nueva tarea"
        base={{ prospectoId: p.id, tipoRel: 'prospecto', relId: p.id, etapaTarea: 'Por Hacer', estado: 'pendiente', fechaLimite: hoyISO(), fechaCreacion: hoyISO() }}
        onCerrar={() => setTarea(false)} />}
    </>
  );
}
