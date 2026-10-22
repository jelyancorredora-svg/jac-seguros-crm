/*
 * Navegacion "hacia atras" de toda la app.
 *
 * Cada pantalla que se abre encima de otra (una ficha, un formulario de
 * edicion, cualquier ventana) se anota aqui y en el historial del navegador.
 * Asi el boton "‹ Volver", el boton atras del telefono / computadora y el
 * gesto de atras hacen lo mismo: cerrar SOLO lo de arriba y regresar paso a
 * paso (formulario → ficha → lista).
 */

type Entrada = { id: number; cerrar: () => boolean | void };

const pila: Entrada[] = [];
let siguiente = 1;
let ignorar = 0;
let iniciado = false;
/* Pasos que se abrieron mientras el navegador todavia estaba retrocediendo:
   se anotan en el historial cuando termina, para no desordenarlo. */
const enEspera: number[] = [];

function anotar(id: number) {
  try { history.pushState({ jacNav: id }, ''); } catch { /* sin historial */ }
}

function iniciar() {
  if (iniciado || typeof window === 'undefined') return;
  iniciado = true;
  window.addEventListener('popstate', () => {
    if (ignorar > 0) {
      ignorar--;
      if (ignorar === 0) enEspera.splice(0).forEach(anotar);
      return;
    }
    const e = pila.pop();
    if (!e) return;
    // Si la pantalla no quiere cerrarse (p. ej. cambios sin guardar y la persona dice "no"),
    // se vuelve a anotar para que el siguiente "atras" lo intente de nuevo.
    if (e.cerrar() === false) {
      pila.push(e);
      anotar(e.id);
    }
  });
}

/** Anota una pantalla abierta. Devuelve su id. */
export function abrirNav(cerrar: () => boolean | void): number {
  iniciar();
  const id = siguiente++;
  pila.push({ id, cerrar });
  if (ignorar > 0) enEspera.push(id);
  else anotar(id);
  return id;
}

/** La app cerro esa pantalla por su cuenta (boton Guardar, Cancelar…): se borra su paso del historial. */
export function cerradaNav(id: number) {
  const i = pila.findIndex((e) => e.id === id);
  if (i < 0) return; // ya la cerro el boton atras
  const sobran = pila.length - i;
  const quitados = pila.splice(i).map((e) => e.id);
  // los que ni siquiera llegaron al historial no hay que retrocederlos
  const sinAnotar = quitados.filter((x) => enEspera.includes(x));
  sinAnotar.forEach((x) => enEspera.splice(enEspera.indexOf(x), 1));
  const atras = sobran - sinAnotar.length;
  if (!atras) return;
  // history.go(-n) produce UN solo aviso "popstate", aunque retroceda n pasos
  ignorar += 1;
  try { history.go(-atras); } catch { ignorar -= 1; }
}

/** "‹ Volver": igual que el boton atras del telefono */
export function atrasNav() {
  if (!pila.length) return;
  try { history.back(); } catch { pila.pop()?.cerrar(); }
}

/** Cambio de pestaña o salida: se olvida todo lo abierto */
export function reiniciarNav() {
  const quitados = pila.splice(0).map((e) => e.id);
  const n = quitados.filter((x) => !enEspera.includes(x)).length;
  enEspera.length = 0;
  if (!n) return;
  ignorar += 1;
  try { history.go(-n); } catch { ignorar -= 1; }
}

export const pantallasAbiertas = () => pila.length;
