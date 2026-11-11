import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { FinalizacionService } from './finalizacion.service';

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
});
