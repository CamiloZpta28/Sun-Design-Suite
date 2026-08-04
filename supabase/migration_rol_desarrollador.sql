-- =============================================================
-- Sun Design Suite · Migración: rol de Desarrollador (todos los
-- permisos)
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql (y las migraciones de roles) antes de esta
-- actualización. Pégalo en el SQL Editor de Supabase y presiona
-- "Run".
--
-- El rol "desarrollador" no necesita una fila nueva en ninguna
-- tabla de catálogo (los roles son texto libre en user_roles), así
-- que esta migración solo actualiza las políticas de seguridad
-- para que ese rol tenga todos los permisos: los de líder, los de
-- Líder de Diseño (incluida la posibilidad de asignar roles de
-- líder y de eliminar usuarios) y los de Control de Calidad Interno
-- (ver esas políticas en el propio código de la app, ya que
-- "Control de Calidad Interno" no restringe nada a nivel de base
-- de datos, solo en la interfaz).
-- =============================================================

-- Eliminar cuentas de perfiles: antes solo Líder de Diseño, ahora también Desarrollador.
drop policy if exists "Solo lider de diseno elimina perfiles" on profiles;
create policy "Solo lider de diseno elimina perfiles" on profiles
  for delete using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_diseno','desarrollador')
    )
  );

-- Eliminar proyectos: antes cualquier líder, ahora también Desarrollador.
drop policy if exists "Eliminar proyectos solo lideres" on projects;
create policy "Eliminar proyectos solo lideres" on projects
  for delete using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
    )
  );

-- Asignar / quitar roles: un Desarrollador puede otorgar cualquier rol,
-- incluidos los de líder y el propio rol de Desarrollador. Los demás
-- líderes solo pueden otorgar roles técnicos / Control de Calidad.
drop policy if exists "Asignar roles" on user_roles;
create policy "Asignar roles" on user_roles
  for insert with check (
    (
      role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      and exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key in ('lider_diseno','desarrollador'))
    )
    or
    (
      role_key not in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      and exists (
        select 1 from user_roles ur
        where ur.user_id = auth.uid()
        and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      )
    )
  );

drop policy if exists "Quitar roles" on user_roles;
create policy "Quitar roles" on user_roles
  for delete using (
    (
      role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      and exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key in ('lider_diseno','desarrollador'))
    )
    or
    (
      role_key not in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      and exists (
        select 1 from user_roles ur
        where ur.user_id = auth.uid()
        and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
      )
    )
  );

-- -------------------------------------------------------------
-- Para convertir a alguien en Desarrollador (requiere que ya haya
-- creado su cuenta al menos una vez), un Líder de Diseño puede
-- hacerlo directamente desde la sección "Equipo" de la app. Si
-- todavía no tienes ningún Líder de Diseño, usa el mismo bootstrap
-- manual descrito en schema.sql / migration_roles_notas_documentos.sql.
-- -------------------------------------------------------------
