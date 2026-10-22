/*
 * Tarjeta de cumpleaños dibujada en un <canvas> (1080 x 1350, formato vertical de
 * Instagram/WhatsApp). Todo es local: logo, fuentes (empaquetadas) y adornos.
 */
import { LEGAL_SSRP, TEL_JAC } from './cumpleanos';

export const ANCHO = 1080;
export const ALTO = 1350;

export type TemaId = 'marfil' | 'noche' | 'azul' | 'arena';

type Tema = {
  id: TemaId;
  nombre: string;
  /** Colores para la muestra del selector */
  muestra: [string, string];
  oscuro: boolean;
  logo: { lineas: string; jac: string; seguros: string };
  titulo: string;
  texto: string;
  firma: string;
  sub: string;
  legal: string;
  acento: string;
  confeti: string[];
  globos: string[];
};

const ORO = '#C9A55C';
const ORO_OSC = '#A9823A';

export const TEMAS: Tema[] = [
  {
    id: 'marfil', nombre: 'Marfil y oro', muestra: ['#FBF8F1', ORO], oscuro: false,
    logo: { lineas: '#9B9589', jac: '#0F172A', seguros: '#1D4ED8' },
    titulo: '#0F172A', texto: '#334155', firma: '#0F172A', sub: '#64748B', legal: '#8A8478', acento: ORO,
    confeti: [ORO, '#1D4ED8', '#0F172A', '#9B9589', '#E8D3A2'], globos: ['#1D4ED8', ORO, '#0F172A'],
  },
  {
    id: 'noche', nombre: 'Noche azul', muestra: ['#0F172A', '#E2C482'], oscuro: true,
    logo: { lineas: '#9B9589', jac: '#FFFFFF', seguros: '#93B4FF' },
    titulo: '#FFFFFF', texto: '#CBD5E1', firma: '#FFFFFF', sub: '#94A3B8', legal: '#7C8799', acento: '#E2C482',
    confeti: ['#E2C482', '#C9A55C', '#93B4FF', '#FFFFFF', '#3B82F6'], globos: ['#1D4ED8', '#E2C482', '#F8FAFC'],
  },
  {
    id: 'azul', nombre: 'Azul JAC', muestra: ['#1D4ED8', '#FFFFFF'], oscuro: true,
    logo: { lineas: '#9B9589', jac: '#0F172A', seguros: '#1D4ED8' },
    titulo: '#FFFFFF', texto: '#334155', firma: '#0F172A', sub: '#64748B', legal: '#8A8478', acento: '#F2D58E',
    confeti: ['#F2D58E', '#FFFFFF', '#93C5FD', '#C9A55C'], globos: ['#F8FAFC', '#F2D58E', '#60A5FA'],
  },
  {
    id: 'arena', nombre: 'Arena serena', muestra: ['#F1ECE4', '#9B9589'], oscuro: false,
    logo: { lineas: '#9B9589', jac: '#0F172A', seguros: '#1D4ED8' },
    titulo: '#0F172A', texto: '#4B5563', firma: '#0F172A', sub: '#7A746A', legal: '#8A8478', acento: '#9B9589',
    confeti: ['#9B9589', '#C9A55C', '#1D4ED8', '#D6CFC2'], globos: ['#9B9589', '#1D4ED8', '#D9C9A3'],
  },
];

export type DatosTarjeta = {
  tema: TemaId;
  primerNombre: string;
  mensaje: string;
  /** Si se indica, se muestra "¡40 años!" */
  edad?: number | null;
};

type C = CanvasRenderingContext2D;

const SERIF = "Gelasio, Georgia, 'Times New Roman', serif";
const LOGO_SERIF = "Georgia, Gelasio, 'Times New Roman', serif"; // igual que el SVG del logo
const SANS = 'Outfit, Montserrat, Arial, sans-serif';

/** Espera a que las fuentes empaquetadas esten listas (si no, el canvas usa otras). */
export async function cargarFuentes(): Promise<void> {
  if (!('fonts' in document)) return;
  try {
    await Promise.all([
      document.fonts.load(`700 44px Gelasio`, 'JAC¡Feliz'),
      document.fonts.load(`400 13px Outfit`, 'SEGUROS'),
      document.fonts.load(`700 13px Outfit`, 'Jely'),
    ]);
  } catch { /* se dibuja con lo que haya */ }
}

/* ---------------- utilidades ---------------- */

/** Generador pseudoaleatorio con semilla: la misma tarjeta siempre sale igual. */
function azar(semilla: number) {
  let s = semilla >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Texto centrado con espaciado entre letras (sin depender de ctx.letterSpacing). */
function espaciado(c: C, s: string, cx: number, y: number, esp: number) {
  const letras = [...s];
  const anchos = letras.map((l) => c.measureText(l).width);
  const total = anchos.reduce((a, b) => a + b, 0) + esp * (letras.length - 1);
  let x = cx - total / 2;
  const al = c.textAlign;
  c.textAlign = 'left';
  letras.forEach((l, i) => { c.fillText(l, x, y); x += anchos[i] + esp; });
  c.textAlign = al;
  return total;
}

function lineas(c: C, texto: string, ancho: number): string[] {
  const out: string[] = [];
  for (const parrafo of texto.split(/\n+/)) {
    let actual = '';
    for (const p of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? actual + ' ' + p : p;
      if (c.measureText(prueba).width > ancho && actual) { out.push(actual); actual = p; } else actual = prueba;
    }
    if (actual) out.push(actual);
  }
  return out;
}

function rectRedondo(c: C, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Logo oficial (mismas medidas que components/Logo.tsx, viewBox 260 x 90). */
function logo(c: C, cx: number, top: number, esc: number, col: Tema['logo']) {
  const x0 = cx - 130 * esc;
  c.save();
  c.strokeStyle = col.lineas;
  c.lineWidth = 3 * esc;
  for (const y of [14, 76]) {
    c.beginPath(); c.moveTo(x0 + 6 * esc, top + y * esc); c.lineTo(x0 + 254 * esc, top + y * esc); c.stroke();
  }
  c.textBaseline = 'alphabetic';
  c.fillStyle = col.jac;
  c.font = `700 ${44 * esc}px ${LOGO_SERIF}`;
  espaciado(c, 'JAC', cx, top + 59 * esc, 6 * esc);
  c.fillStyle = col.seguros;
  c.font = `400 ${13 * esc}px ${SANS}`;
  espaciado(c, 'SEGUROS', cx, top + 73 * esc, 9 * esc);
  c.restore();
}

function destello(c: C, x: number, y: number, r: number, color: string) {
  c.save();
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y - r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.quadraticCurveTo(x, y, x, y + r);
  c.quadraticCurveTo(x, y, x - r, y);
  c.quadraticCurveTo(x, y, x, y - r);
  c.fill();
  c.restore();
}

function globo(c: C, x: number, y: number, r: number, color: string, hilo: string, inclina = 0, largo = 3.4) {
  c.save();
  // hilo
  c.strokeStyle = hilo;
  c.globalAlpha = 0.55;
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(x, y + r * 1.22);
  c.bezierCurveTo(x - r * 0.35, y + r * 1.9, x + r * 0.35 + inclina, y + r * (largo - 0.9), x + inclina * 1.6, y + r * largo);
  c.stroke();
  c.globalAlpha = 1;
  // nudo
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y + r * 1.12);
  c.lineTo(x - r * 0.12, y + r * 1.3);
  c.lineTo(x + r * 0.12, y + r * 1.3);
  c.closePath();
  c.fill();
  // cuerpo con brillo
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.25);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.25, color);
  g.addColorStop(1, color);
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y, r * 0.92, r * 1.15, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.save();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.beginPath();
  c.ellipse(x - r * 0.38, y - r * 0.5, r * 0.12, r * 0.24, -0.5, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Confeti en zonas (rectangulos [x, y, w, h]) para no tapar el texto. */
function confeti(c: C, zonas: Array<[number, number, number, number]>, colores: string[], n: number, semilla: number) {
  const r = azar(semilla);
  for (let i = 0; i < n; i++) {
    const [zx, zy, zw, zh] = zonas[Math.floor(r() * zonas.length)];
    const x = zx + r() * zw, y = zy + r() * zh;
    const col = colores[Math.floor(r() * colores.length)];
    const tipo = r();
    c.save();
    c.translate(x, y);
    c.rotate(r() * Math.PI);
    c.globalAlpha = 0.55 + r() * 0.45;
    c.fillStyle = col;
    if (tipo < 0.45) { const w = 8 + r() * 10; c.fillRect(-w / 2, -w * 0.22, w, w * 0.44); }
    else if (tipo < 0.75) { c.beginPath(); c.arc(0, 0, 3 + r() * 5, 0, Math.PI * 2); c.fill(); }
    else if (tipo < 0.9) {
      c.strokeStyle = col; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-10, 0); c.bezierCurveTo(-4, -8, 4, 8, 10, 0); c.stroke();
    } else destello(c, 0, 0, 9 + r() * 9, col);
    c.restore();
  }
}

/** Separador: linea — rombo — linea */
function separador(c: C, cx: number, y: number, ancho: number, color: string) {
  c.save();
  c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2;
  c.beginPath(); c.moveTo(cx - ancho / 2, y); c.lineTo(cx - 18, y); c.moveTo(cx + 18, y); c.lineTo(cx + ancho / 2, y); c.stroke();
  c.beginPath(); c.moveTo(cx, y - 9); c.lineTo(cx + 9, y); c.lineTo(cx, y + 9); c.lineTo(cx - 9, y); c.closePath(); c.fill();
  c.beginPath(); c.arc(cx - ancho / 2 - 8, y, 3, 0, Math.PI * 2); c.arc(cx + ancho / 2 + 8, y, 3, 0, Math.PI * 2); c.fill();
  c.restore();
}

function oro(c: C, x0: number, x1: number): CanvasGradient {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, ORO_OSC); g.addColorStop(0.35, '#E9CF8E'); g.addColorStop(0.6, ORO); g.addColorStop(1, ORO_OSC);
  return g;
}

/** Tamaño de letra que hace caber el texto en el ancho */
function ajustar(c: C, texto: string, peso: string, fam: string, max: number, ancho: number) {
  let t = max;
  for (; t > 40; t -= 4) { c.font = `${peso} ${t}px ${fam}`; if (c.measureText(texto).width <= ancho) break; }
  return t;
}

/* ---------------- fondos ---------------- */

function fondo(c: C, t: Tema) {
  const W = ANCHO, H = ALTO;
  if (t.id === 'marfil') {
    const g = c.createRadialGradient(W / 2, H * 0.42, 80, W / 2, H * 0.5, H * 0.8);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#F4EEE2');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // marco doble dorado
    c.strokeStyle = ORO; c.lineWidth = 3; c.strokeRect(38, 38, W - 76, H - 76);
    c.lineWidth = 1.2; c.strokeRect(54, 54, W - 108, H - 108);
    for (const [x, y] of [[38, 38], [W - 38, 38], [38, H - 38], [W - 38, H - 38]]) {
      c.fillStyle = ORO; c.save(); c.translate(x, y); c.rotate(Math.PI / 4); c.fillRect(-9, -9, 18, 18); c.restore();
    }
  } else if (t.id === 'noche') {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0B1224'); g.addColorStop(1, '#16213F');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const h = c.createRadialGradient(W / 2, H * 0.38, 20, W / 2, H * 0.38, W * 0.75);
    h.addColorStop(0, 'rgba(29,78,216,0.45)'); h.addColorStop(1, 'rgba(29,78,216,0)');
    c.fillStyle = h; c.fillRect(0, 0, W, H);
    const r = azar(7);
    for (let i = 0; i < 120; i++) {
      const x = r() * W, y = r() * H, al = 0.25 + r() * 0.6, rad = r() * 1.8 + 0.4;
      if (x > 110 && x < W - 110 && y > 380 && y < H - 110) continue; // sin estrellas detras del texto
      c.globalAlpha = al; c.fillStyle = '#FFFFFF';
      c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    c.strokeStyle = 'rgba(226,196,130,0.55)'; c.lineWidth = 1.5; rectRedondo(c, 44, 44, W - 88, H - 88, 28); c.stroke();
  } else if (t.id === 'azul') {
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, W, 760);
    g.addColorStop(0, '#1D4ED8'); g.addColorStop(1, '#0F2A7A');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, 690);
    c.bezierCurveTo(W * 0.72, 800, W * 0.3, 640, 0, 760); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(242,213,142,0.8)'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(W, 712); c.bezierCurveTo(W * 0.72, 822, W * 0.3, 662, 0, 782); c.stroke();
    const h = c.createRadialGradient(W * 0.8, 120, 10, W * 0.8, 120, 520);
    h.addColorStop(0, 'rgba(255,255,255,0.18)'); h.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = h; c.fillRect(0, 0, W, 800);
  } else {
    c.fillStyle = '#F3EFE8'; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W / 2, 700, 40, W / 2, 700, 560);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.55, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#9B9589'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(70, 60); c.lineTo(W - 70, 60); c.moveTo(70, H - 52); c.lineTo(W - 70, H - 52); c.stroke();
  }
}

/* ---------------- tarjeta ---------------- */

export function dibujarTarjeta(cv: HTMLCanvasElement, d: DatosTarjeta) {
  cv.width = ANCHO; cv.height = ALTO;
  const c = cv.getContext('2d')!;
  const t = TEMAS.find((x) => x.id === d.tema) ?? TEMAS[0];
  const W = ANCHO, cx = W / 2;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  fondo(c, t);
  const nombre = (d.primerNombre || 'Cliente').trim();
  const semilla = [...nombre].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7);

  if (t.id === 'azul') {
    // Arriba (azul): saludo en blanco; abajo (blanco): mensaje, firma y logo oficial
    confeti(c, [[70, 60, 940, 90], [60, 150, 130, 500], [890, 150, 130, 500]], t.confeti, 70, semilla);
    globo(c, 130, 150, 56, t.globos[0], '#FFFFFF', 10, 2.4);
    globo(c, 225, 110, 44, t.globos[1], '#FFFFFF', -8, 2.6);
    globo(c, 950, 160, 54, t.globos[2], '#FFFFFF', -10, 2.4);
    globo(c, 860, 115, 40, t.globos[1], '#FFFFFF', 6, 2.6);
    c.fillStyle = t.acento; c.font = `700 30px ${SANS}`;
    espaciado(c, 'CON MUCHO CARIÑO', cx, 250, 10);
    c.fillStyle = '#FFFFFF';
    c.font = `700 84px ${SERIF}`;
    c.fillText('¡Feliz cumpleaños,', cx, 380);
    const tn = ajustar(c, nombre + '!', '700', SERIF, 165, 800);
    c.fillStyle = oro(c, cx - 360, cx + 360);
    c.font = `700 ${tn}px ${SERIF}`;
    c.fillText(nombre + '!', cx, 380 + tn * 1.05);
    if (d.edad) {
      c.fillStyle = '#FFFFFF'; c.font = `400 36px ${SANS}`;
      espaciado(c, `${d.edad} AÑOS`, cx, 380 + tn * 1.05 + 70, 8);
    }
    mensajeYFirma(c, t, d.mensaje, 820, 975, 3, 1040);
    logo(c, cx, 1120, 1.25, t.logo);
    legal(c, t, 1300);
    return;
  }

  // Disposicion clasica: logo arriba, saludo al centro, firma y legal abajo
  const inset = t.id === 'arena' ? 100 : 80;
  const zonas: Array<[number, number, number, number]> = [[inset, 330, 90, 300], [W - inset - 90, 330, 90, 300], [inset, 80, 230, 90], [W - inset - 230, 80, 230, 90]];
  confeti(c, zonas, t.confeti, t.id === 'arena' ? 34 : 60, semilla);
  if (t.id !== 'arena') {
    const hilo = t.oscuro ? '#E2C482' : '#9B9589';
    globo(c, 165, 215, 54, t.globos[0], hilo, 8, 2.8);
    globo(c, 255, 165, 40, t.globos[1], hilo, -6, 3.2);
    globo(c, 915, 215, 54, t.globos[1], hilo, -8, 2.8);
    globo(c, 825, 165, 40, t.globos[2], hilo, 6, 3.2);
  } else {
    for (const [x, y, r] of [[160, 360, 20], [920, 330, 16], [880, 420, 10], [200, 450, 11]] as const) destello(c, x, y, r, t.confeti[1]);
  }
  logo(c, cx, 104, 1.55, t.logo);

  c.fillStyle = t.acento; c.font = `700 28px ${SANS}`;
  espaciado(c, 'CON MUCHO CARIÑO', cx, 345, 10);
  c.fillStyle = t.titulo;
  c.font = `700 76px ${SERIF}`;
  c.fillText('¡Feliz cumpleaños,', cx, 460);
  const tn = ajustar(c, nombre + '!', '700', SERIF, 160, 740);
  c.fillStyle = t.oscuro ? oro(c, cx - 340, cx + 340) : '#1D4ED8';
  c.font = `700 ${tn}px ${SERIF}`;
  const yNom = 460 + tn * 1.02;
  c.fillText(nombre + '!', cx, yNom);
  let y = yNom + 40;
  if (d.edad) {
    c.fillStyle = t.sub; c.font = `400 32px ${SANS}`;
    espaciado(c, `${d.edad} AÑOS`, cx, y + 34, 8);
    y += 54;
  }
  separador(c, cx, y + 28, 300, t.acento);
  mensajeYFirma(c, t, d.mensaje, y + 70, 1075, 5, 1150);
  legal(c, t, 1268);
}

/** Mensaje centrado entre `arriba` y `abajo`; la firma siempre en `yFirma`. */
function mensajeYFirma(c: C, t: Tema, mensaje: string, arriba: number, abajo: number, maxLineas: number, yFirma: number) {
  const cx = ANCHO / 2;
  let tam = 40;
  let ls: string[] = [];
  for (; tam >= 28; tam -= 2) {
    c.font = `400 ${tam}px ${SANS}`;
    ls = lineas(c, mensaje.trim(), 820);
    if (ls.length <= maxLineas && (ls.length - 1) * tam * 1.45 + tam <= abajo - arriba) break;
  }
  if (ls.length > maxLineas) { ls = ls.slice(0, maxLineas); ls[maxLineas - 1] = ls[maxLineas - 1].replace(/\s*\S*$/, '…'); }
  c.fillStyle = t.texto;
  const alto = tam * 1.45;
  const y0 = arriba + (abajo - arriba - (ls.length - 1) * alto) / 2 + tam * 0.35;
  ls.forEach((l, i) => c.fillText(l, cx, y0 + i * alto));
  c.fillStyle = t.firma; c.font = `700 40px ${SANS}`;
  c.fillText('Jely An Castro · JAC Seguros', cx, yFirma);
  c.fillStyle = t.sub; c.font = `400 30px ${SANS}`;
  c.fillText(`Tel. ${TEL_JAC}  ·  www.jacsegurospa.com`, cx, yFirma + 48);
}

function legal(c: C, t: Tema, y: number) {
  c.fillStyle = t.legal;
  c.font = `400 20px ${SANS}`;
  c.fillText(LEGAL_SSRP, ANCHO / 2, y);
}

/** Dibuja la tarjeta (con las fuentes listas) y la devuelve como PNG. */
export async function tarjetaPNG(d: DatosTarjeta): Promise<{ blob: Blob; canvas: HTMLCanvasElement }> {
  await cargarFuentes();
  const cv = document.createElement('canvas');
  dibujarTarjeta(cv, d);
  const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
  if (!blob) throw new Error('No se pudo crear la imagen.');
  return { blob, canvas: cv };
}
