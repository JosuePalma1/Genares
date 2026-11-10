import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { InstantaneaRubrica } from '../rubricas/instantanea-rubrica';
import { TrabajosService } from '../trabajos/trabajos.service';
import { EvaluacionesMerService } from './mer/evaluaciones-mer.service';

@Injectable()
export class EvaluacionesService {
  constructor(private readonly dataSource: DataSource, private readonly trabajos: TrabajosService,
    private readonly mer: EvaluacionesMerService) {}

  async listarTrabajosDesarrolloLocal(actorId: string): Promise<{ elementos: Array<Record<string, unknown>> }> {
    return this.trabajos.listarDesarrolloLocal(actorId);
  }

  /** Una sola instantánea de lectura; conserva el control por tribunal de 10.1. */
  async datosDocumentales(trabajoId: string, actorId: string, puedeConsultarDemostracion = false) {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      if (!puedeConsultarDemostracion) {
        const [acceso] = await manager.query(`
          SELECT 1 FROM s3.asignacion_tribunal a
          JOIN s3.miembros_tribunal m ON m.miembro_tribunal_id = a.miembro_tribunal_id
          JOIN s3.docente_carrera_periodo dcp ON dcp.docente_carrera_periodo_id = m.docente_carrera_periodo_id
          JOIN gen.docente d ON d.id = dcp.docente_id AND d.activo
          JOIN gen.usuario u ON u.id = d.usuario_id AND u.activo
          WHERE a.asignacion_tema_id = $1 AND u.sujeto_autenticacion = $2
        `, [trabajoId, actorId]);
        if (!acceso) throw new ForbiddenException('No tiene acceso a los documentos de este trabajo.');
      }

      const expediente = await this.mer.obtenerExpediente(trabajoId, manager);
      const [trabajo] = await manager.query(`
        SELECT a.id, a.id::text AS codigo, t.titulo, p.id AS "procesoId",
          c.id AS "carreraId", c.codigo AS "carreraCodigo", c.nombre AS carrera,
          pa.id AS "periodoId", pa.codigo AS periodo, m.nombre AS modalidad
        FROM s2.asignacion_tema a JOIN gen.tema t ON t.id = a.tema_id
        JOIN s4.procesos_evaluacion p ON p.asignacion_tema_id = a.id
        LEFT JOIN gen.carrera c ON c.id = t.carrera_id
        LEFT JOIN gen.periodo_academico pa ON pa.id = t.periodo_academico_id
        LEFT JOIN gen.modalidad m ON m.id = t.modalidad_id
        WHERE a.id = $1
      `, [trabajoId]);
      const estudiantes: Array<{ id: string; nombres: string; apellidos: string; identificacion: string }> = await manager.query(`
        SELECT e.id, p.nombres, p.apellidos, p.identificacion
        FROM gen.estudiante e JOIN gen.persona p ON p.id = e.persona_id
        WHERE e.id = ANY($1::uuid[]) ORDER BY p.apellidos, p.nombres, e.id
      `, [expediente.estudiantes.map(({ id }) => id)]);
      const evaluadores: Array<{ id: string; nombres: string; apellidos: string; posicion: number }> = await manager.query(`
        SELECT a.asignacion_tribunal_id AS id, p.nombres, p.apellidos,
          row_number() OVER (ORDER BY p.apellidos, p.nombres, a.asignacion_tribunal_id)::int AS posicion
        FROM s3.asignacion_tribunal a
        JOIN s3.miembros_tribunal m ON m.miembro_tribunal_id = a.miembro_tribunal_id
        JOIN s3.docente_carrera_periodo dc ON dc.docente_carrera_periodo_id = m.docente_carrera_periodo_id
        JOIN gen.docente d ON d.id = dc.docente_id JOIN gen.persona p ON p.id = d.persona_id
        WHERE a.asignacion_tema_id = $1 ORDER BY posicion
      `, [trabajoId]);
      const [tutor] = await manager.query(`
        SELECT p.nombres, p.apellidos FROM s2.asignacion_tutor a
        JOIN gen.docente d ON d.id = a.docente_id JOIN gen.persona p ON p.id = d.persona_id
        WHERE a.asignacion_tema_id = $1 AND a.fecha_fin IS NULL
        ORDER BY a.fecha_asignacion DESC, a.id LIMIT 1
      `, [trabajoId]);
      const evaluaciones: Array<Record<string, unknown>> = await manager.query(`
        SELECT e.id, e.estado, COALESCE(e.revision, 0) AS revision, e.cerrada_en AS "cerradaEn", e.id_version_rubrica AS "idVersionRubrica",
          e.id_etapa_rubrica AS "idEtapaRubrica", e.id_estudiante AS "idEstudiante",
          e.id_asignacion_tribunal AS "idMiembroTribunal", e.calificacion_total AS "calificacionTotal",
          CASE WHEN jsonb_typeof(e.instantanea_rubrica->'stages') = 'array'
            AND jsonb_typeof(e.instantanea_rubrica->'categories') = 'array'
            THEN e.instantanea_rubrica END AS "instantaneaRubrica",
          COALESCE((SELECT jsonb_agg(jsonb_build_object('idIndicador', c.id_indicador, 'puntaje', c.score::text, 'observacion', c.observation))
            FROM s4.calificaciones_evaluacion c WHERE c.id_evaluacion = e.id), '[]') AS puntajes,
          COALESCE((SELECT jsonb_agg(jsonb_build_object('idEstudiante', t.id_estudiante))
            FROM s4.traspasos_evaluacion_estudiante t WHERE t.id_evaluacion = e.id), '[]') AS "estudiantesTraspasados"
        FROM s4.evaluaciones e WHERE e.id_proceso_evaluacion = $1 ORDER BY e.creado_en, e.id
      `, [expediente.procesoId]);
      const consolidacion = { estudiantes: estudiantes.map((estudiante) => ({
        estudiante,
        ...expediente.consolidados.find(({ idEstudiante }) => idEstudiante === estudiante.id),
      })) };
      return { trabajo, estudiantes, evaluadores, tutor: tutor ?? null,
        rubrica: await this.crearInstantanea(manager, expediente.idVersionRubrica), evaluaciones, consolidacion };
    });
  }

  async listarTrabajo(trabajoId: string, actor: string, accesoLocal: boolean) {
    const datos = await this.datosDocumentales(trabajoId, actor, accesoLocal);
    const indicadores = new Map(datos.rubrica.categories.flatMap((c) => c.indicators.map((i) => [i.id, i])));
    return datos.evaluaciones.flatMap((evaluacion) => {
      const estructura = (evaluacion.instantaneaRubrica as InstantaneaRubrica | null) ?? datos.rubrica;
      const etapa = estructura.stages.find(({ id }) => id === evaluacion.idEtapaRubrica);
      if (!etapa) return [];
      return [{
        ...evaluacion, idTrabajo: trabajoId,
        etapaRubrica: etapa, alcance: etapa.scope, calificacionMaxima: etapa.calificacionMaxima,
        instantaneaRubrica: estructura,
        puntajes: (evaluacion.puntajes as { idIndicador: string; puntaje: string | null; observacion: string | null }[])
          .flatMap((puntaje) => {
            const indicador = indicadores.get(puntaje.idIndicador);
            return indicador && puntaje.puntaje != null ? [{
              ...puntaje, label: indicador.label, calificacionMaxima: indicador.calificacionMaxima,
            }] : [];
          }),
      }];
    });
  }

  async contextoEvaluador(trabajoId: string, actor: string, idMiembroTribunal?: string, accesoLocal = false) {
    const datos = await this.datosDocumentales(trabajoId, actor, accesoLocal);
    const miembrosTribunal = datos.evaluadores.map(({ id, ...miembro }) => ({ idMiembroTribunal: id, ...miembro }));
    const seleccionado = idMiembroTribunal
      ? miembrosTribunal.find((miembro) => miembro.idMiembroTribunal === idMiembroTribunal)
      : miembrosTribunal[0];
    if (!seleccionado) throw new NotFoundException('No existe el integrante del tribunal solicitado.');
    return { ...seleccionado, miembrosTribunal, puedeCalificar: false };
  }

  async consolidarTrabajo(trabajoId: string, actorId: string, puedeConsultarDemostracion = false): Promise<Record<string, unknown>> {
    const datos = await this.datosDocumentales(trabajoId, actorId, puedeConsultarDemostracion);
    const trabajo = { id: trabajoId, codigo: datos.trabajo.codigo, titulo: datos.trabajo.titulo };
    const versionRubrica = { id: datos.rubrica.rubricVersionId, version: datos.rubrica.version };
    return {
      tipo: 'CONSOLIDACION_INDIVIDUAL_DINAMICA', trabajoId, trabajo, versionRubrica,
      estudiantes: datos.consolidacion.estudiantes.map((resultado) => ({
        ...resultado, trabajo, trabajoId, versionRubrica,
        etapas: resultado.etapas?.map((etapa) => ({ ...etapa, alcance: etapa.scope, tipo: etapa.kind })),
      })),
    };
  }

  private async crearInstantanea(manager: EntityManager, versionId: string): Promise<InstantaneaRubrica> {
    const versiones = await manager.query(`
      SELECT version."id", version."version", version."periodo_academico_id" AS "periodId",
             periodo."codigo" AS "periodCode", rubrica."id" AS "rubricId", rubrica."nombre" AS "rubricName",
             modalidad."codigo" AS "modalityCode"
      FROM s4.versiones_rubrica version
      JOIN s4.rubricas rubrica ON rubrica."id" = version."id_rubrica"
      JOIN gen.modalidad modalidad ON modalidad."id" = rubrica."id_modalidad"
      JOIN gen.periodo_academico periodo ON periodo."id" = version."periodo_academico_id"
      WHERE version."id" = $1
    `, [versionId]) as Array<{
      id: string; version: string; periodId: string; periodCode: string; rubricId: string;
      rubricName: string; modalityCode: string;
    }>;
    const version = versiones[0];
    if (!version) throw new NotFoundException('No existe la versi\u00f3n de r\u00fabrica del trabajo.');
    const stages = await manager.query(`
      SELECT "id", "kind", "scope", "codigo", "nombre", "descripcion",
             "calificacion_maxima" AS "calificacionMaxima", "porcentaje", "orden"
      FROM s4.etapas_rubrica WHERE "id_version_rubrica" = $1 ORDER BY "orden", "id"
    `, [versionId]) as InstantaneaRubrica['stages'];
    const categoriesRows = await manager.query(`
      SELECT categoria."id", categoria."codigo", categoria."nombre", categoria."id_etapa_rubrica" AS "stageId",
             categoria."calificacion_maxima" AS "calificacionMaxima", categoria."orden" AS "categoryOrder",
             indicador."id" AS "indicatorId", indicador."label", COALESCE(indicador."descripcion", '') AS "indicatorDescription" ,
             indicador."calificacion_maxima" AS "indicatorMaximum", indicador."orden" AS "indicatorOrder"
      FROM s4.categorias_rubrica categoria
      LEFT JOIN s4.indicadores_rubrica indicador ON indicador."id_categoria" = categoria."id"
      JOIN s4.etapas_rubrica etapa ON etapa."id" = categoria."id_etapa_rubrica"
      WHERE categoria."id_version_rubrica" = $1
      ORDER BY etapa."orden", categoria."orden", indicador."orden"
    `, [versionId]) as Array<{
      id: string; codigo: string; nombre: string; stageId: string; calificacionMaxima: string; categoryOrder: number;
      indicatorId: string | null; label: string | null; indicatorDescription: string | null;
      indicatorMaximum: string | null; indicatorOrder: number | null;
    }>;
    const categories = new Map<string, InstantaneaRubrica['categories'][number]>();
    for (const row of categoriesRows) {
      let category = categories.get(row.id);
      if (!category) {
        category = {
          id: row.id,
          codigo: row.codigo,
          nombre: row.nombre,
          stageId: row.stageId,
          calificacionMaxima: row.calificacionMaxima,
          orden: row.categoryOrder,
          indicators: [],
        };
        categories.set(row.id, category);
      }
      if (row.indicatorId && row.label !== null && row.indicatorDescription !== null
        && row.indicatorMaximum !== null && row.indicatorOrder !== null) {
        category.indicators.push({
          id: row.indicatorId,
          label: row.label,
          descripcion: row.indicatorDescription,
          calificacionMaxima: row.indicatorMaximum,
          orden: row.indicatorOrder,
        });
      }
    }
    return {
      rubricId: version.rubricId,
      rubricVersionId: version.id,
      rubricName: version.rubricName,
      version: version.version,
      academicPeriodCode: version.periodCode,
      modalityCode: version.modalityCode,
      stages,
      categories: [...categories.values()],
    };
  }

}
