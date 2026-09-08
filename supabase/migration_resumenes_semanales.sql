-- =============================================================
-- Sun Design Suite · Migración: resúmenes semanales
--
-- Un resumen por persona y por semana. Los cuatro bloques de texto (Lo mejor,
-- Pendientes, Dificultades, Temas) van en "bloques", y la foto del avance de
-- sus proyectos en "proyectos".
--
-- Esa foto se GUARDA en vez de recalcularse a propósito: si se recalculara,
-- el número de una semana vieja cambiaría cada vez que alguien toca un
-- documento, y la comparación con la semana siguiente —que es de lo que se
-- trata todo esto— dejaría de significar nada.
--
-- Si NO la corres no se rompe nada de lo que ya funciona: la sección de
-- resúmenes avisa que falta la migración y el resto de la aplicación sigue
-- igual.
--
-- Pégala en Supabase > SQL Editor > New query y presiona "Run".
-- Es seguro correrla más de una vez.
-- =============================================================

create table if not exists resumenes_semanales (
  -- Determinista ('resumen-<usuario>-<lunes>') para que guardar dos veces la
  -- misma semana actualice la fila en vez de crear otra.
  id text primary key,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  semana date not null,          -- el lunes de esa semana
  hasta date,                    -- último día que cubre; normalmente el viernes
  -- { "lo_mejor": [...], "pendientes": [...], "dificultades": [...], "temas": [...] }
  bloques jsonb not null default '{}'::jsonb,
  -- La foto del avance: [{ id, nombre, total, porEstado, estados, nombres, cambios, avanzaron }]
  proyectos jsonb not null default '[]'::jsonb,
  -- Borrador mientras se escribe; al marcarlo como enviado la foto se congela.
  enviado boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (usuario_id, semana)
);

-- Para la vista del equipo, que pide una semana completa de un golpe.
create index if not exists resumenes_semanales_semana_idx on resumenes_semanales (semana);

alter table resumenes_semanales enable row level security;

-- Los lee todo el equipo: la idea es justamente poder ver en qué va cada
-- quien y que los líderes analicen su área.
drop policy if exists "Lectura de resumenes semanales" on resumenes_semanales;
create policy "Lectura de resumenes semanales" on resumenes_semanales
  for select using (auth.role() = 'authenticated');

-- Pero cada quien escribe solo el suyo. Que la pantalla no ofrezca editar el
-- ajeno no basta: la regla tiene que estar aquí.
drop policy if exists "Crear mi resumen semanal" on resumenes_semanales;
create policy "Crear mi resumen semanal" on resumenes_semanales
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "Editar mi resumen semanal" on resumenes_semanales;
create policy "Editar mi resumen semanal" on resumenes_semanales
  for update using (auth.uid() = usuario_id);

drop policy if exists "Borrar mi resumen semanal" on resumenes_semanales;
create policy "Borrar mi resumen semanal" on resumenes_semanales
  for delete using (auth.uid() = usuario_id);
