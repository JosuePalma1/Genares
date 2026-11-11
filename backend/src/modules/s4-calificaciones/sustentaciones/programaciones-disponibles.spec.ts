import { DataSource } from 'typeorm';
import { TrabajoMer, TrabajosService } from '../trabajos/trabajos.service';
import {
  CONSULTA_PROGRAMACIONES,
  CONSULTA_TRABAJOS_DISPONIBLES,
  ProgramacionesSustentacionService,
} from './programaciones-sustentacion.service';

const PERIODO_ACTIVO = '33333333-3333-4333-8333-333333333333';
const sesion = (id: string) => ({
  id, fecha: '2026-12-15', inicio: '09:00', fin: '10:00', sala: 'Sala 1', tipo: 'INDIVIDUAL', estado: 'PROGRAMADA',
  estadoRegistro: 1, cantidadParticipantes: 0, duracionEstimadaMinutos: 60, participantes: [],
  creadoEn: '2026-11-01T00:00:00.000Z', actualizadoEn: '2026-11-01T00:00:00.000Z', inicioRealEn: null, finalizacionRealEn: null,
});

const trabajo = {
  id: '11111111-1111-4111-8111-111111111111',
  codigo: 'T-1',
  titulo: 'Trabajo de prueba',
  estado: 'EVALUACION_COMPLETADA',
  idCarrera: '22222222-2222-4222-8222-222222222222',
  codigoCarrera: 'TI',
  carrera: 'Tecnologías de la Información',
  idPeriodo: PERIODO_ACTIVO,
  periodo: '2026-2',
  asignacionId: '11111111-1111-4111-8111-111111111111',
  tema: 'Trabajo de prueba',
  tipoTrabajo: 'Individual',
  estadoAsignacion: 'VIGENTE',
  procesoId: '44444444-4444-4444-8444-444444444444',
  estadoProceso: 'CERRADO',
  estadoRegistro: 1,
  versionRubrica: '1',
  evaluadoresAsignados: 2,
  evaluadores: [],
  escritasCerradas: 2,
  estudiantes: [{ id: '55555555-5555-4555-8555-555555555551', nombre: 'Estudiante A' }],
  sesiones: [],
} as unknown as TrabajoMer;

interface Escenario {
  /** Trabajos candidatos; por defecto todos sus estudiantes están pendientes de programar. */
  candidatos?: Array<string | { id: string; pendientes: string[] }>;
  filas?: Array<{ id: string; idTrabajo: string }>;
  total?: number;
  trabajos?: TrabajoMer[];
}

function preparar({ candidatos = [], filas = [], total, trabajos = [trabajo] }: Escenario = {}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const query = jest.fn(async (sql: string, _parametros?: unknown[]) => {
    if (sql === CONSULTA_TRABAJOS_DISPONIBLES) {
      return candidatos.map((candidato) => (typeof candidato === 'string'
        ? { id: candidato, pendientes: trabajos.find((t) => t.id === candidato)?.estudiantes.map((e) => e.id) ?? [] }
        : candidato));
    }
    if (sql === CONSULTA_PROGRAMACIONES) return [{ total: total ?? filas.length, filas }];
    if (sql.includes('WHERE activo')) return [{ id: PERIODO_ACTIVO }];
    return [];
  });
  const consultar = jest.fn().mockResolvedValue(trabajos);
  const service = new ProgramacionesSustentacionService({ query } as unknown as DataSource, { consultar } as unknown as TrabajosService);
  const parametros = (sql: string) => query.mock.calls.find(([texto]) => texto === sql)?.[1];
  return { service, query, consultar, parametros };
}

describe('disponibilidad de trabajos para una nueva programación', () => {
  it('descarta en SQL los trabajos con todos sus estudiantes programados, incluso en sesiones ocultas, y sin tribunal completo', () => {
    expect(CONSULTA_TRABAJOS_DISPONIBLES).toContain('NOT EXISTS');
    expect(CONSULTA_TRABAJOS_DISPONIBLES).toContain('s4.programacion_estudiante');
    expect(CONSULTA_TRABAJOS_DISPONIBLES).toContain("gi.estado = 'ACTIVO'");
    // Programado en cualquier sesión del proceso: sin filtrar estado ni estado_registro.
    expect(CONSULTA_TRABAJOS_DISPONIBLES).not.toMatch(/ps_prev\.(estado|estado_registro)/);
    expect(CONSULTA_TRABAJOS_DISPONIBLES).toContain('s3.asignacion_tribunal');
    expect(CONSULTA_TRABAJOS_DISPONIBLES).toContain("a.estado = 'VIGENTE'");
  });

  it('solo consulta el detalle de los candidatos y vuelve a exigir dos escritas cerradas', async () => {
    const pendiente = { ...trabajo, id: '11111111-1111-4111-8111-111111111112', escritasCerradas: 1 } as TrabajoMer;
    const { service, consultar, parametros } = preparar({ candidatos: [trabajo.id, pendiente.id], trabajos: [trabajo, pendiente] });

    const resultado = await service.trabajosDisponibles({ periodoId: 'TODOS', buscar: '  Bína ' });

    expect(consultar).toHaveBeenCalledWith(null, [trabajo.id, pendiente.id]);
    expect((resultado.elementos as Array<{ idTrabajo: string }>).map(({ idTrabajo }) => idTrabajo)).toEqual([trabajo.id]);
    expect(parametros(CONSULTA_TRABAJOS_DISPONIBLES)).toEqual([null, null, 'bina']);
  });

  it('una bina con un estudiante ya programado ofrece solo al otro para una sesión separada (RN-28)', async () => {
    const [a, b] = ['55555555-5555-4555-8555-555555555551', '55555555-5555-4555-8555-555555555552'];
    const bina = {
      ...trabajo,
      estudiantes: [{ id: a, nombre: 'Estudiante A' }, { id: b, nombre: 'Estudiante B' }],
      sesiones: [{ ...sesion('aaaaaaaa-0000-4000-8000-000000000009'), participantes: [a] }],
    } as unknown as TrabajoMer;
    const { service } = preparar({ candidatos: [{ id: bina.id, pendientes: [b] }], trabajos: [bina] });

    const { elementos } = await service.trabajosDisponibles({}) as { elementos: Array<{ estudiantes: unknown[]; estudiantesPendientes: Array<{ id: string }> }> };

    expect(elementos).toHaveLength(1);
    expect(elementos[0].estudiantes).toHaveLength(2);
    expect(elementos[0].estudiantesPendientes.map(({ id }) => id)).toEqual([b]);
  });

  it('descarta el candidato si ninguno de sus estudiantes del detalle sigue pendiente', async () => {
    const { service } = preparar({ candidatos: [{ id: trabajo.id, pendientes: [] }] });
    await expect(service.trabajosDisponibles({})).resolves.toMatchObject({ elementos: [] });
  });

  it('no consulta detalles cuando no hay candidatos', async () => {
    const { service, consultar } = preparar();
    await expect(service.trabajosDisponibles({})).resolves.toMatchObject({ elementos: [] });
    expect(consultar).not.toHaveBeenCalled();
  });
});

describe('listado de programaciones', () => {
  const filas = [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', idTrabajo: trabajo.id }];
  const conSesion = { ...trabajo, sesiones: [sesion(filas[0].id)] } as unknown as TrabajoMer;

  it('sin límite conserva la lista completa y el criterio anterior de periodo (todos)', async () => {
    const { service, parametros, consultar } = preparar({ filas, trabajos: [conSesion] });
    const resultado = await service.listar({ estado: 'COMPLETADA' });
    expect(resultado).not.toHaveProperty('paginacion');
    expect((resultado.elementos as Array<{ id: string }>).map(({ id }) => id)).toEqual([filas[0].id]);
    expect(parametros(CONSULTA_PROGRAMACIONES)).toEqual([null, null, null, 'FINALIZADA', null, 0]);
    expect(consultar).toHaveBeenCalledWith(null, [trabajo.id]);
  });

  it('con límite pagina en SQL y usa el periodo activo si no se elige otro', async () => {
    const { service, parametros } = preparar({ filas, total: 30, trabajos: [conSesion] });
    const resultado = await service.listar({ limite: '10', pagina: '3' });
    expect(resultado).toMatchObject({ periodoAplicado: PERIODO_ACTIVO, paginacion: { pagina: 3, limite: 10, total: 30, paginas: 3 } });
    expect(parametros(CONSULTA_PROGRAMACIONES)).toEqual([null, PERIODO_ACTIVO, null, null, 10, 20]);

    const todos = await service.listar({ limite: '10', periodoId: 'TODOS' });
    expect(todos).toMatchObject({ periodoAplicado: null });
  });

  it('la impresión incluye todas las programaciones filtradas aunque se pida un límite', async () => {
    const { service, parametros } = preparar({ filas, trabajos: [conSesion] });
    const resultado = await service.listarParaImpresion({ limite: '10', periodoId: 'TODOS' });
    expect(resultado).toMatchObject({ criterios: { periodoId: null } });
    expect(resultado).not.toHaveProperty('paginacion');
    expect(parametros(CONSULTA_PROGRAMACIONES)?.slice(4)).toEqual([null, 0]);
  });

  it('mantiene en SQL la vigencia y la visibilidad de procesos y programaciones', () => {
    expect(CONSULTA_PROGRAMACIONES).toContain("a.estado = 'VIGENTE'");
    expect(CONSULTA_PROGRAMACIONES).toContain('p.estado_registro = 1');
    expect(CONSULTA_PROGRAMACIONES).toContain('ses.estado_registro = 1');
    expect(CONSULTA_PROGRAMACIONES).toContain('LIMIT $5 OFFSET $6');
  });
});
