-- =====================================================================
-- JAC Seguros · PROTECCION DE DATOS (RLS)
--
-- Que hace:
--   * Solo los correos de la tabla equipo_autorizado pueden leer o
--     escribir. Alguien que logre crear una cuenta no ve nada.
--   * El rol anonimo (la clave publica que esta en el sitio web) pierde
--     todo acceso a las tablas.
--   * updated_at se pone solo en cada cambio (lo usa la sincronizacion).
--
-- ANTES DE CORRER:
--   1. Correr 1-verificar.sql y guardar el resultado.
--   2. Cambiar los correos de abajo por los del equipo real.
--   3. Hacerlo en un momento tranquilo y luego entrar al CRM web y a la
--      app para confirmar que todo carga. Si algo falla, 3-revertir.sql
--      deja las politicas como "cualquier usuario con sesion".
-- =====================================================================

begin;

-- ---------- Lista blanca del equipo ----------
create table if not exists public.equipo_autorizado (
  email text primary key check (email = lower(email)),
  nombre text,
  creado timestamptz not null default now()
);
alter table public.equipo_autorizado enable row level security;
revoke all on public.equipo_autorizado from anon, authenticated;

-- >>> CAMBIAR POR LOS CORREOS DEL EQUIPO <<<
insert into public.equipo_autorizado (email, nombre) values
  ('jelyancorredora@gmail.com', 'Jelyan')
on conflict (email) do nothing;

create or replace function public.es_del_equipo()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.equipo_autorizado
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.es_del_equipo() from public, anon;
grant execute on function public.es_del_equipo() to authenticated;

-- ---------- Politicas por tabla ----------
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'clientes','polizas','vehiculos','siniestros','pagos','tareas',
    'comisiones','prospectos','ventas_cruzadas','crm_meta','jac_crm_data'
  ] loop
    if to_regclass('public.' || t) is null then
      raise notice 'No existe la tabla %, se omite', t;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    -- quitar politicas anteriores (pueden ser permisivas)
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format($f$create policy equipo_lee on public.%I
      for select to authenticated using (public.es_del_equipo())$f$, t);
    execute format($f$create policy equipo_crea on public.%I
      for insert to authenticated with check (public.es_del_equipo())$f$, t);
    execute format($f$create policy equipo_edita on public.%I
      for update to authenticated using (public.es_del_equipo()) with check (public.es_del_equipo())$f$, t);
    execute format($f$create policy equipo_borra on public.%I
      for delete to authenticated using (public.es_del_equipo())$f$, t);
  end loop;
end $$;

-- ---------- updated_at automatico ----------
create or replace function public.tocar_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['clientes','polizas','vehiculos','siniestros','pagos','tareas',
                           'comisiones','prospectos','ventas_cruzadas'] loop
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = t and column_name = 'updated_at') then
      execute format('drop trigger if exists tocar_updated_at on public.%I', t);
      execute format('create trigger tocar_updated_at before update on public.%I
                      for each row execute function public.tocar_updated_at()', t);
    end if;
  end loop;
end $$;

-- ---------- Adjuntos (Storage) ----------
update storage.buckets set public = false where id = 'adjuntos';

do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname = 'storage' and tablename = 'objects' and policyname like 'jac_adjuntos_%' loop
    execute format('drop policy %I on storage.objects', p.policyname);
  end loop;
end $$;

create policy jac_adjuntos_equipo on storage.objects
  for all to authenticated
  using (bucket_id = 'adjuntos' and public.es_del_equipo())
  with check (bucket_id = 'adjuntos' and public.es_del_equipo());

commit;

-- Despues, en el panel de Supabase:
--   Authentication > Sign In / Providers > Email: desactivar "Allow new users to sign up".
--   Authentication > Multi-Factor: activar TOTP.
--   Authentication > Policies: contraseña minima 12 y "leaked password protection".
