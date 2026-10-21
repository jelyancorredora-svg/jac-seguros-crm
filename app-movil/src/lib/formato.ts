/* Utilidades puras: sin red ni estado, por eso tienen pruebas. */

const MONEDA = new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' });

export function dinero(n: number | null | undefined): string {
  return typeof n === 'number' && isFinite(n) ? MONEDA.format(n) : '—';
}

/** 'AAAA-MM-DD' -> '21 oct 2026'. Sin conversion de zona horaria. */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return '—';
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${Number(m[3])} ${meses[Number(m[2]) - 1]} ${m[1]}`;
}

export function hoyISO(ahora: Date = new Date()): string {
  const p = (x: number) => String(x).padStart(2, '0');
  return `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
}

/** Dias enteros desde hoy hasta la fecha (negativo si ya paso). */
export function diasHasta(iso: string | null | undefined, ahora: Date = new Date()): number | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const objetivo = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const hoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return Math.round((objetivo - hoy) / 86_400_000);
}

/** Solo digitos; numeros de 7 u 8 digitos se asumen de Panama (+507). */
export function telefonoInternacional(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 7 || d.length === 8) d = '507' + d;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

export function enlaceLlamada(tel: string | null | undefined): string | null {
  const d = telefonoInternacional(tel);
  return d ? `tel:+${d}` : null;
}

export function enlaceWhatsApp(tel: string | null | undefined): string | null {
  const d = telefonoInternacional(tel);
  return d ? `https://wa.me/${d}` : null;
}

export function enlaceCorreo(email: string | null | undefined): string | null {
  return email && esCorreo(email) ? `mailto:${encodeURIComponent(email.trim())}` : null;
}

export function esCorreo(v: string): boolean {
  return /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/i.test(v.trim());
}

/** Busqueda sin acentos ni mayusculas. */
export function normalizar(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Mismo formato de id que usa el CRM web (uid()). */
let secuencia = 0;
export function nuevoId(prefijo: string): string {
  secuencia += 1;
  const azar = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => (b % 36).toString(36))
    .join('')
    .toUpperCase();
  return prefijo + Date.now().toString(36) + secuencia.toString(36) + azar;
}

/** Recorta y limita la longitud de un texto antes de guardarlo. */
export function limpiarTexto(v: string, max = 2000): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
