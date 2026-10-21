import { useMemo, useState, type FormEvent } from 'react';
import {
  Accion, Datos, EtiquetaEstado, EtiquetaPoliza, Fila, Hoja, Vacio, inicial,
} from '../components/Piezas';
import { actualizarContactoCliente, ErrorDatos, type Cartera, type Cliente } from '../lib/datos';
import { dinero, enlaceCorreo, enlaceLlamada, enlaceWhatsApp, esCorreo, fecha, normalizar } from '../lib/formato';
import type { Abrir, Avisar } from '../App';

const MAX_LISTA = 150;

export function Clientes({ cartera, abrir }: { cartera: Cartera; abrir: Abrir }) {
  const [q, setQ] = useState('');
  const encontrados = useMemo(() => {
    const t = normalizar(q);
    if (!t) return cartera.clientes;
    const digitos = q.replace(/\D/g, '');
    return cartera.clientes.filter(
      (c) =>
        normalizar(c.nombre).includes(t) ||
        normalizar(c.alias).includes(t) ||
        normalizar(c.cedula).includes(t) ||
        (digitos.length >= 4 && (c.cel ?? '').replace(/\D/g, '').includes(digitos)),
    );
  }, [q, cartera.clientes]);

  return (
    <>
      <input className="buscador" type="search" placeholder="Buscar por nombre, cédula o teléfono"
        value={q} onChange={(e) => setQ(e.target.value)} autoCapitalize="none" spellCheck={false} maxLength={80} />
      {encontrados.length ? (
        <div className="lista">
          {encontrados.slice(0, MAX_LISTA).map((c) => (
            <Fila key={c.id} inicial={inicial(c.nombre)} titulo={c.nombre || 'Sin nombre'}
              sub={[c.cedula, c.cel].filter(Boolean).join(' · ')} onClick={() => abrir({ tipo: 'cliente', id: c.id })} />
          ))}
        </div>
      ) : (
        <Vacio>No se encontraron clientes.</Vacio>
      )}
      {encontrados.length > MAX_LISTA && (
        <p className="sincro">Mostrando {MAX_LISTA} de {encontrados.length}. Escribe para afinar la búsqueda.</p>
      )}
    </>
  );
}

export function ClienteDetalle({ cliente, cartera, abrir, alCambiar, avisar }: {
  cliente: Cliente; cartera: Cartera; abrir: Abrir; alCambiar: (c: Partial<Cliente>) => void; avisar: Avisar;
}) {
  const [editando, setEditando] = useState(false);
  const polizas = cartera.polizas.filter((p) => p.cliente_id === cliente.id);
  const siniestros = cartera.siniestros.filter((s) => s.cliente_id === cliente.id);
  const vehiculos = cartera.vehiculos.filter((v) => v.cliente_id === cliente.id);
  const pagos = cartera.pagos
    .filter((p) => p.cliente_id === cliente.id || polizas.some((x) => x.id === p.poliza_id))
    .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));

  return (
    <>
      <div className="acciones">
        <Accion icono="llamar" texto="Llamar" href={enlaceLlamada(cliente.cel || cliente.tel)} />
        <Accion icono="chat" texto="WhatsApp" href={enlaceWhatsApp(cliente.cel)} />
        <Accion icono="correo" texto="Correo" href={enlaceCorreo(cliente.email)} />
      </div>

      <div className="tarjeta">
        <Datos filas={[
          ['Cédula / RUC', cliente.cedula],
          ['Tipo', cliente.tipo],
          ['Celular', cliente.cel],
          ['Teléfono', cliente.tel],
          ['Correo', cliente.email],
          ['Dirección', cliente.dir],
          ['Ciudad', [cliente.ciudad, cliente.provincia].filter(Boolean).join(', ')],
          ['Nacimiento', cliente.f_nac ? fecha(cliente.f_nac) : null],
          ['Ocupación', cliente.ocupacion],
          ['Estado', cliente.estado_cli],
        ]} />
        <button className="boton secundario" type="button" onClick={() => setEditando(true)}>
          Editar contacto
        </button>
      </div>
      {cliente.obs && (
        <div className="tarjeta"><p className="texto-largo">{cliente.obs}</p></div>
      )}

      <h3 className="seccion">Pólizas ({polizas.length})</h3>
      {polizas.length ? (
        <div className="lista">
          {polizas.map((p) => (
            <Fila key={p.id} titulo={`${p.ramo ?? 'Póliza'} · ${p.num ?? ''}`}
              sub={`${p.aseg ?? ''} · vence ${fecha(p.fecha_fin)}`}
              derecha={<EtiquetaPoliza estado={p.estado} fin={p.fecha_fin} />}
              onClick={() => abrir({ tipo: 'poliza', id: p.id })} />
          ))}
        </div>
      ) : <Vacio>Sin pólizas.</Vacio>}

      {siniestros.length > 0 && (
        <>
          <h3 className="seccion">Siniestros ({siniestros.length})</h3>
          <div className="lista">
            {siniestros.map((s) => (
              <Fila key={s.id} titulo={s.nombre || s.num_sin || 'Siniestro'} sub={fecha(s.fecha_sin)}
                derecha={<EtiquetaEstado estado={s.estado} />} onClick={() => abrir({ tipo: 'siniestro', id: s.id })} />
            ))}
          </div>
        </>
      )}

      {vehiculos.length > 0 && (
        <>
          <h3 className="seccion">Vehículos</h3>
          <div className="lista">
            {vehiculos.map((v) => <Fila key={v.id} titulo={v.placa || 'Sin placa'} />)}
          </div>
        </>
      )}

      {pagos.length > 0 && (
        <>
          <h3 className="seccion">Últimos pagos</h3>
          <div className="lista">
            {pagos.slice(0, 10).map((p) => (
              <Fila key={p.id} titulo={dinero(p.monto)} sub={[fecha(p.fecha), p.metodo].filter(Boolean).join(' · ')}
                derecha={<EtiquetaEstado estado={p.estado} />} />
            ))}
          </div>
        </>
      )}

      {editando && (
        <EditarContacto cliente={cliente} onCerrar={() => setEditando(false)}
          onGuardado={(c) => { alCambiar(c); setEditando(false); avisar('Contacto actualizado'); }} />
      )}
    </>
  );
}

function EditarContacto({ cliente, onCerrar, onGuardado }: {
  cliente: Cliente; onCerrar: () => void; onGuardado: (c: Partial<Cliente>) => void;
}) {
  const [f, setF] = useState({ cel: cliente.cel ?? '', tel: cliente.tel ?? '', email: cliente.email ?? '', dir: cliente.dir ?? '' });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (f.email && !esCorreo(f.email)) return setError('El correo no es válido.');
    setOcupado(true);
    try {
      onGuardado(await actualizarContactoCliente(cliente.id, f));
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }

  const campo = (k: keyof typeof f, etiqueta: string, tipo = 'text') => (
    <label className="campo">
      <span>{etiqueta}</span>
      <input type={tipo} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}
        maxLength={k === 'dir' ? 300 : 120} inputMode={tipo === 'tel' ? 'tel' : undefined} />
    </label>
  );

  return (
    <Hoja titulo="Editar contacto" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        {error && <div className="error">{error}</div>}
        {campo('cel', 'Celular', 'tel')}
        {campo('tel', 'Teléfono', 'tel')}
        {campo('email', 'Correo', 'email')}
        {campo('dir', 'Dirección')}
        <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
        <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
      </form>
    </Hoja>
  );
}
