-- =============================================================
-- Sun Design Suite · Migración: eliminar usuarios (solo Líder de Diseño)
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
--
-- Requiere que la tabla user_roles ya exista (si aún no la tienes,
-- corre primero supabase/migration_roles_notas_documentos.sql).
-- =============================================================

drop policy if exists "Solo lider de diseno elimina perfiles" on profiles;
create policy "Solo lider de diseno elimina perfiles" on profiles
  for delete using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key = 'lider_diseno'
    )
  );
