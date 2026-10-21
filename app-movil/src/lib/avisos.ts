import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Cartera } from './datos';
import { almacenSeguro } from './secureStore';
import { resumenDelDia, textoAviso } from './resumen';

export { resumenDelDia, textoAviso };

/*
 * Avisos diarios a las 8:00 con lo que hay que atender ese dia.
 *
 * Se arman en el telefono con los datos de la ultima carga: no hace falta
 * servidor ni cuenta de notificaciones. Por privacidad, el texto solo lleva
 * CANTIDADES, nunca nombres: el aviso se ve en la pantalla bloqueada.
 */

const nativo = Capacitor.isNativePlatform();
const CLAVE = 'avisos_activos';
const PRIMER_ID = 7000;
const DIAS = 14;
const HORA = 8;


export async function avisosActivos(): Promise<boolean> {
  return (await almacenSeguro.getItem(CLAVE)) === '1';
}

export async function activarAvisos(): Promise<'ok' | 'denegado' | 'no-disponible'> {
  if (!nativo) return 'no-disponible';
  let permiso = await LocalNotifications.checkPermissions();
  if (permiso.display !== 'granted') permiso = await LocalNotifications.requestPermissions();
  if (permiso.display !== 'granted') return 'denegado';
  await almacenSeguro.setItem(CLAVE, '1');
  return 'ok';
}

export async function desactivarAvisos(): Promise<void> {
  await almacenSeguro.removeItem(CLAVE);
  await cancelarAvisos();
}

export async function cancelarAvisos(): Promise<void> {
  if (!nativo) return;
  try {
    const ids = Array.from({ length: DIAS }, (_, i) => ({ id: PRIMER_ID + i }));
    await LocalNotifications.cancel({ notifications: ids });
  } catch {
    /* nada pendiente */
  }
}

/** Reprograma los avisos de los proximos dias con los datos recien cargados. */
export async function programarAvisos(c: Cartera): Promise<void> {
  if (!nativo || !(await avisosActivos())) return;
  await cancelarAvisos();
  const ahora = new Date();
  const lista = [];
  for (let i = 0; i < DIAS; i++) {
    const cuando = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + i, HORA, 0, 0);
    if (cuando.getTime() <= ahora.getTime()) continue;
    const texto = textoAviso(resumenDelDia(c, i, ahora));
    if (!texto) continue;
    lista.push({
      id: PRIMER_ID + i,
      title: 'JAC Seguros · pendientes de hoy',
      body: texto,
      schedule: { at: cuando, allowWhileIdle: true },
      channelId: 'pendientes',
    });
  }
  if (!lista.length) return;
  if (Capacitor.getPlatform() === 'android') {
    await LocalNotifications.createChannel({
      id: 'pendientes', name: 'Pendientes del día', importance: 4, visibility: 0,
    });
  }
  await LocalNotifications.schedule({ notifications: lista });
}
