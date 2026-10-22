-- =====================================================================
-- JAC Seguros · ARCHIVOS SIN LIMITE PROPIO
--
-- Quita el tope de tamaño y de tipo de archivo del deposito "adjuntos".
-- Despues de esto, el unico limite es el de tu plan de Supabase:
--   Supabase → Storage → Settings → "Upload file size limit"
--   (plan gratis: hasta 50 MB por archivo y 1 GB en total;
--    plan Pro: hasta 500 GB por archivo, 100 GB incluidos y luego
--    se paga solo lo que se use).
-- El deposito sigue PRIVADO: solo tu cuenta puede ver tus archivos.
-- Se puede correr mas de una vez.
-- =====================================================================

update storage.buckets
   set file_size_limit = null,      -- sin tope propio (usa el del plan)
       allowed_mime_types = null,   -- cualquier tipo: PDF, fotos, videos, Word, Excel…
       public = false
 where id = 'adjuntos';

-- Comprobacion
select id, public, file_size_limit, allowed_mime_types,
       (select count(*) from storage.objects o where o.bucket_id = 'adjuntos') as archivos,
       (select pg_size_pretty(coalesce(sum((o.metadata->>'size')::bigint), 0))
          from storage.objects o where o.bucket_id = 'adjuntos') as espacio_usado
  from storage.buckets where id = 'adjuntos';
