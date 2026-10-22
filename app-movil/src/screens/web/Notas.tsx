import { useMemo, useState } from 'react';
import { Fila, Hoja, Vacio } from '../../components/Piezas';
import { ErrorDatos, guardarMeta, txt, type Reg } from '../../lib/datos';
import { enlaceCorreo, fecha, hoyISO, limpiarTexto, normalizar, nuevoId } from '../../lib/formato';
import {
  clasificarNotas, COLORES_NOTA, conEstado, ESTADOS_NOTA, estadoVisible, filtrarNotas, seccionNota,
  type FiltroNotas, type Nota,
} from '../../lib/notas';
import type { Ctx } from '../Modulos';

/* Replica de "📝 Notas & Recordatorios" del CRM web (pg-not), guardadas en crm_meta 'notas' */

const FILTROS: Array<[FiltroNotas, string]> = [['', 'Todas'], ['alert', 'Con recordatorio'], ['noalert', 'Sin recordatorio']];

export function Notas({ ctx }: { ctx: Ctx }) {
  const notas = ctx.cartera.meta.notas as Nota[];
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<FiltroNotas>('');
  const [editar, setEditar] = useState<Nota | 'nueva' | null>(null);
  const [borrar, setBorrar] = useState<Nota | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const hoy = hoyISO();
  const { vencidas, pronto } = useMemo(() => clasificarNotas(notas, hoy), [notas, hoy]);
  const lista = useMemo(() => filtrarNotas(notas, q, filtro), [notas, q, filtro]);

  /** Relee la lista de la nube, aplica el cambio y la sube (no pisa lo que se hizo en la computadora) */
  async function escribir(cambiar: (l: Nota[]) => Nota[], aviso: string): Promise<boolean> {
    setOcupado(true);
    try {
      const v = await guardarMeta<Reg[]>('notas', [], (l) => cambiar(Array.isArray(l) ? (l as Nota[]) : []));
      ctx.ponerMeta('notas', v);
      ctx.avisar(aviso);
      return true;
    } catch (e) {
      ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const ponerEstado = (n: Nota, est: string, aviso = '✓ Estado: ' + est) =>
    escribir((l) => l.map((x) => (x.id === n.id ? conEstado(x, est) : x)), aviso);

  const tarjeta = (n: Nota) => (
    <TarjetaNota key={n.id} ctx={ctx} n={n} hoy={hoy} ocupado={ocupado}
      onEstado={(est) => ponerEstado(n, est)}
      onHecha={() => (n.done ? ponerEstado(n, 'pendiente', '↺ Nota reabierta') : ponerEstado(n, 'completado', '✓ Nota marcada como hecha'))}
      onEditar={() => setEditar(n)} onBorrar={() => setBorrar(n)} />
  );

  return (
    <div className="not">
      <div className="not-cab">
        <div>
          <b>📝 Notas &amp; Recordatorios</b>
          <small>{notas.length} nota{notas.length !== 1 ? 's' : ''}</small>
        </div>
        <button className="boton" type="button" onClick={() => setEditar('nueva')}>+ Nueva Nota</button>
      </div>

      <div className="seccion-fila">
        <h3 className="seccion">🔔 Vencidas / Hoy</h3>
        <span className="not-cuenta not-c-aviso">{vencidas.length} pendiente{vencidas.length !== 1 ? 's' : ''}</span>
      </div>
      {vencidas.length ? <div className="not-lista">{vencidas.map(tarjeta)}</div> : <Vacio>Sin alertas pendientes ✓</Vacio>}

      <div className="seccion-fila">
        <h3 className="seccion">📅 Próximos 7 días</h3>
        <span className="not-cuenta not-c-info">{pronto.length} próxima{pronto.length !== 1 ? 's' : ''}</span>
      </div>
      {pronto.length ? <div className="not-lista">{pronto.map(tarjeta)}</div> : <Vacio>Sin recordatorios próximos</Vacio>}

      <h3 className="seccion">📋 Todas las Notas</h3>
      <input className="buscador" type="search" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} maxLength={80} />
      <div className="filtros">
        {FILTROS.map(([k, t]) => <button key={k} type="button" className={filtro === k ? 'activa' : ''} onClick={() => setFiltro(k)}>{t}</button>)}
      </div>
      {lista.length ? <div className="not-lista">{lista.map(tarjeta)}</div> : <Vacio>Sin notas. Crea tu primera nota con el botón +</Vacio>}

      {editar && (
        <EditarNota ctx={ctx} n={editar === 'nueva' ? null : editar} ocupado={ocupado} onCerrar={() => setEditar(null)}
          onGuardar={async (datos) => {
            const id = editar === 'nueva' ? null : editar.id;
            const ok = await escribir((l) => {
              if (id) return l.map((x) => (x.id === id ? { ...x, ...datos } : x));
              return [...l, { id: nuevoId('NOT'), ...datos, done: false, cre: hoyISO() }];
            }, '✅ Nota guardada');
            if (ok) setEditar(null);
          }} />
      )}
      {borrar && (
        <Hoja titulo="¿Eliminar esta nota?" onCerrar={() => setBorrar(null)}>
          <p className="texto-largo"><b>{txt(borrar, 'titulo')}</b></p>
          <p className="texto-largo">Se elimina en la app, en el CRM web y en todos tus dispositivos.</p>
          <div className="botonera">
            <button className="boton peligro" type="button" disabled={ocupado} onClick={async () => {
              const id = borrar.id;
              if (await escribir((l) => l.filter((x) => x.id !== id), 'Nota eliminada')) setBorrar(null);
            }}>{ocupado ? 'Eliminando…' : '🗑️ Sí, eliminar'}</button>
            <button className="boton secundario" type="button" disabled={ocupado} onClick={() => setBorrar(null)}>Cancelar</button>
          </div>
        </Hoja>
      )}
    </div>
  );
}

function TarjetaNota({ ctx, n, hoy, ocupado, onEstado, onHecha, onEditar, onBorrar }: {
  ctx: Ctx; n: Nota; hoy: string; ocupado: boolean;
  onEstado: (est: string) => void; onHecha: () => void; onEditar: () => void; onBorrar: () => void;
}) {
  const sec = seccionNota(n, hoy);
  const cid = txt(n, 'clienteId');
  const cl = cid ? ctx.cartera.clientes.find((c) => c.id === cid) : undefined;
  const correo = enlaceCorreo(txt(cl, 'email'));
  const est = estadoVisible(n);
  return (
    <div className={`not-nota not-${sec}`}>
      <div className="not-titulo">{txt(n, 'titulo') || '(sin título)'}</div>
      {txt(n, 'cuerpo') && <div className="not-cuerpo">{txt(n, 'cuerpo')}</div>}
      <div className="not-meta">
        {txt(n, 'fecha') && (
          <span className={`not-fecha not-f-${sec}`}>
            📅 {fecha(txt(n, 'fecha'))}{sec === 'vencida' ? ' ⚠️ VENCIDA' : sec === 'pronto' ? ' (pronto)' : ''}
          </span>
        )}
        {cl && (
          <button type="button" className="not-cliente" onClick={() => ctx.abrir('clientes', cl.id)}>
            👤 {txt(cl, 'nombre').split(' ').slice(0, 2).join(' ')}
          </button>
        )}
        {txt(n, 'color') && txt(n, 'etiqueta') && (
          <span className="not-etq" style={{ background: txt(n, 'color') }}>{txt(n, 'etiqueta')}</span>
        )}
      </div>
      <div className="not-acciones">
        <select className={`not-estado not-e-${est}`} aria-label="Estado" value={est} disabled={ocupado} onChange={(e) => onEstado(e.target.value)}>
          {ESTADOS_NOTA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <button className="icono-accion" type="button" disabled={ocupado} aria-label={n.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
          title={n.done ? 'Marcar como pendiente' : 'Marcar como hecha'} onClick={onHecha}>{n.done ? '↺' : '✓'}</button>
        {correo && <a className="icono-accion not-correo" href={correo} aria-label="Email cliente" title="Email cliente">📧</a>}
        <button className="icono-accion" type="button" aria-label="Editar" title="Editar" onClick={onEditar}>✏️</button>
        <button className="icono-accion rojo" type="button" aria-label="Eliminar" title="Eliminar" onClick={onBorrar}>🗑</button>
      </div>
    </div>
  );
}

type DatosNota = { titulo: string; cuerpo: string; fecha: string; clienteId: string; etiqueta: string; color: string };

function EditarNota({ ctx, n, ocupado, onCerrar, onGuardar }: {
  ctx: Ctx; n: Nota | null; ocupado: boolean; onCerrar: () => void; onGuardar: (d: DatosNota) => void;
}) {
  const [titulo, setTitulo] = useState(txt(n, 'titulo'));
  const [cuerpo, setCuerpo] = useState(txt(n, 'cuerpo'));
  const [fechaR, setFecha] = useState(txt(n, 'fecha'));
  const [clienteId, setCliente] = useState(txt(n, 'clienteId'));
  const [etiqueta, setEtiqueta] = useState(txt(n, 'etiqueta'));
  const [color, setColor] = useState(txt(n, 'color') || '#2563EB');
  const [q, setQ] = useState('');
  const elegido = ctx.cartera.clientes.find((c) => c.id === clienteId);
  const t = normalizar(q);
  const sugeridos = t.length >= 2
    ? ctx.cartera.clientes.filter((c) => normalizar(txt(c, 'nombre')).includes(t) || normalizar(txt(c, 'cedula')).includes(t)).slice(0, 8)
    : [];

  function guardar() {
    const tit = limpiarTexto(titulo, 300);
    if (!tit) { ctx.avisar('El título es obligatorio'); return; }
    onGuardar({
      titulo: tit, cuerpo: limpiarTexto(cuerpo, 3000), fecha: fechaR, clienteId,
      etiqueta: limpiarTexto(etiqueta, 60), color,
    });
  }

  return (
    <Hoja titulo={`📝 ${n ? 'Editar' : 'Nueva'} Nota`} onCerrar={onCerrar}>
      <label className="campo"><span>Título *</span>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Llamar a cliente, Revisar póliza..." maxLength={300} /></label>
      <label className="campo"><span>Descripción</span>
        <textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} rows={3} placeholder="Detalles adicionales..." maxLength={3000} /></label>
      <label className="campo"><span>📅 Fecha recordatorio</span>
        <input type="date" value={fechaR} onChange={(e) => setFecha(e.target.value)} /></label>
      <div className="campo"><span className="etq">Cliente (opcional)</span>
        {elegido ? (
          <button className="boton secundario" type="button" onClick={() => setCliente('')}>{txt(elegido, 'nombre')} ✕</button>
        ) : (
          <>
            <input className="buscador" type="search" placeholder="— Sin cliente — (escribe nombre o cédula)" value={q} onChange={(e) => setQ(e.target.value)} />
            {sugeridos.length > 0 && (
              <div className="lista">
                {sugeridos.map((c) => <Fila key={c.id} titulo={txt(c, 'nombre')} sub={txt(c, 'cedula')} onClick={() => { setCliente(c.id); setQ(''); }} />)}
              </div>
            )}
          </>
        )}
      </div>
      <div className="dos">
        <label className="campo"><span>Etiqueta</span>
          <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Ej: Urgente, Pendiente..." maxLength={60} /></label>
        <label className="campo"><span>Color</span>
          <select value={color} onChange={(e) => setColor(e.target.value)}>
            {COLORES_NOTA.map(([c, nom]) => <option key={c} value={c}>{nom}</option>)}
          </select></label>
      </div>
      <div className="botonera">
        <button className="boton" type="button" disabled={ocupado} onClick={guardar}>{ocupado ? 'Guardando…' : '💾 Guardar'}</button>
        <button className="boton secundario" type="button" disabled={ocupado} onClick={onCerrar}>Cancelar</button>
      </div>
    </Hoja>
  );
}
