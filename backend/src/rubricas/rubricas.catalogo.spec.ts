import { EstadoVersionRubrica } from '../comun/enums-dominio';
import { Rubrica } from './entidades/rubrica.entity';
import { VersionRubrica } from './entidades/version-rubrica.entity';
import { RubricasService } from './rubricas.service';

describe('lectura del catálogo de carreras y vigencias de rúbricas', () => {
  it('incluye asociaciones reales y vigencia independiente por carrera en el historial', async () => {
    const rubricaRepo = { findOne: jest.fn().mockResolvedValue({
      id: 'rubrica-1', nombre: 'Rúbrica', descripcion: null,
      modalidad: { id: 'modalidad-1', codigo: 'PI', nombre: 'Proyecto integrador' },
    } as Rubrica) };
    const versionesRepo = { find: jest.fn().mockResolvedValue([{
      id: 'version-1', version: 'v1.0', revision: 1, estado: EstadoVersionRubrica.ACTIVA,
      academicPeriod: { id: 'periodo-1', codigo: '2026-2' },
      activadoEn: null, creadoEn: new Date('2026-08-20T08:00:00Z'),
    } as VersionRubrica]) };
    const dataSource = {
      query: jest.fn().mockResolvedValue([
        { versionId: 'version-1', id: 'carrera-sof', codigo: 'SOF', nombre: 'Software', vigente: true },
        { versionId: 'version-1', id: 'carrera-ti', codigo: 'TI', nombre: 'Tecnologías de la Información', vigente: false },
      ]),
    };
    const service = new RubricasService(
      rubricaRepo as never,
      versionesRepo as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      { find: jest.fn() } as never,
      { find: jest.fn() } as never,
      dataSource as never,
    );

    const historial = await service.listarVersiones('rubrica-1');

    expect(historial.versiones[0].carreras).toEqual([
      { id: 'carrera-sof', codigo: 'SOF', nombre: 'Software', vigente: true },
      { id: 'carrera-ti', codigo: 'TI', nombre: 'Tecnologías de la Información', vigente: false },
    ]);
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('vigencia."vigente_hasta" IS NULL'), [['version-1']]);
  });
});
