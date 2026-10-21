-- =====================================================================
-- JAC Seguros · VERIFICACION DE SEGURIDAD (solo lectura, no cambia nada)
-- Pegar en Supabase > SQL Editor > Run.
-- =====================================================================

-- 1) ¿Que tablas NO tienen RLS activado?  (debe salir VACIO)
select c.relname as tabla_sin_rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 2) Politicas actuales por tabla. Revisar que NINGUNA diga roles = {anon}
--    o {public} con qual = true: eso deja leer la cartera sin iniciar sesion.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, policyname;

-- 3) Permisos directos del rol anonimo (debe salir VACIO tras el paso 2).
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
order by table_name;

-- 4) ¿El deposito de adjuntos es publico?  (public debe ser false)
select id, public from storage.buckets;

-- 5) Usuarios que existen hoy. Todos deberian ser del equipo.
select email, created_at, last_sign_in_at,
       (select count(*) from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified') as factores_2fa
from auth.users u order by last_sign_in_at desc nulls last;
