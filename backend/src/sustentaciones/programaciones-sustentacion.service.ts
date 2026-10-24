import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EstadoSustentacion } from '../comun/enums-dominio';
import { ActualizarProgramacionDto } from './dto/actualizar-programacion.dto';
import { CambiarEstadoProgramacionDto } from './dto/cambiar-estado-programacion.dto';
import { ConsultarProgramacionesDto } from './dto/consultar-programaciones.dto';
import { CrearProgramacionDto } from './dto/crear-programacion.dto';
import {
  patronBusquedaProgramacion,
  validarFechaProgramada,
  validarHoraProgramada,
  validarDuracionEstimada,
  validarSalaProgramada,
  DURACION_ESTIMADA_PREDETERMINADA_MINUTOS,
  permiteTransicionEstadoProgramacion,
} from './reglas-programacion-sustentacion';

interface FiltrosConsulta {
  carreraId?: string;
  periodoId?: string;
  estado?: EstadoSustentacion | 'COMPLETADA';
  buscar?: string;
}

interface FilaProgramacion {
  id: string;
  idTrabajo: string;
  fechaProgramada: string;
  horaProgramada: string;
  sala: string;
  duracionEstimadaMinutos: number;
  estado: EstadoSustentacion;
  inicioRealEn: Date | string | null;
  finalizacionRealEn: Date | string | null;
  creadoEn: Date | string;
  actualizadoEn: Date | string;
  codigoTrabajo: string;
  tituloTrabajo: string;
  idCarrera: string;
  codigoCarrera: string;
  nombreCarrera: string;
  idPeriodo: string;
  codigoPeriodo: string;
  estudiantes: unknown;
  tribunal: unknown;
}

interface FilaTrabajoDisponible {
  idTrabajo: string;
  codigo: string;
  titulo: string;
  idCarrera: string;
  codigoCarrera: string;
  nombreCarrera: string;
  idPeriodo: string;
  codigoPeriodo: string;
  estudiantes: unknown;
  tribunal: unknown;
}

@Injectable()
export class ProgramacionesSustentacionService {
  constructor(private readonly dataSource: DataSource) {}

  async capacidades(actorId: string, puedeAdministrar: boolean, accesoLocal = false): Promise<Record<string, boolean>> {
    if (accesoLocal) return { puedeAdministrar };
    const [cuenta] = await this.dataSource.query(`
      SELECT "id" FROM "cuentas_usuario"
      WHERE "sujeto_autenticacion" = $1 AND "esta_activo" = true
      LIMIT 1
    `, [actorId]) as Array<{ id: string }>;
    return { puedeAdministrar: puedeAdministrar && Boolean(cuenta) };
  }

  async listar(filtros: ConsultarProgramacionesDto): Promise<Record<string, unknown>> {
    const { where, parametros } = this.construirFiltros(filtros, true);
    const filas = await this.dataSource.query(`
      SELECT programacion."id",
             programacion."id_trabajo" AS "idTrabajo",
             programacion."fecha_programada"::text AS "fechaProgramada",
             to_char(programacion."hora_programada", 'HH24:MI') AS "horaProgramada",
             programacion."sala",
             programacion."duracion_estimada_minutos" AS "duracionEstimadaMinutos",
             programacion."estado",
             programacion."inicio_real_en" AS "inicioRealEn",
             programacion."finalizacion_real_en" AS "finalizacionRealEn",
             programacion."creado_en" AS "creadoEn",
             programacion."actualizado_en" AS "actualizadoEn",
             trabajo."codigo" AS "codigoTrabajo",
             trabajo."titulo" AS "tituloTrabajo",
             carrera."id" AS "idCarrera",
             carrera."codigo" AS "codigoCarrera",
             carrera."nombre" AS "nombreCarrera",
             periodo."id" AS "idPeriodo",
             periodo."codigo" AS "codigoPeriodo",
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'id', perfil."id", 'nombres', persona."nombres", 'apellidos', persona."surnames"
               ) ORDER BY integrante."orden_autoria", perfil."id")
               FROM "estudiantes_trabajo" integrante
               JOIN "perfiles_estudiante" perfil ON perfil."id" = integrante."id_estudiante"
               JOIN "personas" persona ON persona."id" = perfil."id_persona"
               WHERE integrante."id_trabajo" = trabajo."id"
             ), '[]'::jsonb) AS "estudiantes",
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'id', miembro."id", 'posicion', miembro."position",
                 'nombres', persona."nombres", 'apellidos', persona."surnames"
               ) ORDER BY miembro."position", miembro."id")
               FROM "asignaciones_tribunal" asignacion
               JOIN "miembros_tribunal" miembro ON miembro."id_asignacion" = asignacion."id"
               JOIN "perfiles_docente" docente ON docente."id" = miembro."id_docente"
               JOIN "personas" persona ON persona."id" = docente."id_persona"
               WHERE asignacion."id_trabajo" = trabajo."id" AND asignacion."estado" = 'CONFIRMADO'
             ), '[]'::jsonb) AS "tribunal"
      FROM "programaciones_sustentacion" programacion
      JOIN "trabajos_titulacion" trabajo ON trabajo."id" = programacion."id_trabajo"
      JOIN "carreras" carrera ON carrera."id" = trabajo."id_carrera"
      JOIN "periodos_academicos" periodo ON periodo."id" = trabajo."periodo_academico_id"
      ${where}
      ORDER BY programacion."fecha_programada", programacion."hora_programada", trabajo."codigo", programacion."id"
    `, parametros) as FilaProgramacion[];
    const catalogos = await this.listarCatalogos();
    return { elementos: filas.map((fila) => this.adaptarFilaProgramacion(fila)), filtros: catalogos };
  }

  async obtener(id: string): Promise<Record<string, unknown>> {
    const fila = await this.buscarFila(this.dataSource.manager, id);
    if (!fila) throw new NotFoundException('No existe la programación solicitada.');
    return this.adaptarFilaProgramacion(fila);
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
    const { where, parametros } = this.construirFiltros(filtros, false);
    const filas = await this.dataSource.query(`
      SELECT trabajo."id" AS "idTrabajo",
             trabajo."codigo",
             trabajo."titulo",
             carrera."id" AS "idCarrera",
             carrera."codigo" AS "codigoCarrera",
             carrera."nombre" AS "nombreCarrera",
             periodo."id" AS "idPeriodo",
             periodo."codigo" AS "codigoPeriodo",
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'id', perfil."id", 'nombres', persona."nombres", 'apellidos', persona."surnames"
               ) ORDER BY integrante."orden_autoria", perfil."id")
               FROM "estudiantes_trabajo" integrante
               JOIN "perfiles_estudiante" perfil ON perfil."id" = integrante."id_estudiante"
               JOIN "personas" persona ON persona."id" = perfil."id_persona"
               WHERE integrante."id_trabajo" = trabajo."id"
             ), '[]'::jsonb) AS "estudiantes",
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'id', miembro."id", 'posicion', miembro."position",
                 'nombres', persona."nombres", 'apellidos', persona."surnames"
               ) ORDER BY miembro."position", miembro."id")
               FROM "asignaciones_tribunal" asignacion
               JOIN "miembros_tribunal" miembro ON miembro."id_asignacion" = asignacion."id"
               JOIN "perfiles_docente" docente ON docente."id" = miembro."id_docente"
               JOIN "personas" persona ON persona."id" = docente."id_persona"
               WHERE asignacion."id_trabajo" = trabajo."id" AND asignacion."estado" = 'CONFIRMADO'
             ), '[]'::jsonb) AS "tribunal"
      FROM "trabajos_titulacion" trabajo
      JOIN "carreras" carrera ON carrera."id" = trabajo."id_carrera"
      JOIN "periodos_academicos" periodo ON periodo."id" = trabajo."periodo_academico_id"
      ${where}
        AND NOT EXISTS (
          SELECT 1 FROM "programaciones_sustentacion" programacion
          WHERE programacion."id_trabajo" = trabajo."id"
        )
        AND (
          SELECT count(DISTINCT evaluacion."id_miembro_tribunal")
          FROM "evaluaciones" evaluacion
          JOIN "miembros_tribunal" miembro ON miembro."id" = evaluacion."id_miembro_tribunal"
          JOIN "asignaciones_tribunal" asignacion ON asignacion."id" = miembro."id_asignacion"
          WHERE evaluacion."id_trabajo" = trabajo."id"
            AND evaluacion."etapa" = 'ESCRITA'
            AND evaluacion."estado" = 'CERRADA'
            AND asignacion."id_trabajo" = trabajo."id"
            AND asignacion."estado" = 'CONFIRMADO'
        ) = 2
      ORDER BY periodo."codigo", carrera."nombre", trabajo."codigo"
    `, parametros) as FilaTrabajoDisponible[];
    return {
      elementos: filas.map((fila) => this.adaptarFilaTrabajoDisponible(fila)),
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
        const cuentas = accesoLocal ? [] : await manager.query(`
          SELECT "id" FROM "cuentas_usuario"
          WHERE "sujeto_autenticacion" = $1 AND "esta_activo" = true
          FOR KEY SHARE
        `, [actorId]) as Array<{ id: string }>;
        const cuenta = cuentas[0];
        if (!accesoLocal && !cuenta) throw new ForbiddenException('La identidad no está vinculada a una cuenta institucional activa.');

        const [trabajo] = await manager.query(`
          SELECT "id" FROM "trabajos_titulacion" WHERE "id" = $1 FOR KEY SHARE
        `, [dto.idTrabajo]) as Array<{ id: string }>;
        if (!trabajo) throw new NotFoundException('No existe el trabajo solicitado.');

        const [programacionExistente] = await manager.query(`
          SELECT "id" FROM "programaciones_sustentacion" WHERE "id_trabajo" = $1
        `, [dto.idTrabajo]) as Array<{ id: string }>;
        if (programacionExistente) {
          throw new ConflictException('El trabajo ya tiene una programación registrada; edítela desde el cronograma.');
        }

        const [revisiones] = await manager.query(`
          SELECT count(DISTINCT evaluacion."id_miembro_tribunal")::int AS "cantidad"
          FROM "evaluaciones" evaluacion
          JOIN "miembros_tribunal" miembro ON miembro."id" = evaluacion."id_miembro_tribunal"
          JOIN "asignaciones_tribunal" asignacion ON asignacion."id" = miembro."id_asignacion"
          WHERE evaluacion."id_trabajo" = $1
            AND evaluacion."etapa" = 'ESCRITA'
            AND evaluacion."estado" = 'CERRADA'
            AND asignacion."id_trabajo" = $1
            AND asignacion."estado" = 'CONFIRMADO'
        `, [dto.idTrabajo]) as Array<{ cantidad: number }>;
        if (Number(revisiones?.cantidad ?? 0) !== 2) {
          throw new ConflictException('La sustentación requiere dos evaluaciones escritas cerradas del tribunal confirmado.');
        }

        await this.exigirSalaDisponible(manager, fecha, hora, sala, duracionEstimadaMinutos);
        const [creada] = await manager.query(`
          INSERT INTO "programaciones_sustentacion" (
            "id_trabajo", "fecha_programada", "hora_programada", "sala",
            "duracion_estimada_minutos", "scheduled_by_id_cuenta", "scheduled_by_actor_id"
          ) VALUES ($1, $2::date, $3::time, $4, $5, $6, $7)
          RETURNING "id"
        `, [dto.idTrabajo, fecha, hora, sala, duracionEstimadaMinutos, cuenta?.id ?? null, accesoLocal ? actorId : null]) as Array<{ id: string }>;
        return creada.id;
      });
      return this.obtener(id);
    } catch (error) {
      this.traducirConflictoUnico(error);
      throw error;
    }
  }

  async actualizar(id: string, dto: ActualizarProgramacionDto): Promise<Record<string, unknown>> {
    const fecha = validarFechaProgramada(dto.fechaProgramada);
    const hora = validarHoraProgramada(dto.horaProgramada);
    const sala = validarSalaProgramada(dto.sala);

    try {
      await this.dataSource.transaction('READ COMMITTED', async (manager) => {
        const [actual] = await manager.query(`
          SELECT "id", "id_trabajo" AS "idTrabajo", "estado", "duracion_estimada_minutos" AS "duracionEstimadaMinutos"
          FROM "programaciones_sustentacion" WHERE "id" = $1 FOR UPDATE
        `, [id]) as Array<{ id: string; idTrabajo: string; estado: EstadoSustentacion; duracionEstimadaMinutos: number }>;
        if (!actual) throw new NotFoundException('No existe la programación solicitada.');
        if (actual.estado !== EstadoSustentacion.PROGRAMADA) {
          throw new ConflictException('Solo se puede modificar una sustentación que permanece programada.');
        }

        const [oral] = await manager.query(`
          SELECT EXISTS (
            SELECT 1 FROM "evaluaciones" evaluacion
            LEFT JOIN "etapas_rubrica" etapa ON etapa."id" = evaluacion."id_etapa_rubrica"
            WHERE evaluacion."id_trabajo" = $1
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
        await manager.query(`
          UPDATE "programaciones_sustentacion"
          SET "fecha_programada" = $2::date,
              "hora_programada" = $3::time,
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
      const cuentas = accesoLocal ? [] : await manager.query(`
        SELECT "id" FROM "cuentas_usuario"
        WHERE "sujeto_autenticacion" = $1 AND "esta_activo" = true
        FOR KEY SHARE
      `, [actorId]) as Array<{ id: string }>;
      if (!accesoLocal && !cuentas[0]) throw new ForbiddenException('La identidad no está vinculada a una cuenta institucional activa.');

      const [actual] = await manager.query(`
        SELECT "estado" FROM "programaciones_sustentacion" WHERE "id" = $1 FOR UPDATE
      `, [id]) as Array<{ estado: EstadoSustentacion }>;
      if (!actual) throw new NotFoundException('No existe la programación solicitada.');
      if (!permiteTransicionEstadoProgramacion(actual.estado, dto.estado)) {
        throw new ConflictException(`No se permite cambiar el estado de ${actual.estado} a ${dto.estado}.`);
      }

      if (dto.estado === EstadoSustentacion.EN_SUSTENTACION) {
        await manager.query(`
          UPDATE "programaciones_sustentacion"
          SET "estado" = $2, "inicio_real_en" = clock_timestamp(), "actualizado_en" = clock_timestamp()
          WHERE "id" = $1
        `, [id, dto.estado]);
      } else if (dto.estado === EstadoSustentacion.FINALIZADA) {
        await manager.query(`
          UPDATE "programaciones_sustentacion"
          SET "estado" = $2, "finalizacion_real_en" = clock_timestamp(), "actualizado_en" = clock_timestamp()
          WHERE "id" = $1
        `, [id, dto.estado]);
      } else {
        await manager.query(`
          UPDATE "programaciones_sustentacion"
          SET "estado" = $2, "actualizado_en" = clock_timestamp()
          WHERE "id" = $1
        `, [id, dto.estado]);
      }
    });
    return this.obtener(id);
  }

  private construirFiltros(
    filtros: FiltrosConsulta,
    incluirEstado: boolean,
  ): { where: string; parametros: unknown[] } {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];
    const agregar = (condicion: (posicion: number) => string, valor: unknown) => {
      parametros.push(valor);
      condiciones.push(condicion(parametros.length));
    };

    if (filtros.carreraId) agregar((posicion) => `trabajo."id_carrera" = $${posicion}`, filtros.carreraId);
    if (filtros.periodoId) agregar((posicion) => `trabajo."periodo_academico_id" = $${posicion}`, filtros.periodoId);
    if (incluirEstado && filtros.estado) {
      const estado = filtros.estado === 'COMPLETADA' ? EstadoSustentacion.FINALIZADA : filtros.estado;
      agregar((posicion) => `programacion."estado" = $${posicion}`, estado);
    }
    const patron = patronBusquedaProgramacion(filtros.buscar);
    if (patron) {
      agregar((posicion) => `(
        concat_ws(' ', trabajo."codigo", trabajo."titulo", carrera."codigo", carrera."nombre", periodo."codigo")
          ILIKE $${posicion} ESCAPE E'\\\\'
        OR EXISTS (
          SELECT 1 FROM "estudiantes_trabajo" integrante
          JOIN "perfiles_estudiante" perfil ON perfil."id" = integrante."id_estudiante"
          JOIN "personas" persona ON persona."id" = perfil."id_persona"
          WHERE integrante."id_trabajo" = trabajo."id"
            AND concat_ws(' ', persona."nombres", persona."surnames") ILIKE $${posicion} ESCAPE E'\\\\'
        )
        OR EXISTS (
          SELECT 1 FROM "asignaciones_tribunal" asignacion
          JOIN "miembros_tribunal" miembro ON miembro."id_asignacion" = asignacion."id"
          JOIN "perfiles_docente" docente ON docente."id" = miembro."id_docente"
          JOIN "personas" persona ON persona."id" = docente."id_persona"
          WHERE asignacion."id_trabajo" = trabajo."id" AND asignacion."estado" = 'CONFIRMADO'
            AND concat_ws(' ', persona."nombres", persona."surnames") ILIKE $${posicion} ESCAPE E'\\\\'
        )
      )`, patron);
    }
    return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : 'WHERE true', parametros };
  }

  private async listarCatalogos(): Promise<Record<string, unknown>> {
    const [carreras, periodos] = await Promise.all([
      this.dataSource.query(`SELECT "id", "codigo", "nombre" FROM "carreras" ORDER BY "nombre", "id"`),
      this.dataSource.query(`SELECT "id", "codigo" FROM "periodos_academicos" ORDER BY "codigo" DESC, "id"`),
    ]);
    return { carreras, periodos };
  }

  private async buscarFila(manager: EntityManager, id: string): Promise<FilaProgramacion | null> {
    const filas = await manager.query(`
      SELECT programacion."id",
             programacion."id_trabajo" AS "idTrabajo",
             programacion."fecha_programada"::text AS "fechaProgramada",
             to_char(programacion."hora_programada", 'HH24:MI') AS "horaProgramada",
             programacion."sala",
             programacion."duracion_estimada_minutos" AS "duracionEstimadaMinutos",
             programacion."estado",
             programacion."inicio_real_en" AS "inicioRealEn",
             programacion."finalizacion_real_en" AS "finalizacionRealEn",
             programacion."creado_en" AS "creadoEn",
             programacion."actualizado_en" AS "actualizadoEn",
             trabajo."codigo" AS "codigoTrabajo",
             trabajo."titulo" AS "tituloTrabajo",
             carrera."id" AS "idCarrera",
             carrera."codigo" AS "codigoCarrera",
             carrera."nombre" AS "nombreCarrera",
             periodo."id" AS "idPeriodo",
             periodo."codigo" AS "codigoPeriodo",
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'id', perfil."id", 'nombres', persona."nombres", 'apellidos', persona."surnames"
               ) ORDER BY integrante."orden_autoria", perfil."id")
               FROM "estudiantes_trabajo" integrante
               JOIN "perfiles_estudiante" perfil ON perfil."id" = integrante."id_estudiante"
               JOIN "personas" persona ON persona."id" = perfil."id_persona"
               WHERE integrante."id_trabajo" = trabajo."id"
             ), '[]'::jsonb) AS "estudiantes",
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'id', miembro."id", 'posicion', miembro."position",
                 'nombres', persona."nombres", 'apellidos', persona."surnames"
               ) ORDER BY miembro."position", miembro."id")
               FROM "asignaciones_tribunal" asignacion
               JOIN "miembros_tribunal" miembro ON miembro."id_asignacion" = asignacion."id"
               JOIN "perfiles_docente" docente ON docente."id" = miembro."id_docente"
               JOIN "personas" persona ON persona."id" = docente."id_persona"
               WHERE asignacion."id_trabajo" = trabajo."id" AND asignacion."estado" = 'CONFIRMADO'
             ), '[]'::jsonb) AS "tribunal"
      FROM "programaciones_sustentacion" programacion
      JOIN "trabajos_titulacion" trabajo ON trabajo."id" = programacion."id_trabajo"
      JOIN "carreras" carrera ON carrera."id" = trabajo."id_carrera"
      JOIN "periodos_academicos" periodo ON periodo."id" = trabajo."periodo_academico_id"
      WHERE programacion."id" = $1
    `, [id]) as FilaProgramacion[];
    return filas[0] ?? null;
  }

  private async exigirSalaDisponible(
    manager: EntityManager,
    fecha: string,
    hora: string,
    sala: string,
    duracionEstimadaMinutos: number,
    excluirId?: string,
  ): Promise<void> {
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
      SELECT programacion."id" FROM "programaciones_sustentacion" programacion
      CROSS JOIN "solicitado"
      WHERE programacion."fecha_programada" + programacion."hora_programada" < "solicitado"."fin"
        AND "solicitado"."inicio" < programacion."fecha_programada" + programacion."hora_programada"
          + make_interval(mins => programacion."duracion_estimada_minutos")
        AND lower(btrim(programacion."sala")) = lower(btrim($3))
        AND programacion."estado" <> 'CANCELADA'
        AND ($5::uuid IS NULL OR programacion."id" <> $5::uuid)
      LIMIT 1
    `, [fecha, hora, sala, duracionEstimadaMinutos, excluirId ?? null]) as Array<{ id: string }>;
    if (conflicto) {
      throw new ConflictException('La sala ya tiene una sustentación cuyo intervalo se solapa con el horario solicitado.');
    }
  }

  private adaptarFilaProgramacion(fila: FilaProgramacion): Record<string, unknown> {
    return {
      id: fila.id,
      idTrabajo: fila.idTrabajo,
      fechaProgramada: fila.fechaProgramada,
      horaProgramada: fila.horaProgramada,
      sala: fila.sala,
      duracionEstimadaMinutos: Number(fila.duracionEstimadaMinutos),
      estado: fila.estado,
      inicioRealEn: fila.inicioRealEn,
      finalizacionRealEn: fila.finalizacionRealEn,
      creadoEn: fila.creadoEn,
      actualizadoEn: fila.actualizadoEn,
      trabajo: { id: fila.idTrabajo, codigo: fila.codigoTrabajo, titulo: fila.tituloTrabajo },
      carrera: { id: fila.idCarrera, codigo: fila.codigoCarrera, nombre: fila.nombreCarrera },
      periodo: { id: fila.idPeriodo, codigo: fila.codigoPeriodo },
      estudiantes: this.arrayJson(fila.estudiantes),
      tribunal: this.arrayJson(fila.tribunal),
    };
  }

  private adaptarFilaTrabajoDisponible(fila: FilaTrabajoDisponible): Record<string, unknown> {
    return {
      idTrabajo: fila.idTrabajo,
      trabajo: { id: fila.idTrabajo, codigo: fila.codigo, titulo: fila.titulo },
      carrera: { id: fila.idCarrera, codigo: fila.codigoCarrera, nombre: fila.nombreCarrera },
      periodo: { id: fila.idPeriodo, codigo: fila.codigoPeriodo },
      estudiantes: this.arrayJson(fila.estudiantes),
      tribunal: this.arrayJson(fila.tribunal),
    };
  }

  private arrayJson(valor: unknown): unknown[] {
    if (Array.isArray(valor)) return valor;
    if (typeof valor === 'string') {
      try {
        const analizado: unknown = JSON.parse(valor);
        return Array.isArray(analizado) ? analizado : [];
      } catch {
        return [];
      }
    }
    return [];
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
