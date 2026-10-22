/*
 * Motor del "Cotizador Pro" del CRM web (pg-cotp): las mismas reglas de
 * cotpCalcAll, cotpCalcDeprec, cotpCalcEdad, cotpShowVidaNote y los mensajes
 * de WhatsApp / correo. Funciones puras (sin DOM ni red): por eso tienen pruebas.
 */
import { COTP_ASEG, COTP_RAMOS, COTP_RATES, type AsegCot, type RamoCot, type TablaAseg, type Tarifa } from './cotizadorDatos';

export { COTP_ASEG, COTP_AUTOS_PRECIOS, COTP_RAMOS, COTP_RATES } from './cotizadorDatos';
export type { AsegCot, RamoCot, Tarifa } from './cotizadorDatos';

export type FormaPago = 'anual' | 'semestral' | 'trimestral' | 'mensual';
export type Orden = 'prima' | 'rating' | 'com';

/** Formato de dinero del web: $1,234.56 */
export function fM(n: number | null | undefined): string {
  return typeof n === 'number' && isFinite(n) ? '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '—';
}

/** Nombre del ramo en las polizas del CRM (mapa ramoCOTZ del web, invertido) */
export const RAMO_CRM: Record<string, string> = {
  autos: 'AUTOS/VEHÍCULOS', salud: 'SALUD/MÉDICOS', vida: 'VIDA', hogar: 'INCENDIO Y LÍNEAS ALIADAS', ap: 'ACCIDENTES PERSONALES',
  soat: 'SOAT', rc: 'RESPONSABILIDAD CIVIL', robo: 'ROBO/HURTO', transporte: 'TRANSPORTE', fianzas: 'FIANZAS',
};

export const ramoPorId = (id: string | null): RamoCot | undefined => COTP_RAMOS.find((r) => r.id === id);
export const asegPorId = (id: string): AsegCot | undefined => COTP_ASEG.find((a) => a.id === id);

/* ---------------- opciones del paso 2 (cotpBuildRamoFields) ---------------- */

export const SUBS: Record<string, { etiqueta: string; opciones: Array<[string, string]>; inicial?: string }> = {
  autos: { etiqueta: 'Tipo de cobertura', opciones: [['cobertura_completa', 'Cobertura Completa'], ['danos_terceros', 'Daños a Terceros']] },
  salud: { etiqueta: 'Plan', opciones: [['individual', 'Individual'], ['familiar', 'Familiar']] },
  vida: {
    etiqueta: 'Plazo (años)', inicial: 'temporal_20',
    opciones: [['temporal_10', 'Temporal 10 años'], ['temporal_20', 'Temporal 20 años'], ['temporal_30', 'Temporal 30 años'],
      ['vitalicio', 'Vitalicio'], ['vida_universal', 'Vida Universal (valor en efectivo)']],
  },
  hogar: { etiqueta: 'Tipo de propiedad', opciones: [['casa', 'Casa propia'], ['apartamento', 'Apartamento'], ['comercial', 'Local comercial']] },
  ap: { etiqueta: 'Actividad laboral', opciones: [['oficina', 'Trabajo de oficina'], ['campo', 'Trabajo de campo'], ['alto_riesgo', 'Alto riesgo']] },
  soat: { etiqueta: 'Tipo de vehículo', opciones: [['auto', 'Automóvil'], ['moto', 'Motocicleta'], ['camion', 'Camión/Bus']] },
  rc: { etiqueta: 'Tipo de actividad', opciones: [['comercial', 'Comercial/empresarial'], ['profesional', 'Responsabilidad profesional'], ['personal', 'Personal']] },
  transporte: { etiqueta: 'Tipo de transporte', opciones: [['terrestre', 'Terrestre'], ['maritimo', 'Marítimo'], ['aereo', 'Aéreo']] },
  viaje: {
    etiqueta: 'Destino',
    opciones: [['latam', 'Latinoamérica / Caribe'], ['norteamerica', 'Norteamérica (EE.UU./Canadá)'], ['europa', 'Europa (incl. Schengen)'], ['mundial', 'Mundial (cobertura global)']],
  },
  fianzas: {
    etiqueta: 'Tipo de fianza',
    opciones: [['cumplimiento', 'Fiel cumplimiento de contrato'], ['licitacion', 'Garantía de licitación (Bid Bond)'], ['advance', 'Advance Payment Bond (anticipo)']],
  },
  cyb: { etiqueta: 'Tipo de empresa', opciones: [['pyme', 'PYME'], ['mediana', 'Mediana empresa'], ['grande', 'Gran empresa']] },
};

export const subInicial = (ramo: string): string => {
  const s = SUBS[ramo];
  return s ? (s.inicial ?? s.opciones[0][0]) : '';
};

/** Campo de valor (id cotp-val del web) por ramo: etiqueta y ejemplo */
export const CAMPO_VALOR: Record<string, [string, string]> = {
  autos: ['Valor actual del vehículo (USD)', '15000'],
  salud: ['Edad del asegurado', '35'],
  vida: ['Suma asegurada (USD)', '100000'],
  hogar: ['Valor de la propiedad (USD)', '80000'],
  ap: ['Suma asegurada (USD)', '50000'],
  rc: ['Suma asegurada (USD)', '100000'],
  robo: ['Valor de los bienes (USD)', '20000'],
  transporte: ['Valor de la mercancía (USD)', '50000'],
  viaje: ['Días de viaje', '14'],
  fianzas: ['Monto de la fianza (USD)', '100000'],
  cyb: ['Suma asegurada (USD)', '250000'],
};

export const FORMAS_PAGO: Array<[FormaPago, string]> = [
  ['anual', 'Anual (1 pago)'], ['semestral', 'Semestral (2 pagos/año)'], ['trimestral', 'Trimestral (4 pagos/año)'], ['mensual', 'Mensual (12 pagos/año)'],
];
export const FP_CORTO: Record<FormaPago, string> = { anual: 'año', semestral: 'sem.', trimestral: 'trim.', mensual: 'mes' };
export const FP_LARGO: Record<FormaPago, string> = { anual: 'año', semestral: 'semestre', trimestral: 'trimestre', mensual: 'mes' };
export const FP_TABLA: Record<FormaPago, string> = { anual: 'Anual', semestral: 'Semestral', trimestral: 'Trimestral', mensual: 'Mensual' };
export const FP_INFORME: Record<FormaPago, string> = {
  anual: 'anual', semestral: 'semestral (2 cuotas/año)', trimestral: 'trimestral (4 cuotas/año)', mensual: 'mensual (12 cuotas/año)',
};

/* ---------------- edad y depreciacion ---------------- */

/** Edad cumplida a partir de 'AAAA-MM-DD' (cotpCalcEdad). null si no hay fecha valida. */
export function edadDesde(iso: string, hoy: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const y = +m[1], mo = +m[2] - 1, d = +m[3];
  let e = hoy.getFullYear() - y;
  if (hoy.getMonth() < mo || (hoy.getMonth() === mo && hoy.getDate() < d)) e--;
  return e;
}

/** Tabla de depreciacion SSRP Panama (cotpCalcDeprec) */
export function depreciacion(anio: number, valor: number, anioActual = new Date().getFullYear()): { edad: number; pct: number; valor: number } | null {
  if (!anio || !valor) return null;
  const edad = Math.max(0, anioActual - anio);
  let pct: number;
  if (edad === 0) pct = 0;
  else if (edad === 1) pct = 0.2;
  else if (edad === 2) pct = 0.32;
  else if (edad === 3) pct = 0.42;
  else if (edad === 4) pct = 0.5;
  else if (edad === 5) pct = 0.57;
  else pct = Math.min(0.8, 0.57 + (edad - 5) * 0.05);
  return { edad, pct, valor: Math.round(valor * (1 - pct)) };
}

/** Nota de tarifa por edad en Vida (cotpShowVidaNote) */
export function notaVida(edad: number): string {
  const tiers: Array<[number, string]> = [
    [25, '👶 Menor de 25 — tarifa muy baja (clasificación juvenil)'],
    [30, '🟢 25-30 años — tarifa baja (mejor período para contratar)'],
    [35, '🟡 31-35 años — tarifa estándar'],
    [40, '🟡 36-40 años — tarifa moderada (+40% vs. 30 años)'],
    [45, '🟠 41-45 años — tarifa media-alta (+100% vs. 30 años)'],
    [50, '🔴 46-50 años — tarifa alta (+195% vs. 30 años)'],
    [55, '🔴 51-55 años — tarifa muy alta (+330% vs. 30 años)'],
    [60, '🚨 56-60 años — tarifa premium (+550% vs. 30 años)'],
    [71, '🚨 61-70 años — tarifa máxima (riesgo elevado)'],
  ];
  const t = tiers.find(([max]) => edad <= max);
  return t ? t[1] : 'Edad fuera de rango (18-70 años)';
}

/* ---------------- tarifas disponibles (cotpBuildAsegGrid / cotpCalcAll) ---------------- */

const esTarifa = (x: unknown): x is Tarifa =>
  !!x && typeof x === 'object' && ('tasa' in x || 'fijo' in x || 'fijo_dia' in x || 'base' in x);

/** Tabla aseguradora → tarifa que aplica al ramo y sub-ramo elegidos */
export function fuenteTarifas(ramo: string, sub: string | null): TablaAseg {
  const mapa = (COTP_RATES[ramo] ?? {}) as Record<string, unknown>;
  if (sub && mapa[sub] && !esTarifa(mapa[sub])) return mapa[sub] as TablaAseg;
  const claves = Object.keys(mapa);
  if (!claves.length) return {};
  if (esTarifa(mapa[claves[0]])) return mapa as TablaAseg;
  return (mapa[claves[0]] ?? {}) as TablaAseg;
}

/** Aseguradoras con tarifa para el ramo (en el orden de la tabla del web) */
export const asegDisponibles = (ramo: string, sub: string | null): string[] =>
  Object.keys(fuenteTarifas(ramo, sub)).filter((id) => asegPorId(id));

/* ---------------- calculo (cotpCalcAll) ---------------- */

export type EntradaCot = {
  ramo: string;
  sub: string | null;
  /** Campo "valor" del ramo (suma, valor del auto, dias de viaje; en Salud es la edad) */
  valor: number;
  /** Autos: calcular sobre valor actual o depreciado */
  modoValor?: 'actual' | 'depreciado';
  /** Autos: año del vehiculo (para el valor depreciado) */
  anio?: number;
  /** Vida: edad del asegurado */
  edadVida?: number;
  /** Salud familiar: dependientes */
  deps?: number;
  /** Viaje: numero de viajeros */
  viajeros?: number;
  fpago: FormaPago;
  aseguradoras: string[];
  /** % de comision JAC sobre prima neta (editable; 15 por defecto, como el web) */
  comPct?: number;
  anioActual?: number;
};

export type ResultadoCot = {
  asegId: string;
  aseg: AsegCot;
  rates: Tarifa;
  primaNeta: number;
  itbmsAmt: number;
  primaTotal: number;
  com: number;
  cuota: number;
  cuotasNum: number;
  fpago: FormaPago;
  deducible: string;
  cobertura: string;
  ratingScore: number;
};

export const CUOTAS: Record<FormaPago, number> = { anual: 1, semestral: 2, trimestral: 4, mensual: 12 };
const RATING_SCORE: Record<string, number> = { 'A++': 6, 'A+': 5, A: 4, 'A-': 3, 'BBB+': 2, BBB: 1 };

/** Factor de edad Vida (tabla actuarial simplificada del web) */
export function factorEdadVida(a: number): number {
  if (a <= 25) return 0.65;
  if (a <= 30) return 0.82;
  if (a <= 35) return 1.0;
  if (a <= 40) return 1.4;
  if (a <= 45) return 2.0;
  if (a <= 50) return 2.95;
  if (a <= 55) return 4.3;
  if (a <= 60) return 6.5;
  return 9.5;
}
const AP_OCUPACION: Record<string, number> = { oficina: 1.0, campo: 2.4, alto_riesgo: 5.0 };
const PLAZO_VIDA: Record<string, number> = { temporal_10: 0.78, temporal_20: 1.0, temporal_30: 1.22, vitalicio: 2.0, vida_universal: 2.8 };
const HOGAR: Record<string, number> = { casa: 1.0, apartamento: 0.85, comercial: 1.35 };
const RC: Record<string, number> = { comercial: 1.0, profesional: 1.3, personal: 0.65 };
const CYB: Record<string, number> = { pyme: 0.65, mediana: 1.0, grande: 1.8 };
const factorEdadSalud = (e: number, ef: number) => 1 + Math.max(0, e - 30) * ef * (e > 50 ? 1.8 : e > 40 ? 1.3 : 1.0);

/** Valor sobre el que se calcula (en Autos puede ser el depreciado) */
export function valorUsado(e: EntradaCot): number {
  if (e.ramo === 'autos' && e.modoValor === 'depreciado') {
    const d = depreciacion(e.anio ?? 0, e.valor, e.anioActual);
    if (d && d.valor) return d.valor;
  }
  return e.valor;
}

/** Prima neta anual de una aseguradora, antes de ITBMS */
export function primaNetaDe(asegId: string, rates: Tarifa, e: EntradaCot): number {
  const { ramo, sub } = e;
  const val = valorUsado(e);
  let neta = 0;
  if (rates.fijo_dia) {
    // VIAJE: tarifa/dia × dias × viajeros
    neta = rates.fijo_dia * Math.max(1, val) * Math.max(1, e.viajeros || 1);
  } else if (rates.fijo) {
    // Precio fijo (SOAT, daños a terceros)
    neta = rates.fijo;
  } else if (rates.base && rates.edad_factor !== undefined) {
    // SALUD: base mensual × 12 × factor edad × factor dependientes (la edad va en el campo valor)
    const edad = Math.trunc(e.valor) || 35;
    neta = rates.base * 12 * factorEdadSalud(edad, rates.edad_factor) * (1 + (e.deps || 0) * 0.58);
  } else if (rates.tasa) {
    const v = val || 50000;
    if (ramo === 'vida') {
      const edad = Math.trunc(e.edadVida ?? 0) || 35;
      neta = v * tasaVida(asegId, rates, e.sub) * factorEdadVida(edad) * (PLAZO_VIDA[sub ?? ''] || 1.0);
    } else if (ramo === 'ap') neta = v * rates.tasa * (AP_OCUPACION[sub ?? ''] || 1.0);
    else if (ramo === 'hogar') neta = v * rates.tasa * (HOGAR[sub ?? ''] || 1.0);
    else if (ramo === 'rc') neta = v * rates.tasa * (RC[sub ?? ''] || 1.0);
    else if (ramo === 'cyb') neta = v * rates.tasa * (CYB[sub ?? ''] || 1.0);
    else neta = v * rates.tasa;
  }
  // Calibracion JAC: prima fija de emision + prima minima de la aseguradora
  if (rates.base) neta += rates.base;
  if (rates.minimo && neta < rates.minimo) neta = rates.minimo;
  return neta;
}

/** Vida Universal usa la tasa de la tabla vida_universal si la aseguradora la tiene */
function tasaVida(asegId: string, rates: Tarifa, sub: string | null): number {
  const vu = (COTP_RATES.vida_universal as TablaAseg)[asegId];
  return vu && sub === 'vida_universal' && vu.tasa ? vu.tasa : rates.tasa ?? 0;
}

/** Calcula el comparativo; ordenado por prima total (de menor a mayor) */
export function calcular(e: EntradaCot): ResultadoCot[] {
  const fuente = fuenteTarifas(e.ramo, e.sub);
  const pct = (e.comPct ?? 15) / 100;
  const out: ResultadoCot[] = [];
  for (const asegId of e.aseguradoras) {
    const rates = fuente[asegId];
    const aseg = asegPorId(asegId);
    if (!rates || !aseg) continue;
    const primaNeta = primaNetaDe(asegId, rates, e);
    const itbmsAmt = primaNeta * rates.itbms;
    const primaTotal = primaNeta + itbmsAmt;
    const cuotasNum = CUOTAS[e.fpago] || 1;
    out.push({
      asegId, aseg, rates, primaNeta, itbmsAmt, primaTotal, com: primaNeta * pct, cuota: primaTotal / cuotasNum, cuotasNum, fpago: e.fpago,
      deducible: rates.deducible, cobertura: rates.cobertura, ratingScore: RATING_SCORE[aseg.rating] || 1,
    });
  }
  return ordenar(out, 'prima');
}

/** cotpSortBy */
export function ordenar(rs: ResultadoCot[], campo: Orden): ResultadoCot[] {
  const c = rs.slice();
  if (campo === 'prima') c.sort((a, b) => a.primaTotal - b.primaTotal);
  else if (campo === 'rating') c.sort((a, b) => b.ratingScore - a.ratingScore);
  else c.sort((a, b) => b.com - a.com);
  return c;
}

/** cotpRecalcCom: nueva comision JAC sobre prima neta */
export const conComision = (rs: ResultadoCot[], pct: number): ResultadoCot[] => rs.map((r) => ({ ...r, com: r.primaNeta * (pct / 100) }));

/* ---------------- mensajes (WhatsApp / correo) ---------------- */

const FIRMA_WEB = 'jacsegurospa.com';

/** cotpSendWA: top 5 al telefono del cliente */
export function mensajeWAComparativo(rs: ResultadoCot[], ramo: string, nombre: string): string {
  const R = ramoPorId(ramo);
  const top = rs.slice(0, 5);
  return `Hola${nombre ? ' ' + nombre.split(' ')[0] : ''}! 👋\n\nTe comparto la cotización de *${R ? R.label : ramo}* preparada para ti:\n\n${top
    .map((r, i) => `${['⭐', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i]} *${r.aseg.nombre}*\n 💰 ${fM(r.primaTotal)}/año → ${fM(r.cuota)}/${FP_LARGO[r.fpago]}\n ⭐ ${r.aseg.rating} · ${r.deducible}`)
    .join('\n\n')}\n\n📋 Puedo enviarte el informe completo en PDF.\n¿Te interesa alguna opción?\n\n_Jely An Castro · JAC Seguros · ☎ +507 6292-6010_`;
}

/** cotpWAResult: una aseguradora */
export function mensajeWAResultado(r: ResultadoCot, nombre: string): string {
  return `Hola${nombre ? ' ' + nombre.split(' ')[0] : ''}👋\n\nTe presento la cotización de *${r.aseg.nombre}*:\n\n💰 Prima anual: *${fM(r.primaTotal)}*\n📅 Cuota: *${fM(r.cuota)}* / ${FP_LARGO[r.fpago]}\n⭐ Calificación: ${r.aseg.rating}\n🛡️ Cobertura: ${r.cobertura.slice(0, 120)}\n📋 Deducible: ${r.deducible}\n\n¿Te interesa continuar con esta opción?\n\n_Jely An Castro · JAC Seguros · +507 6292-6010_`;
}

/** cotpSendWhatsApp: mejores 3 (o una aseguradora) */
export function mensajeWAOpciones(rs: ResultadoCot[], ramo: string, nombre: string, hoy: Date = new Date()): string {
  const R = ramoPorId(ramo);
  const fecha = hoy.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  let msg = `*Cotizacion de ${R ? R.label : ramo} - JAC Seguros*\n${fecha} | Jely An Castro\n\nHola *${nombre || 'Estimado/a cliente'}*, te comparto las mejores opciones:\n\n`;
  rs.forEach((r, i) => {
    msg += `*${i + 1}. ${r.aseg.nombre}*\nPrima anual: *$${r.primaTotal.toFixed(2)}*\n`;
    if (r.cobertura) msg += r.cobertura + '\n';
    if (r.deducible) msg += 'Deducible: ' + r.deducible + '\n';
    msg += '\n';
  });
  return msg + `Para formalizar tu seguro:\n+507 6292-6010\njcastro@jacsegurospa.com\n${FIRMA_WEB}`;
}

/** cotpShareWA: top 5 con cuotas */
export function mensajeWACompartir(rs: ResultadoCot[], ramo: string, nombre: string): string {
  const R = ramoPorId(ramo);
  const f2 = (v: number) => '$' + Number(v).toLocaleString('es-PA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  let msg = `🛡️ *Cotización JAC Seguros*\n📋 Ramo: ${R?.label || ramo || 'Seguro'}\n`;
  if (nombre) msg += `👤 Nombre: ${nombre}\n`;
  msg += '\n';
  rs.slice(0, 5).forEach((r, i) => {
    msg += `*${i + 1}. ${r.aseg.nombre}*\n 💰 Prima Total: ${f2(r.primaTotal)}/año\n`;
    if (r.cuota && r.cuotasNum > 1) msg += ` 📅 ${r.cuotasNum} cuotas de ${f2(r.cuota)}\n`;
    if (r.deducible) msg += ` 🔒 Deducible: ${r.deducible}\n`;
    msg += '\n';
  });
  return msg + `✅ _Cotización válida por 30 días_\n📞 JAC Seguros · +507 6292-6010\n🌐 ${FIRMA_WEB}`;
}

/** cotpSendEmail: asunto y cuerpo */
export function correoComparativo(rs: ResultadoCot[], ramo: string, nombre: string): { asunto: string; cuerpo: string } {
  const R = ramoPorId(ramo);
  const lbl = R ? R.label : ramo;
  const top = rs.slice(0, 5);
  return {
    asunto: `Cotización de ${lbl} — JAC Seguros`,
    cuerpo: `Estimado(a) ${nombre},\n\nAdjunto el resumen de cotización de ${lbl}:\n\n${top
      .map((r, i) => `${i === 0 ? '[RECOMENDADA] ' : ''}${r.aseg.nombre}: ${fM(r.primaTotal)}/año | Rating: ${r.aseg.rating}\nCobertura: ${r.cobertura}`)
      .join('\n\n')}\n\nEstoy a su disposición para cualquier consulta.\n\nAtentamente,\nJely An Castro Pérez\nJAC Seguros — \n+507 6292-6010 | jcastro@jacsegurospa.com`,
  };
}

/** Enlace wa.me: con telefono (7-8 digitos → +507) o sin destinatario */
export function enlaceWA(tel: string, msg: string): string {
  const d = tel.replace(/\D/g, '');
  const num = d.length > 5 ? (d.length <= 8 ? '507' + d : d) : '';
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}
