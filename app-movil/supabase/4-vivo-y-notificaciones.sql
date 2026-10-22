-- =====================================================================
-- JAC Seguros · SINCRONIZACION INSTANTANEA + NOTIFICACIONES
--
-- Que hace (se puede correr mas de una vez sin dañar nada):
--   1. Activa "Realtime" en las tablas del CRM: cuando algo cambia en el
--      web, en el telefono o en otra computadora, los demas lo ven al
--      instante (antes podia tardar hasta 45 segundos).
--   2. Crea la tabla donde se guardan los telefonos/computadoras que
--      aceptaron notificaciones (cada usuario ve solo las suyas).
--   3. Crea la tabla que evita que un mismo aviso llegue dos veces.
--   4. Programa la funcion "avisos" para que revise cada 5 minutos.
--
-- ANTES DE CORRER: reemplazar  PEGAR_AQUI_EL_CRON_SECRET  por el valor
-- de CRON_SECRET (viene en el archivo privado de llaves; NO se publica).
-- =====================================================================

-- ---------- 1. Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['clientes','polizas','vehiculos','siniestros','pagos','tareas','comisiones','prospectos','ventas_cruzadas','crm_meta'] loop
    if to_regclass('public.' || t) is not null and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- 2. Dispositivos con notificaciones ----------
create table if not exists public.push_suscripciones (
  endpoint text primary key check (endpoint like 'https://%'),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  dispositivo text,
  creado timestamptz not null default now(),
  ultimo_uso timestamptz not null default now()
);
alter table public.push_suscripciones enable row level security;
revoke all on public.push_suscripciones from anon;
grant select, insert, update, delete on public.push_suscripciones to authenticated;

drop policy if exists push_propias_ver on public.push_suscripciones;
drop policy if exists push_propias_crear on public.push_suscripciones;
drop policy if exists push_propias_cambiar on public.push_suscripciones;
drop policy if exists push_propias_borrar on public.push_suscripciones;
create policy push_propias_ver on public.push_suscripciones for select to authenticated using (user_id = auth.uid());
create policy push_propias_crear on public.push_suscripciones for insert to authenticated with check (user_id = auth.uid());
create policy push_propias_cambiar on public.push_suscripciones for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_propias_borrar on public.push_suscripciones for delete to authenticated using (user_id = auth.uid());

-- ---------- 3. Avisos ya enviados (solo la funcion la usa) ----------
create table if not exists public.push_enviados (
  clave text primary key,
  enviado timestamptz not null default now()
);
alter table public.push_enviados enable row level security;
revoke all on public.push_enviados from anon, authenticated;

-- ---------- 4. Revisar cada 5 minutos ----------
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'jac-avisos') then
    perform cron.unschedule('jac-avisos');
  end if;
end $$;

select cron.schedule(
  'jac-avisos',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://xiogddofwmwfacmnsojg.supabase.co/functions/v1/avisos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'PEGAR_AQUI_EL_CRON_SECRET'),
    body := '{"modo":"cron"}'::jsonb,
    timeout_milliseconds := 20000
  );
  $cron$
);

-- Comprobacion: deben salir las tablas en Realtime y la tarea programada.
select 'realtime' as que, string_agg(tablename, ', ' order by tablename) as detalle
  from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
union all
select 'cron', jobname || ' · ' || schedule from cron.job where jobname = 'jac-avisos';
