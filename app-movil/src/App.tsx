import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Icono, type NombreIcono } from './components/Icono';
import { Cargando, Vacio } from './components/Piezas';
import { cerrarSesion, nivelMfa, sesionCaducada } from './lib/auth';
import { activarPantallaPrivada, esAppNativa, vigilarBloqueo } from './lib/bloqueo';
import { cargarCartera, ErrorDatos, type Cartera } from './lib/datos';
import { db } from './lib/supabase';
import { Bloqueo, Login, SegundoPaso } from './screens/Acceso';
import { Ajustes } from './screens/Ajustes';
import { ClienteDetalle, Clientes } from './screens/Clientes';
import { Inicio } from './screens/Inicio';
import { PolizaDetalle, Polizas } from './screens/Polizas';
import { SiniestroDetalle, Siniestros } from './screens/Siniestros';
import { Tareas } from './screens/Tareas';
import { Mas } from './screens/Mas';
import { ProspectoDetalle, Prospectos } from './screens/Prospectos';
import { cancelarAvisos, programarAvisos } from './lib/avisos';

export type Pestana = 'inicio' | 'clientes' | 'polizas' | 'tareas' | 'mas';
export type Vista =
  | { tipo: 'cliente' | 'poliza' | 'siniestro' | 'prospecto'; id: string }
  | { tipo: 'ajustes' | 'siniestros' | 'prospectos' };
export type Abrir = (v: Vista) => void;
export type Avisar = (texto: string) => void;

type Fase =
  | { f: 'arranque' }
  | { f: 'login' }
  | { f: 'mfa'; factorId: string }
  | { f: 'bloqueada' }
  | { f: 'dentro' };

const PESTANAS: Array<[Pestana, string, NombreIcono]> = [
  ['inicio', 'Inicio', 'inicio'],
  ['clientes', 'Clientes', 'clientes'],
  ['polizas', 'Pólizas', 'polizas'],
  ['tareas', 'Tareas', 'tareas'],
  ['mas', 'Más', 'menu'],
];

export default function App() {
  const [fase, setFase] = useState<Fase>({ f: 'arranque' });
  const [correo, setCorreo] = useState('');
  const [cartera, setCartera] = useState<Cartera | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [cargando, setCargando] = useState(false);
  const [pestana, setPestana] = useState<Pestana>('inicio');
  const [pila, setPila] = useState<Vista[]>([]);
  const [aviso, setAviso] = useState('');
  const contenido = useRef<HTMLDivElement>(null);

  const temporizadorAviso = useRef(0);
  const avisar = useCallback<Avisar>((t) => {
    setAviso(t);
    window.clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = window.setTimeout(() => setAviso(''), 2500);
  }, []);

  /* Borra de memoria todo dato de clientes. */
  const olvidar = useCallback(() => {
    setCartera(null);
    setPila([]);
    setPestana('inicio');
  }, []);

  const salir = useCallback(async () => {
    olvidar();
    await cancelarAvisos();
    await cerrarSesion();
    setFase({ f: 'login' });
  }, [olvidar]);

  /* Despues de la contraseña: ¿hace falta el segundo paso? */
  const trasContrasena = useCallback(async () => {
    let m;
    try {
      m = await nivelMfa();
    } catch (e) {
      await cerrarSesion(); // no queda una sesion a medio verificar
      throw e;
    }
    if (m.requiere && m.factor) setFase({ f: 'mfa', factorId: m.factor.id });
    else setFase({ f: 'dentro' });
  }, []);

  /* Arranque en frio */
  useEffect(() => {
    void activarPantallaPrivada();
    void (async () => {
      const { data } = await db.auth.getSession();
      if (!data.session) return setFase({ f: 'login' });
      if (await sesionCaducada()) {
        await cerrarSesion();
        return setFase({ f: 'login' });
      }
      try {
        const m = await nivelMfa();
        if (m.requiere && m.factor) return setFase({ f: 'mfa', factorId: m.factor.id });
      } catch {
        await cerrarSesion();
        return setFase({ f: 'login' });
      }
      if (!esAppNativa) {
        // Version web: no hay Face ID propio de la app, asi que al reabrirla
        // siempre se pide la contraseña (el Llavero de iCloud la rellena con Face ID).
        await cerrarSesion();
        return setFase({ f: 'login' });
      }
      setFase({ f: 'bloqueada' }); // con sesion guardada siempre se pide huella / Face ID
    })();
    const { data: sub } = db.auth.onAuthStateChange((evento, sesion) => {
      setCorreo(sesion?.user.email ?? '');
      if (evento === 'SIGNED_OUT') {
        olvidar();
        setFase({ f: 'login' });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [olvidar]);

  const recargar = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      if (await sesionCaducada()) return void salir();
      const c = await cargarCartera();
      setCartera(c);
      void programarAvisos(c).catch(() => undefined);
    } catch (e) {
      setErrorCarga(e instanceof ErrorDatos ? e.message : 'No se pudieron cargar los datos.');
    } finally {
      setCargando(false);
    }
  }, [salir]);

  useEffect(() => {
    if (fase.f === 'dentro' && !cartera && !cargando) void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase.f]);

  /* Bloqueo por inactividad o por volver del segundo plano */
  useEffect(() => {
    if (fase.f !== 'dentro') return;
    // En la web "bloquear" es cerrar la sesion entera: no queda nada que robar.
    return vigilarBloqueo(() => (esAppNativa ? setFase({ f: 'bloqueada' }) : void salir()));
  }, [fase.f, salir]);

  /* Boton "atras" de Android */
  useEffect(() => {
    const h = CapApp.addListener('backButton', () => {
      if (pila.length) setPila((p) => p.slice(0, -1));
      else if (pestana !== 'inicio') setPestana('inicio');
      else void CapApp.minimizeApp();
    });
    return () => void h.then((x) => x.remove());
  }, [pila.length, pestana]);

  useEffect(() => {
    contenido.current?.scrollTo(0, 0);
  }, [pila, pestana]);

  /* ---------------- fases de acceso ---------------- */
  if (fase.f === 'arranque') return <Cargando texto="Iniciando…" />;
  if (fase.f === 'login') return <Login onEntrar={trasContrasena} />;
  if (fase.f === 'mfa')
    return <SegundoPaso factorId={fase.factorId} onListo={() => setFase({ f: 'dentro' })} onSalir={salir} />;
  if (fase.f === 'bloqueada') return <Bloqueo onDesbloquear={() => setFase({ f: 'dentro' })} onSalir={salir} />;

  /* ---------------- dentro ---------------- */
  const abrir: Abrir = (v) => setPila((p) => [...p, v]);
  const actual = pila[pila.length - 1];

  const cambiar = <K extends 'clientes' | 'siniestros' | 'tareas' | 'prospectos'>(tabla: K, id: string, c: Partial<Cartera[K][number]>) =>
    setCartera((ca) => ca && { ...ca, [tabla]: ca[tabla].map((x) => (x.id === id ? { ...x, ...c } : x)) });

  let titulo = PESTANAS.find((p) => p[0] === pestana)![1];
  let cuerpo: React.ReactNode;

  if (!cartera) {
    cuerpo = errorCarga ? (
      <Vacio>
        <p>{errorCarga}</p>
        <br />
        <button className="boton" type="button" onClick={recargar}>Reintentar</button>
      </Vacio>
    ) : (
      <Cargando texto="Cargando cartera…" />
    );
  } else if (actual?.tipo === 'ajustes') {
    titulo = 'Ajustes';
    cuerpo = <Ajustes correo={correo} cartera={cartera} onSalir={salir} avisar={avisar} />;
  } else if (actual?.tipo === 'siniestros') {
    titulo = 'Siniestros';
    cuerpo = <Siniestros cartera={cartera} abrir={abrir} />;
  } else if (actual?.tipo === 'prospectos') {
    titulo = 'Prospectos';
    cuerpo = (
      <Prospectos cartera={cartera} abrir={abrir} avisar={avisar}
        alCrear={(p) => setCartera((ca) => ca && { ...ca, prospectos: [p, ...ca.prospectos] })} />
    );
  } else if (actual?.tipo === 'prospecto') {
    const p = cartera.prospectos.find((x) => x.id === actual.id);
    titulo = p?.nombre || 'Prospecto';
    cuerpo = p ? (
      <ProspectoDetalle prospecto={p} avisar={avisar} alCambiar={(cb) => cambiar('prospectos', p.id, cb)} />
    ) : <Vacio>Este prospecto ya no existe.</Vacio>;
  } else if (actual?.tipo === 'cliente') {
    const c = cartera.clientes.find((x) => x.id === actual.id);
    titulo = c?.nombre || 'Cliente';
    cuerpo = c ? (
      <ClienteDetalle cliente={c} cartera={cartera} abrir={abrir} avisar={avisar}
        alCambiar={(cb) => cambiar('clientes', c.id, cb)} />
    ) : <Vacio>Este cliente ya no existe.</Vacio>;
  } else if (actual?.tipo === 'poliza') {
    const p = cartera.polizas.find((x) => x.id === actual.id);
    titulo = p ? `Póliza ${p.num ?? ''}` : 'Póliza';
    cuerpo = p ? (
      <PolizaDetalle poliza={p} cartera={cartera} abrir={abrir} avisar={avisar}
        alPagar={(pg) => setCartera((ca) => ca && { ...ca, pagos: [pg, ...ca.pagos] })} />
    ) : <Vacio>Esta póliza ya no existe.</Vacio>;
  } else if (actual?.tipo === 'siniestro') {
    const s = cartera.siniestros.find((x) => x.id === actual.id);
    titulo = 'Siniestro';
    cuerpo = s ? (
      <SiniestroDetalle siniestro={s} cartera={cartera} abrir={abrir} avisar={avisar}
        alCambiar={(cb) => cambiar('siniestros', s.id, cb)} />
    ) : <Vacio>Este siniestro ya no existe.</Vacio>;
  } else if (pestana === 'inicio') {
    cuerpo = <Inicio cartera={cartera} abrir={abrir} irA={setPestana} />;
  } else if (pestana === 'clientes') {
    cuerpo = <Clientes cartera={cartera} abrir={abrir} />;
  } else if (pestana === 'polizas') {
    cuerpo = <Polizas cartera={cartera} abrir={abrir} />;
  } else if (pestana === 'mas') {
    cuerpo = <Mas cartera={cartera} abrir={abrir} />;
  } else {
    cuerpo = (
      <Tareas cartera={cartera} avisar={avisar}
        alCrear={(t) => setCartera((ca) => ca && { ...ca, tareas: [t, ...ca.tareas] })}
        alCambiar={(id, c) => cambiar('tareas', id, c)} />
    );
  }

  return (
    <div className="marco">
      <header className="cabecera">
        {actual && (
          <button type="button" aria-label="Atrás" onClick={() => setPila((p) => p.slice(0, -1))}>
            <Icono nombre="atras" />
          </button>
        )}
        <h2>{titulo}</h2>
        {!actual && (
          <>
            <button type="button" aria-label="Actualizar" onClick={recargar} disabled={cargando}>
              <Icono nombre="recargar" />
            </button>
          </>
        )}
      </header>
      <div className="contenido" ref={contenido}>{cuerpo}</div>
      <nav className="pestanas">
        {PESTANAS.map(([k, t, i]) => (
          <button key={k} type="button" className={!actual && pestana === k ? 'activa' : ''}
            onClick={() => { setPila([]); setPestana(k); }}>
            <Icono nombre={i} />
            {t}
          </button>
        ))}
      </nav>
      {aviso && <div className="aviso-flotante" role="status">{aviso}</div>}
    </div>
  );
}
