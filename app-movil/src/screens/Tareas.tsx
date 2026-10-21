import { useMemo, useState, type FormEvent } from 'react';
import { Icono } from '../components/Icono';
import { EtiquetaEstado, Fila, Hoja, Vacio } from '../components/Piezas';
import {
  cambiarEtapaTarea, crearTarea, ErrorDatos, PRIORIDADES, tareaAbierta, TIPOS_TAREA,
  type Cartera, type Tarea,
} from '../lib/datos';
import { diasHasta, fecha, hoyISO } from '../lib/formato';
import type { Avisar } from '../App';

export function Tareas({ cartera, alCrear, alCambiar, avisar }: {
  cartera: Cartera; alCrear: (t: Tarea) => void; alCambiar: (id: string, c: Partial<Tarea>) => void; avisar: Avisar;
}) {
  const [verCerradas, setVerCerradas] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [elegida, setElegida] = useState<Tarea | null>(null);

  const lista = useMemo(
    () =>
      cartera.tareas
        .filter((t) => (verCerradas ? !tareaAbierta(t) : tareaAbierta(t)))
        .sort((a, b) =>
          verCerradas
            ? (b.fecha_limite ?? '').localeCompare(a.fecha_limite ?? '')
            : (a.fecha_limite ?? '9999').localeCompare(b.fecha_limite ?? '9999')),
    [cartera.tareas, verCerradas],
  );
  const nombreCliente = (id: string | null) => (id ? cartera.clientes.find((c) => c.id === id)?.nombre : null);

  return (
    <>
      <div className="filtros">
        <button type="button" className={!verCerradas ? 'activa' : ''} onClick={() => setVerCerradas(false)}>Pendientes</button>
        <button type="button" className={verCerradas ? 'activa' : ''} onClick={() => setVerCerradas(true)}>Cerradas</button>
      </div>
      {lista.length ? (
        <div className="lista">
          {lista.slice(0, 200).map((t) => {
            const d = diasHasta(t.fecha_limite);
            const atrasada = !verCerradas && d !== null && d < 0;
            return (
              <Fila key={t.id} titulo={t.titulo || 'Tarea'}
                sub={[t.tipo, nombreCliente(t.cliente_id), t.fecha_limite ? fecha(t.fecha_limite) : null].filter(Boolean).join(' · ')}
                derecha={atrasada ? <span className="etiqueta e-peligro">Atrasada</span> : <EtiquetaEstado estado={t.etapa_tarea} />}
                onClick={() => setElegida(t)} />
            );
          })}
        </div>
      ) : (
        <Vacio>{verCerradas ? 'No hay tareas cerradas.' : 'No tienes tareas pendientes.'}</Vacio>
      )}

      <button className="flotante" type="button" aria-label="Nueva tarea" onClick={() => setNueva(true)}>
        <Icono nombre="mas" tam={26} />
      </button>

      {nueva && (
        <NuevaTarea cartera={cartera} onCerrar={() => setNueva(false)}
          onCreada={(t) => { alCrear(t); setNueva(false); avisar('Tarea creada'); }} />
      )}
      {elegida && (
        <DetalleTarea tarea={elegida} cliente={nombreCliente(elegida.cliente_id) ?? null} onCerrar={() => setElegida(null)}
          onCambio={(c) => { alCambiar(elegida.id, c); setElegida(null); avisar('Tarea actualizada'); }} />
      )}
    </>
  );
}

function DetalleTarea({ tarea, cliente, onCerrar, onCambio }: {
  tarea: Tarea; cliente: string | null; onCerrar: () => void; onCambio: (c: Partial<Tarea>) => void;
}) {
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function mover(etapa: string) {
    setOcupado(true);
    try {
      onCambio(await cambiarEtapaTarea(tarea.id, etapa));
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }

  return (
    <Hoja titulo={tarea.titulo || 'Tarea'} onCerrar={onCerrar}>
      {error && <div className="error">{error}</div>}
      <div className="tarjeta">
        <dl className="datos">
          <dt>Etapa</dt><dd>{tarea.etapa_tarea || '—'}</dd>
          <dt>Tipo</dt><dd>{tarea.tipo || '—'}</dd>
          <dt>Prioridad</dt><dd>{tarea.prioridad || '—'}</dd>
          <dt>Fecha límite</dt><dd>{fecha(tarea.fecha_limite)}</dd>
          {cliente && <><dt>Cliente</dt><dd>{cliente}</dd></>}
        </dl>
        {tarea.desc && <p className="texto-largo">{tarea.desc}</p>}
      </div>
      {tareaAbierta(tarea) ? (
        <>
          <button className="boton" type="button" disabled={ocupado} onClick={() => mover('Hecho')}>Marcar como hecha</button>
          <button className="boton secundario" type="button" disabled={ocupado} onClick={() => mover('En Proceso')}>En proceso</button>
          <button className="boton secundario" type="button" disabled={ocupado} onClick={() => mover('En Seguimiento')}>En seguimiento</button>
        </>
      ) : (
        <button className="boton secundario" type="button" disabled={ocupado} onClick={() => mover('Por Hacer')}>Reabrir</button>
      )}
    </Hoja>
  );
}

function NuevaTarea({ cartera, onCerrar, onCreada }: {
  cartera: Cartera; onCerrar: () => void; onCreada: (t: Tarea) => void;
}) {
  const [f, setF] = useState({
    titulo: '', desc: '', tipo: 'Seguimiento', prioridad: 'Media', fecha_limite: hoyISO(), cliente_id: '',
  });
  const [buscaCliente, setBuscaCliente] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const sugeridos = buscaCliente.length >= 2
    ? cartera.clientes.filter((c) => (c.nombre ?? '').toLowerCase().includes(buscaCliente.toLowerCase())).slice(0, 6)
    : [];
  const clienteElegido = cartera.clientes.find((c) => c.id === f.cliente_id);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    try {
      onCreada(await crearTarea(f));
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo crear.');
      setOcupado(false);
    }
  }

  return (
    <Hoja titulo="Nueva tarea" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        {error && <div className="error">{error}</div>}
        <label className="campo">
          <span>Título</span>
          <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required maxLength={200} />
        </label>
        <label className="campo">
          <span>Tipo</span>
          <select value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
            {TIPOS_TAREA.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Prioridad</span>
          <select value={f.prioridad} onChange={(e) => setF({ ...f, prioridad: e.target.value })}>
            {PRIORIDADES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Fecha límite</span>
          <input type="date" value={f.fecha_limite} onChange={(e) => setF({ ...f, fecha_limite: e.target.value })} />
        </label>
        <label className="campo">
          <span>Cliente (opcional)</span>
          {clienteElegido ? (
            <button className="boton secundario" type="button" onClick={() => setF({ ...f, cliente_id: '' })}>
              {clienteElegido.nombre} ✕
            </button>
          ) : (
            <input value={buscaCliente} onChange={(e) => setBuscaCliente(e.target.value)} placeholder="Escribe un nombre" maxLength={80} />
          )}
        </label>
        {!clienteElegido && sugeridos.length > 0 && (
          <div className="lista campo">
            {sugeridos.map((c) => (
              <Fila key={c.id} titulo={c.nombre} sub={c.cedula} onClick={() => { setF({ ...f, cliente_id: c.id }); setBuscaCliente(''); }} />
            ))}
          </div>
        )}
        <label className="campo">
          <span>Descripción</span>
          <textarea value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} maxLength={2000} />
        </label>
        <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Crear tarea'}</button>
        <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
      </form>
    </Hoja>
  );
}

