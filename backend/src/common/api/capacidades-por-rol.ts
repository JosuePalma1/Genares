const ROL_SUPERUSUARIO = 'SUPERUSUARIO';

const LECTURA = ['trabajos:leer', 'evaluaciones:leer'];

/** Capacidades por actor, según Paso 1 §2 y Paso 2 Anexo A.4. */
const CAPACIDADES_INSTITUCIONALES = {
  // Califica sus evaluaciones y consulta sus sesiones; sin rúbricas ni programación.
  TRIBUNAL: [...LECTURA, 'programaciones:leer', 'integracion:guardar-borrador', 'integracion:cerrar-evaluacion',
    'evaluaciones:solicitar-correccion'],
  // Supervisión, programación, rúbricas, documentos, cierre, correcciones y auditoría de su carrera.
  COORDINACION: [...LECTURA, 'programaciones:leer', 'programaciones:administrar', 'rubricas:leer',
    'rubricas:administrar', 'modalidades:leer', 'carreras:leer', 'documentos:emitir', 'trabajos:finalizar',
    'evaluaciones:autorizar-correccion', 'configuracion-academica:administrar'],
  // Consulta transversal TI/Software; programa y cierra con permiso; sin editar rúbricas.
  PRESIDENCIA: [...LECTURA, 'programaciones:leer', 'programaciones:administrar', 'rubricas:leer',
    'modalidades:leer', 'carreras:leer', 'trabajos:finalizar'],
  // Consulta de su carrera.
  COMISION: [...LECTURA, 'rubricas:leer', 'modalidades:leer', 'carreras:leer'],
  // Resultados y documentos; sin editar notas, rúbricas ni programación.
  SECRETARIA: [...LECTURA, 'documentos:emitir'],
  // Solo configuración técnica y auditoría; sin trabajos ni notas.
  ADMINISTRACION: ['configuracion-academica:administrar', 'carreras:leer', 'modalidades:leer'],
};

export type RolInstitucional = keyof typeof CAPACIDADES_INSTITUCIONALES | typeof ROL_SUPERUSUARIO;

export const CAPACIDADES_POR_ROL: Readonly<Record<RolInstitucional, readonly string[]>> = Object.freeze({
  ...CAPACIDADES_INSTITUCIONALES,
  SUPERUSUARIO: [...new Set(Object.values(CAPACIDADES_INSTITUCIONALES).flat())],
});
