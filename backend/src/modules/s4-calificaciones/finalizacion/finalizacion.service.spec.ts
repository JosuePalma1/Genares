import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { CONSULTA_PAGINA_FINALIZACION, FinalizacionService } from './finalizacion.service';

jest.mock('../documentos/modelo-documental', () => ({ pendientesActa: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { pendientesActa } = jest.requireMock('../documentos/modelo-documental') as { pendientesActa: jest.Mock };

const TRABAJO = '00000000-0000-4000-8000-000000000001';
const PROCESO = '00000000-0000-4000-8000-000000000002';
const datos = {
  trabajo: { id: TRABAJO, procesoId: PROCESO, titulo: 'Tema', carrera: 'Software', carreraCodigo: 'SOFT', periodo: '2026-2' },
  estudiantes: [{ id: 'est-1', nombres: 'Ana', apellidos: 'Pérez' }],
};

function preparar({ actas = ['est-1'], pendientes = [] as string[], estado = 'REGISTRADO' } = {}) {
  pendientesActa.mockReturnValue(pendientes);
  const db = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('FROM s4.procesos_evaluacion')) return [{ estado }];
      if (sql.includes('FROM s4.actas_archivadas')) return actas.map((idEstudiante) => ({ idEstudiante }));
      return [];
    }),
    transaction: jest.fn(),
  };
  const manager = { query: jest.fn(async (sql: string) => (sql.includes('FOR UPDATE') ? [{ id: PROCESO }] : [])) };
  db.transaction.mockImplementation(async (cb: (m: typeof manager) => Promise<unknown>) => cb(manager));
  const evaluaciones = { datosDocumentales: jest.fn().mockResolvedValue(datos) };
  const servicio = new FinalizacionService(db as unknown as DataSource, evaluaciones as unknown as EvaluacionesService);
  const escrituras = () => manager.query.mock.calls.map(([sql]) => String(sql)).filter((sql) => /UPDATE s4\.procesos|INSERT INTO s4\.eventos/.test(sql));
  return { servicio, escrituras };
}

describe('FinalizacionService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rechaza con 409 y los motivos cuando falta el acta, sin escribir nada', async () => {
    const { servicio, escrituras } = preparar({ actas: [] });
    const error = await servicio.finalizar(TRABAJO, 'actor', true).catch((e) => e);
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      details: ['Ana Pérez: Falta el acta de calificación archivada.'],
    });
    expect(escrituras()).toEqual([]);
  });

  it('rechaza un trabajo ya finalizado', async () => {
    const { servicio, escrituras } = preparar({ estado: 'FINALIZADO' });
    await expect(servicio.finalizar(TRABAJO, 'actor', true)).rejects.toBeInstanceOf(ConflictException);
    expect(escrituras()).toEqual([]);
  });

  it('marca FINALIZADO y registra el evento de trazabilidad cuando todo se cumple', async () => {
    const { servicio, escrituras } = preparar();
    await servicio.finalizar(TRABAJO, 'actor', true);
    const sql = escrituras();
    expect(sql).toHaveLength(2);
    expect(sql[0]).toContain('UPDATE s4.procesos_evaluacion SET estado');
    expect(sql[1]).toContain("'TRABAJO_FINALIZADO'");
  });

  it('expone las condiciones por estudiante en la consulta', async () => {
    const { servicio } = preparar({ pendientes: ['Falta el código del trabajo.'] });
    const resultado = await servicio.consultar(TRABAJO, 'actor', true);
    expect(resultado).toMatchObject({
      trabajo: { id: TRABAJO, estado: 'REGISTRADO' },
      puedeFinalizar: false,
      estudiantes: [{ idEstudiante: 'est-1', cumplida: false, pendientes: ['Falta el código del trabajo.'] }],
    });
  });

  describe('página filtrada', () => {
    function prepararPagina(ids: string[]) {
      pendientesActa.mockReturnValue([]);
      let simultaneas = 0;
      let maximoSimultaneas = 0;
      const db = {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        query: jest.fn(async (sql: string, _parametros?: unknown[]) => {
          if (sql.includes('FROM gen.periodo_academico')) return [{ codigo: '2026-2', nombre: null, activo: true }, { codigo: '2026-1', nombre: null, activo: false }];
          if (sql === CONSULTA_PAGINA_FINALIZACION) return [{ total: 31, ids }];
          if (sql.includes('FROM s4.procesos_evaluacion')) return [{ estado: 'REGISTRADO' }];
          if (sql.includes('FROM s4.actas_archivadas')) return [{ idEstudiante: 'est-1' }];
          return [];
        }),
      };
      const evaluaciones = {
        datosDocumentales: jest.fn(async (trabajoId: string) => {
          simultaneas += 1;
          maximoSimultaneas = Math.max(maximoSimultaneas, simultaneas);
          await new Promise((resolver) => setTimeout(resolver, 5));
          simultaneas -= 1;
          return { ...datos, trabajo: { ...datos.trabajo, id: trabajoId } };
        }),
      };
      const servicio = new FinalizacionService(db as unknown as DataSource, evaluaciones as unknown as EvaluacionesService);
      return { servicio, db, evaluaciones, maximo: () => maximoSimultaneas };
    }

    it('calcula solo los trabajos de la página, en orden y con concurrencia limitada', async () => {
      const ids = Array.from({ length: 10 }, (_, i) => `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`);
      const { servicio, db, evaluaciones, maximo } = prepararPagina(ids);
      const resultado = await servicio.listarPagina('actor', true, { pagina: '2', buscar: '  PÉREZ ', situacion: 'pendientes' });

      expect(evaluaciones.datosDocumentales).toHaveBeenCalledTimes(10);
      expect(maximo()).toBeLessThanOrEqual(4);
      expect(resultado.elementos.map((e) => e.trabajo.id)).toEqual(ids);
      expect(resultado.paginacion).toEqual({ pagina: 2, limite: 10, total: 31, paginas: 4 });
      expect(resultado.filtros).toMatchObject({ periodo: '2026-2' });
      const llamada = db.query.mock.calls.find(([sql]) => sql === CONSULTA_PAGINA_FINALIZACION);
      expect(llamada?.[1]).toEqual(['actor', true, '2026-2', 'pendientes', 'perez', 10, 10]);
    });

    it('acota el límite y permite consultar todos los periodos', async () => {
      const { servicio, db } = prepararPagina([]);
      const resultado = await servicio.listarPagina('actor', false, { limite: '500', periodo: 'TODOS' });
      expect(resultado).toMatchObject({ elementos: [], paginacion: { limite: 25, paginas: 2 }, filtros: { periodo: 'TODOS' } });
      const llamada = db.query.mock.calls.find(([sql]) => sql === CONSULTA_PAGINA_FINALIZACION);
      expect(llamada?.[1]).toEqual(['actor', false, null, null, null, 25, 0]);
    });

    it('mantiene en SQL los filtros de vigencia, visibilidad y acceso del tribunal', () => {
      expect(CONSULTA_PAGINA_FINALIZACION).toContain("a.estado = 'VIGENTE'");
      expect(CONSULTA_PAGINA_FINALIZACION).toContain('p.estado_registro = 1');
      expect(CONSULTA_PAGINA_FINALIZACION).toContain('vr.estado_registro = 1');
      expect(CONSULTA_PAGINA_FINALIZACION).toContain('u.sujeto_autenticacion = $1');
      expect(CONSULTA_PAGINA_FINALIZACION).toContain("= 'FINALIZADO'");
      expect(CONSULTA_PAGINA_FINALIZACION).toContain('LIMIT $6 OFFSET $7');
    });
  });
});
