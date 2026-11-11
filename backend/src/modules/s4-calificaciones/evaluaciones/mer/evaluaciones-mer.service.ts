import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GuardarBorradorOralDto } from './borrador-oral.dto';
import { detallarConsolidacionMer, validarPuntajesBorrador, validarPuntajesCierre } from './borrador-oral.reglas';
import { establecerActorAuditoria } from '../../auditoria/contexto-auditoria';

interface IdentidadProceso {
  procesoId: string;
  asignacionId: string;
  tema: string;
  idVersionRubrica: string;
  versionRubrica: string;
  estadoProceso: string;
  estadoRegistro: 0 | 1;
  permisoCierre: boolean;
}

export interface EtapaMer {
  id: string;
  scope: string;
  kind: string;
  codigo: string;
  nombre: string;
  orden: number;
  porcentaje: string | null;
  calificacionMaxima: string | null;
  estadoRegistro: 0 | 1;
}

export interface ParticipanteMer {
  id: string;
  nombre: string;
}

/**
 * Adaptación de las tablas del MER real. No utiliza entidades ni migraciones
 * heredadas. La escritura se permite únicamente en la BD DEV local.
 */
@Injectable()
export class EvaluacionesMerService {
  constructor(private readonly db: DataSource) {}

  verificarEntornoEscritura(): void {
    if (process.env.NODE_ENV !== 'development'
      || process.env.ENABLE_INTEGRACION_DEV !== 'true'
      || process.env.LOCAL_DEV_OPEN_ACCESS !== 'true'
      || process.env.DB_NAME !== 'genares_integrado_dev') {
      throw new ForbiddenException('El guardado de demostración solo está permitido en la base local de desarrollo.');
    }
  }

  private async obtenerEtapas(versionId: string, db: Pick<DataSource, 'query'> = this.db) {
    const [etapas, categorias, indicadores] = await Promise.all([
      db.query<EtapaMer[]>(`SELECT id, kind, scope, codigo, nombre, descripcion, orden, porcentaje,
          calificacion_maxima AS "calificacionMaxima", estado_registro AS "estadoRegistro"
        FROM s4.etapas_rubrica WHERE id_version_rubrica = $1 ORDER BY orden, id`, [versionId]),
      db.query<{ id: string; idEtapaRubrica: string; estadoRegistro: 0 | 1 }[]>(`SELECT id, id_etapa_rubrica AS "idEtapaRubrica", codigo, nombre, orden,
          calificacion_maxima AS "calificacionMaxima", estado_registro AS "estadoRegistro"
        FROM s4.categorias_rubrica WHERE id_version_rubrica = $1 ORDER BY orden, id`, [versionId]),
      db.query<{ idCategoria: string; estadoRegistro: 0 | 1 }[]>(`SELECT i.id, i.id_categoria AS "idCategoria", i.label, i.descripcion,
          i.calificacion_maxima AS "calificacionMaxima", i.orden, i.estado_registro AS "estadoRegistro"
        FROM s4.indicadores_rubrica i
        JOIN s4.categorias_rubrica c ON c.id = i.id_categoria
        WHERE c.id_version_rubrica = $1 ORDER BY i.orden, i.id`, [versionId]),
    ]);
    return etapas.map((etapa) => ({
      ...etapa,
      categorias: categorias.filter((c) => c.idEtapaRubrica === etapa.id).map((c) => ({
        ...c, indicadores: indicadores.filter((i) => i.idCategoria === c.id),
      })),
    }));
  }

  async obtenerExpediente(asignacionId: string, db: Pick<DataSource, 'query'> = this.db) {
    const [proceso] = await db.query(`
      SELECT p.id AS "procesoId", a.id AS "asignacionId", t.titulo AS "tema",
             p.id_version_rubrica AS "idVersionRubrica", vr.version AS "versionRubrica",
             p.estado AS "estadoProceso",
             p.estado_registro AS "estadoRegistro",
             has_column_privilege('s4.evaluaciones', 'estado', 'UPDATE')
               AND has_column_privilege('s4.evaluaciones', 'cerrada_en', 'UPDATE') AS "permisoCierre"
      FROM s2.asignacion_tema a
      JOIN gen.tema t ON t.id = a.tema_id
      JOIN s4.procesos_evaluacion p ON p.asignacion_tema_id = a.id
      JOIN s4.versiones_rubrica vr ON vr.id = p.id_version_rubrica AND vr.estado_registro = 1
      JOIN s4.rubricas r ON r.id = vr.id_rubrica AND r.estado_registro = 1
      WHERE a.id = $1 AND a.estado = 'VIGENTE' AND p.estado_registro = 1
        AND EXISTS (SELECT 1 FROM s3.asignacion_tribunal at WHERE at.asignacion_tema_id = a.id)
    `, [asignacionId]) as IdentidadProceso[];
    if (!proceso) throw new NotFoundException('No existe proceso evaluable para esta asignación.');

    const [etapas, estudiantes, evaluadores, evaluaciones] = await Promise.all([
      this.obtenerEtapas(proceso.idVersionRubrica, db),
      db.query<ParticipanteMer[]>(`SELECT est.id, TRIM(CONCAT_WS(' ', persona.nombres, persona.apellidos)) AS nombre
        FROM s2.asignacion_tema a
        JOIN gen.estudiante est ON est.id = a.estudiante_id OR
          (a.grupo_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM s2.grupo_integrante gi
             WHERE gi.grupo_id = a.grupo_id AND gi.estudiante_id = est.id AND gi.estado = 'ACTIVO'
          ))
        JOIN gen.persona persona ON persona.id = est.persona_id
        WHERE a.id = $1 ORDER BY persona.apellidos, persona.nombres`, [asignacionId]),
      db.query<ParticipanteMer[]>(`SELECT at.asignacion_tribunal_id AS id,
          TRIM(CONCAT_WS(' ', per.nombres, per.apellidos)) AS nombre
        FROM s3.asignacion_tribunal at
        JOIN s3.miembros_tribunal mt ON mt.miembro_tribunal_id = at.miembro_tribunal_id
        JOIN s3.docente_carrera_periodo dcp ON dcp.docente_carrera_periodo_id = mt.docente_carrera_periodo_id
        JOIN gen.docente doc ON doc.id = dcp.docente_id
        JOIN gen.persona per ON per.id = doc.persona_id
        WHERE at.asignacion_tema_id = $1 ORDER BY per.apellidos, per.nombres`, [asignacionId]),
      db.query(`SELECT e.id, e.id_etapa_rubrica AS "idEtapaRubrica",
          e.id_asignacion_tribunal AS "idAsignacionTribunal", e.id_estudiante AS "idEstudiante",
          e.estado, e.estado_registro AS "estadoRegistro", COALESCE(e.revision, 0) AS revision,
          e.calificacion_total AS total, e.cerrada_en AS "cerradaEn",
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'idIndicador', ce.id_indicador, 'score', ce.score,
            'observation', ce.observation, 'estadoRegistro', ce.estado_registro,
            'estadoIndicador', i.estado_registro
          ) ORDER BY ce.id_indicador)
          FROM s4.calificaciones_evaluacion ce
          LEFT JOIN s4.indicadores_rubrica i ON i.id = ce.id_indicador
          WHERE ce.id_evaluacion = e.id)
          , '[]'::jsonb) AS puntajes
        FROM s4.evaluaciones e WHERE e.id_proceso_evaluacion = $1 AND e.id_version_rubrica = $2
        ORDER BY e.creado_en, e.id`, [proceso.procesoId, proceso.idVersionRubrica]),
    ]);
    const puedeGuardarBorradores = process.env.NODE_ENV === 'development'
      && process.env.LOCAL_DEV_OPEN_ACCESS === 'true'
      && process.env.DB_NAME === 'genares_integrado_dev';
    const idsEvaluadores = evaluadores.map(({ id }) => id);
    const etapasVisibles = etapas.filter((etapa) => Number(etapa.estadoRegistro ?? 1) === 1).map((etapa) => ({
      ...etapa,
      categorias: etapa.categorias.filter((categoria: Record<string, unknown>) => Number(categoria.estadoRegistro ?? 1) === 1)
        .map((categoria: Record<string, unknown>) => ({
          ...categoria,
          indicadores: (categoria.indicadores as Record<string, unknown>[])
            .filter((indicador) => Number(indicador.estadoRegistro ?? 1) === 1),
        })),
    }));
    // Un puntaje se muestra solo si su indicador y toda su rama (categoría y etapa) siguen visibles.
    const categoriasVisiblesPorEtapa = new Map(etapasVisibles.map((etapa) => [etapa.id, etapa.categorias]));
    const idsIndicadoresVisibles = new Set(etapasVisibles.flatMap((etapa) => etapa.categorias
      .flatMap((categoria: Record<string, unknown>) => (categoria.indicadores as Record<string, unknown>[])
        .map((indicador) => String(indicador.id)))));
    const evaluacionesVisibles = evaluaciones
      .filter((evaluacion: Record<string, unknown>) => Number(evaluacion.estadoRegistro ?? 1) === 1)
      .map((evaluacion: Record<string, unknown>) => ({
        ...evaluacion,
        puntajes: (evaluacion.puntajes as Array<Record<string, unknown>>)
          .filter((puntaje) => Number(puntaje.estadoRegistro ?? 1) === 1
            && idsIndicadoresVisibles.has(String(puntaje.idIndicador)))
          .map(({ estadoRegistro: _estadoRegistro, estadoIndicador: _estadoIndicador, ...puntaje }) => puntaje),
      }));
    const idsEvaluacionesVisibles = new Set(evaluacionesVisibles.map((evaluacion: Record<string, unknown>) => String(evaluacion.id)));
    return {
      ...proceso, estudiantes, evaluadores, etapas: etapasVisibles, evaluaciones: evaluacionesVisibles,
      consolidados: estudiantes.map(({ id }) => {
        const resultado = detallarConsolidacionMer(etapas, idsEvaluadores, evaluaciones, id);
        return { idEstudiante: id, total: resultado.resultadoFinal?.calificacion ?? null, ...resultado,
          // El cálculo usa los totales guardados; aquí solo se oculta la estructura retirada.
          etapas: resultado.etapas.filter((etapa) => Number(etapa.estadoRegistro ?? 1) === 1).map((etapa) => ({
            ...etapa,
            categorias: categoriasVisiblesPorEtapa.get(etapa.id) ?? [],
            evaluaciones: etapa.evaluaciones.filter((evaluacion) => evaluacion.id && idsEvaluacionesVisibles.has(evaluacion.id)),
          })),
        };
      }),
      modo: 'DESARROLLO_LOCAL',
      puedeGuardarBorradores,
      puedeCerrarEvaluaciones: puedeGuardarBorradores && proceso.permisoCierre,
    };
  }

  async guardarBorradorOral(
    asignacionId: string, dto: GuardarBorradorOralDto, actorCierre?: string, tipo: 'ORAL' | 'ESCRITA' = 'ORAL',
  ) {
    this.verificarEntornoEscritura();
    const idEstudiante = dto.idEstudiante ?? null;
    if ((tipo === 'ORAL') !== Boolean(idEstudiante)) {
      throw new BadRequestException('La evaluación oral requiere un estudiante y la escrita se comparte.');
    }
    return this.db.transaction(async (manager) => {
      await establecerActorAuditoria(manager, actorCierre);
      // Una sola transacción guarda contexto, evaluación, notas y auditoría.
      // Bloquear el proceso evita dos creaciones simultáneas del mismo borrador.
      const [proceso] = await manager.query(`
        SELECT p.id, p.id_version_rubrica AS "versionId"
        FROM s4.procesos_evaluacion p
        JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id AND a.estado = 'VIGENTE'
        JOIN s4.versiones_rubrica vr ON vr.id = p.id_version_rubrica AND vr.estado_registro = 1
        JOIN s4.rubricas r ON r.id = vr.id_rubrica AND r.estado_registro = 1
        WHERE a.id = $1 AND p.estado_registro = 1 FOR UPDATE OF p
      `, [asignacionId]);
      if (!proceso?.versionId) throw new NotFoundException('No hay rúbrica asignada al proceso.');

      const [etapa] = await manager.query(`
        SELECT id, kind, scope FROM s4.etapas_rubrica
        WHERE id = $1 AND id_version_rubrica = $2 AND estado_registro = 1
      `, [dto.idEtapaRubrica, proceso.versionId]);
      const alcance = tipo === 'ORAL' ? 'ESTUDIANTE_INDIVIDUAL' : 'TRABAJO_COMPARTIDO';
      if (!etapa || (etapa.kind !== tipo && etapa.kind !== 'PERSONALIZADA') || etapa.scope !== alcance) {
        throw new BadRequestException('La etapa no corresponde a la evaluación solicitada.');
      }
      const [asignacionTribunal] = await manager.query(`
        SELECT dcp.docente_id AS "idDocente"
        FROM s3.asignacion_tribunal at
        JOIN s3.miembros_tribunal mt ON mt.miembro_tribunal_id = at.miembro_tribunal_id
        JOIN s3.docente_carrera_periodo dcp ON dcp.docente_carrera_periodo_id = mt.docente_carrera_periodo_id
        WHERE at.asignacion_tribunal_id = $1 AND at.asignacion_tema_id = $2
      `, [dto.idAsignacionTribunal, asignacionId]);
      if (!asignacionTribunal) throw new BadRequestException('Evaluador no asignado por S3 a este tema.');
      if (idEstudiante) {
        const [pertenencia] = await manager.query(`
        SELECT s4.estudiante_pertenece_asignacion($1, $2) AS pertenece
        `, [asignacionId, idEstudiante]);
        if (pertenencia?.pertenece !== true) throw new BadRequestException('El estudiante no pertenece a la asignación de S2.');

      }
      if (etapa.kind === 'ORAL') {
        const [sesion] = await manager.query(`
        SELECT 1 FROM s4.programaciones_sustentacion ps
        JOIN s4.programacion_estudiante pe ON pe.programacion_sustentacion_id = ps.id
        WHERE ps.id_proceso_evaluacion = $1 AND pe.id_estudiante = $2
          AND ps.estado_registro = 1 AND pe.estado_registro = 1
          AND ps.estado NOT IN ('CANCELADA')
        LIMIT 1
        `, [proceso.id, idEstudiante]);
        if (!sesion) throw new ConflictException('El estudiante no tiene sustentación programada en S4.');
      }

      const indicadores = await manager.query(`
        SELECT i.id, i.calificacion_maxima AS "calificacionMaxima"
        FROM s4.indicadores_rubrica i
        JOIN s4.categorias_rubrica c ON c.id = i.id_categoria
        WHERE c.id_etapa_rubrica = $1 AND c.id_version_rubrica = $2
          AND c.estado_registro = 1 AND i.estado_registro = 1
      `, [dto.idEtapaRubrica, proceso.versionId]);
      const validar = actorCierre ? validarPuntajesCierre : validarPuntajesBorrador;
      try { validar(indicadores, dto.puntajes); }
      catch (error) { throw new BadRequestException((error as Error).message); }
      if (actorCierre) {
        const [estructura] = await manager.query(`
          SELECT e.calificacion_maxima > 0
            AND e.calificacion_maxima = sum(c.calificacion_maxima)
            AND bool_and(c.calificacion_maxima = (
              SELECT COALESCE(sum(i.calificacion_maxima), -1)
              FROM s4.indicadores_rubrica i WHERE i.id_categoria = c.id AND i.estado_registro = 1
            )) AS valida
          FROM s4.etapas_rubrica e
          JOIN s4.categorias_rubrica c ON c.id_etapa_rubrica = e.id
            AND c.id_version_rubrica = e.id_version_rubrica
          WHERE e.id = $1 AND e.id_version_rubrica = $2
            AND e.estado_registro = 1 AND c.estado_registro = 1
          GROUP BY e.id
        `, [dto.idEtapaRubrica, proceso.versionId]);
        if (!estructura?.valida) {
          throw new ConflictException('Los máximos de la rúbrica no coinciden con el total de la etapa.');
        }
      }

      let [evaluacion] = await manager.query(`
        SELECT id, estado, COALESCE(revision,0) AS revision
        FROM s4.evaluaciones
        WHERE id_proceso_evaluacion = $1 AND id_etapa_rubrica = $2
          AND id_asignacion_tribunal = $3 AND id_estudiante IS NOT DISTINCT FROM $4::uuid
          AND estado_registro = 1
        FOR UPDATE
      `, [proceso.id, dto.idEtapaRubrica, dto.idAsignacionTribunal, idEstudiante]);
      if (evaluacion && evaluacion.estado !== 'BORRADOR') {
        throw new ConflictException('La evaluación ya está cerrada. No se modificó ninguna nota.');
      }
      if (Number(evaluacion?.revision ?? 0) !== dto.revisionEsperada) {
        throw new ConflictException('El borrador fue modificado. Recarga la evaluación antes de guardar.');
      }
      if (evaluacion) {
        const [puntajesOcultos] = await manager.query(`
          SELECT EXISTS (SELECT 1 FROM s4.calificaciones_evaluacion
            WHERE id_evaluacion = $1 AND estado_registro = 0) AS existen
        `, [evaluacion.id]);
        if (puntajesOcultos?.existen) {
          throw new ConflictException('La evaluación tiene puntajes ocultos. Restáurelos antes de editar el borrador.');
        }
      }
      if (!evaluacion) {
        const [oculta] = await manager.query(`
          SELECT 1 FROM s4.evaluaciones
          WHERE id_proceso_evaluacion = $1 AND id_etapa_rubrica = $2
            AND id_asignacion_tribunal = $3 AND id_estudiante IS NOT DISTINCT FROM $4::uuid
            AND estado_registro = 0
          FOR UPDATE
        `, [proceso.id, dto.idEtapaRubrica, dto.idAsignacionTribunal, idEstudiante]);
        if (oculta) throw new ConflictException('Ya existe una evaluación archivada para esta asignación. Restáurela antes de crear otra.');
        const instantanea = JSON.stringify({
          versionRubricaId: proceso.versionId,
          etapaRubricaId: dto.idEtapaRubrica,
          indicadores: indicadores.map((i: { id: string; calificacionMaxima: string }) => i),
        });
        [evaluacion] = await manager.query(`
          INSERT INTO s4.evaluaciones
            (id_proceso_evaluacion, id_asignacion_tribunal, id_version_rubrica,
             id_etapa_rubrica, id_estudiante, etapa, estado, revision, instantanea_rubrica)
          VALUES ($1, $2, $3, $4, $5, $7, 'BORRADOR', 0, $6::jsonb)
          RETURNING id, estado, revision
        `, [proceso.id, dto.idAsignacionTribunal, proceso.versionId,
          dto.idEtapaRubrica, idEstudiante, instantanea, etapa.kind]);
      }
      for (const item of dto.puntajes) {
        const [actualizados] = await manager.query(`
          UPDATE s4.calificaciones_evaluacion
          SET score = $3, observation = $4,
              instantanea_calificacion_maxima = $5
          WHERE id_evaluacion = $1 AND id_indicador = $2
          RETURNING id
        `, [evaluacion.id, item.idIndicador, item.score ?? null,
          item.observation?.trim() ?? null,
          indicadores.find((i: { id: string }) => i.id === item.idIndicador).calificacionMaxima]);
        if (!actualizados.length) {
          await manager.query(`
            INSERT INTO s4.calificaciones_evaluacion
              (id_evaluacion, id_indicador, score, observation, instantanea_calificacion_maxima)
            VALUES ($1, $2, $3, $4, $5)
          `, [evaluacion.id, item.idIndicador, item.score ?? null,
            item.observation?.trim() ?? null,
            indicadores.find((i: { id: string }) => i.id === item.idIndicador).calificacionMaxima]);
        }
      }
      // SUM de PostgreSQL conserva NUMERIC exacto. No hay nota final si faltan indicadores.
      const [[guardada]] = await manager.query(`
        UPDATE s4.evaluaciones e
        SET revision = COALESCE(e.revision,0) + 1,
            ${actorCierre ? "estado = 'CERRADA', cerrada_en = now()," : ''}
            actualizado_en = now(),
            calificacion_total = (
              SELECT CASE WHEN COUNT(*) = COUNT(ce.score) AND COUNT(*) = $2
                THEN SUM(ce.score) ELSE NULL END
              FROM s4.calificaciones_evaluacion ce
              JOIN s4.indicadores_rubrica i ON i.id = ce.id_indicador AND i.estado_registro = 1
              JOIN s4.categorias_rubrica c ON c.id = i.id_categoria AND c.estado_registro = 1
              WHERE ce.id_evaluacion = e.id AND ce.estado_registro = 1
            )
        WHERE e.id = $1 AND e.estado = 'BORRADOR'
        RETURNING id, revision, estado, cerrada_en AS "cerradaEn", calificacion_total AS total
      `, [evaluacion.id, indicadores.length]);
      if (!guardada || (actorCierre && guardada.total == null)) {
        throw new ConflictException('No se pudo confirmar el total de la evaluación.');
      }
      if (actorCierre && tipo === 'ESCRITA') {
        await manager.query(`
          INSERT INTO s4.traspasos_evaluacion_estudiante
            (id_evaluacion, id_estudiante, id_proceso_evaluacion, traspasado_en)
          SELECT $1, e.id, $2, now() FROM gen.estudiante e
          WHERE s4.estudiante_pertenece_asignacion($3, e.id)
          ON CONFLICT DO NOTHING
        `, [evaluacion.id, proceso.id, asignacionId]);
      }
      await manager.query(`
        INSERT INTO s4.eventos_auditoria_evaluacion
          (id_evaluacion, actor_id, accion, detalles, ocurrido_en)
        VALUES ($1, $2, $3, $4::jsonb, now())
      `, [evaluacion.id, actorCierre ?? 'GENARES:LOCAL_DEVELOPMENT',
        actorCierre ? `EVALUACION_${tipo}_CERRADA` : `BORRADOR_${tipo}_GUARDADO`, JSON.stringify({
        revision: guardada.revision, etapa: etapa.kind, modo: 'DESARROLLO_LOCAL',
        ...(actorCierre && {
          idDocente: asignacionTribunal.idDocente,
          idAsignacionTribunal: dto.idAsignacionTribunal,
          cerradaEn: guardada.cerradaEn,
        }),
      })]);
      return { ...guardada, guardado: true };
    });
  }
}
