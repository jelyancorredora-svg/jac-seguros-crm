/*
 * 📧 EmailJS: enviar correos DIRECTO desde la app, sin abrir la app de correo,
 * con la misma configuracion que el CRM web (crm_meta "emailjs":
 * ejs-pub, ejs-svc, ejs-tpl-general, ejs-tpl-bday, ejs-tpl-ren).
 * Usa la API REST de EmailJS (la misma que usa su libreria en el navegador).
 */

export type ConfigEmailJS = {
  'ejs-pub'?: string;
  'ejs-svc'?: string;
  'ejs-tpl-general'?: string;
  'ejs-tpl-bday'?: string;
  'ejs-tpl-ren'?: string;
};

export const CAMPOS_EJS: Array<[keyof ConfigEmailJS, string, boolean]> = [
  ['ejs-pub', 'Public Key', true],
  ['ejs-svc', 'Service ID', true],
  ['ejs-tpl-general', 'Template ID (correos generales)', true],
  ['ejs-tpl-ren', 'Template ID (renovaciones)', false],
  ['ejs-tpl-bday', 'Template ID (cumpleaños)', false],
];

const URL_EJS = 'https://api.emailjs.com/api/v1.0/email/send';

/** Plantilla a usar para un correo (igual que sendEmailViaEJS del web) */
export function plantillaEJS(cfg: ConfigEmailJS | null | undefined, tipo: 'general' | 'ren' | 'bday' = 'general'): string {
  if (!cfg?.['ejs-pub'] || !cfg['ejs-svc']) return '';
  if (tipo === 'ren') return cfg['ejs-tpl-ren'] || cfg['ejs-tpl-general'] || '';
  if (tipo === 'bday') return cfg['ejs-tpl-bday'] || cfg['ejs-tpl-general'] || '';
  return cfg['ejs-tpl-general'] || cfg['ejs-tpl-ren'] || cfg['ejs-tpl-bday'] || '';
}

export const emailJSListo = (cfg: ConfigEmailJS | null | undefined) => !!plantillaEJS(cfg);

/** Parametros que el web manda a la plantilla general */
export function parametrosCorreo(para: string, asunto: string, cuerpo: string, extra: Record<string, string> = {}) {
  const de = 'jcastro@jacsegurospa.com';
  return {
    to_name: '', to_email: para.trim(), subject: asunto, message: cuerpo,
    from_name: 'JAC Seguros | Jely An Castro', from_email: de, reply_to: de,
    company: 'JAC Seguros', phone: '+507 6292-6010', ...extra,
  };
}

export async function enviarEmailJS(cfg: ConfigEmailJS, plantilla: string, params: Record<string, unknown>, f: typeof fetch = fetch): Promise<void> {
  if (!cfg['ejs-pub'] || !cfg['ejs-svc'] || !plantilla) throw new Error('Configura EmailJS en Más → Configuración del CRM.');
  const r = await f(URL_EJS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ service_id: cfg['ejs-svc'], template_id: plantilla, user_id: cfg['ejs-pub'], template_params: params }),
  });
  if (!r.ok) {
    const t = (await r.text().catch(() => '')).slice(0, 200);
    throw new Error(r.status === 400 || r.status === 404 ? `EmailJS no aceptó la configuración: ${t || r.status}` : `EmailJS respondió ${r.status}${t ? ': ' + t : ''}`);
  }
}
