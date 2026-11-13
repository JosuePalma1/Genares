import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  CONSULTA_RUBRICA_VIGENTE_ASIGNACION, EvaluacionesMerService, mensajeSinRubricaActiva,
} from './evaluaciones-mer.service';

/** RF-11 / RF-19: al abrir la evaluación de un trabajo sin proceso se le asigna la rúbrica activa y vigente. */
const ENTORNO = {
  NODE_ENV: 'development', ENABLE_INTEGRACION_DEV: 'true',
  LOCAL_DEV_OPEN_ACCESS: 'true', DB_NAME: 'genares_integrado_dev',
};
const ASIGNACION = 'aaaaaaaa-0000-4000-8000-0000000000a1';
const CONTEXTO = {
  estado: 'VIGENTE', conTribunal: true, procesoEstadoRegistro: null,
  modalidad: 'Proyecto integrador', carrera: 'Software', periodo: '2026-B', idVersion: 'v-activa',
};

function preparar(contexto: Record<string, unknown> | null = CONTEXTO) {
  const query = jest.fn(async (sql: string, _parametros?: unknown[]) => {
    if (sql.includes('set_config') || sql.includes('pg_advisory_xact_lock')) return [];
    if (sql === CONSULTA_RUBRICA_VIGENTE_ASIGNACION) return contexto ? [contexto] : [];
    if (sql.includes('INSERT INTO s4.procesos_evaluacion')) return [];
    throw new Error(`Consulta no simulada: ${sql.slice(0, 80)}`);
  });
  const manager = { query };
  const db = { transaction: (trabajo: (m: typeof manager) => unknown) => trabajo(manager) } as unknown as DataSource;
  const insercion = () => query.mock.calls.find(([sql]) => sql.includes('INSERT INTO s4.procesos_evaluacion'));
  return { servicio: new EvaluacionesMerService(db), insercion };
}

describe('asignación de la rúbrica al abrir la evaluación', () => {
  const anterior = { ...process.env };
  beforeEach(() => Object.assign(process.env, ENTORNO));
  afterEach(() => { process.env = { ...anterior }; });

  it('crea el proceso con la versión activa y vigente del trabajo', async () => {
    const { servicio, insercion } = preparar();
    await servicio.asignarRubricaVigente(ASIGNACION);
    expect(insercion()?.[1]).toEqual([ASIGNACION, 'v-activa']);
  });

  it('sin versión activa no crea nada y dice qué falta', async () => {
    const { servicio, insercion } = preparar({ ...CONTEXTO, idVersion: null });
    await expect(servicio.asignarRubricaVigente(ASIGNACION)).rejects.toThrow(ConflictException);
    await expect(servicio.asignarRubricaVigente(ASIGNACION)).rejects
      .toThrow('No hay rúbrica activa para Proyecto integrador · Software · 2026-B. Pida que se active la versión correspondiente en Rúbricas.');
    expect(insercion()).toBeUndefined();
  });

  it.each([
    ['ya tiene proceso visible', { procesoEstadoRegistro: 1 }],
    ['tiene un proceso oculto', { procesoEstadoRegistro: 0 }],
    ['la asignación no está vigente', { estado: 'FINALIZADA' }],
    ['aún no tiene tribunal', { conTribunal: false }],
  ])('no toca nada si %s', async (_caso, cambio) => {
    const { servicio, insercion } = preparar({ ...CONTEXTO, ...cambio });
    await servicio.asignarRubricaVigente(ASIGNACION);
    expect(insercion()).toBeUndefined();
  });

  it('una asignación inexistente se informa como no encontrada', async () => {
    const { servicio } = preparar(null);
    await expect(servicio.asignarRubricaVigente(ASIGNACION)).rejects.toThrow(NotFoundException);
  });

  it('elige la versión con las mismas condiciones que valida PostgreSQL', () => {
    for (const condicion of ["vr.estado = 'ACTIVA'", 'vig.id_carrera = t.carrera_id', 'r.id_modalidad = t.modalidad_id',
      'vr.periodo_academico_id = t.periodo_academico_id', 'vig.vigente_desde <= now()',
      '(vig.vigente_hasta IS NULL OR vig.vigente_hasta > now())', 'vig.estado_registro = 1', 'vr.estado_registro = 1']) {
      expect(CONSULTA_RUBRICA_VIGENTE_ASIGNACION).toContain(condicion);
    }
  });

  it('el mensaje se entiende aunque falten datos del tema', () => {
    expect(mensajeSinRubricaActiva({ modalidad: null, carrera: null, periodo: null }))
      .toBe('No hay rúbrica activa para la modalidad, carrera y período del trabajo. Pida que se active la versión correspondiente en Rúbricas.');
  });
});

describe('varias rúbricas candidatas', () => {
  const anterior = { ...process.env };
  beforeEach(() => Object.assign(process.env, ENTORNO));
  afterEach(() => { process.env = { ...anterior }; });

  it('no elige ninguna y pide una selección manual, como s4.incorporar_asignacion_desde_s3', async () => {
    const { servicio, insercion } = preparar({ ...CONTEXTO, versionesCandidatas: 2, idVersion: null });
    await expect(servicio.asignarRubricaVigente(ASIGNACION)).rejects
      .toThrow('Hay 2 rúbricas activas para Proyecto integrador · Software · 2026-B. Se necesita que un responsable elija cuál aplicar.');
    expect(insercion()).toBeUndefined();
    expect(CONSULTA_RUBRICA_VIGENTE_ASIGNACION).toContain('CASE WHEN candidatas.cantidad = 1 THEN candidatas.id END');
  });
});
