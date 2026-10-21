function requerida(nombre: string, valor: string | undefined): string {
  if (!valor) throw new Error(`Falta la variable ${nombre} en .env`);
  return valor;
}

export const SUPABASE_URL = requerida('VITE_SUPABASE_URL', import.meta.env.VITE_SUPABASE_URL);
export const SUPABASE_KEY = requerida('VITE_SUPABASE_KEY', import.meta.env.VITE_SUPABASE_KEY);

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(SUPABASE_URL)) {
  throw new Error('VITE_SUPABASE_URL debe ser https://<proyecto>.supabase.co');
}

/* Tiempos de seguridad (milisegundos). */
export const SEGURIDAD = {
  /** Si la app pasa este tiempo en segundo plano, se pide huella/Face ID al volver. */
  bloqueoEnSegundoPlano: 30_000,
  /** Sin tocar la pantalla este tiempo, la app se bloquea sola. */
  bloqueoPorInactividad: 5 * 60_000,
  /** Pasado este tiempo desde el inicio de sesion, hay que volver a poner la contraseña. */
  duracionMaximaSesion: 12 * 60 * 60_000,
  /** Intentos de contraseña fallidos antes de esperar. */
  intentosAntesDeEsperar: 3,
} as const;
