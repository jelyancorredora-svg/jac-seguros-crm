/*
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
import { avisoResumen, avisosReuniones, avisosTareas, local, masDias, tareaAbierta, type Aviso, type Reunion, type Tarea } from './logica.ts';

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
      db.from('clientes').select('id,f_nac').like('f_nac', `%-${fecha.slice(5)}`),
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
