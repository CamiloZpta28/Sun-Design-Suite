-- =============================================================
-- Sun Design Suite · Migración: ausencias (vacaciones, incapacidades)
--
-- Hasta ahora, quien salía de vacaciones o quedaba incapacitado aparecía en la
-- lista del equipo como "No lo envió", en rojo, junto a quien simplemente no
-- lo hizo. Esta tabla permite decir por qué no estuvo.
--
-- Se registra UNA VEZ con su rango de fechas y cubre todas las semanas que
-- toque; no hay que marcar nada cada lunes. Y la puede registrar un líder por
-- alguien más, que es lo que hace falta de verdad: quien está incapacitado no
-- entra a la plataforma a marcarse.
--
-- Solo tapa la semana la ausencia que la cubre ENTERA, del lunes al día de
-- cierre. Quien trabajó aunque fuera un día sigue entregando su resumen, y
-- para cerrarlo antes ya estaba el campo "hasta" de cada resumen.
--
-- Si NO la corres no se rompe nada: la lista del equipo se comporta como
-- hasta ahora y el registro de ausencias no aparece.
--
-- Pégala en Supabase > SQL Editor > New query y presiona "Run".
-- Es seguro correrla más de una vez.
-- =============================================================

create table if not exists ausencias (
  id text primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  desde date not null,
  hasta date not null,           -- inclusive: el último día que la persona no está
  motivo text not null,          -- vacaciones | incapacidad | permiso | licencia
  nota text,
  registrada_por text,           -- el nombre de quien la anotó, para poder preguntarle
  created_at timestamptz default now()
);

-- La vista del equipo pide las que tocan un rango de semanas.
create index if not exists ausencias_rango_idx on ausencias (desde, hasta);

alter table ausencias enable row level security;

-- Las ve todo el equipo: sin eso, la lista no podría explicar por qué alguien
-- no entregó.
drop policy if exists "Lectura de ausencias" on ausencias;
create policy "Lectura de ausencias" on ausencias
  for select using (auth.role() = 'authenticated');

-- Las registra cada quien para sí mismo, o un líder para cualquiera.
drop policy if exists "Registrar ausencias" on ausencias;
create policy "Registrar ausencias" on ausencias
  for insert with check (
    auth.uid() = usuario_id
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
    )
  );

-- Y con el mismo criterio se corrigen o se borran: una fecha mal puesta deja a
-- alguien "ausente" una semana que sí trabajó.
drop policy if exists "Editar ausencias" on ausencias;
create policy "Editar ausencias" on ausencias
  for update using (
    auth.uid() = usuario_id
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
    )
  );

drop policy if exists "Borrar ausencias" on ausencias;
create policy "Borrar ausencias" on ausencias
  for delete using (
    auth.uid() = usuario_id
    or exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
    )
  );
