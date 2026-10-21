import { useEffect, useState, type FormEvent } from 'react';
import type { Factor } from '@supabase/supabase-js';
import { Hoja } from '../components/Piezas';
import {
  cambiarClave, desactivarMfa, factoresMfa, iniciarAltaMfa, validarClave, verificarMfa,
} from '../lib/auth';
import { estadoBiometria, type EstadoBiometria } from '../lib/bloqueo';
import { SEGURIDAD } from '../lib/config';
import { fecha, hoyISO } from '../lib/formato';
import type { Avisar } from '../App';

export function Ajustes({ correo, cargadoEn, onSalir, avisar }: {
  correo: string; cargadoEn: number; onSalir: () => void; avisar: Avisar;
}) {
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
          <dd>{bio ? (bio.disponible ? bio.tipo : bio.dispositivoSeguro ? 'PIN del teléfono' : 'No configurado') : '—'}</dd>
          <dt>Dos pasos</dt>
          <dd>{factores === null ? '…' : factores.length ? <span className="etiqueta e-ok">Activado</span> : <span className="etiqueta e-aviso">Desactivado</span>}</dd>
          <dt>Bloqueo automático</dt>
          <dd>{min(SEGURIDAD.bloqueoPorInactividad)} min sin uso</dd>
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
