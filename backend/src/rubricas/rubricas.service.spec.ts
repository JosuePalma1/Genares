import { EstadoVersionRubrica } from '../comun/enums-dominio';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { PeriodoAcademico } from '../catalogo/entidades/periodo-academico.entity';
import { Rubrica } from './entidades/rubrica.entity';
import { VersionRubrica } from './entidades/version-rubrica.entity';
import { RubricasService } from './rubricas.service';

describe('RubricasService', () => {
  const rubricas = { find: jest.fn(), findOne: jest.fn() };
  const versiones = { find: jest.fn() };
  const etapas = { find: jest.fn() };
  const categorias = { find: jest.fn() };
  const indicadores = { find: jest.fn() };
  const dataSource = { getRepository: jest.fn() };
  const service = new RubricasService(
    rubricas as never,
    versiones as never,
    etapas as never,
    categorias as never,
    indicadores as never,
    dataSource as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('incluye rúbricas sin versiones cuando no hay filtros de versión', async () => {
    const modalidad = { id: 'modalidad-1', codigo: 'PRES', nombre: 'Presencial' } as Modalidad;
    rubricas.find.mockResolvedValue([
      { id: 'rubrica-1', nombre: 'Rúbrica', descripcion: null, modalidad } as Rubrica,
    ]);
    versiones.find.mockResolvedValue([]);

    await expect(service.listar({})).resolves.toEqual([
      {
        id: 'rubrica-1',
        nombre: 'Rúbrica',
        descripcion: null,
        modalidad,
        versiones: [],
      },
    ]);
  });

  it('excluye rúbricas sin versiones coincidentes cuando filtra período o estado', async () => {
    const modalidad = { id: 'modalidad-1', codigo: 'PRES', nombre: 'Presencial' } as Modalidad;
    rubricas.find.mockResolvedValue([
      { id: 'rubrica-1', nombre: 'Rúbrica', descripcion: null, modalidad } as Rubrica,
    ]);
    versiones.find.mockResolvedValue([]);

    await expect(service.listar({ estado: EstadoVersionRubrica.ACTIVA })).resolves.toEqual([]);
    expect(versiones.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { estado: EstadoVersionRubrica.ACTIVA },
    }));
  });

  it('devuelve solo catálogos activos en DTOs mínimos y ordenados por código', async () => {
    const modalidadesRepo = { find: jest.fn().mockResolvedValue([
      { id: 'm-1', codigo: 'PI', nombre: 'Proyecto integrador', estaActivo: true },
    ]) };
    const periodosRepo = { find: jest.fn().mockResolvedValue([
      { id: 'p-1', codigo: '2026-2', estaActivo: true, fechaInicio: '2026-01-01' },
    ]) };
    dataSource.getRepository.mockImplementation((entity: unknown) => (
      entity === Modalidad ? modalidadesRepo : entity === PeriodoAcademico ? periodosRepo : undefined
    ));

    await expect(service.listarCatalogos()).resolves.toEqual({
      modalidades: [{ id: 'm-1', codigo: 'PI', nombre: 'Proyecto integrador' }],
      periodos: [{ id: 'p-1', codigo: '2026-2' }],
    });
    expect(modalidadesRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { estaActivo: true } }));
    expect(periodosRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: { estaActivo: true } }));
  });
});
