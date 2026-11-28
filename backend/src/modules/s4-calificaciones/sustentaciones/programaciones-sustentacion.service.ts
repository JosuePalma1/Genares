import { evaluarProgramacion } from '../configuracion/flujo.reglas';
import { flujoDelProceso, trabajoEn } from '../configuracion/flujo-proceso';
import { conAlcance, filtroAlcance, hayRestriccionDeAlcance } from '../../../common/api/contexto-alcance';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { TEXTO_BUSCABLE_TRABAJO, TrabajoMer, TrabajosService } from '../trabajos/trabajos.service';
import { leerPaginacion, normalizarBusqueda, normalizarSql } from '../trabajos/paginacion-trabajos';
import { EstadoSustentacion } from '../../../common/domain/enums-dominio';
import { ActualizarProgramacionDto } from './dto/actualizar-programacion.dto';
import { establecerActorAuditoria } from '../auditoria/contexto-auditoria';
import { CambiarEstadoProgramacionDto } from './dto/cambiar-estado-programacion.dto';
import { ConsultarProgramacionesDto, TODOS_LOS_PERIODOS_PROGRAMACION } from './dto/consultar-programaciones.dto';
import { CrearProgramacionDto } from './dto/crear-programacion.dto';
import { ConsultarDisponibilidadSalaDto } from './dto/horario-sala.dto';
import { CONSULTA_LIMITE_SIMULTANEAS, LIMITE_SIMULTANEAS_PREDETERMINADO } from './limite-programacion.sql';
import {
  validarFechaProgramada,
  validarHoraProgramada,
  validarDuracionEstimada,
  validarSalaProgramada,
  DURACION_ESTIMADA_PREDETERMINADA_MINUTOS,
  permiteTransicionEstadoProgramacion,
  elegirParticipantesSesion,
  EstudianteProgramable,
  validarMotivoReprogramacion,
  HorarioProgramacion,
  validarHorarioProgramacion,
} from './reglas-programacion-sustentacion';

// t es el tema de la asignación. Se usa la política vigente para sesiones nuevas y existentes.
const HORARIO_PROGRAMACION_VIGENTE = `(
  SELECT to_jsonb(f)->'horario_programacion' FROM s4.version_flujo f
  WHERE (f.carrera IS NULL OR f.carrera = t.carrera_id)
    AND (f.modalidad IS NULL OR f.modalidad = t.modalidad_id)
    AND (f.periodo IS NULL OR f.periodo = t.periodo_academico_id)
    AND (to_jsonb(f)->'horario_programacion') IS NOT NULL
    AND (to_jsonb(f)->'horario_programacion') <> 'null'::jsonb
  ORDER BY num_nonnulls(f.carrera, f.modalidad, f.periodo) DESC, f.version DESC
  LIMIT 1
)`;
const MENSAJE_SALA_OCUPADA = 'La sala ya tiene una sustentación cuyo intervalo se solapa con el horario solicitado.';

/**
 * Trabajos vigentes con proceso visible: mismos filtros de visibilidad que CONSULTA_TRABAJOS_MER.
 * $1 carrera · $2 periodo · $3 búsqueda normalizada (como la de Trabajos, más el código de carrera).
 */
/**
 * Estudiantes de una asignación según S2 (misma regla que s4.estudiante_pertenece_asignacion) que
 * aún no figuran en ninguna programación del proceso, aunque esté cancelada u oculta: es el criterio
 * que antes se aplicaba al trabajo completo, ahora por estudiante (RN-28).
 */
function estudiantesSinProgramacion(asignacion: string, proceso: string): string {
  return `
SELECT estudiante.id FROM (
  SELECT ai.estudiante_id AS id FROM s2.asignacion_tema ai
  WHERE ai.id = ${asignacion} AND ai.estudiante_id IS NOT NULL
  UNION
  SELECT gi.estudiante_id FROM s2.asignacion_tema ag
  JOIN s2.grupo_integrante gi ON gi.grupo_id = ag.grupo_id AND gi.estado = 'ACTIVO'
  WHERE ag.id = ${asignacion}
) estudiante
WHERE NOT EXISTS (
  SELECT 1 FROM s4.programacion_estudiante pe_prev
  JOIN s4.programaciones_sustentacion ps_prev ON ps_prev.id = pe_prev.programacion_sustentacion_id
  WHERE ps_prev.id_proceso_evaluacion = ${proceso} AND pe_prev.id_estudiante = estudiante.id)`;
}

const FILTRO_TRABAJOS_PROGRAMACION = `
FROM s2.asignacion_tema a
JOIN gen.tema t ON t.id = a.tema_id
JOIN s4.procesos_evaluacion p ON p.asignacion_tema_id = a.id AND p.estado_registro = 1
LEFT JOIN s4.versiones_rubrica vr ON vr.id = p.id_version_rubrica AND vr.estado_registro = 1
LEFT JOIN s4.rubricas r ON r.id = vr.id_rubrica AND r.estado_registro = 1
LEFT JOIN gen.carrera c ON c.id = t.carrera_id
LEFT JOIN gen.periodo_academico pa ON pa.id = t.periodo_academico_id
LEFT JOIN gen.modalidad m ON m.id = t.modalidad_id
WHERE a.estado = 'VIGENTE'
  AND (p.id_version_rubrica IS NULL OR vr.id IS NOT NULL)
  AND (vr.id_rubrica IS NULL OR r.id IS NOT NULL)
  AND ($1::uuid IS NULL OR t.carrera_id = $1::uuid)
  AND ($2::uuid IS NULL OR t.periodo_academico_id = $2::uuid)
  -- RF-03 a RF-05: carreras del usuario o, si es tribunal, solo sus sesiones («Mis sustentaciones»).
  ${filtroAlcance()}
`;
const COINCIDE_BUSQUEDA_TRABAJO = `($3::text IS NULL
  OR strpos(${TEXTO_BUSCABLE_TRABAJO}, $3::text) > 0
  OR strpos(lower(COALESCE(c.codigo, '')), $3::text) > 0)`;

/**
 * Programaciones visibles filtradas y ordenadas en PostgreSQL (fecha, hora, id).
 * $4 estado (COMPLETADA se trata como FINALIZADA) · $5 límite (NULL = todas) · $6 desplazamiento.
 */
export const CONSULTA_PROGRAMACIONES = `
WITH trabajos AS (
  SELECT a.id AS "idTrabajo", p.id AS "idProceso", ${HORARIO_PROGRAMACION_VIGENTE} AS horario,
    ${COINCIDE_BUSQUEDA_TRABAJO} AS coincide
  ${FILTRO_TRABAJOS_PROGRAMACION}
), sesiones AS (
  SELECT ses.id, trabajos."idTrabajo", trabajos.horario, ses.fecha_programada AS fecha,
    TO_CHAR(ses.hora_programada, 'HH24:MI') AS hora,
    CASE WHEN ses.estado::text = 'COMPLETADA' THEN 'FINALIZADA' ELSE ses.estado::text END AS estado,
    CASE
      WHEN ses.estado::text IN ('COMPLETADA', 'FINALIZADA') THEN 'FINALIZADA'
      WHEN ses.estado::text = 'EN_SUSTENTACION'
        OR (ses.estado::text = 'PROGRAMADA'
          AND ses.fecha_programada + ses.hora_programada <= statement_timestamp() AT TIME ZONE 'America/Guayaquil')
        THEN 'EN_CURSO_O_PENDIENTE'
      ELSE ses.estado::text
    END AS "estadoCronograma"
  FROM trabajos
  JOIN s4.programaciones_sustentacion ses ON ses.id_proceso_evaluacion = trabajos."idProceso" AND ses.estado_registro = 1
  WHERE trabajos.coincide OR strpos(${normalizarSql('ses.sala')}, $3::text) > 0
), filtradas AS (
  SELECT * FROM sesiones
  WHERE $4::text IS NULL OR CASE $4::text
    WHEN 'PROXIMA' THEN "estadoCronograma" = 'PROGRAMADA'
    WHEN 'EN_CURSO_O_PENDIENTE' THEN "estadoCronograma" = 'EN_CURSO_O_PENDIENTE'
    ELSE estado = $4::text
  END
)
SELECT
  (SELECT count(*)::integer FROM filtradas) AS total,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('id', pagina.id, 'idTrabajo', pagina."idTrabajo",
    'horarioProgramacion', pagina.horario, 'estadoCronograma', pagina."estadoCronograma")
    ORDER BY pagina.fecha, pagina.hora, pagina.id::text) FROM (
      SELECT id, "idTrabajo", horario, "estadoCronograma", fecha, hora
      FROM filtradas ORDER BY fecha, hora, id::text LIMIT $5 OFFSET $6
    ) pagina), '[]'::jsonb) AS filas
`;

/**
 * Candidatos a una nueva programación: con algún estudiante aún sin programación (visible u oculta)
 * y con dos miembros de tribunal. `pendientes` son esos estudiantes.
 */
export const CONSULTA_TRABAJOS_DISPONIBLES = `
SELECT a.id, ARRAY(${estudiantesSinProgramacion('a.id', 'p.id')} ORDER BY 1) AS pendientes,
  ${HORARIO_PROGRAMACION_VIGENTE} AS "horarioProgramacion"
${FILTRO_TRABAJOS_PROGRAMACION}
  AND ${COINCIDE_BUSQUEDA_TRABAJO}
  AND EXISTS (${estudiantesSinProgramacion('a.id', 'p.id')})
  AND EXISTS (SELECT 1 FROM s3.asignacion_tribunal at WHERE at.asignacion_tema_id = a.id)
`;

/** Estudiantes de la asignación con su marca de programación ($1 asignación · $2 proceso). */
export const CONSULTA_ESTUDIANTES_PROGRAMABLES = `
SELECT estudiante.id, estudiante.id NOT IN (${estudiantesSinProgramacion('$1::uuid', '$2::uuid')}) AS programado
FROM (
  SELECT ai.estudiante_id AS id FROM s2.asignacion_tema ai
  WHERE ai.id = $1::uuid AND ai.estudiante_id IS NOT NULL
  UNION
  SELECT gi.estudiante_id FROM s2.asignacion_tema ag
  JOIN s2.grupo_integrante gi ON gi.grupo_id = ag.grupo_id AND gi.estado = 'ACTIVO'
  WHERE ag.id = $1::uuid
) estudiante
ORDER BY estudiante.id
`;

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

  /**
   * Filtra en PostgreSQL y solo arma el detalle de los trabajos necesarios. Con `limite` devuelve
   * una página (por defecto del periodo activo); sin él, la lista completa como antes.
   */
  async listar(filtros: ConsultarProgramacionesDto): Promise<Record<string, unknown>> {
    const paginado = filtros.limite !== undefined;
    const periodoId = paginado ? await this.periodoDelListado(filtros.periodoId) : this.periodoExplicito(filtros.periodoId);
    const { limite, pagina, desplazamiento } = paginado
      ? leerPaginacion(filtros.limite, filtros.pagina)
      : { limite: null, pagina: 1, desplazamiento: 0 };
    const estado = filtros.estado === 'COMPLETADA' ? EstadoSustentacion.FINALIZADA : filtros.estado ?? null;
    const [[{ total, filas }], catalogos] = await Promise.all([
      this.dataSource.query(...conAlcance(CONSULTA_PROGRAMACIONES, [
        filtros.carreraId ?? null, periodoId, normalizarBusqueda(filtros.buscar), estado, limite, desplazamiento,
      ])) as Promise<Array<{ total: number; filas: Array<{
        id: string; idTrabajo: string; horarioProgramacion?: HorarioProgramacion | null; estadoCronograma: string;
      }> }>>,
      this.listarCatalogos(),
    ]);
    const idsTrabajo = [...new Set(filas.map(({ idTrabajo }) => idTrabajo))];
    const trabajos = new Map((idsTrabajo.length ? await this.trabajos.consultar(null, idsTrabajo) : [])
      .map((trabajo) => [trabajo.id, trabajo]));
    const elementos = filas.flatMap(({ id, idTrabajo, horarioProgramacion, estadoCronograma }) => {
      const trabajo = trabajos.get(idTrabajo);
      const sesion = trabajo?.sesiones.find((item) => item.id === id);
      return trabajo && sesion ? [{ ...this.programacion(trabajo, sesion), horarioProgramacion, estadoCronograma }] : [];
    });
    if (!paginado || limite === null) return { elementos, filtros: catalogos };
    return {
      elementos,
      filtros: catalogos,
      periodoAplicado: periodoId,
      paginacion: { pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)) },
    };
  }

  /** Periodo del listado paginado: el pedido, `TODOS` (ninguno) o, si se omite, el activo. */
  private async periodoDelListado(solicitado?: string): Promise<string | null> {
    if (solicitado) return this.periodoExplicito(solicitado);
    const [activo] = await this.dataSource.query(`
      SELECT id FROM gen.periodo_academico WHERE activo
      ORDER BY fecha_inicio DESC NULLS LAST, codigo DESC LIMIT 1
    `) as Array<{ id: string }>;
    return activo?.id ?? null;
  }

  private periodoExplicito(solicitado?: string): string | null {
    return solicitado && solicitado !== TODOS_LOS_PERIODOS_PROGRAMACION ? solicitado : null;
  }

  /** Usuarios con ámbito (demostración): solo programan trabajos de sus carreras. */
  private async exigirTrabajoEnAlcance(idTrabajo: string): Promise<void> {
    if (!hayRestriccionDeAlcance()) return;
    const [trabajo] = await this.trabajos.consultar(idTrabajo);
    if (!trabajo) throw new NotFoundException('No existe el trabajo solicitado.');
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
    // El documento impreso incluye todas las programaciones filtradas, no una página.
    const resultado = await this.listar({ ...filtros, limite: undefined, pagina: undefined });
    return {
      generadoEn: new Date().toISOString(),
      criterios: {
        carreraId: filtros.carreraId ?? null,
        periodoId: this.periodoExplicito(filtros.periodoId),
        estado: filtros.estado === 'COMPLETADA' ? EstadoSustentacion.FINALIZADA : filtros.estado ?? null,
        buscar: filtros.buscar?.trim() || null,
      },
      ...resultado,
    };
  }

  async trabajosDisponibles(filtros: ConsultarProgramacionesDto, rol = ''): Promise<Record<string, unknown>> {
    // PostgreSQL descarta los trabajos con todos sus estudiantes programados (incluso en programaciones
    // ocultas) o sin tribunal completo; la regla de elegibilidad se vuelve a comprobar sobre el detalle.
    const [candidatos, catalogos] = await Promise.all([
      this.dataSource.query(...conAlcance(CONSULTA_TRABAJOS_DISPONIBLES, [
        filtros.carreraId ?? null, this.periodoExplicito(filtros.periodoId), normalizarBusqueda(filtros.buscar),
      ])) as Promise<Array<{ id: string; pendientes?: string[]; horarioProgramacion?: HorarioProgramacion | null }>>,
      this.listarCatalogos(),
    ]);
    const porId = new Map(candidatos.map((candidato) => [candidato.id, candidato]));
    const trabajos = candidatos.length ? await this.trabajos.consultar(null, candidatos.map(({ id }) => id)) : [];
    const disponibles = [];
    const politicas = new Map<string, ReturnType<typeof evaluarProgramacion>>();
    for (const t of trabajos) {
      if (!t.procesoId || !t.evaluadoresAsignados) continue;
      if (Number(t.versionFlujo) > 1) {
        const flujo = await flujoDelProceso(this.dataSource.manager, t, rol, '');
        const politica = evaluarProgramacion(flujo.pasos, rol);
        if (politica.impedimentos.length) continue;
        politicas.set(t.id, politica);
      } else if (t.evaluadoresAsignados !== 2 || t.escritasCerradas !== 2) continue;
      disponibles.push(t);
    }
    return {
      elementos: disponibles
        .map((trabajo) => {
          const candidato = porId.get(trabajo.id);
          const sinProgramacion = candidato?.pendientes ?? [];
          return {
            ...this.contexto(trabajo),
            politicaProgramacion: politicas.get(trabajo.id),
            horarioProgramacion: candidato?.horarioProgramacion,
            // Estudiantes que aún pueden incluirse en una sesión nueva (RN-28).
            estudiantesPendientes: trabajo.estudiantes.filter((estudiante) => sinProgramacion.includes(estudiante.id)),
          };
        })
        .filter((trabajo) => trabajo.estudiantesPendientes.length > 0),
      filtros: catalogos,
    };
  }

  async crear(dto: CrearProgramacionDto, actorId: string, accesoLocal = false, rol = ''): Promise<Record<string, unknown>> {
    await this.exigirTrabajoEnAlcance(dto.idTrabajo);
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
          SELECT p.id, (to_jsonb(p)->>'version_flujo')::integer AS "versionFlujo",
            ${HORARIO_PROGRAMACION_VIGENTE} AS "horarioProgramacion"
          FROM s4.procesos_evaluacion p
          JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id AND a.estado = 'VIGENTE'
          JOIN gen.tema t ON t.id = a.tema_id
          WHERE a.id = $1 AND p.estado_registro = 1 FOR UPDATE OF p
        `, [dto.idTrabajo]);
        if (!proceso) throw new NotFoundException('No existe un proceso vigente para el trabajo solicitado.');
        validarHorarioProgramacion(fecha, hora, proceso.horarioProgramacion);

        const [trabajo] = await manager.query(`
          SELECT
            (SELECT count(*)::int FROM s3.asignacion_tribunal WHERE asignacion_tema_id = $2) AS tribunal,
            (SELECT count(DISTINCT e.id_asignacion_tribunal)::int FROM s4.evaluaciones e
              JOIN s3.asignacion_tribunal a ON a.asignacion_tribunal_id = e.id_asignacion_tribunal
              JOIN s4.procesos_evaluacion p ON p.id = e.id_proceso_evaluacion
              WHERE p.id = $1 AND a.asignacion_tema_id = $2 AND e.id_version_rubrica = p.id_version_rubrica
                AND e.estado_registro = 1 AND e.etapa = 'ESCRITA' AND e.estado = 'CERRADA') AS cerradas
        `, [proceso.id, dto.idTrabajo]);
        // RN-28: cada estudiante figura en una sola programación (incluso cancelada u oculta, como antes
        // por trabajo); una bina puede sustentar junta o en sesiones separadas.
        const estudiantes = await manager.query(CONSULTA_ESTUDIANTES_PROGRAMABLES, [dto.idTrabajo, proceso.id]) as EstudianteProgramable[];
        const participantes = elegirParticipantesSesion(estudiantes, dto.idEstudiantes);
        let politica: ReturnType<typeof evaluarProgramacion> | undefined;
        if (proceso.versionFlujo > 1) {
          const actual = await trabajoEn(manager,dto.idTrabajo);
          if (!actual || !trabajo.tribunal) throw new ConflictException('Falta el tribunal asignado.');
          const flujo = await flujoDelProceso(manager, actual, rol, actorId);
          politica = evaluarProgramacion(flujo.pasos, rol);
          if (politica.impedimentos.length) throw new ConflictException('Falta completar: ' + politica.impedimentos.join(', '));
          if (politica.advertencias.length && !dto.confirmarAdvertencia)
            throw new ConflictException('Confirma los requisitos pendientes: ' + politica.advertencias.join(', '));
          if (politica.excepciones.length && !dto.motivoExcepcion?.trim())
            throw new ConflictException('Registra el motivo de la excepción: ' + politica.excepciones.join(', '));
        } else if (trabajo.tribunal !== 2 || trabajo.cerradas !== 2) {
          throw new ConflictException('La sustentación requiere dos evaluaciones escritas cerradas del tribunal asignado.');
        }

        await this.exigirHorarioDisponible(manager, fecha, hora, sala, duracionEstimadaMinutos, dto.idTrabajo);
        const [creada] = await manager.query(`
          INSERT INTO s4.programaciones_sustentacion (
            id_proceso_evaluacion, fecha_programada, hora_programada, hora_fin_programada, sala,
            duracion_estimada_minutos, scheduled_by_id_cuenta, scheduled_by_actor_id, estado, tipo
          ) VALUES ($1, $2::date, $3::time, $3::time + make_interval(mins => $5::int), $4, $5, $6, $7,
            'PROGRAMADA', $8)
          RETURNING "id"
        `, [proceso.id, fecha, hora, sala, duracionEstimadaMinutos, cuenta?.id ?? null, accesoLocal ? actorId : null,
          participantes.length > 1 ? 'CONJUNTA' : 'INDIVIDUAL']) as Array<{ id: string }>;
        await manager.query(`
          INSERT INTO s4.programacion_estudiante (programacion_sustentacion_id, id_estudiante)
          SELECT $1, unnest($2::uuid[])
        `, [creada.id, participantes]);
        if (politica && (politica.advertencias.length || politica.excepciones.length)) {
          await manager.query(`INSERT INTO s4.excepcion_programacion
            (programacion, version_flujo, actor, rol, advertencias, excepciones, motivo)
            VALUES ($1,$2,$3,$4,$5,$6,$7)`, [creada.id, proceso.versionFlujo, actorId, rol,
            politica.advertencias, politica.excepciones, politica.excepciones.length ? dto.motivoExcepcion?.trim() : null]);
        }
        return creada.id;
      });
      return this.obtener(id);
    } catch (error) {
      this.traducirConflictoUnico(error);
      throw error;
    }
  }

  async actualizar(id: string, dto: ActualizarProgramacionDto, actorId: string): Promise<Record<string, unknown>> {
    if (hayRestriccionDeAlcance()) await this.obtener(id); // 404 si la sesión no es de su ámbito
    const fecha = validarFechaProgramada(dto.fechaProgramada);
    const hora = validarHoraProgramada(dto.horaProgramada);
    const sala = validarSalaProgramada(dto.sala);
    const motivo = validarMotivoReprogramacion(dto.motivo);

    try {
      await this.dataSource.transaction('READ COMMITTED', async (manager) => {
        await establecerActorAuditoria(manager, actorId);
        const [proceso] = await manager.query(`
          SELECT p.id, a.id AS "idAsignacion", ${HORARIO_PROGRAMACION_VIGENTE} AS "horarioProgramacion"
          FROM s4.procesos_evaluacion p
          JOIN s4.programaciones_sustentacion s ON s.id_proceso_evaluacion = p.id
          JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
          JOIN gen.tema t ON t.id = a.tema_id
          WHERE s.id = $1 AND s.estado_registro = 1 FOR UPDATE OF p
        `, [id]);
        const [actual] = await manager.query(`
          SELECT "id", id_proceso_evaluacion AS "idTrabajo", "estado", "duracion_estimada_minutos" AS "duracionEstimadaMinutos"
          FROM s4.programaciones_sustentacion WHERE "id" = $1 AND estado_registro = 1 FOR UPDATE
        `, [id]) as Array<{ id: string; idTrabajo: string; estado: EstadoSustentacion; duracionEstimadaMinutos: number }>;
        if (!actual) throw new NotFoundException('No existe la programación solicitada.');
        if (actual.estado !== EstadoSustentacion.PROGRAMADA) {
          throw new ConflictException('Solo se puede modificar una sustentación que permanece programada.');
        }
        validarHorarioProgramacion(fecha, hora, proceso?.horarioProgramacion);

        const [oral] = await manager.query(`
          SELECT EXISTS (
            SELECT 1 FROM s4.evaluaciones evaluacion
            LEFT JOIN s4.etapas_rubrica etapa ON etapa."id" = evaluacion."id_etapa_rubrica"
            WHERE evaluacion.id_proceso_evaluacion = $1
              AND (evaluacion."etapa" = 'ORAL' OR etapa."kind" = 'ORAL')
              AND evaluacion.id_estudiante IN (
                SELECT pe.id_estudiante FROM s4.programacion_estudiante pe
                WHERE pe.programacion_sustentacion_id = $2 AND pe.estado_registro = 1)
          ) AS "iniciada"
        `, [actual.idTrabajo, actual.id]) as Array<{ iniciada: boolean }>;
        if (oral?.iniciada) {
          throw new ConflictException('No se puede cambiar la programación después de iniciar una evaluación oral.');
        }

        const duracionEstimadaMinutos = dto.duracionEstimadaMinutos === undefined
          ? actual.duracionEstimadaMinutos
          : validarDuracionEstimada(dto.duracionEstimadaMinutos);
        await this.exigirHorarioDisponible(manager, fecha, hora, sala, duracionEstimadaMinutos, proceso?.idAsignacion, actual.id);
        await manager.query(
          "SELECT set_config('genares.actor_id', $1, true), set_config('s4.motivo_cambio', $2, true)",
          [actorId, motivo],
        );
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
    if (hayRestriccionDeAlcance()) await this.obtener(id); // 404 si la sesión no es de su ámbito
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

  private async listarCatalogos(): Promise<Record<string, unknown>> {
    const [carreras, periodos] = await Promise.all([
      this.dataSource.query('SELECT id, codigo, nombre FROM gen.carrera ORDER BY nombre, id'),
      this.dataSource.query('SELECT id, codigo, activo FROM gen.periodo_academico ORDER BY codigo DESC, id'),
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

  async consultarDisponibilidadSala(dto: ConsultarDisponibilidadSalaDto) {
    const fecha = validarFechaProgramada(dto.fechaProgramada);
    const hora = validarHoraProgramada(dto.horaProgramada);
    const sala = validarSalaProgramada(dto.sala);
    const duracion = validarDuracionEstimada(dto.duracionEstimadaMinutos ?? DURACION_ESTIMADA_PREDETERMINADA_MINUTOS);
    this.exigirFinMismoDia(hora, duracion);
    const idTrabajo = dto.idProgramacion ? String((await this.obtener(dto.idProgramacion)).idTrabajo) : dto.idTrabajo;
    if (idTrabajo && !dto.idProgramacion) await this.exigirTrabajoEnAlcance(idTrabajo);
    const conflicto = await this.conflictoHorario(this.dataSource.manager, fecha, hora, sala, duracion, idTrabajo, dto.idProgramacion);
    return conflicto ? { disponible: false, ...conflicto } : { disponible: true };
  }

  private exigirFinMismoDia(hora: string, duracion: number): void {
    const [horas, minutos] = hora.split(':').map(Number);
    if (horas * 60 + minutos + duracion >= 1440) {
      throw new ConflictException('La sustentación debe terminar el mismo día.');
    }
  }

  private async exigirHorarioDisponible(
    manager: EntityManager,
    fecha: string,
    hora: string,
    sala: string,
    duracionEstimadaMinutos: number,
    idTrabajo?: string,
    excluirId?: string,
  ): Promise<void> {
    this.exigirFinMismoDia(hora, duracionEstimadaMinutos);
    // El cupo y la política publicada se comprueban después de adquirir los bloqueos.
    await manager.query('SELECT pg_advisory_xact_lock_shared(73940211)');
    await manager.query("SELECT pg_advisory_xact_lock(73940213, $1::date - DATE '2000-01-01')", [fecha]);
    await manager.query(`
      SELECT pg_advisory_xact_lock(hashtext(lower(btrim($1::text))))
    `, [sala]);

    const conflicto = await this.conflictoHorario(manager, fecha, hora, sala, duracionEstimadaMinutos, idTrabajo, excluirId);
    if (conflicto) throw new ConflictException(conflicto.mensaje);
  }

  private async conflictoHorario(
    manager: EntityManager,
    fecha: string,
    hora: string,
    sala: string,
    duracionEstimadaMinutos: number,
    idTrabajo?: string,
    excluirId?: string,
  ) {
    if (await this.salaOcupada(manager, fecha, hora, sala, duracionEstimadaMinutos, excluirId)) {
      return { motivo: 'SALA_OCUPADA', mensaje: MENSAJE_SALA_OCUPADA };
    }
    if (idTrabajo) {
      const [cupo] = await manager.query(CONSULTA_LIMITE_SIMULTANEAS, [
        fecha, hora, duracionEstimadaMinutos, excluirId ?? null, idTrabajo, LIMITE_SIMULTANEAS_PREDETERMINADO,
      ]) as Array<{ limite: number; limiteAlcanzado: boolean }>;
      if (cupo?.limiteAlcanzado) {
        return {
          motivo: 'LIMITE_SIMULTANEAS',
          mensaje: `En ese horario se alcanza el límite de ${cupo.limite} sustentaciones simultáneas para este cupo.`,
        };
      }
    }
  }

  private async salaOcupada(
    manager: EntityManager,
    fecha: string,
    hora: string,
    sala: string,
    duracionEstimadaMinutos: number,
    excluirId?: string,
  ): Promise<boolean> {
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
    return Boolean(conflicto);
  }

  private traducirConflictoUnico(error: unknown): void {
    const errorDb = error as { code?: string; constraint?: string; driverError?: { code?: string; constraint?: string } };
    const codigo = errorDb.driverError?.code ?? errorDb.code;
    const constraint = errorDb.driverError?.constraint ?? errorDb.constraint;
    if (codigo === '23P01') {
      throw new ConflictException(MENSAJE_SALA_OCUPADA);
    }
    if (codigo !== '23505') return;
    if (constraint === 'uq_programaciones_sustentacion_sala_instante_vigente') {
      throw new ConflictException(MENSAJE_SALA_OCUPADA);
    }
    if (constraint === 'uq_programaciones_sustentacion_work') {
      throw new ConflictException('El trabajo ya tiene una programación registrada; edítela desde el cronograma.');
    }
    throw new ConflictException('La programación entra en conflicto con un registro existente.');
  }
}
