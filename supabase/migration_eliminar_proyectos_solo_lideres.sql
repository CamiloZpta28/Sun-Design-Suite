-- =============================================================
-- Sun Design Suite · Migración: eliminar proyectos solo líderes
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
--
-- Requiere que la tabla user_roles ya exista (si aún no la tienes,
-- corre primero supabase/migration_roles_notas_documentos.sql).
-- =============================================================

drop policy if exists "Eliminar proyectos" on projects;

create policy "Eliminar proyectos solo lideres" on projects
  for delete using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno')
    )
  );
