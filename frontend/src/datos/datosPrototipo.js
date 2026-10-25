export const ESTADO_EVALUACION = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  BORRADOR: 'BORRADOR',
  CERRADA: 'CERRADA',
});

export const ALCANCE_ETAPA_RUBRICA = Object.freeze({
  TRABAJO_COMPARTIDO: 'TRABAJO_COMPARTIDO',
  ESTUDIANTE_INDIVIDUAL: 'ESTUDIANTE_INDIVIDUAL',
});

export const CARRERAS_DEMOSTRACION = Object.freeze([
  Object.freeze({ codigo: 'TI', nombre: 'Tecnologías de la Información' }),
  Object.freeze({ codigo: 'SOFT', nombre: 'Ingeniería en Software' }),
]);

export const modalidades = [
  { id: 'mod-proyecto-integrador', codigo: 'PROYECTO_INTEGRADOR', nombre: 'Proyecto integrador', estaActivo: true },
  { id: 'mod-desarrollo-implementacion', codigo: 'DESARROLLO_IMPLEMENTACION', nombre: 'Desarrollo o implementación', estaActivo: true },
  { id: 'mod-sistematizacion-experiencias', codigo: 'SISTEMATIZACION_EXPERIENCIAS', nombre: 'Sistematización de experiencias', estaActivo: true },
  { id: 'mod-articulo-cientifico', codigo: 'ARTICULO_CIENTIFICO', nombre: 'Artículo científico', estaActivo: true },
];

export const periodosAcademicos = [
  { id: 'periodo-2026-1', codigo: '2026-1', estaActivo: true },
  { id: 'periodo-2026-2', codigo: '2026-2', estaActivo: true },
];

export const personas = [
  { id: 'docente-daniela', tipoPersona: 'DOCENTE', cedula: '1300000101', nombres: 'Daniela', apellidos: 'Cedeño', carrera: 'Tecnologías de la Información', carreraCodigo: 'TI' },
  { id: 'docente-maria', tipoPersona: 'DOCENTE', cedula: '1300000102', nombres: 'María Elena', apellidos: 'López Vera', carrera: 'Tecnologías de la Información', carreraCodigo: 'TI', cargaTrabajo: 3 },
  { id: 'docente-jose', tipoPersona: 'DOCENTE', cedula: '1300000103', nombres: 'José Antonio', apellidos: 'Mendoza Ruiz', carrera: 'Ingeniería en Software', carreraCodigo: 'SOFT', cargaTrabajo: 2 },
  { id: 'docente-paola', tipoPersona: 'DOCENTE', cedula: '1300000104', nombres: 'Paola', apellidos: 'Reyes Cedeño', carrera: 'Ingeniería en Software', carreraCodigo: 'SOFT', cargaTrabajo: 1 },
  { id: 'docente-jorge', tipoPersona: 'DOCENTE', cedula: '1300000105', nombres: 'Jorge Luis', apellidos: 'Vera Macías', carrera: 'Ingeniería en Software', carreraCodigo: 'SOFT', cargaTrabajo: 4 },
  { id: 'docente-carlos', tipoPersona: 'DOCENTE', cedula: '1300000106', nombres: 'Carlos', apellidos: 'Andrade Moreira', carrera: 'Tecnologías de la Información', carreraCodigo: 'TI', cargaTrabajo: 2 },
  { id: 'docente-elena', tipoPersona: 'DOCENTE', cedula: '1300000107', nombres: 'Elena', apellidos: 'Ponce Delgado', carrera: 'Tecnologías de la Información', carreraCodigo: 'TI', cargaTrabajo: 2 },
  { id: 'docente-esteban', tipoPersona: 'DOCENTE', cedula: '1300000108', nombres: 'Esteban', apellidos: 'Quiroz Loor', carrera: 'Tecnologías de la Información', carreraCodigo: 'TI', cargaTrabajo: 1 },
  { id: 'staff-lucia', tipoPersona: 'STAFF', cedula: '1300000109', nombres: 'Lucía', apellidos: 'Santamaría Mera', carrera: 'Facultad' },
  { id: 'estudiante-andrea', tipoPersona: 'ESTUDIANTE', cedula: '1300001842', nombres: 'Andrea Sofía', apellidos: 'Mendoza Loor', carrera: 'Tecnologías de la Información', carreraCodigo: 'TI' },
  { id: 'estudiante-mateo', tipoPersona: 'ESTUDIANTE', cedula: '1300001843', nombres: 'Mateo Andrés', apellidos: 'Alcívar Pico', carrera: 'Tecnologías de la Información', carreraCodigo: 'TI' },
  { id: 'estudiante-camila', tipoPersona: 'ESTUDIANTE', cedula: '1300003261', nombres: 'Camila Alejandra', apellidos: 'Vélez Mera', carrera: 'Ingeniería en Software', carreraCodigo: 'SOFT' },
  { id: 'estudiante-luis', tipoPersona: 'ESTUDIANTE', cedula: '1300002415', nombres: 'Luis Fernando', apellidos: 'Zambrano Loor', carrera: 'Tecnologías de la Información', carreraCodigo: 'TI' },
  { id: 'estudiante-noelia', tipoPersona: 'ESTUDIANTE', cedula: '1300004198', nombres: 'Noelia Isabel', apellidos: 'Vera Cedeño', carrera: 'Ingeniería en Software', carreraCodigo: 'SOFT' },
];

const writtenCategories = [
  {
    id: 'A', codigo: 'A', nombre: 'Resumen e introducción', etapa: 'ESCRITA', maximo: 1,
    indicadores: [
      { id: 'A1', etiqueta: 'El resumen o síntesis hace referencia al objetivo planteado', maximo: 0.33 },
      { id: 'A2', etiqueta: 'Aborda el problema, métodos y técnicas de manera lógica y coherente', maximo: 0.33 },
      { id: 'A3', etiqueta: 'La introducción resume de manera descriptiva el contexto, justificación, interrogantes de estudio en relación con el tema investigado', maximo: 0.34 },
    ],
  },
  {
    id: 'B', codigo: 'B', nombre: 'Marco teórico de la investigación', etapa: 'ESCRITA', maximo: 1,
    indicadores: [
      { id: 'B1', etiqueta: 'En el marco teórico se evidencia el análisis de los principales conceptos y posiciones que se manejan en la teoría sobre el tema que se investiga.', maximo: 0.33 },
      { id: 'B2', etiqueta: 'Se define de manera asertiva citas y ejemplos de otras investigaciones realizadas sobre la temática que direcciona a la investigación.', maximo: 0.33 },
      { id: 'B3', etiqueta: 'Evidencia la adopción de una postura teórica y el análisis crítico en relación con qué criterios comparten y cuáles no comparten.', maximo: 0.34 },
    ],
  },
  {
    id: 'C', codigo: 'C', nombre: 'Diagnóstico o estudio de campo', etapa: 'ESCRITA', maximo: 3,
    indicadores: [
      { id: 'C1', etiqueta: 'Se aplica una metodología que cubra las etapas del desarrollo del proyecto integrador.', maximo: 1 },
      { id: 'C2', etiqueta: 'Se evidencia en la propuesta y su relación con la temática planteada: análisis, diseño e implementación de Tecnologías de Información.', maximo: 1 },
      { id: 'C3', etiqueta: 'El informe presenta coherencia, cohesión léxica, cohesión gramatical.', maximo: 1 },
    ],
  },
];

const oralCategories = [
  {
    id: 'D', codigo: 'D', nombre: 'Empoderamiento y defensa del trabajo realizado', etapa: 'ORAL', maximo: 2.5,
    indicadores: [
      { id: 'D1', etiqueta: 'Evidencia empoderamiento de la temática de manera lógica y coherente.', maximo: 0.83 },
      { id: 'D2', etiqueta: 'Justifica el problema, desde las interrogantes de estudio en relación con el tema investigado, los objetivos planteados en el problema, métodos y técnicas aplicadas.', maximo: 0.83 },
      { id: 'D3', etiqueta: 'Demuestra conocimientos sobre los principales conceptos del tema, evidenciando una postura desde el análisis crítico, hacia los criterios que comparte.', maximo: 0.84 },
    ],
  },
  {
    id: 'E', codigo: 'E', nombre: 'Conclusiones y propuesta', etapa: 'ORAL', maximo: 2.5,
    indicadores: [
      { id: 'E1', etiqueta: 'Dominio sobre los resultados obtenidos, que permitan ver de manera clara los diferentes métodos y técnicas de investigación aplicadas.', maximo: 0.83 },
      { id: 'E2', etiqueta: 'Demuestra que las conclusiones son pertinentes y coherentes con los resultados de la investigación.', maximo: 0.83 },
      { id: 'E3', etiqueta: 'La propuesta es pertinente y se apoya en teorías que fortalecen la temática investigada.', maximo: 0.84 },
    ],
  },
];

const projectIntegratorStages = [
  {
    id: 'ESCRITA',
    codigo: 'PARTE_I',
    nombre: 'Revisión proyecto escrito',
    nombreCorto: 'Revisión escrita',
    descripcion: 'La calificación corresponde al trabajo y se comparte entre sus autores.',
    alcance: ALCANCE_ETAPA_RUBRICA.TRABAJO_COMPARTIDO,
    orden: 1,
    maximo: 5,
    porcentaje: 50,
  },
  {
    id: 'ORAL',
    codigo: 'PARTE_II',
    nombre: 'Sustentación del proyecto',
    nombreCorto: 'Sustentación',
    descripcion: 'La calificación corresponde individualmente al estudiante seleccionado.',
    alcance: ALCANCE_ETAPA_RUBRICA.ESTUDIANTE_INDIVIDUAL,
    orden: 2,
    maximo: 5,
    porcentaje: 50,
  },
];

export const versionesRubrica = [
  {
    id: 'rubrica-pi-2026-2-v1',
    idRubrica: 'rubrica-proyecto-integrador',
    modalityId: 'mod-proyecto-integrador',
    titulo: 'Rúbrica de evaluación de trabajo de integración curricular',
    modalidad: 'Proyecto integrador',
    version: 'v1.0',
    periodo: '2026-2',
    estado: 'ACTIVA',
    vigenteDesde: '2026-09-01',
    etapas: projectIntegratorStages,
    categorias: [...writtenCategories, ...oralCategories],
  },
  {
    id: 'rubrica-pi-2026-1-v1',
    idRubrica: 'rubrica-proyecto-integrador',
    modalityId: 'mod-proyecto-integrador',
    titulo: 'Rúbrica de evaluación de trabajo de integración curricular',
    modalidad: 'Proyecto integrador',
    version: 'v1.0',
    periodo: '2026-1',
    estado: 'ARCHIVADA',
    vigenteDesde: '2026-03-01',
    vigenteHasta: '2026-08-31',
    etapas: projectIntegratorStages,
    categorias: [...writtenCategories, ...oralCategories],
  },
  {
    id: 'rubrica-pi-borrador-v2',
    idRubrica: 'rubrica-proyecto-integrador',
    modalityId: 'mod-proyecto-integrador',
    titulo: 'Rúbrica de evaluación de trabajo de integración curricular',
    modalidad: 'Proyecto integrador',
    version: 'v2.0',
    periodo: 'Por definir',
    estado: 'BORRADOR',
    etapas: projectIntegratorStages,
    categorias: [...writtenCategories, ...oralCategories],
  },
];

const trabajosIniciales = [
  {
    id: 'trabajo-184', codigo: 'TT-2026-0184',
    titulo: 'Sistema web para la gestión y seguimiento de proyectos académicos',
    modalidad: 'Proyecto integrador', periodo: '2026-2', carrera: 'Tecnologías de la Información', carreraCodigo: 'TI',
    idsEstudiantes: ['estudiante-andrea', 'estudiante-mateo'], idTutor: 'docente-carlos',
    idsTribunal: ['docente-maria', 'docente-jose'], tribunalAsignadoEn: '2026-09-18T14:30:00-05:00',
    idVersionRubrica: 'rubrica-pi-2026-2-v1', registradoEn: '2026-09-15T09:00:00-05:00',
    programacion: null,
  },
  {
    id: 'trabajo-326', codigo: 'TT-2026-0326', titulo: 'Aplicación para trazabilidad de proyectos de software',
    modalidad: 'Proyecto integrador', periodo: '2026-2', carrera: 'Ingeniería en Software', carreraCodigo: 'SOFT',
    idsEstudiantes: ['estudiante-camila'], idTutor: 'docente-paola', idsTribunal: ['docente-jose', 'docente-jorge'],
    idVersionRubrica: 'rubrica-pi-2026-2-v1', registradoEn: '2026-09-22T11:00:00-05:00', programacion: null,
  },
  {
    id: 'trabajo-241', codigo: 'TT-2026-0241', titulo: 'Plataforma de seguimiento de prácticas de laboratorio',
    modalidad: 'Proyecto integrador', periodo: '2026-2', carrera: 'Tecnologías de la Información', carreraCodigo: 'TI',
    idsEstudiantes: ['estudiante-luis'], idTutor: 'docente-elena', idsTribunal: ['docente-maria', 'docente-jose'],
    tribunalAsignadoEn: '2026-09-10T10:00:00-05:00', idVersionRubrica: 'rubrica-pi-2026-2-v1',
    registradoEn: '2026-09-08T08:00:00-05:00',
    programacion: { fecha: '2026-10-01', hora: '10:00', sala: 'Sala 2', programadoEn: '2026-09-25T13:00:00-05:00' },
  },
  {
    id: 'trabajo-419', codigo: 'TT-2026-0419', titulo: 'Sistema de control de calidad y seguimiento de incidencias de software',
    modalidad: 'Proyecto integrador', periodo: '2026-1', carrera: 'Ingeniería en Software', carreraCodigo: 'SOFT',
    idsEstudiantes: ['estudiante-noelia'], idTutor: 'docente-jorge', idsTribunal: ['docente-maria', 'docente-jose'],
    tribunalAsignadoEn: '2026-06-10T10:00:00-05:00', idVersionRubrica: 'rubrica-pi-2026-1-v1',
    registradoEn: '2026-06-01T08:00:00-05:00',
    programacion: { fecha: '2026-09-15', hora: '11:30', sala: 'Sala 1', programadoEn: '2026-09-05T09:00:00-05:00' },
    finalizedAt: '2026-09-15T13:00:00-05:00',
  },
];

const closedWrittenA = { A1: 0.32, A2: 0.31, A3: 0.34, B1: 0.31, B2: 0.32, B3: 0.33, C1: 0.94, C2: 0.96, C3: 0.95 };
const closedWrittenB = { A1: 0.31, A2: 0.32, A3: 0.33, B1: 0.3, B2: 0.31, B3: 0.34, C1: 0.92, C2: 0.94, C3: 0.96 };
const closedOralA = { D1: 0.8, D2: 0.81, D3: 0.82, E1: 0.79, E2: 0.8, E3: 0.82 };
const closedOralB = { D1: 0.76, D2: 0.8, D3: 0.81, E1: 0.78, E2: 0.79, E3: 0.8 };

const crearEvaluacion = (idTrabajo, idMiembro, idVersionRubrica, sobrescrituras = {}) => {
  const rubrica = versionesRubrica.find((elemento) => elemento.id === idVersionRubrica);
  return {
    id: `${idTrabajo}-${idMiembro}`,
    idTrabajo,
    idMiembro,
    idVersionRubrica,
    instantaneaRubrica: JSON.parse(JSON.stringify(rubrica)),
    escrita: { estado: ESTADO_EVALUACION.PENDIENTE, calificaciones: {}, observaciones: {}, ...sobrescrituras.escrita },
    oralPorEstudiante: sobrescrituras.oralPorEstudiante ?? {},
  };
};

const evaluacionesIniciales = [
  crearEvaluacion('trabajo-184', 'docente-maria', 'rubrica-pi-2026-2-v1', {
    escrita: { estado: ESTADO_EVALUACION.CERRADA, calificaciones: closedWrittenA, observaciones: {}, finalizedAt: '2026-09-24T16:00:00-05:00' },
  }),
  crearEvaluacion('trabajo-184', 'docente-jose', 'rubrica-pi-2026-2-v1', {
    escrita: { estado: ESTADO_EVALUACION.BORRADOR, calificaciones: { A1: 0.3, A2: 0.3, A3: 0.32, B1: 0.3, B2: 0.3, B3: 0.32, C1: 0.9, C2: 0.9, C3: 0.92 }, observaciones: {}, updatedAt: '2026-09-29T15:00:00-05:00' },
  }),
  crearEvaluacion('trabajo-326', 'docente-jose', 'rubrica-pi-2026-2-v1'),
  crearEvaluacion('trabajo-326', 'docente-jorge', 'rubrica-pi-2026-2-v1'),
  crearEvaluacion('trabajo-241', 'docente-maria', 'rubrica-pi-2026-2-v1', {
    escrita: { estado: ESTADO_EVALUACION.CERRADA, calificaciones: closedWrittenA, observaciones: {}, finalizedAt: '2026-09-20T10:00:00-05:00' },
    oralPorEstudiante: { 'estudiante-luis': { estado: ESTADO_EVALUACION.BORRADOR, calificaciones: { D1: 0.75, D2: 0.78, D3: 0.8 }, observaciones: {}, updatedAt: '2026-10-01T10:10:00-05:00' } },
  }),
  crearEvaluacion('trabajo-241', 'docente-jose', 'rubrica-pi-2026-2-v1', {
    escrita: { estado: ESTADO_EVALUACION.CERRADA, calificaciones: closedWrittenB, observaciones: {}, finalizedAt: '2026-09-21T10:00:00-05:00' },
  }),
  crearEvaluacion('trabajo-419', 'docente-maria', 'rubrica-pi-2026-1-v1', {
    escrita: { estado: ESTADO_EVALUACION.CERRADA, calificaciones: closedWrittenA, observaciones: {}, finalizedAt: '2026-09-01T10:00:00-05:00' },
    oralPorEstudiante: { 'estudiante-noelia': { estado: ESTADO_EVALUACION.CERRADA, calificaciones: closedOralA, observaciones: {}, finalizedAt: '2026-09-15T12:15:00-05:00', printedAt: '2026-09-15T12:20:00-05:00' } },
  }),
  crearEvaluacion('trabajo-419', 'docente-jose', 'rubrica-pi-2026-1-v1', {
    escrita: { estado: ESTADO_EVALUACION.CERRADA, calificaciones: closedWrittenB, observaciones: {}, finalizedAt: '2026-09-02T10:00:00-05:00' },
    oralPorEstudiante: { 'estudiante-noelia': { estado: ESTADO_EVALUACION.CERRADA, calificaciones: closedOralB, observaciones: {}, finalizedAt: '2026-09-15T12:20:00-05:00', printedAt: '2026-09-15T12:25:00-05:00' } },
  }),
];

const notificacionesIniciales = [
  { id: 'aviso-1', idDestinatario: null, tipo: 'TRIBUNAL_ASIGNADO', idTrabajo: 'trabajo-184', titulo: 'Nueva asignación de tribunal', mensaje: 'El tribunal fue asignado al trabajo “Sistema web para la gestión y seguimiento de proyectos académicos”.', ruta: '/mis-evaluaciones', creadoEn: '2026-09-18T14:30:00-05:00', leidoEn: '2026-09-19T09:00:00-05:00' },
  { id: 'aviso-2', idDestinatario: null, tipo: 'REVISION_ESCRITA_PENDIENTE', idTrabajo: 'trabajo-184', titulo: 'Revisión escrita pendiente', mensaje: 'Está pendiente la revisión escrita del trabajo TT-2026-0184.', ruta: '/evaluaciones/trabajo-184/escrita', creadoEn: '2026-09-29T08:00:00-05:00', leidoEn: null },
  { id: 'aviso-3', idDestinatario: null, tipo: 'SUSTENTACION_PROGRAMADA', idTrabajo: 'trabajo-241', titulo: 'Sustentación programada', mensaje: 'La sustentación del trabajo TT-2026-0241 fue programada para el 01/10/2026 a las 10:00, Sala 2.', ruta: '/evaluaciones/trabajo-241/oral/estudiante-luis', creadoEn: '2026-09-25T13:00:00-05:00', leidoEn: null },
  { id: 'aviso-4', idDestinatario: null, tipo: 'SUSTENTACION_PROGRAMADA', idTrabajo: 'trabajo-241', titulo: 'Sustentación programada', mensaje: 'La sustentación del trabajo TT-2026-0241 fue programada para el 01/10/2026 a las 10:00, Sala 2.', ruta: '/evaluaciones/trabajo-241/oral/estudiante-luis', creadoEn: '2026-09-25T13:00:00-05:00', leidoEn: null },
  { id: 'aviso-5', idDestinatario: null, tipo: 'SEGUIMIENTO', idTrabajo: 'trabajo-184', titulo: 'Actividad pendiente', mensaje: 'Un miembro debe cerrar la revisión escrita del trabajo TT-2026-0184.', ruta: '/trabajos/trabajo-184', creadoEn: '2026-09-30T08:00:00-05:00', leidoEn: null },
];

export function crearEstadoInicial() {
  return {
    schemaVersion: 6,
    personas: JSON.parse(JSON.stringify(personas)),
    modalidades: JSON.parse(JSON.stringify(modalidades)),
    periodosAcademicos: JSON.parse(JSON.stringify(periodosAcademicos)),
    versionesRubrica: JSON.parse(JSON.stringify(versionesRubrica)),
    trabajos: JSON.parse(JSON.stringify(trabajosIniciales)),
    evaluaciones: JSON.parse(JSON.stringify(evaluacionesIniciales)),
    notificaciones: JSON.parse(JSON.stringify(notificacionesIniciales)),
  };
}
