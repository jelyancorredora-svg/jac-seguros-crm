import { Fragment, useEffect, useRef, type ReactNode } from 'react';
import { abrirNav, cerradaNav } from '../lib/navegacion';
import { diasHasta } from '../lib/formato';
import { Icono, type NombreIcono } from './Icono';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="cargando">
      <div>
        <div className="giro" />
      </div>
      <div>{texto}</div>
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="vacio">{children}</div>;
}

export function Fila({ titulo, sub, inicial, derecha, onClick, acciones }: {
  titulo: ReactNode; sub?: ReactNode; inicial?: string; derecha?: ReactNode; onClick?: () => void;
  /** Botones al final de la fila (editar / eliminar), fuera del boton principal */
  acciones?: ReactNode;
}) {
  const contenido = (
    <>
      {inicial !== undefined && <div className="avatar">{inicial}</div>}
      <div className="fila-cuerpo">
        <div className="fila-titulo">{titulo}</div>
        {sub && <div className="fila-sub">{sub}</div>}
      </div>
      {derecha}
    </>
  );
  if (!acciones) return <button className="fila" onClick={onClick} type="button">{contenido}</button>;
  return (
    <div className="fila">
      <button className="fila-boton" onClick={onClick} type="button">{contenido}</button>
      <div className="fila-acciones">{acciones}</div>
    </div>
  );
}

export function Datos({ filas }: { filas: Array<[string, ReactNode]> }) {
  const visibles = filas.filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== '—');
  if (!visibles.length) return null;
  return (
    <dl className="datos">
      {visibles.map(([k, v]) => (
        <Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function Accion({ icono, texto, href }: { icono: NombreIcono; texto: string; href: string | null }) {
  // Solo esquemas seguros: tel:, mailto: y https://wa.me
  const permitido = href && /^(tel:\+\d+|mailto:[^\s]+|https:\/\/wa\.me\/\d+)$/.test(href);
  return (
    <a className="accion" href={permitido ? href : undefined} aria-disabled={!permitido}
      target={href?.startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer">
      <Icono nombre={icono} />
      {texto}
    </a>
  );
}

export function EtiquetaVence({ fin }: { fin: string | null }) {
  const d = diasHasta(fin);
  if (d === null) return null;
  if (d < 0) return <span className="etiqueta e-peligro">Vencida</span>;
  if (d === 0) return <span className="etiqueta e-peligro">Vence hoy</span>;
  if (d <= 30) return <span className="etiqueta e-aviso">{d} días</span>;
  return null;
}

/** En una poliza vigente importa mas cuanto le falta; si no, su estado. */
export function EtiquetaPoliza({ estado, fin }: { estado: string | null; fin: string | null }) {
  const d = diasHasta(fin);
  const vigente = /^(vigente|activa|renovada)$/i.test(estado ?? '');
  return vigente && d !== null && d <= 30 ? <EtiquetaVence fin={fin} /> : <EtiquetaEstado estado={estado} />;
}

export function EtiquetaEstado({ estado }: { estado: string | null }) {
  if (!estado) return null;
  const e = estado.toLowerCase();
  const clase = /vigente|activa|renovada|pagad|cobrad|hecho|completad/.test(e)
    ? 'e-ok'
    : /cancel|rechaz|vencida|perdid/.test(e)
      ? 'e-peligro'
      : /pendiente|proceso|seguimiento/.test(e)
        ? 'e-aviso'
        : 'e-neutra';
  return <span className={`etiqueta ${clase}`}>{estado}</span>;
}

/**
 * Ventana que sube desde abajo (formularios, confirmaciones…).
 * - "‹ Volver" siempre visible arriba, aunque el formulario sea largo.
 * - El boton atras del telefono / computadora tambien la cierra.
 * - Con `sinGuardar` (cambios hechos), pregunta antes de cerrar para no perder nada.
 */
export function Hoja({ titulo, onCerrar, children, sinGuardar }: {
  titulo: string; onCerrar: () => void; children: ReactNode; sinGuardar?: boolean;
}) {
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;
  const sucioRef = useRef(!!sinGuardar);
  sucioRef.current = !!sinGuardar;
  const idRef = useRef(0);

  const puedeCerrar = () => !sucioRef.current || window.confirm('¿Salir sin guardar los cambios?');

  useEffect(() => {
    // atras del telefono: cerrar (si la persona confirma)
    const id = abrirNav(() => {
      if (!puedeCerrar()) return false;
      idRef.current = 0;
      cerrarRef.current();
      return true;
    });
    idRef.current = id;
    return () => { if (idRef.current) cerradaNav(idRef.current); };
  }, []);

  const cerrar = () => { if (puedeCerrar()) cerrarRef.current(); };

  return (
    <div className="hoja-fondo" onClick={cerrar} role="presentation">
      <div className="hoja" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="hoja-cab">
          <button type="button" className="hoja-volver" onClick={cerrar} aria-label="Volver">‹ Volver</button>
          <h3>{titulo}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inicial = (nombre: string | null) => (nombre ?? '?').trim().charAt(0).toUpperCase() || '?';
