-- =============================================================
-- Sun Design Suite · Migración: fecha de cumpleaños / ingreso
-- Solo necesitas correr este archivo si YA habías ejecutado
-- schema.sql antes de esta actualización. Pégalo en el SQL Editor
-- de Supabase y presiona "Run".
-- =============================================================

alter table profiles add column if not exists fecha_cumpleanos date;
alter table profiles add column if not exists fecha_ingreso date;

-- El Líder de Diseño (o un Desarrollador) también puede editar el perfil de
-- cualquier persona, para poner fecha de cumpleaños/ingreso desde la ficha
-- de esa persona en "Equipo" (antes solo cada quien podía editar su propio
-- perfil).
drop policy if exists "Lider de diseno edita cualquier perfil" on profiles;
create policy "Lider de diseno edita cualquier perfil" on profiles
  for update using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_diseno','desarrollador')
    )
  );
