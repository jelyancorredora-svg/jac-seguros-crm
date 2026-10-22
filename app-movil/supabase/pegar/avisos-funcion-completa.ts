/*
 * ARCHIVO UNICO para pegar en Supabase → Edge Functions → "avisos".
 * (Es la union de functions/avisos/index.ts + logica.ts.)
 *
 * JAC Seguros · funcion "avisos" (Supabase Edge Function)
 *
 * - Cada 5 minutos la llama pg_cron (con el secreto CRON_SECRET) y envia:
 *   recordatorios de tareas y reuniones de la agenda, y el resumen diario.
 * - La app la llama con la sesion del usuario para mandar una prueba.
 *
 * Secretos: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_EMAIL, CRON_SECRET.
 * SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
 */
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

// ===================== reglas (logica.ts) =====================
/*
 * Que avisar y cuando. Sin red ni base: solo reglas, para poder probarlas.
 * Hora de Panama (UTC-5, sin horario de verano).
 */

export type Tarea = { id: string; titulo?: string | null; estado?: string | null; etapa_tarea?: string | null; fecha_limite?: string | null; extra?: Record<string, unknown> | null };
export type Reunion = { id?: string; titulo?: string; fecha?: string; hora?: string; lugar?: string; tipo?: string };
export type Resumen = { vencenHoy: number; vencenSemana: number; tareasHoy: number; reunionesHoy: number; seguimientosHoy: number; cumpleHoy: number };
export type Aviso = { clave: string; title: string; body: string; tag: string };

export const OFFSET_MIN = -5 * 60;
const VENTANA_MIN = 45; // el cron corre cada 5 min; si se atrasa, igual avisa

/** Fecha y minutos del dia en Panama */
export function local(ahora: Date): { fecha: string; min: number; ms: number } {
  const ms = ahora.getTime() + OFFSET_MIN * 60_000;
  const d = new Date(ms);
  return { fecha: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes(), ms };
}

/** Momento (ms en "hora local como UTC") de una fecha + HH:MM */
function momento(fecha: string, hora: string): number | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(fecha);
  const h = /^(\d{1,2}):(\d{2})/.exec(hora);
  if (!m || !h) return null;
  return Date.parse(`${m[1]}T${h[1].padStart(2, '0')}:${h[2]}:00Z`);
}

const CERRADA = /^(hecho|completad[ao]|realizado|finalizado|cancelada|eliminada|done)$/i;
export const tareaAbierta = (t: Tarea) => !CERRADA.test(t.estado ?? '') && !CERRADA.test(t.etapa_tarea ?? '');

function textoMin(m: number): string {
  if (m >= 1440) return `${Math.round(m / 1440)} día${m >= 2880 ? 's' : ''}`;
  if (m >= 60) return `${Math.round(m / 60)} hora${m >= 120 ? 's' : ''}`;
  return `${m} min`;
}
const corto = (s: string, n = 90) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function avisosTareas(tareas: Tarea[], ahora: Date): Aviso[] {
  const { ms } = local(ahora);
  const out: Aviso[] = [];
  for (const t of tareas) {
    if (!tareaAbierta(t) || !t.fecha_limite) continue;
    const ex = (t.extra ?? {}) as Record<string, unknown>;
    const hora = typeof ex.hora === 'string' && ex.hora ? ex.hora : '';
    const rem = typeof ex.reminder === 'string' && /^\d+$/.test(ex.reminder) ? Number(ex.reminder) : typeof ex.reminder === 'number' ? ex.reminder : null;
    if (!hora && rem === null) continue; // sin hora ni recordatorio: va en el resumen diario
    const due = momento(t.fecha_limite, hora || '09:00'); // el CRM web usa las 9:00 si no hay hora
    if (due === null) continue;
    const at = due - (rem ?? 0) * 60_000;
    if (ms < at || ms >= at + VENTANA_MIN * 60_000) continue;
    out.push({
      clave: `t:${t.id}:${new Date(at).toISOString().slice(0, 16)}`,
      title: rem ? `⏰ En ${textoMin(rem)}` : '⏰ Tarea ahora',
      body: corto(`${t.titulo || 'Tarea'}${hora ? ' · ' + hora : ''}`),
      tag: `t-${t.id}`,
    });
  }
  return out;
}

export function avisosReuniones(reuniones: Reunion[], ahora: Date, antes = 30): Aviso[] {
  const { ms } = local(ahora);
  const out: Aviso[] = [];
  for (const r of reuniones) {
    if (!r || !r.fecha || !r.hora) continue;
    const due = momento(r.fecha, r.hora);
    if (due === null) continue;
    const at = due - antes * 60_000;
    if (ms < at || ms >= at + VENTANA_MIN * 60_000) continue;
    out.push({
      clave: `r:${r.id ?? ''}:${r.fecha}T${r.hora}`,
      title: `👥 Reunión a las ${r.hora}`,
      body: corto(`${r.titulo || 'Reunión'}${r.tipo === 'virtual' ? ' · virtual' : r.lugar ? ' · ' + r.lugar : ''}`),
      tag: `r-${r.id ?? r.fecha + r.hora}`,
    });
  }
  return out;
}

/** Resumen diario entre 7:30 y 8:15 a. m. */
export function avisoResumen(r: Resumen, ahora: Date): Aviso | null {
  const { fecha, min } = local(ahora);
  if (min < 7 * 60 + 30 || min >= 8 * 60 + 15) return null;
  const partes: string[] = [];
  if (r.vencenHoy) partes.push(`${r.vencenHoy} póliza${r.vencenHoy > 1 ? 's vencen' : ' vence'} hoy`);
  if (r.vencenSemana > r.vencenHoy) partes.push(`${r.vencenSemana} vencen en 7 días`);
  if (r.tareasHoy) partes.push(`${r.tareasHoy} tarea${r.tareasHoy > 1 ? 's' : ''}`);
  if (r.reunionesHoy) partes.push(`${r.reunionesHoy} reunión${r.reunionesHoy > 1 ? 'es' : ''}`);
  if (r.seguimientosHoy) partes.push(`${r.seguimientosHoy} seguimiento${r.seguimientosHoy > 1 ? 's' : ''}`);
  if (r.cumpleHoy) partes.push(`🎂 ${r.cumpleHoy} cumpleaños`);
  if (!partes.length) return null;
  return { clave: `resumen:${fecha}`, title: '☀️ Tu día en JAC Seguros', body: partes.join(' · '), tag: `resumen-${fecha}` };
}

export type Cumpleanero = { id: string; nombre?: string | null; f_nac?: string | null };

/**
 * Cumpleaños de hoy, uno por cliente, a partir de las 8:00 a. m. (con la misma
 * ventana que las tareas por si el cron se atrasa). Si son mas de 5, un solo
 * aviso con la lista para no llenar el telefono.
 */
export function avisosCumple(clientes: Cumpleanero[], ahora: Date): Aviso[] {
  const { fecha, min } = local(ahora);
  if (min < 8 * 60 || min >= 8 * 60 + VENTANA_MIN) return [];
  const hoy = clientes.filter((c) => typeof c.f_nac === 'string' && c.f_nac.slice(5, 10) === fecha.slice(5, 10));
  const edad = (c: Cumpleanero) => Number(fecha.slice(0, 4)) - Number(String(c.f_nac).slice(0, 4));
  const nom = (c: Cumpleanero) => (c.nombre || 'Cliente').trim();
  if (hoy.length > 5) {
    return [{
      clave: `cumple:${fecha}`, title: `🎂 ${hoy.length} clientes cumplen años hoy`,
      body: corto(hoy.map(nom).join(', '), 160), tag: `cumple-${fecha}`,
    }];
  }
  return hoy.map((c) => {
    const e = edad(c);
    return {
      clave: `c:${c.id}:${fecha}`,
      title: `🎂 Hoy cumple ${corto(nom(c), 40)}`,
      body: `${e > 0 && e < 120 ? `Cumple ${e} años · ` : ''}Envíale tu felicitación y su tarjeta desde Más → Cumpleaños.`,
      tag: `cumple-${c.id}`,
    };
  });
}

/** Suma dias a una fecha AAAA-MM-DD */
export function masDias(fecha: string, n: number): string {
  return new Date(Date.parse(fecha + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10);
}
// ===================== fin reglas =====================


const ORIGENES = ['https://crm.jacsegurospa.com', 'https://jacsegurospa.com', 'https://www.jacsegurospa.com', 'http://localhost:5173', 'http://localhost:4173'];
const env = (k: string) => Deno.env.get(k) ?? '';

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGENES.includes(o) ? o : ORIGENES[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, x-cron-secret, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** Comparacion en tiempo constante del secreto del cron */
function igual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

type Sub = { endpoint: string; p256dh: string; auth: string; user_id: string };

Deno.serve(async (req) => {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  if (req.method !== 'POST') return new Response('Método no permitido', { status: 405, headers: h });
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...h, 'Content-Type': 'application/json' } });

  const llave = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SECRET_KEY');
  if (!env('VAPID_PUBLIC') || !env('VAPID_PRIVATE') || !llave) return json({ error: 'Faltan secretos en la función' }, 500);
  webpush.setVapidDetails(env('VAPID_EMAIL') || 'mailto:jelyancorredora@gmail.com', env('VAPID_PUBLIC'), env('VAPID_PRIVATE'));
  const db = createClient(env('SUPABASE_URL'), llave, { auth: { persistSession: false, autoRefreshToken: false } });

  let cuerpo: { modo?: string } = {};
  try { cuerpo = await req.json(); } catch { /* vacio */ }

  // ---------- quien llama ----------
  let soloUsuario: string | null = null;
  if (cuerpo.modo === 'prueba') {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data, error } = await db.auth.getUser(token);
    if (error || !data.user) return json({ error: 'Sesión no válida' }, 401);
    soloUsuario = data.user.id;
  } else if (!igual(req.headers.get('x-cron-secret') ?? '', env('CRON_SECRET'))) {
    return json({ error: 'No autorizado' }, 401);
  }

  // ---------- a quien ----------
  let q = db.from('push_suscripciones').select('endpoint,p256dh,auth,user_id');
  if (soloUsuario) q = q.eq('user_id', soloUsuario);
  const { data: subs, error: eSubs } = await q;
  if (eSubs) return json({ error: 'No se pudieron leer las suscripciones' }, 500);
  if (!subs?.length) return json({ enviados: 0, avisos: 0 });

  // ---------- que ----------
  const ahora = new Date();
  let avisos: Aviso[] = [];
  if (soloUsuario) {
    avisos = [{ clave: '', title: '🔔 Notificaciones activadas', body: 'Así te llegarán los recordatorios de JAC Seguros.', tag: 'prueba' }];
  } else {
    const { fecha } = local(ahora);
    const ayer = masDias(fecha, -1), manana = masDias(fecha, 1), en7 = masDias(fecha, 7);
    const [rt, rm, rp, rs, rc] = await Promise.all([
      db.from('tareas').select('id,titulo,estado,etapa_tarea,fecha_limite,extra').gte('fecha_limite', ayer).lte('fecha_limite', manana),
      db.from('crm_meta').select('valor').eq('clave', 'calReuniones').maybeSingle(),
      db.from('polizas').select('id,estado,fecha_fin').gte('fecha_fin', fecha).lte('fecha_fin', en7),
      db.from('prospectos').select('id,etapa_venta,f_seguimiento').eq('f_seguimiento', fecha),
      db.from('clientes').select('id,nombre,f_nac').like('f_nac', `%-${fecha.slice(5)}`),
    ]);
    const tareas = (rt.data ?? []) as Tarea[];
    const reuniones = (Array.isArray(rm.data?.valor) ? rm.data!.valor : []) as Reunion[];
    const polizas = (rp.data ?? []).filter((p) => !/cancelad/i.test(String(p.estado ?? '')));
    avisos = [...avisosTareas(tareas, ahora), ...avisosReuniones(reuniones, ahora)];
    const resumen = avisoResumen({
      vencenHoy: polizas.filter((p) => p.fecha_fin === fecha).length,
      vencenSemana: polizas.length,
      tareasHoy: tareas.filter((t) => t.fecha_limite === fecha && tareaAbierta(t)).length,
      reunionesHoy: reuniones.filter((r) => r?.fecha === fecha).length,
      seguimientosHoy: (rs.data ?? []).filter((p) => !/^(cliente ganado|perdido)$/i.test(String(p.etapa_venta ?? ''))).length,
      cumpleHoy: (rc.data ?? []).length,
    }, ahora);
    if (resumen) avisos.push(resumen);
    avisos.push(...avisosCumple((rc.data ?? []) as Cumpleanero[], ahora));

    // Cada aviso sale UNA sola vez: se reserva su clave antes de enviarlo.
    if (avisos.length) {
      const { data: nuevos, error: eRes } = await db.from('push_enviados')
        .upsert(avisos.map((a) => ({ clave: a.clave })), { onConflict: 'clave', ignoreDuplicates: true }).select('clave');
      if (eRes) return json({ error: 'No se pudo reservar el envío' }, 500);
      const libres = new Set((nuevos ?? []).map((n) => n.clave));
      avisos = avisos.filter((a) => libres.has(a.clave));
    }
    // limpieza de registros viejos (una vez al dia)
    if (local(ahora).min < 10) await db.from('push_enviados').delete().lt('enviado', new Date(Date.now() - 30 * 86_400_000).toISOString());
  }
  if (!avisos.length) return json({ enviados: 0, avisos: 0 });

  // ---------- enviar ----------
  let enviados = 0;
  const vencidas: string[] = [];
  for (const s of subs as Sub[]) {
    for (const a of avisos) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: a.title, body: a.body, tag: a.tag }),
          { TTL: 3600, urgency: 'high' },
        );
        enviados++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) { vencidas.push(s.endpoint); break; }
      }
    }
  }
  if (vencidas.length) await db.from('push_suscripciones').delete().in('endpoint', vencidas);
  return json({ enviados, avisos: avisos.length });
});
