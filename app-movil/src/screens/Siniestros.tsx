import { useMemo, useState, type FormEvent } from 'react';
import { Accion, Datos, EtiquetaEstado, Fila, Hoja, Vacio } from '../components/Piezas';
import {
  actualizarSiniestro, ErrorDatos, ESTADOS_SINIESTRO, siniestroAbierto, type Cartera, type Siniestro,
} from '../lib/datos';
import { dinero, enlaceLlamada, enlaceWhatsApp, fecha, hoyISO, normalizar } from '../lib/formato';
import type { Abrir, Avisar } from '../App';

export function Siniestros({ cartera, abrir }: { cartera: Cartera; abrir: Abrir }) {
  const [abiertos, setAbiertos] = useState(true);
  const [q, setQ] = useState('');
  const lista = useMemo(() => {
    const t = normalizar(q);
    return cartera.siniestros
      .filter((s) => (abiertos ? siniestroAbierto(s) : true))
      .filter((s) => !t || [s.cliente, s.asegurado, s.num_sin, s.num_cia, s.nombre, s.aseg].some((x) => normalizar(x).includes(t)))
      .sort((a, b) => (b.fecha_sin ?? '').localeCompare(a.fecha_sin ?? ''));
  }, [cartera.siniestros, abiertos, q]);

  return (
    <>
      <input className="buscador" type="search" placeholder="Cliente, número o aseguradora" value={q}
        onChange={(e) => setQ(e.target.value)} autoCapitalize="none" spellCheck={false} maxLength={80} />
      <div className="filtros">
        <button type="button" className={abiertos ? 'activa' : ''} onClick={() => setAbiertos(true)}>Abiertos</button>
        <button type="button" className={!abiertos ? 'activa' : ''} onClick={() => setAbiertos(false)}>Todos</button>
      </div>
      {lista.length ? (
        <div className="lista">
          {lista.slice(0, 150).map((s) => (
            <Fila key={s.id} titulo={s.cliente || s.asegurado || 'Siniestro'}
              sub={[s.nombre, s.aseg, fecha(s.fecha_sin)].filter(Boolean).join(' · ')}
              derecha={<EtiquetaEstado estado={s.estado} />} onClick={() => abrir({ tipo: 'siniestro', id: s.id })} />
          ))}
        </div>
      ) : (
        <Vacio>{abiertos ? 'No hay siniestros abiertos.' : 'No hay siniestros.'}</Vacio>
      )}
    </>
  );
}

export function SiniestroDetalle({ siniestro, cartera, abrir, alCambiar, avisar }: {
  siniestro: Siniestro; cartera: Cartera; abrir: Abrir; alCambiar: (c: Partial<Siniestro>) => void; avisar: Avisar;
}) {
  const [editando, setEditando] = useState(false);
  const cliente = cartera.clientes.find((c) => c.id === siniestro.cliente_id);
  const cel = siniestro.cel || cliente?.cel;

  return (
    <>
      <div className="acciones">
        <Accion icono="llamar" texto="Llamar" href={enlaceLlamada(cel)} />
        <Accion icono="chat" texto="WhatsApp" href={enlaceWhatsApp(cel)} />
        <button className="accion" type="button" onClick={() => setEditando(true)}>
          <span aria-hidden="true">✎</span>Actualizar
        </button>
      </div>
      <div className="tarjeta">
        <Datos filas={[
          ['Estado', <EtiquetaEstado key="e" estado={siniestro.estado} />],
          ['Tipo', siniestro.nombre],
          ['Fecha', fecha(siniestro.fecha_sin)],
          ['N.º interno', siniestro.num_sin],
          ['N.º aseguradora', siniestro.num_cia],
          ['Aseguradora', siniestro.aseg],
          ['Póliza', siniestro.poliza],
          ['Asegurado', siniestro.asegurado],
          ['Reclamado', dinero(siniestro.monto_reclamo)],
          ['Indemnizado', dinero(siniestro.val_ind)],
          ['Deducible', dinero(siniestro.deducible)],
        ]} />
      </div>
      {cliente && (
        <div className="lista">
          <Fila titulo={cliente.nombre || 'Cliente'} sub="Ver ficha del cliente"
            onClick={() => abrir({ tipo: 'cliente', id: cliente.id })} />
        </div>
      )}
      {siniestro.desc && (
        <>
          <h3 className="seccion">Descripción</h3>
          <div className="tarjeta"><p className="texto-largo">{siniestro.desc}</p></div>
        </>
      )}
      <h3 className="seccion">Seguimiento</h3>
      <div className="tarjeta"><p className="texto-largo">{siniestro.seguimiento || 'Sin notas de seguimiento.'}</p></div>

      {editando && (
        <EditarSiniestro siniestro={siniestro} onCerrar={() => setEditando(false)}
          onGuardado={(c) => { alCambiar(c); setEditando(false); avisar('Siniestro actualizado'); }} />
      )}
    </>
  );
}

function EditarSiniestro({ siniestro, onCerrar, onGuardado }: {
  siniestro: Siniestro; onCerrar: () => void; onGuardado: (c: Partial<Siniestro>) => void;
}) {
  const estadoInicial = (ESTADOS_SINIESTRO as readonly string[]).includes(siniestro.estado ?? '')
    ? (siniestro.estado as string) : 'En proceso';
  const [estado, setEstado] = useState(estadoInicial);
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    // La nota nueva se agrega arriba con fecha; nunca se borra lo anterior.
    const hoy = fecha(hoyISO());
    const seguimiento = nota.trim()
      ? `[${hoy}] ${nota.trim()}${siniestro.seguimiento ? '\n\n' + siniestro.seguimiento : ''}`
      : siniestro.seguimiento ?? '';
    try {
      onGuardado(await actualizarSiniestro(siniestro.id, estado, seguimiento));
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }

  return (
    <Hoja titulo="Actualizar siniestro" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        {error && <div className="error">{error}</div>}
        <label className="campo">
          <span>Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            {ESTADOS_SINIESTRO.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="campo">
          <span>Nueva nota de seguimiento</span>
          <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={1000}
            placeholder="Ej.: Se enviaron documentos al ajustador" />
        </label>
        <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
        <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
      </form>
    </Hoja>
  );
}
