import type { Factor } from '@supabase/supabase-js';
import { SEGURIDAD } from './config';
import { almacenSeguro } from './secureStore';
import { db } from './supabase';

const CLAVE_INICIO = 'inicio_sesion';
const CLAVE_FALLOS = 'fallos_login';

type Fallos = { cuantos: number; hasta: number };

async function leerFallos(): Promise<Fallos> {
  try {
    const raw = await almacenSeguro.getItem(CLAVE_FALLOS);
    const f = raw ? (JSON.parse(raw) as Fallos) : null;
    return f && typeof f.cuantos === 'number' ? f : { cuantos: 0, hasta: 0 };
  } catch {
    return { cuantos: 0, hasta: 0 };
  }
}

/** Segundos que faltan para poder volver a intentar (0 = puede ya). */
export async function esperaParaIntentar(): Promise<number> {
  const f = await leerFallos();
  return Math.max(0, Math.ceil((f.hasta - Date.now()) / 1000));
}

/*
 * Inicio de sesion con correo y contraseña.
 * Tras varios fallos seguidos se impone una espera que crece (30 s, 60 s,
 * 2 min... hasta 15 min). Supabase tiene ademas su propio limite en el
 * servidor; esto evita que alguien con el telefono en la mano pruebe
 * contraseñas a mano sin freno.
 */
export async function iniciarSesion(correo: string, clave: string): Promise<{ error?: string }> {
  const espera = await esperaParaIntentar();
  if (espera > 0) return { error: `Demasiados intentos. Espera ${espera} s.` };

  const { error } = await db.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password: clave });
  if (error) {
    const f = await leerFallos();
    const cuantos = f.cuantos + 1;
    const exceso = cuantos - SEGURIDAD.intentosAntesDeEsperar;
    const hasta = exceso >= 0 ? Date.now() + Math.min(30_000 * 2 ** exceso, 15 * 60_000) : 0;
    await almacenSeguro.setItem(CLAVE_FALLOS, JSON.stringify({ cuantos, hasta }));
    // Mensaje generico: no revela si el correo existe.
    return { error: 'Correo o contraseña incorrectos.' };
  }
  await almacenSeguro.removeItem(CLAVE_FALLOS);
  await almacenSeguro.setItem(CLAVE_INICIO, String(Date.now()));
  return {};
}

/** Cierra sesion y borra todo rastro local (token, marcas, cache). */
export async function cerrarSesion(): Promise<void> {
  try {
    await db.auth.signOut({ scope: 'local' });
  } catch {
    /* sin red igual se borra lo local */
  }
  await almacenSeguro.limpiarTodo();
}

/** true si la sesion supero la duracion maxima y hay que pedir contraseña otra vez. */
export async function sesionCaducada(): Promise<boolean> {
  const raw = await almacenSeguro.getItem(CLAVE_INICIO);
  const t = raw ? Number(raw) : NaN;
  return !isFinite(t) || Date.now() - t > SEGURIDAD.duracionMaximaSesion;
}

/* ---------------- Verificacion en dos pasos (TOTP) ---------------- */

export type NivelMfa = { requiere: boolean; factor?: Factor };

/** ¿El usuario tiene 2 pasos activado y todavia no lo verifico en esta sesion? */
export async function nivelMfa(): Promise<NivelMfa> {
  const { data, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) throw new Error('No se pudo comprobar la verificación en dos pasos');
  if (data.nextLevel === 'aal2' && data.currentLevel !== 'aal2') {
    const lista = await db.auth.mfa.listFactors();
    const factor = lista.data?.totp.find((f) => f.status === 'verified');
    return { requiere: !!factor, factor };
  }
  return { requiere: false };
}

export async function verificarMfa(factorId: string, codigo: string): Promise<{ error?: string }> {
  const { error } = await db.auth.mfa.challengeAndVerify({ factorId, code: codigo.replace(/\D/g, '') });
  return error ? { error: 'Código incorrecto o vencido.' } : {};
}

export async function factoresMfa(): Promise<Factor[]> {
  const { data } = await db.auth.mfa.listFactors();
  return data?.totp.filter((f) => f.status === 'verified') ?? [];
}

export async function iniciarAltaMfa(): Promise<
  { error: string } | { factorId: string; secreto: string; qr: string }
> {
  // Limpia altas a medias que hayan quedado sin verificar.
  const previos = await db.auth.mfa.listFactors();
  for (const f of previos.data?.all ?? []) {
    if (f.factor_type === 'totp' && f.status === 'unverified') await db.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'JAC App ' + Date.now() });
  if (error || !data) return { error: 'No se pudo activar. Revisa que la verificación en dos pasos esté habilitada en Supabase.' };
  return { factorId: data.id, secreto: data.totp.secret, qr: data.totp.qr_code };
}

export async function desactivarMfa(factorId: string): Promise<{ error?: string }> {
  const { error } = await db.auth.mfa.unenroll({ factorId });
  return error ? { error: 'Para desactivarlo primero verifica tu código de dos pasos.' } : {};
}

export async function cambiarClave(nueva: string): Promise<{ error?: string }> {
  const motivo = validarClave(nueva);
  if (motivo) return { error: motivo };
  const { error } = await db.auth.updateUser({ password: nueva });
  return error ? { error: error.message } : {};
}

export function validarClave(c: string): string | null {
  if (c.length < 12) return 'Mínimo 12 caracteres.';
  if (!/[a-z]/.test(c) || !/[A-Z]/.test(c) || !/\d/.test(c)) return 'Usa mayúsculas, minúsculas y números.';
  return null;
}
