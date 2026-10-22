import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource/outfit/latin-400.css';
import '@fontsource/outfit/latin-700.css';
import '@fontsource/gelasio/latin-700.css';
import './styles.css';

// Nunca dentro de otra pagina (evita que la muestren camuflada para robar toques).
if (window.top !== window.self) {
  document.body.textContent = 'Abre JAC Seguros directamente en crm.jacsegurospa.com/app';
  throw new Error('marco bloqueado');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
