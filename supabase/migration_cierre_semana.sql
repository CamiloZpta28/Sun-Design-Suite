-- =============================================================
-- Sun Design Suite · Migración: el día en que cierra la semana
--
-- Los resúmenes semanales se entregan el viernes. Cuando ese viernes es
-- festivo, el equipo entero entrega el jueves, y hasta ahora la plataforma no
-- tenía cómo enterarse: a todo el mundo le seguía apareciendo "pendiente"
-- hasta el viernes.
--
-- Esta tabla guarda solo las semanas EXCEPCIONALES. Una semana sin fila aquí
-- cierra el viernes, que es lo normal — por eso la tabla se queda casi vacía y
-- no hay que registrar nada cada semana.
--
-- Es distinto del "hasta" de cada resumen, que ya existía: ese es individual
-- (quien sale de vacaciones el jueves cierra el suyo el miércoles) y no le
-- mueve la semana a nadie más.
--
-- Si NO la corres no se rompe nada: todas las semanas cierran el viernes,
-- como hasta ahora, y el control para cambiarlo avisa que falta la migración.
--
-- Pégala en Supabase > SQL Editor > New query y presiona "Run".
-- Es seguro correrla más de una vez.
-- =============================================================

create table if not exists semanas_cierre (
  -- El lunes de la semana. Una fila por semana, a lo sumo.
  semana date primary key,
  -- El día en que cierra. La aplicación no deja ponerlo fuera de su semana.
  cierre date not null,
  -- Por qué se movió ("Viernes festivo"). Se muestra al equipo, para que el
  -- cambio se explique solo.
  nota text,
  actualizado_por text,
  updated_at timestamptz default now()
);

alter table semanas_cierre enable row level security;

-- Lo ve todo el mundo: es la fecha en que a cada quien le toca entregar.
drop policy if exists "Lectura del cierre de semana" on semanas_cierre;
create policy "Lectura del cierre de semana" on semanas_cierre
  for select using (auth.role() = 'authenticated');

-- Lo mueven solo los líderes y el Desarrollador: correr el cierre le cambia la
-- fecha de entrega a todo el equipo, no solo a quien lo pulsa.
drop policy if exists "Mover el cierre solo lideres" on semanas_cierre;
create policy "Mover el cierre solo lideres" on semanas_cierre
  for all using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
      and ur.role_key in ('lider_civil','lider_electrico','lider_delineantes','lider_diseno','desarrollador')
    )
  );
