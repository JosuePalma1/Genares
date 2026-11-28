export interface ResumenMisEvaluaciones {
  etapas: Array<{
    idEtapa: string;
    tipo: 'ESCRITA' | 'ORAL';
    nombre: string;
    idEstudiante: string | null;
    idEvaluador: string | null;
    requiereSesion: boolean;
    estado: 'PENDIENTE' | 'BORRADOR' | 'CERRADA' | 'NO_ASIGNADA';
  }>;
  conResultado: string[];
}

/** a es un trabajo visible; $14 es el sujeto del evaluador, o NULL para el avance del tribunal. */
export const RESUMEN_MIS_EVALUACIONES = `
LEFT JOIN LATERAL (
  WITH estudiantes AS (
    SELECT a.estudiante_id AS id WHERE a.estudiante_id IS NOT NULL
    UNION
    SELECT gi.estudiante_id FROM s2.grupo_integrante gi
    WHERE gi.grupo_id = a.grupo_id AND gi.estado = 'ACTIVO'
  ), etapas AS (
    SELECT er.id, er.nombre, er.kind, er.scope, er.orden
    FROM s4.etapas_rubrica er
    WHERE er.id_version_rubrica = a.version AND er.estado_registro = 1
      AND ((er.scope = 'TRABAJO_COMPARTIDO' AND er.kind IN ('ESCRITA', 'PERSONALIZADA'))
        OR (er.scope = 'ESTUDIANTE_INDIVIDUAL' AND er.kind IN ('ORAL', 'PERSONALIZADA')))
  ), filas AS (
    SELECT etapa.id AS "idEtapa", etapa.orden,
      CASE WHEN etapa.scope = 'TRABAJO_COMPARTIDO' THEN 'ESCRITA' ELSE 'ORAL' END AS tipo,
      etapa.nombre, titular.id AS "idEstudiante", (etapa.kind = 'ORAL') AS "requiereSesion",
      COALESCE(
        min(puesto.id::text) FILTER (WHERE ev.estado = 'BORRADOR'),
        min(puesto.id::text) FILTER (WHERE ev.estado IS NULL),
        min(puesto.id::text)
      ) AS "idEvaluador",
      CASE
        WHEN count(puesto.id) = 0 THEN 'NO_ASIGNADA'
        WHEN count(ev.estado) FILTER (WHERE ev.estado = 'CERRADA') = count(puesto.id) THEN 'CERRADA'
        WHEN bool_or(ev.estado = 'BORRADOR') THEN 'BORRADOR'
        ELSE 'PENDIENTE'
      END AS estado
    FROM etapas etapa
    CROSS JOIN LATERAL (
      SELECT NULL::uuid AS id WHERE etapa.scope = 'TRABAJO_COMPARTIDO'
      UNION ALL
      SELECT id FROM estudiantes WHERE etapa.scope = 'ESTUDIANTE_INDIVIDUAL'
    ) titular
    LEFT JOIN LATERAL (
      SELECT at.asignacion_tribunal_id AS id
      FROM s3.asignacion_tribunal at
      JOIN s3.miembros_tribunal mt ON mt.miembro_tribunal_id = at.miembro_tribunal_id
      JOIN s3.docente_carrera_periodo dcp ON dcp.docente_carrera_periodo_id = mt.docente_carrera_periodo_id
      LEFT JOIN s4.reemplazos_etapa_actuales re
        ON re.proceso = a.proceso AND re.etapa = etapa.id AND re.puesto = at.asignacion_tribunal_id
      LEFT JOIN gen.docente d ON d.id = COALESCE(re.docente, dcp.docente_id) AND d.activo
      LEFT JOIN gen.usuario u ON u.id = d.usuario_id AND u.activo
      WHERE at.asignacion_tema_id = a.id AND ($14::text IS NULL OR u.sujeto_autenticacion = $14::text)
    ) puesto ON true
    LEFT JOIN LATERAL (
      SELECT e.estado FROM s4.evaluaciones e
      WHERE e.id_proceso_evaluacion = a.proceso AND e.id_version_rubrica = a.version
        AND e.id_etapa_rubrica = etapa.id AND e.id_asignacion_tribunal = puesto.id
        AND e.id_estudiante IS NOT DISTINCT FROM titular.id AND e.estado_registro = 1
      ORDER BY (e.estado = 'CERRADA') DESC, e.creado_en DESC, e.id LIMIT 1
    ) ev ON true
    GROUP BY etapa.id, etapa.nombre, etapa.scope, etapa.kind, etapa.orden, titular.id
  )
  SELECT
    COALESCE((SELECT jsonb_agg(to_jsonb(filas) - 'orden' ORDER BY orden, "idEstudiante", "idEtapa") FROM filas), '[]'::jsonb) AS etapas,
    ARRAY(SELECT estudiantes.id FROM estudiantes WHERE EXISTS (
      SELECT 1 FROM s4.evaluaciones e
      WHERE e.id_proceso_evaluacion = a.proceso AND e.id_version_rubrica = a.version
        AND e.estado_registro = 1 AND e.estado = 'CERRADA' AND e.calificacion_total IS NOT NULL
        AND (e.id_estudiante IS NULL OR e.id_estudiante = estudiantes.id)
    )) AS "conResultado"
) resumen ON true
`;
