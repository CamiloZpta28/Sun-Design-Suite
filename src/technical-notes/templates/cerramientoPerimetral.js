/* ============================================================================
   PLANTILLA — Notas técnicas: Cerramiento perimetral (sección "1.2" del
   archivo fuente "notas_tecnicas_repositorio_global.txt").
   ----------------------------------------------------------------------------
   Texto transcrito TAL CUAL del documento fuente: no se resumió, no se
   redactó de nuevo y no se corrigieron las inconsistencias detectadas
   durante el análisis (ver NOTES.md de este módulo). Cada nota conserva su
   numeración original (1–29) y los placeholders {{ID}} exactamente como
   aparecen en el archivo fuente.

   Deliberadamente NO se incluye aquí la sección "1.1 Notas técnicas - portón
   metálico": el archivo fuente ya la contiene, pero esta primera
   implementación solo habilita cerramiento perimetral (ver
   TECHNICAL_NOTE_SPECS en ../specs.js). Cuando se habilite portón, su texto
   se transcribe en un archivo hermano (ej. portonMetalico.js) siguiendo la
   misma forma — no debería requerir tocar el motor de resolución.
   ============================================================================ */

export const CERRAMIENTO_PERIMETRAL_TEMPLATE = {
  specId: 'CERRAMIENTO_PERIMETRAL',
  titulo: 'Notas técnicas - cerramiento perimetral',
  numeracionFuente: '1.2',
  secciones: [
    {
      titulo: '1. Información geotécnica y cimentación del cerramiento',
      notas: [
        { numero: 1, texto: 'El sistema de cimentación del cerramiento deberá apoyarse sobre el estrato competente definido en el estudio geotécnico del proyecto.' },
        { numero: 2, texto: 'Para los bloques de concreto del cerramiento se considerará una capacidad admisible mínima del suelo en condición de servicio de {{GEOTECNIA_CERRAMIENTO_CAPACIDAD_ADMISIBLE}}.' },
        { numero: 3, texto: "Bajo los elementos de cimentación se deberá disponer un concreto pobre de solado con espesor mínimo de {{CONCRETO_SOLADO_ESPESOR}} y resistencia a la compresión f'c = {{CONCRETO_SOLADO_FC}}, cuando aplique de acuerdo con planos." },
        { numero: 4, texto: 'Los pedestales de concreto del cerramiento tendrán sección circular de {{CERRAMIENTO_PEDESTAL_DIAMETRO}}, con {{CERRAMIENTO_PEDESTAL_DESPLANTE}}, {{CERRAMIENTO_SOLADO_ADICIONAL}}. El poste metálico deberá quedar embebido 50 cm dentro del pedestal.' },
        { numero: 5, texto: "El concreto de los pedestales tendrá una resistencia mínima a la compresión de f'c = {{CONCRETO_ESTRUCTURAL_FC}}." },
        { numero: 6, texto: 'Las cotas de desplante estarán sujetas a verificación y aprobación en obra, de acuerdo con las condiciones reales del terreno y el relieve encontrado durante la ejecución.' },
      ],
    },
    {
      titulo: '2. Estructuras de concreto reforzado y concreto simple',
      notas: [
        { numero: 7, texto: 'El diseño de los elementos de concretos asociados al cerramiento se realizó conforme al Reglamento Colombiano de Construcción Sismo Resistente NSR-10.' },
        { numero: 8, texto: 'El acero de refuerzo, cuando aplique, será corrugado con esfuerzo de fluencia fy = 420 MPa, cumpliendo con la norma {{ACERO_REFUERZO_NORMA}}.' },
        { numero: 9, texto: 'Los agregados deberán cumplir con la norma NTC 174 / ASTM C33, con tamaño máximo nominal de 3/4”.' },
        { numero: 10, texto: "La resistencia mínima del concreto para los bloques, pedestales y elementos de cimentación del cerramiento será f'c = {{CONCRETO_ESTRUCTURAL_FC}}." },
        { numero: 11, texto: 'Todas las dimensiones, alineamientos, niveles y cotas deberán ser verificados por el contratista antes del inicio de las actividades.' },
        { numero: 12, texto: 'Cualquier modificación respecto a dimensiones, materiales, ubicación de postes, separación entre elementos o sistema constructivo deberá ser consultada y aprobada por el diseñador responsable.' },
      ],
    },
    {
      titulo: '3. Perfilería metálica y accesorios del cerramiento',
      notas: [
        { numero: 13, texto: 'El poste típico (PT) será en tubería galvanizada de diámetro nominal {{CERRAMIENTO_POSTE_DIAMETRO}}, espesor {{CERRAMIENTO_POSTE_ESPESOR}}, figurado con tubos de {{CERRAMIENTO_POSTE_LONGITUD_TOTAL}} de longitud total, incluyendo {{CERRAMIENTO_POSTE_ANCLAJE}} de anclaje y {{CERRAMIENTO_POSTE_AFLORAMIENTO}} de afloramiento. Los postes estarán distribuidos cada {{CERRAMIENTO_POSTE_SEPARACION}}.' },
        { numero: 14, texto: 'Las diagonales serán en tubería galvanizada de diámetro nominal {{CERRAMIENTO_TUBO_SECUNDARIO_DIAMETRO}}, espesor {{CERRAMIENTO_TUBO_SECUNDARIO_ESPESOR}}, con longitud de 3.40 m, dispuestas a ambos lados cada {{CERRAMIENTO_DIAGONALES_SEPARACION}}, soldadas de cabeza a pata del poste vertical. Se deberán disponer diagonales adicionales en esquinas y cambios de dirección, según planos.' },
        { numero: 15, texto: 'Los vientos serán en tubería galvanizada de diámetro nominal {{CERRAMIENTO_TUBO_SECUNDARIO_DIAMETRO}}, espesor {{CERRAMIENTO_TUBO_SECUNDARIO_ESPESOR}}, con longitud de 3.62 m. Se ubicarán cada {{CERRAMIENTO_VIENTOS_SEPARACION}} y en cada cambio de dirección horizontal del cerramiento.' },
        { numero: 16, texto: 'La malla será eslabonada galvanizada, con ojo de 6 cm x 6 cm, calibre 10.5, en rollos de 2.00 m de alto.' },
        { numero: 17, texto: 'Se instalarán tapones redondos para protección superior de las tuberías de diámetro {{CERRAMIENTO_POSTE_DIAMETRO}} espesor {{CERRAMIENTO_POSTE_ESPESOR}}, garantizando en todos los casos su correcto ajuste y estabilidad durante la instalación.' },
        { numero: 18, texto: 'La malla se amarrará mediante cinta bandit en aluminio {{CERRAMIENTO_BANDIT_CALIBRE}}, con separación máxima de 50 cm.' },
        { numero: 19, texto: 'Los perfiles metálicos del cerramiento serán en perfilería conforme a NTC 1560 / {{CERRAMIENTO_ACERO_NORMA}}, con esfuerzo de fluencia fy = {{CERRAMIENTO_ACERO_FY}} y esfuerzo último de rotura fu = {{CERRAMIENTO_ACERO_FU}}, o superior, siempre que se garantice compatibilidad dimensional, mecánica y de galvanizado con lo indicado en los planos estructurales.' },
        { numero: 20, texto: 'La perfilería del cerramiento deberá contar con galvanizado {{GALVANIZADO_CLASE}}, adecuado para ambiente de corrosión {{AMBIENTE_CORROSION_CLASE}}, considerando una pérdida esperada de recubrimiento de zinc de {{GALVANIZADO_PERDIDA_ZINC_PROYECTADA}}, con el fin de cumplir la vida útil proyectada de 30 años.' },
        { numero: 21, texto: 'El contratista o constructor deberá garantizar, mediante certificación del proveedor de tornillería, cinta bandit y accesorios, que los materiales suministrados no generen par galvánico con la tubería del cerramiento ni con los elementos que conforman el portón.' },
      ],
    },
    {
      titulo: '4. Soldaduras y protección del galvanizado',
      notas: [
        { numero: 22, texto: 'Las soldaduras del cerramiento se ejecutarán mediante proceso de soldadura por arco eléctrico SMAW, empleando electrodo E6011, con espesor mínimo de soldadura de 3 mm y cordón continuo, salvo indicación diferente en planos.' },
        { numero: 23, texto: 'Las zonas afectadas por soldadura, corte, perforación o pérdida del galvanizado deberán repararse con pintura para galvanizado en frío, con concentración mínima de zinc del 92%, aplicando mínimo cuatro capas uniformes, de acuerdo con las recomendaciones del proveedor.' },
        { numero: 24, texto: 'Previo a la aplicación del galvanizado en frío, la superficie deberá estar limpia, seca y libre de escoria, grasa, óxido o contaminantes que afecten la adherencia del recubrimiento.' },
      ],
    },
    {
      titulo: '5. Proceso de tensado de la malla galvanizada',
      notas: [
        { numero: 25, texto: 'La malla galvanizada se instalará fijándola inicialmente al poste de arranque mediante alambre conduit o sistema equivalente, con separación máxima de 50 cm.' },
        { numero: 26, texto: 'Al extremo libre de la malla se insertará una barra metálica vertical, con el fin de distribuir uniformemente la tensión sobre toda la altura del elemento.' },
        { numero: 27, texto: 'La malla deberá tensionarse mediante cinta con ratchet o sistema mecánico equivalente, garantizando alineación, verticalidad y tensión uniforme.' },
        { numero: 28, texto: 'Una vez tensionada, la malla se fijará al resto de postes mediante alambre conduit, cinta bandit o sistema aprobado, manteniendo una separación máxima de 50 cm entre puntos de fijación.' },
        { numero: 29, texto: 'La malla deberá quedar correctamente alineada, sin ondulaciones excesivas, pandeos, zonas flojas o puntos de concentración de tensión que puedan afectar su durabilidad o estabilidad.' },
      ],
    },
  ],
};
