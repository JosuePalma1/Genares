import { DataSource } from 'typeorm';
import { TrabajosService } from '../trabajos/trabajos.service';
import { CONSULTA_ESTUDIANTES_PROGRAMABLES, ProgramacionesSustentacionService } from './programaciones-sustentacion.service';

/** RN-27 (motivo de reprogramación) y RN-28 (sesiones separadas para una bina). */
const TRABAJO = '11111111-1111-4111-8111-111111111111';
const SESION = 'aaaaaaaa-0000-4000-8000-000000000001';
const A = '55555555-5555-4555-8555-555555555551';
const B = '55555555-5555-4555-8555-555555555552';

function preparar(estudiantes: Array<{ id: string; programado: boolean }>, oralIniciada = false) {
  const query = jest.fn(async (sql: string, _parametros?: unknown[]) => {
    if (sql === CONSULTA_ESTUDIANTES_PROGRAMABLES) return estudiantes;
    if (sql.includes('FROM s4.procesos_evaluacion p') && sql.includes('JOIN s2.asignacion_tema a')) return [{ id: 'p1' }];
    if (sql.includes('AS tribunal')) return [{ tribunal: 2, cerradas: 2 }];
    if (sql.includes('INSERT INTO s4.programaciones_sustentacion')) return [{ id: SESION }];
    if (sql.includes('FROM s4.programaciones_sustentacion WHERE "id" = $1')) {
      return [{ id: SESION, idTrabajo: 'p1', estado: 'PROGRAMADA', duracionEstimadaMinutos: 60 }];
    }
    if (sql.includes('AS "iniciada"')) return [{ iniciada: oralIniciada }];
    return [];
  });
  const manager = { query };
  const dataSource = {
    transaction: (_nivel: string, trabajo: (m: typeof manager) => unknown) => trabajo(manager),
  } as unknown as DataSource;
  const servicio = new ProgramacionesSustentacionService(dataSource, {} as TrabajosService);
  jest.spyOn(servicio, 'obtener').mockResolvedValue({ id: SESION });
  const llamada = (fragmento: string) => query.mock.calls.find(([sql]) => sql.includes(fragmento));
  return { servicio, query, llamada };
}

const base = { idTrabajo: TRABAJO, fechaProgramada: '2026-12-15', horaProgramada: '09:00', sala: 'Sala 1' };

describe('creación de sesiones por estudiante', () => {
  it('sin selección programa a toda la bina en una sesión conjunta', async () => {
    const { servicio, llamada } = preparar([{ id: A, programado: false }, { id: B, programado: false }]);
    await servicio.crear(base, 'actor', true);
    expect(llamada('INSERT INTO s4.programaciones_sustentacion')![1]![7]).toBe('CONJUNTA');
    expect(llamada('INSERT INTO s4.programacion_estudiante')![1]).toEqual([SESION, [A, B]]);
  });

  it('con un estudiante seleccionado crea una sesión individual separada', async () => {
    const { servicio, llamada } = preparar([{ id: A, programado: false }, { id: B, programado: false }]);
    await servicio.crear({ ...base, idEstudiantes: [B] }, 'actor', true);
    expect(llamada('INSERT INTO s4.programaciones_sustentacion')![1]![7]).toBe('INDIVIDUAL');
    expect(llamada('INSERT INTO s4.programacion_estudiante')![1]).toEqual([SESION, [B]]);
  });

  it('el segundo estudiante de la bina obtiene su propia sesión después', async () => {
    const { servicio, llamada } = preparar([{ id: A, programado: true }, { id: B, programado: false }]);
    await servicio.crear(base, 'actor', true);
    expect(llamada('INSERT INTO s4.programacion_estudiante')![1]).toEqual([SESION, [B]]);
  });

  it('no crea la sesión si el estudiante elegido ya tiene programación', async () => {
    const { servicio, llamada } = preparar([{ id: A, programado: true }, { id: B, programado: false }]);
    await expect(servicio.crear({ ...base, idEstudiantes: [A] }, 'actor', true)).rejects.toThrow('ya tiene una programación');
    expect(llamada('INSERT INTO s4.programaciones_sustentacion')).toBeUndefined();
  });
});

describe('reprogramación', () => {
  const cambio = { fechaProgramada: '2026-12-16', horaProgramada: '10:00', sala: 'Sala 2' };

  it('exige motivo antes de abrir la transacción', async () => {
    const { servicio, query } = preparar([]);
    await expect(servicio.actualizar(SESION, { ...cambio, motivo: '  ' }, 'actor')).rejects.toThrow('motivo');
    expect(query).not.toHaveBeenCalled();
  });

  it('fija el motivo para el historial en la misma transacción del UPDATE', async () => {
    const { servicio, query } = preparar([]);
    await servicio.actualizar(SESION, { ...cambio, motivo: ' Cambio de aula ' }, 'actor');
    const llamadas = query.mock.calls.map(([sql]) => sql);
    const motivo = llamadas.findIndex((sql) => sql.includes("set_config('s4.motivo_cambio'"));
    const actualizacion = llamadas.findIndex((sql) => sql.includes('UPDATE s4.programaciones_sustentacion'));
    expect(motivo).toBeGreaterThan(-1);
    expect(motivo).toBeLessThan(actualizacion);
    expect(query.mock.calls[motivo][1]).toEqual(['actor', 'Cambio de aula']);
  });

  it('solo bloquea por orales iniciadas de los participantes de esa sesión', async () => {
    const { servicio, llamada } = preparar([], true);
    await expect(servicio.actualizar(SESION, { ...cambio, motivo: 'Cambio' }, 'actor')).rejects.toThrow('evaluación oral');
    const [sql, parametros] = llamada('AS "iniciada"')!;
    expect(sql).toContain('pe.programacion_sustentacion_id = $2');
    expect(parametros).toEqual(['p1', SESION]);
  });
});
