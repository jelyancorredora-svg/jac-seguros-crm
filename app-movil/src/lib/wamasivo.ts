/* Logica pura de "📣 WhatsApp Masivo" (pg-wam del CRM web): seleccion de
   destinatarios, textos de cada aviso y relleno de variables. Sin red. */
import type { Reg } from './datos';
import { diasHasta } from './formato';

/* Mismos lectores que datos.ts (copiados para no cargar Supabase en las pruebas) */
const txt = (r: Reg | undefined | null, k: string): string => {
  const v = r?.[k];
  return v === null || v === undefined ? '' : typeof v === 'object' ? '' : String(v);
};
const num = (r: Reg | undefined | null, k: string): number | null => {
  const v = r?.[k];
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : null;
};
const fec = (r: Reg | undefined | null, k: string): string => {
  const s = txt(r, k).trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

export type WamTipo = 'ren' | 'bday' | 'cobro' | 'custom';

export const WAM_TIPOS: Array<[WamTipo, string]> = [
  ['ren', '⏰ Renovación próxima'],
  ['bday', '🎂 Cumpleaños'],
  ['cobro', '💳 Recordatorio de pago'],
  ['custom', '✏️ Mensaje personalizado'],
];
export const WAM_DIAS: Array<[number, string]> = [
  [7, 'Próximos 7 días'], [15, 'Próximos 15 días'], [30, 'Próximos 30 días'], [60, 'Próximos 60 días'],
];
export const WAM_BDAY: Array<[number, string]> = [[0, 'Hoy'], [7, 'Próximos 7 días'], [30, 'Próximos 30 días']];

export type WamFiltros = { tipo: WamTipo; dias: number; bdayDias: number; ramo: string; aseg: string; custom: string };
export const FILTROS_INICIALES: WamFiltros = { tipo: 'ren', dias: 30, bdayDias: 7, ramo: '', aseg: '', custom: '' };

export type WamItem = { id: string; nombre: string; tel: string; dias: number; info: string; msg: string; url: string };

const TEL = '+507 6292-6010';
const SSRP = 'Regulado y supervisado por la Superintendencia de Seguros y Reaseguros de Panamá.';
/** Firma del constructor original de wamBuildMsg */
const SIG = `\n\n📞 ${TEL}\n🌐 www.jacsegurospa.com\n_Jely An Castro Pérez · JAC Seguros_`;
/** window.jacFirma() (version completa), usada por waRenMsg */
const FIRMA = '\n\n————————————\n'
  + '*JAC Seguros* | Jely An Castro, corredora de seguros\n'
  + '📞 ' + TEL + '\n'
  + '✉️ jcastro@jacsegurospa.com\n'
  + '✉️ jelyancorredora@gmail.com\n'
  + '🌐 www.jacsegurospa.com\n'
  + '📍 Panamá\n\n'
  + '_' + SSRP + '_';

/** Vista previa fija por tipo (wamUpdatePreview) */
export const WAM_MUESTRAS: Record<WamTipo, string> = {
  ren: `Hola [Nombre] 👋🏼\n\nTe escribimos desde *JAC Seguros* | *Jely An Castro* para avisarte que tu póliza de *[Ramo]* con *[Aseg.]* vence el *[Fecha]*.\n\n¡No te quedes sin cobertura! Contáctanos para renovar.\n\n📞 +507 6292-6010\n🌐 www.jacsegurospa.com\n\n_Jely An Castro Pérez · JAC Seguros_`,
  bday: `🎂 ¡Feliz Cumpleaños, [Nombre]! 🎉\n\nDesde *JAC Seguros* | *Jely An Castro* te deseamos un día lleno de salud, felicidad y bendiciones. ¡Que cumplas muchos más! 🌟\n\n📞 +507 6292-6010\n\n_Con cariño,\nJely An Castro Pérez · JAC Seguros_`,
  cobro: `Hola [Nombre] 👋🏼\n\nTe recordamos desde *JAC Seguros* | *Jely An Castro* que tienes un pago pendiente de tu póliza de *[Ramo]* por *[Monto]*.\n\nCualquier consulta, estamos a tu disposición.\n\n📞 +507 6292-6010\n\n_Jely An Castro Pérez · JAC Seguros_`,
  custom: `[Tu mensaje personalizado aquí]\n\n📞 +507 6292-6010\n_Jely An Castro Pérez · JAC Seguros_`,
};

/* ---------- formatos identicos al CRM web ---------- */
const MON = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
/** fmt() del web: '2026-10-05' -> '5 Oct 2026' */
export function fmtWeb(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${MON[Number(m[2]) - 1]} ${m[1]}` : iso || '—';
}
const montoPA = (n: number) => n.toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** fmtM() del web */
export const fmtM = (n: number) => '$' + montoPA(n);
/** m() de las plantillas de renovacion */
const balboas = (n: number) => 'B/. ' + montoPA(n);

/** fmtWANum(tel,'507') del web */
export function fmtWANum(tel: string, cp = '507'): string {
  if (!tel) return '';
  const n = tel.replace(/[^0-9]/g, '');
  if (n.startsWith(cp)) return n;
  if (n.startsWith('00' + cp)) return n.slice(2);
  return cp + n;
}
export const urlWA = (tel: string, msg: string) => `https://wa.me/${fmtWANum(tel)}?text=${encodeURIComponent(msg)}`;

const primerNombre = (s: string) => s.split(' ')[0];
const nom = (s: string) => s.trim().split(/\s+/)[0] || 'Hola';

/** Datos minimos de cliente y poliza (GC(p.clienteId) o el respaldo de la poliza) */
type Cli = { id?: string; nombre: string; cel: string; tel: string; email?: string };

/** window.waRenMsg(p, cl): la que usa el masivo para renovaciones */
function mensajeRenovacion(p: Reg, cl: Cli, hoy: Date): string {
  const fin = fec(p, 'fechaFin');
  const d = diasHasta(fin, hoy);
  const urgencia = d !== null && d >= 0
    ? (d === 0 ? '*vence hoy*' : d === 1 ? '*vence mañana*' : 'vence en *' + d + ' días*')
    : 'está por vencer';
  const prima = num(p, 'prima');
  return 'Hola ' + nom(cl.nombre || txt(p, 'nombreCliente')) + ' 👋🏼\n\n'
    + 'Te escribo para recordarte que tu póliza ' + urgencia + ' y quiero ayudarte a renovarla '
    + 'a tiempo para que no quedes ni un día sin cobertura.\n\n'
    + '📋 *Detalle de tu póliza*\n'
    + '• Ramo: ' + (txt(p, 'ramo') || '—') + '\n'
    + '• Aseguradora: ' + (txt(p, 'aseg') || '—') + '\n'
    + '• N° de póliza: ' + (txt(p, 'num') || '—') + '\n'
    + '• Vence: *' + (fin ? fmtWeb(fin) : '') + '*\n'
    + (prima ? '• Prima actual: ' + balboas(prima) + '\n' : '')
    + '\nSi quieres, reviso tu cobertura y te comparto opciones antes de renovar, '
    + 'por si algo cambió este año.\n\n'
    + '¿Te queda bien que lo veamos esta semana?'
    + FIRMA;
}

/** wamBuildMsg(tipo, cl, pol) tal como queda en el web (con su reemplazo para 'ren') */
export function mensajeWam(tipo: WamTipo, cl: Cli, pol: Reg | null, custom: string, hoy: Date = new Date()): string {
  if (tipo === 'ren') return mensajeRenovacion(pol ?? { id: '' }, cl, hoy);
  const fn = primerNombre(cl.nombre || 'Cliente');
  if (tipo === 'bday') {
    return `🎂 ¡Feliz Cumpleaños, ${fn}! 🎉\n\nDesde *JAC Seguros* | *Jely An Castro* te deseamos un maravilloso día lleno de salud, felicidad y bendiciones. ¡Que cumplas muchos más! 🌟${SIG}`;
  }
  if (tipo === 'cobro') {
    const prima = num(pol, 'prima');
    return `Hola ${fn} 👋🏼\n\nTe recordamos desde *JAC Seguros* | *Jely An Castro* que tienes un pago pendiente de tu póliza de *${txt(pol, 'ramo')}* por *${prima ? fmtM(prima) : '—'}*.${SIG}`;
  }
  const plantilla = custom || 'Hola {nombre}, te contacta JAC Seguros.';
  // Primero las variables dobles de las plantillas guardadas ({{nombre}}…), luego las simples.
  return rellenar(plantilla, { cli: cl }, hoy).replace(/{nombre}/gi, fn).replace(/{fecha}/g, hoy.toLocaleDateString('es-PA')) + SIG;
}

/** window.jacRellenar(texto, ctx): {{variable}} con los datos disponibles; lo desconocido queda igual. */
export function rellenar(texto: string, ctx: { cli?: Partial<Cli>; pol?: Reg | null }, hoy: Date = new Date()): string {
  const cl = ctx.cli ?? {};
  const p = ctx.pol ?? null;
  const nombre = cl.nombre || txt(p, 'nombreCliente');
  const fin = fec(p, 'fechaFin');
  const ini = fec(p, 'fechaInicio');
  const prima = num(p, 'prima');
  const dias = diasHasta(fin, hoy);
  const v: Record<string, string> = {
    nombre: nombre.split(' ')[0],
    nombreCompleto: nombre,
    poliza: txt(p, 'num'),
    ramo: txt(p, 'ramo'),
    aseguradora: txt(p, 'aseg'),
    vence: fin ? fmtWeb(fin) : '',
    vigencia: ini && fin ? fmtWeb(ini) + ' al ' + fmtWeb(fin) : '',
    dias: dias === null ? '' : String(dias),
    prima: prima ? fmtM(prima) : '',
    monto: prima ? fmtM(prima) : '',
    interes: 'seguros',
    email: cl.email || '',
    celular: cl.cel || cl.tel || '',
    tramite: 'el SOAT',
  };
  return String(texto || '').replace(/\{\{(\w+)\}\}/g, (t, k: string) => (v[k] ? v[k] : t));
}

/** Ramos y aseguradoras de todas las polizas (RWam) */
export function opcionesWam(polizas: Reg[]): { ramos: string[]; asegs: string[] } {
  const u = (k: string) => [...new Set(polizas.map((p) => txt(p, k)).filter(Boolean))].sort();
  return { ramos: u('ramo'), asegs: u('aseg') };
}

const aCli = (c: Reg): Cli => ({ id: c.id, nombre: txt(c, 'nombre'), cel: txt(c, 'cel'), tel: txt(c, 'tel'), email: txt(c, 'email') });

/** Dias hasta el proximo cumpleaños (0 = hoy), o null si no hay fecha valida. */
export function diasCumple(fNac: string, hoy: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fNac);
  if (!m) return null;
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const b = new Date(hoy.getFullYear(), Number(m[2]) - 1, Number(m[3]));
  if (b < base) b.setFullYear(hoy.getFullYear() + 1);
  return Math.round((b.getTime() - base.getTime()) / 86_400_000);
}

/** wamGenerate(): destinatarios segun el tipo y los filtros */
export function generarWam(clientes: Reg[], polizas: Reg[], f: WamFiltros, hoy: Date = new Date()): WamItem[] {
  const out: WamItem[] = [];
  if (f.tipo === 'ren' || f.tipo === 'cobro') {
    const porId = new Map(clientes.map((c) => [c.id, c]));
    for (const p of polizas) {
      if (txt(p, 'estado') === 'Cancelada') continue;
      if (f.ramo && txt(p, 'ramo') !== f.ramo) continue;
      if (f.aseg && txt(p, 'aseg') !== f.aseg) continue;
      const fin = fec(p, 'fechaFin');
      const d = diasHasta(fin, hoy) ?? 9999;
      if (d < 0 || d > f.dias) continue;
      const c = porId.get(txt(p, 'clienteId'));
      const cl: Cli = c ? aCli(c) : { nombre: txt(p, 'nombreCliente') || 'Cliente', cel: txt(p, 'celCliente'), tel: '' };
      const tel = cl.cel || cl.tel;
      if (!tel) continue;
      const msg = mensajeWam(f.tipo, cl, p, f.custom, hoy);
      out.push({
        id: p.id + '_' + (cl.id ?? 'undefined'), nombre: cl.nombre || '—', tel, dias: d,
        info: `${txt(p, 'ramo')} · ${txt(p, 'aseg')} · ${fin ? fmtWeb(fin) : '—'}`, msg, url: urlWA(tel, msg),
      });
    }
    out.sort((a, b) => a.dias - b.dias);
  } else if (f.tipo === 'bday') {
    for (const c of clientes) {
      const nac = fec(c, 'fNac');
      if (!nac) continue;
      const cl = aCli(c);
      const tel = cl.cel || cl.tel;
      if (!tel) continue;
      const diff = diasCumple(nac, hoy);
      if (diff === null || diff < 0 || diff > f.bdayDias) continue;
      const msg = mensajeWam('bday', cl, null, f.custom, hoy);
      out.push({
        id: c.id, nombre: cl.nombre || '—', tel, dias: diff,
        info: `Cumpleaños en ${diff === 0 ? 'HOY' : diff + ' días'} · ${fmtWeb(nac)}`, msg, url: urlWA(tel, msg),
      });
    }
  } else {
    for (const c of clientes) {
      const cl = aCli(c);
      const tel = cl.cel || cl.tel;
      if (!tel) continue;
      const msg = mensajeWam('custom', cl, null, f.custom, hoy);
      out.push({ id: c.id, nombre: cl.nombre || '—', tel, dias: 0, info: 'Cliente', msg, url: urlWA(tel, msg) });
    }
  }
  return out;
}

/** Plantillas aptas para WhatsApp (fillWATplSelect: 'wa' o 'ambos'; la biblioteca usa 'whatsapp') */
export const plantillaWA = (p: Reg) => ['wa', 'whatsapp', 'ambos'].includes(txt(p, 'tipo'));
export const TIPO_PLANTILLA: Record<string, string> = { wa: 'WhatsApp', whatsapp: 'WhatsApp', email: 'Email', ambos: 'Ambos' };
