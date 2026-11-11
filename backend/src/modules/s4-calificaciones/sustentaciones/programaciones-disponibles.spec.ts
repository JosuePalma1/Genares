import { DataSource } from 'typeorm';
import { TrabajoMer, TrabajosService } from '../trabajos/trabajos.service';
import { ProgramacionesSustentacionService } from './programaciones-sustentacion.service';

const trabajo = {
  id: '11111111-1111-4111-8111-111111111111',
  codigo: 'T-1',
  titulo: 'Trabajo de prueba',
  estado: 'EVALUACION_COMPLETADA',
  idCarrera: '22222222-2222-4222-8222-222222222222',
  codigoCarrera: 'TI',
  carrera: 'Tecnologías de la Información',
  idPeriodo: '33333333-3333-4333-8333-333333333333',
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
  estudiantes: [],
  sesiones: [],
} as unknown as TrabajoMer;

describe('disponibilidad de trabajos para una nueva programación', () => {
  it('no ofrece un trabajo que conserve una programación oculta', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ idTrabajo: trabajo.id }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const dataSource = { query } as unknown as DataSource;
    const trabajos = { consultar: jest.fn().mockResolvedValue([trabajo]) } as unknown as TrabajosService;
    const service = new ProgramacionesSustentacionService(dataSource, trabajos);

    const resultado = await service.trabajosDisponibles({});

    expect(resultado.elementos).toEqual([]);
    expect(query.mock.calls[0][0]).toContain('estado_registro = 0');
  });
});
