import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

type TrabajoConsulta = Record<string, unknown>;

@Injectable()
export class TrabajosService {
  constructor(private readonly dataSource: DataSource) {}

  async listarDesarrolloLocal(actorId: string): Promise<{ elementos: TrabajoConsulta[] }> {
    this.exigirActorLocal(actorId);
    return { elementos: await this.consultar(null) };
  }

  async detalleDesarrolloLocal(actorId: string, trabajoId: string): Promise<TrabajoConsulta> {
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

  private consultar(trabajoId: string | null): Promise<TrabajoConsulta[]> {
    return this.dataSource.query(`
      SELECT trabajo."id", trabajo."codigo", trabajo."titulo", trabajo."estado"::text AS "estado",
             carrera."id" AS "idCarrera", carrera."codigo" AS "codigoCarrera", carrera."nombre" AS "carrera",
             periodo."id" AS "idPeriodo", periodo."codigo" AS "periodo",
             modalidad."id" AS "idModalidad", modalidad."codigo" AS "codigoModalidad", modalidad."nombre" AS "modalidad",
             version."id" AS "idVersionRubrica", version."version" AS "versionRubrica",
             version."estado"::text AS "estadoVersionRubrica", rubrica."nombre" AS "rubrica",
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'id', estudiante."id", 'nombres', persona."nombres", 'apellidos', persona."surnames",
                 'ordenAutoria', integrante."orden_autoria"
               ) ORDER BY integrante."orden_autoria", estudiante."id")
               FROM "estudiantes_trabajo" integrante
               JOIN "perfiles_estudiante" estudiante ON estudiante."id" = integrante."id_estudiante"
               JOIN "personas" persona ON persona."id" = estudiante."id_persona"
               WHERE integrante."id_trabajo" = trabajo."id"
             ), '[]'::jsonb) AS "estudiantes",
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'idAsignacion', asignacion."id", 'idDocente', docente."id",
                 'nombres', persona."nombres", 'apellidos', persona."surnames",
                 'carrera', carrera_docente."nombre", 'asignadoEn', asignacion."asignada_en",
                 'finalizadoEn', asignacion."finalizada_en"
               ) ORDER BY asignacion."finalizada_en" NULLS FIRST, asignacion."asignada_en" DESC, asignacion."id")
               FROM "asignaciones_tutor_trabajo" asignacion
               JOIN "perfiles_docente" docente ON docente."id" = asignacion."id_docente"
               JOIN "personas" persona ON persona."id" = docente."id_persona"
               LEFT JOIN "carreras" carrera_docente ON carrera_docente."id" = docente."id_carrera"
               WHERE asignacion."id_trabajo" = trabajo."id"
             ), '[]'::jsonb) AS "tutores",
             (
               SELECT asignacion."estado"::text
               FROM "asignaciones_tribunal" asignacion
               WHERE asignacion."id_trabajo" = trabajo."id"
               ORDER BY asignacion."creado_en" DESC, asignacion."id" DESC
               LIMIT 1
             ) AS "estadoTribunal",
             (
               SELECT CASE WHEN asignacion."estado" = 'CONFIRMADO' THEN asignacion."confirmada_en" ELSE NULL END
               FROM "asignaciones_tribunal" asignacion
               WHERE asignacion."id_trabajo" = trabajo."id"
               ORDER BY asignacion."creado_en" DESC, asignacion."id" DESC
               LIMIT 1
             ) AS "tribunalConfirmadoEn",
             COALESCE((
               SELECT jsonb_agg(jsonb_build_object(
                 'idMiembroTribunal', miembro."id", 'posicion', miembro."position",
                 'nombres', persona."nombres", 'apellidos', persona."surnames"
               ) ORDER BY miembro."position", miembro."id")
               FROM "asignaciones_tribunal" asignacion
               JOIN "miembros_tribunal" miembro ON miembro."id_asignacion" = asignacion."id"
               JOIN "perfiles_docente" docente ON docente."id" = miembro."id_docente"
               JOIN "personas" persona ON persona."id" = docente."id_persona"
               WHERE asignacion."id" = (
                 SELECT actual."id"
                 FROM "asignaciones_tribunal" actual
                 WHERE actual."id_trabajo" = trabajo."id"
                 ORDER BY actual."creado_en" DESC, actual."id" DESC
                 LIMIT 1
               )
                 AND asignacion."estado" = 'CONFIRMADO'
             ), '[]'::jsonb) AS "miembrosTribunal",
             (
               SELECT jsonb_build_object(
                 'id', programacion."id", 'fechaProgramada', programacion."fecha_programada"::text,
                 'horaProgramada', to_char(programacion."hora_programada", 'HH24:MI'),
                 'sala', programacion."sala", 'duracionEstimadaMinutos', programacion."duracion_estimada_minutos",
                 'estado', programacion."estado"::text
               )
               FROM "programaciones_sustentacion" programacion
               WHERE programacion."id_trabajo" = trabajo."id"
               ORDER BY programacion."creado_en" DESC, programacion."id"
               LIMIT 1
             ) AS "programacion"
      FROM "trabajos_titulacion" trabajo
      JOIN "carreras" carrera ON carrera."id" = trabajo."id_carrera"
      JOIN "periodos_academicos" periodo ON periodo."id" = trabajo."periodo_academico_id"
      JOIN "modalidades" modalidad ON modalidad."id" = trabajo."id_modalidad"
      LEFT JOIN "versiones_rubrica" version ON version."id" = trabajo."id_version_rubrica"
      LEFT JOIN "rubricas" rubrica ON rubrica."id" = version."id_rubrica"
      WHERE $1::uuid IS NULL OR trabajo."id" = $1::uuid
      ORDER BY periodo."codigo" DESC, carrera."codigo", trabajo."codigo", trabajo."id"
    `, [trabajoId]);
  }
}
