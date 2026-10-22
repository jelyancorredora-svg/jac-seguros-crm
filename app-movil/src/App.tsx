import { useCallback, useEffect, useRef, useState } from 'react';
import { ComisionesWeb } from './screens/web/Comisiones';
import { Configuracion } from './screens/web/Configuracion';
import { Cotizador } from './screens/web/Cotizador';
import { Cumpleanos } from './screens/web/Cumpleanos';
import { retornoGcal, vueltaDeGoogleReciente } from './lib/gcal';
import { Empresas } from './screens/web/Empresas';
import { Notas } from './screens/web/Notas';
import { Reportes } from './screens/web/Reportes';
import { WaMasivo } from './screens/web/WaMasivo';
import { App as CapApp } from '@capacitor/app';
import { Icono, type NombreIcono } from './components/Icono';
import { Cargando, Vacio } from './components/Piezas';
import { cerrarSesion, nivelMfa, sesionCaducada } from './lib/auth';
import { cancelarAvisos, programarAvisos } from './lib/avisos';
import { activarPantallaPrivada, esAppNativa, vigilarBloqueo } from './lib/bloqueo';
import { cargarCartera, ErrorDatos, txt, type Cartera, type Reg } from './lib/datos';
import type { Modulo } from './lib/esquema';
import { db } from './lib/supabase';
import { iniciarVivo, type EstadoVivo } from './lib/vivo';
import { Bloqueo, Login, SegundoPaso } from './screens/Acceso';
import { Agenda, EditarTarea } from './screens/Agenda';
import { Ajustes } from './screens/Ajustes';
import { Crm } from './screens/Crm';
import { Importar } from './screens/Importar';
import { Informes } from './screens/Informes';
import { Inicio } from './screens/Inicio';
import { Mas } from './screens/Mas';
import { Mensajero } from './screens/Mensajero';
import { Portafolio } from './screens/Portafolio';
import {
  ClienteFicha, Clientes, ComisionFicha, PagoFicha, Pagos, PolizaFicha, Polizas, ProspectoFicha, Prospectos,
  SiniestroFicha, Siniestros, VehiculoFicha, Vehiculos, type Ctx,
} from './screens/Modulos';

export type Pestana = 'inicio' | 'clientes' | 'polizas' | 'crm' | 'agenda' | 'mas';
/* Modulos del CRM web replicados en la app (menu Mas) */
export const PANTALLAS_WEB = {
  empresas: ['Empresas y colectivos', Empresas],
  wamasivo: ['WhatsApp masivo', WaMasivo],
  cotizador: ['Cotizador', Cotizador],
  notas: ['Notas y recordatorios', Notas],
  reportes: ['Reportes', Reportes],
  cumpleanos: ['Cumpleaños', Cumpleanos],
  config: ['Configuración del CRM', Configuracion],
} as const;
export type PantallaWeb = keyof typeof PANTALLAS_WEB;

export type Vista = { t: 'ficha'; m: Modulo; id: string } | { t: 'lista'; m: Modulo } | { t: 'ajustes' } | { t: 'importar' } | { t: 'informes' } | { t: 'mensajero' } | { t: 'portafolio' } | { t: 'web'; p: PantallaWeb };
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
  ['crm', 'CRM', 'embudo'],
  ['agenda', 'Agenda', 'tareas'],
  ['mas', 'Más', 'menu'],
];

const NOMBRE_LISTA: Record<Modulo, string> = {
  clientes: 'Clientes', polizas: 'Pólizas', siniestros: 'Siniestros', vehiculos: 'Autos / motos', pagos: 'Pagos',
  prospectos: 'Prospectos', comisiones: 'Comisiones', tareas: 'Tareas',
};

export default function App() {
  const [fase, setFase] = useState<Fase>({ f: 'arranque' });
  const [correo, setCorreo] = useState('');
  const [cartera, setCartera] = useState<Cartera | null>(null);
  const [errorCarga, setErrorCarga] = useState('');
  const [cargando, setCargando] = useState(false);
  const [pestana, setPestana] = useState<Pestana>('inicio');
  const [pila, setPila] = useState<Vista[]>([]);
  const [aviso, setAviso] = useState('');
  const [vivo, setVivo] = useState<EstadoVivo>('conectando');
  const hayCartera = cartera !== null;
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
      if (!esAppNativa && vueltaDeGoogleReciente()) return setFase({ f: 'dentro' });
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

  /* Vuelta desde Google: abrir Configuración, donde se sincroniza el calendario */
  useEffect(() => {
    if (fase.f !== 'dentro' || !cartera || !retornoGcal.v) return;
    if (retornoGcal.v === 'rechazado') { avisar('No se pudo conectar con Google Calendar.'); retornoGcal.v = null; }
    setPestana('mas');
    setPila([{ t: 'web', p: 'config' }]);
  }, [fase.f, cartera, avisar]);

  /* Sincronizacion en vivo con el CRM web y los demas dispositivos */
  useEffect(() => {
    if (fase.f !== 'dentro' || !hayCartera) return;
    return iniciarVivo((cb) => {
      setCartera((c) => {
        if (!c) return c;
        const n = { ...c } as Cartera;
        for (const { m, r } of cb.filas) {
          const l = n[m];
          const i = l.findIndex((x) => x.id === r.id);
          n[m] = i >= 0 ? l.map((x) => (x.id === r.id ? r : x)) : [r, ...l];
        }
        for (const { m, id } of cb.borrados) n[m] = n[m].filter((x) => x.id !== id);
        if (cb.meta) n.meta = cb.meta;
        return n;
      });
    }, setVivo);
  }, [fase.f, hayCartera]);

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
  const ir = (v: Vista) => setPila((p) => [...p, v]);
  const actual = pila[pila.length - 1];

  const ctx: Ctx | null = cartera && {
    cartera,
    avisar,
    abrir: (m, id) => ir({ t: 'ficha', m, id }),
    poner: (m, r) => setCartera((c) => {
      if (!c) return c;
      const lista = c[m];
      const i = lista.findIndex((x) => x.id === r.id);
      return { ...c, [m]: i >= 0 ? lista.map((x) => (x.id === r.id ? r : x)) : [r, ...lista] };
    }),
    quitar: (m, id) => setCartera((c) => c && { ...c, [m]: c[m].filter((x) => x.id !== id) }),
    volver: () => setPila((p) => p.slice(0, -1)),
    ponerMeta: (k, v) => setCartera((c) => c && { ...c, meta: { ...c.meta, [k]: v } }),
  };

  let titulo = PESTANAS.find((p) => p[0] === pestana)![1];
  let cuerpo: React.ReactNode;

  if (!ctx) {
    cuerpo = errorCarga ? (
      <Vacio>
        <p>{errorCarga}</p>
        <br />
        <button className="boton" type="button" onClick={recargar}>Reintentar</button>
      </Vacio>
    ) : (
      <Cargando texto="Cargando cartera…" />
    );
  } else if (actual?.t === 'ajustes') {
    titulo = 'Ajustes';
    cuerpo = <Ajustes correo={correo} cartera={ctx.cartera} onSalir={salir} avisar={avisar} />;
  } else if (actual?.t === 'mensajero') {
    titulo = 'Mensajero';
    cuerpo = <Mensajero ctx={ctx} />;
  } else if (actual?.t === 'portafolio') {
    titulo = 'Portafolio por ramo';
    cuerpo = <Portafolio ctx={ctx} />;
  } else if (actual?.t === 'web') {
    const [t, P] = PANTALLAS_WEB[actual.p];
    titulo = t;
    cuerpo = <P ctx={ctx} />;
  } else if (actual?.t === 'informes') {
    titulo = 'Informes';
    cuerpo = <Informes ctx={ctx} />;
  } else if (actual?.t === 'importar') {
    titulo = 'Importar documentos';
    cuerpo = <Importar ctx={ctx} />;
  } else if (actual?.t === 'lista') {
    titulo = NOMBRE_LISTA[actual.m];
    const L = { siniestros: Siniestros, prospectos: Prospectos, pagos: Pagos, vehiculos: Vehiculos, comisiones: ComisionesWeb,
      clientes: Clientes, polizas: Polizas, tareas: Agenda }[actual.m];
    cuerpo = <L ctx={ctx} />;
  } else if (actual?.t === 'ficha') {
    const r: Reg | undefined = ctx.cartera[actual.m].find((x) => x.id === actual.id);
    if (!r) {
      cuerpo = <Vacio>Este registro ya no existe.</Vacio>;
    } else if (actual.m === 'clientes') {
      titulo = txt(r, 'nombre') || 'Cliente';
      cuerpo = <ClienteFicha ctx={ctx} c={r} />;
    } else if (actual.m === 'polizas') {
      titulo = `Póliza ${txt(r, 'num')}`;
      cuerpo = <PolizaFicha ctx={ctx} p={r} />;
    } else if (actual.m === 'siniestros') {
      titulo = txt(r, 'nombre') || 'Siniestro';
      cuerpo = <SiniestroFicha ctx={ctx} s={r} />;
    } else if (actual.m === 'vehiculos') {
      titulo = txt(r, 'placa') || 'Vehículo';
      cuerpo = <VehiculoFicha ctx={ctx} v={r} />;
    } else if (actual.m === 'pagos') {
      titulo = 'Pago';
      cuerpo = <PagoFicha ctx={ctx} p={r} />;
    } else if (actual.m === 'comisiones') {
      titulo = 'Comisión';
      cuerpo = <ComisionFicha ctx={ctx} c={r} />;
    } else if (actual.m === 'prospectos') {
      titulo = txt(r, 'nombre') || 'Prospecto';
      cuerpo = <ProspectoFicha ctx={ctx} p={r} />;
    } else {
      titulo = 'Agenda';
      cuerpo = (
        <>
          <Agenda ctx={ctx} />
          <EditarTarea ctx={ctx} r={r} fecha={txt(r, 'fechaLimite')} onCerrar={() => setPila((p) => p.slice(0, -1))} />
        </>
      );
    }
  } else if (pestana === 'inicio') {
    cuerpo = <Inicio ctx={ctx} irA={setPestana} irLista={(m) => ir({ t: 'lista', m })} irInformes={() => ir({ t: 'informes' })} irWeb={(p) => ir({ t: 'web', p })} />;
  } else if (pestana === 'clientes') {
    cuerpo = <Clientes ctx={ctx} />;
  } else if (pestana === 'polizas') {
    cuerpo = <Polizas ctx={ctx} />;
  } else if (pestana === 'crm') {
    titulo = 'CRM';
    cuerpo = <Crm ctx={ctx} />;
  } else if (pestana === 'agenda') {
    cuerpo = <Agenda ctx={ctx} />;
  } else {
    cuerpo = <Mas ctx={ctx} irLista={(m) => ir({ t: 'lista', m })} irAjustes={() => ir({ t: 'ajustes' })} irImportar={() => ir({ t: 'importar' })} irInformes={() => ir({ t: 'informes' })}
      irMensajero={() => ir({ t: 'mensajero' })} irPortafolio={() => ir({ t: 'portafolio' })} irWeb={(p) => ir({ t: 'web', p })} />;
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
        {ctx && (
          <span className={`vivo vivo-${vivo}`} role="status"
            aria-label={vivo === 'en-vivo' ? 'Sincronizado en vivo' : vivo === 'sin-conexion' ? 'Sin conexión' : 'Sincronizando'}
            title={vivo === 'en-vivo' ? 'Sincronizado en vivo' : vivo === 'sin-conexion' ? 'Sin conexión' : 'Sincronizando cada 45 s'} />
        )}
        <button type="button" aria-label="Actualizar" onClick={recargar} disabled={cargando} className={cargando ? 'girando' : ''}>
          <Icono nombre="recargar" />
        </button>
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
