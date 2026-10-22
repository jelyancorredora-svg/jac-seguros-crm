import { guardarRegistro, registrarAccion, txt, type Cartera, type Reg } from './datos';
import { hoyISO, normalizar } from './formato';
import { polizaCancelada } from './reglas';

/* Mismas etapas y colores que el Pipeline del CRM web (PIPE_ETAPAS) */
export const PIPE_ETAPAS: Array<{ id: string; label: string; color: string }> = [
  { id: 'Contacto inicial', label: '📞 Contacto', color: '#1D4ED8' },
  { id: 'Prospecto', label: '🎯 Prospecto', color: '#64748B' },
  { id: 'Calificación', label: '🔍 Calificación', color: '#7E22CE' },
  { id: 'Cotización', label: '📊 Cotización', color: '#0891B2' },
  { id: 'Propuesta enviada', label: '📧 Propuesta', color: '#D97706' },
  { id: 'Negociación', label: '🤝 Negociación', color: '#EA580C' },
  { id: 'Cierre', label: '🔐 Cierre', color: '#166534' },
  { id: 'Cliente ganado', label: '✅ Ganado', color: '#15803D' },
  { id: 'Perdido', label: '❌ Perdido', color: '#B91C1C' },
];

/* Reglas por defecto del CRM web si no hay reglas guardadas */
const REGLAS_BASE = [
  { tiene: 'AUTOS/VEHÍCULOS', ofrecer: 'SOAT', msg: 'Tiene auto → necesita SOAT' },
  { tiene: 'AUTOS/VEHÍCULOS', ofrecer: 'ACCIDENTES PERSONALES', msg: 'Tiene auto → AP conductor' },
  { tiene: 'MOTOS', ofrecer: 'SOAT', msg: 'Tiene moto → necesita SOAT de moto' },
  { tiene: 'MOTOS', ofrecer: 'ACCIDENTES PERSONALES', msg: 'Tiene moto → AP rider' },
  { tiene: 'INCENDIO Y LÍNEAS ALIADAS', ofrecer: 'HOGAR', msg: 'Tiene incendio → Hogar completo' },
  { tiene: 'VIDA', ofrecer: 'SALUD/MÉDICOS', msg: 'Tiene Vida → Salud/Médicos' },
  { tiene: 'SALUD/MÉDICOS', ofrecer: 'VIDA', msg: 'Tiene Salud → Vida' },
  { tipo: 'Empresa', ofrecer: 'RESPONSABILIDAD CIVIL', msg: 'Empresa sin RC → oportunidad' },
  { tipo: 'Empresa', ofrecer: 'SALUD/MÉDICOS', msg: 'Empresa sin colectivo médico' },
];

export type OportunidadVC = { cliente: Reg; ramo: string; mensaje: string; tiene: string; score: number };

/** Igual que computeVC() del web: clientes a los que les falta un ramo complementario */
export function ventaCruzada(c: Cartera): OportunidadVC[] {
  const reglas = c.meta.vcReglas.length ? c.meta.vcReglas : REGLAS_BASE;
  const polsPor = new Map<string, Reg[]>();
  for (const p of c.polizas) {
    if (polizaCancelada(p)) continue;
    const id = txt(p, 'clienteId');
    if (!id) continue;
    if (!polsPor.has(id)) polsPor.set(id, []);
    polsPor.get(id)!.push(p);
  }
  const out: OportunidadVC[] = [];
  for (const cl of c.clientes) {
    const pols = polsPor.get(cl.id) ?? [];
    const ramos = new Set(pols.map((p) => txt(p, 'ramo')));
    for (const r of reglas) {
      if (!r.ofrecer) continue;
      const aplica = (r.tiene && ramos.has(r.tiene) && !ramos.has(r.ofrecer)) ||
        (r.tipo && !r.tiene && txt(cl, 'tipo') === r.tipo && !ramos.has(r.ofrecer));
      const yaEnPipeline = c.prospectos.some((p) => txt(p, 'clienteIdVinculado') === cl.id && p.esVentaCruzada &&
        Array.isArray(p.interes) && (p.interes as string[]).includes(r.ofrecer!) && txt(p, 'etapaVenta') !== 'Perdido');
      if (aplica && !yaEnPipeline) {
        out.push({ cliente: cl, ramo: r.ofrecer, mensaje: r.msg ?? '', tiene: r.tiene ?? '',
          score: Math.min(99, pols.length * 15 + (txt(cl, 'tipo') === 'Empresa' ? 20 : 0)) });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/** "Al Pipeline": crea el prospecto de venta cruzada con el mismo formato que el web */
export async function llevarAPipeline(o: OportunidadVC): Promise<Reg> {
  const cl = o.cliente;
  const hoy = hoyISO();
  const pols = o.tiene ? `Tiene: ${o.tiene}` : '';
  return guardarRegistro('prospectos', null, {
    nombre: txt(cl, 'nombre') || '—', tipoDoc: 'Cédula', cedula: txt(cl, 'cedula'), cel: txt(cl, 'cel'), tel: txt(cl, 'tel'),
    email: txt(cl, 'email'), fNac: '', genero: '', ocupacion: '', ciudad: txt(cl, 'ciudad'), provincia: txt(cl, 'provincia'),
    tipo: txt(cl, 'tipo') || 'Personal', fuente: 'Venta Cruzada', etapaVenta: 'Contacto inicial', prioridad: 'Media',
    probabilidad: 40, montoEstimado: 0, asegPreferida: '', interes: [o.ramo], fContacto: hoy, fSeguimiento: '',
    asegActual: '', venceActual: '', notas: `${o.mensaje}\n\nPortafolio actual: ${pols}`, etiquetas: ['ET12'],
    esVentaCruzada: true, clienteIdVinculado: cl.id, clienteNom: txt(cl, 'nombre'),
    historial: [{ fecha: hoy, accion: '✨ Oportunidad de venta cruzada', resultado: o.mensaje, tipo: 'sistema' }],
    tareas: [], archivos: [],
  });
}

/**
 * Avanza la etapa como advPros() del web: deja constancia en el historial y,
 * si queda "Cliente ganado", lo convierte en cliente (si no existe ya).
 */
export async function avanzarEtapa(c: Cartera, p: Reg, etapa: string): Promise<{ prospecto: Reg; cliente?: Reg; mensaje: string }> {
  let prospecto = await registrarAccion('prospectos', p.id, { accion: '→ Avance: ' + etapa, resultado: '', tipo: 'etapa' }, { etapaVenta: etapa });
  if (etapa !== 'Cliente ganado') return { prospecto, mensaje: '✓ Etapa: ' + etapa };
  const ced = txt(p, 'cedula').trim();
  const existe = c.clientes.find((x) => (ced && txt(x, 'cedula') === ced) || normalizar(txt(x, 'nombre')) === normalizar(txt(p, 'nombre')));
  if (existe) return { prospecto, mensaje: '✅ Prospecto ganado — cliente ya existe' };
  const cliente = await guardarRegistro('clientes', null, {
    nombre: txt(p, 'nombre'), cedula: ced, tipoDoc: txt(p, 'tipoDoc') || 'Cédula', tipo: txt(p, 'tipo') || 'Personal',
    cel: txt(p, 'cel'), tel: txt(p, 'tel'), email: txt(p, 'email'), fNac: txt(p, 'fNac'), genero: txt(p, 'genero'),
    ocupacion: txt(p, 'ocupacion'), ciudad: txt(p, 'ciudad'), provincia: txt(p, 'provincia'), estadoComercial: 'activo',
    estadoCli: 'activo', origenCliente: txt(p, 'fuente'),
    categorias: Array.isArray(p.interes) ? (p.interes as string[]).join(', ') : '',
    obs: `Convertido desde Prospecto el ${hoyISO()}\n${txt(p, 'notas')}`, etiquetas: Array.isArray(p.etiquetas) ? p.etiquetas : [],
    archivos: Array.isArray(p.archivos) ? p.archivos : [], alias: '', historialWA: [],
  });
  prospecto = await guardarRegistro('prospectos', p.id, { clienteIdVinculado: cliente.id });
  return { prospecto, cliente, mensaje: `✅ ${txt(p, 'nombre')} convertido a cliente automáticamente` };
}
