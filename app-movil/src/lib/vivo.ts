import type { RealtimeChannel } from '@supabase/supabase-js';
import { leerFilas, leerMeta, leerVersiones, TABLA, versiones, type Meta, type Reg } from './datos';
import type { Modulo } from './esquema';
import { db } from './supabase';

/*
 * Sincronizacion en vivo con el CRM web y con los demas dispositivos.
 *
 * 1. Realtime: la base avisa al instante cuando algo cambia (en el web, en
 *    otro telefono o en otra computadora) y la app trae ese cambio.
 * 2. Red de seguridad: si Realtime no esta disponible o el aviso se pierde,
 *    cada 45 s (y al volver a la app) se compara la version de cada fila
 *    con la base y se trae solo lo nuevo, lo cambiado y lo borrado.
 *
 * Igual que el CRM web, que usa el mismo mecanismo (canal + vigilante de 45 s).
 */

export type Cambios = {
  filas: Array<{ m: Modulo; r: Reg }>;
  borrados: Array<{ m: Modulo; id: string }>;
  meta: Meta | null;
};
export type EstadoVivo = 'conectando' | 'en-vivo' | 'revisando' | 'sin-conexion';

const MODULOS = Object.keys(TABLA) as Modulo[];

/** Compara este dispositivo con la base y devuelve lo que hay que aplicar. */
export async function revisarCambios(): Promise<Cambios> {
  const out: Cambios = { filas: [], borrados: [], meta: null };
  for (const m of MODULOS) {
    const tabla = TABLA[m];
    const remoto = await leerVersiones(tabla);
    if (!remoto) continue; // lectura fallida: no se borra nada por error
    const local = versiones.get(tabla) ?? new Map<string, string>();
    const traer: string[] = [];
    for (const [id, v] of remoto) if (local.get(id) !== v) traer.push(id);
    for (const id of local.keys()) if (!remoto.has(id)) out.borrados.push({ m, id });
    if (traer.length) {
      for (const { r, v } of await leerFilas(tabla, traer)) {
        out.filas.push({ m, r });
        local.set(r.id, v);
      }
    }
    for (const b of out.borrados) if (b.m === m) local.delete(b.id);
    versiones.set(tabla, local);
  }
  try {
    out.meta = await leerMeta();
  } catch {
    out.meta = null;
  }
  return out;
}

/**
 * Arranca la sincronizacion. `aplicar` recibe los cambios; `estado` informa
 * si hay conexion en vivo. Devuelve la funcion para detenerla.
 */
export function iniciarVivo(aplicar: (c: Cambios) => void, estado: (e: EstadoVivo) => void): () => void {
  let canal: RealtimeChannel | null = null;
  let pendiente = 0;
  let enCurso = false;
  let otraVez = false;
  let detenido = false;
  let reintento = 0;

  async function revisar() {
    if (detenido) return;
    if (enCurso) { otraVez = true; return; }
    enCurso = true;
    try {
      const c = await revisarCambios();
      if (!detenido && (c.filas.length || c.borrados.length || c.meta)) aplicar(c);
    } catch {
      /* sin red: se reintenta en la proxima vuelta */
    } finally {
      enCurso = false;
      if (otraVez && !detenido) { otraVez = false; programar(800); }
    }
  }

  function programar(ms = 1200) {
    window.clearTimeout(pendiente);
    pendiente = window.setTimeout(() => void revisar(), ms);
  }

  function conectar() {
    if (canal || detenido) return;
    estado('conectando');
    canal = db.channel('jac_app_vivo');
    for (const t of [...Object.values(TABLA), 'crm_meta']) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => programar());
    }
    canal.subscribe((s) => {
      if (s === 'SUBSCRIBED') { estado('en-vivo'); reintento = 0; programar(300); }
      if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        estado('revisando');
        const c = canal;
        canal = null;
        if (c) void db.removeChannel(c);
        if (!detenido) window.setTimeout(conectar, Math.min(60_000, 5_000 * 2 ** reintento++));
      }
    });
  }

  const vigilante = window.setInterval(() => {
    if (document.visibilityState === 'visible') void revisar();
  }, 45_000);
  const alVolver = () => {
    if (document.visibilityState === 'visible') { conectar(); programar(300); }
  };
  const enLinea = () => { estado(canal ? 'en-vivo' : 'revisando'); conectar(); programar(300); };
  const sinLinea = () => estado('sin-conexion');
  document.addEventListener('visibilitychange', alVolver);
  window.addEventListener('online', enLinea);
  window.addEventListener('offline', sinLinea);
  conectar();

  return () => {
    detenido = true;
    window.clearTimeout(pendiente);
    window.clearInterval(vigilante);
    document.removeEventListener('visibilitychange', alVolver);
    window.removeEventListener('online', enLinea);
    window.removeEventListener('offline', sinLinea);
    if (canal) void db.removeChannel(canal);
    canal = null;
  };
}
