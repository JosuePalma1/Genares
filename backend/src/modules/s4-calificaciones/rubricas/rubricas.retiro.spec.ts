import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EstadoVersionRubrica } from '../../../common/domain/enums-dominio';
import { EventoAuditoriaRubrica } from './entidades/evento-auditoria-rubrica.entity';
import { Rubrica } from './entidades/rubrica.entity';
import { VersionRubrica } from './entidades/version-rubrica.entity';
import { RubricasService } from './rubricas.service';

/** RF-15, RF-20, RN-09: retirar una versión activa de futuros usos. */
function preparar(estado: EstadoVersionRubrica | null, revision = 3) {
  const version = estado && {
    id: 'v1', version: 2, revision, estado, estadoRegistro: 1,
    rubrica: { id: 'r1' }, academicPeriod: { id: 'p1', codigo: '2026-2' },
    activadoEn: new Date('2026-11-01T00:00:00Z'), creadoEn: new Date('2026-10-01T00:00:00Z'),
  };
  const versiones = {
    findOne: jest.fn(async () => version && { ...version }),
    update: jest.fn(async (_id: string, cambios: Partial<VersionRubrica>) => { if (version) Object.assign(version, cambios); }),
    createQueryBuilder: jest.fn(() => {
      const constructor = { where: () => constructor, andWhere: () => constructor, setLock: () => constructor, getOne: async () => version && { ...version } };
      return constructor;
    }),
  };
  const rubricas = { findOne: jest.fn(async () => ({ id: 'r1' })) };
  const auditoria = { insert: jest.fn() };
  const manager = {
    query: jest.fn(async () => []),
    getRepository: (entidad: unknown) => (entidad === VersionRubrica ? versiones
      : entidad === Rubrica ? rubricas : entidad === EventoAuditoriaRubrica ? auditoria : undefined),
  };
  const dataSource = { transaction: (trabajo: (m: typeof manager) => unknown) => trabajo(manager) } as unknown as DataSource;
  const servicio = new RubricasService({} as never, {} as never, {} as never, {} as never, {} as never, dataSource);
  return { servicio, versiones, auditoria };
}

describe('retiro de versiones de rúbrica', () => {
  it('pasa una versión activa a ARCHIVADA, sin tocar su contenido, y lo audita', async () => {
    const { servicio, versiones, auditoria } = preparar(EstadoVersionRubrica.ACTIVA);

    const resultado = await servicio.retirarVersion('v1', { revision: 3 }, 'actor', 'corr-1');

    expect(versiones.update).toHaveBeenCalledTimes(1);
    expect(versiones.update).toHaveBeenCalledWith('v1', { estado: EstadoVersionRubrica.ARCHIVADA });
    expect(resultado).toMatchObject({ id: 'v1', estado: EstadoVersionRubrica.ARCHIVADA, periodo: { codigo: '2026-2' } });
    expect(auditoria.insert).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'actor', accion: 'VERSION_RUBRICA_RETIRADA', correlationId: 'corr-1',
    }));
  });

  it('no retira borradores, versiones ya retiradas ni lecturas desactualizadas', async () => {
    await expect(preparar(EstadoVersionRubrica.BORRADOR).servicio.retirarVersion('v1', { revision: 3 }, 'actor', null))
      .rejects.toThrow('Solo se puede retirar una versión activa');
    await expect(preparar(EstadoVersionRubrica.ARCHIVADA).servicio.retirarVersion('v1', { revision: 3 }, 'actor', null))
      .rejects.toThrow('ya está retirada');
    const desactualizada = preparar(EstadoVersionRubrica.ACTIVA, 4);
    await expect(desactualizada.servicio.retirarVersion('v1', { revision: 3 }, 'actor', null))
      .rejects.toBeInstanceOf(ConflictException);
    expect(desactualizada.versiones.update).not.toHaveBeenCalled();
  });

  it('responde 404 si la versión no existe o está oculta', async () => {
    await expect(preparar(null).servicio.retirarVersion('v1', { revision: 3 }, 'actor', null))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
