-- =============================================================
-- Sun Design Suite · Migración: solo el Líder de Diseño asigna líderes
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql (y migration_roles_notas_documentos.sql) antes de esta
-- actualización. Pégalo en el SQL Editor de Supabase y presiona "Run".
--
-- Reemplaza las políticas anteriores de user_roles: antes, cualquier
-- líder podía otorgar o quitar CUALQUIER rol (incluidos los de líder).
-- Ahora, los roles de líder (lider_civil, lider_electrico,
-- lider_delineantes, lider_diseno) solo los puede otorgar o quitar el
-- propio Líder de Diseño. Los demás roles (técnicos + Control de
-- Calidad Interno) los sigue pudiendo gestionar cualquier líder.
-- =============================================================

drop policy if exists "Lideres asignan roles" on user_roles;
drop policy if exists "Lideres quitan roles" on user_roles;

create policy "Asignar roles" on user_roles
  for insert with check (
    (
      role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno')
      and exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key = 'lider_diseno')
    )
    or
    (
      role_key not in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno')
      and exists (
        select 1 from user_roles ur
        where ur.user_id = auth.uid()
        and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno')
      )
    )
  );

create policy "Quitar roles" on user_roles
  for delete using (
    (
      role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno')
      and exists (select 1 from user_roles ur where ur.user_id = auth.uid() and ur.role_key = 'lider_diseno')
    )
    or
    (
      role_key not in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno')
      and exists (
        select 1 from user_roles ur
        where ur.user_id = auth.uid()
        and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno')
      )
    )
  );
