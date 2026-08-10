/* ============================================================================
   CATÁLOGO DE NOTAS TÉCNICAS — transcripción documental
   ----------------------------------------------------------------------------
   Transcrito una sola vez desde el archivo fuente
   "notas_tecnicas_repositorio_global.txt" (formato NOTAS_TECNICAS_PARAMETRIZADAS_V1),
   limitado a los parámetros usados por la plantilla "1.2 Notas técnicas -
   cerramiento perimetral". El archivo .txt NO se lee en tiempo de ejecución:
   esto es la fuente de verdad desde que se implementó esta funcionalidad.

   Este catálogo es documental/trazabilidad (de dónde salió cada ID, con qué
   categoría y grupo se pensó originalmente, y el valor de referencia del
   documento fuente). El motor de resolución (ver engine.js) NO lee
   "valorReferencia" para rellenar notas — cada ID se resuelve exclusivamente
   a través de PARAMETER_RESOLVERS (resolvers.js), que decide si el valor
   viene del proyecto, se deriva de otro campo, o es una constante fija.
   Usar "valorReferencia" como reemplazo silencioso de un dato faltante
   violaría la regla de "no inventar información".
   ============================================================================ */

export const SISTEMA = {
  CERRAMIENTO_PERIMETRAL: 'CERRAMIENTO_PERIMETRAL',
  PORTON_METALICO: 'PORTON_METALICO',
};

/* Solo se transcriben aquí los IDs que efectivamente aparecen interpolados
   en el texto de la sección 1.2 (cerramiento perimetral). El documento fuente
   etiqueta algunos de estos IDs con aplica_a: ambos sistemas, pero varios
   (ej. las normas de curado de concreto) solo se usan de verdad en la
   plantilla del portón — ver "origen" para el detalle de cada caso. */
export const PARAMETER_CATALOG = [
  { id: 'GEOTECNIA_CERRAMIENTO_CAPACIDAD_ADMISIBLE', categoria: 'Geotecnia', grupo: 'Cerramiento perimetral', tipoDato: 'capacidad_admisible', valorReferencia: '13.00kN (1.30 ton)', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CONCRETO_SOLADO_FC', categoria: 'Concreto', grupo: 'Global', tipoDato: 'resistencia_compresion', valorReferencia: '14 MPa', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CONCRETO_SOLADO_ESPESOR', categoria: 'Concreto', grupo: 'Global', tipoDato: 'longitud', valorReferencia: '5 cm', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_PEDESTAL_DIAMETRO', categoria: 'Cimentación', grupo: 'Cerramiento perimetral', tipoDato: 'diametro', valorReferencia: '30 cm de diámetro', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_PEDESTAL_DESPLANTE', categoria: 'Cimentación', grupo: 'Cerramiento perimetral', tipoDato: 'longitud', valorReferencia: '90 cm de desplante', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_SOLADO_ADICIONAL', categoria: 'Cimentación', grupo: 'Cerramiento perimetral', tipoDato: 'longitud', valorReferencia: 'más 5 cm de solado', origen: 'no declarado como DERIVAR_DATO en el archivo fuente; el valor coincide textualmente con CONCRETO_SOLADO_ESPESOR — se trata como derivado por decisión de implementación, ver README de este módulo' },
  { id: 'CONCRETO_ESTRUCTURAL_FC', categoria: 'Concreto', grupo: 'Global', tipoDato: 'resistencia_compresion', valorReferencia: '21 MPa', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'ACERO_REFUERZO_NORMA', categoria: 'Acero de refuerzo', grupo: 'Global', tipoDato: 'norma_material', valorReferencia: 'ASTM A706', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_POSTE_DIAMETRO', categoria: 'Perfilería metálica', grupo: 'Poste típico', tipoDato: 'diametro_nominal', valorReferencia: 'Ø 2”', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_POSTE_ESPESOR', categoria: 'Perfilería metálica', grupo: 'Poste típico', tipoDato: 'espesor', valorReferencia: '1.50 mm', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_POSTE_LONGITUD_TOTAL', categoria: 'Perfilería metálica', grupo: 'Poste típico', tipoDato: 'longitud', valorReferencia: '3.00 m', origen: 'derivado (anclaje + afloramiento); el archivo fuente lo lista como campo propio pero matemáticamente coincide con la suma de los otros dos' },
  { id: 'CERRAMIENTO_POSTE_ANCLAJE', categoria: 'Perfilería metálica', grupo: 'Poste típico', tipoDato: 'longitud', valorReferencia: '50 cm', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_POSTE_AFLORAMIENTO', categoria: 'Perfilería metálica', grupo: 'Poste típico', tipoDato: 'longitud', valorReferencia: '2.50 m', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_POSTE_SEPARACION', categoria: 'Perfilería metálica', grupo: 'Poste típico', tipoDato: 'separacion', valorReferencia: '2.50 m', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_TUBO_SECUNDARIO_DIAMETRO', categoria: 'Perfilería metálica', grupo: 'Diagonales y vientos', tipoDato: 'diametro_nominal', valorReferencia: 'Ø 1 1/2”', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_TUBO_SECUNDARIO_ESPESOR', categoria: 'Perfilería metálica', grupo: 'Diagonales y vientos', tipoDato: 'espesor', valorReferencia: '1.90 mm', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_DIAGONALES_SEPARACION', categoria: 'Perfilería metálica', grupo: 'Diagonales', tipoDato: 'separacion', valorReferencia: '12.50 m (los 12.50 m son al poste central de las dos diagonales)', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_VIENTOS_SEPARACION', categoria: 'Perfilería metálica', grupo: 'Vientos', tipoDato: 'separacion', valorReferencia: '25 m', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_BANDIT_CALIBRE', categoria: 'Accesorios', grupo: 'Cerramiento perimetral', tipoDato: 'calibre', valorReferencia: 'calibre 1/2”', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_ACERO_NORMA', categoria: 'Acero estructural', grupo: 'Cerramiento perimetral', tipoDato: 'norma_material', valorReferencia: 'ASTM A1011', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_ACERO_FY', categoria: 'Acero estructural', grupo: 'Cerramiento perimetral', tipoDato: 'esfuerzo_fluencia', valorReferencia: '172 MPa', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'CERRAMIENTO_ACERO_FU', categoria: 'Acero estructural', grupo: 'Cerramiento perimetral', tipoDato: 'esfuerzo_ultimo', valorReferencia: '303 MPa', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'GALVANIZADO_CLASE', categoria: 'Protección anticorrosiva', grupo: 'Global', tipoDato: 'clase_galvanizado', valorReferencia: 'Z450', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'AMBIENTE_CORROSION_CLASE', categoria: 'Protección anticorrosiva', grupo: 'Cerramiento perimetral', tipoDato: 'clase_ambiente', valorReferencia: 'C2', origen: 'dato resaltado en negrita del documento fuente' },
  { id: 'GALVANIZADO_PERDIDA_ZINC_PROYECTADA', categoria: 'Protección anticorrosiva', grupo: 'Cerramiento perimetral', tipoDato: 'espesor_perdido', valorReferencia: '31.52 μm', origen: 'dato resaltado en negrita del documento fuente; en el original parece un resultado de cálculo de tasa de corrosión (ISO 9223/9224) — esta implementación NO calcula ese valor automáticamente, se captura como dato de proyecto' },
];

/* Reglas de reutilización/derivación del archivo fuente, restringidas a las
   que aplican dentro del alcance actual (cerramiento perimetral). */
export const PARAMETER_RELATIONS = [
  { regla: 'REUTILIZAR_DATO', campo: 'CONCRETO_ESTRUCTURAL_FC', descripcion: "Dentro del alcance de cerramiento, este ID toma el f'c ya capturado para la cimentación del cerramiento (dim_ciment_cerramiento.resistencia). El archivo fuente lo declara reutilizable también con el portón metálico; eso queda pendiente para cuando se habilite esa plantilla." },
  { regla: 'REUTILIZAR_DATO', campo: 'GALVANIZADO_CLASE', descripcion: 'Toma el mismo valor que el campo existente "Tipo de galvanizado" de Estructural, compartido con el resto de la app.' },
  { regla: 'DERIVAR_DATO', campos: ['CERRAMIENTO_POSTE_DIAMETRO', 'CERRAMIENTO_POSTE_ESPESOR'], usadoEn: ['POSTE_TIPICO', 'TAPON_REDONDO'], descripcion: 'La especificación del tapón (nota 17) reutiliza directamente diámetro y espesor del poste típico (nota 13); no se pide un input aparte.' },
  { regla: 'REUTILIZAR_DATO', campos: ['CERRAMIENTO_TUBO_SECUNDARIO_DIAMETRO', 'CERRAMIENTO_TUBO_SECUNDARIO_ESPESOR'], usadoEn: ['DIAGONALES', 'VIENTOS'], descripcion: 'Diagonales y vientos comparten la misma familia de tubería: un solo par de campos alimenta ambas notas.' },
];
