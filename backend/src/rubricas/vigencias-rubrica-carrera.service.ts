import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventoAuditoriaRubrica } from './entidades/evento-auditoria-rubrica.entity';
import { VersionRubricaCarrera } from './entidades/version-rubrica-carrera.entity';
import { VigenciaRubricaCarrera } from './entidades/vigencia-rubrica-carrera.entity';

interface ContextoRubricaCarrera {
  id_version_rubrica: string;
  id_carrera: string;
  id_rubrica: string;
  id_modalidad: string;
  periodo_academico_id: string;
  carrera_activa: boolean;
  modalidad_activa: boolean;
}

export interface CambioVigenciaRubricaCarrera {
  vigente: VigenciaRubricaCarrera;
  versionAnteriorId: string | null;
  cambioRealizado: boolean;
}

/** Persistencia transaccional; todavía no se expone mediante un endpoint. */
@Injectable()
export class VigenciasRubricaCarreraService {
  constructor(private readonly dataSource: DataSource) {}

  async asociarVersionCarrera(versionId: string, carreraId: string): Promise<VersionRubricaCarrera> {
    return this.dataSource.transaction(async (manager) => {
      const [contexto] = await this.contextoVersion(manager, versionId, carreraId);
      if (!contexto) await this.lanzarContextoInexistente(manager, versionId, carreraId);
      this.exigirCatalogosActivos(contexto);

      const [asociacion] = await manager.query(
        `INSERT INTO "versiones_rubrica_carreras"
          ("id_version_rubrica", "id_carrera", "id_rubrica", "id_modalidad", "periodo_academico_id")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("id_version_rubrica", "id_carrera") DO NOTHING
         RETURNING *`,
        [versionId, carreraId, contexto.id_rubrica, contexto.id_modalidad, contexto.periodo_academico_id],
      ) as VersionRubricaCarrera[];
      if (!asociacion) throw new ConflictException('La versión ya está asociada a esta carrera.');
      return asociacion;
    });
  }

  async asignarVigencia(
    versionId: string,
    carreraId: string,
    actorId: string,
    correlationId: string | null = null,
  ): Promise<CambioVigenciaRubricaCarrera> {
    if (!actorId?.trim()) throw new BadRequestException('La identidad auditada es obligatoria.');

    return this.dataSource.transaction(async (manager) => {
      // Este bloqueo serializa cambios de vigencia de la misma carrera; el índice único
      // parcial sigue protegiendo carrera/modalidad/período ante cualquier otra ruta.
      const [carreraBloqueada] = await manager.query(
        'SELECT "id" FROM "carreras" WHERE "id" = $1 FOR UPDATE',
        [carreraId],
      );
      if (!carreraBloqueada) throw new NotFoundException('No existe la carrera solicitada.');

      const [contexto] = await this.contextoAsociacion(manager, versionId, carreraId);
      if (!contexto) await this.lanzarContextoInexistente(manager, versionId, carreraId);
      this.exigirCatalogosActivos(contexto);

      const repoVigencia = manager.getRepository(VigenciaRubricaCarrera);
      const anterior = await repoVigencia.createQueryBuilder('vigencia')
        .where('vigencia.carreraId = :carreraId', { carreraId })
        .andWhere('vigencia.modalidadId = :modalidadId', { modalidadId: contexto.id_modalidad })
        .andWhere('vigencia.periodoAcademicoId = :periodoId', { periodoId: contexto.periodo_academico_id })
        .andWhere('vigencia.vigenteHasta IS NULL')
        .setLock('pessimistic_write')
        .getOne();

      if (anterior?.versionId === versionId) {
        return { vigente: anterior, versionAnteriorId: versionId, cambioRealizado: false };
      }

      let instanteInicio: Date | undefined;
      if (anterior) {
        const [cerrada] = await manager.query(
          `UPDATE "vigencias_rubrica_carrera"
           SET "vigente_hasta" = clock_timestamp()
           WHERE "id" = $1
           RETURNING "vigente_hasta"`,
          [anterior.id],
        ) as Array<{ vigente_hasta: Date }>;
        instanteInicio = cerrada.vigente_hasta;
      }

      const [nueva] = await manager.query(
        `INSERT INTO "vigencias_rubrica_carrera"
          ("id_version_rubrica", "id_carrera", "id_rubrica", "id_modalidad", "periodo_academico_id", "vigente_desde")
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, clock_timestamp()))
         RETURNING *`,
        [versionId, carreraId, contexto.id_rubrica, contexto.id_modalidad, contexto.periodo_academico_id, instanteInicio ?? null],
      ) as Array<Record<string, unknown>>;

      await manager.getRepository(EventoAuditoriaRubrica).save({
        actorId,
        accion: anterior ? 'VIGENCIA_RUBRICA_SUSTITUIDA' : 'VIGENCIA_RUBRICA_ASIGNADA',
        rubrica: { id: contexto.id_rubrica },
        modalidad: { id: contexto.id_modalidad },
        version: { id: versionId },
        versionAnterior: anterior ? { id: anterior.versionId } : null,
        carrera: { id: carreraId },
        periodoAcademico: { id: contexto.periodo_academico_id },
        correlationId,
      });

      return {
        vigente: this.desdeFila(nueva),
        versionAnteriorId: anterior?.versionId ?? null,
        cambioRealizado: true,
      };
    });
  }

  private async contextoVersion(manager: EntityManager, versionId: string, carreraId: string): Promise<ContextoRubricaCarrera[]> {
    return manager.query(
      `SELECT vr."id" AS "id_version_rubrica", $2::uuid AS "id_carrera", vr."id_rubrica",
              r."id_modalidad", vr."periodo_academico_id", c."esta_activo" AS "carrera_activa",
              m."esta_activo" AS "modalidad_activa"
       FROM "versiones_rubrica" vr
       JOIN "rubricas" r ON r."id" = vr."id_rubrica"
       JOIN "carreras" c ON c."id" = $2
       JOIN "modalidades" m ON m."id" = r."id_modalidad"
       WHERE vr."id" = $1`,
      [versionId, carreraId],
    ) as Promise<ContextoRubricaCarrera[]>;
  }

  private async contextoAsociacion(manager: EntityManager, versionId: string, carreraId: string): Promise<ContextoRubricaCarrera[]> {
    return manager.query(
      `SELECT vc."id_version_rubrica", vc."id_carrera", vc."id_rubrica", vc."id_modalidad",
              vc."periodo_academico_id", c."esta_activo" AS "carrera_activa",
              m."esta_activo" AS "modalidad_activa"
       FROM "versiones_rubrica_carreras" vc
       JOIN "carreras" c ON c."id" = vc."id_carrera"
       JOIN "modalidades" m ON m."id" = vc."id_modalidad"
       WHERE vc."id_version_rubrica" = $1 AND vc."id_carrera" = $2`,
      [versionId, carreraId],
    ) as Promise<ContextoRubricaCarrera[]>;
  }

  private async lanzarContextoInexistente(
    manager: EntityManager,
    versionId: string,
    carreraId: string,
  ): Promise<never> {
    const [version] = await manager.query('SELECT 1 FROM "versiones_rubrica" WHERE "id" = $1', [versionId]);
    const [carrera] = await manager.query('SELECT 1 FROM "carreras" WHERE "id" = $1', [carreraId]);
    if (!version) throw new NotFoundException('No existe la versión solicitada.');
    if (!carrera) throw new NotFoundException('No existe la carrera solicitada.');
    throw new ConflictException('La versión no está asociada a la carrera indicada.');
  }

  private exigirCatalogosActivos(contexto: ContextoRubricaCarrera): void {
    if (!contexto.carrera_activa || !contexto.modalidad_activa) {
      throw new ConflictException('No se pueden asociar versiones a carreras o modalidades inactivas.');
    }
  }

  private desdeFila(fila: Record<string, unknown>): VigenciaRubricaCarrera {
    return Object.assign(new VigenciaRubricaCarrera(), {
      id: fila.id,
      versionId: fila.id_version_rubrica,
      carreraId: fila.id_carrera,
      rubricaId: fila.id_rubrica,
      modalidadId: fila.id_modalidad,
      periodoAcademicoId: fila.periodo_academico_id,
      vigenteDesde: fila.vigente_desde,
      vigenteHasta: fila.vigente_hasta,
    });
  }
}
