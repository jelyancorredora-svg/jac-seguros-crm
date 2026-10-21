import { hoyISO, limpiarTexto, nuevoId } from './formato';
import type { Cliente, Pago, Poliza, Prospecto, Siniestro, Tarea, Vehiculo } from './tipos';

export * from './tipos';
export { polizaVigente, prospectoAbierto, siniestroAbierto, tareaAbierta } from './reglas';
import { db } from './supabase';

/*
 * Lectura y escritura sobre las MISMAS tablas que usa crm.jacsegurospa.com.
 *
 * Reglas para no pisar al CRM web:
 *  - Nunca se manda la fila entera: solo las columnas que se cambiaron.
 *    Asi el JSON 'extra' (adjuntos, historial, etc.) queda intacto.
 *  - Los registros nuevos usan el mismo formato de id que el web y 'extra'
 *    vacio, y el CRM web los recoge en su siguiente sincronizacion.
 *  - La app no borra registros.
 */

const COLUMNAS = {
  clientes: 'id,nombre,alias,cedula,tipo,cel,tel,email,dir,ciudad,provincia,f_nac,ocupacion,obs,estado_cli',
  polizas:
    'id,cliente_id,nombre_cliente,num,aseg,ramo,subramo,prima,total,comision,forma_pago,fecha_inicio,fecha_fin,estado,riesgo,cobertura,obs,cel_cliente,email_cliente,vendedor',
  siniestros:
    'id,cliente_id,num_sin,num_cia,nombre,fecha_sin,poliza,asegurado,monto_reclamo,val_ind,deducible,cliente,cel,aseg,estado,desc,seguimiento',
  pagos: 'id,cliente_id,poliza_id,monto,fecha,metodo,referencia,estado',
  tareas: 'id,titulo,desc,tipo_rel,rel_id,cliente_id,tipo,prioridad,etapa_tarea,fecha_limite,estado',
  vehiculos: 'id,cliente_id,placa,cliente_nom',
  prospectos:
    'id,nombre,cedula,cel,tel,email,tipo,fuente,etapa_venta,prioridad,probabilidad,monto_estimado,aseg_preferida,f_contacto,f_seguimiento,estado_comercial',
} as const;

type Tabla = keyof typeof COLUMNAS;

export class ErrorDatos extends Error {}

/** Lee una tabla completa por paginas. Si una pagina falla, falla todo (nunca media tabla). */
async function leerTodo<T>(tabla: Tabla): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from(tabla).select(COLUMNAS[tabla]).range(desde, desde + 999);
    if (error) throw new ErrorDatos(mensajeError(error));
    filas.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) return filas;
  }
}

function mensajeError(e: { message?: string; code?: string }): string {
  if (e.code === 'PGRST301' || /jwt/i.test(e.message ?? '')) return 'Tu sesión venció. Vuelve a entrar.';
  if (e.code === '42501') return 'No tienes permiso para esta acción.';
  return 'No se pudo conectar con el CRM. Revisa tu internet.';
}

export type Cartera = {
  clientes: Cliente[]; polizas: Poliza[]; siniestros: Siniestro[]; pagos: Pago[]; tareas: Tarea[];
  vehiculos: Vehiculo[]; prospectos: Prospecto[]; cargadoEn: number;
};

export async function cargarCartera(): Promise<Cartera> {
  const [clientes, polizas, siniestros, pagos, tareas, vehiculos, prospectos] = await Promise.all([
    leerTodo<Cliente>('clientes'),
    leerTodo<Poliza>('polizas'),
    leerTodo<Siniestro>('siniestros'),
    leerTodo<Pago>('pagos'),
    leerTodo<Tarea>('tareas'),
    leerTodo<Vehiculo>('vehiculos'),
    leerTodo<Prospecto>('prospectos'),
  ]);
  clientes.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  return { clientes, polizas, siniestros, pagos, tareas, vehiculos, prospectos, cargadoEn: Date.now() };
}

/* ---------------- Estados (mismos textos que el CRM web) ---------------- */

export const ETAPAS_TAREA = ['Por Hacer', 'En Proceso', 'En Seguimiento', 'Delegado', 'Hecho', 'Cancelada'] as const;
export const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const;
export const TIPOS_TAREA = ['Llamada', 'Seguimiento', 'Renovación', 'Cobro', 'Reunión', 'Trámite', 'Otro'] as const;
export const ESTADOS_SINIESTRO = ['En proceso', 'Pendiente docs', 'Pagado', 'Rechazado', 'Cerrado'] as const;

export const ETAPAS_VENTA = [
  'Contacto inicial', 'Prospecto', 'Calificación', 'Cotización', 'Propuesta enviada', 'Negociación',
  'Cierre', 'Cliente ganado', 'Perdido',
] as const;
export const FUENTES = [
  'Referido', 'Facebook', 'Instagram', 'WhatsApp', 'Llamada entrante', 'Web', 'Evento', 'Venta Cruzada',
  'Cold call', 'Otro',
] as const;
export const METODOS_PAGO = ['ACH', 'Transferencia', 'Yappy', 'Tarjeta', 'Efectivo', 'Cheque', 'Descuento directo'] as const;
export const ESTADOS_PAGO = ['Pagado', 'Pendiente'] as const;


/* ---------------- Escrituras ---------------- */

async function actualizar(tabla: Tabla, id: string, cambios: Record<string, unknown>): Promise<void> {
  // updated_at avisa al CRM web que esta fila cambio y debe bajarla.
  const fila = { ...cambios, updated_at: new Date().toISOString() };
  const { error, count } = await db.from(tabla).update(fila, { count: 'exact' }).eq('id', id);
  if (error) throw new ErrorDatos(mensajeError(error));
  if (count === 0) throw new ErrorDatos('No tienes permiso para modificar este registro.');
}

export type NuevaTarea = {
  titulo: string; desc: string; tipo: string; prioridad: string; fecha_limite: string; cliente_id?: string;
};

export async function crearTarea(t: NuevaTarea): Promise<Tarea> {
  const titulo = limpiarTexto(t.titulo, 200);
  if (!titulo) throw new ErrorDatos('El título es obligatorio.');
  if (!(PRIORIDADES as readonly string[]).includes(t.prioridad)) throw new ErrorDatos('Prioridad inválida.');
  if (t.fecha_limite && !/^\d{4}-\d{2}-\d{2}$/.test(t.fecha_limite)) throw new ErrorDatos('Fecha inválida.');
  const fila: Tarea & { extra: Record<string, unknown> } = {
    id: nuevoId('T'),
    titulo,
    desc: limpiarTexto(t.desc) || null,
    tipo: limpiarTexto(t.tipo, 60) || null,
    prioridad: t.prioridad,
    etapa_tarea: 'Por Hacer',
    estado: 'pendiente',
    fecha_limite: t.fecha_limite || null,
    tipo_rel: t.cliente_id ? 'cliente' : null,
    rel_id: t.cliente_id || null,
    cliente_id: t.cliente_id || null,
    extra: { creadoDesde: 'app-movil' },
  };
  const { error } = await db.from('tareas').insert(fila);
  if (error) throw new ErrorDatos(mensajeError(error));
  const { extra: _omit, ...tarea } = fila;
  void _omit;
  return tarea;
}

export async function cambiarEtapaTarea(id: string, etapa: string): Promise<Partial<Tarea>> {
  if (!(ETAPAS_TAREA as readonly string[]).includes(etapa)) throw new ErrorDatos('Etapa inválida.');
  const cambios = { etapa_tarea: etapa, estado: etapa === 'Hecho' ? 'completada' : etapa === 'Cancelada' ? 'cancelada' : 'pendiente' };
  await actualizar('tareas', id, cambios);
  return cambios;
}

export async function actualizarSiniestro(
  id: string, estado: string, seguimiento: string,
): Promise<Partial<Siniestro>> {
  if (!(ESTADOS_SINIESTRO as readonly string[]).includes(estado)) throw new ErrorDatos('Estado inválido.');
  const cambios = { estado, seguimiento: limpiarTexto(seguimiento, 5000) || null };
  await actualizar('siniestros', id, cambios);
  return cambios;
}

export type ContactoCliente = Pick<Cliente, 'cel' | 'tel' | 'email' | 'dir'>;

export async function actualizarContactoCliente(id: string, c: ContactoCliente): Promise<Partial<Cliente>> {
  const cambios: ContactoCliente = {
    cel: limpiarTexto(c.cel ?? '', 30) || null,
    tel: limpiarTexto(c.tel ?? '', 30) || null,
    email: limpiarTexto(c.email ?? '', 120).toLowerCase() || null,
    dir: limpiarTexto(c.dir ?? '', 300) || null,
  };
  await actualizar('clientes', id, cambios);
  return cambios;
}

/* ---------------- Pagos ---------------- */

export type NuevoPago = {
  poliza: Poliza; monto: string; fecha: string; metodo: string; referencia: string; estado: string; notas: string;
};

export async function registrarPago(n: NuevoPago, nombreCliente: string): Promise<Pago> {
  const monto = Number(n.monto.replace(',', '.'));
  if (!isFinite(monto) || monto <= 0 || monto > 1_000_000) throw new ErrorDatos('Monto inválido.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n.fecha)) throw new ErrorDatos('Fecha inválida.');
  if (!(METODOS_PAGO as readonly string[]).includes(n.metodo)) throw new ErrorDatos('Método inválido.');
  if (!(ESTADOS_PAGO as readonly string[]).includes(n.estado)) throw new ErrorDatos('Estado inválido.');
  const pago: Pago = {
    id: nuevoId('PAG'),
    cliente_id: n.poliza.cliente_id,
    poliza_id: n.poliza.id,
    monto: Math.round(monto * 100) / 100,
    fecha: n.fecha,
    metodo: n.metodo,
    referencia: limpiarTexto(n.referencia, 80) || null,
    estado: n.estado,
  };
  // Lo que el CRM web guarda fuera de columnas va en 'extra', igual que alla.
  const extra = {
    notas: limpiarTexto(n.notas, 500), cuota: '', aseg: n.poliza.aseg ?? '', ramo: n.poliza.ramo ?? '',
    cliente: nombreCliente, periodo: n.poliza.forma_pago ?? '', creadoDesde: 'app-movil',
  };
  const { error } = await db.from('pagos').insert({ ...pago, extra });
  if (error) throw new ErrorDatos(mensajeError(error));
  return pago;
}

/* ---------------- Prospectos ---------------- */

export type NuevoProspecto = {
  nombre: string; cel: string; email: string; fuente: string; prioridad: string; interes: string;
  monto_estimado: string; f_seguimiento: string; notas: string;
};

export async function crearProspecto(n: NuevoProspecto): Promise<Prospecto> {
  const nombre = limpiarTexto(n.nombre, 150);
  if (!nombre) throw new ErrorDatos('El nombre es obligatorio.');
  if (!(FUENTES as readonly string[]).includes(n.fuente)) throw new ErrorDatos('Fuente inválida.');
  if (!(PRIORIDADES as readonly string[]).includes(n.prioridad)) throw new ErrorDatos('Prioridad inválida.');
  if (n.f_seguimiento && !/^\d{4}-\d{2}-\d{2}$/.test(n.f_seguimiento)) throw new ErrorDatos('Fecha inválida.');
  const monto = n.monto_estimado ? Number(n.monto_estimado.replace(',', '.')) : 0;
  if (!isFinite(monto) || monto < 0) throw new ErrorDatos('Monto inválido.');
  const hoy = hoyISO();
  const prospecto: Prospecto = {
    id: nuevoId('PR'),
    nombre,
    cedula: null,
    cel: limpiarTexto(n.cel, 30) || null,
    tel: null,
    email: limpiarTexto(n.email, 120).toLowerCase() || null,
    tipo: 'Personal',
    fuente: n.fuente,
    etapa_venta: 'Contacto inicial',
    prioridad: n.prioridad,
    probabilidad: 20,
    monto_estimado: monto,
    aseg_preferida: null,
    f_contacto: hoy,
    f_seguimiento: n.f_seguimiento || null,
    estado_comercial: null,
  };
  // Mismas listas que crea el CRM web, para que la ficha abra completa alla.
  const extra = {
    notas: limpiarTexto(n.notas),
    interes: n.interes ? [limpiarTexto(n.interes, 60)] : [],
    historial: [{ fecha: hoy, accion: '✨ Prospecto creado (app móvil)', resultado: '', tipo: 'sistema' }],
    tareas: [], archivos: [], etiquetas: [], asegPreferidas: [],
    esVentaCruzada: false, clienteIdVinculado: '',
  };
  const { error } = await db.from('prospectos').insert({ ...prospecto, es_venta_cruzada: false, extra });
  if (error) throw new ErrorDatos(mensajeError(error));
  return prospecto;
}

export async function cambiarEtapaProspecto(id: string, etapa: string): Promise<Partial<Prospecto>> {
  if (!(ETAPAS_VENTA as readonly string[]).includes(etapa)) throw new ErrorDatos('Etapa inválida.');
  const cambios = { etapa_venta: etapa };
  await actualizar('prospectos', id, cambios);
  return cambios;
}

export async function fijarSeguimientoProspecto(id: string, f: string): Promise<Partial<Prospecto>> {
  if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f)) throw new ErrorDatos('Fecha inválida.');
  const cambios = { f_seguimiento: f || null };
  await actualizar('prospectos', id, cambios);
  return cambios;
}
