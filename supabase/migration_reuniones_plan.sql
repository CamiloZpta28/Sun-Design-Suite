-- =============================================================
-- Sun Design Suite · Migración: el plan de la semana (reunión civil)
--
-- Al final de la reunión civil, el líder reparte el trabajo de la semana:
-- a cada quien una lista ordenada de tareas —el orden ES la prioridad—,
-- casi siempre ligadas a un proyecto.
--
-- Una fila por reunión, semana y persona, con las tareas en "items". El
-- equipo de cada proyecto NO se toca desde aquí: sigue viviendo en el
-- proyecto, para que no haya dos sitios diciendo quién trabaja qué.
--
-- REQUIERE que ya estén corridas migration_rol_invitado.sql y
-- migration_reuniones.sql. Ya trae la regla de invitados para su tabla.
--
-- Si NO la corres no se rompe nada: la reunión civil funciona igual y el
-- plan de la semana avisa que falta la migración.
--
-- Pégala en Supabase > SQL Editor > New query y presiona "Run".
-- Es seguro correrla más de una vez.
-- =============================================================

do $$
begin
  if not exists (select 1 from pg_proc where proname = 'es_invitado') then
    raise exception 'Falta correr primero supabase/migration_rol_invitado.sql';
  end if;
end $$;

begin;

create table if not exists reuniones_planes (
  -- 'plan-<reunión>-<lunes>-<persona>': guardar dos veces el plan de alguien
  -- actualiza la fila en vez de crear otra.
  id text primary key,
  serie text not null,
  semana date not null,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  -- [{ id, proyecto_id, tarea }], en orden de prioridad.
  items jsonb not null default '[]'::jsonb,
  actualizado_por text,
  updated_at timestamptz default now(),
  unique (serie, semana, usuario_id)
);

create index if not exists reuniones_planes_semana_idx on reuniones_planes (semana);

alter table reuniones_planes enable row level security;

drop policy if exists "Lectura de planes" on reuniones_planes;
create policy "Lectura de planes" on reuniones_planes
  for select using (auth.role() = 'authenticated');

-- El plan lo reparte el líder civil (y, como en el resto de la plataforma,
-- el Líder de Diseño y el Desarrollador). Nadie más: es su decisión.
drop policy if exists "Planes solo lider civil" on reuniones_planes;
create policy "Planes solo lider civil" on reuniones_planes
  for all using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_diseno','desarrollador')
    )
  );

drop policy if exists "Invitado no ve reuniones" on reuniones_planes;
create policy "Invitado no ve reuniones" on reuniones_planes
  as restrictive for select to authenticated using (not es_invitado());
drop policy if exists "Invitado no crea" on reuniones_planes;
drop policy if exists "Invitado no edita" on reuniones_planes;
drop policy if exists "Invitado no borra" on reuniones_planes;
create policy "Invitado no crea" on reuniones_planes
  as restrictive for insert to authenticated with check (not es_invitado());
create policy "Invitado no edita" on reuniones_planes
  as restrictive for update to authenticated using (not es_invitado());
create policy "Invitado no borra" on reuniones_planes
  as restrictive for delete to authenticated using (not es_invitado());

commit;
