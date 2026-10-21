import { useMemo, useState, type FormEvent } from 'react';
import { Icono } from '../components/Icono';
import { Accion, Datos, EtiquetaEstado, Fila, Hoja, Vacio, inicial } from '../components/Piezas';
import {
  cambiarEtapaProspecto, crearProspecto, ErrorDatos, ETAPAS_VENTA, fijarSeguimientoProspecto, FUENTES,
  PRIORIDADES, prospectoAbierto, type Cartera, type Prospecto,
} from '../lib/datos';
import {
  diasHasta, dinero, enlaceCorreo, enlaceLlamada, enlaceWhatsApp, esCorreo, fecha, normalizar,
} from '../lib/formato';
import type { Abrir, Avisar } from '../App';

export function Prospectos({ cartera, abrir, alCrear, avisar }: {
  cartera: Cartera; abrir: Abrir; alCrear: (p: Prospecto) => void; avisar: Avisar;
}) {
  const [abiertos, setAbiertos] = useState(true);
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);

  const lista = useMemo(() => {
    const t = normalizar(q);
    return cartera.prospectos
      .filter((p) => (abiertos ? prospectoAbierto(p) : !prospectoAbierto(p)))
      .filter((p) => !t || [p.nombre, p.cel, p.fuente].some((x) => normalizar(x).includes(t)))
      .sort((a, b) => (a.f_seguimiento ?? '9999').localeCompare(b.f_seguimiento ?? '9999'));
  }, [cartera.prospectos, abiertos, q]);

  return (
    <>
      <input className="buscador" type="search" placeholder="Buscar prospecto" value={q}
        onChange={(e) => setQ(e.target.value)} autoCapitalize="none" spellCheck={false} maxLength={80} />
      <div className="filtros">
        <button type="button" className={abiertos ? 'activa' : ''} onClick={() => setAbiertos(true)}>En curso</button>
        <button type="button" className={!abiertos ? 'activa' : ''} onClick={() => setAbiertos(false)}>Ganados / perdidos</button>
      </div>
      {lista.length ? (
        <div className="lista">
          {lista.slice(0, 200).map((p) => {
            const d = diasHasta(p.f_seguimiento);
            const toca = abiertos && d !== null && d <= 0;
            return (
              <Fila key={p.id} inicial={inicial(p.nombre)} titulo={p.nombre || 'Sin nombre'}
                sub={[p.fuente, p.f_seguimiento ? `seguir ${fecha(p.f_seguimiento)}` : null].filter(Boolean).join(' · ')}
                derecha={toca ? <span className="etiqueta e-peligro">Contactar</span> : <EtiquetaEstado estado={p.etapa_venta} />}
                onClick={() => abrir({ tipo: 'prospecto', id: p.id })} />
            );
          })}
        </div>
      ) : (
        <Vacio>{abiertos ? 'No hay prospectos en curso.' : 'Nada aquí todavía.'}</Vacio>
      )}
      <button className="flotante" type="button" aria-label="Nuevo prospecto" onClick={() => setNuevo(true)}>
        <Icono nombre="mas" tam={26} />
      </button>
      {nuevo && (
        <NuevoProspecto onCerrar={() => setNuevo(false)}
          onCreado={(p) => { alCrear(p); setNuevo(false); avisar('Prospecto creado'); }} />
      )}
    </>
  );
}

export function ProspectoDetalle({ prospecto, alCambiar, avisar }: {
  prospecto: Prospecto; alCambiar: (c: Partial<Prospecto>) => void; avisar: Avisar;
}) {
  const [hoja, setHoja] = useState<'etapa' | 'fecha' | null>(null);
  const [f, setF] = useState(prospecto.f_seguimiento ?? '');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function hacer(accion: () => Promise<Partial<Prospecto>>, texto: string) {
    setOcupado(true);
    setError('');
    try {
      alCambiar(await accion());
      setHoja(null);
      avisar(texto);
    } catch (e) {
      setError(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div className="acciones">
        <Accion icono="llamar" texto="Llamar" href={enlaceLlamada(prospecto.cel || prospecto.tel)} />
        <Accion icono="chat" texto="WhatsApp" href={enlaceWhatsApp(prospecto.cel)} />
        <Accion icono="correo" texto="Correo" href={enlaceCorreo(prospecto.email)} />
      </div>
      <div className="tarjeta">
        <Datos filas={[
          ['Etapa', <EtiquetaEstado key="e" estado={prospecto.etapa_venta} />],
          ['Prioridad', prospecto.prioridad],
          ['Fuente', prospecto.fuente],
          ['Celular', prospecto.cel],
          ['Correo', prospecto.email],
          ['Monto estimado', prospecto.monto_estimado ? dinero(prospecto.monto_estimado) : null],
          ['Primer contacto', fecha(prospecto.f_contacto)],
          ['Próximo seguimiento', fecha(prospecto.f_seguimiento)],
        ]} />
      </div>
      <button className="boton" type="button" onClick={() => setHoja('etapa')}>Cambiar etapa</button>
      <button className="boton secundario" type="button" onClick={() => setHoja('fecha')}>Programar seguimiento</button>

      {hoja === 'etapa' && (
        <Hoja titulo="Etapa de venta" onCerrar={() => setHoja(null)}>
          {error && <div className="error">{error}</div>}
          <div className="lista">
            {ETAPAS_VENTA.map((e) => (
              <Fila key={e} titulo={e} derecha={e === prospecto.etapa_venta ? <span className="etiqueta e-info">Actual</span> : undefined}
                onClick={() => !ocupado && e !== prospecto.etapa_venta && hacer(() => cambiarEtapaProspecto(prospecto.id, e), 'Etapa actualizada')} />
            ))}
          </div>
        </Hoja>
      )}
      {hoja === 'fecha' && (
        <Hoja titulo="Próximo seguimiento" onCerrar={() => setHoja(null)}>
          <form onSubmit={(ev) => { ev.preventDefault(); void hacer(() => fijarSeguimientoProspecto(prospecto.id, f), 'Seguimiento programado'); }}>
            {error && <div className="error">{error}</div>}
            <label className="campo">
              <span>Fecha</span>
              <input type="date" value={f} onChange={(e) => setF(e.target.value)} />
            </label>
            <button className="boton" type="submit" disabled={ocupado}>Guardar</button>
          </form>
        </Hoja>
      )}
    </>
  );
}

function NuevoProspecto({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: (p: Prospecto) => void }) {
  const [f, setF] = useState({
    nombre: '', cel: '', email: '', fuente: 'Referido', prioridad: 'Media', interes: '', monto_estimado: '',
    f_seguimiento: '', notas: '',
  });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (f.email && !esCorreo(f.email)) return setError('El correo no es válido.');
    setOcupado(true);
    try {
      onCreado(await crearProspecto(f));
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo crear.');
      setOcupado(false);
    }
  }

  return (
    <Hoja titulo="Nuevo prospecto" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        {error && <div className="error">{error}</div>}
        <label className="campo"><span>Nombre</span>
          <input value={f.nombre} onChange={set('nombre')} required maxLength={150} /></label>
        <label className="campo"><span>Celular</span>
          <input type="tel" inputMode="tel" value={f.cel} onChange={set('cel')} maxLength={30} /></label>
        <label className="campo"><span>Correo</span>
          <input type="email" value={f.email} onChange={set('email')} maxLength={120} /></label>
        <label className="campo"><span>¿Qué seguro le interesa?</span>
          <input value={f.interes} onChange={set('interes')} placeholder="Ej.: Auto, Salud, Vida" maxLength={60} /></label>
        <label className="campo"><span>Fuente</span>
          <select value={f.fuente} onChange={set('fuente')}>{FUENTES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="campo"><span>Prioridad</span>
          <select value={f.prioridad} onChange={set('prioridad')}>{PRIORIDADES.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label className="campo"><span>Prima estimada (USD)</span>
          <input inputMode="decimal" value={f.monto_estimado} onChange={set('monto_estimado')} maxLength={12} /></label>
        <label className="campo"><span>Próximo seguimiento</span>
          <input type="date" value={f.f_seguimiento} onChange={set('f_seguimiento')} /></label>
        <label className="campo"><span>Notas</span>
          <textarea value={f.notas} onChange={set('notas')} maxLength={2000} /></label>
        <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Crear prospecto'}</button>
        <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
      </form>
    </Hoja>
  );
}
