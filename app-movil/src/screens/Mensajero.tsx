import { useState, type FormEvent } from 'react';
import { Hoja, Vacio } from '../components/Piezas';
import { ErrorDatos, guardarMeta, txt, type Reg } from '../lib/datos';
import { esCorreo, fecha, hoyISO, limpiarTexto, nuevoId } from '../lib/formato';
import { polizaCancelada } from '../lib/reglas';
import type { Ctx } from './Modulos';

/* Replica del modulo "Mensajero" del CRM web (encomiendas) */

export const MENS_TIPOS: Record<string, string> = {
  'buscar-poliza': '📋 Buscar póliza en compañía de seguros',
  'buscar-docs': '📂 Buscar documentos en compañía de seguros',
  'llevar-docs': '🚶 Llevar documentos a cliente',
  'llevar-poliza': '🚶 Llevar póliza/documentos a cliente',
  libre: '✏️ Tarea libre',
};
const ESTADOS = ['Pendiente', 'En Camino', 'Entregado', 'Completado'];
const COLOR: Record<string, string> = { Pendiente: '#D97706', 'En Camino': '#1D4ED8', Entregado: '#7E22CE', Completado: '#15803D' };
const FIRMA = '\n\n_JAC Seguros | Jely An Castro · +507 6292-6010_';

function mensajeWA(e: Reg, nombre: string): string {
  const cliente = txt(e, 'nombreCliente') || 'el cliente';
  const pol = txt(e, 'nombrePoliza') || txt(e, 'polizaId') || '—';
  const comp = txt(e, 'compania') || '—';
  const obs = txt(e, 'observaciones') || 'Ninguna';
  const desc = txt(e, 'descripcion');
  const cab = `Hola *${nombre}* 👋\n\nTe asigno la siguiente tarea:\n\n`;
  switch (txt(e, 'tipo')) {
    case 'buscar-poliza': return `${cab}*📋 Buscar póliza en compañía de seguros*\n\n👤 Cliente: ${cliente}\n🏛 Compañía: ${comp}\n📄 Póliza: ${pol}\n📝 Obs: ${obs}${FIRMA}`;
    case 'buscar-docs': return `${cab}*📂 Buscar documentos en compañía de seguros*\n\n👤 Cliente: ${cliente}\n🏛 Compañía: ${comp}\n📝 Descripción: ${desc}\n📝 Obs: ${obs}${FIRMA}`;
    case 'llevar-docs': return `${cab}*📂 Llevar documentos a cliente*\n\n👤 Cliente: ${cliente}\n📝 Detalle: ${desc}\n📝 Obs: ${obs}\n\n🙏 Confirma cuando entregues.${FIRMA}`;
    case 'llevar-poliza': return `${cab}*📋 Llevar póliza/documentos a cliente*\n\n👤 Cliente: ${cliente}\n📄 Póliza: ${pol}\n📝 Obs: ${obs}\n\n🙏 Confirma cuando entregues.${FIRMA}`;
    default: return `${cab}${desc || MENS_TIPOS[txt(e, 'tipo')] || 'Tarea'}\n\n👤 Cliente: ${cliente}\n📝 Obs: ${obs}${FIRMA}`;
  }
}

const enlaceWA = (tel: string, msg: string) => {
  const t = tel.replace(/\D/g, '');
  if (!t) return null;
  return `https://wa.me/${t.length <= 8 ? '507' + t : t}?text=${encodeURIComponent(msg)}`;
};

export function Mensajero({ ctx }: { ctx: Ctx }) {
  const m = ctx.cartera.meta;
  const [filtro, setFiltro] = useState('');
  const [editar, setEditar] = useState<Reg | null | 'nuevo'>(null);
  const [config, setConfig] = useState(false);
  const [vista, setVista] = useState<'k' | 'l'>('k');

  async function escribir(cambiar: (l: Reg[]) => Reg[], aviso: string) {
    try {
      ctx.ponerMeta('encomiendas', await guardarMeta<Reg[]>('encomiendas', [], cambiar));
      ctx.avisar(aviso);
      return true;
    } catch (e) {
      ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
      return false;
    }
  }
  const cambiarEstado = (e: Reg, est: string) => escribir((l) => l.map((x) => (x.id === e.id
    ? { ...x, estado: est, historial: [...(Array.isArray(x.historial) ? x.historial : []), { fecha: hoyISO(), accion: 'Estado → ' + est }] }
    : x)), '✓ Estado: ' + est);
  const enviado = (e: Reg) => void escribir((l) => l.map((x) => (x.id === e.id
    ? { ...x, historial: [...(Array.isArray(x.historial) ? x.historial : []), { fecha: hoyISO(), accion: 'WhatsApp enviado' }] }
    : x)), '📱 Abriendo WhatsApp…');

  const lista = m.encomiendas.filter((e) => !filtro || txt(e, 'estado') === filtro);
  const tarjeta = (e: Reg) => {
    const clr = COLOR[txt(e, 'estado')] ?? '#64748B';
    const wa = enlaceWA(txt(e, 'telefono') || m.mensajeroTel, mensajeWA(e, m.mensajero.split(' ')[0] || 'Francisco'));
    const asunto = `[JAC Seguros] Asignación: ${MENS_TIPOS[txt(e, 'tipo')] ?? txt(e, 'tipo')} — ${txt(e, 'nombreCliente') || 'Cliente'}`;
    const cuerpo = mensajeWA(e, m.mensajero).replace(/[*_]/g, '') + `\n\nFecha asignación: ${txt(e, 'fecha')}`;
    return (
      <div key={e.id} className="men-card" style={{ borderTopColor: clr }}>
        <div className="men-tipo" style={{ color: clr }}>{MENS_TIPOS[txt(e, 'tipo')] ?? txt(e, 'tipo') ?? 'Tarea'}</div>
        {txt(e, 'nombreCliente') && <b>👤 {txt(e, 'nombreCliente')}</b>}
        {txt(e, 'compania') && <small>🏛 {txt(e, 'compania')}</small>}
        {txt(e, 'nombrePoliza') && <small>📄 {txt(e, 'nombrePoliza')}</small>}
        {txt(e, 'descripcion') && <p className="texto-largo">{txt(e, 'descripcion')}</p>}
        <small>📅 {fecha(txt(e, 'fecha'))}</small>
        <div className="ag-anot-botones">
          {wa && <a className="mini verde" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => enviado(e)}>💬 WA</a>}
          {m.mensajeroEmail && esCorreo(m.mensajeroEmail) && (
            <a className="mini" href={`mailto:${encodeURIComponent(m.mensajeroEmail)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`}>📧</a>
          )}
          <button type="button" className="mini" onClick={() => setEditar(e)}>✏️</button>
        </div>
        <div className="men-estados">
          {ESTADOS.filter((s) => s !== txt(e, 'estado')).map((s) => (
            <button key={s} type="button" style={{ background: COLOR[s] }} onClick={() => cambiarEstado(e, s)}>{s}</button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="tarjeta men-cab">
        <div><b>👤 {m.mensajero}</b><small> · 📱 {m.mensajeroTel || '—'}</small></div>
        <div className="ag-anot-botones">
          {enlaceWA(m.mensajeroTel, `Hola *${m.mensajero}* 👋\n\nTe contacto desde JAC Seguros | Jely An Castro.${FIRMA}`) && (
            <a className="mini verde" href={enlaceWA(m.mensajeroTel, `Hola *${m.mensajero}* 👋\n\nTe contacto desde JAC Seguros | Jely An Castro.${FIRMA}`)!} target="_blank" rel="noopener noreferrer">💬 WA</a>
          )}
          <button type="button" className="mini" onClick={() => setConfig(true)}>⚙️ Datos del mensajero</button>
        </div>
      </div>
      <div className="kpis kpis-4">
        {ESTADOS.map((s) => (
          <button key={s} type="button" className={`kpi${filtro === s ? ' kpi-sel' : ''}`} style={{ borderTop: `3px solid ${COLOR[s]}` }} onClick={() => setFiltro(filtro === s ? '' : s)}>
            <b style={{ color: COLOR[s] }}>{m.encomiendas.filter((e) => txt(e, 'estado') === s).length}</b><span>{s}</span>
          </button>
        ))}
      </div>
      <div className="filtros">
        <button type="button" className={vista === 'k' ? 'activa' : ''} onClick={() => setVista('k')}>🗂 Tablero</button>
        <button type="button" className={vista === 'l' ? 'activa' : ''} onClick={() => setVista('l')}>☰ Lista</button>
      </div>
      {!m.encomiendas.length && <Vacio>Sin asignaciones. Usa “+” para crear la primera.</Vacio>}
      {vista === 'k' && m.encomiendas.length > 0 && (
        <div className="pipe">
          {ESTADOS.filter((s) => !filtro || s === filtro).map((s) => {
            const items = m.encomiendas.filter((e) => txt(e, 'estado') === s);
            return (
              <div key={s} className="pipe-col">
                <div className="pipe-cab" style={{ background: COLOR[s], color: '#fff' }}>{s} ({items.length})</div>
                <div className="pipe-cuerpo">{items.length ? items.map(tarjeta) : <p className="sincro">Sin asignaciones</p>}</div>
              </div>
            );
          })}
        </div>
      )}
      {vista === 'l' && lista.length > 0 && <div className="men-lista">{lista.slice().reverse().map(tarjeta)}</div>}
      <button className="flotante" type="button" aria-label="Nueva asignación" onClick={() => setEditar('nuevo')}>+</button>
      {editar && <EditarAsignacion ctx={ctx} e={editar === 'nuevo' ? null : editar} escribir={escribir} onCerrar={() => setEditar(null)} />}
      {config && <ConfigMensajero ctx={ctx} onCerrar={() => setConfig(false)} />}
    </>
  );
}

function EditarAsignacion({ ctx, e, escribir, onCerrar }: {
  ctx: Ctx; e: Reg | null; escribir: (f: (l: Reg[]) => Reg[], aviso: string) => Promise<boolean>; onCerrar: () => void;
}) {
  const [v, setV] = useState({
    tipo: txt(e, 'tipo'), clienteId: txt(e, 'clienteId'), polizaId: txt(e, 'polizaId'), compania: txt(e, 'compania'),
    descripcion: txt(e, 'descripcion'), telefono: txt(e, 'telefono') || ctx.cartera.meta.mensajeroTel, observaciones: txt(e, 'observaciones'),
    estado: txt(e, 'estado') || 'Pendiente',
  });
  const [borrar, setBorrar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const polizas = ctx.cartera.polizas.filter((p) => txt(p, 'clienteId') === v.clienteId && !polizaCancelada(p));
  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    if (!v.tipo) return ctx.avisar('Selecciona el tipo de tarea');
    if (v.tipo === 'libre' && !v.descripcion.trim()) return ctx.avisar('Escribe la descripción de la tarea');
    setOcupado(true);
    const cl = ctx.cartera.clientes.find((c) => c.id === v.clienteId);
    const pol = ctx.cartera.polizas.find((p) => p.id === v.polizaId);
    const enc: Reg = {
      ...(e ?? {}), id: e?.id ?? nuevoId('ENC'), fecha: txt(e, 'fecha') || hoyISO(), tipo: v.tipo,
      clienteId: v.clienteId, nombreCliente: txt(cl, 'nombre'), polizaId: v.polizaId,
      nombrePoliza: pol ? `${txt(pol, 'ramo')} ${txt(pol, 'num')}`.trim() : '', compania: limpiarTexto(v.compania, 120),
      descripcion: limpiarTexto(v.descripcion, 2000) || MENS_TIPOS[v.tipo] || v.tipo, telefono: limpiarTexto(v.telefono, 30),
      observaciones: limpiarTexto(v.observaciones, 2000), adjunto: txt(e, 'adjunto'), estado: v.estado,
      historial: Array.isArray(e?.historial) ? e!.historial : [],
    };
    const ok = await escribir((l) => (l.some((x) => x.id === enc.id) ? l.map((x) => (x.id === enc.id ? enc : x)) : [...l, enc]), '✓ Asignación guardada');
    if (ok) onCerrar(); else setOcupado(false);
  }
  return (
    <Hoja titulo={e ? '📦 Editar asignación' : '📦 Nueva asignación'} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <label className="campo"><span>Tipo de tarea *</span>
          <select value={v.tipo} onChange={(x) => setV({ ...v, tipo: x.target.value })}>
            <option value="">— Seleccionar —</option>
            {Object.entries(MENS_TIPOS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select></label>
        <label className="campo"><span>Cliente</span>
          <select value={v.clienteId} onChange={(x) => setV({ ...v, clienteId: x.target.value, polizaId: '' })}>
            <option value="">— Sin cliente —</option>
            {ctx.cartera.clientes.map((c) => <option key={c.id} value={c.id}>{txt(c, 'nombre')}</option>)}
          </select></label>
        {(v.tipo === 'buscar-poliza' || v.tipo === 'llevar-poliza') && (
          <label className="campo"><span>Póliza</span>
            <select value={v.polizaId} onChange={(x) => setV({ ...v, polizaId: x.target.value })}>
              <option value="">— Sin póliza —</option>
              {polizas.map((p) => <option key={p.id} value={p.id}>{`${txt(p, 'ramo')} · ${txt(p, 'aseg')}${txt(p, 'num') ? ' (' + txt(p, 'num') + ')' : ''}`}</option>)}
            </select></label>
        )}
        {(v.tipo === 'buscar-poliza' || v.tipo === 'buscar-docs') && (
          <label className="campo"><span>Compañía</span><input value={v.compania} onChange={(x) => setV({ ...v, compania: x.target.value })} /></label>
        )}
        <label className="campo"><span>Descripción</span><textarea value={v.descripcion} onChange={(x) => setV({ ...v, descripcion: x.target.value })} /></label>
        <label className="campo"><span>Teléfono del mensajero</span><input type="tel" value={v.telefono} onChange={(x) => setV({ ...v, telefono: x.target.value })} /></label>
        <label className="campo"><span>Observaciones</span><textarea value={v.observaciones} onChange={(x) => setV({ ...v, observaciones: x.target.value })} /></label>
        <label className="campo"><span>Estado</span>
          <select value={v.estado} onChange={(x) => setV({ ...v, estado: x.target.value })}>{ESTADOS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <div className="botonera">
          <button className="boton" type="submit" disabled={ocupado}>Guardar</button>
          {e && !borrar && <button className="boton peligro" type="button" onClick={() => setBorrar(true)}>🗑 Eliminar</button>}
          {e && borrar && <button className="boton peligro" type="button" disabled={ocupado}
            onClick={async () => { setOcupado(true); if (await escribir((l) => l.filter((x) => x.id !== e.id), '✓ Eliminada')) onCerrar(); else setOcupado(false); }}>Confirmar: eliminar</button>}
        </div>
      </form>
    </Hoja>
  );
}

function ConfigMensajero({ ctx, onCerrar }: { ctx: Ctx; onCerrar: () => void }) {
  const m = ctx.cartera.meta;
  const [v, setV] = useState({ mensajero: m.mensajero, mensajeroTel: m.mensajeroTel, mensajeroEmail: m.mensajeroEmail });
  const [ocupado, setOcupado] = useState(false);
  async function guardar(ev: FormEvent) {
    ev.preventDefault();
    if (!v.mensajero.trim()) return ctx.avisar('Escribe el nombre');
    if (v.mensajeroEmail && !esCorreo(v.mensajeroEmail)) return ctx.avisar('El correo no es válido');
    setOcupado(true);
    try {
      for (const k of ['mensajero', 'mensajeroTel', 'mensajeroEmail'] as const) {
        const val = limpiarTexto(v[k], 120);
        if (val !== m[k]) ctx.ponerMeta(k, await guardarMeta<string>(k, '', () => val));
      }
      ctx.avisar('✓ Datos del mensajero actualizados');
      onCerrar();
    } catch (e) {
      ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }
  return (
    <Hoja titulo="Datos del mensajero" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <label className="campo"><span>Nombre</span><input value={v.mensajero} onChange={(x) => setV({ ...v, mensajero: x.target.value })} /></label>
        <label className="campo"><span>Teléfono</span><input type="tel" value={v.mensajeroTel} onChange={(x) => setV({ ...v, mensajeroTel: x.target.value })} /></label>
        <label className="campo"><span>Correo (opcional)</span><input type="email" value={v.mensajeroEmail} onChange={(x) => setV({ ...v, mensajeroEmail: x.target.value })} /></label>
        <div className="botonera"><button className="boton" type="submit" disabled={ocupado}>Guardar</button></div>
      </form>
    </Hoja>
  );
}
