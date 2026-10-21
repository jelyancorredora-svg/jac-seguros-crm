import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryError, BiometryErrorType } from '@aparajita/capacitor-biometric-auth';
import { PrivacyScreen } from '@capacitor-community/privacy-screen';
import { SEGURIDAD } from './config';

const nativo = Capacitor.isNativePlatform();

/*
 * Pantalla privada: en Android bloquea capturas y grabacion de pantalla
 * (FLAG_SECURE); en iOS tapa el contenido en el selector de apps.
 */
export async function activarPantallaPrivada(): Promise<void> {
  if (!nativo) return;
  try {
    await PrivacyScreen.enable();
  } catch {
    /* sin el plugin la app sigue funcionando */
  }
}

export type EstadoBiometria = { disponible: boolean; dispositivoSeguro: boolean; tipo: string };

export async function estadoBiometria(): Promise<EstadoBiometria> {
  if (!nativo) return { disponible: false, dispositivoSeguro: false, tipo: 'ninguna' };
  const r = await BiometricAuth.checkBiometry();
  const nombres: Record<number, string> = { 1: 'Touch ID', 2: 'Face ID', 3: 'huella', 4: 'rostro', 5: 'iris' };
  return {
    disponible: r.isAvailable,
    dispositivoSeguro: r.deviceIsSecure,
    tipo: nombres[r.biometryType] ?? 'PIN del teléfono',
  };
}

/**
 * Pide huella / Face ID, o el PIN del telefono como respaldo.
 * Devuelve 'ok', 'cancelado' o 'sin-seguridad' (el telefono no tiene
 * bloqueo de pantalla configurado: no se permite usar la app asi).
 */
export async function desbloquear(): Promise<'ok' | 'cancelado' | 'sin-seguridad'> {
  if (!nativo) return 'ok'; // navegador de desarrollo
  const e = await estadoBiometria();
  if (!e.disponible && !e.dispositivoSeguro) return 'sin-seguridad';
  try {
    await BiometricAuth.authenticate({
      reason: 'Desbloquea JAC Seguros',
      cancelTitle: 'Cancelar',
      allowDeviceCredential: true,
      iosFallbackTitle: 'Usar código',
      androidTitle: 'JAC Seguros',
      androidSubtitle: 'Confirma que eres tú',
      androidConfirmationRequired: false,
    });
    return 'ok';
  } catch (err) {
    if (
      err instanceof BiometryError &&
      (err.code === BiometryErrorType.passcodeNotSet || err.code === BiometryErrorType.noDeviceCredential)
    ) {
      return 'sin-seguridad';
    }
    return 'cancelado';
  }
}

/*
 * Vigilante de bloqueo: avisa cuando hay que bloquear porque la app
 * estuvo en segundo plano demasiado tiempo o nadie la toco en un rato.
 */
export function vigilarBloqueo(bloquear: () => void): () => void {
  let enFondoDesde = 0;
  let temporizador = 0;

  const reiniciar = () => {
    window.clearTimeout(temporizador);
    temporizador = window.setTimeout(bloquear, SEGURIDAD.bloqueoPorInactividad);
  };
  const eventos = ['pointerdown', 'keydown', 'touchstart'] as const;
  eventos.forEach((ev) => window.addEventListener(ev, reiniciar, { passive: true }));
  reiniciar();

  const escucha = App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) {
      enFondoDesde = Date.now();
      window.clearTimeout(temporizador);
    } else {
      if (enFondoDesde && Date.now() - enFondoDesde > SEGURIDAD.bloqueoEnSegundoPlano) bloquear();
      enFondoDesde = 0;
      reiniciar();
    }
  });

  return () => {
    window.clearTimeout(temporizador);
    eventos.forEach((ev) => window.removeEventListener(ev, reiniciar));
    void escucha.then((h) => h.remove());
  };
}
