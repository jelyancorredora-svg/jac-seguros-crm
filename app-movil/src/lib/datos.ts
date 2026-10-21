import { limpiarTexto, nuevoId } from './formato';
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

export type Cliente = {
  id: string; nombre: string | null; alias: string | null; cedula: string | null; tipo: string | null;
  cel: string | null; tel: string | null; email: string | null; dir: string | null; ciudad: string | null;
  provincia: string | null; f_nac: string | null; ocupacion: string | null; obs: string | null;
  estado_cli: string | null;
};

export type Poliza = {
  id: string; cliente_id: string | null; nombre_cliente: string | null; num: string | null;
  aseg: string | null; ramo: string | null; subramo: string | null; prima: number | null; total: number | null;
  comision: number | null; forma_pago: string | null; fecha_inicio: string | null; fecha_fin: string | null;
  estado: string | null; riesgo: string | null; cobertura: string | null; obs: string | null;
  cel_cliente: string | null; email_cliente: string | null; vendedor: string | null;
};

export type Siniestro = {
  id: string; cliente_id: string | null; num_sin: string | null; num_cia: string | null; nombre: string | null;
  fecha_sin: string | null; poliza: string | null; asegurado: string | null; monto_reclamo: number | null;
  val_ind: number | null; deducible: number | null; cliente: string | null; cel: string | null;
  aseg: string | null; estado: string | null; desc: string | null; seguimiento: string | null;
};

export type Pago = {
  id: string; cliente_id: string | null; poliza_id: string | null; monto: number | null; fecha: string | null;
  metodo: string | null; referencia: string | null; estado: string | null;
};

export type Tarea = {
  id: string; titulo: string | null; desc: string | null; tipo_rel: string | null; rel_id: string | null;
  cliente_id: string | null; tipo: string | null; prioridad: string | null; etapa_tarea: string | null;
  fecha_limite: string | null; estado: string | null;
};

export type Vehiculo = { id: string; cliente_id: string | null; placa: string | null; cliente_nom: string | null };

const COLUMNAS = {
  clientes: 'id,nombre,alias,cedula,tipo,cel,tel,email,dir,ciudad,provincia,f_nac,ocupacion,obs,estado_cli',
  polizas:
    'id,cliente_id,nombre_cliente,num,aseg,ramo,subramo,prima,total,comision,forma_pago,fecha_inicio,fecha_fin,estado,riesgo,cobertura,obs,cel_cliente,email_cliente,vendedor',
  siniestros:
    'id,cliente_id,num_sin,num_cia,nombre,fecha_sin,poliza,asegurado,monto_reclamo,val_ind,deducible,cliente,cel,aseg,estado,desc,seguimiento',
  pagos: 'id,cliente_id,poliza_id,monto,fecha,metodo,referencia,estado',
  tareas: 'id,titulo,desc,tipo_rel,rel_id,cliente_id,tipo,prioridad,etapa_tarea,fecha_limite,estado',
  vehiculos: 'id,cliente_id,placa,cliente_nom',
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
  vehiculos: Vehiculo[]; cargadoEn: number;
};

export async function cargarCartera(): Promise<Cartera> {
  const [clientes, polizas, siniestros, pagos, tareas, vehiculos] = await Promise.all([
    leerTodo<Cliente>('clientes'),
    leerTodo<Poliza>('polizas'),
    leerTodo<Siniestro>('siniestros'),
    leerTodo<Pago>('pagos'),
    leerTodo<Tarea>('tareas'),
    leerTodo<Vehiculo>('vehiculos'),
  ]);
  clientes.sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));
  return { clientes, polizas, siniestros, pagos, tareas, vehiculos, cargadoEn: Date.now() };
}

/* ---------------- Estados (mismos textos que el CRM web) ---------------- */

export const ETAPAS_TAREA = ['Por Hacer', 'En Proceso', 'En Seguimiento', 'Delegado', 'Hecho', 'Cancelada'] as const;
export const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const;
export const TIPOS_TAREA = ['Llamada', 'Seguimiento', 'Renovación', 'Cobro', 'Reunión', 'Trámite', 'Otro'] as const;
export const ESTADOS_SINIESTRO = ['En proceso', 'Pendiente docs', 'Pagado', 'Rechazado', 'Cerrado'] as const;

const TAREA_CERRADA = /^(hecho|completad[ao]|realizado|finalizado|cancelada|done)$/i;
export const tareaAbierta = (t: Tarea) =>
  !TAREA_CERRADA.test(t.estado ?? '') && !TAREA_CERRADA.test(t.etapa_tarea ?? '');

export const polizaVigente = (p: Poliza) => /^(vigente|activa|renovada)$/i.test(p.estado ?? '');

const SINIESTRO_CERRADO = /^(pagado|rechazado|cerrado)$/i;
export const siniestroAbierto = (s: Siniestro) => !SINIESTRO_CERRADO.test(s.estado ?? '');

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
