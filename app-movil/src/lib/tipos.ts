/* Filas de las tablas del CRM (solo las columnas que usa la app). */

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

export type Prospecto = {
  id: string; nombre: string | null; cedula: string | null; cel: string | null; tel: string | null;
  email: string | null; tipo: string | null; fuente: string | null; etapa_venta: string | null;
  prioridad: string | null; probabilidad: number | null; monto_estimado: number | null;
  aseg_preferida: string | null; f_contacto: string | null; f_seguimiento: string | null;
  estado_comercial: string | null;
};

export type Vehiculo = { id: string; cliente_id: string | null; placa: string | null; cliente_nom: string | null };
