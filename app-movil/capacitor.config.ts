import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.jacsegurospa.app',
  appName: 'JAC Seguros',
  webDir: 'dist',
  // Nada de servidor remoto: la app viaja empaquetada dentro del binario.
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: 'never',
    webContentsDebuggingEnabled: false,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    PrivacyScreen: { enable: true },
  },
};

export default config;
