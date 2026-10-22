import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

/*
 * Politica de seguridad de contenido. Solo se inserta en la compilacion
 * (en desarrollo Vite inyecta estilos en linea y la politica los romperia).
 * La app solo puede hablar con su propio origen y con Supabase.
 */
function csp(supabaseUrl: string): Plugin {
  const politica = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabaseUrl} ${supabaseUrl.replace('.supabase.co', '.storage.supabase.co')} ${supabaseUrl.replace(/^https:/, 'wss:')} https://api.emailjs.com https://www.googleapis.com`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-src 'none'",
    "worker-src 'self'",
    "manifest-src 'self'",
  ].join('; ');
  return {
    name: 'jac-csp',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: politica }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [react(), csp(env.VITE_SUPABASE_URL)],
    define: {
      __APP_VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version),
    },
    base: './',
    build: { target: 'es2020', sourcemap: false, assetsInlineLimit: 0 },
    test: { environment: 'node' },
  };
});
