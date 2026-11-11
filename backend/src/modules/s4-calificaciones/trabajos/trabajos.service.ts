import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export const CONSULTA_TRABAJOS_MER = `
SELECT
  a.id AS id,
  a.id::text AS codigo,
  t.titulo AS titulo,
  COALESCE(p.estado, 'REGISTRADO') AS estado,
  t.carrera_id AS "idCarrera", c.codigo AS "codigoCarrera", c.nombre AS carrera,
  t.periodo_academico_id AS "idPeriodo", pa.codigo AS periodo,
  t.modalidad_id AS "idModalidad", m.codigo AS "codigoModalidad", m.nombre AS modalidad,
  vr.id AS "idVersionRubrica", vr.estado AS "estadoVersionRubrica", r.nombre AS rubrica,
  COALESCE(p.estado_registro, 1)::smallint AS "estadoRegistro",
  a.id AS "asignacionId",
  t.titulo AS "tema",
  CASE WHEN a.grupo_id IS NOT NULL THEN 'Bina o grupo' ELSE 'Individual' END AS "tipoTrabajo",
  a.estado AS "estadoAsignacion",
  p.id AS "procesoId",
  p.estado AS "estadoProceso",
  vr.version AS "versionRubrica",
  (
    SELECT COUNT(*)::integer
    FROM s3.asignacion_tribunal at
    WHERE at.asignacion_tema_id = a.id
  ) AS "evaluadoresAsignados",
  (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', at.asignacion_tribunal_id,
        'idMiembroTribunal', at.asignacion_tribunal_id,
        'idDocente', doc.id, 'nombres', COALESCE(per.nombres, ''), 'apellidos', COALESCE(per.apellidos, ''),
        'nombre', TRIM(CONCAT_WS(' ', per.nombres, per.apellidos))
      ) ORDER BY per.apellidos, per.nombres
    ), '[]'::jsonb)
    FROM s3.asignacion_tribunal at
    JOIN s3.miembros_tribunal mt ON mt.miembro_tribunal_id = at.miembro_tribunal_id
    JOIN s3.docente_carrera_periodo dcp
      ON dcp.docente_carrera_periodo_id = mt.docente_carrera_periodo_id
    JOIN gen.docente doc ON doc.id = dcp.docente_id
    JOIN gen.persona per ON per.id = doc.persona_id
    WHERE at.asignacion_tema_id = a.id
  ) AS "evaluadores",
  (
    SELECT COUNT(DISTINCT e.id_asignacion_tribunal)::integer
    FROM s4.evaluaciones e
    JOIN s3.asignacion_tribunal at ON at.asignacion_tribunal_id = e.id_asignacion_tribunal
      AND at.asignacion_tema_id = a.id
    WHERE e.id_proceso_evaluacion = p.id
      AND e.id_version_rubrica = p.id_version_rubrica
      AND e.estado_registro = 1
      AND e.etapa = 'ESCRITA' AND e.estado = 'CERRADA'
  ) AS "escritasCerradas",
  (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', est.id, 'nombres', COALESCE(persona.nombres, ''), 'apellidos', COALESCE(persona.apellidos, ''),
        'nombre', TRIM(CONCAT_WS(' ', persona.nombres, persona.apellidos))
      ) ORDER BY persona.apellidos, persona.nombres
    ), '[]'::jsonb)
    FROM gen.estudiante est
    JOIN gen.persona persona ON persona.id = est.persona_id
    WHERE est.id = a.estudiante_id
      OR (a.grupo_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM s2.grupo_integrante gi
        WHERE gi.grupo_id = a.grupo_id
          AND gi.estudiante_id = est.id
          AND gi.estado = 'ACTIVO'
      ))
  ) AS "estudiantes",
  (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', ses.id,
        'estadoRegistro', ses.estado_registro,
        'fecha', TO_CHAR(ses.fecha_programada, 'YYYY-MM-DD'),
        'inicio', TO_CHAR(ses.hora_programada, 'HH24:MI'),
        'fin', TO_CHAR(ses.hora_fin_programada, 'HH24:MI'),
        'sala', ses.sala,
        'duracionEstimadaMinutos', ses.duracion_estimada_minutos,
        'creadoEn', ses.creado_en, 'actualizadoEn', ses.actualizado_en,
        'inicioRealEn', real.inicio, 'finalizacionRealEn', real.fin,
        'participantes', COALESCE((
          SELECT jsonb_agg(pe.id_estudiante)
          FROM s4.programacion_estudiante pe WHERE pe.programacion_sustentacion_id = ses.id
            AND pe.estado_registro = 1
        ), '[]'::jsonb),
        'tipo', ses.tipo,
        'estado', ses.estado,
        'cantidadParticipantes', (
          SELECT COUNT(*)::integer
          FROM s4.programacion_estudiante pe
          WHERE pe.programacion_sustentacion_id = ses.id AND pe.estado_registro = 1
        )
      ) ORDER BY ses.fecha_programada, ses.hora_programada
    ), '[]'::jsonb)
    FROM s4.programaciones_sustentacion ses
    LEFT JOIN LATERAL (
      SELECT min(e.ocurrido_en) FILTER (WHERE e.detalles->>'estado_nuevo' = 'EN_SUSTENTACION') AS inicio,
        min(e.ocurrido_en) FILTER (WHERE e.detalles->>'estado_nuevo' = 'FINALIZADA') AS fin
      FROM s4.eventos_trazabilidad_trabajo e
      WHERE e.id_proceso_evaluacion = ses.id_proceso_evaluacion AND e.entidad_id = ses.id
        AND e.entidad_tipo = 'programacion' AND e.fuente_tipo = 'programacion_cambio'
        AND e.detalles->>'estado_nuevo' IS DISTINCT FROM e.detalles->>'estado_anterior'
    ) real ON true
    WHERE ses.id_proceso_evaluacion = p.id AND ses.estado_registro = 1
  ) AS "sesiones",
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'idAsignacion', tut.id, 'idDocente', doc.id,
      'nombres', COALESCE(per.nombres, ''), 'apellidos', COALESCE(per.apellidos, ''),
      'carrera', ct.nombre, 'asignadoEn', tut.fecha_asignacion, 'finalizadoEn', tut.fecha_fin
    ) ORDER BY tut.fecha_fin NULLS FIRST, tut.fecha_asignacion DESC, tut.id), '[]'::jsonb)
    FROM s2.asignacion_tutor tut
    JOIN gen.docente doc ON doc.id = tut.docente_id
    JOIN gen.persona per ON per.id = doc.persona_id
    LEFT JOIN gen.carrera ct ON ct.id = doc.carrera_id
    WHERE tut.asignacion_tema_id = a.id
  ) AS tutores
FROM s2.asignacion_tema a
JOIN gen.tema t ON t.id = a.tema_id
LEFT JOIN s4.procesos_evaluacion p ON p.asignacion_tema_id = a.id
LEFT JOIN s4.versiones_rubrica vr ON vr.id = p.id_version_rubrica AND vr.estado_registro = 1
LEFT JOIN gen.carrera c ON c.id = t.carrera_id
LEFT JOIN gen.periodo_academico pa ON pa.id = t.periodo_academico_id
LEFT JOIN gen.modalidad m ON m.id = t.modalidad_id
LEFT JOIN s4.rubricas r ON r.id = vr.id_rubrica AND r.estado_registro = 1
WHERE ((($1::uuid IS NULL AND a.estado = 'VIGENTE') OR a.id = $1::uuid)
  AND (p.id IS NULL OR p.estado_registro = 1)
  AND (p.id_version_rubrica IS NULL OR vr.id IS NOT NULL)
  AND (vr.id_rubrica IS NULL OR r.id IS NOT NULL))
ORDER BY t.titulo, a.id
`;

interface PersonaMer {
  id: string;
  nombre: string;
  nombres: string;
  apellidos: string;
}

export interface TrabajoMer extends Record<string, unknown> {
  id: string;
  codigo: string;
  titulo: string;
  idCarrera: string | null;
  codigoCarrera: string | null;
  carrera: string | null;
  idPeriodo: string | null;
  periodo: string | null;
  asignacionId: string;
  tema: string;
  tipoTrabajo: string;
  estadoAsignacion: string;
  procesoId: string | null;
  estadoProceso: string | null;
  estadoRegistro: 0 | 1;
  versionRubrica: string | null;
  evaluadoresAsignados: number;
  evaluadores: PersonaMer[];
  escritasCerradas: number;
  estudiantes: PersonaMer[];
  sesiones: {
    id: string;
    fecha: string;
    inicio: string;
    fin: string;
    sala: string | null;
    tipo: string | null;
    estado: string | null;
    estadoRegistro: 0 | 1;
    cantidadParticipantes: number;
    duracionEstimadaMinutos: number;
    participantes: string[];
    creadoEn: string;
    actualizadoEn: string;
    inicioRealEn: string | null;
    finalizacionRealEn: string | null;
  }[];
}

@Injectable()
export class TrabajosService {
  constructor(private readonly dataSource: DataSource) {}

  async listarDesarrolloLocal(actorId: string): Promise<{ elementos: TrabajoMer[] }> {
    this.exigirActorLocal(actorId);
    return { elementos: await this.consultar(null) };
  }

  async detalleDesarrolloLocal(actorId: string, trabajoId: string): Promise<TrabajoMer> {
    this.exigirActorLocal(actorId);
    const [trabajo] = await this.consultar(trabajoId);
    if (!trabajo) throw new NotFoundException('No existe el trabajo solicitado.');
    return trabajo;
  }

  private exigirActorLocal(actorId: string): void {
    if (actorId !== 'GENARES:LOCAL_DEVELOPMENT') {
      throw new ForbiddenException('La consulta general de trabajos solo está disponible en el entorno local de desarrollo.');
    }
  }

  async consultar(trabajoId: string | null): Promise<TrabajoMer[]> {
    const trabajos = await this.dataSource.query<TrabajoMer[]>(CONSULTA_TRABAJOS_MER, [trabajoId]);
    return trabajos.map((trabajo) => {
      const ultimaSesion = trabajo.sesiones.at(-1);
      return {
        ...trabajo,
        estudiantes: trabajo.estudiantes.map((estudiante, i) => ({ ...estudiante, ordenAutoria: i + 1 })),
        miembrosTribunal: trabajo.evaluadores.map((evaluador, i) => ({ ...evaluador, posicion: i + 1 })),
        estadoTribunal: trabajo.evaluadores.length ? 'CONFIRMADO' : null,
        tribunalConfirmadoEn: null,
        programacion: ultimaSesion ? {
          ...ultimaSesion, fechaProgramada: ultimaSesion.fecha, horaProgramada: ultimaSesion.inicio,
        } : null,
      };
    });
  }
}
