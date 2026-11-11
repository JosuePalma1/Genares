import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConsultarTrabajosDto } from './consultar-trabajos.dto';
import { leerPaginacion, normalizarBusqueda, periodoAplicado, TODOS_LOS_PERIODOS } from './paginacion-trabajos';

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
  AND ($2::uuid[] IS NULL OR a.id = ANY($2::uuid[]))
  AND (p.id IS NULL OR p.estado_registro = 1)
  AND (p.id_version_rubrica IS NULL OR vr.id IS NOT NULL)
  AND (vr.id_rubrica IS NULL OR r.id IS NOT NULL))
ORDER BY t.titulo, a.id
`;

/** Mismo universo que CONSULTA_TRABAJOS_MER; solo filtra y ordena para paginar en el servidor. */
export const FILTRO_TRABAJOS_MER = `
FROM s2.asignacion_tema a
JOIN gen.tema t ON t.id = a.tema_id
LEFT JOIN s4.procesos_evaluacion p ON p.asignacion_tema_id = a.id
LEFT JOIN s4.versiones_rubrica vr ON vr.id = p.id_version_rubrica AND vr.estado_registro = 1
LEFT JOIN gen.carrera c ON c.id = t.carrera_id
LEFT JOIN gen.periodo_academico pa ON pa.id = t.periodo_academico_id
LEFT JOIN gen.modalidad m ON m.id = t.modalidad_id
LEFT JOIN s4.rubricas r ON r.id = vr.id_rubrica AND r.estado_registro = 1
WHERE a.estado = 'VIGENTE'
  AND (p.id IS NULL OR p.estado_registro = 1)
  AND (p.id_version_rubrica IS NULL OR vr.id IS NOT NULL)
  AND (vr.id_rubrica IS NULL OR r.id IS NOT NULL)
  AND ($1::text IS NULL OR pa.codigo = $1::text)
`;

/** Minúsculas y sin tildes, igual que normalizarBusqueda en el servidor y en el frontend. */
const normalizarSql = (expresion: string) => `translate(lower(${expresion}),
  'áàäâéèëêíìïîóòöôúùüûñçÁÀÄÂÉÈËÊÍÌÏÎÓÒÖÔÚÙÜÛÑÇ', 'aaaaeeeeiiiioooouuuuncaaaaeeeeiiiioooouuuunc')`;

/** Nombres de los estudiantes de la asignación `a` (individual o bina activa en S2). */
const NOMBRES_ESTUDIANTES = `(SELECT string_agg(concat_ws(' ', per.nombres, per.apellidos), ' ')
     FROM gen.estudiante est JOIN gen.persona per ON per.id = est.persona_id
     WHERE est.id = a.estudiante_id
       OR (a.grupo_id IS NOT NULL AND EXISTS (SELECT 1 FROM s2.grupo_integrante gi
         WHERE gi.grupo_id = a.grupo_id AND gi.estudiante_id = est.id AND gi.estado = 'ACTIVO')))`;

/** Nombres de los tutores registrados en S2 para la asignación `a`. */
const NOMBRES_TUTORES = `(SELECT string_agg(concat_ws(' ', per.nombres, per.apellidos), ' ')
     FROM s2.asignacion_tutor tut JOIN gen.docente doc ON doc.id = tut.docente_id
     JOIN gen.persona per ON per.id = doc.persona_id WHERE tut.asignacion_tema_id = a.id)`;

/** Nombres de los integrantes del tribunal de S3 para la asignación `a`. */
const NOMBRES_TRIBUNAL = `(SELECT string_agg(concat_ws(' ', per.nombres, per.apellidos), ' ')
     FROM s3.asignacion_tribunal at
     JOIN s3.miembros_tribunal mt ON mt.miembro_tribunal_id = at.miembro_tribunal_id
     JOIN s3.docente_carrera_periodo dcp ON dcp.docente_carrera_periodo_id = mt.docente_carrera_periodo_id
     JOIN gen.docente doc ON doc.id = dcp.docente_id JOIN gen.persona per ON per.id = doc.persona_id
     WHERE at.asignacion_tema_id = a.id)`;

/**
 * Texto buscable: código, título, carrera, modalidad, periodo, estudiantes, tutores y tribunal.
 * Usa los alias a (asignación), t (tema), c (carrera), m (modalidad) y pa (periodo); también lo usa Finalización.
 */
export const TEXTO_BUSCABLE_TRABAJO = normalizarSql(`concat_ws(' ', a.id::text, t.titulo, c.nombre, m.nombre, pa.codigo,
  ${NOMBRES_ESTUDIANTES},
  ${NOMBRES_TUTORES},
  ${NOMBRES_TRIBUNAL})`);

export const CONSULTA_PAGINA_TRABAJOS_MER = `
WITH filtrados AS (
  SELECT a.id, t.titulo
  ${FILTRO_TRABAJOS_MER}
    AND ($2::text IS NULL OR COALESCE(p.estado, 'REGISTRADO') = $2::text)
    AND ($3::text IS NULL OR ($3::text = 'con') = EXISTS (
      SELECT 1 FROM s3.asignacion_tribunal at
      JOIN s3.miembros_tribunal mt ON mt.miembro_tribunal_id = at.miembro_tribunal_id
      JOIN s3.docente_carrera_periodo dcp ON dcp.docente_carrera_periodo_id = mt.docente_carrera_periodo_id
      JOIN gen.docente doc ON doc.id = dcp.docente_id JOIN gen.persona per ON per.id = doc.persona_id
      WHERE at.asignacion_tema_id = a.id))
    AND ($4::text IS NULL OR strpos(${TEXTO_BUSCABLE_TRABAJO}, $4::text) > 0)
    AND ($7::text IS NULL OR c.codigo = $7::text)
    -- RF-13: filtros específicos, combinables con los anteriores.
    AND ($8::text IS NULL OR m.codigo = $8::text)
    AND ($9::text IS NULL OR strpos(${normalizarSql(`COALESCE(${NOMBRES_ESTUDIANTES}, '')`)}, $9::text) > 0)
    AND ($10::text IS NULL OR strpos(${normalizarSql("COALESCE(t.titulo, '')")}, $10::text) > 0)
    AND ($11::text IS NULL OR strpos(${normalizarSql(`COALESCE(${NOMBRES_TUTORES}, '')`)}, $11::text) > 0)
)
SELECT
  (SELECT count(*)::integer FROM filtrados) AS total,
  COALESCE((SELECT array_agg(pagina.id ORDER BY pagina.titulo, pagina.id) FROM (
    SELECT id, titulo FROM filtrados ORDER BY titulo, id LIMIT $5 OFFSET $6
  ) pagina), '{}'::uuid[]) AS ids
`;

const CONSULTA_ESTADOS_TRABAJOS_MER = `
SELECT DISTINCT COALESCE(p.estado, 'REGISTRADO') AS estado
${FILTRO_TRABAJOS_MER}
ORDER BY 1
`;

/** Carreras y modalidades presentes en el periodo consultado, para los selectores de RF-13. */
export const CONSULTA_CATALOGOS_TRABAJOS_MER = `
SELECT
  COALESCE((SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'nombre', nombre) ORDER BY nombre, codigo)
    FROM (SELECT DISTINCT c.codigo, c.nombre ${FILTRO_TRABAJOS_MER} AND c.codigo IS NOT NULL) x), '[]'::jsonb) AS carreras,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'nombre', nombre) ORDER BY nombre, codigo)
    FROM (SELECT DISTINCT m.codigo, m.nombre ${FILTRO_TRABAJOS_MER} AND m.codigo IS NOT NULL) x), '[]'::jsonb) AS modalidades
`;

export const CONSULTA_PERIODOS = `
SELECT pa.codigo, pa.nombre, pa.activo
FROM gen.periodo_academico pa
ORDER BY pa.activo DESC, pa.fecha_inicio DESC NULLS LAST, pa.codigo DESC
`;

export interface PaginaTrabajosMer {
  elementos: TrabajoMer[];
  paginacion: { pagina: number; limite: number; total: number; paginas: number };
  filtros: {
    periodo: string;
    periodos: Array<{ codigo: string; nombre: string | null; activo: boolean }>;
    estados: string[];
    carreras: CatalogosTrabajos['carreras'];
    modalidades: CatalogosTrabajos['modalidades'];
  };
}

interface CatalogosTrabajos {
  carreras: Array<{ codigo: string; nombre: string | null }>;
  modalidades: Array<{ codigo: string; nombre: string | null }>;
}

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

  /** Una página filtrada en el servidor: evita descargar todos los trabajos acumulados. */
  async listarPaginaDesarrolloLocal(actorId: string, filtros: ConsultarTrabajosDto): Promise<PaginaTrabajosMer> {
    this.exigirActorLocal(actorId);
    const { limite, pagina, desplazamiento } = leerPaginacion(filtros.limite, filtros.pagina);
    const periodos = await this.dataSource.query<PaginaTrabajosMer['filtros']['periodos']>(CONSULTA_PERIODOS);
    const periodo = periodoAplicado(filtros.periodo, periodos);
    const [[{ total, ids }], estados, [catalogos]] = await Promise.all([
      this.dataSource.query<Array<{ total: number; ids: string[] }>>(CONSULTA_PAGINA_TRABAJOS_MER, [
        periodo, filtros.estado ?? null, filtros.tribunal ?? null,
        normalizarBusqueda(filtros.buscar), limite, desplazamiento, filtros.carrera ?? null,
        filtros.modalidad ?? null, normalizarBusqueda(filtros.estudiante),
        normalizarBusqueda(filtros.tema), normalizarBusqueda(filtros.tutor),
      ]),
      this.dataSource.query<Array<{ estado: string }>>(CONSULTA_ESTADOS_TRABAJOS_MER, [periodo]),
      this.dataSource.query<Array<CatalogosTrabajos>>(CONSULTA_CATALOGOS_TRABAJOS_MER, [periodo]),
    ]);
    const porId = new Map((ids.length ? await this.consultar(null, ids) : []).map((trabajo) => [trabajo.id, trabajo]));
    return {
      elementos: ids.map((id) => porId.get(id)).filter((trabajo): trabajo is TrabajoMer => Boolean(trabajo)),
      paginacion: { pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)) },
      filtros: {
        periodo: periodo ?? TODOS_LOS_PERIODOS, periodos, estados: estados.map(({ estado }) => estado),
        carreras: catalogos?.carreras ?? [], modalidades: catalogos?.modalidades ?? [],
      },
    };
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

  async consultar(trabajoId: string | null, ids: string[] | null = null): Promise<TrabajoMer[]> {
    const trabajos = await this.dataSource.query<TrabajoMer[]>(CONSULTA_TRABAJOS_MER, [trabajoId, ids]);
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
