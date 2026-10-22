/*
 * Todos los campos de cada modulo, con las MISMAS claves, etiquetas y
 * opciones que los formularios del CRM web (crm.jacsegurospa.com).
 *
 * La clave es la del objeto del CRM web (camelCase). Al guardar, si la
 * tabla tiene una columna con ese nombre (en snake_case) va a la columna;
 * si no, va al JSON 'extra', igual que hace la sincronizacion del web.
 */

export type TipoCampo = 'texto' | 'area' | 'fecha' | 'num' | 'tel' | 'email' | 'sel' | 'lista' | 'hora';

export type Campo = {
  k: string;
  l: string;
  t: TipoCampo;
  /** Opciones de una lista cerrada: [valor, texto] */
  o?: Array<[string, string]>;
  /** Grupo en la ficha */
  g: string;
  req?: boolean;
};

const op = (...xs: Array<string | [string, string]>): Array<[string, string]> =>
  xs.map((x) => (Array.isArray(x) ? x : [x, x]));

const ORIGENES = op(['', '—'], 'Referido', 'Facebook', 'Instagram', 'WhatsApp', 'Compreoalquile', 'Encuentra24',
  'Llamada entrante', 'Web', 'Evento', 'Venta Cruzada', 'Cold call', 'Otro');
const TIPOS_COLECTIVO = op(['', '—'], 'Salud', 'Vida', 'Vehículo', 'Accidentes Personales', 'Incendio',
  'Responsabilidad Civil', 'Fianzas', 'General');
const GENERO = op(['', '—'], 'Masculino', 'Femenino');

export const ESTADOS_COMERCIALES = op(['activo', '🟢 Activo'], ['vip', '⭐ VIP'], ['prospecto', '🎯 Prospecto'],
  ['ganado', '✅ Ganado'], ['perdido', '❌ Perdido'], ['inactivo', '⚫ Inactivo']);

export const CAMPOS_CLIENTE: Campo[] = [
  { k: 'nombre', l: 'Nombre completo / Razón social', t: 'texto', g: 'Identificación', req: true },
  { k: 'alias', l: 'Alias', t: 'texto', g: 'Identificación' },
  { k: 'tipo', l: 'Tipo de cliente', t: 'sel', o: op(['Persona Natural', 'Persona Natural'], ['Empresa', 'Persona Jurídica (Empresa)']), g: 'Identificación' },
  { k: 'tipoDoc', l: 'Tipo documento', t: 'sel', o: op('Cédula', 'RUC', 'Pasaporte', 'Extranjero'), g: 'Identificación' },
  { k: 'cedula', l: 'Nro. Documento', t: 'texto', g: 'Identificación', req: true },
  { k: 'fExpCed', l: 'Fecha expedición doc.', t: 'fecha', g: 'Identificación' },
  { k: 'fExpirCed', l: 'Fecha expiración doc.', t: 'fecha', g: 'Identificación' },
  { k: 'estadoComercial', l: 'Estado comercial', t: 'sel', o: ESTADOS_COMERCIALES, g: 'Identificación' },
  { k: 'codPais', l: 'Cód. país WhatsApp', t: 'texto', g: 'Contacto' },
  { k: 'cel', l: 'Celular principal', t: 'tel', g: 'Contacto' },
  { k: 'celSec', l: 'Celular secundario', t: 'tel', g: 'Contacto' },
  { k: 'tel', l: 'Teléfono fijo', t: 'tel', g: 'Contacto' },
  { k: 'telSec', l: 'Teléfono secundario', t: 'tel', g: 'Contacto' },
  { k: 'email', l: 'Email principal', t: 'email', g: 'Contacto' },
  { k: 'emailSec', l: 'Email secundario', t: 'email', g: 'Contacto' },
  { k: 'dir', l: 'Dirección principal', t: 'texto', g: 'Dirección' },
  { k: 'dirSec', l: 'Dirección secundaria', t: 'texto', g: 'Dirección' },
  { k: 'ciudad', l: 'Ciudad', t: 'texto', g: 'Dirección' },
  { k: 'provincia', l: 'Provincia', t: 'texto', g: 'Dirección' },
  { k: 'distrito', l: 'Distrito', t: 'texto', g: 'Dirección' },
  { k: 'corregimiento', l: 'Corregimiento', t: 'texto', g: 'Dirección' },
  { k: 'fNac', l: 'Fecha de nacimiento', t: 'fecha', g: 'Datos personales' },
  { k: 'genero', l: 'Género', t: 'sel', o: GENERO, g: 'Datos personales' },
  { k: 'estadoCivil', l: 'Estado civil', t: 'sel', o: op(['', '—'], 'Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a', 'Unión libre'), g: 'Datos personales' },
  { k: 'numHijos', l: 'Número de hijos', t: 'num', g: 'Datos personales' },
  { k: 'ocupacion', l: 'Ocupación', t: 'texto', g: 'Datos personales' },
  { k: 'empresaNom', l: 'Empresa / Empleador', t: 'texto', g: 'Datos personales' },
  { k: 'cargo', l: 'Cargo', t: 'texto', g: 'Datos personales' },
  { k: 'ingresoMensual', l: 'Ingreso mensual ($)', t: 'num', g: 'Datos personales' },
  { k: 'nomContacto', l: 'Contacto: nombre', t: 'texto', g: 'Persona de contacto' },
  { k: 'nomContactoTel', l: 'Contacto: teléfono', t: 'tel', g: 'Persona de contacto' },
  { k: 'nomContactoRel', l: 'Contacto: relación', t: 'texto', g: 'Persona de contacto' },
  { k: 'banco', l: 'Banco', t: 'texto', g: 'Banco' },
  { k: 'bancoNum', l: 'Nro. cuenta', t: 'texto', g: 'Banco' },
  { k: 'categorias', l: 'Categorías (ramos)', t: 'texto', g: 'Comercial' },
  { k: 'origenCliente', l: 'Origen del cliente', t: 'sel', o: ORIGENES, g: 'Comercial' },
  { k: 'referidoPor', l: 'Referido por', t: 'texto', g: 'Comercial' },
  { k: 'colectivo', l: '¿Es plan colectivo?', t: 'sel', o: op(['', 'No'], ['Si', 'Sí, es colectivo']), g: 'Comercial' },
  { k: 'colectivoTipo', l: 'Tipo de póliza colectiva', t: 'sel', o: TIPOS_COLECTIVO, g: 'Comercial' },
  { k: 'colectivoEmpresa', l: 'Empresa / Grupo', t: 'texto', g: 'Comercial' },
  { k: 'colectivoNpers', l: 'Nro. de asegurados', t: 'num', g: 'Comercial' },
  { k: 'avisOp', l: 'Aviso de operaciones', t: 'texto', g: 'Notas' },
  { k: 'avisOp2', l: 'Aviso de operaciones 2', t: 'texto', g: 'Notas' },
  { k: 'obs', l: 'Observaciones', t: 'area', g: 'Notas' },
  { k: 'notas', l: 'Notas internas', t: 'area', g: 'Notas' },
];

export const ESTADOS_POLIZA = op('Vigente', 'Vencida', 'Renovada', 'Cancelada', 'Pendiente');

export const CAMPOS_POLIZA: Campo[] = [
  { k: 'num', l: 'Nro. Póliza', t: 'texto', g: 'Póliza', req: true },
  { k: 'numAnexo', l: 'Nro. Anexo', t: 'texto', g: 'Póliza' },
  { k: 'numCert', l: 'Nro. Certificado', t: 'texto', g: 'Póliza' },
  { k: 'tipo', l: 'Tipo', t: 'sel', o: op('Póliza', 'Anexo', 'Certificado', 'Endoso'), g: 'Póliza' },
  { k: 'aseg', l: 'Aseguradora', t: 'lista', g: 'Póliza', req: true },
  { k: 'ramo', l: 'Ramo principal', t: 'lista', g: 'Póliza', req: true },
  { k: 'subramo', l: 'Sub-ramo', t: 'lista', g: 'Póliza' },
  { k: 'nueva', l: 'Nueva / Renovada', t: 'sel', o: op('Nueva', 'Renovada'), g: 'Póliza' },
  { k: 'estado', l: 'Estado', t: 'sel', o: ESTADOS_POLIZA, g: 'Póliza' },
  { k: 'etapa', l: 'Etapa gestión', t: 'sel', o: op('Nueva', 'En Proceso', 'Vigente', 'Por Renovar', 'Renovada', 'Cancelada'), g: 'Póliza' },
  { k: 'riesgo', l: 'Descripción del riesgo', t: 'area', g: 'Riesgo' },
  { k: 'valorRiesgo', l: 'Valor riesgo ($)', t: 'num', g: 'Riesgo' },
  { k: 'tipoPol', l: 'Tipo póliza', t: 'texto', g: 'Riesgo' },
  { k: 'cobertura', l: 'Cobertura', t: 'texto', g: 'Riesgo' },
  { k: 'fechaExpedicion', l: 'Fecha expedición', t: 'fecha', g: 'Fechas' },
  { k: 'fechaRecepcion', l: 'Fecha recepción', t: 'fecha', g: 'Fechas' },
  { k: 'fechaInicio', l: 'Fecha inicio', t: 'fecha', g: 'Fechas' },
  { k: 'fechaFin', l: 'Fecha fin / Vencimiento', t: 'fecha', g: 'Fechas', req: true },
  { k: 'fechaCancelada', l: 'Fecha cancelada', t: 'fecha', g: 'Fechas' },
  { k: 'fechaFact', l: 'Fecha facturación', t: 'fecha', g: 'Fechas' },
  { k: 'prima', l: 'Prima neta ($)', t: 'num', g: 'Prima', req: true },
  { k: 'itbmsPct', l: '% ITBMS', t: 'sel', o: op(['', '—'], ['6', '6%'], ['5', '5%'], ['0', '0%']), g: 'Prima' },
  { k: 'itbms', l: 'ITBMS ($)', t: 'num', g: 'Prima' },
  { k: 'gastosExp', l: 'Gastos expedición ($)', t: 'num', g: 'Prima' },
  { k: 'total', l: 'Prima total c/ITBMS ($)', t: 'num', g: 'Prima' },
  { k: 'cuotaMensual', l: 'Cuota mensual ($)', t: 'num', g: 'Prima' },
  { k: 'cuotaTrimestral', l: 'Cuota trimestral ($)', t: 'num', g: 'Prima' },
  { k: 'cuotaSemestral', l: 'Cuota semestral ($)', t: 'num', g: 'Prima' },
  { k: 'cuotaAnual', l: 'Cuota anual ($)', t: 'num', g: 'Prima' },
  { k: 'valorFinanciacion', l: 'Valor financiación ($)', t: 'num', g: 'Prima' },
  { k: 'endosos', l: 'Endosos ($)', t: 'num', g: 'Prima' },
  { k: 'comPct', l: '% Comisión aseguradora', t: 'num', g: 'Comisión' },
  { k: 'participacion', l: 'Participación JAC (%)', t: 'num', g: 'Comisión' },
  { k: 'comision', l: 'Comisión JAC ($)', t: 'num', g: 'Comisión' },
  { k: 'coCor', l: 'Co-corretaje', t: 'sel', o: op(['', '—'], 'FF Seguros', 'Capital Care & Co'), g: 'Comisión' },
  { k: 'coCorPart', l: 'Part. co-corretaje (%)', t: 'num', g: 'Comisión' },
  { k: 'coCorCom', l: 'Com. co-corretaje ($)', t: 'num', g: 'Comisión' },
  { k: 'formaPago', l: 'Forma de pago', t: 'sel', o: op(['', '—'], 'Fraccionado', 'Contado', 'Financiado'), g: 'Pago' },
  { k: 'periodo', l: 'Periodicidad', t: 'sel', o: op(['', '—'], 'Mensual', 'Trimestral', 'Semestral', 'Anual'), g: 'Pago' },
  { k: 'numPagos', l: 'Nro. pagos', t: 'num', g: 'Pago' },
  { k: 'letraPrima', l: 'Letra prima ($)', t: 'num', g: 'Pago' },
  { k: 'medio', l: 'Medio de pago', t: 'sel', o: op(['', '—'], 'Tarjeta crédito', 'Tarjeta débito', 'Transferencia', 'Efectivo', 'Cheque'), g: 'Pago' },
  { k: 'tipoPago', l: 'Tipo de pago', t: 'sel', o: op(['', '—'], ['TARJETA DE CREDITO', 'Tarjeta de crédito'], ['EFECTIVO', 'Efectivo'], ['PAGO DIRECTO', 'Pago directo'], ['FINANCIADO', 'Financiado'], ['CHEQUE', 'Cheque'], ['ACH', 'ACH / Transferencia']), g: 'Pago' },
  { k: 'banco', l: 'Banco', t: 'texto', g: 'Pago' },
  { k: 'moneda', l: 'Moneda', t: 'sel', o: op('USD', 'PAB'), g: 'Pago' },
  { k: 'acreedor', l: 'Acreedor / Financiera', t: 'texto', g: 'Pago' },
  { k: 'pagado', l: 'Monto pagado ($)', t: 'num', g: 'Pago' },
  { k: 'saldo', l: 'Saldo pendiente ($)', t: 'num', g: 'Pago' },
  { k: 'estadoCartera', l: 'Estado de cartera', t: 'texto', g: 'Pago' },
  { k: 'nombreAsegurado', l: 'Nombre asegurado', t: 'texto', g: 'Personas' },
  { k: 'docAsegurado', l: 'Doc. asegurado', t: 'texto', g: 'Personas' },
  { k: 'tomador', l: 'Nombre tomador', t: 'texto', g: 'Personas' },
  { k: 'docTomador', l: 'Doc. tomador', t: 'texto', g: 'Personas' },
  { k: 'beneficiario', l: 'Beneficiario', t: 'texto', g: 'Personas' },
  { k: 'cedBeneficiario', l: 'Cédula beneficiario', t: 'texto', g: 'Personas' },
  { k: 'vendedor', l: 'Vendedor', t: 'texto', g: 'Notas' },
  { k: 'motivoCancelacion', l: 'Motivo de cancelación', t: 'texto', g: 'Notas' },
  { k: 'obs', l: 'Observaciones', t: 'area', g: 'Notas' },
  { k: 'obsInt', l: 'Observaciones internas', t: 'area', g: 'Notas' },
];

export const ESTADOS_SINIESTRO = op('En proceso', 'Pendiente docs', 'Pagado', 'Rechazado', 'Cerrado');

export const CAMPOS_SINIESTRO: Campo[] = [
  { k: 'nombre', l: 'Tipo de siniestro', t: 'texto', g: 'Siniestro', req: true },
  { k: 'estado', l: 'Estado', t: 'sel', o: ESTADOS_SINIESTRO, g: 'Siniestro' },
  { k: 'poliza', l: 'Póliza', t: 'texto', g: 'Siniestro' },
  { k: 'aseg', l: 'Aseguradora', t: 'lista', g: 'Siniestro' },
  { k: 'subramo', l: 'Sub-ramo', t: 'lista', g: 'Siniestro' },
  { k: 'numSin', l: 'Nro. interno', t: 'texto', g: 'Siniestro' },
  { k: 'numCia', l: 'Nro. CIA', t: 'texto', g: 'Siniestro' },
  { k: 'fechaSin', l: 'Fecha siniestro', t: 'fecha', g: 'Fechas' },
  { k: 'fechaAviso', l: 'Fecha aviso', t: 'fecha', g: 'Fechas' },
  { k: 'fechaNotif', l: 'Fecha notif. aseguradora', t: 'fecha', g: 'Fechas' },
  { k: 'proveedor', l: 'Proveedor / Ajustador', t: 'texto', g: 'Personas' },
  { k: 'asegurado', l: 'Nombre asegurado', t: 'texto', g: 'Personas' },
  { k: 'docAseg', l: 'Doc. asegurado', t: 'texto', g: 'Personas' },
  { k: 'montoReclamo', l: 'Monto reclamo ($)', t: 'num', g: 'Montos' },
  { k: 'deducible', l: 'Deducible ($)', t: 'num', g: 'Montos' },
  { k: 'valInd', l: 'Valor indemnización ($)', t: 'num', g: 'Montos' },
  { k: 'coaseguros', l: 'Coaseguros ($)', t: 'num', g: 'Montos' },
  { k: 'sinPct', l: '% Siniestralidad', t: 'num', g: 'Montos' },
  { k: 'desc', l: 'Descripción', t: 'area', g: 'Seguimiento' },
  { k: 'seguimiento', l: 'Último seguimiento', t: 'area', g: 'Seguimiento' },
];

export const CAMPOS_VEHICULO: Campo[] = [
  { k: 'placa', l: 'Placa', t: 'texto', g: 'Vehículo', req: true },
  { k: 'soat', l: 'Venc. SOAT', t: 'fecha', g: 'Vencimientos' },
  { k: 'tecno', l: 'Venc. revisado / tecno', t: 'fecha', g: 'Vencimientos' },
  { k: 'imp', l: 'Venc. impuestos', t: 'fecha', g: 'Vencimientos' },
];

export const ESTADOS_PAGO = op('Pendiente', 'Pagado', 'Vencido');

export const CAMPOS_PAGO: Campo[] = [
  { k: 'monto', l: 'Monto ($)', t: 'num', g: 'Pago', req: true },
  { k: 'fecha', l: 'Fecha', t: 'fecha', g: 'Pago', req: true },
  { k: 'estado', l: 'Estado', t: 'sel', o: ESTADOS_PAGO, g: 'Pago' },
  { k: 'cuota', l: 'Cuota', t: 'texto', g: 'Pago' },
  { k: 'periodo', l: 'Frecuencia de pago', t: 'sel', o: op(['', '—'], 'Mensual', 'Trimestral', 'Semestral', 'Anual'), g: 'Pago' },
  { k: 'metodo', l: 'Método', t: 'texto', g: 'Pago' },
  { k: 'referencia', l: 'Referencia / comprobante', t: 'texto', g: 'Pago' },
  { k: 'notas', l: 'Notas', t: 'area', g: 'Pago' },
];

export const ETAPAS_VENTA = op('Contacto inicial', 'Prospecto', 'Calificación', 'Cotización', 'Propuesta enviada',
  'Negociación', 'Cierre', 'Cliente ganado', 'Perdido');

export const CAMPOS_PROSPECTO: Campo[] = [
  { k: 'nombre', l: 'Nombre', t: 'texto', g: 'Identificación', req: true },
  { k: 'tipo', l: 'Tipo', t: 'sel', o: op('Personal', 'Empresa'), g: 'Identificación' },
  { k: 'tipoDoc', l: 'Tipo documento', t: 'sel', o: op('Cédula', 'RUC', 'Pasaporte'), g: 'Identificación' },
  { k: 'cedula', l: 'Nro. Documento', t: 'texto', g: 'Identificación' },
  { k: 'codPais', l: 'Cód. país WhatsApp', t: 'texto', g: 'Contacto' },
  { k: 'cel', l: 'Celular', t: 'tel', g: 'Contacto' },
  { k: 'tel', l: 'Teléfono', t: 'tel', g: 'Contacto' },
  { k: 'email', l: 'Email', t: 'email', g: 'Contacto' },
  { k: 'ciudad', l: 'Ciudad', t: 'texto', g: 'Contacto' },
  { k: 'provincia', l: 'Provincia', t: 'texto', g: 'Contacto' },
  { k: 'fNac', l: 'Fecha de nacimiento', t: 'fecha', g: 'Datos personales' },
  { k: 'genero', l: 'Género', t: 'sel', o: GENERO, g: 'Datos personales' },
  { k: 'ocupacion', l: 'Ocupación', t: 'texto', g: 'Datos personales' },
  { k: 'fuente', l: 'Fuente', t: 'sel', o: ORIGENES.slice(1), g: 'Venta' },
  { k: 'etapaVenta', l: 'Etapa de venta', t: 'sel', o: ETAPAS_VENTA, g: 'Venta' },
  { k: 'prioridad', l: 'Prioridad', t: 'sel', o: op('Alta', 'Media', 'Baja'), g: 'Venta' },
  { k: 'probabilidad', l: 'Probabilidad (%)', t: 'num', g: 'Venta' },
  { k: 'montoEstimado', l: 'Monto estimado ($)', t: 'num', g: 'Venta' },
  { k: 'asegActual', l: 'Aseguradora actual', t: 'lista', g: 'Venta' },
  { k: 'venceActual', l: 'Vencimiento actual', t: 'fecha', g: 'Venta' },
  { k: 'fContacto', l: 'Primer contacto', t: 'fecha', g: 'Seguimiento' },
  { k: 'fSeguimiento', l: 'Próximo seguimiento', t: 'fecha', g: 'Seguimiento' },
  { k: 'colectivo', l: '¿Es plan colectivo?', t: 'sel', o: op(['', 'No'], ['Si', 'Sí, es colectivo']), g: 'Colectivo' },
  { k: 'colectivoTipo', l: 'Tipo de póliza colectiva', t: 'sel', o: TIPOS_COLECTIVO, g: 'Colectivo' },
  { k: 'colectivoEmpresa', l: 'Empresa / Grupo', t: 'texto', g: 'Colectivo' },
  { k: 'colectivoNpers', l: 'Nro. de asegurados', t: 'num', g: 'Colectivo' },
  { k: 'notas', l: 'Notas / Observaciones', t: 'area', g: 'Notas' },
];

export const CAMPOS_COMISION: Campo[] = [
  { k: 'aseg', l: 'Aseguradora', t: 'lista', g: 'Comisión', req: true },
  { k: 'ramo', l: 'Ramo / Producto', t: 'sel', o: op(['', '—'], 'Automóvil', 'Vida', 'Salud', 'Hogar', 'SOAT', 'Accidentes Personales', 'Incendio', 'Responsabilidad Civil', 'Transporte', 'Cumplimiento', 'Multiriesgo', 'Fianzas', 'Rentas', 'Otro'), g: 'Comisión' },
  { k: 'fecha', l: 'Fecha de registro', t: 'fecha', g: 'Comisión' },
  { k: 'pct', l: '% Comisión', t: 'num', g: 'Comisión' },
  { k: 'monto', l: 'Monto ($)', t: 'num', g: 'Comisión', req: true },
  { k: 'estado', l: 'Estado', t: 'sel', o: op(['pendiente', 'Pendiente'], ['cobrada', 'Cobrada']), g: 'Comisión' },
];

/* Prioridades de la agenda del CRM web */
export const PRIORIDADES_AGENDA = op(['', 'Sin prioridad'], ['A1', '🔴 A1 Urgente'], ['A2', '🟠 A2 Alta'], ['A3', '🟡 A3 Alta-'],
  ['B1', '🟡 B1 Media+'], ['B2', '🟢 B2 Media'], ['B3', '🟢 B3 Media-'], ['C1', '🔵 C1 Baja'], ['C2', '🟣 C2 Mínima']);
export const COLOR_PRIORIDAD: Record<string, string> = {
  A1: '#DC2626', A2: '#EA580C', A3: '#D97706', B1: '#CA8A04', B2: '#16A34A', B3: '#059669', C1: '#2563EB', C2: '#7C3AED',
  Alta: '#DC2626', Media: '#D97706', Baja: '#16A34A',
};
export const ETAPAS_TAREA = op('Por Hacer', 'Normal', 'En Proceso', 'En Seguimiento', 'Delegado', 'Reenviado',
  'Completado', 'Realizado', 'Finalizado', 'Hecho', 'Cancelada', 'Reprogramada');
export const COLOR_ETAPA_TAREA: Record<string, string> = {
  'Por Hacer': '#1D4ED8', Normal: '#64748B', 'En Proceso': '#D97706', 'En Seguimiento': '#7E22CE', Delegado: '#0891B2',
  Reenviado: '#B45309', Completado: '#15803D', Realizado: '#15803D', Finalizado: '#15803D', Hecho: '#15803D',
  Cancelada: '#B91C1C', Reprogramada: '#7C3AED', Eliminada: '#64748B',
};

export const CAMPOS_TAREA: Campo[] = [
  { k: 'titulo', l: 'Título', t: 'texto', g: 'Tarea', req: true },
  { k: 'desc', l: 'Descripción / notas', t: 'area', g: 'Tarea' },
  { k: 'fechaLimite', l: 'Fecha límite', t: 'fecha', g: 'Tarea' },
  { k: 'hora', l: 'Hora', t: 'hora', g: 'Tarea' },
  { k: 'prioridad', l: 'Prioridad', t: 'sel', o: PRIORIDADES_AGENDA.concat(op('Alta', 'Media', 'Baja')), g: 'Tarea' },
  { k: 'etapaTarea', l: 'Etapa', t: 'sel', o: ETAPAS_TAREA, g: 'Tarea' },
  { k: 'tipo', l: 'Tipo', t: 'texto', g: 'Tarea' },
  { k: 'paraQuien', l: 'Para quién', t: 'texto', g: 'Tarea' },
  { k: 'reminder', l: 'Recordatorio', t: 'sel', o: op(['ninguno', 'Sin recordatorio'], ['15', '15 min antes'], ['30', '30 min antes'], ['60', '1 hora antes'], ['120', '2 horas antes'], ['1440', '1 día antes']), g: 'Tarea' },
];

export type Modulo = 'clientes' | 'polizas' | 'siniestros' | 'vehiculos' | 'pagos' | 'prospectos' | 'comisiones' | 'tareas';

export const CAMPOS: Record<Modulo, Campo[]> = {
  clientes: CAMPOS_CLIENTE,
  polizas: CAMPOS_POLIZA,
  siniestros: CAMPOS_SINIESTRO,
  vehiculos: CAMPOS_VEHICULO,
  pagos: CAMPOS_PAGO,
  prospectos: CAMPOS_PROSPECTO,
  comisiones: CAMPOS_COMISION,
  tareas: CAMPOS_TAREA,
};

/** Prefijo de id que usa el CRM web al crear cada tipo de registro */
export const PREFIJO_ID: Record<Modulo, string> = {
  clientes: 'C', polizas: 'P', siniestros: 'S', vehiculos: 'V', pagos: 'PAG', prospectos: 'PR', comisiones: 'COM', tareas: 'T',
};

/** Claves internas que no se muestran como campo suelto */
export const OCULTOS = new Set([
  'id', 'archivos', 'historial', 'historialWA', 'historialComms', 'historialEmail', 'tareas', 'cotizaciones', 'amparos', '_edicionManual', 'etiquetas',
  'asegPreferidas', 'interes', 'creadoDesde', 'reminderSent', '_autoTipo', 'contactoLibre',
]);
