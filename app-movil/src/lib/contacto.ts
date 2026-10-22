/*
 * 💬 WhatsApp y 📧 correo, con los MISMOS textos que usa el CRM web en cada
 * lugar (openWAForCli, openWAForPros, openWAForPolCli, waRenMsg, waCobMsg,
 * openWAForPagCli, siniestros, SOAT, tareas y openEmailFor*).
 * Solo logica: sin red ni base, para poder probarla.
 */
import type { Reg } from './datos';

const txt = (r: Reg | null | undefined, k: string): string => {
  const v = r?.[k];
  return v === null || v === undefined ? '' : String(v).trim();
};
const num = (r: Reg | null | undefined, k: string): number => {
  const n = Number(r?.[k]);
  return Number.isFinite(n) ? n : 0;
};
const primer = (s: string) => s.trim().split(/\s+/)[0] || '';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
/** Fecha como el fmt() del web: "5 Oct 2026" */
export function fmt(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : iso || '';
}
const dinero = (n: number) => 'B/. ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dias hasta una fecha (como dias() del web) */
export function diasHasta(iso: string, hoy = new Date()): number | null {
  const t = Date.parse((iso || '').slice(0, 10) + 'T12:00:00');
  return Number.isFinite(t) ? Math.ceil((t - hoy.getTime()) / 86_400_000) : null;
}

export const TEL = '+507 6292-6010';
export const SSRP = 'Regulado y supervisado por la Superintendencia de Seguros y Reaseguros de Panamá.';

export function firma(compacta = false): string {
  if (compacta) return `\n\n_*JAC Seguros* | Jely An Castro, corredora de seguros_\n📞 ${TEL} · Panamá\n_${SSRP}_`;
  return `\n\n————————————\n*JAC Seguros* | Jely An Castro, corredora de seguros\n📞 ${TEL}\n✉️ jcastro@jacsegurospa.com\n✉️ jelyancorredora@gmail.com\n🌐 www.jacsegurospa.com\n📍 Panamá\n\n_${SSRP}_`;
}

const FIRMA_CORREO = `\nJely An Castro Pérez\nJAC Seguros | Jely An Castro, corredora de seguros\n📞 ${TEL}\n📧 jcastro@jacsegurospa.com\n📧 jelyancorredora@gmail.com\n🌐 www.jacsegurospa.com\n📍 Panamá\n\n${SSRP}`;

/* ---------------- WhatsApp ---------------- */

export const waCliente = (c: Reg) =>
  `Hola ${primer(txt(c, 'nombre'))} 👋🏼\n\nTe saluda *Jely An Castro* de *JAC Seguros | Jely An Castro*.\n\n¿En qué podemos ayudarte hoy?\n\n_📞 ${TEL}_`;

export function waProspecto(p: Reg): string {
  const interes = Array.isArray(p.interes) && (p.interes as string[]).length ? (p.interes as string[]).join(', ') : 'seguros';
  return `Hola ${primer(txt(p, 'nombre'))} 👋🏼\n\nTe contacto de *JAC Seguros | Jely An Castro* por el seguro de *${interes}* que te interesa.\n\n¿Podemos coordinar?\n\n_Jely An Castro Pérez · 📞 ${TEL}_`;
}

export const waPoliza = (p: Reg, cl: Reg | undefined) =>
  `Hola ${primer(txt(cl, 'nombre') || txt(p, 'nombreCliente'))} 👋🏼\n\nTe contacto de *JAC Seguros | Jely An Castro* respecto a tu póliza de *${txt(p, 'ramo')}* con *${txt(p, 'aseg')}* (N° ${txt(p, 'num')}).\n\n_Jely An Castro Pérez · 📞 ${TEL}_`;

/** waRenMsg (version final del web) */
export function waRenovacion(p: Reg, cl: Reg | undefined, hoy = new Date()): string {
  const d = diasHasta(txt(p, 'fechaFin'), hoy);
  const urgencia = d !== null && d >= 0 ? (d === 0 ? '*vence hoy*' : d === 1 ? '*vence mañana*' : `vence en *${d} días*`) : 'está por vencer';
  return `Hola ${primer(txt(cl, 'nombre') || txt(p, 'nombreCliente')) || 'Hola'} 👋🏼\n\n`
    + `Te escribo para recordarte que tu póliza ${urgencia} y quiero ayudarte a renovarla a tiempo para que no quedes ni un día sin cobertura.\n\n`
    + `📋 *Detalle de tu póliza*\n• Ramo: ${txt(p, 'ramo') || '—'}\n• Aseguradora: ${txt(p, 'aseg') || '—'}\n• N° de póliza: ${txt(p, 'num') || '—'}\n• Vence: *${fmt(txt(p, 'fechaFin'))}*\n`
    + (num(p, 'prima') ? `• Prima actual: ${dinero(num(p, 'prima'))}\n` : '')
    + '\nSi quieres, reviso tu cobertura y te comparto opciones antes de renovar, por si algo cambió este año.\n\n¿Te queda bien que lo veamos esta semana?'
    + firma();
}

/** waCobMsg (version final del web) */
export function waCobro(p: Reg, cl: Reg | undefined): string {
  return `Hola ${primer(txt(cl, 'nombre') || txt(p, 'nombreCliente')) || 'Hola'} 👋🏼\n\n`
    + 'Te escribo con un recordatorio amable sobre el pago de tu póliza, para que tu cobertura se mantenga activa sin contratiempos.\n\n'
    + `📋 *Detalle*\n• Ramo: ${txt(p, 'ramo') || '—'}\n• Aseguradora: ${txt(p, 'aseg') || '—'}\n• N° de póliza: ${txt(p, 'num') || '—'}\n• Monto: *${dinero(num(p, 'prima'))}*\n`
    + (txt(p, 'formaPago') ? `• Forma de pago: ${txt(p, 'formaPago')}\n` : '')
    + '\nSi ya lo realizaste, por favor ignora este mensaje y compárteme el comprobante para registrarlo.\n\nCualquier duda con el pago, con gusto te ayudo.'
    + firma();
}

export const waPago = (cl: Reg | undefined, pago: Reg) =>
  `Hola ${txt(cl, 'nombre') || txt(pago, 'cliente')}, le contactamos de JAC Seguros | Jely An Castro respecto a su póliza. Por favor contáctenos. Gracias.`;

export const waSiniestro = (s: Reg, cl: Reg | undefined) =>
  `Hola ${primer(txt(cl, 'nombre') || txt(s, 'cliente'))} 👋🏼\n\nActualización siniestro *${txt(s, 'numCia') || txt(s, 'numSin') || '—'}*.\n${txt(s, 'seguimiento') || txt(s, 'desc')}\n\n_JAC Seguros · 📞 ${TEL}_`;

export const waSoat = (v: Reg, cl: Reg | undefined) =>
  `Hola ${primer(txt(v, 'clienteNom') || txt(cl, 'nombre'))} 👋🏼\n\nEl SOAT de la placa *${txt(v, 'placa')}* vence el *${fmt(txt(v, 'soat'))}*.\n\nComunícate para renovarlo.\n\n_JAC Seguros · 📞 ${TEL}_`;

export const waVehiculo = (v: Reg, cl: Reg | undefined) =>
  `Hola ${primer(txt(v, 'clienteNom') || txt(cl, 'nombre'))} 👋🏼\n\nTe contacto de *JAC Seguros | Jely An Castro* respecto a tu vehículo placa *${txt(v, 'placa')}*.\n\n_JAC Seguros · 📞 ${TEL}_`;

export const waTarea = (t: Reg, nombre: string) =>
  `Hola ${primer(nombre) || nombre}, te contacto de JAC Seguros | Jely An Castro: ${txt(t, 'titulo')}`;

/* ---------------- correo ---------------- */

/** tipo: plantilla de EmailJS a usar (general, renovaciones o cumpleaños) */
export type Correo = { asunto: string; cuerpo: string; tipo?: 'general' | 'ren' | 'bday' };

export const correoCliente = (c: Reg): Correo => ({
  asunto: `JAC Seguros — Hola ${primer(txt(c, 'nombre'))}`,
  cuerpo: `Estimado/a ${txt(c, 'nombre')},\n\nEspero que se encuentre muy bien.\n\nMe pongo en contacto desde JAC Seguros | Jely An Castro.\n\n\n\nQuedo atenta a su respuesta.\n\nAtentamente,${FIRMA_CORREO}`,
});

export function correoProspecto(p: Reg): Correo {
  const interes = Array.isArray(p.interes) && (p.interes as string[]).length ? (p.interes as string[]).join(', ') : 'seguros';
  return {
    asunto: `JAC Seguros — Cotización ${interes}`,
    cuerpo: `Hola ${primer(txt(p, 'nombre'))} 👋\n\nGracias por tu interés en los seguros de ${interes}.\n\nAdjunto / a continuación te comparto la información de la cotización preparada especialmente para ti.\n\nCualquier pregunta, ¡con gusto te atiendo!\n\nAtentamente,${FIRMA_CORREO}`,
  };
}

export function correoPoliza(p: Reg, cl: Reg | undefined, hoy = new Date()): Correo {
  const d = diasHasta(txt(p, 'fechaFin'), hoy) ?? -1;
  return {
    tipo: 'ren',
    asunto: d >= 0 ? `⚠️ Tu póliza ${txt(p, 'ramo')} vence en ${d} días — JAC Seguros` : `Renovación póliza ${txt(p, 'ramo')} — JAC Seguros`,
    cuerpo: `Hola ${primer(txt(cl, 'nombre') || txt(p, 'nombreCliente'))} 👋\n\nTe contacto respecto a tu póliza de *${txt(p, 'ramo')}* con ${txt(p, 'aseg')} (N° ${txt(p, 'num')}).\n\nFecha de vencimiento: ${fmt(txt(p, 'fechaFin'))}\n${d >= 0 ? `⚠️ Faltan solo ${d} días para vencer.` : '⚠️ Tu póliza ya venció.'}\n\nPara renovarla y mantener tu cobertura sin interrupciones, contáctame.\n\nSaludos,${FIRMA_CORREO}`,
  };
}

export const correoPago = (cl: Reg | undefined, pago: Reg): Correo => ({
  asunto: 'JAC Seguros — Aviso de Pago',
  cuerpo: `Estimado/a ${txt(cl, 'nombre') || txt(pago, 'cliente')},\n\nLe contactamos de JAC Seguros | Jely An Castro.\n\nGracias,\nJAC Seguros`,
});

export const correoSiniestro = (s: Reg, cl: Reg | undefined): Correo => ({
  asunto: `Actualización siniestro ${txt(s, 'numCia') || txt(s, 'numSin')} — JAC Seguros`,
  cuerpo: `Hola ${primer(txt(cl, 'nombre') || txt(s, 'cliente') || txt(s, 'asegurado'))} 👋\n\nTe enviamos una actualización sobre tu siniestro ${txt(s, 'nombre') ? ` de *${txt(s, 'nombre')}*` : ''} (Ref: ${txt(s, 'numCia') || txt(s, 'numSin') || '—'}).\n\nEstado actual: ${txt(s, 'estado') || '—'}\n${txt(s, 'seguimiento') || txt(s, 'desc')}\n\nAnte cualquier consulta, estamos a tu disposición.\n\nAtentamente,${FIRMA_CORREO}`,
});

export const correoTarea = (t: Reg, nombre: string): Correo => ({
  asunto: `JAC Seguros — ${txt(t, 'titulo')}`,
  cuerpo: `Hola ${primer(nombre)} 👋\n\nTe contacto respecto a: ${txt(t, 'titulo')}\n${txt(t, 'desc') ? `\n${txt(t, 'desc')}\n` : ''}\n\nQuedo pendiente.\n\nAtentamente,${FIRMA_CORREO}`,
});

export const correoVehiculo = (v: Reg, cl: Reg | undefined): Correo => ({
  asunto: `JAC Seguros — Vehículo ${txt(v, 'placa')}`,
  cuerpo: `Hola ${primer(txt(v, 'clienteNom') || txt(cl, 'nombre'))} 👋\n\nTe contacto respecto a tu vehículo placa ${txt(v, 'placa')}${txt(v, 'soat') ? ` (SOAT vence el ${fmt(txt(v, 'soat'))})` : ''}.\n\nQuedo pendiente.\n\nAtentamente,${FIRMA_CORREO}`,
});

/* ---------------- enlaces y registro ---------------- */

/** Numero para wa.me como fmtWANum del web: 8 digitos de Panama + codigo de pais */
export function numeroWA(tel: string, codPais = '507'): string {
  const n = (tel || '').replace(/\D/g, '');
  const cp = (codPais || '507').replace(/\D/g, '') || '507';
  if (!n) return '';
  if (n.startsWith('00')) return n.slice(2);       // 00 + codigo internacional
  if (n.startsWith(cp) && n.length > 8) return n;  // ya trae el codigo del pais
  if (cp === '507' && n.length > 8) return n;      // otro pais escrito completo
  return cp + n;
}
export const enlaceWA = (tel: string, msg: string, codPais?: string) => {
  const n = numeroWA(tel, codPais);
  return n.length >= 7 ? `https://wa.me/${n}?text=${encodeURIComponent(msg)}` : null;
};
export const enlaceMail = (para: string, c: Correo) =>
  `mailto:${encodeURIComponent(para.trim())}?subject=${encodeURIComponent(c.asunto)}&body=${encodeURIComponent(c.cuerpo)}`;

/** Entrada que el web guarda en historialComms / historialWA (waClick, logEmailSent) */
export function entradaComms(tipo: 'whatsapp' | 'email', motivo: string, mensaje: string, para: string, asunto = '') {
  const id = (tipo === 'whatsapp' ? 'WA' : 'EM') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const preview = mensaje.slice(0, 80) + (mensaje.length > 80 ? '…' : '');
  return tipo === 'whatsapp'
    ? { id, fecha: new Date().toISOString().slice(0, 10), tipo, msgType: motivo, nombre: para, preview, accion: `💬 WhatsApp — ${motivo}`, resultado: preview, mensaje }
    : { id, fecha: new Date().toISOString().slice(0, 10), tipo, msgType: 'Email', accion: `📧 Email enviado: ${asunto}`, resultado: para, preview: asunto, subject: asunto, body: mensaje };
}

/* ---------------- datos de contacto de cada registro ---------------- */

type Cart = { clientes: Reg[]; prospectos: Reg[]; polizas: Reg[] };
const porId = (l: Reg[], id: string) => (id ? l.find((x) => x.id === id) : undefined);
const telDe = (r: Reg | undefined) => txt(r, 'cel') || txt(r, 'tel');

/** Lo que necesita BotonesContacto (sin importar React, para poder probarlo) */
export type Datos = {
  nombre: string; tel?: string; codPais?: string; email?: string;
  wa?: Array<{ motivo: string; msg: string }>; correo?: Correo;
  registro?: { modulo: 'clientes' | 'prospectos'; id: string; prefijo?: string };
  plantilla?: { cli?: Reg; pol?: Reg | null };
};

export const datosCliente = (c: Reg): Datos => ({
  nombre: txt(c, 'nombre'), tel: telDe(c), codPais: txt(c, 'codPais') || '507', email: txt(c, 'email'),
  wa: [{ motivo: 'Manual', msg: waCliente(c) }], correo: correoCliente(c),
  registro: { modulo: 'clientes', id: c.id }, plantilla: { cli: c },
});

export const datosProspecto = (p: Reg): Datos => ({
  nombre: txt(p, 'nombre'), tel: telDe(p), codPais: txt(p, 'codPais') || '507', email: txt(p, 'email'),
  wa: [{ motivo: 'Manual', msg: waProspecto(p) }], correo: correoProspecto(p),
  registro: { modulo: 'prospectos', id: p.id }, plantilla: { cli: p },
});

export function datosPoliza(p: Reg, c: Cart, hoy = new Date()): Datos {
  const cl = porId(c.clientes, txt(p, 'clienteId'));
  return {
    nombre: txt(cl, 'nombre') || txt(p, 'nombreCliente'), tel: telDe(cl) || txt(p, 'celCliente') || txt(p, 'telAsegurado'),
    codPais: txt(cl, 'codPais') || '507', email: txt(cl, 'email') || txt(p, 'emailCliente'),
    wa: [
      { motivo: 'Renovación', msg: waRenovacion(p, cl, hoy) },
      { motivo: 'Cobro', msg: waCobro(p, cl) },
      { motivo: 'Póliza', msg: waPoliza(p, cl) },
    ],
    correo: correoPoliza(p, cl, hoy),
    registro: cl ? { modulo: 'clientes', id: cl.id, prefijo: `Póliza ${txt(p, 'num')}` } : undefined,
    plantilla: { cli: cl, pol: p },
  };
}

export function datosPago(pago: Reg, c: Cart): Datos {
  const pol = porId(c.polizas, txt(pago, 'polizaId'));
  const cl = porId(c.clientes, txt(pol, 'clienteId'));
  return {
    nombre: txt(cl, 'nombre') || txt(pago, 'cliente'), tel: telDe(cl), codPais: txt(cl, 'codPais') || '507', email: txt(cl, 'email'),
    wa: [{ motivo: 'Pago', msg: waPago(cl, pago) }, ...(pol ? [{ motivo: 'Cobro', msg: waCobro(pol, cl) }] : [])],
    correo: correoPago(cl, pago),
    registro: cl ? { modulo: 'clientes', id: cl.id, prefijo: 'Pago' } : undefined,
    plantilla: { cli: cl, pol: pol ?? null },
  };
}

export function datosSiniestro(s: Reg, c: Cart): Datos {
  const cl = porId(c.clientes, txt(s, 'clienteId'));
  return {
    nombre: txt(cl, 'nombre') || txt(s, 'cliente') || txt(s, 'asegurado'), tel: telDe(cl) || txt(s, 'cel'),
    codPais: txt(cl, 'codPais') || '507', email: txt(cl, 'email') || txt(s, 'emailCliente'),
    wa: [{ motivo: 'Siniestro', msg: waSiniestro(s, cl) }], correo: correoSiniestro(s, cl),
    registro: cl ? { modulo: 'clientes', id: cl.id, prefijo: `Siniestro ${txt(s, 'numCia') || txt(s, 'numSin')}` } : undefined,
    plantilla: { cli: cl },
  };
}

export function datosVehiculo(v: Reg, c: Cart): Datos {
  const cl = porId(c.clientes, txt(v, 'clienteId'));
  return {
    nombre: txt(cl, 'nombre') || txt(v, 'clienteNom'), tel: telDe(cl) || txt(v, 'cel'), codPais: txt(cl, 'codPais') || '507', email: txt(cl, 'email'),
    wa: [...(txt(v, 'soat') ? [{ motivo: 'SOAT', msg: waSoat(v, cl) }] : []), { motivo: 'Vehículo', msg: waVehiculo(v, cl) }],
    correo: correoVehiculo(v, cl),
    registro: cl ? { modulo: 'clientes', id: cl.id, prefijo: `Placa ${txt(v, 'placa')}` } : undefined,
    plantilla: { cli: cl },
  };
}

/** Tareas: contacto del cliente o prospecto relacionado (tipoRel/relId o clienteId) */
export function datosTarea(t: Reg, c: Cart): Datos | null {
  const tipo = txt(t, 'tipoRel');
  const rel = tipo === 'prospecto' ? porId(c.prospectos, txt(t, 'relId'))
    : porId(c.clientes, txt(t, 'relId') || txt(t, 'clienteId')) ?? porId(c.prospectos, txt(t, 'prospectoId'));
  if (!rel) return null;
  const esPros = c.prospectos.includes(rel);
  const nombre = txt(rel, 'nombre');
  return {
    nombre, tel: telDe(rel), codPais: txt(rel, 'codPais') || '507', email: txt(rel, 'email'),
    wa: [{ motivo: 'Tarea', msg: waTarea(t, nombre) }], correo: correoTarea(t, nombre),
    registro: { modulo: esPros ? 'prospectos' : 'clientes', id: rel.id, prefijo: 'Tarea' },
    plantilla: { cli: rel },
  };
}
