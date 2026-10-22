/*
 * Calculos del modulo "💰 Comisiones" del CRM web (override window.renderCom,
 * bloque "Comisiones y Pagos, cada uno en su sitio"), de las tasas S.comRates
 * (saveComRate / delComRate / getComRate) y de la configuracion S.comisCfg
 * (jacGuardarComis, jacEditarTramos, jacResumenTramos).
 *
 * Todo es puro (sin red ni estado) para poder probarlo contra el web.
 */

type R = { id: string; [k: string]: unknown };

/* ---------------- utilidades (mismas que el web) ---------------- */

/** parseFloat del web: lo que no es numero vale 0. */
export function n(v: unknown): number {
  const x = parseFloat(String(v ?? ''));
  return isFinite(x) ? x : 0;
}
const s = (r: R | null | undefined, k: string): string => {
  const v = r?.[k];
  return v === null || v === undefined || typeof v === 'object' ? '' : String(v);
};

/** Dias transcurridos desde la fecha hasta hoy (negativo = futura). null si no hay fecha valida. */
export function diasDesde(f: unknown, hoy: string): number | null {
  if (!f) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f).slice(0, 10));
  const h = /^(\d{4})-(\d{2})-(\d{2})/.exec(hoy);
  if (!m || !h) return null;
  const d = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  if (isNaN(d)) return null;
  return Math.floor((Date.UTC(+h[1], +h[2] - 1, +h[3]) - d) / 86_400_000);
}

/* ---------------- antiguedad ---------------- */

export type ClaveTramo = 't30' | 't60' | 't90' | 't90m';
export const TRAMOS: Array<{ k: ClaveTramo; et: string; min: number; max: number; col: string }> = [
  { k: 't30', et: '0 a 30 días', min: -99999, max: 30, col: '#0891B2' },
  { k: 't60', et: '31 a 60 días', min: 31, max: 60, col: '#D97706' },
  { k: 't90', et: '61 a 90 días', min: 61, max: 90, col: '#EA580C' },
  { k: 't90m', et: 'más de 90 días', min: 91, max: 99999, col: '#B91C1C' },
];

export function tramoDe(d: number | null): ClaveTramo {
  if (d === null) return 't30';
  for (const t of TRAMOS) if (d >= t.min && d <= t.max) return t.k;
  return 't90m';
}

/** Color de la antiguedad en la fila (filaCom). */
export function colorDias(d: number | null): string {
  return d === null ? '#94A3B8' : d > 90 ? '#B91C1C' : d > 60 ? '#EA580C' : d > 30 ? '#D97706' : '#0891B2';
}
/** "12d", "en 3d" o "—" */
export function textoDias(d: number | null): string {
  return d === null ? '—' : d < 0 ? `en ${-d}d` : `${d}d`;
}

export type ConDias<T> = { r: T; dias: number | null };
export type Grupos<T> = Record<ClaveTramo, { filas: Array<ConDias<T>>; total: number }>;

export function agrupar<T extends R>(filas: T[], campoFecha: string, campoMonto: string, hoy: string): Grupos<T> {
  const g = {} as Grupos<T>;
  for (const t of TRAMOS) g[t.k] = { filas: [], total: 0 };
  for (const f of filas) {
    const d = diasDesde(f[campoFecha], hoy);
    const k = tramoDe(d);
    g[k].filas.push({ r: f, dias: d });
    g[k].total += n(f[campoMonto]);
  }
  return g;
}

/* ---------------- comisiones: estado y KPIs ---------------- */

export const cobrada = (c: R) => c.estado === 'cobrada';

/** Polizas que cuentan para "mi comision de cartera": todo menos canceladas y renovadas. */
export function polizaCuenta(p: R): boolean {
  const e = s(p, 'estado').toLowerCase();
  return e !== 'cancelada' && e !== 'renovada';
}

export type Kpis = {
  nPolizas: number; carteraAnual: number;
  nPend: number; tPend: number; nCob: number; tCob: number; tMes: number;
};

export function kpis(polizas: R[], comisiones: R[], hoy: string): Kpis {
  const vig = polizas.filter(polizaCuenta);
  const pend = comisiones.filter((c) => !cobrada(c));
  const cob = comisiones.filter(cobrada);
  const mes = hoy.slice(0, 7);
  return {
    nPolizas: vig.length,
    carteraAnual: vig.reduce((a, p) => a + n(p.comision), 0),
    nPend: pend.length,
    tPend: pend.reduce((a, c) => a + n(c.monto), 0),
    nCob: cob.length,
    tCob: cob.reduce((a, c) => a + n(c.monto), 0),
    tMes: cob.filter((c) => String(c.fechaCobro || c.fecha || '').slice(0, 7) === mes).reduce((a, c) => a + n(c.monto), 0),
  };
}

/** Vista "Por cobrar" / "Cobradas": tarjetas por tramo y la lista (mas antigua primero). */
export function vistaCobro<T extends R>(comisiones: T[], vista: 'cobrar' | 'cobradas', tramo: ClaveTramo | '', hoy: string) {
  const base = comisiones.filter((c) => (vista === 'cobrar' ? !cobrada(c) : cobrada(c)));
  const campo = vista === 'cobrar' ? 'fecha' : base.some((c) => c.fechaCobro) ? 'fechaCobro' : 'fecha';
  const grupos = agrupar(base, campo, 'monto', hoy);
  const todas = TRAMOS.flatMap((t) => grupos[t.k].filas);
  // mismo orden que el web: la lista conserva el orden original y luego se ordena por dias
  const orden = new Map(base.map((c, i) => [c, i]));
  const lista = (tramo ? grupos[tramo].filas.slice() : todas.sort((a, b) => orden.get(a.r)! - orden.get(b.r)!))
    .sort((a, b) => (b.dias || 0) - (a.dias || 0));
  return { grupos, lista };
}

/* ---------------- por poliza / por aseguradora ---------------- */

export type FilaPol<T> = { p: T; nom: string; com: number; prima: number; pct: number; part: number };

export function porPoliza<T extends R>(polizas: T[], clientes: R[]) {
  const cli = new Map(clientes.map((c) => [c.id, c]));
  const filas: Array<FilaPol<T>> = polizas.filter(polizaCuenta).map((p) => ({
    p,
    nom: s(cli.get(s(p, 'clienteId')), 'nombre') || s(p, 'nombreCliente') || '—',
    com: n(p.comision),
    prima: n(p.prima),
    pct: n(p.comPct),
    part: n(p.participacion) || 100,
  })).sort((a, b) => b.com - a.com);
  return {
    filas,
    tPrima: filas.reduce((a, r) => a + r.prima, 0),
    tCom: filas.reduce((a, r) => a + r.com, 0),
  };
}

export type FilaAseg = { aseg: string; n: number; prima: number; com: number; pctEfectivo: number };

export function porAseguradora(polizas: R[]): FilaAseg[] {
  const m = new Map<string, FilaAseg>();
  for (const p of polizas.filter(polizaCuenta)) {
    const k = s(p, 'aseg') || 'Sin aseguradora';
    if (!m.has(k)) m.set(k, { aseg: k, n: 0, prima: 0, com: 0, pctEfectivo: 0 });
    const a = m.get(k)!;
    a.n++;
    a.prima += n(p.prima);
    a.com += n(p.comision);
  }
  return [...m.values()]
    .map((a) => ({ ...a, pctEfectivo: a.prima ? (a.com / a.prima) * 100 : 0 }))
    .sort((a, b) => b.com - a.com);
}

/** Primeras tres palabras del nombre (como se muestra en el web). */
export const nombreCorto = (x: string) => x.split(' ').slice(0, 3).join(' ');

/* ---------------- de que poliza y de que cliente es cada linea ---------------- */

export function normNum(x: unknown): string {
  return String(x || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/g, '');
}

export type Origen<P, C> = { pol: P | null; cli: C | null; cliNombre: string };

/** Igual que window.jacOrigenCobro: por polizaId, por numero de poliza en el texto y por nombre. */
export function crearOrigen<P extends R, C extends R>(polizas: P[], clientes: C[]) {
  const porId = new Map(polizas.map((p) => [p.id, p]));
  const nums = polizas.map((p) => [normNum(p.num), p] as const);
  const cliId = new Map(clientes.map((c) => [c.id, c]));
  const cliNom = new Map<string, C>();
  for (const c of clientes) {
    const k = s(c, 'nombre').toLowerCase();
    if (!cliNom.has(k)) cliNom.set(k, c);
  }
  function polPorNumero(txt: unknown): P | null {
    if (!txt) return null;
    const cand = String(txt).match(/[0-9][0-9A-Za-z._\-/]{5,}/g) || [];
    for (const c of cand) {
      const x = normNum(c);
      if (x.length < 6) continue;
      for (const [pn, p] of nums) {
        if (pn && (pn === x || (pn.length >= 8 && x.length >= 8 && (pn.indexOf(x) === 0 || x.indexOf(pn) === 0)))) return p;
      }
    }
    return null;
  }
  return function origen(r: R): Origen<P, C> {
    let pol: P | null = null;
    let cli: C | null = null;
    if (r.polizaId) pol = porId.get(String(r.polizaId)) ?? null;
    if (!pol && r.numeroPol) pol = polPorNumero(r.numeroPol);
    if (!pol) pol = polPorNumero(r.titulo) || polPorNumero(r.desc) || polPorNumero(r.notas);
    const cid = (pol && s(pol, 'clienteId')) || s(r, 'clienteId');
    if (cid) cli = cliId.get(cid) ?? null;
    let cliNombre = cli ? s(cli, 'nombre') : '';
    if (!cli) {
      const nom = s(r, 'clienteNom') || s(r, 'cliente') || (pol ? s(pol, 'nombreCliente') : '');
      if (nom) {
        cli = cliNom.get(nom.toLowerCase()) ?? null;
        cliNombre = cli ? s(cli, 'nombre') : nom;
      }
    }
    return { pol, cli, cliNombre };
  };
}

/* ---------------- mensajes (window.jacMsgComision + jacFirma) ---------------- */

export const SSRP = 'Regulado y supervisado por la Superintendencia de Seguros y Reaseguros de Panamá.';
export const FIRMA = '\n\n————————————\n'
  + '*JAC Seguros* | Jely An Castro, corredora de seguros\n'
  + '📞 +507 6292-6010\n'
  + '✉️ jcastro@jacsegurospa.com\n'
  + '✉️ jelyancorredora@gmail.com\n'
  + '🌐 www.jacsegurospa.com\n'
  + '📍 Panamá\n\n'
  + '_' + SSRP + '_';

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** fmt() del web: 'AAAA-MM-DD' -> '5 oct 2026'; 'AAAA' -> 'AAAA'; si no, '—'. */
export function fmtWeb(d: unknown): string {
  const x = String(d ?? '');
  if (!x || x.length < 8) return x.length === 4 ? x : '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(x);
  return m ? `${Number(m[3])} ${MES[Number(m[2]) - 1]} ${m[1]}` : x;
}

export function msgComision(c: R, o: Origen<R, R>): string {
  const nom = (o.cliNombre || s(c, 'clienteNom')).trim().split(' ')[0] || 'buen día';
  const pol = o.pol;
  return 'Hola ' + nom + ' 👋🏼\n\n'
    + 'Te escribo para confirmar el estado de tu póliza, porque la aseguradora todavía no ha '
    + 'registrado el movimiento y quiero descartar que sea algo de tu lado.\n\n'
    + '📋 *Referencia*\n'
    + (s(pol, 'num') ? '• Póliza: ' + s(pol, 'num') + '\n' : '')
    + (s(c, 'aseg') ? '• Aseguradora: ' + s(c, 'aseg') + '\n' : '')
    + (s(pol, 'ramo') ? '• Ramo: ' + s(pol, 'ramo') + '\n' : '')
    + (s(c, 'fecha') ? '• Fecha: ' + fmtWeb(c.fecha) + '\n' : '')
    + '\n¿Me confirmas si el pago a la aseguradora ya salió de tu parte? '
    + 'Con eso reclamo yo lo que falte y tú no tienes que hacer nada más.'
    + FIRMA;
}

/** En el correo se quitan los *asteriscos* de negrita de WhatsApp. */
export const aCorreo = (t: string) => t.replace(/\*([^*\n]+)\*/g, '$1');

/* ---------------- formulario de comision (OCom / SCom) ---------------- */

export const ASEGS_BASE = ['ASSA', 'IS', 'SURA', 'MAPFRE', 'PALIG', 'UNIVIVIR', 'FEDPA', 'Ancón', 'WW Medical', 'Generali',
  'Chubb', 'La Regional', 'VUMI-LA REGIONAL DE SEGUROS', 'General'];

export function asegsFormulario(aseguradoras: Array<{ nombre?: string }>): string[] {
  const out = [...ASEGS_BASE, ...aseguradoras.map((a) => String(a?.nombre ?? '').split(',')[0].trim()).filter(Boolean)];
  return out.filter((x, i) => out.indexOf(x) === i);
}

export const RAMOS_TASA = ['Automóvil', 'Vida', 'Salud', 'Hogar', 'SOAT', 'Accidentes Personales', 'Incendio',
  'Responsabilidad Civil', 'Transporte', 'Cumplimiento', 'Multiriesgo', 'Fianzas', 'Rentas', 'Otro'];

/** Etiqueta de mes que guarda el web junto a la fecha ("octubre de 2026"). */
export function mesEtiqueta(fecha: string): string {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(fecha);
  if (!m) return '';
  const d = new Date(+m[1], m[2] ? +m[2] - 1 : 0, m[3] ? +m[3] : 1);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-PA', { month: 'long', year: 'numeric' });
}

/* ---------------- tasas S.comRates ---------------- */

export type Tasa = { aseg?: string; ramo?: string; pct?: number };

/** getComRate: primero aseguradora+ramo exacto, luego la aseguradora con ramo vacio. */
export function tasaDe(rates: Tasa[], aseg: string, ramo: string): number | null {
  let r = rates.find((x) => x.aseg === aseg && x.ramo === ramo);
  if (r) return r.pct ?? null;
  r = rates.find((x) => x.aseg === aseg && (!x.ramo || x.ramo === ''));
  return r ? (r.pct ?? null) : null;
}

/** saveComRate: actualiza si ya existe aseguradora+ramo; si no, la agrega. */
export function ponerTasa(rates: Tasa[], aseg: string, ramo: string, pct: number): Tasa[] {
  const out = rates.slice();
  const i = out.findIndex((r) => r.aseg === aseg && r.ramo === (ramo || ''));
  if (i >= 0) out[i] = { ...out[i], pct };
  else out.push({ aseg, ramo: ramo || '', pct });
  return out;
}

export function quitarTasa(rates: Tasa[], aseg: string, ramo: string): Tasa[] {
  const i = rates.findIndex((r) => (r.aseg ?? '') === aseg && (r.ramo ?? '') === (ramo ?? ''));
  return i < 0 ? rates.slice() : [...rates.slice(0, i), ...rates.slice(i + 1)];
}

/* ---------------- configuracion S.comisCfg ---------------- */

export const SEP = '||';
export const RAMOS_CFG = ['AUTOS/VEHÍCULOS', 'MOTOS', 'VIDA', 'SALUD/MÉDICOS', 'INCENDIO Y LÍNEAS ALIADAS', 'HOGAR',
  'ACCIDENTES PERSONALES', 'FIANZAS/ROBO/SUSTRACCIÓN', 'RESPONSABILIDAD CIVIL', 'SOAT', 'CUMPLIMIENTO', 'VIAJES/TURISMO'];
export const AGENCIAS_BASE = ['FF Seguros', 'Capital Care & Co'];

export type Tramo = { d: number; h: number | null; com: number };
export type EntradaCfg = { com?: number; itbms?: number; part?: number; tramos?: Tramo[]; [k: string]: unknown };
export type GrupoCfg = 'ramos' | 'asegs' | 'combos' | 'cocor';
export type ComisCfg = Record<GrupoCfg, Record<string, EntradaCfg>> & Record<string, unknown>;

/** cfg() del web: garantiza los cuatro grupos (y migra S.ramosCfg si existe). */
export function cfgNormal(c: unknown, ramosCfg?: unknown): ComisCfg {
  const o = (c && typeof c === 'object' && !Array.isArray(c) ? c : {}) as ComisCfg;
  for (const k of ['ramos', 'asegs', 'combos', 'cocor'] as const) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {};
  }
  if (ramosCfg && typeof ramosCfg === 'object' && !Array.isArray(ramosCfg)) {
    for (const [r, v] of Object.entries(ramosCfg as Record<string, EntradaCfg>)) if (!o.ramos[r]) o.ramos[r] = v;
  }
  return o;
}

export function aseguradorasCfg(aseguradoras: Array<{ nombre?: string; nom?: string }>): string[] {
  return aseguradoras.map((a) => String(a?.nombre || a?.nom || '')).filter(Boolean).sort();
}

export function agenciasCfg(c: ComisCfg): string[] {
  const out = AGENCIAS_BASE.slice();
  for (const k of Object.keys(c.cocor)) if (!out.includes(k)) out.push(k);
  return out;
}

export type Edicion = { k: string; campo: 'com' | 'itbms' | 'part'; v: string };

/** jacGuardarComis: escribe lo tecleado; vacio borra el campo; entradas vacias se quitan (salvo combinaciones). */
export function aplicarEdiciones(c: ComisCfg, grupo: GrupoCfg, ediciones: Edicion[]): ComisCfg {
  const g = c[grupo];
  for (const e of ediciones) {
    const v = e.v.trim();
    if (!g[e.k]) g[e.k] = {};
    if (v === '') delete g[e.k][e.campo];
    else g[e.k][e.campo] = parseFloat(v);
    if (!Object.keys(g[e.k]).length && grupo !== 'combos') delete g[e.k];
  }
  return c;
}

/** jacGuardarTramos: limpia, ordena y rechaza tramos que se solapan. */
export function validarTramos(tramos: Array<{ d: string | number; h: string | number | null; com: string | number }>):
  { tramos: Tramo[] } | { error: string } {
  const tr = tramos.filter((t) => t.com !== '' && t.com !== undefined && t.d !== '')
    .map((t) => ({
      d: parseInt(String(t.d), 10) || 1,
      h: t.h === '' || t.h === null || t.h === undefined ? null : parseInt(String(t.h), 10),
      com: parseFloat(String(t.com)),
    }))
    .sort((a, b) => a.d - b.d);
  for (let i = 1; i < tr.length; i++) {
    const fin = tr[i - 1].h === null ? Infinity : tr[i - 1].h!;
    if (tr[i].d <= fin) return { error: `El tramo que empieza en el año ${tr[i].d} se solapa con el anterior. Corrige los rangos.` };
  }
  return { tramos: tr };
}

export function resumenTramos(o: EntradaCfg | undefined): string {
  if (!o || !Array.isArray(o.tramos) || !o.tramos.length) return '';
  return o.tramos.map((t) => {
    const r = t.h === null || t.h === undefined ? `año ${t.d}+` : t.d === t.h ? `año ${t.d}` : `años ${t.d}-${t.h}`;
    return `${r}: ${t.com}%`;
  }).join(' · ');
}

/** jacResolverPct: combinacion > aseguradora > ramo, con tramos por año de vigencia. */
export function resolverPct(c: ComisCfg, aseg: string, ramo: string, anio = 1): { com?: number; itbms?: number; origen?: string } {
  const r: { com?: number; itbms?: number; origen?: string } = {};
  const fuentes: Array<EntradaCfg | undefined> = [];
  if (aseg && ramo) fuentes.push(c.combos[aseg + SEP + ramo]); else fuentes.push(undefined);
  if (aseg) fuentes.push(c.asegs[aseg]); else fuentes.push(undefined);
  if (ramo) fuentes.push(c.ramos[ramo]);
  const del = (o: EntradaCfg): number | undefined => {
    if (Array.isArray(o.tramos)) {
      for (const t of o.tramos) {
        const d = parseInt(String(t.d), 10) || 1;
        const h = t.h === null || t.h === undefined || (t.h as unknown) === '' ? Infinity : parseInt(String(t.h), 10);
        if (anio >= d && anio <= h && t.com !== undefined && (t.com as unknown) !== '') return parseFloat(String(t.com));
      }
    }
    return o.com !== undefined && (o.com as unknown) !== '' ? parseFloat(String(o.com)) : undefined;
  };
  fuentes.forEach((o, i) => {
    if (!o) return;
    if (r.com === undefined) {
      const v = del(o);
      if (v !== undefined) { r.com = v; r.origen = i === 0 ? 'aseguradora + ramo' : i === 1 ? 'aseguradora' : 'ramo'; }
    }
    if (r.itbms === undefined && o.itbms !== undefined && (o.itbms as unknown) !== '') r.itbms = parseFloat(String(o.itbms));
  });
  return r;
}

/* ---------------- comisiones que aun viven en Tareas ---------------- */

const esAutoCom = (t: R) => t._autoTipo === 'comision' || /^auto_comision/i.test(String(t.id || ''));
function montoDe(txt: string): number {
  const m = String(txt || '').match(/(?:B\/\.|\$)\s*([0-9][0-9.,]*)/);
  return m ? n(String(m[1]).replace(/,/g, '')) : 0;
}
const ASEGS_TXT = ['ASSA', 'INTERNACIONAL', 'SURA', 'MAPFRE', 'FEDPA', 'ANCON', 'ANCÓN', 'ACERTA', 'REGIONAL',
  'PALIG', 'UNIVIVIR', 'GENERALI', 'CHUBB', 'VUMI', 'BLUECROSS', 'BLUE CROSS', 'WW MEDICAL', 'IS', 'ISEGUROS'];
function asegDe(txt: string): string {
  const u = String(txt || '').toUpperCase();
  for (const a of ASEGS_TXT) if (u.indexOf(a) >= 0) return a;
  return '';
}

export type DesdeTareas = {
  candidatas: number; convertibles: number;
  muestra: Array<{ tit: string; monto: number; aseg: string; origen: string }>;
  nuevas: Array<Record<string, unknown>>;
  quitar: string[];
};

/** jacComisionesDesdeTareas: que tareas automaticas se pueden pasar a comision (sin duplicar). */
export function comisionesDesdeTareas(tareas: R[], comisiones: R[], origen: (r: R) => Origen<R, R>, hoy: string): DesdeTareas {
  const cand = tareas.filter(esAutoCom);
  const res: DesdeTareas = { candidatas: cand.length, convertibles: 0, muestra: [], nuevas: [], quitar: [] };
  const yaHay = new Set(comisiones.map((c) => s(c, '_tareaId')).filter(Boolean));
  for (const t of cand) {
    const txtT = s(t, 'titulo') + ' ' + s(t, 'desc');
    const monto = montoDe(txtT) || n(t.monto);
    const o = origen({ id: '', polizaId: t.polizaId || t._autoRef, titulo: t.titulo, desc: t.desc });
    const aseg = asegDe(txtT) || (o.pol ? s(o.pol, 'aseg') : '') || '';
    if (monto > 0) {
      res.convertibles++;
      if (res.muestra.length < 25) {
        res.muestra.push({ tit: s(t, 'titulo').slice(0, 58), monto, aseg, origen: o.pol ? 'N° ' + (s(o.pol, 'num') || '—') : 'sin póliza' });
      }
      if (!yaHay.has(t.id)) {
        res.nuevas.push({
          aseg: aseg || '—',
          fecha: s(t, 'fechaLimite') || s(t, 'fechaCreacion') || hoy,
          ramo: (o.pol && s(o.pol, 'ramo')) || '',
          pct: (o.pol && n(o.pol.comPct)) || null,
          monto,
          estado: 'pendiente',
          polizaId: (o.pol && o.pol.id) || '',
          clienteNom: o.cliNombre || '',
          _tareaId: t.id,
          _origen: 'tarea automática',
        });
        res.quitar.push(t.id);
      }
    } else if (res.muestra.length < 25) {
      res.muestra.push({ tit: s(t, 'titulo').slice(0, 58), monto: 0, aseg, origen: 'sin monto legible' });
    }
  }
  return res;
}

/* ---------------- exportar (exportComXLSX en CSV) ---------------- */

export function csvComisiones(polizas: R[], clientes: R[], comisiones: R[]): string {
  const cli = new Map(clientes.map((c) => [c.id, c]));
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const f2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
  const filas: unknown[][] = [['Desglose Pólizas'],
    ['Cliente', 'Ramo', 'Aseguradora', 'Prima ($)', '% Com.', '% Part.', 'Mi Comisión ($)', 'Co-Corredor ($)', 'Estado']];
  let tMi = 0;
  let tCo = 0;
  for (const p of polizas) {
    const mi = n(p.comision);
    const co = n(p.coCorCom);
    tMi += mi;
    tCo += co;
    filas.push([s(cli.get(s(p, 'clienteId')), 'nombre') || s(p, 'nombreCliente') || '—', s(p, 'ramo'), s(p, 'aseg'),
      n(p.prima), n(p.comPct), n(p.participacion) || 100, f2(mi), f2(co), s(p, 'estado')]);
  }
  filas.push(['', '', '', 'TOTAL', '', '', f2(tMi), f2(tCo), '']);
  filas.push([]);
  filas.push(['Comisiones Registradas']);
  filas.push(['Aseguradora', 'Monto ($)', 'Fecha', 'Estado', 'Fecha de cobro', 'Ramo', '%']);
  for (const c of comisiones) {
    filas.push([s(c, 'aseg'), n(c.monto), s(c, 'fecha') || s(c, 'mes'), s(c, 'estado'), s(c, 'fechaCobro'), s(c, 'ramo'), s(c, 'pct')]);
  }
  return '﻿' + filas.map((f) => f.map(q).join(',')).join('\n');
}
