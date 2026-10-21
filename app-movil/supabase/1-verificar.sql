-- JAC Seguros · REVISION DE SEGURIDAD (solo lectura, no cambia nada)
-- Copiar TODO, pegar en Supabase > SQL Editor > New query, y pulsar Run
-- sin seleccionar nada. Sale una sola tabla con todo.

select 'Tabla SIN proteccion (RLS)' as revision, c.relname::text as detalle
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

union all
select 'Politica', tablename || ' · ' || policyname || ' · roles: ' || array_to_string(roles, ',')
       || ' · ' || cmd || ' · condicion: ' || coalesce(qual, '-')
from pg_policies
where schemaname = 'public'

union all
select 'Permiso del rol anonimo', table_name || ' · ' || privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'

union all
select 'Deposito de archivos', id || ' · publico: ' || public::text
from storage.buckets

union all
select 'Usuario', email || ' · ultimo acceso: ' || coalesce(last_sign_in_at::text, 'nunca')
from auth.users;
