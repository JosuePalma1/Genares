import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError, Repository } from 'typeorm';
import { Modalidad } from '../catalogo/entidades/modalidad.entity';
import { PeriodoAcademico } from '../catalogo/entidades/periodo-academico.entity';
import { Carrera } from '../catalogo/entidades/carrera.entity';
import { AlcanceEtapaRubrica, EstadoVersionRubrica, EtapaEvaluacion } from '../comun/enums-dominio';
import { CategoriaRubrica } from './entidades/categoria-rubrica.entity';
import { EtapaRubrica } from './entidades/etapa-rubrica.entity';
import { EventoAuditoriaRubrica } from './entidades/evento-auditoria-rubrica.entity';
import { IndicadorRubrica } from './entidades/indicador-rubrica.entity';
import { Rubrica } from './entidades/rubrica.entity';
import { VersionRubrica } from './entidades/version-rubrica.entity';
import { ConsultarRubricasDto } from './dto/consultar-rubricas.dto';
import { CrearRubricaDto } from './dto/crear-rubrica.dto';
import { CrearVersionRubricaDto } from './dto/crear-version-rubrica.dto';
import { ActualizarVersionRubricaDto } from './dto/actualizar-version-rubrica.dto';
import { ActivarVersionRubricaDto } from './dto/activar-version-rubrica.dto';
import {
  CrearRubricaCompletaDto,
  CrearVersionRubricaCompletaDto,
  EtapaRubricaCompletaDto,
} from './dto/estructura-rubrica-completa.dto';
import {
  CategoriaRubricaDto,
  ActivacionVersionRubricaDto,
  CatalogosRubricaDto,
  EtapaRubricaDto,
  RubricaListadoDto,
  VersionRubricaDetalleDto,
  VersionRubricaCatalogoDto,
  VersionRubricaResumenDto,
  VersionRubricaCompletaDto,
  VersionesRubricaDto,
} from './dto/respuesta-rubrica.dto';
import { normalizarEstructuraRubricaCompleta, siguienteEtiquetaVersionRubrica } from './reglas-rubrica-completa';
import { EtapaRubricaNormalizada } from './reglas-rubrica-completa';
import { EntityManager } from 'typeorm';
import { AsociacionCarreraRubricaDto } from './dto/estructura-rubrica-completa.dto';
import {
  validarEstructuraActivableRubrica,
  validarEstructuraBorradorRubrica,
} from './reglas-borrador-rubrica';

export interface RubricaCreadaDto {
  id: string;
  nombre: string;
  descripcion: string | null;
  modalidad: { id: string; codigo: string; nombre: string };
  creadaEn: string;
}

@Injectable()
export class RubricasService {
  constructor(
    @InjectRepository(Rubrica)
    private readonly rubricas: Repository<Rubrica>,
    @InjectRepository(VersionRubrica)
    private readonly versiones: Repository<VersionRubrica>,
    @InjectRepository(EtapaRubrica)
    private readonly etapas: Repository<EtapaRubrica>,
    @InjectRepository(CategoriaRubrica)
    private readonly categorias: Repository<CategoriaRubrica>,
    @InjectRepository(IndicadorRubrica)
    private readonly indicadores: Repository<IndicadorRubrica>,
    private readonly dataSource: DataSource,
  ) {}

  async listarCatalogos(): Promise<CatalogosRubricaDto> {
    const [modalidades, periodos] = await Promise.all([
      this.dataSource.getRepository(Modalidad).find({
        where: { estaActivo: true },
        select: ['id', 'codigo', 'nombre'],
        order: { codigo: 'ASC' },
      }),
      this.dataSource.getRepository(PeriodoAcademico).find({
        where: { estaActivo: true },
        select: ['id', 'codigo'],
        order: { codigo: 'ASC' },
      }),
    ]);
    return {
      modalidades: modalidades.map(({ id, codigo, nombre }) => ({ id, codigo, nombre })),
      periodos: periodos.map(({ id, codigo }) => ({ id, codigo })),
    };
  }

  async crear(
    dto: CrearRubricaDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<RubricaCreadaDto> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const modalidad = await manager.getRepository(Modalidad).findOne({
          where: { id: dto.modalidadId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!modalidad) throw new NotFoundException('No existe la modalidad solicitada.');
        if (!modalidad.estaActivo) {
          throw new ConflictException('No se puede asociar una nueva familia de rúbricas a una modalidad inactiva.');
        }
        const existente = await manager.getRepository(Rubrica).findOne({
          where: { modalidad: { id: modalidad.id } },
        });
        if (existente) throw new ConflictException('Ya existe una rúbrica para la modalidad.');

        const rubrica = await manager.getRepository(Rubrica).save({
          modalidad,
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
        });
        await this.registrarAuditoria(manager, {
          actorId,
          accion: 'RUBRICA_CREADA',
          rubrica,
          version: null,
          correlationId,
        });
        return {
          id: rubrica.id,
          nombre: rubrica.nombre,
          descripcion: rubrica.descripcion,
          modalidad: { id: modalidad.id, codigo: modalidad.codigo, nombre: modalidad.nombre },
          creadaEn: rubrica.creadoEn.toISOString(),
        };
      });
    } catch (error) {
      this.lanzarConflictoUnico(error);
      throw error;
    }
  }

  async crearCompleta(
    dto: CrearRubricaCompletaDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<VersionRubricaCompletaDto> {
    const etapas = normalizarEstructuraRubricaCompleta(dto.etapas);
    this.validarCarrerasUnicas(dto.carreras.map(({ carreraId }) => carreraId));
    try {
      return await this.dataSource.transaction(async (manager) => {
        const modalidad = await manager.getRepository(Modalidad).findOne({
          where: { id: dto.modalidadId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!modalidad) throw new NotFoundException('No existe la modalidad solicitada.');
        if (!modalidad.estaActivo) throw new ConflictException('No se pueden crear r\u00fabricas para una modalidad inactiva.');
        const periodo = await manager.getRepository(PeriodoAcademico).findOneBy({ id: dto.periodoId });
        if (!periodo) throw new NotFoundException('No existe el per\u00edodo acad\u00e9mico solicitado.');

        const repositorioRubrica = manager.getRepository(Rubrica);
        let rubrica = await repositorioRubrica.findOne({ where: { modalidad: { id: modalidad.id } } });
        const esNueva = !rubrica;
        if (!rubrica) {
          rubrica = await repositorioRubrica.save({
            modalidad,
            nombre: dto.nombre.trim(),
            descripcion: dto.descripcion?.trim() || null,
          });
          await this.registrarAuditoria(manager, {
            actorId,
            accion: 'RUBRICA_CREADA',
            rubrica,
            version: null,
            correlationId,
          });
        } else {
          rubrica = await repositorioRubrica.findOne({
            where: { id: rubrica.id },
            lock: { mode: 'pessimistic_write' },
          });
          if (!rubrica) throw new NotFoundException('No existe la familia de r\u00fabricas solicitada.');
          const versionExistente = await manager.getRepository(VersionRubrica).findOne({
            where: { rubrica: { id: rubrica.id } },
            select: { id: true },
          });
          if (!versionExistente && rubrica.nombre !== dto.nombre.trim()) {
            rubrica.nombre = dto.nombre.trim();
            rubrica = await repositorioRubrica.save(rubrica);
            await this.registrarAuditoria(manager, {
              actorId,
              accion: 'RUBRICA_NOMBRE_ACTUALIZADO',
              rubrica,
              version: null,
              correlationId,
            });
          }
        }

        const creada = await this.guardarVersionCompleta(manager, {
          rubrica,
          modalidad,
          periodo,
          version: dto.version,
          etapas,
          carreras: dto.carreras,
          actorId,
          correlationId,
          versionBase: null,
        });
        if (!esNueva) {
          await this.registrarAuditoria(manager, {
            actorId,
            accion: 'FAMILIA_RUBRICA_REUTILIZADA',
            rubrica,
            version: creada.version,
            correlationId,
          });
        }
        return creada.respuesta;
      });
    } catch (error) {
      this.lanzarConflictoUnico(error);
      throw error;
    }
  }

  async crearVersionCompleta(
    rubricaId: string,
    dto: CrearVersionRubricaCompletaDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<VersionRubricaCompletaDto> {
    this.validarCarrerasUnicas(dto.carreras.map(({ carreraId }) => carreraId));
    if (!dto.etapas && !dto.copiarDesdeVersionId) {
      throw new BadRequestException('Indique la estructura completa o una versi\u00f3n base para copiar.');
    }
    if (dto.copiarDesdeVersionId && dto.revisionBase === undefined) {
      throw new BadRequestException('La copia requiere la revisi\u00f3n esperada de la versi\u00f3n base.');
    }
    if (!dto.copiarDesdeVersionId && dto.revisionBase !== undefined) {
      throw new BadRequestException('La revisi\u00f3n base solo se acepta cuando se indica una versi\u00f3n para copiar.');
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const repositorioRubrica = manager.getRepository(Rubrica);
        const rubricaBloqueada = await repositorioRubrica.findOne({
          where: { id: rubricaId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!rubricaBloqueada) throw new NotFoundException('No existe la r\u00fabrica solicitada.');
        const rubrica = await repositorioRubrica.findOne({
          where: { id: rubricaId },
          relations: { modalidad: true },
        });
        if (!rubrica?.modalidad) throw new NotFoundException('No existe la modalidad de la r\u00fabrica.');
        if (!rubrica.modalidad.estaActivo) throw new ConflictException('No se pueden crear versiones para una modalidad inactiva.');
        const periodo = await manager.getRepository(PeriodoAcademico).findOneBy({ id: dto.periodoId });
        if (!periodo) throw new NotFoundException('No existe el per\u00edodo acad\u00e9mico solicitado.');

        const nombreVersion = dto.version?.trim() || siguienteEtiquetaVersionRubrica(
          (await manager.getRepository(VersionRubrica).find({
            where: { rubrica: { id: rubricaId } },
            select: { version: true },
          })).map(({ version }) => version),
        );

        let versionBase: VersionRubrica | null = null;
        let etapaDtos = dto.etapas;
        if (dto.copiarDesdeVersionId) {
          versionBase = await manager.getRepository(VersionRubrica).findOne({
            where: { id: dto.copiarDesdeVersionId, rubrica: { id: rubricaId } },
            lock: { mode: 'pessimistic_write' },
          });
          if (!versionBase) throw new BadRequestException('La versi\u00f3n base debe pertenecer a esta r\u00fabrica.');
          if (versionBase.revision !== dto.revisionBase) {
            throw new ConflictException('La versi\u00f3n base cambi\u00f3 desde la \u00faltima lectura.');
          }
          if (!etapaDtos) etapaDtos = await this.copiarEstructuraComoDtos(manager, versionBase.id);
        }
        if (!etapaDtos?.length) throw new BadRequestException('La r\u00fabrica debe contener al menos una etapa.');
        const etapas = normalizarEstructuraRubricaCompleta(etapaDtos);

        const creada = await this.guardarVersionCompleta(manager, {
          rubrica,
          modalidad: rubrica.modalidad,
          periodo,
          version: nombreVersion,
          etapas,
          carreras: dto.carreras,
          actorId,
          correlationId,
          versionBase,
        });
        return creada.respuesta;
      });
    } catch (error) {
      this.lanzarConflictoUnico(error);
      throw error;
    }
  }

  async crearVersion(
    rubricaId: string,
    dto: CrearVersionRubricaDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<VersionRubricaResumenDto> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const rubrica = await manager.getRepository(Rubrica).findOne({
          where: { id: rubricaId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!rubrica) throw new NotFoundException('No existe la rúbrica solicitada.');
        const periodo = await manager.getRepository(PeriodoAcademico).findOneBy({ id: dto.periodoId });
        if (!periodo) throw new NotFoundException('No existe el período académico solicitado.');

        const versionNormalizada = dto.version.trim();
        const duplicada = await manager.getRepository(VersionRubrica)
          .createQueryBuilder('version')
          .where('version.rubrica = :rubricaId', { rubricaId })
          .andWhere('lower(version.version) = lower(:version)', { version: versionNormalizada })
          .getOne();
        if (duplicada) throw new ConflictException('El identificador de versión ya existe en esta rúbrica.');

        let fuente: VersionRubrica | null = null;
        let etapasFuente: EtapaRubrica[] = [];
        let categoriasFuente: CategoriaRubrica[] = [];
        let indicadoresFuente: IndicadorRubrica[] = [];
        if (dto.copiarDesdeVersionId) {
          fuente = await manager.getRepository(VersionRubrica).findOne({
            where: { id: dto.copiarDesdeVersionId, rubrica: { id: rubricaId } },
            lock: { mode: 'pessimistic_read' },
          });
          if (!fuente) throw new BadRequestException('La versión a copiar debe pertenecer a esta rúbrica.');
          etapasFuente = await manager.getRepository(EtapaRubrica).find({
            where: { rubricVersion: { id: fuente.id } },
            order: { orden: 'ASC', id: 'ASC' },
          });
          const etapaIds = etapasFuente.map(({ id }) => id);
          categoriasFuente = etapaIds.length ? await manager.getRepository(CategoriaRubrica).find({
            where: { etapa: { id: In(etapaIds) } },
            relations: { etapa: true },
            order: { orden: 'ASC', id: 'ASC' },
          }) : [];
          const categoriaIds = categoriasFuente.map(({ id }) => id);
          indicadoresFuente = categoriaIds.length ? await manager.getRepository(IndicadorRubrica).find({
            where: { categoria: { id: In(categoriaIds) } },
            relations: { categoria: true },
            order: { orden: 'ASC', id: 'ASC' },
          }) : [];
        }

        const version = await manager.getRepository(VersionRubrica).save({
          rubrica,
          academicPeriod: periodo,
          version: versionNormalizada,
          estado: EstadoVersionRubrica.BORRADOR,
          revision: 1,
          activadoEn: null,
        });
        const etapasNuevas = await manager.getRepository(EtapaRubrica).save(etapasFuente.map((etapa) => ({
          rubricVersion: version,
          kind: etapa.kind,
          scope: etapa.scope,
          codigo: etapa.codigo,
          nombre: etapa.nombre,
          descripcion: etapa.descripcion,
          calificacionMaxima: etapa.calificacionMaxima,
          porcentaje: etapa.porcentaje,
          orden: etapa.orden,
        })));
        const etapasNuevasPorCodigo = new Map(etapasNuevas.map((etapa) => [etapa.codigo, etapa]));
        const etapaFuentePorId = new Map(etapasFuente.map((etapa) => [etapa.id, etapa.codigo]));
        const categoriasNuevas = await manager.getRepository(CategoriaRubrica).save(categoriasFuente.map((categoria) => ({
          rubricVersion: version,
          etapa: etapasNuevasPorCodigo.get(etapaFuentePorId.get(categoria.etapa.id) ?? '')!,
          codigo: categoria.codigo,
          nombre: categoria.nombre,
          calificacionMaxima: categoria.calificacionMaxima,
          orden: categoria.orden,
        })));
        const categoriaFuentePorId = new Map(categoriasFuente.map((categoria) => [categoria.id, categoria]));
        const indicadorCategoriaCodigo = new Map(categoriasFuente.map((categoria) => [categoria.id, categoria.codigo]));
        const categoriasNuevasPorEtapaCodigo = new Map(
          categoriasNuevas.map((categoria) => [`${categoria.etapa.codigo}:${categoria.codigo}`, categoria]),
        );
        await manager.getRepository(IndicadorRubrica).save(indicadoresFuente.map((indicador) => {
          const categoriaFuente = categoriaFuentePorId.get(indicador.categoria.id)!;
          const etapaCodigo = etapaFuentePorId.get(categoriaFuente.etapa.id)!;
          const categoria = categoriasNuevasPorEtapaCodigo.get(
            `${etapaCodigo}:${indicadorCategoriaCodigo.get(indicador.categoria.id)}`,
          )!;
          return {
            categoria,
            label: indicador.label,
            descripcion: indicador.descripcion,
            calificacionMaxima: indicador.calificacionMaxima,
            orden: indicador.orden,
          };
        }));
        await this.registrarAuditoria(manager, {
          actorId,
          accion: 'VERSION_BORRADOR_CREADA',
          rubrica,
          version,
          correlationId,
        });
        return this.aResumen({ ...version, rubrica, academicPeriod: periodo });
      });
    } catch (error) {
      this.lanzarConflictoUnico(error);
      throw error;
    }
  }

  async actualizarVersion(
    versionId: string,
    dto: ActualizarVersionRubricaDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<VersionRubricaDetalleDto> {
    validarEstructuraBorradorRubrica(dto);
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repositorioVersion = manager.getRepository(VersionRubrica);
        const version = await repositorioVersion.createQueryBuilder('version')
          .where('version.id = :versionId', { versionId })
          .setLock('pessimistic_write')
          .getOne();
        if (!version) throw new NotFoundException('No existe la versión solicitada.');
        if (version.estado !== EstadoVersionRubrica.BORRADOR) {
          throw new ConflictException('Solo se pueden editar versiones en estado BORRADOR.');
        }
        if (dto.revision !== version.revision) {
          throw new ConflictException('El borrador cambió desde la última lectura; recárguelo antes de guardar.');
        }
        const versionConRelaciones = await repositorioVersion.findOne({
          where: { id: version.id },
          relations: { rubrica: true, academicPeriod: true },
        });
        if (!versionConRelaciones) throw new NotFoundException('No existe la versión solicitada.');

        const etapasActuales = await manager.getRepository(EtapaRubrica).find({
          where: { rubricVersion: { id: version.id } },
        });
        const idsEtapas = etapasActuales.map(({ id }) => id);
        const categoriasActuales = idsEtapas.length ? await manager.getRepository(CategoriaRubrica).find({
          where: { etapa: { id: In(idsEtapas) } },
          relations: { etapa: true },
        }) : [];
        const idsCategorias = categoriasActuales.map(({ id }) => id);
        const indicadoresActuales = idsCategorias.length ? await manager.getRepository(IndicadorRubrica).find({
          where: { categoria: { id: In(idsCategorias) } },
          relations: { categoria: true },
        }) : [];
        this.validarIdsPropios(dto, etapasActuales, categoriasActuales, indicadoresActuales);

        version.revision += 1;
        const guardada = await repositorioVersion.save(version);
        await manager.getRepository(EtapaRubrica).delete({ rubricVersion: { id: version.id } });

        for (const etapaDto of dto.etapas) {
          const etapa = await manager.getRepository(EtapaRubrica).save({
            ...(etapaDto.id ? { id: etapaDto.id } : {}),
            rubricVersion: guardada,
            kind: etapaDto.tipo,
            scope: etapaDto.alcance,
            codigo: etapaDto.codigo.trim(),
            nombre: etapaDto.nombre.trim(),
            descripcion: etapaDto.descripcion?.trim() || null,
            calificacionMaxima: this.normalizarDecimal(etapaDto.calificacionMaxima),
            porcentaje: etapaDto.porcentaje == null ? null : this.normalizarDecimal(etapaDto.porcentaje),
            orden: etapaDto.orden,
          });
          for (const categoriaDto of etapaDto.categorias) {
            const categoria = await manager.getRepository(CategoriaRubrica).save({
              ...(categoriaDto.id ? { id: categoriaDto.id } : {}),
              rubricVersion: guardada,
              etapa,
              codigo: categoriaDto.codigo.trim(),
              nombre: categoriaDto.nombre.trim(),
              calificacionMaxima: this.normalizarDecimal(categoriaDto.calificacionMaxima),
              orden: categoriaDto.orden,
            });
            for (const indicadorDto of categoriaDto.indicadores) {
              await manager.getRepository(IndicadorRubrica).save({
                ...(indicadorDto.id ? { id: indicadorDto.id } : {}),
                categoria,
                label: indicadorDto.label.trim(),
                descripcion: indicadorDto.descripcion.trim(),
                calificacionMaxima: this.normalizarDecimal(indicadorDto.calificacionMaxima),
                orden: indicadorDto.orden,
              });
            }
          }
        }
        await this.registrarAuditoria(manager, {
          actorId,
          accion: 'VERSION_BORRADOR_ACTUALIZADA',
          rubrica: versionConRelaciones.rubrica,
          version: guardada,
          correlationId,
        });
        return {
          ...this.aResumen({
            ...versionConRelaciones,
            ...guardada,
            rubrica: versionConRelaciones.rubrica,
            academicPeriod: versionConRelaciones.academicPeriod,
          }),
          etapas: await this.detalleEtapas(manager, guardada.id),
        };
      });
    } catch (error) {
      this.lanzarConflictoUnico(error);
      throw error;
    }
  }

  async activarVersion(
    versionId: string,
    dto: ActivarVersionRubricaDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<ActivacionVersionRubricaDto> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repositorioVersion = manager.getRepository(VersionRubrica);
        const candidataInicial = await repositorioVersion.findOne({
          where: { id: versionId },
          relations: { rubrica: { modalidad: true }, academicPeriod: true },
        });
        if (!candidataInicial) throw new NotFoundException('No existe la versión solicitada.');

        // La rúbrica funciona como cerrojo común para todas sus versiones y períodos.
        const rubricaBloqueada = await manager.getRepository(Rubrica).findOne({
          where: { id: candidataInicial.rubrica.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!rubricaBloqueada) throw new NotFoundException('No existe la rúbrica de la versión.');

        const versionBloqueada = await repositorioVersion.createQueryBuilder('version')
          .where('version.id = :versionId', { versionId })
          .setLock('pessimistic_write')
          .getOne();
        if (!versionBloqueada) throw new NotFoundException('No existe la versión solicitada.');
        if (versionBloqueada.estado === EstadoVersionRubrica.ARCHIVADA) {
          throw new ConflictException('Una versión archivada no puede reactivarse.');
        }
        if (versionBloqueada.estado === EstadoVersionRubrica.ACTIVA) {
          throw new ConflictException('La versión ya está activa.');
        }
        if (versionBloqueada.estado !== EstadoVersionRubrica.BORRADOR) {
          throw new ConflictException('Solo se pueden activar versiones en estado BORRADOR.');
        }
        if (versionBloqueada.revision !== dto.revision) {
          throw new ConflictException('La versión cambió desde la última lectura; recárguela antes de activar.');
        }

        const referenciasActuales = await manager.query(
          'SELECT id_rubrica, periodo_academico_id FROM versiones_rubrica WHERE id = $1',
          [versionId],
        ) as Array<{ id_rubrica: string; periodo_academico_id: string }>;
        if (
          referenciasActuales[0]?.id_rubrica !== candidataInicial.rubrica.id
          || referenciasActuales[0]?.periodo_academico_id !== candidataInicial.academicPeriod.id
        ) {
          throw new ConflictException('La versión cambió de rúbrica o período durante la activación.');
        }
        const candidata = await repositorioVersion.findOne({
          where: { id: versionId },
          relations: { rubrica: { modalidad: true }, academicPeriod: true },
        });
        if (!candidata) throw new NotFoundException('No existe la versión solicitada.');
        if (!candidata.rubrica.modalidad || !candidata.academicPeriod) {
          throw new BadRequestException('La versión requiere una modalidad y un período existentes.');
        }

        const etapas = await manager.getRepository(EtapaRubrica).find({
          where: { rubricVersion: { id: versionId } },
          order: { orden: 'ASC', id: 'ASC' },
        });
        const etapaIds = etapas.map(({ id }) => id);
        const categorias = etapaIds.length ? await manager.getRepository(CategoriaRubrica).find({
          where: { etapa: { id: In(etapaIds) } },
          relations: { etapa: true },
          order: { orden: 'ASC', id: 'ASC' },
        }) : [];
        const categoriaIds = categorias.map(({ id }) => id);
        const indicadores = categoriaIds.length ? await manager.getRepository(IndicadorRubrica).find({
          where: { categoria: { id: In(categoriaIds) } },
          relations: { categoria: true },
          order: { orden: 'ASC', id: 'ASC' },
        }) : [];
        const indicadoresPorCategoria = new Map<string, IndicadorRubrica[]>();
        for (const indicador of indicadores) {
          const grupo = indicadoresPorCategoria.get(indicador.categoria.id) ?? [];
          grupo.push(indicador);
          indicadoresPorCategoria.set(indicador.categoria.id, grupo);
        }
        const categoriasPorEtapa = new Map<string, CategoriaRubrica[]>();
        for (const categoria of categorias) {
          const grupo = categoriasPorEtapa.get(categoria.etapa.id) ?? [];
          grupo.push(categoria);
          categoriasPorEtapa.set(categoria.etapa.id, grupo);
        }
        const estructura: ActualizarVersionRubricaDto = {
          revision: versionBloqueada.revision,
          etapas: etapas.map((etapa) => ({
            id: etapa.id,
            tipo: etapa.kind,
            alcance: etapa.scope,
            codigo: etapa.codigo,
            nombre: etapa.nombre,
            descripcion: etapa.descripcion,
            calificacionMaxima: etapa.calificacionMaxima,
            porcentaje: etapa.porcentaje,
            orden: etapa.orden,
            categorias: (categoriasPorEtapa.get(etapa.id) ?? []).map((categoria) => ({
              id: categoria.id,
              codigo: categoria.codigo,
              nombre: categoria.nombre,
              calificacionMaxima: categoria.calificacionMaxima,
              orden: categoria.orden,
              indicadores: (indicadoresPorCategoria.get(categoria.id) ?? []).map((indicador) => ({
                id: indicador.id,
                label: indicador.label,
                descripcion: indicador.descripcion,
                calificacionMaxima: indicador.calificacionMaxima,
                orden: indicador.orden,
              })),
            })),
          })),
        };
        validarEstructuraActivableRubrica(estructura);

        const versionActivaAnterior = await repositorioVersion.createQueryBuilder('version')
          .where('version.rubrica = :rubricaId', { rubricaId: candidata.rubrica.id })
          .andWhere('version.academicPeriod = :periodoId', { periodoId: candidata.academicPeriod.id })
          .andWhere('version.estado = :estado', { estado: EstadoVersionRubrica.ACTIVA })
          .setLock('pessimistic_write')
          .getOne();

        if (versionActivaAnterior) {
          await repositorioVersion.update(versionActivaAnterior.id, {
            estado: EstadoVersionRubrica.ARCHIVADA,
          });
        }
        await repositorioVersion.update(versionId, { estado: EstadoVersionRubrica.ACTIVA });

        if (versionActivaAnterior) {
          await this.registrarAuditoria(manager, {
            actorId,
            accion: 'VERSION_RUBRICA_ARCHIVADA_POR_ACTIVACION',
            rubrica: rubricaBloqueada,
            version: versionActivaAnterior,
            correlationId,
          });
        }
        await this.registrarAuditoria(manager, {
          actorId,
          accion: 'VERSION_RUBRICA_ACTIVADA',
          rubrica: rubricaBloqueada,
          version: versionBloqueada,
          correlationId,
        });

        const activada = await repositorioVersion.findOne({
          where: { id: versionId },
          relations: { rubrica: true, academicPeriod: true },
        });
        if (!activada) throw new NotFoundException('No se pudo recuperar la versión activada.');
        const archivada = versionActivaAnterior
          ? await repositorioVersion.findOne({
            where: { id: versionActivaAnterior.id },
            relations: { rubrica: true, academicPeriod: true },
          })
          : null;
        return {
          activada: this.aResumen(activada),
          archivada: archivada ? this.aResumen(archivada) : null,
        };
      });
    } catch (error) {
      this.lanzarErrorActivacion(error);
      throw error;
    }
  }

  private validarCarrerasUnicas(carreraIds: string[]): void {
    if (new Set(carreraIds.map((id) => id.toLowerCase())).size !== carreraIds.length) {
      throw new BadRequestException('Cada carrera debe aparecer una sola vez.');
    }
  }

  private async copiarEstructuraComoDtos(
    manager: EntityManager,
    versionId: string,
  ): Promise<EtapaRubricaCompletaDto[]> {
    const etapas = await manager.getRepository(EtapaRubrica).find({
      where: { rubricVersion: { id: versionId } },
      order: { orden: 'ASC', id: 'ASC' },
    });
    const resultado: EtapaRubricaCompletaDto[] = [];
    for (const etapa of etapas) {
      const categorias = await manager.getRepository(CategoriaRubrica).find({
        where: { etapa: { id: etapa.id } },
        order: { orden: 'ASC', id: 'ASC' },
      });
      const categoriasDto = [];
      for (const categoria of categorias) {
        const indicadores = await manager.getRepository(IndicadorRubrica).find({
          where: { categoria: { id: categoria.id } },
          order: { orden: 'ASC', id: 'ASC' },
        });
        categoriasDto.push({
          codigo: categoria.codigo,
          nombre: categoria.nombre,
          orden: categoria.orden,
          indicadores: indicadores.map((indicador) => ({
            label: indicador.label,
            descripcion: indicador.descripcion,
            calificacionMaxima: indicador.calificacionMaxima,
            orden: indicador.orden,
          })),
        });
      }
      resultado.push({
        codigo: etapa.codigo,
        nombre: etapa.nombre,
        alcance: etapa.scope,
        descripcion: etapa.descripcion,
        orden: etapa.orden,
        categorias: categoriasDto,
      });
    }
    return resultado;
  }

  private async guardarVersionCompleta(
    manager: EntityManager,
    contexto: {
      rubrica: Rubrica;
      modalidad: Modalidad;
      periodo: PeriodoAcademico;
      version: string;
      etapas: EtapaRubricaNormalizada[];
      carreras: AsociacionCarreraRubricaDto[];
      actorId: string;
      correlationId: string | null;
      versionBase: VersionRubrica | null;
    },
  ): Promise<{ version: VersionRubrica; respuesta: VersionRubricaCompletaDto }> {
    const nombreVersion = contexto.version.trim();
    const duplicada = await manager.getRepository(VersionRubrica)
      .createQueryBuilder('version')
      .where('version.rubrica = :rubricaId', { rubricaId: contexto.rubrica.id })
      .andWhere('lower(version.version) = lower(:version)', { version: nombreVersion })
      .getOne();
    if (duplicada) throw new ConflictException('El identificador de versi\u00f3n ya existe en esta r\u00fabrica.');

    const repositorioVersion = manager.getRepository(VersionRubrica);
    const versionBorrador: VersionRubrica = await repositorioVersion.save({
      rubrica: contexto.rubrica,
      academicPeriod: contexto.periodo,
      version: nombreVersion,
      estado: EstadoVersionRubrica.BORRADOR,
      revision: 1,
      activadoEn: null,
      versionBase: contexto.versionBase,
    });

    for (const etapaNormalizada of contexto.etapas) {
      const etapaDto = etapaNormalizada.dto;
      const etapa = await manager.getRepository(EtapaRubrica).save({
        rubricVersion: versionBorrador,
        kind: EtapaEvaluacion.PERSONALIZADA,
        scope: etapaDto.alcance,
        codigo: etapaDto.codigo.trim(),
        nombre: etapaDto.nombre.trim(),
        descripcion: etapaDto.descripcion?.trim() || null,
        calificacionMaxima: '10.00',
        porcentaje: null,
        orden: etapaDto.orden,
      });
      for (const categoriaNormalizada of etapaNormalizada.categorias) {
        const categoriaDto = categoriaNormalizada.dto;
        const categoria = await manager.getRepository(CategoriaRubrica).save({
          rubricVersion: versionBorrador,
          etapa,
          codigo: categoriaDto.codigo.trim(),
          nombre: categoriaDto.nombre.trim(),
          calificacionMaxima: categoriaNormalizada.calificacionMaxima,
          orden: categoriaDto.orden,
        });
        await manager.getRepository(IndicadorRubrica).save(categoriaDto.indicadores.map((indicador) => ({
          categoria,
          label: indicador.label.trim(),
          descripcion: indicador.descripcion.trim(),
          calificacionMaxima: this.normalizarDecimal(indicador.calificacionMaxima),
          orden: indicador.orden,
        })));
      }
    }

    versionBorrador.estado = EstadoVersionRubrica.CONFIGURADA;
    const version = await repositorioVersion.save(versionBorrador);
    await this.registrarAuditoria(manager, {
      actorId: contexto.actorId,
      accion: 'VERSION_COMPLETA_CREADA',
      rubrica: contexto.rubrica,
      version,
      correlationId: contexto.correlationId,
    });
    await this.registrarAuditoria(manager, {
      actorId: contexto.actorId,
      accion: 'ESTRUCTURA_RUBRICA_GUARDADA',
      rubrica: contexto.rubrica,
      version,
      correlationId: contexto.correlationId,
    });

    const carrerasOrdenadas = [...contexto.carreras].sort((a, b) => a.carreraId.localeCompare(b.carreraId));
    const idsCarrera = carrerasOrdenadas.map(({ carreraId }) => carreraId);
    const filasCarrera = await manager.query(
      `SELECT "id", "codigo", "nombre", "revision", "esta_activo"
       FROM "carreras" WHERE "id" = ANY($1::uuid[]) ORDER BY "id" FOR UPDATE`,
      [idsCarrera],
    ) as Array<{ id: string; codigo: string; nombre: string; revision: number; esta_activo: boolean }>;
    const carrerasPorId = new Map(filasCarrera.map((carrera) => [carrera.id.toLowerCase(), carrera]));
    for (const solicitud of carrerasOrdenadas) {
      const carrera = carrerasPorId.get(solicitud.carreraId.toLowerCase());
      if (!carrera) throw new NotFoundException('No existe una de las carreras solicitadas.');
      if (Number(carrera.revision) !== solicitud.revision) {
        throw new ConflictException(`La carrera ${carrera.codigo} cambi\u00f3 desde la \u00faltima lectura.`);
      }
      if (!carrera.esta_activo) throw new ConflictException(`La carrera ${carrera.codigo} est\u00e1 inactiva.`);
    }

    for (const solicitud of carrerasOrdenadas) {
      const carrera = carrerasPorId.get(solicitud.carreraId.toLowerCase())!;
      const [asociacion] = await manager.query(
        `INSERT INTO "versiones_rubrica_carreras"
          ("id_version_rubrica", "id_carrera", "id_rubrica", "id_modalidad", "periodo_academico_id")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("id_version_rubrica", "id_carrera") DO NOTHING RETURNING "id_version_rubrica"`,
        [version.id, carrera.id, contexto.rubrica.id, contexto.modalidad.id, contexto.periodo.id],
      ) as Array<{ id_version_rubrica: string }>;
      if (!asociacion) throw new ConflictException(`La versi\u00f3n ya est\u00e1 asociada a la carrera ${carrera.codigo}.`);

      await manager.getRepository(EventoAuditoriaRubrica).save({
        actorId: contexto.actorId,
        accion: 'VERSION_RUBRICA_ASOCIADA_CARRERA',
        rubrica: contexto.rubrica,
        modalidad: contexto.modalidad,
        version,
        carrera: { id: carrera.id } as Carrera,
        periodoAcademico: contexto.periodo,
        correlationId: contexto.correlationId,
      });

      const [vigenciaActual] = await manager.query(
        `SELECT "id_version_rubrica" FROM "vigencias_rubrica_carrera"
         WHERE "id_carrera" = $1 AND "id_modalidad" = $2 AND "periodo_academico_id" = $3
           AND "vigente_hasta" IS NULL FOR UPDATE`,
        [carrera.id, contexto.modalidad.id, contexto.periodo.id],
      ) as Array<{ id_version_rubrica: string }>;
      const actualEsperada = vigenciaActual?.id_version_rubrica ?? null;
      const esperada = solicitud.vigenciaEsperada.versionId;
      if ((actualEsperada?.toLowerCase() ?? null) !== (esperada?.toLowerCase() ?? null)) {
        throw new ConflictException(`La vigencia de la carrera ${carrera.codigo} cambi\u00f3 desde la \u00faltima lectura.`);
      }

      if (solicitud.vigente && actualEsperada !== version.id) {
        let inicio: Date | null = null;
        if (vigenciaActual) {
          const [anteriorCerrada] = await manager.query(
            `UPDATE "vigencias_rubrica_carrera" SET "vigente_hasta" = clock_timestamp()
             WHERE "id_carrera" = $1 AND "id_modalidad" = $2 AND "periodo_academico_id" = $3
               AND "vigente_hasta" IS NULL RETURNING "vigente_hasta"`,
            [carrera.id, contexto.modalidad.id, contexto.periodo.id],
          ) as Array<{ vigente_hasta: Date }>;
          inicio = anteriorCerrada.vigente_hasta;
        }
        const [nuevaVigencia] = await manager.query(
          `INSERT INTO "vigencias_rubrica_carrera"
            ("id_version_rubrica", "id_carrera", "id_rubrica", "id_modalidad", "periodo_academico_id", "vigente_desde")
           VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, clock_timestamp()))
           RETURNING "id"`,
          [version.id, carrera.id, contexto.rubrica.id, contexto.modalidad.id, contexto.periodo.id, inicio],
        ) as Array<{ id: string }>;
        if (!nuevaVigencia) throw new ConflictException('No se pudo asignar la vigencia solicitada.');

        await manager.getRepository(EventoAuditoriaRubrica).save({
          actorId: contexto.actorId,
          accion: actualEsperada ? 'VIGENCIA_RUBRICA_SUSTITUIDA' : 'VIGENCIA_RUBRICA_ASIGNADA',
          rubrica: contexto.rubrica,
          modalidad: contexto.modalidad,
          version,
          versionAnterior: actualEsperada ? { id: actualEsperada } as VersionRubrica : null,
          carrera: { id: carrera.id } as Carrera,
          periodoAcademico: contexto.periodo,
          correlationId: contexto.correlationId,
        });
      }
    }

    const etapasDto = await this.detalleEtapas(manager, version.id);
    const carrerasRespuesta = await manager.query(
      `SELECT carrera."id", carrera."codigo", carrera."nombre",
              EXISTS (SELECT 1 FROM "vigencias_rubrica_carrera" vigencia
                WHERE vigencia."id_version_rubrica" = asociacion."id_version_rubrica"
                  AND vigencia."id_carrera" = asociacion."id_carrera"
                  AND vigencia."vigente_hasta" IS NULL) AS "vigente"
       FROM "versiones_rubrica_carreras" asociacion
       JOIN "carreras" carrera ON carrera."id" = asociacion."id_carrera"
       WHERE asociacion."id_version_rubrica" = $1 ORDER BY carrera."codigo", carrera."id"`,
      [version.id],
    ) as Array<{ id: string; codigo: string; nombre: string; vigente: boolean }>;
    const versionConRelaciones = { ...version, rubrica: contexto.rubrica, academicPeriod: contexto.periodo };
    return {
      version,
      respuesta: {
        ...this.aResumen(versionConRelaciones),
        etapas: etapasDto,
        rubrica: {
          id: contexto.rubrica.id,
          nombre: contexto.rubrica.nombre,
          descripcion: contexto.rubrica.descripcion,
          modalidad: {
            id: contexto.modalidad.id,
            codigo: contexto.modalidad.codigo,
            nombre: contexto.modalidad.nombre,
          },
        },
        carreras: carrerasRespuesta.map((carrera) => ({
          id: carrera.id,
          codigo: carrera.codigo,
          nombre: carrera.nombre,
          vigente: carrera.vigente,
        })),
      },
    };
  }

  async listar(filtros: ConsultarRubricasDto): Promise<RubricaListadoDto[]> {
    const rubricas = await this.rubricas.find({
      where: filtros.modalidadId ? { modalidad: { id: filtros.modalidadId } } : {},
      relations: { modalidad: true },
      order: { nombre: 'ASC', id: 'ASC' },
    });

    const versiones = await this.versiones.find({
      where: {
        ...(filtros.estado ? { estado: filtros.estado } : {}),
        ...(filtros.periodoId ? { academicPeriod: { id: filtros.periodoId } } : {}),
        ...(filtros.modalidadId
          ? { rubrica: { modalidad: { id: filtros.modalidadId } } }
          : {}),
      },
      relations: { rubrica: true, academicPeriod: true },
      order: { creadoEn: 'DESC', version: 'ASC', id: 'ASC' },
    });

    const versionesPorRubrica = new Map<string, VersionRubricaResumenDto[]>();
    for (const version of versiones) {
      const resumen = this.aResumen(version);
      const grupo = versionesPorRubrica.get(version.rubrica.id) ?? [];
      grupo.push(resumen);
      versionesPorRubrica.set(version.rubrica.id, grupo);
    }

    const filtraPorVersion = Boolean(filtros.periodoId || filtros.estado);
    return rubricas
      .filter((rubrica) => !filtraPorVersion || versionesPorRubrica.has(rubrica.id))
      .map((rubrica) => ({
        id: rubrica.id,
        nombre: rubrica.nombre,
        descripcion: rubrica.descripcion,
        modalidad: {
          id: rubrica.modalidad.id,
          codigo: rubrica.modalidad.codigo,
          nombre: rubrica.modalidad.nombre,
        },
        versiones: versionesPorRubrica.get(rubrica.id) ?? [],
      }));
  }

  async listarVersiones(rubricaId: string): Promise<VersionesRubricaDto> {
    const rubrica = await this.rubricas.findOne({
      where: { id: rubricaId },
      relations: { modalidad: true },
    });
    if (!rubrica) throw new NotFoundException('No existe la rúbrica solicitada.');

    const versiones = await this.versiones.find({
      where: { rubrica: { id: rubricaId } },
      relations: { academicPeriod: true },
      order: { creadoEn: 'ASC', version: 'ASC', id: 'ASC' },
    });
    if (versiones.length === 0) return { rubricaId, versiones: [] };

    const versionIds = versiones.map(({ id }) => id);
    const etapas = await this.etapas.find({
      where: { rubricVersion: { id: In(versionIds) } },
      relations: { rubricVersion: true },
      order: { orden: 'ASC', id: 'ASC' },
    });
    const etapaIds = etapas.map(({ id }) => id);
    const categorias = etapaIds.length
      ? await this.categorias.find({
          where: { etapa: { id: In(etapaIds) } },
          relations: { etapa: true },
          order: { orden: 'ASC', id: 'ASC' },
        })
      : [];
    const categoriaIds = categorias.map(({ id }) => id);
    const indicadores = categoriaIds.length
      ? await this.indicadores.find({
          where: { categoria: { id: In(categoriaIds) } },
          relations: { categoria: true },
          order: { orden: 'ASC', id: 'ASC' },
        })
      : [];

    const indicadoresPorCategoria = new Map<string, IndicadorRubrica[]>();
    for (const indicador of indicadores) {
      const grupo = indicadoresPorCategoria.get(indicador.categoria.id) ?? [];
      grupo.push(indicador);
      indicadoresPorCategoria.set(indicador.categoria.id, grupo);
    }

    const categoriasPorEtapa = new Map<string, CategoriaRubricaDto[]>();
    for (const categoria of categorias) {
      const grupo = categoriasPorEtapa.get(categoria.etapa.id) ?? [];
      grupo.push({
        id: categoria.id,
        codigo: categoria.codigo,
        nombre: categoria.nombre,
        calificacionMaxima: categoria.calificacionMaxima,
        orden: categoria.orden,
        indicadores: (indicadoresPorCategoria.get(categoria.id) ?? []).map((indicador) => ({
          id: indicador.id,
          label: indicador.label,
          descripcion: indicador.descripcion,
          calificacionMaxima: indicador.calificacionMaxima,
          orden: indicador.orden,
        })),
      });
      categoriasPorEtapa.set(categoria.etapa.id, grupo);
    }

    const etapasPorVersion = new Map<string, EtapaRubricaDto[]>();
    for (const etapa of etapas) {
      const grupo = etapasPorVersion.get(etapa.rubricVersion.id) ?? [];
      grupo.push({
        id: etapa.id,
        tipo: etapa.kind,
        alcance: etapa.scope,
        codigo: etapa.codigo,
        nombre: etapa.nombre,
        descripcion: etapa.descripcion,
        calificacionMaxima: etapa.calificacionMaxima,
        porcentaje: etapa.porcentaje,
        orden: etapa.orden,
        categorias: categoriasPorEtapa.get(etapa.id) ?? [],
      });
      etapasPorVersion.set(etapa.rubricVersion.id, grupo);
    }

    const asociacionesCarrera = await this.dataSource.query(
      `SELECT asociacion."id_version_rubrica" AS "versionId",
              carrera."id", carrera."codigo", carrera."nombre",
              EXISTS (SELECT 1 FROM "vigencias_rubrica_carrera" vigencia
                WHERE vigencia."id_version_rubrica" = asociacion."id_version_rubrica"
                  AND vigencia."id_carrera" = asociacion."id_carrera"
                  AND vigencia."vigente_hasta" IS NULL) AS "vigente"
       FROM "versiones_rubrica_carreras" asociacion
       JOIN "carreras" carrera ON carrera."id" = asociacion."id_carrera"
       WHERE asociacion."id_version_rubrica" = ANY($1::uuid[])
       ORDER BY asociacion."id_version_rubrica", carrera."codigo", carrera."id"`,
      [versionIds],
    ) as Array<{
      versionId: string;
      id: string;
      codigo: string;
      nombre: string;
      vigente: boolean;
    }>;
    const carrerasPorVersion = new Map<string, VersionRubricaCatalogoDto['carreras']>();
    for (const carrera of asociacionesCarrera) {
      const grupo = carrerasPorVersion.get(carrera.versionId) ?? [];
      grupo.push({
        id: carrera.id,
        codigo: carrera.codigo,
        nombre: carrera.nombre,
        vigente: carrera.vigente,
      });
      carrerasPorVersion.set(carrera.versionId, grupo);
    }

    const detalles: VersionRubricaCatalogoDto[] = versiones.map((version) => ({
      ...this.aResumen(version),
      etapas: etapasPorVersion.get(version.id) ?? [],
      carreras: carrerasPorVersion.get(version.id) ?? [],
    }));
    return { rubricaId, versiones: detalles };
  }

  private aResumen(version: VersionRubrica): VersionRubricaResumenDto {
    return {
      id: version.id,
      version: version.version,
      revision: version.revision,
      estado: version.estado,
      periodo: {
        id: version.academicPeriod.id,
        codigo: version.academicPeriod.codigo,
      },
      activadaEn: version.activadoEn?.toISOString() ?? null,
      creadaEn: version.creadoEn.toISOString(),
    };
  }

  private async registrarAuditoria(
    manager: import('typeorm').EntityManager,
    evento: {
      actorId: string;
      accion: string;
      rubrica: Rubrica;
      version: VersionRubrica | null;
      correlationId: string | null;
    },
  ): Promise<void> {
    await manager.getRepository(EventoAuditoriaRubrica).insert({
      actorId: evento.actorId,
      accion: evento.accion,
      rubrica: evento.rubrica,
      version: evento.version,
      correlationId: evento.correlationId,
    });
  }

  private async detalleEtapas(
    manager: import('typeorm').EntityManager,
    versionId: string,
  ): Promise<EtapaRubricaDto[]> {
    const etapas = await manager.getRepository(EtapaRubrica).find({
      where: { rubricVersion: { id: versionId } },
      order: { orden: 'ASC', id: 'ASC' },
    });
    const resultado: EtapaRubricaDto[] = [];
    for (const etapa of etapas) {
      const categorias = await manager.getRepository(CategoriaRubrica).find({
        where: { etapa: { id: etapa.id } },
        order: { orden: 'ASC', id: 'ASC' },
      });
      const categoriasDto: CategoriaRubricaDto[] = [];
      for (const categoria of categorias) {
        const indicadores = await manager.getRepository(IndicadorRubrica).find({
          where: { categoria: { id: categoria.id } },
          order: { orden: 'ASC', id: 'ASC' },
        });
        categoriasDto.push({
          id: categoria.id,
          codigo: categoria.codigo,
          nombre: categoria.nombre,
          calificacionMaxima: categoria.calificacionMaxima,
          orden: categoria.orden,
          indicadores: indicadores.map((indicador) => ({
            id: indicador.id,
            label: indicador.label,
            descripcion: indicador.descripcion,
            calificacionMaxima: indicador.calificacionMaxima,
            orden: indicador.orden,
          })),
        });
      }
      resultado.push({
        id: etapa.id,
        tipo: etapa.kind,
        alcance: etapa.scope,
        codigo: etapa.codigo,
        nombre: etapa.nombre,
        descripcion: etapa.descripcion,
        calificacionMaxima: etapa.calificacionMaxima,
        porcentaje: etapa.porcentaje,
        orden: etapa.orden,
        categorias: categoriasDto,
      });
    }
    return resultado;
  }

  private validarIdsPropios(
    dto: ActualizarVersionRubricaDto,
    etapasActuales: EtapaRubrica[],
    categoriasActuales: CategoriaRubrica[],
    indicadoresActuales: IndicadorRubrica[],
  ): void {
    const etapasPorId = new Map(etapasActuales.map((etapa) => [etapa.id, etapa]));
    const categoriasPorId = new Map(categoriasActuales.map((categoria) => [categoria.id, categoria]));
    const indicadoresPorId = new Map(indicadoresActuales.map((indicador) => [indicador.id, indicador]));
    for (const etapa of dto.etapas) {
      if (etapa.id && !etapasPorId.has(etapa.id)) {
        throw new BadRequestException('Una etapa indicada no pertenece a este borrador.');
      }
      for (const categoria of etapa.categorias) {
        const categoriaActual = categoria.id ? categoriasPorId.get(categoria.id) : undefined;
        if (categoria.id && !categoriaActual) {
          throw new BadRequestException('Una categoría indicada no pertenece a este borrador.');
        }
        if (categoriaActual && etapa.id && categoriaActual.etapa.id !== etapa.id) {
          throw new BadRequestException('No se puede mover una categoría a otra etapa.');
        }
        for (const indicador of categoria.indicadores) {
          const indicadorActual = indicador.id ? indicadoresPorId.get(indicador.id) : undefined;
          if (indicador.id && !indicadorActual) {
            throw new BadRequestException('Un indicador indicado no pertenece a este borrador.');
          }
          if (indicadorActual && categoria.id && indicadorActual.categoria.id !== categoria.id) {
            throw new BadRequestException('No se puede mover un indicador a otra categoría.');
          }
        }
      }
    }
  }

  private normalizarDecimal(valor: string): string {
    const [enteros, decimales = ''] = valor.split('.');
    return `${enteros}.${decimales.padEnd(2, '0')}`;
  }

  private lanzarConflictoUnico(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;
    const codigo = (error.driverError as { code?: string } | undefined)?.code;
    if (codigo === '23505') throw new ConflictException('El registro entra en conflicto con un identificador existente.');
    if (codigo === '23503') throw new BadRequestException('Una referencia indicada no existe o no puede modificarse.');
  }

  private lanzarErrorActivacion(error: unknown): void {
    if (!(error instanceof QueryFailedError)) return;
    const detalle = error.driverError as { code?: string; message?: string } | undefined;
    const mensaje = detalle?.message ?? '';
    if (detalle?.code === '23505' || /Ya existe una versión activa/i.test(mensaje)) {
      throw new ConflictException('Ya existe una versión activa para esta modalidad y período.');
    }
    if (/debe configurar las etapas|categorías no coinciden|indicadores no coinciden/i.test(mensaje)) {
      throw new BadRequestException('La estructura no cumple las condiciones de activación de la rúbrica.');
    }
    if (/inmutable|no puede reactivarse/i.test(mensaje)) {
      throw new ConflictException('El estado actual de la versión impide esta activación.');
    }
  }
}
