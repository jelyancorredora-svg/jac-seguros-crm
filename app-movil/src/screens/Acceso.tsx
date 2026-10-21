import { useEffect, useState, type FormEvent } from 'react';
import { Icono } from '../components/Icono';
import { esperaParaIntentar, iniciarSesion, verificarMfa } from '../lib/auth';
import { desbloquear, esAppNativa } from '../lib/bloqueo';

function Marca({ sub }: { sub: string }) {
  return (
    <div className="marca">
      <div className="marca-logo">JAC</div>
      <h1>JAC SEGUROS</h1>
      <p>{sub}</p>
    </div>
  );
}

const LEGAL = 'Regulado y supervisado por la Superintendencia de Seguros y Reaseguros de Panamá.';

export function Login({ onEntrar }: { onEntrar: () => Promise<void> }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    void esperaParaIntentar().then(setEspera);
  }, []);
  useEffect(() => {
    if (espera <= 0) return;
    const t = window.setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [espera]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (ocupado || espera > 0) return;
    setOcupado(true);
    setError('');
    const r = await iniciarSesion(correo, clave);
    setOcupado(false);
    if (r.error) {
      setError(r.error);
      setClave('');
      setEspera(await esperaParaIntentar());
      return;
    }
    setClave('');
    try {
      await onEntrar();
    } catch {
      // Si no se puede comprobar el segundo paso no se entra (falla cerrado).
      setError('No se pudo verificar la sesión. Inténtalo de nuevo.');
    }
  }

  return (
    <main className="acceso">
      <form className="acceso-caja" onSubmit={enviar} autoComplete="on">
        <Marca sub="Acceso para el equipo" />
        {error && <div className="error" role="alert">{error}</div>}
        <label className="campo">
          <span>Correo</span>
          <input type="email" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
            value={correo} onChange={(e) => setCorreo(e.target.value)} required maxLength={120} />
        </label>
        <label className="campo">
          <span>Contraseña</span>
          <input type="password" autoComplete="current-password" value={clave}
            onChange={(e) => setClave(e.target.value)} required maxLength={128} />
        </label>
        <button className="boton" type="submit" disabled={ocupado || espera > 0}>
          {ocupado ? 'Entrando…' : espera > 0 ? `Espera ${espera} s` : 'Entrar'}
        </button>
        {!esAppNativa && (
          <p className="pie-legal">
            Por seguridad la sesión se cierra al salir de la app. Para entrar rápido, guarda la
            contraseña cuando Safari te lo ofrezca: luego se rellena con Face ID.
          </p>
        )}
        <p className="pie-legal">{LEGAL}</p>
      </form>
    </main>
  );
}

export function SegundoPaso({ factorId, onListo, onSalir }: {
  factorId: string; onListo: () => void; onSalir: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setError('');
    const r = await verificarMfa(factorId, codigo);
    setOcupado(false);
    if (r.error) {
      setError(r.error);
      setCodigo('');
    } else {
      onListo();
    }
  }

  return (
    <main className="acceso">
      <form className="acceso-caja" onSubmit={enviar}>
        <Marca sub="Verificación en dos pasos" />
        <div className="nota">Escribe el código de 6 dígitos de tu app autenticadora.</div>
        {error && <div className="error" role="alert">{error}</div>}
        <label className="campo">
          <span>Código</span>
          <input className="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
            value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} required autoFocus />
        </label>
        <button className="boton" type="submit" disabled={ocupado || codigo.length !== 6}>
          {ocupado ? 'Verificando…' : 'Verificar'}
        </button>
        <button className="boton secundario" type="button" onClick={onSalir}>Salir</button>
      </form>
    </main>
  );
}

export function Bloqueo({ onDesbloquear, onSalir }: { onDesbloquear: () => void; onSalir: () => void }) {
  const [mensaje, setMensaje] = useState('');

  async function intentar() {
    setMensaje('');
    const r = await desbloquear();
    if (r === 'ok') onDesbloquear();
    else if (r === 'sin-seguridad')
      setMensaje('Tu teléfono no tiene bloqueo de pantalla. Configura un PIN, huella o Face ID para usar la app.');
    else setMensaje('No se pudo verificar. Inténtalo de nuevo.');
  }

  useEffect(() => {
    void intentar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="acceso">
      <div className="acceso-caja">
        <Marca sub="App bloqueada" />
        {mensaje && <div className="error" role="alert">{mensaje}</div>}
        <button className="boton" type="button" onClick={intentar}>
          <Icono nombre="huella" /> Desbloquear
        </button>
        <button className="boton secundario" type="button" onClick={onSalir}>Cerrar sesión</button>
      </div>
    </main>
  );
}
