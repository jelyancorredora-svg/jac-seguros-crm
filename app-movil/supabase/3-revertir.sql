-- Plan B: si tras 2-proteger.sql algo no carga, esto deja acceso a
-- CUALQUIER usuario con sesion iniciada (sin lista blanca), manteniendo
-- bloqueado al rol anonimo. Luego avisar para revisar el caso.
create or replace function public.es_del_equipo()
returns boolean language sql stable security definer set search_path = public
as $$ select auth.role() = 'authenticated' $$;
