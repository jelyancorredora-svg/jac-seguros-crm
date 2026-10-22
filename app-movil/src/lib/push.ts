import { Capacitor } from '@capacitor/core';
import { SUPABASE_URL } from './config';
import { db } from './supabase';

/*
 * Notificaciones con la app cerrada (Web Push).
 * El servidor (funcion "avisos" de Supabase) las envia cifradas; Apple/Google
 * solo las transportan. En iPhone requiere la app agregada a la pantalla de
 * inicio (iOS 16.4 o superior).
 */

const VAPID = import.meta.env.VITE_VAPID_PUBLIC as string | undefined;

export type EstadoPush = 'no-soportado' | 'instalar' | 'bloqueado' | 'apagado' | 'activo';

function clave(b64: string): Uint8Array {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const b64url = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '';

const enPantallaInicio = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function pushSoportado(): boolean {
  return !Capacitor.isNativePlatform() && !!VAPID && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registro(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('./sw.js', { scope: './' });
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!pushSoportado()) {
    return /iPhone|iPad/.test(navigator.userAgent) && !enPantallaInicio() ? 'instalar' : 'no-soportado';
  }
  if (Notification.permission === 'denied') return 'bloqueado';
  const reg = await navigator.serviceWorker.getRegistration('./');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'activo' : 'apagado';
}

/** Pide permiso, suscribe este dispositivo y lo guarda en la base. Llamar desde un toque. */
export async function activarPush(): Promise<EstadoPush> {
  if (!pushSoportado()) return estadoPush();
  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return permiso === 'denied' ? 'bloqueado' : 'apagado';
  const reg = await registro();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave(VAPID!) as BufferSource });
  const { error } = await db.from('push_suscripciones').upsert({
    endpoint: sub.endpoint,
    p256dh: b64url(sub.getKey('p256dh')),
    auth: b64url(sub.getKey('auth')),
    dispositivo: /iPhone/.test(navigator.userAgent) ? 'iPhone' : /iPad/.test(navigator.userAgent) ? 'iPad' : /Android/.test(navigator.userAgent) ? 'Android' : /Mac/.test(navigator.userAgent) ? 'Mac' : 'Computadora',
    ultimo_uso: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
  if (error) throw new Error('No se pudo registrar este dispositivo. ¿Ya se corrió el paso de Supabase?');
  return 'activo';
}

export async function desactivarPush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration('./');
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await db.from('push_suscripciones').delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
  }
}

/** Pide al servidor una notificacion de prueba para este usuario. */
export async function probarPush(): Promise<string> {
  const { data } = await db.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Tu sesión venció.');
  const r = await fetch(`${SUPABASE_URL}/functions/v1/avisos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ modo: 'prueba' }),
  });
  if (r.status === 404) throw new Error('Falta crear la función "avisos" en Supabase (paso 2 de la guía).');
  if (!r.ok) throw new Error('El servidor no pudo enviar la prueba.');
  const j = (await r.json()) as { enviados?: number };
  return j.enviados ? `Enviada a ${j.enviados} dispositivo(s)` : 'No hay dispositivos activos';
}
