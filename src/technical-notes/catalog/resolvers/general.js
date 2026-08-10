import { GENERAL } from '../categories/index.js';
import { fixedValue } from '../../resolverKit.js';

/* Unidad general de los planos: en este sistema es SIEMPRE metros, así que
   deja de ser un parámetro capturable. Se resuelve con un valor fijo, no
   aparece como campo editable en ninguna pantalla, nunca queda pendiente y
   no resta completitud.

   LEGACY IGNORADO: proyectos antiguos pueden conservar
   technicalNotes.overrides.GENERAL.UNIDAD_PLANOS = "cm" | "mm". Ese dato NO
   se migra, NO se borra y NO se usa: simplemente deja de leerse. GEN-001 se
   resuelve siempre con "m" con independencia de lo que haya guardado.

   OJO — esto NO convierte unidades de ningún otro parámetro: espesores en
   mm, resistencias en MPa, diámetros en pulgadas y longitudes en cm
   conservan cada uno su propia unidad. UNIDAD_PLANOS solo alimenta el texto
   de GEN-001. */
/* Se resuelve con la palabra completa ("metros", no la abreviatura "m")
   porque el valor se interpola dentro de una frase corrida: "Las dimensiones
   están dadas en metros a menos que…". El catálogo declara las opciones
   abreviadas (m/cm/mm), pero eso ya no se usa: la unidad es fija. */
export const UNIDAD_PLANOS_FIJA = 'metros';

export function buildGeneralResolvers() {
  return {
    UNIDAD_PLANOS: fixedValue({
      id: 'UNIDAD_PLANOS',
      label: GENERAL.inputs.UNIDAD_PLANOS ? 'Unidad de los planos (fija: metros)' : 'Unidad de los planos',
      value: UNIDAD_PLANOS_FIJA,
    }),
  };
}
