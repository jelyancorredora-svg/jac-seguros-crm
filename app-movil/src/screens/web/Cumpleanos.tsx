import { useEffect, useMemo, useRef, useState } from 'react';
import { Fila, Hoja, inicial } from '../../components/Piezas';
import { ListaLarga } from '../../components/Registro';
import { ErrorDatos, registrarAccion, txt, type Reg } from '../../lib/datos';
import { enlaceWhatsApp, normalizar } from '../../lib/formato';
import {
  ACCION_CUMPLE, MENSAJE_TARJETA_DEFECTO, MENSAJE_WA_DEFECTO, MESES, cuando, diaMes, enPestana, listaCumples,
  ordenar, primerNombre, rellenarMensaje, type ItemCumple, type Pestana,
} from '../../lib/cumpleanos';
import { TEMAS, tarjetaPNG, type TemaId } from '../../lib/tarjetaCumple';
import type { Ctx } from '../Modulos';

const CLAVE_MSG = 'jac.cumple.mensaje';
const CLAVE_TEMA = 'jac.cumple.tema';
const leer = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k: string, v: string | null) => {
  try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* sin almacenamiento */ }
};

/** Enlace de WhatsApp con el codigo de pais del cliente (igual que las fichas). */
function waDe(r: Reg, texto: string): string | null {
  const tel = txt(r, 'cel') || txt(r, 'tel');
  if (!tel) return null;
  const cod = txt(r, 'codPais');
  const d = tel.replace(/\D/g, '');
  const base = cod && cod !== '507' && !d.startsWith(cod) ? enlaceWhatsApp('+' + cod + d) : enlaceWhatsApp(tel);
  return base ? `${base}?text=${encodeURIComponent(texto)}` : null;
}

/** Abre WhatsApp en otra pestaña sin que esta pueda tocar la app. */
function abrirWA(url: string) {
  const w = window.open('', '_blank');
  if (w) { w.opener = null; w.location.href = url; } else window.location.href = url;
}

type Como = 'whatsapp' | 'tarjeta' | 'manual';
const COMO: Record<Como, string> = {
  whatsapp: 'Mensaje de cumpleaños por WhatsApp',
  tarjeta: 'Tarjeta de cumpleaños personalizada',
  manual: 'Marcada como felicitada desde la app',
};

export function Cumpleanos({ ctx }: { ctx: Ctx }) {
  const { cartera } = ctx;
  const [tab, setTab] = useState<Pestana>('hoy');
  const [q, setQ] = useState('');
  const [plantilla, setPlantilla] = useState(() => leer(CLAVE_MSG) || MENSAJE_WA_DEFECTO);
  const [editar, setEditar] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);
  const [lote, setLote] = useState<string[] | null>(null);
  const hoy = useMemo(() => new Date(), []);

  const todos = useMemo(() => listaCumples(cartera.clientes, cartera.prospectos, hoy), [cartera.clientes, cartera.prospectos, hoy]);
  const cuenta = useMemo(() => {
    const c = { hoy: 0, semana: 0, mes: 0, '30': 0, todos: todos.length } as Record<Pestana, number>;
    for (const x of todos) for (const p of ['hoy', 'semana', 'mes', '30'] as Pestana[]) if (enPestana(x, p, hoy)) c[p]++;
    return c;
  }, [todos, hoy]);
  const lista = useMemo(() => {
    const t = normalizar(q);
    return ordenar(todos.filter((x) => enPestana(x, tab, hoy) && (!t || normalizar(x.nombre).includes(t))), tab, hoy);
  }, [todos, tab, q, hoy]);
  const deHoy = todos.filter((x) => x.delta === 0);
  const pendientesHoy = deHoy.filter((x) => !x.felicitado && waDe(x.r, ''));
  const sel = selId ? todos.find((x) => x.r.id === selId) ?? null : null;

  async function registrar(x: ItemCumple, como: Como) {
    try {
      const r = await registrarAccion(x.modulo, x.r.id, { accion: ACCION_CUMPLE, resultado: COMO[como], tipo: como === 'manual' ? 'manual' : 'whatsapp' },
        { cumpleFelicitado: String(x.anio) });
      ctx.poner(x.modulo, r);
      ctx.avisar(`✅ Felicitación a ${primerNombre(x.nombre)} registrada`);
    } catch (e) {
      ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo registrar la felicitación.');
    }
  }

  const fila = (x: ItemCumple) => (
    <Fila key={x.modulo + x.r.id} inicial={x.felicitado ? '✅' : inicial(x.nombre)}
      titulo={<>{x.nombre}{x.modulo === 'prospectos' && <span className="cum-prospecto">Prospecto</span>}</>}
      sub={`${diaMes(x.fecha)}${x.edad !== null ? ` · cumple ${x.edad}` : ''}`}
      derecha={<span className={`etiqueta ${x.delta === 0 ? 'e-peligro' : x.delta < 0 ? 'e-neutra' : x.delta <= 7 ? 'e-aviso' : 'e-info'}`}>{cuando(x.delta)}</span>}
      onClick={() => ctx.abrir(x.modulo, x.r.id)}
      acciones={<button type="button" className="icono-accion cum-boton" aria-label={`Felicitar a ${x.nombre}`} onClick={() => setSelId(x.r.id)}>🎂</button>} />
  );

  const porMes = useMemo(() => {
    if (tab !== 'todos') return [];
    const g: Array<{ mes: number; xs: ItemCumple[] }> = [];
    for (const x of lista) {
      const ult = g[g.length - 1];
      if (ult && ult.mes === x.nac.m) ult.xs.push(x); else g.push({ mes: x.nac.m, xs: [x] });
    }
    return g;
  }, [lista, tab]);

  return (
    <>
      <div className="cum-hero">
        <div className="cum-hero-texto">
          <b>{deHoy.length ? `🎂 Hoy ${deHoy.length === 1 ? 'cumple' : 'cumplen'} ${deHoy.length}` : '🎈 Hoy no cumple nadie'}</b>
          <span>{deHoy.length
            ? deHoy.slice(0, 3).map((x) => primerNombre(x.nombre)).join(', ') + (deHoy.length > 3 ? ` y ${deHoy.length - 3} más` : '')
            : `${cuenta['30']} en los próximos 30 días`}</span>
        </div>
        {pendientesHoy.length > 0 && (
          <button type="button" className="boton cum-todos" onClick={() => setLote(pendientesHoy.map((x) => x.r.id))}>
            🎉 Felicitar a todos los de hoy ({pendientesHoy.length})
          </button>
        )}
        {deHoy.length > 0 && !pendientesHoy.length && <span className="cum-listo">✅ Ya felicitaste a todos los de hoy</span>}
      </div>

      <input className="buscador" type="search" placeholder="Buscar por nombre" value={q} onChange={(e) => setQ(e.target.value)}
        autoCapitalize="none" spellCheck={false} maxLength={80} />
      <div className="filtros">
        {([['hoy', 'Hoy'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['30', 'Próximos 30 días'], ['todos', 'Todos']] as Array<[Pestana, string]>).map(([k, t]) => (
          <button key={k} type="button" className={tab === k ? 'activa' : ''} onClick={() => setTab(k)}>{t} ({cuenta[k]})</button>
        ))}
      </div>
      <div className="seccion-fila">
        <p className="contador cum-contador">{lista.length} {lista.length === 1 ? 'persona' : 'personas'}</p>
        <button type="button" className="mini" onClick={() => setEditar(true)}>✏️ Mensaje</button>
      </div>

      {tab === 'todos'
        ? (porMes.length ? porMes.map((g) => (
          <div key={g.mes} className="cum-mes">
            <h4 className="seccion">{MESES[g.mes - 1]} · {g.xs.length}</h4>
            <div className="lista">{g.xs.map(fila)}</div>
          </div>
        )) : <div className="vacio">No hay fechas de nacimiento registradas.</div>)
        : <ListaLarga items={lista} render={fila} vacio={q ? 'Nadie coincide con la búsqueda.'
          : tab === 'hoy' ? 'Hoy no cumple años nadie 🎈' : 'No hay cumpleaños en este período.'} />}
      {!todos.length && <p className="contador cum-nota">Los cumpleaños salen de la fecha de nacimiento de cada cliente.</p>}

      {editar && <EditarMensaje valor={plantilla} onCerrar={() => setEditar(false)} onGuardar={(v) => {
        const def = v.trim() === MENSAJE_WA_DEFECTO.trim() || !v.trim();
        guardar(CLAVE_MSG, def ? null : v);
        setPlantilla(def ? MENSAJE_WA_DEFECTO : v);
        setEditar(false);
        ctx.avisar('Mensaje guardado en este dispositivo');
      }} />}
      {sel && <Felicitar key={sel.r.id} x={sel} plantilla={plantilla} onCerrar={() => setSelId(null)} registrar={registrar} />}
      {lote && <Lote ids={lote} todos={todos} plantilla={plantilla} registrar={registrar} onCerrar={() => setLote(null)} />}
    </>
  );
}

/* ---------------- editar plantilla ---------------- */

function Variables({ onPoner }: { onPoner: (v: string) => void }) {
  return (
    <div className="chips">
      {['{primerNombre}', '{nombre}', '{edad}'].map((v) => (
        <button key={v} type="button" className="chip" onClick={() => onPoner(v)}>{v}</button>
      ))}
    </div>
  );
}

function EditarMensaje({ valor, onCerrar, onGuardar }: { valor: string; onCerrar: () => void; onGuardar: (v: string) => void }) {
  const [v, setV] = useState(valor);
  const area = useRef<HTMLTextAreaElement>(null);
  const poner = (x: string) => {
    const a = area.current;
    const i = a?.selectionStart ?? v.length, f = a?.selectionEnd ?? v.length;
    setV(v.slice(0, i) + x + v.slice(f));
  };
  return (
    <Hoja titulo="✏️ Mensaje de cumpleaños" onCerrar={onCerrar}>
      <p className="contador">Toca una variable para insertarla. Se reemplaza por los datos de cada cliente.</p>
      <Variables onPoner={poner} />
      <label className="campo"><span>Mensaje de WhatsApp</span>
        <textarea ref={area} className="cum-area" value={v} onChange={(e) => setV(e.target.value)} maxLength={1500} /></label>
      <div className="tarjeta cum-vista"><div className="texto-largo">{rellenarMensaje(v, { nombre: 'María González', edad: 40 })}</div></div>
      <div className="botonera">
        <button className="boton" type="button" onClick={() => onGuardar(v)}>Guardar</button>
        <button className="boton secundario" type="button" onClick={() => setV(MENSAJE_WA_DEFECTO)}>Restablecer texto del CRM</button>
      </div>
    </Hoja>
  );
}

/* ---------------- felicitar a una persona ---------------- */

function Felicitar({ x, plantilla, onCerrar, registrar }: {
  x: ItemCumple; plantilla: string; onCerrar: () => void; registrar: (x: ItemCumple, como: Como) => Promise<void>;
}) {
  const [modo, setModo] = useState<'mensaje' | 'tarjeta'>('mensaje');
  const [msg, setMsg] = useState(() => rellenarMensaje(plantilla, x));
  const sinTel = !waDe(x.r, '');
  const area = useRef<HTMLTextAreaElement>(null);
  const poner = (v: string) => {
    const a = area.current;
    const i = a?.selectionStart ?? msg.length, f = a?.selectionEnd ?? msg.length;
    setMsg(msg.slice(0, i) + rellenarMensaje(v, x) + msg.slice(f));
  };

  function enviar() {
    const url = waDe(x.r, msg);
    if (!url) return;
    abrirWA(url);
    void registrar(x, 'whatsapp');
  }

  return (
    <Hoja titulo={`🎂 ${x.nombre}`} onCerrar={onCerrar}>
      <p className="contador cum-sub">
        {diaMes(x.fecha)}{x.edad !== null ? ` · cumple ${x.edad}` : ''} · {cuando(x.delta)}
        {x.felicitado && <b className="cum-ok"> · ✅ ya felicitado {x.anio}</b>}
      </p>
      <div className="filtros">
        <button type="button" className={modo === 'mensaje' ? 'activa' : ''} onClick={() => setModo('mensaje')}>💬 Mensaje</button>
        <button type="button" className={modo === 'tarjeta' ? 'activa' : ''} onClick={() => setModo('tarjeta')}>🖼️ Tarjeta personalizada</button>
      </div>
      {sinTel && <div className="nota">Sin celular registrado: puedes descargar la tarjeta y enviarla por otro medio.</div>}

      {modo === 'mensaje' ? (
        <>
          <Variables onPoner={poner} />
          <label className="campo"><span>Mensaje</span>
            <textarea ref={area} className="cum-area" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={1500} /></label>
          <div className="botonera">
            <button className="boton cum-wa" type="button" disabled={sinTel || !msg.trim()} onClick={enviar}>💬 Enviar por WhatsApp</button>
            {!x.felicitado && <button className="boton secundario" type="button" onClick={() => void registrar(x, 'manual')}>✓ Marcar como felicitado</button>}
          </div>
        </>
      ) : (
        <Tarjeta x={x} msgWA={msg} registrar={registrar} />
      )}
    </Hoja>
  );
}

/* ---------------- tarjeta personalizada ---------------- */

function Tarjeta({ x, msgWA, registrar }: { x: ItemCumple; msgWA: string; registrar: (x: ItemCumple, como: Como) => Promise<void> }) {
  const [tema, setTema] = useState<TemaId>(() => (TEMAS.some((t) => t.id === leer(CLAVE_TEMA)) ? leer(CLAVE_TEMA) as TemaId : 'marfil'));
  const [texto, setTexto] = useState(MENSAJE_TARJETA_DEFECTO);
  const [conEdad, setConEdad] = useState(false);
  const [png, setPng] = useState<{ file: File; url: string } | null>(null);
  const [error, setError] = useState('');
  const nombre = primerNombre(x.nombre);
  const puedeCompartir = useMemo(() => {
    try {
      const f = new File([new Uint8Array(1)], 'a.png', { type: 'image/png' });
      return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [f] });
    } catch { return false; }
  }, []);

  useEffect(() => {
    let vivo = true;
    let url = '';
    const t = setTimeout(() => {
      tarjetaPNG({ tema, primerNombre: nombre, mensaje: texto, edad: conEdad ? x.edad : null })
        .then(({ blob }) => {
          if (!vivo) return;
          const archivo = `Feliz-cumpleanos-${normalizar(nombre).replace(/[^a-z0-9]+/g, '-') || 'cliente'}.png`;
          url = URL.createObjectURL(blob);
          setPng({ file: new File([blob], archivo, { type: 'image/png' }), url });
          setError('');
        })
        .catch(() => vivo && setError('No se pudo crear la tarjeta en este dispositivo.'));
    }, 200);
    return () => { vivo = false; clearTimeout(t); if (url) URL.revokeObjectURL(url); };
  }, [tema, texto, conEdad, nombre, x.edad]);

  async function compartir() {
    if (!png) return;
    try {
      await navigator.share({ files: [png.file], text: msgWA });
      void registrar(x, 'tarjeta');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return;
      descargarYWA();
    }
  }

  function descargarYWA() {
    if (!png) return;
    const a = document.createElement('a');
    a.href = png.url;
    a.download = png.file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    const url = waDe(x.r, msgWA);
    if (url) setTimeout(() => abrirWA(url), 400);
    void registrar(x, 'tarjeta');
  }

  return (
    <>
      <div className="cum-temas" role="radiogroup" aria-label="Diseño">
        {TEMAS.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={tema === t.id} className={`cum-tema${tema === t.id ? ' activa' : ''}`}
            onClick={() => { setTema(t.id); guardar(CLAVE_TEMA, t.id); }}>
            <i style={{ background: `linear-gradient(135deg, ${t.muestra[0]} 0 55%, ${t.muestra[1]} 55% 100%)` }} />
            <span>{t.nombre}</span>
          </button>
        ))}
      </div>
      <div className="cum-vista-tarjeta">
        {png ? <img src={png.url} alt={`Tarjeta de cumpleaños para ${nombre}`} /> : <div className="cum-cargando"><div className="giro" /></div>}
      </div>
      {error && <div className="error">{error}</div>}
      <label className="campo"><span>Mensaje de la tarjeta</span>
        <textarea className="cum-area corta" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={260} /></label>
      {x.edad !== null && (
        <label className="campo casilla"><input type="checkbox" checked={conEdad} onChange={(e) => setConEdad(e.target.checked)} /> <span>Mostrar la edad ({x.edad} años)</span></label>
      )}
      <div className="botonera">
        {puedeCompartir && <button className="boton cum-wa" type="button" disabled={!png} onClick={() => void compartir()}>📤 Compartir tarjeta (WhatsApp…)</button>}
        <button className={`boton${puedeCompartir ? ' secundario' : ' cum-wa'}`} type="button" disabled={!png} onClick={descargarYWA}>
          ⬇️ Descargar{waDe(x.r, '') ? ' y abrir WhatsApp' : ''}
        </button>
      </div>
      <p className="contador cum-nota">El texto del mensaje (pestaña 💬) acompaña a la imagen. En iPhone también puedes mantener presionada la tarjeta para guardarla en Fotos.</p>
    </>
  );
}

/* ---------------- felicitar a todos los de hoy, uno por uno ---------------- */

function Lote({ ids, todos, plantilla, registrar, onCerrar }: {
  ids: string[]; todos: ItemCumple[]; plantilla: string; registrar: (x: ItemCumple, como: Como) => Promise<void>; onCerrar: () => void;
}) {
  const [i, setI] = useState(0);
  const [enviados, setEnviados] = useState(0);
  const x = i < ids.length ? todos.find((t) => t.r.id === ids[i]) ?? null : null;
  const msg = x ? rellenarMensaje(plantilla, x) : '';

  function enviar() {
    if (!x) return;
    const url = waDe(x.r, msg);
    if (url) { abrirWA(url); void registrar(x, 'whatsapp'); setEnviados((n) => n + 1); }
    setI(i + 1);
  }

  return (
    <Hoja titulo="🎉 Felicitar a todos los de hoy" onCerrar={onCerrar}>
      {x ? (
        <>
          <div className="barra"><div className="barra-relleno" style={{ width: `${(i / ids.length) * 100}%` }} /></div>
          <p className="contador cum-paso">{i + 1} de {ids.length} · {x.nombre}{x.edad !== null ? ` · cumple ${x.edad}` : ''}</p>
          <div className="tarjeta cum-vista"><div className="texto-largo">{msg}</div></div>
          <div className="botonera">
            <button className="boton cum-wa" type="button" onClick={enviar}>💬 Enviar a {primerNombre(x.nombre)}</button>
            <button className="boton secundario" type="button" onClick={() => setI(i + 1)}>Saltar</button>
          </div>
          <p className="contador cum-nota">Después de enviar en WhatsApp, vuelve a la app para seguir con el siguiente.</p>
        </>
      ) : (
        <>
          <div className="vacio">🎉 ¡Listo! Enviaste {enviados} {enviados === 1 ? 'felicitación' : 'felicitaciones'}.</div>
          <button className="boton" type="button" onClick={onCerrar}>Cerrar</button>
        </>
      )}
    </Hoja>
  );
}
