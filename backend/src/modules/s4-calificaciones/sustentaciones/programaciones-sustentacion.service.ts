import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TrabajoMer, TrabajosService } from '../trabajos/trabajos.service';
import { EstadoSustentacion } from '../../../common/domain/enums-dominio';
import { ActualizarProgramacionDto } from './dto/actualizar-programacion.dto';
import { establecerActorAuditoria } from '../auditoria/contexto-auditoria';
import { CambiarEstadoProgramacionDto } from './dto/cambiar-estado-programacion.dto';
import { ConsultarProgramacionesDto } from './dto/consultar-programaciones.dto';
import { CrearProgramacionDto } from './dto/crear-programacion.dto';
import {
  validarFechaProgramada,
  validarHoraProgramada,
  validarDuracionEstimada,
  validarSalaProgramada,
  DURACION_ESTIMADA_PREDETERMINADA_MINUTOS,
  permiteTransicionEstadoProgramacion,
} from './reglas-programacion-sustentacion';

@Injectable()
export class ProgramacionesSustentacionService {
  constructor(private readonly dataSource: DataSource, private readonly trabajos: TrabajosService) {}

  async capacidades(actorId: string, puedeAdministrar: boolean, accesoLocal = false): Promise<Record<string, boolean>> {
    if (accesoLocal) return { puedeAdministrar };
    const [cuenta] = await this.dataSource.query(`
      SELECT "id" FROM gen.usuario
      WHERE "sujeto_autenticacion" = $1 AND "activo" = true
      LIMIT 1
    `, [actorId]) as Array<{ id: string }>;
    return { puedeAdministrar: puedeAdministrar && Boolean(cuenta) };
  }

  async listar(filtros: ConsultarProgramacionesDto): Promise<Record<string, unknown>> {
    const trabajos = await this.trabajos.consultar(null);
    const estado = filtros.estado === 'COMPLETADA' ? EstadoSustentacion.FINALIZADA : filtros.estado;
    const elementos = trabajos.filter((trabajo) => this.coincide(trabajo, filtros))
      .flatMap((trabajo) => trabajo.sesiones
        .filter((sesion) => !estado || (sesion.estado === 'COMPLETADA' ? 'FINALIZADA' : sesion.estado) === estado)
        .map((sesion) => this.programacion(trabajo, sesion)))
      .sort((a, b) => a.fechaProgramada.localeCompare(b.fechaProgramada)
        || a.horaProgramada.localeCompare(b.horaProgramada) || a.id.localeCompare(b.id));
    return { elementos, filtros: await this.listarCatalogos() };
  }

  async obtener(id: string): Promise<Record<string, unknown>> {
    const [relacion] = await this.dataSource.query(`
      SELECT p.asignacion_tema_id AS "idTrabajo"
      FROM s4.programaciones_sustentacion s
      JOIN s4.procesos_evaluacion p ON p.id = s.id_proceso_evaluacion AND p.estado_registro = 1
      WHERE s.id = $1 AND s.estado_registro = 1
    `, [id]);
    const [trabajo] = relacion ? await this.trabajos.consultar(relacion.idTrabajo) : [];
    const sesion = trabajo?.sesiones.find((item) => item.id === id);
    if (!sesion) throw new NotFoundException('No existe la programación solicitada.');
    return this.programacion(trabajo, sesion);
  }

  async listarParaImpresion(filtros: ConsultarProgramacionesDto): Promise<Record<string, unknown>> {
    const resultado = await this.listar(filtros);
    return {
      generadoEn: new Date().toISOString(),
      criterios: {
        carreraId: filtros.carreraId ?? null,
        periodoId: filtros.periodoId ?? null,
        estado: filtros.estado === 'COMPLETADA' ? EstadoSustentacion.FINALIZADA : filtros.estado ?? null,
        buscar: filtros.buscar?.trim() || null,
      },
      ...resultado,
    };
  }

  async trabajosDisponibles(filtros: ConsultarProgramacionesDto): Promise<Record<string, unknown>> {
    const [trabajos, programacionesOcultas] = await Promise.all([
      this.trabajos.consultar(null),
      this.dataSource.query(`
        SELECT DISTINCT proceso.asignacion_tema_id AS "idTrabajo"
        FROM s4.programaciones_sustentacion programacion
        JOIN s4.procesos_evaluacion proceso
          ON proceso.id = programacion.id_proceso_evaluacion AND proceso.estado_registro = 1
        WHERE programacion.estado_registro = 0
      `) as Promise<Array<{ idTrabajo: string }>>,
    ]);
    const trabajosConProgramacionOculta = new Set(programacionesOcultas.map(({ idTrabajo }) => idTrabajo));
    return {
      elementos: trabajos.filter((t) => this.coincide(t, filtros) && t.procesoId
        && t.sesiones.length === 0 && !trabajosConProgramacionOculta.has(t.id)
        && t.evaluadoresAsignados === 2 && t.escritasCerradas === 2)
        .map((trabajo) => this.contexto(trabajo)),
      filtros: await this.listarCatalogos(),
    };
  }

  async crear(dto: CrearProgramacionDto, actorId: string, accesoLocal = false): Promise<Record<string, unknown>> {
    const fecha = validarFechaProgramada(dto.fechaProgramada);
    const hora = validarHoraProgramada(dto.horaProgramada);
    const sala = validarSalaProgramada(dto.sala);
    const duracionEstimadaMinutos = validarDuracionEstimada(
      dto.duracionEstimadaMinutos ?? DURACION_ESTIMADA_PREDETERMINADA_MINUTOS,
    );

    try {
      const id = await this.dataSource.transaction('READ COMMITTED', async (manager) => {
        await establecerActorAuditoria(manager, actorId);
        const cuentas = accesoLocal ? [] : await manager.query(`
          SELECT "id" FROM gen.usuario
          WHERE "sujeto_autenticacion" = $1 AND "activo" = true
        `, [actorId]) as Array<{ id: string }>;
        const cuenta = cuentas[0];
        if (!accesoLocal && !cuenta) throw new ForbiddenException('La identidad no está vinculada a una cuenta institucional activa.');

        const [proceso] = await manager.query(`
          SELECT p.id FROM s4.procesos_evaluacion p
          JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id AND a.estado = 'VIGENTE'
          WHERE a.id = $1 AND p.estado_registro = 1 FOR UPDATE OF p
        `, [dto.idTrabajo]);
        if (!proceso) throw new NotFoundException('No existe un proceso vigente para el trabajo solicitado.');

        const [trabajo] = await manager.query(`
          SELECT
            (SELECT count(*)::int FROM s3.asignacion_tribunal WHERE asignacion_tema_id = $2) AS tribunal,
            (SELECT count(DISTINCT e.id_asignacion_tribunal)::int FROM s4.evaluaciones e
              JOIN s3.asignacion_tribunal a ON a.asignacion_tribunal_id = e.id_asignacion_tribunal
              JOIN s4.procesos_evaluacion p ON p.id = e.id_proceso_evaluacion
              WHERE p.id = $1 AND a.asignacion_tema_id = $2 AND e.id_version_rubrica = p.id_version_rubrica
                AND e.estado_registro = 1 AND e.etapa = 'ESCRITA' AND e.estado = 'CERRADA') AS cerradas,
            EXISTS (SELECT 1 FROM s4.programaciones_sustentacion WHERE id_proceso_evaluacion = $1) AS programada
        `, [proceso.id, dto.idTrabajo]);
        if (trabajo.programada) {
          throw new ConflictException('El trabajo ya tiene una programación registrada; edítela desde el cronograma.');
        }
        if (trabajo.tribunal !== 2 || trabajo.cerradas !== 2) {
          throw new ConflictException('La sustentación requiere dos evaluaciones escritas cerradas del tribunal asignado.');
        }

        await this.exigirSalaDisponible(manager, fecha, hora, sala, duracionEstimadaMinutos);
        const [creada] = await manager.query(`
          INSERT INTO s4.programaciones_sustentacion (
            id_proceso_evaluacion, fecha_programada, hora_programada, hora_fin_programada, sala,
            duracion_estimada_minutos, scheduled_by_id_cuenta, scheduled_by_actor_id, estado, tipo
          ) VALUES ($1, $2::date, $3::time, $3::time + make_interval(mins => $5::int), $4, $5, $6, $7,
            'PROGRAMADA', CASE WHEN (SELECT grupo_id FROM s2.asignacion_tema WHERE id = $8) IS NULL
              THEN 'INDIVIDUAL' ELSE 'CONJUNTA' END)
          RETURNING "id"
        `, [proceso.id, fecha, hora, sala, duracionEstimadaMinutos, cuenta?.id ?? null, accesoLocal ? actorId : null, dto.idTrabajo]) as Array<{ id: string }>;
        const participantes = await manager.query(`
          INSERT INTO s4.programacion_estudiante (programacion_sustentacion_id, id_estudiante)
          SELECT $1, e.id FROM gen.estudiante e
          WHERE s4.estudiante_pertenece_asignacion($2, e.id)
          RETURNING id_estudiante
        `, [creada.id, dto.idTrabajo]);
        if (!participantes.length) throw new ConflictException('El trabajo no tiene estudiantes asignados.');
        return creada.id;
      });
      return this.obtener(id);
    } catch (error) {
      this.traducirConflictoUnico(error);
      throw error;
    }
  }

  async actualizar(id: string, dto: ActualizarProgramacionDto, actorId: string): Promise<Record<string, unknown>> {
    const fecha = validarFechaProgramada(dto.fechaProgramada);
    const hora = validarHoraProgramada(dto.horaProgramada);
    const sala = validarSalaProgramada(dto.sala);

    try {
      await this.dataSource.transaction('READ COMMITTED', async (manager) => {
        await establecerActorAuditoria(manager, actorId);
        await manager.query(`
          SELECT p.id FROM s4.procesos_evaluacion p
          JOIN s4.programaciones_sustentacion s ON s.id_proceso_evaluacion = p.id
          WHERE s.id = $1 AND s.estado_registro = 1 AND p.estado_registro = 1 FOR UPDATE OF p
        `, [id]);
        const [actual] = await manager.query(`
          SELECT "id", id_proceso_evaluacion AS "idTrabajo", "estado", "duracion_estimada_minutos" AS "duracionEstimadaMinutos"
          FROM s4.programaciones_sustentacion WHERE "id" = $1 AND estado_registro = 1 FOR UPDATE
        `, [id]) as Array<{ id: string; idTrabajo: string; estado: EstadoSustentacion; duracionEstimadaMinutos: number }>;
        if (!actual) throw new NotFoundException('No existe la programación solicitada.');
        if (actual.estado !== EstadoSustentacion.PROGRAMADA) {
          throw new ConflictException('Solo se puede modificar una sustentación que permanece programada.');
        }

        const [oral] = await manager.query(`
          SELECT EXISTS (
            SELECT 1 FROM s4.evaluaciones evaluacion
            LEFT JOIN s4.etapas_rubrica etapa ON etapa."id" = evaluacion."id_etapa_rubrica"
            WHERE evaluacion.id_proceso_evaluacion = $1
              AND (evaluacion."etapa" = 'ORAL' OR etapa."kind" = 'ORAL')
          ) AS "iniciada"
        `, [actual.idTrabajo]) as Array<{ iniciada: boolean }>;
        if (oral?.iniciada) {
          throw new ConflictException('No se puede cambiar la programación después de iniciar una evaluación oral.');
        }

        const duracionEstimadaMinutos = dto.duracionEstimadaMinutos === undefined
          ? actual.duracionEstimadaMinutos
          : validarDuracionEstimada(dto.duracionEstimadaMinutos);
        await this.exigirSalaDisponible(manager, fecha, hora, sala, duracionEstimadaMinutos, actual.id);
        await manager.query("SELECT set_config('genares.actor_id', $1, true)", [actorId]);
        await manager.query(`
          UPDATE s4.programaciones_sustentacion
          SET "fecha_programada" = $2::date,
              "hora_programada" = $3::time,
              hora_fin_programada = $3::time + make_interval(mins => $5::int),
              "sala" = $4,
              "duracion_estimada_minutos" = $5,
              "actualizado_en" = clock_timestamp()
          WHERE "id" = $1
        `, [actual.id, fecha, hora, sala, duracionEstimadaMinutos]);
      });
      return this.obtener(id);
    } catch (error) {
      this.traducirConflictoUnico(error);
      throw error;
    }
  }

  async cambiarEstado(
    id: string,
    dto: CambiarEstadoProgramacionDto,
    actorId: string,
    accesoLocal = false,
  ): Promise<Record<string, unknown>> {
    await this.dataSource.transaction(async (manager) => {
      await establecerActorAuditoria(manager, actorId);
      const cuentas = accesoLocal ? [] : await manager.query(`
        SELECT "id" FROM gen.usuario
        WHERE "sujeto_autenticacion" = $1 AND "activo" = true
      `, [actorId]) as Array<{ id: string }>;
      if (!accesoLocal && !cuentas[0]) throw new ForbiddenException('La identidad no está vinculada a una cuenta institucional activa.');

      const [actual] = await manager.query(`
        SELECT "estado" FROM s4.programaciones_sustentacion
        WHERE "id" = $1 AND estado_registro = 1 FOR UPDATE
      `, [id]) as Array<{ estado: EstadoSustentacion }>;
      if (!actual) throw new NotFoundException('No existe la programación solicitada.');
      if (!permiteTransicionEstadoProgramacion(actual.estado, dto.estado)) {
        throw new ConflictException(`No se permite cambiar el estado de ${actual.estado} a ${dto.estado}.`);
      }

      await manager.query("SELECT set_config('genares.actor_id', $1, true)", [actorId]);
      await manager.query(`
        UPDATE s4.programaciones_sustentacion
        SET estado = $2, actualizado_en = clock_timestamp()
        WHERE id = $1
      `, [id, dto.estado]);
    });
    return this.obtener(id);
  }

  private coincide(trabajo: TrabajoMer, filtros: ConsultarProgramacionesDto): boolean {
    const texto = filtros.buscar?.trim().toLocaleLowerCase('es');
    return (!filtros.carreraId || filtros.carreraId === trabajo.idCarrera)
      && (!filtros.periodoId || filtros.periodoId === trabajo.idPeriodo)
      && (!texto || [trabajo.codigo, trabajo.titulo, trabajo.carrera, trabajo.codigoCarrera, trabajo.periodo,
        ...trabajo.estudiantes.map((p) => p.nombre), ...trabajo.evaluadores.map((p) => p.nombre)]
        .join(' ').toLocaleLowerCase('es').includes(texto));
  }

  private async listarCatalogos(): Promise<Record<string, unknown>> {
    const [carreras, periodos] = await Promise.all([
      this.dataSource.query('SELECT id, codigo, nombre FROM gen.carrera ORDER BY nombre, id'),
      this.dataSource.query('SELECT id, codigo FROM gen.periodo_academico ORDER BY codigo DESC, id'),
    ]);
    return { carreras, periodos };
  }

  private contexto(trabajo: TrabajoMer) {
    return {
      idTrabajo: trabajo.id,
      trabajo: { id: trabajo.id, codigo: trabajo.codigo, titulo: trabajo.titulo },
      carrera: { id: trabajo.idCarrera, codigo: trabajo.codigoCarrera, nombre: trabajo.carrera },
      periodo: { id: trabajo.idPeriodo, codigo: trabajo.periodo },
      estadoRegistro: trabajo.estadoRegistro ?? 1,
      estudiantes: trabajo.estudiantes,
      tribunal: trabajo.evaluadores.map((evaluador, indice) => ({ ...evaluador, posicion: indice + 1 })),
    };
  }

  private programacion(trabajo: TrabajoMer, sesion: TrabajoMer['sesiones'][number]) {
    return {
      ...this.contexto(trabajo),
      id: sesion.id,
      fechaProgramada: sesion.fecha,
      horaProgramada: sesion.inicio,
      horaFinProgramada: sesion.fin,
      sala: sesion.sala,
      tipo: sesion.tipo,
      estado: sesion.estado,
      estadoRegistro: sesion.estadoRegistro ?? 1,
      duracionEstimadaMinutos: sesion.duracionEstimadaMinutos,
      creadoEn: sesion.creadoEn,
      actualizadoEn: sesion.actualizadoEn,
      inicioRealEn: sesion.inicioRealEn,
      finalizacionRealEn: sesion.finalizacionRealEn,
      estudiantes: trabajo.estudiantes.filter((e) => sesion.participantes.includes(e.id)),
    };
  }

  private async exigirSalaDisponible(
    manager: EntityManager,
    fecha: string,
    hora: string,
    sala: string,
    duracionEstimadaMinutos: number,
    excluirId?: string,
  ): Promise<void> {
    const [horas, minutos] = hora.split(':').map(Number);
    if (horas * 60 + minutos + duracionEstimadaMinutos >= 1440) {
      throw new ConflictException('La sustentación debe terminar el mismo día.');
    }
    // Serializa las escrituras de una misma sala. La consulta de solapamiento
    // va en una sentencia posterior, con una instantánea READ COMMITTED nueva.
    // Una colisión del hash solo serializa salas extra; no afecta la integridad.
    await manager.query(`
      SELECT pg_advisory_xact_lock(hashtext(lower(btrim($1::text))))
    `, [sala]);

    const [conflicto] = await manager.query(`
      WITH "solicitado" AS (
        SELECT ($1::date + $2::time) AS "inicio",
               ($1::date + $2::time + make_interval(mins => $4::int)) AS "fin"
      )
      SELECT programacion."id" FROM s4.programaciones_sustentacion programacion
      CROSS JOIN "solicitado"
      WHERE programacion."fecha_programada" + programacion."hora_programada" < "solicitado"."fin"
        AND "solicitado"."inicio" < programacion.fecha_programada + programacion.hora_fin_programada
        AND lower(btrim(programacion."sala")) = lower(btrim($3))
        AND programacion.estado_registro = 1
        AND programacion."estado" <> 'CANCELADA'
        AND ($5::uuid IS NULL OR programacion."id" <> $5::uuid)
      LIMIT 1
    `, [fecha, hora, sala, duracionEstimadaMinutos, excluirId ?? null]) as Array<{ id: string }>;
    if (conflicto) {
      throw new ConflictException('La sala ya tiene una sustentación cuyo intervalo se solapa con el horario solicitado.');
    }
  }

  private traducirConflictoUnico(error: unknown): void {
    const errorDb = error as { code?: string; constraint?: string; driverError?: { code?: string; constraint?: string } };
    const codigo = errorDb.driverError?.code ?? errorDb.code;
    const constraint = errorDb.driverError?.constraint ?? errorDb.constraint;
    if (codigo === '23P01') {
      throw new ConflictException('La sala ya tiene una sustentación cuyo intervalo se solapa con el horario solicitado.');
    }
    if (codigo !== '23505') return;
    if (constraint === 'uq_programaciones_sustentacion_sala_instante_vigente') {
      throw new ConflictException('La sala ya tiene una sustentación cuyo intervalo se solapa con el horario solicitado.');
    }
    if (constraint === 'uq_programaciones_sustentacion_work') {
      throw new ConflictException('El trabajo ya tiene una programación registrada; edítela desde el cronograma.');
    }
    throw new ConflictException('La programación entra en conflicto con un registro existente.');
  }
}
