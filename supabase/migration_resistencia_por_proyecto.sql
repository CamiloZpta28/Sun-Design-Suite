-- =============================================================
-- Sun Design Suite · Migración: la resistencia del concreto pasa de la
-- plantilla de cimentación al proyecto.
--
-- La misma geometría —un CT Tipo 1— se funde en 21 MPa en un proyecto y en
-- 28 en otro, así que la resistencia dejó de ser un dato de la plantilla y
-- pasó a ser uno del proyecto (pestaña Estructural, un campo por cada
-- cimentación).
--
-- Esto NO crea ni cambia tablas: la resistencia vive en projects.data, que
-- es jsonb. Lo único que hace es copiar el valor que ya tenía la plantilla
-- elegida a cada proyecto que la usa, para que nadie tenga que volver a
-- llenar a mano lo que ya estaba puesto.
--
-- Si NO la corres no se rompe nada: los proyectos abren con la resistencia
-- en blanco y hay que elegirla de nuevo en cada uno.
--
-- Pégalo en Supabase > SQL Editor > New query y presiona "Run".
-- Es seguro correrlo más de una vez: solo llena lo que esté vacío.
-- =============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'postes_mt', 'luminarias', 'camaras', 'inversores',
    'cerramiento_postes', 'cerramiento_porton', 'cerramiento_paso_fauna',
    'shelter_ct', 'shelter_trampa_aceite'
  ]
  loop
    update projects p
       set data = jsonb_set(
             /* El jsonb_set de adentro garantiza que exista "estructural":
                un proyecto viejo puede no tener todavía esa pestaña. */
             jsonb_set(
               coalesce(p.data, '{}'::jsonb),
               '{estructural}',
               coalesce(p.data -> 'estructural', '{}'::jsonb),
               true
             ),
             array['estructural', 'resistencia_' || t],
             to_jsonb(pl.datos ->> 'resistencia'),
             true
           )
      from cimentacion_plantillas pl
     where pl.id = p.data -> 'estructural' ->> ('plantilla_' || t)
       and coalesce(pl.datos ->> 'resistencia', '') <> ''
       -- No pisa lo que alguien ya haya elegido en el proyecto.
       and coalesce(p.data -> 'estructural' ->> ('resistencia_' || t), '') = '';
  end loop;
end $$;
