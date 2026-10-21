import { useMemo, useState, type ReactNode } from 'react';
import { Icono } from '../components/Icono';
import { Accion, EtiquetaEstado, Fila, Hoja, Vacio, inicial } from '../components/Piezas';
import { Adjuntos, FichaCampos, FormRegistro, Historial, ListaLarga } from '../components/Registro';
import { fec, num, registrarAccion, txt, type Cartera, type Reg } from '../lib/datos';
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
  ponerMeta: (clave: 'calReuniones' | 'calNotas' | 'calMetas' | 'calDiarios', v: unknown) => void;
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

/* Cabecera de una ficha con boton editar */
function Editar({ ctx, modulo, r, titulo }: { ctx: Ctx; modulo: Modulo; r: Reg; titulo: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button className="boton mas-abajo" type="button" onClick={() => setAbierto(true)}>✏️ Editar todos los datos</button>
      {abierto && (
        <FormRegistro modulo={modulo} titulo={titulo} r={r} cartera={ctx.cartera} onCerrar={() => setAbierto(false)}
          onGuardado={(n) => { ctx.poner(modulo, n); setAbierto(false); ctx.avisar('✓ Cambios guardados'); }} />
      )}
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

export function Clientes({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const [tab, setTab] = useState<TabCli>('todos');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const cuenta = useMemo(() => {
    const c = { todos: cartera.clientes.length, personal: 0, empresa: 0, vip: 0, ganado: 0, perdido: 0, inactivo: 0 };
    for (const x of cartera.clientes) {
      if (esEmpresa(x)) c.empresa++; else c.personal++;
      const e = estadoComercial(x) as keyof typeof c;
      if (e in c && e !== 'todos') c[e]++;
    }
    return c;
  }, [cartera.clientes]);
  const lista = useMemo(() => {
    const t = normalizar(q);
    const dig = q.replace(/\D/g, '');
    return cartera.clientes.filter((c) => {
      if (tab === 'empresa' && !esEmpresa(c)) return false;
      if (tab === 'personal' && esEmpresa(c)) return false;
      if (['vip', 'ganado', 'perdido', 'inactivo'].includes(tab) && estadoComercial(c) !== tab) return false;
      if (!t) return true;
      return busca(c, t, ['nombre', 'alias', 'cedula', 'email', 'ciudad']) ||
        (dig.length >= 4 && txt(c, 'cel').replace(/\D/g, '').includes(dig));
    });
  }, [cartera.clientes, tab, q]);
  const polizasDe = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of cartera.polizas) if (polizaVigente(p)) m.set(txt(p, 'clienteId'), (m.get(txt(p, 'clienteId')) ?? 0) + 1);
    return m;
  }, [cartera.polizas]);

  return (
    <>
      <Buscador q={q} setQ={setQ} ph="Nombre, cédula, correo, celular o ciudad" />
      <Filtros<TabCli> valor={tab} cambiar={setTab} opciones={[
        ['todos', `👥 Todos (${cuenta.todos})`], ['personal', `🧑 Personales (${cuenta.personal})`],
        ['empresa', `🏢 Empresas (${cuenta.empresa})`], ['vip', `⭐ VIP (${cuenta.vip})`],
        ['ganado', `✅ Ganados (${cuenta.ganado})`], ['perdido', `❌ Perdidos (${cuenta.perdido})`],
        ['inactivo', `⚫ Inactivos (${cuenta.inactivo})`],
      ]} />
      <Contador n={lista.length} total={cartera.clientes.length} que="clientes" />
      <ListaLarga items={lista} vacio="No se encontraron clientes." render={(c) => (
        <Fila key={c.id} inicial={inicial(txt(c, 'nombre'))} titulo={txt(c, 'nombre') || 'Sin nombre'}
          sub={[txt(c, 'cedula'), txt(c, 'cel'), polizasDe.get(c.id) ? `${polizasDe.get(c.id)} pól.` : ''].filter(Boolean).join(' · ')}
          derecha={estadoComercial(c) !== 'activo' ? <EtiquetaEstado estado={ESTADOS_COMERCIALES.find(([v]) => v === estadoComercial(c))?.[1] ?? null} /> : undefined}
          onClick={() => ctx.abrir('clientes', c.id)} />
      )} />
      <BotonNuevo texto="Nuevo cliente" onClick={() => setNuevo(true)} />
      {nuevo && <NuevoRegistro ctx={ctx} modulo="clientes" titulo="Nuevo cliente"
        base={{ tipo: 'Persona Natural', tipoDoc: 'Cédula', estadoComercial: 'activo', estadoCli: 'activo', codPais: '507', alias: '', historialWA: [], archivos: [] }}
        onCerrar={() => setNuevo(false)} onCreado={(r) => ctx.abrir('clientes', r.id)} />}
    </>
  );
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

  return (
    <>
      <Contacto r={c} />
      <div className="chips">
        <span className="chip">{esEmpresa(c) ? '🏢 Empresa' : '🧑 Personal'}</span>
        <span className="chip">{ESTADOS_COMERCIALES.find(([v]) => v === estadoComercial(c))?.[1]}</span>
        <span className="chip">{polizas.filter(polizaVigente).length} pólizas vigentes</span>
        {prima > 0 && <span className="chip">{dinero(prima)} en primas</span>}
      </div>

      <Seccion titulo="Pólizas" n={polizas.length} accion={<MasPeque texto="Póliza" onClick={() => setCrear('polizas')} />}>
        {polizas.length ? (
          <div className="lista">
            {polizas.map((p) => <FilaPoliza key={p.id} p={p} ctx={ctx} />)}
          </div>
        ) : <Vacio>Sin pólizas.</Vacio>}
      </Seccion>

      <Seccion titulo="Vehículos" n={vehiculos.length} accion={<MasPeque texto="Vehículo" onClick={() => setCrear('vehiculos')} />}>
        {vehiculos.length > 0 && (
          <div className="lista">
            {vehiculos.map((v) => (
              <Fila key={v.id} titulo={txt(v, 'placa') || 'Sin placa'}
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
              <Fila key={s.id} titulo={txt(s, 'nombre') || 'Siniestro'} sub={[txt(s, 'aseg'), fecha(fec(s, 'fechaSin'))].filter(Boolean).join(' · ')}
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
    <Fila titulo={conCliente ? txt(p, 'nombreCliente') || 'Sin nombre' : `${txt(p, 'ramo') || 'Póliza'} · ${txt(p, 'num')}`}
      sub={[conCliente ? txt(p, 'ramo') : '', txt(p, 'aseg'), fecha(fec(p, 'fechaFin'))].filter(Boolean).join(' · ')}
      derecha={<EtiquetaPol p={p} />} onClick={() => ctx.abrir('polizas', p.id)} />
  );
}

type FiltroPol = 'vencen' | 'vigentes' | 'vencidas' | 'canceladas' | 'todas';

export function Polizas({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const [f, setF] = useState<FiltroPol>('vencen');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const lista = useMemo(() => {
    const t = normalizar(q);
    return cartera.polizas.filter((p) => {
      const d = diasHasta(fec(p, 'fechaFin'));
      if (f === 'vencen' && !(polizaVigente(p) && d !== null && d >= 0 && d <= 30)) return false;
      if (f === 'vigentes' && !polizaVigente(p)) return false;
      if (f === 'vencidas' && !(/vencida/i.test(txt(p, 'estado')) || (polizaVigente(p) && d !== null && d < 0))) return false;
      if (f === 'canceladas' && !polizaCancelada(p)) return false;
      return !t || busca(p, t, ['nombreCliente', 'num', 'aseg', 'ramo', 'subramo', 'riesgo', 'nombreAsegurado', 'tomador']);
    }).sort((a, b) => (f === 'vencen' || f === 'vigentes'
      ? fec(a, 'fechaFin').localeCompare(fec(b, 'fechaFin'))
      : fec(b, 'fechaFin').localeCompare(fec(a, 'fechaFin'))));
  }, [cartera.polizas, f, q]);
  const total = lista.reduce((s, p) => s + (num(p, 'total') ?? num(p, 'prima') ?? 0), 0);

  return (
    <>
      <Buscador q={q} setQ={setQ} ph="Cliente, número, aseguradora, ramo o riesgo" />
      <Filtros<FiltroPol> valor={f} cambiar={setF} opciones={[
        ['vencen', '🔔 Vencen en 30 días'], ['vigentes', 'Vigentes'], ['vencidas', 'Vencidas'], ['canceladas', 'Canceladas'], ['todas', 'Todas'],
      ]} />
      <p className="contador">{lista.length} de {cartera.polizas.length} pólizas{total ? ` · ${dinero(total)}` : ''}</p>
      <ListaLarga items={lista} vacio="No hay pólizas en esta vista." render={(p) => <FilaPoliza key={p.id} p={p} ctx={ctx} conCliente />} />
      <BotonNuevo texto="Nueva póliza" onClick={() => setNuevo(true)} />
      {nuevo && <NuevoRegistro ctx={ctx} modulo="polizas" titulo="Nueva póliza"
        base={{ tipo: 'Póliza', nueva: 'Nueva', estado: 'Vigente', etapa: 'Nueva', moneda: 'USD', participacion: 100, archivos: [] }}
        onCerrar={() => setNuevo(false)} onCreado={(r) => ctx.abrir('polizas', r.id)} />}
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
      {cliente && (
        <div className="lista">
          <Fila inicial={inicial(txt(cliente, 'nombre'))} titulo={txt(cliente, 'nombre')} sub="Ver ficha del cliente"
            onClick={() => ctx.abrir('clientes', cliente.id)} />
        </div>
      )}
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
    <Fila titulo={dinero(num(p, 'monto'))}
      sub={[fecha(fec(p, 'fecha')), txt(p, 'cliente'), txt(p, 'cuota') || txt(p, 'metodo')].filter(Boolean).join(' · ')}
      derecha={<EtiquetaEstado estado={txt(p, 'estado') || null} />} onClick={() => ctx.abrir('pagos', p.id)} />
  );
}

type FiltroPago = 'pendientes' | 'pagados' | 'todos';

export function Pagos({ ctx }: { ctx: Ctx }) {
  const [f, setF] = useState<FiltroPago>('pendientes');
  const [q, setQ] = useState('');
  const lista = useMemo(() => {
    const t = normalizar(q);
    return ctx.cartera.pagos.filter((p) => {
      const pag = /pagad|cobrad/i.test(txt(p, 'estado'));
      if (f === 'pendientes' && pag) return false;
      if (f === 'pagados' && !pag) return false;
      return !t || busca(p, t, ['cliente', 'aseg', 'ramo', 'referencia', 'notas']);
    }).sort((a, b) => fec(b, 'fecha').localeCompare(fec(a, 'fecha')));
  }, [ctx.cartera.pagos, f, q]);
  const total = lista.reduce((s, p) => s + (num(p, 'monto') ?? 0), 0);
  return (
    <>
      <Buscador q={q} setQ={setQ} ph="Cliente, aseguradora o referencia" />
      <Filtros<FiltroPago> valor={f} cambiar={setF} opciones={[['pendientes', 'Pendientes'], ['pagados', 'Pagados'], ['todos', 'Todos']]} />
      <p className="contador">{lista.length} pagos · {dinero(total)}</p>
      <ListaLarga items={lista} vacio="No hay pagos en esta vista." render={(p) => <FilaPago key={p.id} p={p} ctx={ctx} />} />
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
        <Fila key={s.id} titulo={txt(s, 'cliente') || txt(s, 'asegurado') || 'Siniestro'}
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
          <Fila key={v.id} titulo={txt(v, 'placa') || 'Sin placa'} sub={txt(v, 'clienteNom')}
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
        <Fila key={c.id} titulo={`${dinero(num(c, 'monto'))} · ${txt(c, 'aseg')}`}
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
          <Fila key={p.id} inicial={inicial(txt(p, 'nombre'))} titulo={txt(p, 'nombre') || 'Sin nombre'}
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
      ctx.poner('prospectos', await registrarAccion('prospectos', p.id,
        { accion: `Etapa → ${e}`, resultado: '' }, { etapaVenta: e }));
      ctx.avisar('✓ Etapa actualizada');
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
