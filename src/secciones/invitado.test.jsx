// @vitest-environment jsdom
/* ============================================================================
   INVITADO — lo que cambia en la aplicación para quien no tiene rol de equipo.
   ----------------------------------------------------------------------------
   Las reglas viven en shared/permisos.js (ver permisos.test.js) y la ficha
   del proyecto se prueba en Proyecto.test.jsx. Aquí: la lista sin "Nuevo
   proyecto", los resúmenes semanales sin invitados, y que App.jsx conecte
   todo lo anterior. La base de datos aplica la misma regla por su lado (ver
   supabase/migration_rol_invitado.sql).
   ============================================================================ */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../supabaseClient', () => {
  const respuesta = Promise.resolve({ data: [], error: null });
  const cadena = () => new Proxy(() => cadena(), {
    get: (_, prop) => {
      if (prop === 'then') return respuesta.then.bind(respuesta);
      return () => cadena();
    },
    apply: () => cadena(),
  });
  return { supabase: cadena(), retornoDeAcceso: { recuperacion: false, error: null } };
});

const { ProjectListView } = await import('../App.jsx');
const { haceSeguimientoSemanal } = await import('./Resumenes.jsx');

afterEach(cleanup);

describe('la lista de proyectos', () => {
  const pintar = (onNewProject) => render(
    <ProjectListView
      projects={[{ id: 'p1', nombre: 'Chinú 3', estado: 'activo', equipo: {}, documentos: {}, data: { general: {} } }]}
      title="Todos los Proyectos"
      subtitle="Portafolio"
      onOpen={() => {}}
      onNewProject={onNewProject}
      directorio={[]}
    />,
  );

  it('ofrece crear un proyecto a quien puede', () => {
    pintar(() => {});
    expect(screen.queryByRole('button', { name: /Nuevo Proyecto/ })).toBeTruthy();
  });

  /* App.jsx no le pasa con qué crear a un invitado: el botón no aparece. */
  it('a un invitado no', () => {
    pintar(null);
    expect(screen.queryByRole('button', { name: /Nuevo Proyecto/ })).toBe(null);
    expect(screen.getByText('Chinú 3')).toBeTruthy();
  });
});

/* Un invitado sigue los proyectos, no los trabaja: en la lista de la semana
   solo saldría como alguien que "no lo envió". */
describe('resúmenes semanales', () => {
  it('no se le piden a un invitado', () => {
    expect(haceSeguimientoSemanal({ roles: [] })).toBe(false);
  });

  it('sí a quien es del equipo', () => {
    expect(haceSeguimientoSemanal({ roles: ['civil'] })).toBe(true);
    expect(haceSeguimientoSemanal({ roles: ['desarrollador', 'civil'] })).toBe(true);
  });

  it('y siguen sin pedírsele a quien solo es desarrollador', () => {
    expect(haceSeguimientoSemanal({ roles: ['desarrollador'] })).toBe(false);
  });
});

/* Las piezas funcionan por separado; esto revisa que App.jsx las use. Cada
   una de estas líneas, si faltara, dejaría una puerta abierta que ninguna
   otra prueba ve: una sección del menú, una dirección pegada a mano, el
   botón de crear, o los datos personales en el perfil. */
describe('App.jsx conecta al invitado', () => {
  const app = fs.readFileSync(path.resolve(__dirname, '../App.jsx'), 'utf8');

  it('el menú solo muestra lo que puede ver', () => {
    expect(app).toMatch(/const navItems = todasLasSecciones\.filter\(\(item\) => puedeVerVista\(perfil, item\.key\)\)/);
  });

  it('lo que se pinta pasa por el filtro, no por la vista pedida', () => {
    expect(app).toMatch(/const vistaActual = puedeVerVista\(perfil, view\) \? view : 'dashboard'/);
    const contenido = app.slice(app.indexOf('<Suspense fallback={<LoadingScreen mensaje="Cargando sección…" />}>'));
    expect(contenido).not.toMatch(/\{view === '/);
  });

  it('no le da con qué crear proyectos', () => {
    expect(app).toMatch(/const abrirCrearProyecto = puedeCrearProyectos \? \(\) => setShowCreate\(true\) : null/);
    expect(app).not.toMatch(/onNewProject=\{\(\) => setShowCreate\(true\)\}/);
    expect(app).toMatch(/\{showCreate && puedeCrearProyectos && \(/);
  });

  it('los datos personales van y vienen de su propia tabla', () => {
    expect(app).toMatch(/supabase\.from\('datos_personales'\)\.select\('\*'\)/);
    expect(app).toMatch(/supabase\.from\('datos_personales'\)\.upsert\(/);
    expect(app).toMatch(/separarDatosPersonales\(patch\)/);
  });

  it('la ficha de una persona solo los enseña a quien puede verlos', () => {
    expect(app).toMatch(/\{puedeVerDatosPersonales\(perfil, persona\) && \(/);
  });

  it('en Equipo, los invitados salen aparte, al principio', () => {
    expect(app).toMatch(/const sinRol = directorio\.filter\(esInvitado\)/);
  });
});
