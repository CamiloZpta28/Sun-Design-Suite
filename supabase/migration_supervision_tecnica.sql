-- =============================================================
-- Supervisión técnica
-- -------------------------------------------------------------
-- Marca en cada inversionista si sus entregas pasan por Supervisión técnica.
-- Los proyectos de un inversionista marcado muestran la pestaña "Supervisión
-- técnica"; los demás no la ven.
--
-- Los paquetes de entrega en sí NO necesitan tabla: viven dentro de
-- projects.data.supervision, con las mismas funciones de guardado parcial que
-- ya usan las pestañas técnicas (merge_project_data_section).
--
-- Pega este archivo en Supabase > SQL Editor > New query y presiona "Run".
-- Correrlo dos veces no hace daño.
-- =============================================================

alter table inversionistas
  add column if not exists supervision_tecnica boolean not null default false;

-- Skandia y COX pueden no existir todavía en la lista compartida.
insert into inversionistas (nombre)
values ('Skandia'), ('COX')
on conflict (nombre) do nothing;

-- Los que hoy llevan supervisión técnica. Para sumar otro más adelante no
-- hace falta SQL: se marca la casilla "Requiere supervisión técnica" en la
-- pestaña General de cualquier proyecto de ese inversionista.
update inversionistas
set supervision_tecnica = true
where upper(nombre) in ('CFM', 'SKANDIA', 'COX');
