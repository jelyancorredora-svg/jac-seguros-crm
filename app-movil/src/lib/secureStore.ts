import { Capacitor } from '@capacitor/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';

/*
 * Almacen cifrado para la sesion de Supabase.
 * En el telefono va al Keychain (iOS) o al Keystore (Android): el token
 * nunca queda en localStorage ni en un archivo legible.
 * Solo en el navegador de desarrollo cae a sessionStorage, que se borra
 * al cerrar la pestaña.
 */
const nativo = Capacitor.isNativePlatform();
let listo: Promise<void> | null = null;

function preparar(): Promise<void> {
  if (!listo) {
    listo = nativo
      ? SecureStorage.setKeyPrefix('jac_').then(() => SecureStorage.setSynchronize(false))
      : Promise.resolve();
  }
  return listo;
}

export const almacenSeguro = {
  async getItem(clave: string): Promise<string | null> {
    if (!nativo) return sessionStorage.getItem(clave);
    await preparar();
    const v = await SecureStorage.get(clave, false, false);
    return typeof v === 'string' ? v : v == null ? null : JSON.stringify(v);
  },
  async setItem(clave: string, valor: string): Promise<void> {
    if (!nativo) return sessionStorage.setItem(clave, valor);
    await preparar();
    await SecureStorage.set(clave, valor, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
  },
  async removeItem(clave: string): Promise<void> {
    if (!nativo) return sessionStorage.removeItem(clave);
    await preparar();
    await SecureStorage.remove(clave, false);
  },
  async limpiarTodo(): Promise<void> {
    if (!nativo) return sessionStorage.clear();
    await preparar();
    await SecureStorage.clear(false);
  },
};
