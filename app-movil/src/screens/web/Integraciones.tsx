import { useEffect, useRef, useState } from 'react';
import { actualizarCon, ErrorDatos, guardarMeta, type Meta } from '../../lib/datos';
import { CAMPOS_EJS, enviarEmailJS, parametrosCorreo, plantillaEJS, type ConfigEmailJS } from '../../lib/emailjs';
import {
  desconectarGcal, ErrorGcal, eventosDelCRM, eventoTarea, guardarEvento, minutosRestantes, retornoGcal, tareaParaCalendario,
  tokenGcal, urlConexion, urlRetorno,
} from '../../lib/gcal';
import type { Ctx } from '../Modulos';

/*
 * 🔗 Integraciones del CRM web, ahora tambien en la app:
 * 📧 EmailJS (correos directos) y 📅 Google Calendar.
 * Usan la misma configuracion guardada en la nube que el web.
 */

export function Integraciones({ ctx }: { ctx: Ctx }) {
  return (
    <>
      <EmailJS ctx={ctx} />
      <GoogleCalendar ctx={ctx} />
    </>
  );
}

/* ---------------- 📧 EmailJS ---------------- */

function EmailJS({ ctx }: { ctx: Ctx }) {
  const actual = ctx.cartera.meta.emailjs as ConfigEmailJS;
  const [v, setV] = useState<ConfigEmailJS>({ ...actual });
  const [estado, setEstado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const listo = !!plantillaEJS(actual);

  async function guardar() {
    setOcupado(true);
    try {
      const limpio = Object.fromEntries(CAMPOS_EJS.map(([k]) => [k, (v[k] ?? '').trim()]));
      const n = await guardarMeta<Meta['emailjs']>('emailjs', {}, (a) => ({ ...a, ...limpio }));
      ctx.ponerMeta('emailjs', n);
      setEstado('✅ Configuración guardada (también queda en el CRM web).');
    } catch (e) {
      setEstado('❌ ' + (e instanceof ErrorDatos ? e.message : 'No se pudo guardar.'));
    } finally { setOcupado(false); }
  }

  async function probar() {
    setOcupado(true);
    setEstado('🧪 Enviando email de prueba...');
    try {
      const cfg = { ...actual, ...v };
      await enviarEmailJS(cfg, plantillaEJS(cfg, 'bday') || plantillaEJS(cfg), parametrosCorreo('jelyancorredora@gmail.com',
        'Test EmailJS — JAC Seguros', 'EmailJS está configurado correctamente en tu app JAC Seguros.', { to_name: 'JAC Seguros Test' }));
      setEstado('✅ Email de prueba enviado a jelyancorredora@gmail.com');
    } catch (e) {
      setEstado('❌ ' + (e instanceof Error ? e.message : 'No se pudo enviar.'));
    } finally { setOcupado(false); }
  }

  return (
    <>
      <h3 className="seccion">📧 Integración EmailJS {listo && <span className="etiqueta e-ok">Activa</span>}</h3>
      <div className="tarjeta cfg-form">
        <p className="fila-sub">Envía correos directo desde la app (sin abrir tu app de correo). Es la misma cuenta de emailjs.com del CRM web; si ya la configuraste allá, aquí aparece sola.</p>
        {CAMPOS_EJS.map(([k, etiqueta, req]) => (
          <label key={k} className="campo"><span>{etiqueta}{req ? ' *' : ''}</span>
            <input value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </label>
        ))}
        <div className="botonera fila-botones">
          <button className="boton" type="button" disabled={ocupado} onClick={guardar}>💾 Guardar</button>
          <button className="boton secundario" type="button" disabled={ocupado || !(v['ejs-pub'] && v['ejs-svc'])} onClick={probar}>🧪 Probar</button>
        </div>
        {estado && <p className="fila-sub">{estado}</p>}
      </div>
    </>
  );
}

/* ---------------- 📅 Google Calendar ---------------- */

function GoogleCalendar({ ctx }: { ctx: Ctx }) {
  const guardado = String(ctx.cartera.meta.integraciones.googleClientId ?? '');
  const [cid, setCid] = useState(guardado);
  const [estado, setEstado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [, refrescar] = useState(0);
  const token = tokenGcal();
  const auto = useRef(false);

  async function guardarCid() {
    try {
      const n = await guardarMeta<Meta['integraciones']>('integraciones', {}, (a) => ({ ...a, googleClientId: cid.trim() }));
      ctx.ponerMeta('integraciones', n);
      ctx.avisar('Google Client ID guardado y sincronizado');
      return true;
    } catch (e) {
      ctx.avisar(e instanceof ErrorDatos ? e.message : 'No se pudo guardar.');
      return false;
    }
  }

  async function conectar() {
    if (!/\.apps\.googleusercontent\.com$/.test(cid.trim())) return setEstado('Pega primero tu Client ID de Google (termina en .apps.googleusercontent.com).');
    if (cid.trim() !== guardado && !(await guardarCid())) return;
    window.location.href = urlConexion(cid);
  }

  async function sincronizar() {
    const t = tokenGcal();
    if (!t) { setEstado('Conecta primero con el botón de arriba.'); return; }
    setOcupado(true);
    const c = ctx.cartera;
    try {
      // 1. Tareas (cada una guarda su gcalEventId, como en el web)
      const tareas = c.tareas.filter(tareaParaCalendario);
      let hechas = 0;
      for (const ta of tareas) {
        setEstado(`Sincronizando tareas ${++hechas}/${tareas.length}…`);
        const ev = eventoTarea(ta);
        if (!ev) continue;
        const antes = typeof ta.gcalEventId === 'string' ? ta.gcalEventId : undefined;
        const id = await guardarEvento(t, ev, antes);
        if (id && id !== antes) {
          try { ctx.poner('tareas', await actualizarCon('tareas', ta.id, () => ({ gcalEventId: id }))); } catch { /* se reintenta en la proxima */ }
        }
      }
      // 2. Renovaciones, cumpleaños y cobros (gcalRefs, compartido con el web)
      const evs = eventosDelCRM(c);
      const refs: Record<string, string> = {};
      let n = 0;
      for (const { k, e } of evs) {
        setEstado(`Enviando eventos del CRM ${++n}/${evs.length}…`);
        const id = await guardarEvento(t, e, c.meta.gcalRefs[k]);
        if (id) refs[k] = id;
      }
      if (Object.keys(refs).length) {
        const v = await guardarMeta<Meta['gcalRefs']>('gcalRefs', {}, (a) => ({ ...a, ...refs }));
        ctx.ponerMeta('gcalRefs', v);
      }
      setEstado(`✅ Tareas + ${Object.keys(refs).length} evento(s) del CRM (renovaciones, cumpleaños y cobros) · ${new Date().toLocaleTimeString('es-PA')}`);
      ctx.avisar('📅 Google Calendar sincronizado');
    } catch (e) {
      setEstado('❌ ' + (e instanceof ErrorGcal || e instanceof ErrorDatos ? e.message : 'No se pudo sincronizar. Revisa la conexión.'));
      if (e instanceof ErrorGcal) { desconectarGcal(); refrescar((x) => x + 1); }
    } finally { setOcupado(false); }
  }

  // Al volver de Google: sincronizar una vez
  useEffect(() => {
    if (retornoGcal.v === 'conectado' && !auto.current) {
      auto.current = true;
      retornoGcal.v = null;
      setEstado('✅ Conectado. Sincronizando...');
      void sincronizar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h3 className="seccion">📅 Google Calendar {token && <span className="etiqueta e-ok">Conectado</span>}</h3>
      <div className="tarjeta cfg-form">
        <p className="fila-sub">Manda a tu Google Calendar las tareas de la agenda, las renovaciones (30 días), los cumpleaños (7 días) y los cobros. Si algo ya estaba, lo actualiza; nunca lo duplica, ni con el web.</p>
        <label className="campo"><span>Client ID de Google</span>
          <input value={cid} onChange={(e) => setCid(e.target.value)} placeholder="xxxxxxxx.apps.googleusercontent.com" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        </label>
        {!token ? (
          <button className="boton" type="button" disabled={ocupado} onClick={conectar}>🔗 Conectar con Google</button>
        ) : (
          <>
            <p className="fila-sub">Conexión activa por {minutosRestantes()} min más (Google la da por 1 hora, como en el web).</p>
            <div className="botonera fila-botones">
              <button className="boton" type="button" disabled={ocupado} onClick={sincronizar}>🔄 Sincronizar ahora</button>
              <button className="boton secundario" type="button" disabled={ocupado} onClick={() => { desconectarGcal(); setEstado('Desconectado.'); refrescar((x) => x + 1); }}>Desconectar</button>
            </div>
          </>
        )}
        {estado && <p className="fila-sub">{estado}</p>}
        <details className="cfg-ayuda">
          <summary>Primera vez: autorizar la app en Google</summary>
          <p>En <b>console.cloud.google.com</b> → APIs y servicios → Credenciales → tu "ID de cliente de OAuth" (el mismo del CRM web):</p>
          <p>• En <b>Orígenes de JavaScript autorizados</b> agrega: <code>{location.origin}</code></p>
          <p>• En <b>URI de redireccionamiento autorizados</b> agrega: <code>{urlRetorno()}</code></p>
          <p>Guarda, espera unos minutos y toca "Conectar con Google".</p>
        </details>
      </div>
    </>
  );
}
