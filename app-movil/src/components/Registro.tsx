import { Fragment, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  adjuntos, agregarAdjunto, eliminarAdjunto, enlaceAdjunto, ErrorDatos, guardarRegistro, historial, registrarAccion, txt,
  type Adjunto, type Cartera, type Reg,
} from '../lib/datos';
import { CAMPOS, OCULTOS, type Campo, type Modulo } from '../lib/esquema';
import { dinero, esCorreo, fecha, hoyISO } from '../lib/formato';
import { Hoja } from './Piezas';

/* ---------------- valor legible de un campo ---------------- */

function legible(c: Campo | undefined, v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) return v.filter((x) => typeof x !== 'object').join(', ');
  if (typeof v === 'object') return '';
  const s = String(v);
  if (!c) return /^\d{4}-\d{2}-\d{2}$/.test(s) ? fecha(s) : s;
  if (c.t === 'fecha') return fecha(s);
  if (c.t === 'num' && /\(\$\)/.test(c.l)) return dinero(Number(s));
  if (c.t === 'sel') return c.o?.find(([val]) => val === s)?.[1] ?? s;
  return s;
}

/** "fechaNotifAseg" -> "Fecha notif aseg" */
const humano = (k: string) => {
  const s = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/* ---------------- ficha con TODOS los campos ---------------- */

export function FichaCampos({ modulo, r }: { modulo: Modulo; r: Reg }) {
  const campos = CAMPOS[modulo];
  const grupos = useMemo(() => {
    const g = new Map<string, Array<[string, string]>>();
    for (const c of campos) {
      const v = legible(c, r[c.k]);
      if (!v) continue;
      if (!g.has(c.g)) g.set(c.g, []);
      g.get(c.g)!.push([c.l, v]);
    }
    // Campos que el CRM web tiene y que no estan en el formulario: tambien se ven.
    const conocidos = new Set(campos.map((c) => c.k));
    const otros: Array<[string, string]> = [];
    for (const k of Object.keys(r).sort()) {
      if (conocidos.has(k) || OCULTOS.has(k) || /Id$/.test(k) || k.startsWith('_')) continue;
      const v = legible(undefined, r[k]);
      if (v && v.length < 400) otros.push([humano(k), v]);
    }
    if (otros.length) g.set('Otros datos', otros);
    return [...g.entries()];
  }, [campos, r]);

  if (!grupos.length) return <div className="tarjeta"><p className="sincro">Sin datos registrados.</p></div>;
  return (
    <>
      {grupos.map(([g, filas]) => (
        <Fragment key={g}>
          <h3 className="seccion">{g}</h3>
          <div className="tarjeta">
            <dl className="datos">
              {filas.map(([l, v]) => (
                <Fragment key={l}>
                  <dt>{l}</dt>
                  <dd className={v.length > 40 ? 'dd-largo' : undefined}>{v}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        </Fragment>
      ))}
    </>
  );
}

/* ---------------- documentos adjuntos ---------------- */

export function Adjuntos({ modulo, r, avisar, alCambiar }: {
  modulo: Modulo; r: Reg; avisar: (t: string) => void; alCambiar: (r: Reg) => void;
}) {
  const lista = adjuntos(r);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<Adjunto | null>(null);
  const entrada = useRef<HTMLInputElement>(null);

  async function abrir(f: Adjunto, i: number) {
    setOcupado('abrir' + i);
    // La ventana se abre YA (dentro del toque) para que Safari no la bloquee.
    const w = window.open('', '_blank');
    try {
      const url = await enlaceAdjunto(f);
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e) {
      w?.close();
      avisar(e instanceof ErrorDatos ? e.message : 'No se pudo abrir el archivo.');
    } finally {
      setOcupado(null);
    }
  }

  async function subir(files: FileList | null) {
    if (!files?.length) return;
    let actual = r;
    for (const f of Array.from(files)) {
      setOcupado('subir');
      try {
        actual = await agregarAdjunto(modulo, actual.id, f);
        alCambiar(actual);
        avisar(`✓ ${f.name} guardado`);
      } catch (e) {
        avisar(e instanceof ErrorDatos ? e.message : `No se pudo subir ${f.name}.`);
      }
    }
    setOcupado(null);
    if (entrada.current) entrada.current.value = '';
  }

  async function confirmarBorrar() {
    if (!borrar) return;
    setOcupado('borrar');
    try {
      alCambiar(await eliminarAdjunto(modulo, r.id, borrar));
      avisar('Archivo eliminado');
    } catch (e) {
      avisar(e instanceof ErrorDatos ? e.message : 'No se pudo eliminar.');
    } finally {
      setOcupado(null);
      setBorrar(null);
    }
  }

  return (
    <>
      <h3 className="seccion">Documentos ({lista.length})</h3>
      {lista.length > 0 && (
        <div className="lista">
          {lista.map((f, i) => (
            <div key={f.id ?? i} className="fila">
              <button className="fila-boton" type="button" onClick={() => abrir(f, i)} disabled={ocupado !== null}>
                <div className="avatar">{/\.(jpe?g|png|gif|webp|heic)$/i.test(f.name ?? '') ? '🖼️' : /\.pdf$/i.test(f.name ?? '') ? '📄' : '📎'}</div>
                <div className="fila-cuerpo">
                  <div className="fila-titulo">{f.name || 'Archivo'}</div>
                  <div className="fila-sub">
                    {ocupado === 'abrir' + i ? 'Abriendo…' : [f.size ? `${Math.max(1, Math.round(f.size / 1024))} KB` : '', (f as { fecha?: string }).fecha ? fecha((f as { fecha?: string }).fecha) : ''].filter(Boolean).join(' · ') || 'Tocar para ver'}
                  </div>
                </div>
              </button>
              <button className="icono-borrar" type="button" aria-label={`Eliminar ${f.name}`} onClick={() => setBorrar(f)} disabled={ocupado !== null}>✕</button>
            </div>
          ))}
        </div>
      )}
      <input ref={entrada} type="file" multiple hidden onChange={(e) => subir(e.target.files)}
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt" />
      <button className="boton secundario mas-abajo" type="button" disabled={ocupado !== null} onClick={() => entrada.current?.click()}>
        {ocupado === 'subir' ? 'Subiendo…' : '📎 Agregar archivo o foto'}
      </button>
      {borrar && (
        <Hoja titulo="¿Eliminar archivo?" onCerrar={() => setBorrar(null)}>
          <p className="texto-largo">{borrar.name}</p>
          <div className="botonera">
            <button className="boton peligro" type="button" onClick={confirmarBorrar} disabled={ocupado !== null}>Eliminar</button>
            <button className="boton secundario" type="button" onClick={() => setBorrar(null)}>Cancelar</button>
          </div>
        </Hoja>
      )}
    </>
  );
}

/* ---------------- historial / acciones ---------------- */

export function Historial({ modulo, r, avisar, alCambiar, conSeguimiento }: {
  modulo: Modulo; r: Reg; avisar: (t: string) => void; alCambiar: (r: Reg) => void; conSeguimiento?: boolean;
}) {
  const lista = historial(r);
  const orden = modulo === 'clientes' ? lista : lista.slice().reverse();
  const [abierto, setAbierto] = useState(false);
  const [f, setF] = useState({ fecha: hoyISO(), accion: '', resultado: '', seguimiento: '' });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!f.accion.trim()) return setError('La acción es obligatoria.');
    setOcupado(true);
    try {
      const otros = conSeguimiento && f.seguimiento ? { fSeguimiento: f.seguimiento } : {};
      alCambiar(await registrarAccion(modulo, r.id, f, otros));
      avisar('✓ Acción registrada');
      setAbierto(false);
      setF({ fecha: hoyISO(), accion: '', resultado: '', seguimiento: '' });
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo guardar.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <h3 className="seccion">Historial ({lista.length})</h3>
      <button className="boton secundario mas-abajo" type="button" onClick={() => setAbierto(true)}>📝 Registrar acción / anotación</button>
      {orden.length > 0 ? (
        <div className="historial">
          {orden.slice(0, 100).map((h, i) => (
            <div key={h.id ?? i} className={`hist ${h.tipo === 'whatsapp' ? 'hist-wa' : ''}`}>
              <div className="hist-fecha">{fecha(h.fecha)}{h.tipo && h.tipo !== 'manual' ? ` · ${h.tipo}` : ''}</div>
              <div className="hist-accion">{h.accion || h.nota || '—'}</div>
              {h.resultado && <div className="hist-res">{h.resultado}</div>}
            </div>
          ))}
        </div>
      ) : <div className="vacio">Sin acciones registradas.</div>}
      {abierto && (
        <Hoja titulo="Registrar acción" onCerrar={() => setAbierto(false)}>
          <form onSubmit={guardar}>
            <label className="campo"><span>Fecha</span>
              <input type="date" value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></label>
            <label className="campo"><span>Acción *</span>
              <input value={f.accion} onChange={(e) => setF({ ...f, accion: e.target.value })} maxLength={500}
                placeholder="Ej.: Llamada, envío de cotización, visita…" /></label>
            <label className="campo"><span>Resultado / anotación</span>
              <textarea value={f.resultado} onChange={(e) => setF({ ...f, resultado: e.target.value })} maxLength={2000} /></label>
            {conSeguimiento && (
              <label className="campo"><span>Próximo seguimiento</span>
                <input type="date" value={f.seguimiento} onChange={(e) => setF({ ...f, seguimiento: e.target.value })} /></label>
            )}
            {error && <div className="error">{error}</div>}
            <div className="botonera">
              <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
              <button className="boton secundario" type="button" onClick={() => setAbierto(false)}>Cancelar</button>
            </div>
          </form>
        </Hoja>
      )}
    </>
  );
}

/* ---------------- formulario completo ---------------- */

/** Valores ya usados en la cartera, para sugerir (aseguradoras, ramos…) */
function sugerencias(cartera: Cartera, modulo: Modulo, k: string): string[] {
  const s = new Set<string>();
  if (k === 'aseg' || k === 'asegActual') {
    for (const a of cartera.meta.aseguradoras) if (a?.nombre) s.add(String(a.nombre).split(',')[0].trim());
    for (const p of cartera.polizas) if (txt(p, 'aseg')) s.add(txt(p, 'aseg'));
  }
  for (const r of cartera[modulo]) if (txt(r, k)) s.add(txt(r, k));
  return [...s].sort((a, b) => a.localeCompare(b, 'es')).slice(0, 200);
}

export function FormRegistro({ modulo, titulo, r, cartera, fijos, onCerrar, onGuardado, extra, validar }: {
  modulo: Modulo;
  titulo: string;
  /** null = registro nuevo */
  r: Reg | null;
  cartera: Cartera;
  /** Campos que se guardan sin mostrarse (ej. clienteId) */
  fijos?: Record<string, unknown>;
  onCerrar: () => void;
  onGuardado: (r: Reg) => void;
  extra?: ReactNode;
  /** Comprobacion adicional antes de guardar; devuelve el error o null */
  validar?: () => string | null;
}) {
  const campos = CAMPOS[modulo];
  const inicial = useMemo(() => {
    const o: Record<string, string> = {};
    for (const c of campos) {
      const v = r?.[c.k];
      o[c.k] = v === null || v === undefined || typeof v === 'object' ? '' : c.t === 'fecha' ? String(v).slice(0, 10) : String(v);
    }
    return o;
  }, [campos, r]);
  const [v, setV] = useState(inicial);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const grupos = useMemo(() => [...new Set(campos.map((c) => c.g))], [campos]);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const fallo = validar?.();
    if (fallo) return setError(fallo);
    for (const c of campos) {
      if (c.req && !v[c.k]?.trim()) return setError(`Falta: ${c.l}`);
      if (c.t === 'email' && v[c.k] && !esCorreo(v[c.k])) return setError(`${c.l} no es válido.`);
      if (c.t === 'num' && v[c.k] && !isFinite(Number(v[c.k].replace(',', '.')))) return setError(`${c.l} debe ser un número.`);
    }
    // Solo se envia lo que cambio (y en un registro nuevo, lo que tiene valor).
    const cambios: Record<string, unknown> = { ...(fijos ?? {}) };
    for (const c of campos) {
      if (r && v[c.k] === inicial[c.k]) continue;
      if (!r && !v[c.k]) continue;
      cambios[c.k] = c.t === 'num' && v[c.k] ? Number(v[c.k].replace(',', '.')) : c.t === 'email' ? v[c.k].trim().toLowerCase() : v[c.k];
    }
    // Igual que el CRM web: el estado comercial tambien se guarda como estadoCli.
    if (modulo === 'clientes' && 'estadoComercial' in cambios) cambios.estadoCli = cambios.estadoComercial;
    if (r && Object.keys(cambios).length === Object.keys(fijos ?? {}).length) return onCerrar();
    setOcupado(true);
    setError('');
    try {
      onGuardado(await guardarRegistro(modulo, r?.id ?? null, cambios));
    } catch (err) {
      setError(err instanceof ErrorDatos ? err.message : 'No se pudo guardar.');
      setOcupado(false);
    }
  }

  return (
    <Hoja titulo={titulo} onCerrar={onCerrar}>
      <form onSubmit={guardar} noValidate>
        {extra}
        {grupos.map((g) => (
          <fieldset key={g} className="grupo">
            <legend>{g}</legend>
            {campos.filter((c) => c.g === g).map((c) => (
              <label key={c.k} className="campo">
                <span>{c.l}{c.req ? ' *' : ''}</span>
                {c.t === 'sel' ? (
                  <select value={v[c.k]} onChange={(e) => setV({ ...v, [c.k]: e.target.value })}>
                    {!c.o?.some(([x]) => x === v[c.k]) && <option value={v[c.k]}>{v[c.k] || '—'}</option>}
                    {c.o?.map(([val, t]) => <option key={val} value={val}>{t}</option>)}
                  </select>
                ) : c.t === 'area' ? (
                  <textarea value={v[c.k]} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} maxLength={5000} />
                ) : (
                  <>
                    <input
                      value={v[c.k]}
                      onChange={(e) => setV({ ...v, [c.k]: e.target.value })}
                      type={c.t === 'fecha' ? 'date' : c.t === 'hora' ? 'time' : c.t === 'email' ? 'email' : c.t === 'tel' ? 'tel' : 'text'}
                      inputMode={c.t === 'num' ? 'decimal' : c.t === 'tel' ? 'tel' : undefined}
                      list={c.t === 'lista' ? `dl-${c.k}` : undefined}
                      maxLength={300}
                      autoCapitalize={c.t === 'email' ? 'none' : undefined}
                    />
                    {c.t === 'lista' && (
                      <datalist id={`dl-${c.k}`}>
                        {sugerencias(cartera, modulo, c.k).map((x) => <option key={x} value={x} />)}
                      </datalist>
                    )}
                  </>
                )}
              </label>
            ))}
          </fieldset>
        ))}
        {error && <div className="error" role="alert">{error}</div>}
        <div className="botonera">
          <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
          <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
        </div>
      </form>
    </Hoja>
  );
}

/* ---------------- lista larga con "ver mas" ---------------- */

export function ListaLarga<T>({ items, render, paso = 60, vacio }: {
  items: T[]; render: (x: T) => ReactNode; paso?: number; vacio: string;
}) {
  const [n, setN] = useState(paso);
  if (!items.length) return <div className="vacio">{vacio}</div>;
  return (
    <>
      <div className="lista">{items.slice(0, n).map(render)}</div>
      {items.length > n && (
        <button className="boton secundario mas-abajo" type="button" onClick={() => setN(n + paso * 2)}>
          Ver más ({items.length - n} restantes)
        </button>
      )}
    </>
  );
}
