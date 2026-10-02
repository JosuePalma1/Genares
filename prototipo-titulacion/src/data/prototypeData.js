export const ROLE = Object.freeze({
  ADMIN: 'ADMIN',
  COMMISSION: 'COMMISSION',
  TRIBUNAL: 'TRIBUNAL',
  SECRETARY: 'SECRETARY',
  COORDINATION: 'COORDINATION',
});

export const EVALUATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  DRAFT: 'DRAFT',
  CLOSED: 'CLOSED',
});

export const people = [
  { id: 'teacher-daniela', kind: 'TEACHER', cedula: '1300000101', firstNames: 'Daniela', lastNames: 'Cedeño', career: 'Tecnologías de la Información' },
  { id: 'teacher-maria', kind: 'TEACHER', cedula: '1300000102', firstNames: 'María Elena', lastNames: 'López Vera', career: 'Tecnologías de la Información', workload: 3 },
  { id: 'teacher-jose', kind: 'TEACHER', cedula: '1300000103', firstNames: 'José Antonio', lastNames: 'Mendoza Ruiz', career: 'Software', workload: 2 },
  { id: 'teacher-paola', kind: 'TEACHER', cedula: '1300000104', firstNames: 'Paola', lastNames: 'Reyes Cedeño', career: 'Software', workload: 1 },
  { id: 'teacher-jorge', kind: 'TEACHER', cedula: '1300000105', firstNames: 'Jorge Luis', lastNames: 'Vera Macías', career: 'Tecnologías de la Información', workload: 4 },
  { id: 'teacher-carlos', kind: 'TEACHER', cedula: '1300000106', firstNames: 'Carlos', lastNames: 'Andrade Moreira', career: 'Tecnologías de la Información', workload: 2 },
  { id: 'teacher-elena', kind: 'TEACHER', cedula: '1300000107', firstNames: 'Elena', lastNames: 'Ponce Delgado', career: 'Agropecuaria', workload: 2 },
  { id: 'teacher-esteban', kind: 'TEACHER', cedula: '1300000108', firstNames: 'Esteban', lastNames: 'Quiroz Loor', career: 'Agroindustria', workload: 1 },
  { id: 'staff-lucia', kind: 'STAFF', cedula: '1300000109', firstNames: 'Lucía', lastNames: 'Santamaría Mera', career: 'Facultad' },
  { id: 'student-andrea', kind: 'STUDENT', cedula: '1300001842', firstNames: 'Andrea Sofía', lastNames: 'Mendoza Loor', career: 'Tecnologías de la Información' },
  { id: 'student-mateo', kind: 'STUDENT', cedula: '1300001843', firstNames: 'Mateo Andrés', lastNames: 'Alcívar Pico', career: 'Tecnologías de la Información' },
  { id: 'student-camila', kind: 'STUDENT', cedula: '1300003261', firstNames: 'Camila Alejandra', lastNames: 'Vélez Mera', career: 'Software' },
  { id: 'student-luis', kind: 'STUDENT', cedula: '1300002415', firstNames: 'Luis Fernando', lastNames: 'Zambrano Loor', career: 'Agropecuaria' },
  { id: 'student-noelia', kind: 'STUDENT', cedula: '1300004198', firstNames: 'Noelia Isabel', lastNames: 'Vera Cedeño', career: 'Ingeniería Ambiental' },
];

export const actors = [
  { id: 'actor-daniela', personId: 'teacher-daniela', label: 'Daniela Cedeño', roles: [ROLE.COMMISSION, ROLE.ADMIN], activeRole: ROLE.COMMISSION },
  { id: 'actor-maria', personId: 'teacher-maria', label: 'María López', roles: [ROLE.TRIBUNAL], activeRole: ROLE.TRIBUNAL },
  { id: 'actor-jose', personId: 'teacher-jose', label: 'José Mendoza', roles: [ROLE.TRIBUNAL], activeRole: ROLE.TRIBUNAL },
  { id: 'actor-paola', personId: 'teacher-paola', label: 'Paola Reyes', roles: [ROLE.TRIBUNAL], activeRole: ROLE.TRIBUNAL },
  { id: 'actor-jorge', personId: 'teacher-jorge', label: 'Jorge Vera', roles: [ROLE.TRIBUNAL], activeRole: ROLE.TRIBUNAL },
  { id: 'actor-lucia', personId: 'staff-lucia', label: 'Lucía Santamaría', roles: [ROLE.SECRETARY], activeRole: ROLE.SECRETARY },
  { id: 'actor-esteban', personId: 'teacher-esteban', label: 'Esteban Quiroz', roles: [ROLE.COORDINATION], activeRole: ROLE.COORDINATION },
];

export const roleLabels = {
  [ROLE.ADMIN]: 'Administrador',
  [ROLE.COMMISSION]: 'Comisión Académica',
  [ROLE.TRIBUNAL]: 'Miembro de tribunal',
  [ROLE.SECRETARY]: 'Secretaría',
  [ROLE.COORDINATION]: 'Coordinación',
};

const writtenCategories = [
  {
    id: 'A', code: 'A', name: 'Resumen e introducción', stage: 'WRITTEN', max: 1,
    indicators: [
      { id: 'A1', label: 'Indicador 1', max: 0.33 },
      { id: 'A2', label: 'Indicador 2', max: 0.33 },
      { id: 'A3', label: 'Indicador 3', max: 0.34 },
    ],
  },
  {
    id: 'B', code: 'B', name: 'Marco teórico de la investigación', stage: 'WRITTEN', max: 1,
    indicators: [
      { id: 'B1', label: 'Indicador 1', max: 0.33 },
      { id: 'B2', label: 'Indicador 2', max: 0.33 },
      { id: 'B3', label: 'Indicador 3', max: 0.34 },
    ],
  },
  {
    id: 'C', code: 'C', name: 'Diagnóstico o estudio de campo', stage: 'WRITTEN', max: 3,
    indicators: [
      { id: 'C1', label: 'Indicador 1', max: 1 },
      { id: 'C2', label: 'Indicador 2', max: 1 },
      { id: 'C3', label: 'Indicador 3', max: 1 },
    ],
  },
];

const oralCategories = [
  {
    id: 'D', code: 'D', name: 'Empoderamiento y defensa del trabajo realizado', stage: 'ORAL', max: 2.5,
    indicators: [
      { id: 'D1', label: 'Indicador 1', max: 0.83 },
      { id: 'D2', label: 'Indicador 2', max: 0.83 },
      { id: 'D3', label: 'Indicador 3', max: 0.84 },
    ],
  },
  {
    id: 'E', code: 'E', name: 'Conclusiones y propuesta', stage: 'ORAL', max: 2.5,
    indicators: [
      { id: 'E1', label: 'Indicador 1', max: 0.83 },
      { id: 'E2', label: 'Indicador 2', max: 0.83 },
      { id: 'E3', label: 'Indicador 3', max: 0.84 },
    ],
  },
];

export const rubricVersions = [
  {
    id: 'rubric-pi-2026-2-v1',
    rubricId: 'rubric-proyecto-integrador',
    title: 'Rúbrica de evaluación de trabajo de integración curricular',
    modality: 'Proyecto integrador',
    version: 'v1.0',
    period: '2026-2',
    status: 'ACTIVE',
    effectiveFrom: '2026-09-01',
    categories: [...writtenCategories, ...oralCategories],
  },
  {
    id: 'rubric-pi-2026-1-v1',
    rubricId: 'rubric-proyecto-integrador',
    title: 'Rúbrica de evaluación de trabajo de integración curricular',
    modality: 'Proyecto integrador',
    version: 'v1.0',
    period: '2026-1',
    status: 'ARCHIVED',
    effectiveFrom: '2026-03-01',
    effectiveTo: '2026-08-31',
    categories: [...writtenCategories, ...oralCategories],
  },
  {
    id: 'rubric-pi-draft-v2',
    rubricId: 'rubric-proyecto-integrador',
    title: 'Rúbrica de evaluación de trabajo de integración curricular',
    modality: 'Proyecto integrador',
    version: 'v2.0',
    period: 'Por definir',
    status: 'DRAFT',
    categories: [...writtenCategories, ...oralCategories],
  },
];

const initialWorks = [
  {
    id: 'work-184', code: 'TT-2026-0184',
    title: 'Sistema web para la gestión y seguimiento de proyectos académicos',
    modality: 'Proyecto integrador', period: '2026-2', career: 'Tecnologías de la Información',
    studentIds: ['student-andrea', 'student-mateo'], tutorId: 'teacher-carlos',
    tribunalIds: ['teacher-maria', 'teacher-jose'], tribunalAssignedAt: '2026-09-18T14:30:00-05:00',
    rubricVersionId: 'rubric-pi-2026-2-v1', registeredAt: '2026-09-15T09:00:00-05:00',
    schedule: null,
  },
  {
    id: 'work-326', code: 'TT-2026-0326', title: 'Aplicación para trazabilidad de proyectos de software',
    modality: 'Proyecto integrador', period: '2026-2', career: 'Software',
    studentIds: ['student-camila'], tutorId: 'teacher-paola', tribunalIds: [],
    rubricVersionId: 'rubric-pi-2026-2-v1', registeredAt: '2026-09-22T11:00:00-05:00', schedule: null,
  },
  {
    id: 'work-241', code: 'TT-2026-0241', title: 'Plataforma de monitoreo agrícola para pequeños productores',
    modality: 'Proyecto integrador', period: '2026-2', career: 'Agropecuaria',
    studentIds: ['student-luis'], tutorId: 'teacher-elena', tribunalIds: ['teacher-maria', 'teacher-jose'],
    tribunalAssignedAt: '2026-09-10T10:00:00-05:00', rubricVersionId: 'rubric-pi-2026-2-v1',
    registeredAt: '2026-09-08T08:00:00-05:00',
    schedule: { date: '2026-10-01', time: '10:00', room: 'Sala 2', scheduledAt: '2026-09-25T13:00:00-05:00' },
  },
  {
    id: 'work-419', code: 'TT-2026-0419', title: 'Análisis de indicadores de calidad ambiental en zonas costeras',
    modality: 'Proyecto integrador', period: '2026-1', career: 'Ingeniería Ambiental',
    studentIds: ['student-noelia'], tutorId: 'teacher-jorge', tribunalIds: ['teacher-maria', 'teacher-jose'],
    tribunalAssignedAt: '2026-06-10T10:00:00-05:00', rubricVersionId: 'rubric-pi-2026-1-v1',
    registeredAt: '2026-06-01T08:00:00-05:00',
    schedule: { date: '2026-09-15', time: '11:30', room: 'Sala 1', scheduledAt: '2026-09-05T09:00:00-05:00' },
    finalizedAt: '2026-09-15T13:00:00-05:00',
  },
];

const closedWrittenA = { A1: 0.32, A2: 0.31, A3: 0.34, B1: 0.31, B2: 0.32, B3: 0.33, C1: 0.94, C2: 0.96, C3: 0.95 };
const closedWrittenB = { A1: 0.31, A2: 0.32, A3: 0.33, B1: 0.3, B2: 0.31, B3: 0.34, C1: 0.92, C2: 0.94, C3: 0.96 };
const closedOralA = { D1: 0.8, D2: 0.81, D3: 0.82, E1: 0.79, E2: 0.8, E3: 0.82 };
const closedOralB = { D1: 0.76, D2: 0.8, D3: 0.81, E1: 0.78, E2: 0.79, E3: 0.8 };

const makeEvaluation = (workId, memberId, rubricVersionId, overrides = {}) => {
  const rubric = rubricVersions.find((item) => item.id === rubricVersionId);
  return {
    id: `${workId}-${memberId}`,
    workId,
    memberId,
    rubricVersionId,
    rubricSnapshot: JSON.parse(JSON.stringify(rubric)),
    written: { status: EVALUATION_STATUS.PENDING, scores: {}, observations: {}, ...overrides.written },
    oralByStudent: overrides.oralByStudent ?? {},
  };
};

const initialEvaluations = [
  makeEvaluation('work-184', 'teacher-maria', 'rubric-pi-2026-2-v1', {
    written: { status: EVALUATION_STATUS.CLOSED, scores: closedWrittenA, observations: {}, finalizedAt: '2026-09-24T16:00:00-05:00' },
  }),
  makeEvaluation('work-184', 'teacher-jose', 'rubric-pi-2026-2-v1', {
    written: { status: EVALUATION_STATUS.DRAFT, scores: { A1: 0.3, A2: 0.3, A3: 0.32, B1: 0.3, B2: 0.3, B3: 0.32, C1: 0.9, C2: 0.9, C3: 0.92 }, observations: {}, updatedAt: '2026-09-29T15:00:00-05:00' },
  }),
  makeEvaluation('work-241', 'teacher-maria', 'rubric-pi-2026-2-v1', {
    written: { status: EVALUATION_STATUS.CLOSED, scores: closedWrittenA, observations: {}, finalizedAt: '2026-09-20T10:00:00-05:00' },
    oralByStudent: { 'student-luis': { status: EVALUATION_STATUS.DRAFT, scores: { D1: 0.75, D2: 0.78, D3: 0.8 }, observations: {}, updatedAt: '2026-10-01T10:10:00-05:00' } },
  }),
  makeEvaluation('work-241', 'teacher-jose', 'rubric-pi-2026-2-v1', {
    written: { status: EVALUATION_STATUS.CLOSED, scores: closedWrittenB, observations: {}, finalizedAt: '2026-09-21T10:00:00-05:00' },
  }),
  makeEvaluation('work-419', 'teacher-maria', 'rubric-pi-2026-1-v1', {
    written: { status: EVALUATION_STATUS.CLOSED, scores: closedWrittenA, observations: {}, finalizedAt: '2026-09-01T10:00:00-05:00' },
    oralByStudent: { 'student-noelia': { status: EVALUATION_STATUS.CLOSED, scores: closedOralA, observations: {}, finalizedAt: '2026-09-15T12:15:00-05:00', printedAt: '2026-09-15T12:20:00-05:00' } },
  }),
  makeEvaluation('work-419', 'teacher-jose', 'rubric-pi-2026-1-v1', {
    written: { status: EVALUATION_STATUS.CLOSED, scores: closedWrittenB, observations: {}, finalizedAt: '2026-09-02T10:00:00-05:00' },
    oralByStudent: { 'student-noelia': { status: EVALUATION_STATUS.CLOSED, scores: closedOralB, observations: {}, finalizedAt: '2026-09-15T12:20:00-05:00', printedAt: '2026-09-15T12:25:00-05:00' } },
  }),
];

const initialNotifications = [
  { id: 'notice-1', recipientId: 'actor-maria', type: 'TRIBUNAL_ASSIGNED', workId: 'work-184', title: 'Nueva asignación de tribunal', message: 'Ha sido asignada como miembro del tribunal del trabajo “Sistema web para la gestión y seguimiento de proyectos académicos”.', route: '/mis-evaluaciones', createdAt: '2026-09-18T14:30:00-05:00', readAt: '2026-09-19T09:00:00-05:00' },
  { id: 'notice-2', recipientId: 'actor-jose', type: 'WRITTEN_PENDING', workId: 'work-184', title: 'Revisión escrita pendiente', message: 'Tiene pendiente la revisión escrita del trabajo TT-2026-0184.', route: '/evaluaciones/work-184/escrita', createdAt: '2026-09-29T08:00:00-05:00', readAt: null },
  { id: 'notice-3', recipientId: 'actor-maria', type: 'DEFENSE_SCHEDULED', workId: 'work-241', title: 'Sustentación programada', message: 'La sustentación del trabajo TT-2026-0241 fue programada para el 01/10/2026 a las 10:00, Sala 2.', route: '/evaluaciones/work-241/oral/student-luis', createdAt: '2026-09-25T13:00:00-05:00', readAt: null },
  { id: 'notice-4', recipientId: 'actor-jose', type: 'DEFENSE_SCHEDULED', workId: 'work-241', title: 'Sustentación programada', message: 'La sustentación del trabajo TT-2026-0241 fue programada para el 01/10/2026 a las 10:00, Sala 2.', route: '/evaluaciones/work-241/oral/student-luis', createdAt: '2026-09-25T13:00:00-05:00', readAt: null },
  { id: 'notice-5', recipientId: 'actor-daniela', type: 'FOLLOW_UP', workId: 'work-184', title: 'Actividad pendiente', message: 'José Mendoza aún debe cerrar la revisión escrita del trabajo TT-2026-0184.', route: '/trabajos/work-184', createdAt: '2026-09-30T08:00:00-05:00', readAt: null },
];

export function createInitialState() {
  return {
    actors: JSON.parse(JSON.stringify(actors)),
    people: JSON.parse(JSON.stringify(people)),
    rubricVersions: JSON.parse(JSON.stringify(rubricVersions)),
    works: JSON.parse(JSON.stringify(initialWorks)),
    evaluations: JSON.parse(JSON.stringify(initialEvaluations)),
    notifications: JSON.parse(JSON.stringify(initialNotifications)),
    currentActorId: 'actor-daniela',
  };
}
