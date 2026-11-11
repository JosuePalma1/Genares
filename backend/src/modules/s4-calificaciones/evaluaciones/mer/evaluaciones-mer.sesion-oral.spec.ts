import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EvaluacionesMerService } from './evaluaciones-mer.service';

/** RF-46 / RN-16 / RN-26: la evaluación oral queda ligada a la sesión del estudiante. */
const ENTORNO = {
  NODE_ENV: 'development', ENABLE_INTEGRACION_DEV: 'true',
  LOCAL_DEV_OPEN_ACCESS: 'true', DB_NAME: 'genares_integrado_dev',
};
const SESION = 'aaaaaaaa-0000-4000-8000-000000000001';
const OTRA_SESION = 'aaaaaaaa-0000-4000-8000-000000000002';

interface Escenario {
  etapa?: { id: string; kind: string; scope: string };
  sesiones?: Array<{ id: string }>;
  existente?: { id: string; estado: string; revision: number; idSesion: string | null };
}

function preparar({ etapa = { id: 'e-oral', kind: 'ORAL', scope: 'ESTUDIANTE_INDIVIDUAL' }, sesiones = [{ id: SESION }], existente }: Escenario = {}) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('set_config')) return [];
    if (sql.includes('FROM s4.procesos_evaluacion p')) return [{ id: 'p1', versionId: 'v1' }];
    if (sql.includes('SELECT id, kind, scope FROM s4.etapas_rubrica')) return [etapa];
    if (sql.includes('FROM s3.asignacion_tribunal at')) return [{ idDocente: 'd1' }];
    if (sql.includes('AS pertenece')) return [{ pertenece: true }];
    if (sql.includes('FROM s4.programaciones_sustentacion ps')) return sesiones;
    if (sql.includes('FROM s4.indicadores_rubrica i')) return [{ id: 'i1', calificacionMaxima: '5.00' }];
    if (sql.includes('AS "idSesion"')) return existente ? [existente] : [];
    if (sql.includes('AS existen')) return [{ existen: false }];
    if (sql.includes('estado_registro = 0') && sql.includes('FROM s4.evaluaciones')) return [];
    if (sql.includes('INSERT INTO s4.evaluaciones')) return [{ id: 'ev1', estado: 'BORRADOR', revision: 0 }];
    if (sql.includes('UPDATE s4.calificaciones_evaluacion')) return [[{ id: 'c1' }]];
    if (sql.includes('UPDATE s4.evaluaciones e')) return [[{ id: 'ev1', revision: 1, estado: 'BORRADOR', total: null }]];
    if (sql.includes('INSERT INTO s4.eventos_auditoria_evaluacion')) return [];
    throw new Error(`Consulta no simulada: ${sql.slice(0, 80)}`);
  });
  const manager = { query };
  const db = { transaction: (trabajo: (m: typeof manager) => unknown) => trabajo(manager) } as unknown as DataSource;
  const llamada = (fragmento: string) => query.mock.calls.find(([sql]) => (sql as string).includes(fragmento)) as
    unknown as [string, unknown[]] | undefined;
  return { servicio: new EvaluacionesMerService(db), query, llamada };
}

const dto = (idEstudiante: string | null = 'est1') => ({
  idEtapaRubrica: 'e-oral', idAsignacionTribunal: 'at1', idEstudiante,
  revisionEsperada: 0, puntajes: [{ idIndicador: 'i1', score: 4 }],
});

describe('evaluación oral ligada a su sesión', () => {
  const anterior = { ...process.env };
  beforeEach(() => Object.assign(process.env, ENTORNO));
  afterEach(() => { process.env = { ...anterior }; });

  it('crea la oral con la sesión vigente del estudiante y la deja en la auditoría', async () => {
    const { servicio, llamada } = preparar();

    await servicio.guardarBorradorOral('a1', dto());

    const [, parametros] = llamada('INSERT INTO s4.evaluaciones')!;
    expect(parametros[7]).toBe(SESION);
    const [, auditoria] = llamada('INSERT INTO s4.eventos_auditoria_evaluacion')!;
    expect(JSON.parse(auditoria[3] as string)).toMatchObject({ idProgramacionSustentacion: SESION });
  });

  it('busca solo sesiones visibles, no canceladas y en las que participa el estudiante', async () => {
    const { servicio, llamada } = preparar();
    await servicio.guardarBorradorOral('a1', dto());
    const [sql, parametros] = llamada('FROM s4.programaciones_sustentacion ps')!;
    expect(sql).toContain('pe.id_estudiante = $2');
    expect(sql).toContain("ps.estado NOT IN ('CANCELADA')");
    expect(sql).toContain('pe.estado_registro = 1');
    expect(parametros).toEqual(['p1', 'est1']);
  });

  it('rechaza la oral si el estudiante no tiene sesión o tiene más de una vigente', async () => {
    await expect(preparar({ sesiones: [] }).servicio.guardarBorradorOral('a1', dto()))
      .rejects.toThrow('no tiene sustentación programada');
    await expect(preparar({ sesiones: [{ id: SESION }, { id: OTRA_SESION }] }).servicio.guardarBorradorOral('a1', dto()))
      .rejects.toThrow('más de una sustentación vigente');
  });

  it('no mueve un borrador oral a otra sesión ni modifica sus notas', async () => {
    const { servicio, query } = preparar({ existente: { id: 'ev1', estado: 'BORRADOR', revision: 0, idSesion: OTRA_SESION } });

    await expect(servicio.guardarBorradorOral('a1', dto())).rejects.toBeInstanceOf(ConflictException);
    expect(query.mock.calls.some(([sql]) => (sql as string).includes('calificaciones_evaluacion'))).toBe(false);
  });

  it('la escrita compartida no consulta ni guarda sesión', async () => {
    const { servicio, llamada } = preparar({ etapa: { id: 'e-oral', kind: 'ESCRITA', scope: 'TRABAJO_COMPARTIDO' } });

    await servicio.guardarBorradorOral('a1', dto(null), undefined, 'ESCRITA');

    expect(llamada('FROM s4.programaciones_sustentacion ps')).toBeUndefined();
    expect(llamada('INSERT INTO s4.evaluaciones')![1][7]).toBeNull();
  });
});
