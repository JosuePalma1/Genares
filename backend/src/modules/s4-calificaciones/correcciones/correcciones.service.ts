import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { establecerActorAuditoria } from '../auditoria/contexto-auditoria';
import { PuntajeBorrador } from '../evaluaciones/mer/borrador-oral.reglas';
import { AlmacenJustificativos } from './almacen-justificativos';
import {
  bloqueosCorreccion, ESTADO_SOLICITUD, prepararCorreccion, PuntajeActual, validarJustificativo, validarMotivo,
} from './correcciones.reglas';

type Consulta = Pick<EntityManager, 'query'>;

export interface ArchivoSubido { originalname?: string; mimetype?: string; size?: number; buffer?: Buffer }

export interface DatosSolicitud {
  idEvaluacion: string;
  motivo: unknown;
  revisionEsperada: unknown;
  puntajes: unknown;
}

export interface ContextoCorreccion {
  id: string; estado: string; estadoRegistro: number; revision: number; total: string | null;
  idEstudiante: string | null; idProceso: string; tipoEtapa: string; etapa: string; maximoEtapa: string;
  estadoProceso: string | null; idTrabajo: string; trabajo: string;
  puntajes: Array<PuntajeActual & { indicador: string; descripcion: string | null; categoria: string }>;
  bloqueos: string[]; solicitudAbierta: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_SOLICITUD = `
  SELECT s.id, s.id_evaluacion AS "idEvaluacion", s.estado, s.motivo, s.revision_base AS "revisionBase",
    s.puntajes_anteriores AS "puntajesAnteriores", s.puntajes_propuestos AS "puntajesPropuestos",
    s.total_anterior::text AS "totalAnterior", s.total_propuesto::text AS "totalPropuesto",
    s.justificativo_nombre AS "justificativoNombre", s.justificativo_bytes AS "justificativoBytes",
    s.justificativo_sha256 AS "justificativoSha256",
    s.solicitado_por AS "solicitadoPor", s.solicitado_en AS "solicitadoEn",
    s.resuelto_por AS "resueltoPor", s.resuelto_en AS "resueltoEn",
    s.comentario_resolucion AS "comentarioResolucion", s.aplicada_en AS "aplicadaEn",
    a.id AS "idTrabajo", tema.titulo AS "trabajo", er.nombre AS "etapa", e.etapa AS "tipoEtapa",
    TRIM(CONCAT_WS(' ', pe.nombres, pe.apellidos)) AS "estudiante",
    TRIM(CONCAT_WS(' ', pd.nombres, pd.apellidos)) AS "evaluador"
  FROM s4.solicitudes_correccion_evaluacion s
  JOIN s4.evaluaciones e ON e.id = s.id_evaluacion
  JOIN s4.procesos_evaluacion p ON p.id = s.id_proceso_evaluacion
  JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
  JOIN gen.tema tema ON tema.id = a.tema_id
  JOIN s4.etapas_rubrica er ON er.id = e.id_etapa_rubrica
  LEFT JOIN gen.estudiante es ON es.id = e.id_estudiante
  LEFT JOIN gen.persona pe ON pe.id = es.persona_id
  LEFT JOIN s3.asignacion_tribunal at ON at.asignacion_tribunal_id = e.id_asignacion_tribunal
  LEFT JOIN s3.miembros_tribunal mt ON mt.miembro_tribunal_id = at.miembro_tribunal_id
  LEFT JOIN s3.docente_carrera_periodo dcp ON dcp.docente_carrera_periodo_id = mt.docente_carrera_periodo_id
  LEFT JOIN gen.docente d ON d.id = dcp.docente_id
  LEFT JOIN gen.persona pd ON pd.id = d.persona_id
  WHERE s.estado_registro = 1`;

@Injectable()
export class CorreccionesService {
  constructor(private readonly db: DataSource, private readonly almacen: AlmacenJustificativos) {}

  /** Datos de la evaluación cerrada que se quiere corregir y motivos que lo impiden. */
  async contexto(idEvaluacion: string, db: Consulta = this.db): Promise<ContextoCorreccion> {
    const [evaluacion] = await db.query(`
      SELECT e.id, e.estado, e.estado_registro AS "estadoRegistro", COALESCE(e.revision, 0) AS revision,
        e.calificacion_total::text AS total, e.id_estudiante AS "idEstudiante",
        e.id_proceso_evaluacion AS "idProceso", e.etapa AS "tipoEtapa", er.nombre AS etapa,
        er.calificacion_maxima::text AS "maximoEtapa", p.estado AS "estadoProceso",
        a.id AS "idTrabajo", tema.titulo AS trabajo
      FROM s4.evaluaciones e
      JOIN s4.procesos_evaluacion p ON p.id = e.id_proceso_evaluacion
      JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
      JOIN gen.tema tema ON tema.id = a.tema_id
      JOIN s4.etapas_rubrica er ON er.id = e.id_etapa_rubrica
      WHERE e.id = $1`, [idEvaluacion]);
    if (!evaluacion) throw new NotFoundException('No existe la evaluación solicitada.');

    const puntajes: Array<PuntajeActual & { indicador: string; descripcion: string | null; categoria: string }> = await db.query(`
      SELECT ce.id_indicador AS "idIndicador", ce.score::text AS score, ce.observation,
        ce.instantanea_calificacion_maxima::text AS "calificacionMaxima",
        i.label AS indicador, i.descripcion, c.codigo AS categoria
      FROM s4.calificaciones_evaluacion ce
      JOIN s4.indicadores_rubrica i ON i.id = ce.id_indicador
      JOIN s4.categorias_rubrica c ON c.id = i.id_categoria
      WHERE ce.id_evaluacion = $1 AND ce.estado_registro = 1
      ORDER BY c.orden, i.orden, i.id`, [idEvaluacion]);

    // La escrita compartida afecta a todos los estudiantes del trabajo; la oral, solo al suyo.
    const [{ actas }] = await db.query(`
      SELECT count(*)::int AS actas FROM s4.actas_archivadas
      WHERE id_proceso_evaluacion = $1 AND estado_registro = 1
        AND ($2::uuid IS NULL OR id_estudiante = $2::uuid)`, [evaluacion.idProceso, evaluacion.idEstudiante]);
    const [abierta] = await db.query(`
      SELECT id FROM s4.solicitudes_correccion_evaluacion
      WHERE id_evaluacion = $1 AND estado IN ('PENDIENTE', 'APROBADA') AND estado_registro = 1`, [idEvaluacion]);

    const bloqueos = bloqueosCorreccion({
      estadoEvaluacion: evaluacion.estado, estadoRegistro: Number(evaluacion.estadoRegistro),
      estadoProceso: evaluacion.estadoProceso, actasArchivadas: Number(actas),
    });
    if (abierta) bloqueos.push('Ya hay una solicitud de corrección abierta para esta evaluación.');
    return { ...evaluacion, revision: Number(evaluacion.revision), puntajes, bloqueos, solicitudAbierta: abierta?.id ?? null };
  }

  listar(estado?: string) {
    if (estado && !Object.values(ESTADO_SOLICITUD).includes(estado as never)) {
      throw new BadRequestException('Estado de solicitud no válido.');
    }
    return this.db.query(`${SELECT_SOLICITUD} AND ($1::text IS NULL OR s.estado = $1)
      ORDER BY s.solicitado_en DESC, s.id LIMIT 200`, [estado ?? null]);
  }

  async detalle(id: string, db: Consulta = this.db) {
    const [solicitud] = await db.query(`${SELECT_SOLICITUD} AND s.id = $1`, [id]);
    if (!solicitud) throw new NotFoundException('No existe la solicitud de corrección.');
    return solicitud;
  }

  async justificativo(id: string) {
    const [fila] = await this.db.query(`
      SELECT justificativo_ruta AS ruta, justificativo_sha256 AS sha256 FROM s4.solicitudes_correccion_evaluacion
      WHERE id = $1 AND estado_registro = 1`, [id]);
    if (!fila) throw new NotFoundException('No existe la solicitud de corrección.');
    try { return await this.almacen.leer(fila.ruta, fila.sha256); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException('El PDF justificativo no está disponible en el servidor.');
      throw new ConflictException((error as Error).message);
    }
  }

  /** AU-02: registra la solicitud con el cambio exacto, el motivo y el PDF obligatorio. */
  async solicitar(datos: DatosSolicitud, archivo: ArchivoSubido | undefined, actor: string) {
    if (!UUID.test(datos.idEvaluacion ?? '')) throw new BadRequestException('Indique una evaluación válida.');
    const revision = Number(datos.revisionEsperada);
    if (!Number.isInteger(revision) || revision < 0) throw new BadRequestException('Indique la revisión de la evaluación.');
    let motivo: string;
    let propuestos: PuntajeBorrador[];
    let pdf: Buffer;
    try {
      motivo = validarMotivo(datos.motivo);
      propuestos = typeof datos.puntajes === 'string' ? JSON.parse(datos.puntajes) : datos.puntajes as PuntajeBorrador[];
      if (!Array.isArray(propuestos)) throw new Error('Indique los puntajes corregidos.');
      pdf = validarJustificativo(archivo);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    const guardado = await this.almacen.guardar(pdf);
    try {
      return await this.db.transaction(async (manager) => {
        await establecerActorAuditoria(manager, actor);
        await manager.query('SELECT 1 FROM s4.evaluaciones WHERE id = $1 FOR UPDATE', [datos.idEvaluacion]);
        const contexto = await this.contexto(datos.idEvaluacion, manager);
        if (contexto.bloqueos.length) throw new ConflictException({ message: 'No se puede solicitar la corrección.', details: contexto.bloqueos });
        if (contexto.revision !== revision) {
          throw new ConflictException('La evaluación cambió desde que la consultó. Recárguela antes de solicitar la corrección.');
        }
        let corregidos;
        try { corregidos = prepararCorreccion(contexto.puntajes, propuestos); }
        catch (error) { throw new BadRequestException((error as Error).message); }

        const anteriores = contexto.puntajes.map(({ idIndicador, score, observation }) => ({ idIndicador, score, observation }));
        const [solicitud] = await manager.query(`
          INSERT INTO s4.solicitudes_correccion_evaluacion
            (id_evaluacion, id_proceso_evaluacion, motivo, revision_base, puntajes_anteriores, puntajes_propuestos,
             total_anterior, total_propuesto, justificativo_ruta, justificativo_sha256, justificativo_nombre,
             justificativo_bytes, solicitado_por)
          VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::numeric,
            (SELECT SUM((p->>'score')::numeric) FROM jsonb_array_elements($6::jsonb) p),
            $8, $9, $10, $11, $12)
          RETURNING id`,
        [datos.idEvaluacion, contexto.idProceso, motivo, revision, JSON.stringify(anteriores), JSON.stringify(corregidos),
          contexto.total, guardado.ruta, guardado.sha256, (archivo?.originalname ?? 'justificativo.pdf').slice(0, 200),
          guardado.bytes, actor]);
        await this.auditar(manager, datos.idEvaluacion, actor, 'CORRECCION_SOLICITADA', {
          solicitud: solicitud.id, motivo, revisionBase: revision,
          justificativo: { ruta: guardado.ruta, sha256: guardado.sha256, bytes: guardado.bytes },
        });
        return this.detalle(solicitud.id, manager);
      });
    } catch (error) {
      await this.almacen.descartar(guardado.ruta);
      throw error;
    }
  }

  /**
   * AU-03: aprueba y aplica en una sola transacción. Si la evaluación cambió, el trabajo se
   * finalizó o ya hay acta archivada, no se aplica nada y la solicitud sigue PENDIENTE.
   */
  async aprobar(id: string, comentario: string | undefined, actor: string) {
    return this.db.transaction(async (manager) => {
      await establecerActorAuditoria(manager, actor);
      const solicitud = await this.solicitudPendiente(manager, id);
      const [evaluacion] = await manager.query(`
        SELECT id, COALESCE(revision, 0) AS revision FROM s4.evaluaciones WHERE id = $1 FOR UPDATE`, [solicitud.idEvaluacion]);
      if (Number(evaluacion.revision) !== Number(solicitud.revisionBase)) {
        throw new ConflictException('La evaluación cambió después de la solicitud. Rechácela y registre una nueva.');
      }
      const contexto = await this.contexto(solicitud.idEvaluacion, manager);
      const bloqueos = contexto.bloqueos.filter((b) => b !== 'Ya hay una solicitud de corrección abierta para esta evaluación.');
      if (bloqueos.length) throw new ConflictException({ message: 'No se puede aplicar la corrección.', details: bloqueos });

      await manager.query(`
        UPDATE s4.solicitudes_correccion_evaluacion
        SET estado = 'APROBADA', resuelto_por = $2, resuelto_en = clock_timestamp(), comentario_resolucion = $3
        WHERE id = $1`, [id, actor, comentario?.trim() || null]);
      // La base solo admite el cambio mientras la transacción apunta a esta solicitud aprobada.
      await manager.query(`SELECT set_config('s4.correccion_solicitud', $1, true)`, [id]);
      for (const puntaje of solicitud.puntajesPropuestos as Array<{ idIndicador: string; score: string; observation: string | null }>) {
        await manager.query(`
          UPDATE s4.calificaciones_evaluacion SET score = $3::numeric, observation = $4
          WHERE id_evaluacion = $1 AND id_indicador = $2 AND estado_registro = 1`,
        [solicitud.idEvaluacion, puntaje.idIndicador, puntaje.score, puntaje.observation]);
      }
      // Mismo cálculo exacto que el cierre ordinario: suma NUMERIC, sin redondeo intermedio.
      const [[aplicada]] = await manager.query(`
        UPDATE s4.evaluaciones e
        SET revision = COALESCE(e.revision, 0) + 1,
            calificacion_total = (
              SELECT SUM(ce.score) FROM s4.calificaciones_evaluacion ce
              WHERE ce.id_evaluacion = e.id AND ce.estado_registro = 1)
        WHERE e.id = $1 AND e.estado = 'CERRADA'
        RETURNING revision, calificacion_total::text AS total`, [solicitud.idEvaluacion]);
      if (!aplicada || Number(aplicada.total) !== Number(solicitud.totalPropuesto)) {
        throw new ConflictException('El total corregido no coincide con el autorizado. No se aplicó ningún cambio.');
      }
      await manager.query(`SELECT set_config('s4.correccion_solicitud', '', true)`);
      await manager.query(`
        UPDATE s4.solicitudes_correccion_evaluacion SET estado = 'APLICADA', aplicada_en = clock_timestamp()
        WHERE id = $1`, [id]);

      await this.auditar(manager, solicitud.idEvaluacion, actor, 'CORRECCION_EXTRAORDINARIA_APLICADA', {
        solicitud: id, solicitadoPor: solicitud.solicitadoPor, aprobadoPor: actor, motivo: solicitud.motivo,
        comentario: comentario?.trim() || null,
        revisionAnterior: Number(solicitud.revisionBase), revisionNueva: Number(aplicada.revision),
        totalAnterior: solicitud.totalAnterior, totalNuevo: aplicada.total,
        puntajesAnteriores: solicitud.puntajesAnteriores, puntajesNuevos: solicitud.puntajesPropuestos,
        justificativo: { sha256: solicitud.justificativoSha256 },
      });
      await manager.query(`
        INSERT INTO s4.eventos_trazabilidad_trabajo
          (id_proceso_evaluacion, ocurrido_en, tipo_evento, entidad_tipo, entidad_id, actor_id,
           actor_tipo, origen, detalles, evidencia, fuente_tipo, fuente_id)
        SELECT e.id_proceso_evaluacion, clock_timestamp(), 'CORRECCION_EVALUACION_APLICADA', 'evaluacion', e.id, $2,
          'USUARIO', 'AUDITORIA', $3::jsonb, 'DIRECTA', 'solicitud_correccion', $4
        FROM s4.evaluaciones e WHERE e.id = $1`,
      [solicitud.idEvaluacion, actor, JSON.stringify({ totalAnterior: solicitud.totalAnterior, totalNuevo: aplicada.total }), id]);
      return this.detalle(id, manager);
    });
  }

  /** AU-03: rechaza con motivo; la evaluación no cambia. */
  async rechazar(id: string, comentario: string | undefined, actor: string) {
    const texto = comentario?.trim() ?? '';
    if (texto.length < 10) throw new BadRequestException('Indique el motivo del rechazo (al menos 10 caracteres).');
    return this.db.transaction(async (manager) => {
      await establecerActorAuditoria(manager, actor);
      const solicitud = await this.solicitudPendiente(manager, id);
      await manager.query(`
        UPDATE s4.solicitudes_correccion_evaluacion
        SET estado = 'RECHAZADA', resuelto_por = $2, resuelto_en = clock_timestamp(), comentario_resolucion = $3
        WHERE id = $1`, [id, actor, texto]);
      await this.auditar(manager, solicitud.idEvaluacion, actor, 'CORRECCION_RECHAZADA', { solicitud: id, comentario: texto });
      return this.detalle(id, manager);
    });
  }

  private async solicitudPendiente(manager: Consulta, id: string) {
    const [solicitud] = await manager.query(`
      SELECT id, id_evaluacion AS "idEvaluacion", estado, motivo, revision_base AS "revisionBase",
        puntajes_anteriores AS "puntajesAnteriores", puntajes_propuestos AS "puntajesPropuestos",
        total_anterior::text AS "totalAnterior", total_propuesto::text AS "totalPropuesto",
        justificativo_sha256 AS "justificativoSha256", solicitado_por AS "solicitadoPor"
      FROM s4.solicitudes_correccion_evaluacion WHERE id = $1 AND estado_registro = 1 FOR UPDATE`, [id]);
    if (!solicitud) throw new NotFoundException('No existe la solicitud de corrección.');
    if (solicitud.estado !== ESTADO_SOLICITUD.PENDIENTE) {
      throw new ConflictException(`La solicitud ya fue resuelta (${solicitud.estado}).`);
    }
    return solicitud;
  }

  private auditar(manager: Consulta, idEvaluacion: string, actor: string, accion: string, detalles: object) {
    return manager.query(`
      INSERT INTO s4.eventos_auditoria_evaluacion (id_evaluacion, actor_id, accion, detalles, ocurrido_en)
      VALUES ($1, $2, $3, $4::jsonb, clock_timestamp())`, [idEvaluacion, actor, accion, JSON.stringify(detalles)]);
  }
}
