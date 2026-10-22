import { useEffect, useState, type FormEvent } from 'react';
import type { Factor } from '@supabase/supabase-js';
import { Hoja } from '../components/Piezas';
import {
  cambiarClave, desactivarMfa, factoresMfa, iniciarAltaMfa, validarClave, verificarMfa,
} from '../lib/auth';
import { activarAvisos, avisosActivos, desactivarAvisos, programarAvisos } from '../lib/avisos';
import { esAppNativa, estadoBiometria, type EstadoBiometria } from '../lib/bloqueo';
import type { Cartera } from '../lib/datos';
import { SEGURIDAD } from '../lib/config';
import { fecha, hoyISO } from '../lib/formato';
import type { Avisar } from '../App';
import { activarPush, desactivarPush, estadoPush, probarPush, type EstadoPush } from '../lib/push';

export function Ajustes({ correo, cartera, onSalir, avisar }: {
  correo: string; cartera: Cartera; onSalir: () => void; avisar: Avisar;
}) {
  const cargadoEn = cartera.cargadoEn;
  const [avisos, setAvisos] = useState<boolean | null>(null);
  useEffect(() => {
    void avisosActivos().then(setAvisos);
  }, []);

  async function cambiarAvisos() {
    if (avisos) {
      await desactivarAvisos();
      setAvisos(false);
      return avisar('Avisos desactivados');
    }
    const r = await activarAvisos();
    if (r === 'ok') {
      setAvisos(true);
      await programarAvisos(cartera);
      avisar('Te avisaremos cada día a las 8:00');
    } else if (r === 'denegado') {
      avisar('Permite las notificaciones de JAC Seguros en los ajustes del teléfono');
    } else {
      avisar('Los avisos funcionan solo en el teléfono');
    }
  }

  const [bio, setBio] = useState<EstadoBiometria | null>(null);
  const [factores, setFactores] = useState<Factor[] | null>(null);
  const [alta, setAlta] = useState(false);
  const [clave, setClave] = useState(false);

  const recargarFactores = () => void factoresMfa().then(setFactores);
  useEffect(() => {
    void estadoBiometria().then(setBio).catch(() => setBio(null));
    recargarFactores();
  }, []);

  async function quitarMfa(f: Factor) {
    const r = await desactivarMfa(f.id);
    if (r.error) avisar(r.error);
    else { avisar('Verificación en dos pasos desactivada'); recargarFactores(); }
  }

  const min = (ms: number) => Math.round(ms / 60_000);

  return (
    <>
      <h3 className="seccion">Cuenta</h3>
      <div className="tarjeta">
        <dl className="datos"><dt>Usuario</dt><dd>{correo}</dd></dl>
      </div>

      <h3 className="seccion">Seguridad</h3>
      <div className="tarjeta">
        <dl className="datos">
          <dt>Desbloqueo</dt>
          <dd>{!esAppNativa ? 'Contraseña (Face ID vía Llavero)' : bio ? (bio.disponible ? bio.tipo : bio.dispositivoSeguro ? 'PIN del teléfono' : 'No configurado') : '—'}</dd>
          <dt>Dos pasos</dt>
          <dd>{factores === null ? '…' : factores.length ? <span className="etiqueta e-ok">Activado</span> : <span className="etiqueta e-aviso">Desactivado</span>}</dd>
          <dt>Bloqueo automático</dt>
          <dd>{esAppNativa ? `${min(SEGURIDAD.bloqueoPorInactividad)} min sin uso` : `Cierra sesión a los ${min(SEGURIDAD.bloqueoPorInactividad)} min sin uso o al salir`}</dd>
          <dt>Sesión máxima</dt>
          <dd>{min(SEGURIDAD.duracionMaximaSesion) / 60} h</dd>
        </dl>
      </div>
      {factores && !factores.length && (
        <button className="boton" type="button" onClick={() => setAlta(true)}>Activar verificación en dos pasos</button>
      )}
      {factores?.map((f) => (
        <button key={f.id} className="boton secundario" type="button" onClick={() => quitarMfa(f)}>
          Desactivar dos pasos
        </button>
      ))}
      <button className="boton secundario" type="button" onClick={() => setClave(true)}>Cambiar contraseña</button>

      {!esAppNativa && <NotificacionesWeb avisar={avisar} />}

      {esAppNativa && (<>
      <h3 className="seccion">Avisos</h3>
      <div className="tarjeta">
        <dl className="datos">
          <dt>Resumen diario 8:00</dt>
          <dd>{avisos ? <span className="etiqueta e-ok">Activado</span> : <span className="etiqueta e-neutra">Desactivado</span>}</dd>
        </dl>
        <p className="sincro">Pólizas por vencer, tareas del día y prospectos por contactar. Solo muestra cantidades, nunca nombres.</p>
      </div>
      <button className={`boton${avisos ? ' secundario' : ''}`} type="button" onClick={cambiarAvisos} disabled={avisos === null}>
        {avisos ? 'Desactivar avisos' : 'Activar avisos diarios'}
      </button>
      </>)}

      <h3 className="seccion">Sesión</h3>
      <button className="boton peligro" type="button" onClick={onSalir}>Cerrar sesión</button>
      <p className="sincro">
        Datos actualizados {fecha(hoyISO(new Date(cargadoEn)))}, {new Date(cargadoEn).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })} · Versión {__APP_VERSION__}
      </p>

      {alta && (
        <AltaMfa onCerrar={() => setAlta(false)}
          onListo={() => { setAlta(false); recargarFactores(); avisar('Verificación en dos pasos activada'); }} />
      )}
      {clave && (
        <CambiarClave onCerrar={() => setClave(false)}
          onListo={() => { setClave(false); avisar('Contraseña actualizada'); }} />
      )}
    </>
  );
}

function AltaMfa({ onCerrar, onListo }: { onCerrar: () => void; onListo: () => void }) {
  const [datos, setDatos] = useState<{ factorId: string; secreto: string; qr: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void iniciarAltaMfa().then((r) => ('error' in r ? setError(r.error) : setDatos(r)));
  }, []);

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!datos) return;
    const r = await verificarMfa(datos.factorId, codigo);
    if (r.error) { setError(r.error); setCodigo(''); } else onListo();
  }

  // Solo se acepta el QR que genera Supabase (imagen SVG en data:).
  const qrSeguro = datos?.qr.startsWith('data:image/svg+xml') ? datos.qr : null;

  return (
    <Hoja titulo="Verificación en dos pasos" onCerrar={onCerrar}>
      {error && <div className="error">{error}</div>}
      {datos && (
        <form onSubmit={confirmar}>
          <div className="nota">
            1. Abre Google Authenticator, Microsoft Authenticator o similar.<br />
            2. Escanea el código o copia la clave.<br />
            3. Escribe el código de 6 dígitos.
          </div>
          {qrSeguro && <img className="qr" src={qrSeguro} alt="Código QR para la app autenticadora" />}
          <p className="secreto">{datos.secreto}</p>
          <label className="campo">
            <span>Código</span>
            <input className="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
              value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} />
          </label>
          <button className="boton" type="submit" disabled={codigo.length !== 6}>Activar</button>
        </form>
      )}
      <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
    </Hoja>
  );
}

function CambiarClave({ onCerrar, onListo }: { onCerrar: () => void; onListo: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const motivo = validarClave(a) ?? (a !== b ? 'Las contraseñas no coinciden.' : null);
    if (motivo) return setError(motivo);
    setOcupado(true);
    const r = await cambiarClave(a);
    setOcupado(false);
    if (r.error) setError(r.error);
    else onListo();
  }

  return (
    <Hoja titulo="Cambiar contraseña" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        {error && <div className="error">{error}</div>}
        <label className="campo">
          <span>Nueva contraseña</span>
          <input type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} maxLength={128} />
        </label>
        <label className="campo">
          <span>Repetir</span>
          <input type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} maxLength={128} />
        </label>
        <p className="sincro">Mínimo 12 caracteres, con mayúsculas, minúsculas y números.</p>
        <button className="boton" type="submit" disabled={ocupado}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
        <button className="boton secundario" type="button" onClick={onCerrar}>Cancelar</button>
      </form>
    </Hoja>
  );
}

const TEXTO_PUSH: Record<EstadoPush, string> = {
  activo: 'Activadas en este dispositivo',
  apagado: 'Desactivadas',
  bloqueado: 'Bloqueadas en los ajustes del teléfono',
  instalar: 'Primero agrega la app a la pantalla de inicio',
  'no-soportado': 'Este navegador no las admite',
};

function NotificacionesWeb({ avisar }: { avisar: Avisar }) {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { void estadoPush().then(setEstado).catch(() => setEstado('no-soportado')); }, []);
  async function hacer(f: () => Promise<unknown>) {
    setOcupado(true);
    try { await f(); } catch (e) { avisar(e instanceof Error ? e.message : 'No se pudo completar.'); }
    setEstado(await estadoPush().catch(() => 'no-soportado' as EstadoPush));
    setOcupado(false);
  }
  return (
    <>
      <h3 className="seccion">Notificaciones</h3>
      <div className="tarjeta">
        <dl className="datos">
          <dt>Estado</dt>
          <dd>{estado ? <span className={`etiqueta ${estado === 'activo' ? 'e-ok' : estado === 'apagado' ? 'e-neutra' : 'e-aviso'}`}>{TEXTO_PUSH[estado]}</span> : '…'}</dd>
        </dl>
        <p className="sincro">
          Te avisa aunque la app esté cerrada: recordatorios de tareas y reuniones de la agenda (a su hora o con el aviso que
          elijas), resumen diario a las 7:30 a. m. (vencimientos, tareas, reuniones, seguimientos y cumpleaños).
        </p>
      </div>
      {estado === 'apagado' && (
        <button className="boton" type="button" disabled={ocupado} onClick={() => hacer(async () => { const r = await activarPush(); if (r === 'activo') avisar('🔔 Notificaciones activadas'); })}>
          🔔 Activar notificaciones
        </button>
      )}
      {estado === 'activo' && (
        <div className="botonera">
          <button className="boton" type="button" disabled={ocupado} onClick={() => hacer(async () => avisar(await probarPush()))}>📨 Enviar notificación de prueba</button>
          <button className="boton secundario" type="button" disabled={ocupado} onClick={() => hacer(async () => { await desactivarPush(); avisar('Notificaciones desactivadas'); })}>Desactivar en este dispositivo</button>
        </div>
      )}
      {estado === 'instalar' && <div className="nota">En Safari toca Compartir → “Agregar a inicio”, abre la app desde el ícono y vuelve aquí.</div>}
      {estado === 'bloqueado' && <div className="nota">Ve a Ajustes del iPhone → Notificaciones → JAC Seguros y actívalas.</div>}
    </>
  );
}
