import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AlcanceEtapaRubrica, EstadoEvaluacion, EtapaEvaluacion } from '../comun/enums-dominio';
import { InstantaneaRubrica } from '../rubricas/instantanea-rubrica';
import {
  promedioRacional,
  racionalDesdeDecimal,
  redondearRacionalHalfUp,
  serializarRacional,
} from './reglas-consolidacion';
import { CerrarEvaluacionDto } from './dto/cerrar-evaluacion.dto';
import { CrearEvaluacionDto } from './dto/crear-evaluacion.dto';
import { GuardarPuntajesEvaluacionDto } from './dto/guardar-puntajes-evaluacion.dto';

interface EtapaContexto {
  id: string;
  idVersionRubrica: string;
  kind: EtapaEvaluacion;
  scope: AlcanceEtapaRubrica;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  calificacionMaxima: string;
  orden: number;
}

interface IndicadorEsperado {
  id: string;
  label: string;
  calificacionMaxima: string;
  orden: number;
}

interface EvaluadorConsolidacion {
  id: string;
  posicion: number;
}

interface EvaluacionConsolidacion {
  id: string;
  idEtapaRubrica: string;
  idMiembroTribunal: string;
  posicion: number;
  estado: EstadoEvaluacion;
  calificacionTotal: string;
  calificacionMaxima: string;
  idTraspaso: string | null;
  traspasadoEn: Date | null;
  idEstudiante: string | null;
}

const centavosDe = (valor: string, campo: string): bigint => {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(valor)) {
    throw new BadRequestException(`${campo} debe tener como m\u00e1ximo dos decimales.`);
  }
  const [enteros, decimales = ''] = valor.split('.');
  return BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, '0') || '0');
};

const decimalDesdeCentavos = (valor: bigint): string => (
  `${valor / 100n}.${(valor % 100n).toString().padStart(2, '0')}`
);

@Injectable()
export class EvaluacionesService {
  constructor(private readonly dataSource: DataSource) {}

  async crear(
    trabajoId: string,
    dto: CrearEvaluacionDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<Record<string, unknown>> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const [trabajo] = await manager.query(`
          SELECT "id", "id_version_rubrica" AS "idVersionRubrica"
          FROM "trabajos_titulacion" WHERE "id" = $1
        `, [trabajoId]) as Array<{ id: string; idVersionRubrica: string | null }>;
        if (!trabajo) throw new NotFoundException('No existe el trabajo solicitado.');
        if (!trabajo.idVersionRubrica) throw new ConflictException('El trabajo todav\u00eda no tiene una versi\u00f3n de r\u00fabrica fijada.');

        const miembroId = await this.miembroAutorizado(manager, trabajoId, actorId);
        const [etapa] = await manager.query(`
          SELECT "id", "id_version_rubrica" AS "idVersionRubrica", "kind", "scope", "codigo", "nombre",
                 "descripcion", "calificacion_maxima" AS "calificacionMaxima", "orden"
          FROM "etapas_rubrica" WHERE "id" = $1
        `, [dto.idEtapaRubrica]) as EtapaContexto[];
        if (!etapa) throw new NotFoundException('No existe la etapa de r\u00fabrica solicitada.');
        if (etapa.idVersionRubrica !== trabajo.idVersionRubrica) {
          throw new BadRequestException('La etapa no pertenece a la versi\u00f3n fijada al trabajo.');
        }

        const estudianteId = dto.idEstudiante ?? null;
        if (etapa.scope === AlcanceEtapaRubrica.TRABAJO_COMPARTIDO && estudianteId) {
          throw new BadRequestException('Una etapa compartida se eval\u00faa una sola vez por trabajo y miembro del tribunal.');
        }
        if (etapa.scope === AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL && !estudianteId) {
          throw new BadRequestException('La etapa individual requiere un estudiante del trabajo.');
        }
        if (estudianteId && !(await this.estudiantePertenece(manager, trabajoId, estudianteId))) {
          throw new BadRequestException('El estudiante no pertenece al trabajo indicado.');
        }

        const existentes = await manager.query(`
          SELECT "id" FROM "evaluaciones"
          WHERE "id_trabajo" = $1 AND "id_miembro_tribunal" = $2 AND "id_etapa_rubrica" = $3
            AND "id_estudiante" IS NOT DISTINCT FROM $4::uuid
        `, [trabajoId, miembroId, etapa.id, estudianteId]) as Array<{ id: string }>;
        if (existentes[0]) return this.detalle(manager, existentes[0].id);

        const instantanea = await this.crearInstantanea(manager, trabajo.idVersionRubrica);
        const [creada] = await manager.query(`
          INSERT INTO "evaluaciones" (
            "id_trabajo", "id_miembro_tribunal", "id_estudiante", "id_version_rubrica", "id_etapa_rubrica",
            "etapa", "estado", "instantanea_rubrica", "calificacion_total", "instantanea_calificacion_maxima", "revision"
          ) VALUES ($1, $2, $3, $4, $5, $6, 'BORRADOR', $7::jsonb, 0, $8, 1)
          RETURNING "id"
        `, [trabajoId, miembroId, estudianteId, trabajo.idVersionRubrica, etapa.id, etapa.kind,
          JSON.stringify(instantanea), etapa.calificacionMaxima]) as Array<{ id: string }>;
        await this.registrarAuditoria(manager, creada.id, actorId, 'EVALUACION_CREADA', {
          idTrabajo: trabajoId,
          idVersionRubrica: trabajo.idVersionRubrica,
          idEtapaRubrica: etapa.id,
          alcance: etapa.scope,
          idEstudiante: estudianteId,
        }, correlationId);
        return this.detalle(manager, creada.id);
      });
    } catch (error) {
      if (this.codigoPostgres(error) === '23505') {
        throw new ConflictException('Ya existe una evaluaci\u00f3n para esta etapa, trabajo y miembro del tribunal.');
      }
      throw error;
    }
  }

  async guardarPuntajes(
    evaluacionId: string,
    dto: GuardarPuntajesEvaluacionDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<Record<string, unknown>> {
    return this.dataSource.transaction(async (manager) => {
      const evaluacion = await this.evaluacionBloqueada(manager, evaluacionId);
      const miembroId = await this.miembroAutorizado(manager, evaluacion.idTrabajo, actorId);
      if (miembroId !== evaluacion.idMiembroTribunal) {
        throw new ForbiddenException('Solo el miembro asignado puede modificar esta evaluaci\u00f3n.');
      }
      if (evaluacion.estado === EstadoEvaluacion.CERRADA) {
        throw new ConflictException('Una evaluaci\u00f3n cerrada no puede modificarse.');
      }
      if (Number(evaluacion.revision) !== dto.revision) {
        throw new ConflictException('La evaluaci\u00f3n cambi\u00f3 desde la \u00faltima lectura.');
      }

      const idsPuntaje = dto.puntajes.map(({ idIndicador }) => idIndicador.toLowerCase());
      if (new Set(idsPuntaje).size !== idsPuntaje.length) {
        throw new BadRequestException('No se puede repetir un indicador en la misma solicitud.');
      }
      const etapa = await this.resolverEtapa(manager, evaluacion);
      const indicadores = await this.indicadoresDeEtapa(manager, etapa.id);
      const porId = new Map(indicadores.map((indicador) => [indicador.id.toLowerCase(), indicador]));
      const validados = dto.puntajes.map((puntaje) => {
        const indicador = porId.get(puntaje.idIndicador.toLowerCase());
        if (!indicador) throw new BadRequestException('Un indicador no pertenece a la etapa de esta evaluaci\u00f3n.');
        const scoreCents = centavosDe(puntaje.puntaje, 'El puntaje');
        if (scoreCents > centavosDe(indicador.calificacionMaxima, 'El m\u00e1ximo del indicador')) {
          throw new BadRequestException(`El puntaje no puede superar ${indicador.calificacionMaxima}.`);
        }
        return {
          idIndicador: indicador.id,
          puntaje: decimalDesdeCentavos(scoreCents),
          maximo: indicador.calificacionMaxima,
          observacion: puntaje.observacion?.trim() || null,
        };
      });

      const cambiados: typeof validados = [];
      for (const puntaje of validados) {
        const filas = await manager.query(`
          INSERT INTO "calificaciones_evaluacion" (
            "id_evaluacion", "id_indicador", "score", "instantanea_calificacion_maxima", "observation"
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT ("id_evaluacion", "id_indicador") DO UPDATE
            SET "score" = EXCLUDED."score", "instantanea_calificacion_maxima" = EXCLUDED."instantanea_calificacion_maxima",
                "observation" = EXCLUDED."observation"
            WHERE "calificaciones_evaluacion"."score" IS DISTINCT FROM EXCLUDED."score"
              OR "calificaciones_evaluacion"."instantanea_calificacion_maxima" IS DISTINCT FROM EXCLUDED."instantanea_calificacion_maxima"
              OR "calificaciones_evaluacion"."observation" IS DISTINCT FROM EXCLUDED."observation"
          RETURNING "id"
        `, [evaluacionId, puntaje.idIndicador, puntaje.puntaje, puntaje.maximo, puntaje.observacion]) as Array<{ id: string }>;
        if (filas.length) cambiados.push(puntaje);
      }

      if (cambiados.length) {
        const [actualizada] = await manager.query(`
          UPDATE "evaluaciones"
          SET "calificacion_total" = (
                SELECT COALESCE(sum("score"), 0) FROM "calificaciones_evaluacion" WHERE "id_evaluacion" = $1
              ),
              "revision" = "revision" + 1,
              "actualizado_en" = clock_timestamp()
          WHERE "id" = $1
          RETURNING "revision"
        `, [evaluacionId]) as Array<{ revision: number }>;
        await this.registrarAuditoria(manager, evaluacionId, actorId, 'PUNTAJES_EVALUACION_REGISTRADOS', {
          revisionAnterior: Number(evaluacion.revision),
          revision: Number(actualizada.revision),
          puntajes: cambiados,
        }, correlationId);
      }
      return this.detalle(manager, evaluacionId);
    });
  }

  async cerrar(
    evaluacionId: string,
    dto: CerrarEvaluacionDto,
    actorId: string,
    correlationId: string | null,
  ): Promise<Record<string, unknown>> {
    return this.dataSource.transaction(async (manager) => {
      const evaluacion = await this.evaluacionBloqueada(manager, evaluacionId);
      const miembroId = await this.miembroAutorizado(manager, evaluacion.idTrabajo, actorId);
      if (miembroId !== evaluacion.idMiembroTribunal) {
        throw new ForbiddenException('Solo el miembro asignado puede cerrar esta evaluaci\u00f3n.');
      }
      if (evaluacion.estado === EstadoEvaluacion.CERRADA) return this.detalle(manager, evaluacionId);
      if (Number(evaluacion.revision) !== dto.revision) {
        throw new ConflictException('La evaluaci\u00f3n cambi\u00f3 desde la \u00faltima lectura.');
      }

      const etapa = await this.resolverEtapa(manager, evaluacion);
      const esperados = await this.indicadoresDeEtapa(manager, etapa.id);
      const [capturados] = await manager.query(`
        SELECT count(*)::int AS cantidad FROM "calificaciones_evaluacion" WHERE "id_evaluacion" = $1
      `, [evaluacionId]) as Array<{ cantidad: number }>;
      if (esperados.length === 0 || Number(capturados.cantidad) !== esperados.length) {
        throw new BadRequestException('No se puede cerrar una evaluaci\u00f3n con indicadores incompletos.');
      }

      const [cerrada] = await manager.query(`
        UPDATE "evaluaciones"
        SET "estado" = 'CERRADA', "cerrada_en" = clock_timestamp(), "revision" = "revision" + 1,
            "actualizado_en" = clock_timestamp()
        WHERE "id" = $1 RETURNING "revision", "calificacion_total"
      `, [evaluacionId]) as Array<{ revision: number; calificacion_total: string }>;
      const traspasos = evaluacion.idEtapaRubrica
        ? await manager.query('SELECT count(*)::int AS cantidad FROM "traspasos_evaluacion_estudiante" WHERE "id_evaluacion" = $1', [evaluacionId]) as Array<{ cantidad: number }>
        : [{ cantidad: 0 }];
      await this.registrarAuditoria(manager, evaluacionId, actorId, 'EVALUACION_CERRADA', {
        revisionAnterior: Number(evaluacion.revision),
        revision: Number(cerrada.revision),
        calificacionTotal: cerrada.calificacion_total,
        traspasosCreados: Number(traspasos[0]?.cantidad ?? 0),
      }, correlationId);
      return this.detalle(manager, evaluacionId);
    });
  }

  async listarTrabajo(trabajoId: string): Promise<Array<Record<string, unknown>>> {
    const existe = await this.dataSource.query('SELECT 1 FROM "trabajos_titulacion" WHERE "id" = $1', [trabajoId]);
    if (!existe.length) throw new NotFoundException('No existe el trabajo solicitado.');
    const filas = await this.dataSource.query(`
      SELECT "id" FROM "evaluaciones" WHERE "id_trabajo" = $1 ORDER BY "creado_en", "id"
    `, [trabajoId]) as Array<{ id: string }>;
    return Promise.all(filas.map(({ id }) => this.detalle(this.dataSource.manager, id)));
  }

  async listarEstudiante(estudianteId: string, actorId: string): Promise<Array<Record<string, unknown>>> {
    const perfiles = await this.dataSource.query(`
      SELECT perfil."id" FROM "cuentas_usuario" cuenta
      JOIN "perfiles_estudiante" perfil ON perfil."id_persona" = cuenta."id_persona"
      WHERE cuenta."sujeto_autenticacion" = $1 AND cuenta."esta_activo" = true
    `, [actorId]) as Array<{ id: string }>;
    if (!perfiles[0]) throw new ForbiddenException('La identidad no corresponde a un estudiante autenticado.');
    if (perfiles[0].id.toLowerCase() !== estudianteId.toLowerCase()) {
      throw new ForbiddenException('Solo puede consultar sus propias evaluaciones.');
    }
    const filas = await this.dataSource.query(`
      SELECT DISTINCT evaluacion."id",
             CASE WHEN traspaso."id" IS NOT NULL THEN 'TRASPASO_COMPARTIDO' ELSE 'INDIVIDUAL' END AS "relacion"
      FROM "evaluaciones" evaluacion
      LEFT JOIN "traspasos_evaluacion_estudiante" traspaso
        ON traspaso."id_evaluacion" = evaluacion."id" AND traspaso."id_estudiante" = $1
      WHERE evaluacion."estado" = 'CERRADA'
        AND (evaluacion."id_estudiante" = $1 OR traspaso."id" IS NOT NULL)
      ORDER BY evaluacion."id"
    `, [estudianteId]) as Array<{ id: string; relacion: string }>;
    return Promise.all(filas.map(async (fila) => ({
      idEvaluacionOrigen: fila.id,
      relacion: fila.relacion,
      evaluacion: await this.detalle(this.dataSource.manager, fila.id),
    })));
  }

  async consolidarTrabajo(trabajoId: string): Promise<Record<string, unknown>> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => (
      this.consolidarTrabajoEn(manager, trabajoId)
    ));
  }

  async consolidarEstudiante(estudianteId: string, actorId: string): Promise<Record<string, unknown>> {
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      const perfiles = await manager.query(`
        SELECT perfil."id" FROM "cuentas_usuario" cuenta
        JOIN "perfiles_estudiante" perfil ON perfil."id_persona" = cuenta."id_persona"
        WHERE cuenta."sujeto_autenticacion" = $1 AND cuenta."esta_activo" = true
      `, [actorId]) as Array<{ id: string }>;
      if (!perfiles.some(({ id }) => id.toLowerCase() === estudianteId.toLowerCase())) {
        throw new ForbiddenException('Solo puede consultar la consolidación de su propio perfil de estudiante.');
      }

      const [estudiante] = await manager.query(`
        SELECT perfil."id", persona."nombres", persona."surnames" AS "apellidos"
        FROM "perfiles_estudiante" perfil
        JOIN "personas" persona ON persona."id" = perfil."id_persona"
        WHERE perfil."id" = $1
      `, [estudianteId]) as Array<{ id: string; nombres: string; apellidos: string }>;
      if (!estudiante) throw new NotFoundException('No existe el perfil de estudiante solicitado.');

      const trabajos = await manager.query(`
        SELECT "id_trabajo" AS "idTrabajo" FROM "estudiantes_trabajo"
        WHERE "id_estudiante" = $1 ORDER BY "orden_autoria", "id_trabajo"
      `, [estudianteId]) as Array<{ idTrabajo: string }>;
      const consolidacionesEstudiante: Record<string, unknown>[] = [];
      for (const { idTrabajo } of trabajos) {
        const consolidacion = await this.consolidarTrabajoEn(manager, idTrabajo, estudianteId);
        const trabajoEstudiante = (consolidacion.estudiantes as Array<Record<string, unknown>>)[0];
        if (trabajoEstudiante) consolidacionesEstudiante.push(trabajoEstudiante);
      }
      return {
        estudiante,
        modo: 'CONSOLIDACION_DINAMICA',
        incluyeEvaluacionesLegacy: false,
        trabajos: consolidacionesEstudiante,
      };
    });
  }

  private async consolidarTrabajoEn(
    manager: EntityManager,
    trabajoId: string,
    estudianteSolicitadoId?: string,
  ): Promise<Record<string, unknown>> {
    const [trabajo] = await manager.query(`
      SELECT trabajo."id", trabajo."id_version_rubrica" AS "idVersionRubrica",
             version."version", version."estado" AS "estadoVersion",
             modalidad."codigo" AS "codigoModalidad", periodo."codigo" AS "codigoPeriodo"
      FROM "trabajos_titulacion" trabajo
      LEFT JOIN "versiones_rubrica" version ON version."id" = trabajo."id_version_rubrica"
      LEFT JOIN "rubricas" rubrica ON rubrica."id" = version."id_rubrica"
      LEFT JOIN "modalidades" modalidad ON modalidad."id" = rubrica."id_modalidad"
      LEFT JOIN "periodos_academicos" periodo ON periodo."id" = version."periodo_academico_id"
      WHERE trabajo."id" = $1
    `, [trabajoId]) as Array<{
      id: string; idVersionRubrica: string | null; version: string | null; estadoVersion: string | null;
      codigoModalidad: string | null; codigoPeriodo: string | null;
    }>;
    if (!trabajo) throw new NotFoundException('No existe el trabajo solicitado.');
    if (!trabajo.idVersionRubrica) {
      throw new ConflictException('El trabajo no tiene una versión de rúbrica fijada para consolidar.');
    }

    const estudiantes = await manager.query(`
      SELECT perfil."id", persona."nombres", persona."surnames" AS "apellidos", estudiante."orden_autoria" AS "orden"
      FROM "estudiantes_trabajo" estudiante
      JOIN "perfiles_estudiante" perfil ON perfil."id" = estudiante."id_estudiante"
      JOIN "personas" persona ON persona."id" = perfil."id_persona"
      WHERE estudiante."id_trabajo" = $1
      ORDER BY estudiante."orden_autoria", perfil."id"
    `, [trabajoId]) as Array<{ id: string; nombres: string; apellidos: string; orden: number }>;
    if (estudianteSolicitadoId && !estudiantes.some(({ id }) => id.toLowerCase() === estudianteSolicitadoId.toLowerCase())) {
      throw new ForbiddenException('El estudiante no pertenece al trabajo solicitado.');
    }
    const destinatarios = estudianteSolicitadoId
      ? estudiantes.filter(({ id }) => id.toLowerCase() === estudianteSolicitadoId.toLowerCase())
      : estudiantes;

    const [asignacion] = await manager.query(`
      SELECT "id" FROM "asignaciones_tribunal"
      WHERE "id_trabajo" = $1 AND "estado" = 'CONFIRMADO'
    `, [trabajoId]) as Array<{ id: string }>;
    if (!asignacion) throw new ConflictException('El trabajo requiere un tribunal confirmado para consolidar resultados.');
    const evaluadores = await manager.query(`
      SELECT "id", "position" AS "posicion" FROM "miembros_tribunal"
      WHERE "id_asignacion" = $1 ORDER BY "position", "id"
    `, [asignacion.id]) as EvaluadorConsolidacion[];
    if (evaluadores.length !== 2) {
      throw new ConflictException('La consolidación conserva el requisito vigente de dos miembros del tribunal.');
    }

    const etapas = await manager.query(`
      SELECT "id", "kind", "scope", "codigo", "nombre", "descripcion",
             "calificacion_maxima" AS "calificacionMaxima", "orden"
      FROM "etapas_rubrica"
      WHERE "id_version_rubrica" = $1 ORDER BY "orden", "id"
    `, [trabajo.idVersionRubrica]) as EtapaContexto[];
    if (!etapas.length) throw new ConflictException('La versión fijada no contiene etapas consolidables.');

    const [legacy] = await manager.query(`
      SELECT count(*)::int AS "cantidad"
      FROM "evaluaciones"
      WHERE "id_trabajo" = $1 AND "id_version_rubrica" = $2 AND "id_etapa_rubrica" IS NULL
    `, [trabajoId, trabajo.idVersionRubrica]) as Array<{ cantidad: number }>;
    const consolidaciones: Record<string, unknown>[] = [];
    for (const estudiante of destinatarios) {
      const filas = await manager.query(`
        SELECT evaluacion."id", evaluacion."id_etapa_rubrica" AS "idEtapaRubrica",
               evaluacion."id_miembro_tribunal" AS "idMiembroTribunal", miembro."position" AS "posicion",
               evaluacion."estado", evaluacion."calificacion_total" AS "calificacionTotal",
               evaluacion."instantanea_calificacion_maxima" AS "calificacionMaxima",
               traspaso."id" AS "idTraspaso", traspaso."traspasado_en" AS "traspasadoEn",
               evaluacion."id_estudiante" AS "idEstudiante"
        FROM "evaluaciones" evaluacion
        JOIN "miembros_tribunal" miembro
          ON miembro."id" = evaluacion."id_miembro_tribunal" AND miembro."id_asignacion" = $3
        LEFT JOIN "traspasos_evaluacion_estudiante" traspaso
          ON traspaso."id_evaluacion" = evaluacion."id" AND traspaso."id_trabajo" = $1
         AND traspaso."id_estudiante" = $4
        WHERE evaluacion."id_trabajo" = $1 AND evaluacion."id_version_rubrica" = $2
          AND evaluacion."id_etapa_rubrica" = ANY($5::uuid[])
          AND (
            (evaluacion."id_etapa_rubrica" IN (
              SELECT "id" FROM "etapas_rubrica" WHERE "scope" = 'TRABAJO_COMPARTIDO'
            ) AND (evaluacion."estado" = 'BORRADOR' OR traspaso."id" IS NOT NULL))
            OR (evaluacion."id_estudiante" = $4 AND evaluacion."id_etapa_rubrica" IN (
              SELECT "id" FROM "etapas_rubrica" WHERE "scope" = 'ESTUDIANTE_INDIVIDUAL'
            ))
          )
        ORDER BY evaluacion."id_etapa_rubrica", miembro."position", evaluacion."id"
      `, [trabajoId, trabajo.idVersionRubrica, asignacion.id, estudiante.id, etapas.map(({ id }) => id)]) as EvaluacionConsolidacion[];
      const porEtapa = new Map<string, EvaluacionConsolidacion[]>();
      for (const fila of filas) {
        const previas = porEtapa.get(fila.idEtapaRubrica) ?? [];
        previas.push(fila);
        porEtapa.set(fila.idEtapaRubrica, previas);
      }

      let cantidadEvaluaciones = 0;
      let hayEvaluacionEnProgreso = false;
      let todasCompletas = true;
      const etapasCalculadas = etapas.map((etapa) => {
        const fuentes = porEtapa.get(etapa.id) ?? [];
        cantidadEvaluaciones += fuentes.length;
        const porEvaluador = new Map(fuentes.map((fuente) => [fuente.idMiembroTribunal, fuente]));
        const cerradas = evaluadores.flatMap((evaluador) => {
          const fuente = porEvaluador.get(evaluador.id);
          return fuente?.estado === EstadoEvaluacion.CERRADA ? [fuente] : [];
        });
        const borradores = fuentes.filter(({ estado }) => estado === EstadoEvaluacion.BORRADOR);
        const pendientes = evaluadores.flatMap((evaluador) => {
          const fuente = porEvaluador.get(evaluador.id);
          if (fuente?.estado === EstadoEvaluacion.CERRADA) return [];
          return [{
            idMiembroTribunal: evaluador.id,
            posicion: evaluador.posicion,
            causa: fuente ? 'EVALUACION_NO_CERRADA' : 'SIN_EVALUACION',
          }];
        });
        const completa = cerradas.length === evaluadores.length;
        const estado = completa
          ? 'COMPLETA'
          : borradores.length
            ? 'EN_PROGRESO'
            : cerradas.length
              ? 'CERRADA_INCOMPLETA'
              : 'SIN_EVALUACIONES';
        if (!completa) todasCompletas = false;
        if (borradores.length) hayEvaluacionEnProgreso = true;
        const promedio = completa
          ? promedioRacional(cerradas.map(({ calificacionTotal }) => racionalDesdeDecimal(calificacionTotal)))
          : null;
        return {
          id: etapa.id,
          tipo: etapa.kind,
          codigo: etapa.codigo,
          nombre: etapa.nombre,
          descripcion: etapa.descripcion,
          orden: etapa.orden,
          alcance: etapa.scope,
          calificacionMaxima: etapa.calificacionMaxima,
          estado,
          evaluadoresEsperados: evaluadores.map(({ id, posicion }) => ({ idMiembroTribunal: id, posicion })),
          evaluadoresPendientes: pendientes,
          evaluaciones: fuentes.map((fuente) => ({
            id: fuente.id,
            idMiembroTribunal: fuente.idMiembroTribunal,
            posicionEvaluador: fuente.posicion,
            estado: fuente.estado,
            calificacionOriginal: fuente.calificacionTotal,
            calificacionUtilizada: fuente.estado === EstadoEvaluacion.CERRADA ? fuente.calificacionTotal : null,
            maximo: fuente.calificacionMaxima,
            idEstudiante: fuente.idEstudiante,
            procedencia: etapa.scope === AlcanceEtapaRubrica.TRABAJO_COMPARTIDO
              ? fuente.estado === EstadoEvaluacion.CERRADA ? 'EVALUACION_COMPARTIDA_TRASPASADA' : 'EVALUACION_COMPARTIDA_PENDIENTE_DE_CIERRE'
              : 'EVALUACION_INDIVIDUAL',
            traspaso: fuente.idTraspaso
              ? { id: fuente.idTraspaso, traspasadoEn: fuente.traspasadoEn }
              : null,
          })),
          promedioEtapa: promedio
            ? { exacto: serializarRacional(promedio), presentado: redondearRacionalHalfUp(promedio) }
            : null,
        };
      });

      const estado = todasCompletas
        ? 'RESULTADO_COMPLETO'
        : !cantidadEvaluaciones && Number(legacy.cantidad) > 0
          ? 'LEGACY_NO_CONSOLIDADA'
          : !cantidadEvaluaciones
            ? 'SIN_EVALUACIONES'
            : hayEvaluacionEnProgreso
              ? 'EN_PROGRESO'
              : 'EVALUACIONES_CERRADAS_INCOMPLETAS';
      const promediosEtapa = todasCompletas
        ? etapasCalculadas.map((etapa) => {
          const primeraEvaluacion = (porEtapa.get(etapa.id) ?? []).find(({ estado: estadoEval }) => estadoEval === EstadoEvaluacion.CERRADA);
          if (!primeraEvaluacion) throw new ConflictException('No se pudo reconstruir una etapa completa de la versión.');
          return promedioRacional((porEtapa.get(etapa.id) ?? [])
            .filter(({ estado: estadoEval }) => estadoEval === EstadoEvaluacion.CERRADA)
            .map(({ calificacionTotal }) => racionalDesdeDecimal(calificacionTotal)))!;
        })
        : [];
      const finalExacto = todasCompletas ? promedioRacional(promediosEtapa) : null;
      consolidaciones.push({
        estudiante,
        trabajoId,
        versionRubrica: {
          id: trabajo.idVersionRubrica,
          version: trabajo.version,
          estado: trabajo.estadoVersion,
          modalidad: trabajo.codigoModalidad,
          periodo: trabajo.codigoPeriodo,
        },
        modo: Number(legacy.cantidad) && !cantidadEvaluaciones ? 'LEGACY_NO_CONSOLIDADA' : 'CONSOLIDACION_DINAMICA',
        incluyeEvaluacionesLegacy: false,
        evaluacionesLegacyExcluidas: Number(legacy.cantidad),
        cantidadEtapasEsperadas: etapas.length,
        cantidadEvaluadoresEsperados: evaluadores.length,
        estado,
        etapas: etapasCalculadas,
        resultadoFinal: finalExacto ? {
          exacto: serializarRacional(finalExacto),
          calificacion: redondearRacionalHalfUp(finalExacto),
          calificacionMaxima: '10.00',
          escala: '0.00-10.00',
          formula: 'PROMEDIO_ARITMETICO_DE_ETAPAS',
          redondeo: 'HALF_UP_A_DOS_DECIMALES',
        } : null,
      });
    }
    return {
      tipo: 'CONSOLIDACION_INDIVIDUAL_DINAMICA',
      incluyeEvaluacionesLegacy: false,
      trabajoId,
      versionRubrica: consolidaciones[0]?.versionRubrica ?? null,
      estudiantes: consolidaciones,
    };
  }

  private async detalle(manager: EntityManager, evaluacionId: string): Promise<Record<string, unknown>> {
    const filas = await manager.query(`
      SELECT evaluacion."id", evaluacion."id_trabajo" AS "idTrabajo",
             evaluacion."id_miembro_tribunal" AS "idMiembroTribunal",
             evaluacion."id_estudiante" AS "idEstudiante",
             evaluacion."id_version_rubrica" AS "idVersionRubrica",
             evaluacion."id_etapa_rubrica" AS "idEtapaRubrica",
             evaluacion."etapa", evaluacion."estado", evaluacion."revision",
             evaluacion."instantanea_rubrica" AS "instantaneaRubrica",
             evaluacion."calificacion_total" AS "calificacionTotal",
             evaluacion."instantanea_calificacion_maxima" AS "calificacionMaxima",
             evaluacion."cerrada_en" AS "cerradaEn",
             etapa."kind" AS "kindEtapa", etapa."scope" AS "alcanceEtapa",
             etapa."codigo" AS "codigoEtapa", etapa."nombre" AS "nombreEtapa",
             etapa."orden" AS "ordenEtapa"
      FROM "evaluaciones" evaluacion
      LEFT JOIN "etapas_rubrica" etapa ON etapa."id" = COALESCE(
        evaluacion."id_etapa_rubrica",
        (SELECT legacy."id" FROM "etapas_rubrica" legacy
         WHERE legacy."id_version_rubrica" = evaluacion."id_version_rubrica"
           AND legacy."kind" = evaluacion."etapa" ORDER BY legacy."orden" LIMIT 1)
      )
      WHERE evaluacion."id" = $1
    `, [evaluacionId]) as Array<Record<string, unknown>>;
    const evaluacion = filas[0];
    if (!evaluacion) throw new NotFoundException('No existe la evaluaci\u00f3n solicitada.');

    const puntajes = await manager.query(`
      SELECT indicador."id" AS "idIndicador", indicador."label", puntaje."score" AS "puntaje",
             puntaje."instantanea_calificacion_maxima" AS "calificacionMaxima",
             puntaje."observation" AS "observacion", etapa."codigo" AS "codigoEtapa",
             categoria."codigo" AS "codigoCategoria", categoria."orden" AS "ordenCategoria", indicador."orden" AS "ordenIndicador"
      FROM "calificaciones_evaluacion" puntaje
      JOIN "indicadores_rubrica" indicador ON indicador."id" = puntaje."id_indicador"
      JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
      JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
      WHERE puntaje."id_evaluacion" = $1
      ORDER BY etapa."orden", categoria."orden", indicador."orden", indicador."id"
    `, [evaluacionId]) as Array<Record<string, unknown>>;
    const estudiantes = await manager.query(`
      SELECT traspaso."id_estudiante" AS "idEstudiante", traspaso."traspasado_en" AS "traspasadoEn"
      FROM "traspasos_evaluacion_estudiante" traspaso
      WHERE traspaso."id_evaluacion" = $1 ORDER BY traspaso."traspasado_en", traspaso."id_estudiante"
    `, [evaluacionId]) as Array<Record<string, unknown>>;
    const etapaKind = (evaluacion.kindEtapa ?? evaluacion.etapa) as EtapaEvaluacion;
    const alcance = (evaluacion.alcanceEtapa ?? (
      evaluacion.etapa === EtapaEvaluacion.ESCRITA
        ? AlcanceEtapaRubrica.TRABAJO_COMPARTIDO
        : AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL
    )) as AlcanceEtapaRubrica;
    return {
      id: evaluacion.id,
      idTrabajo: evaluacion.idTrabajo,
      idMiembroTribunal: evaluacion.idMiembroTribunal,
      idEstudiante: evaluacion.idEstudiante,
      idVersionRubrica: evaluacion.idVersionRubrica,
      idEtapaRubrica: evaluacion.idEtapaRubrica,
      etapa: etapaKind,
      alcance,
      etapaRubrica: {
        id: evaluacion.idEtapaRubrica ?? null,
        codigo: evaluacion.codigoEtapa ?? null,
        nombre: evaluacion.nombreEtapa ?? null,
        orden: evaluacion.ordenEtapa ?? null,
      },
      estado: evaluacion.estado,
      revision: Number(evaluacion.revision),
      instantaneaRubrica: evaluacion.instantaneaRubrica,
      calificacionTotal: evaluacion.calificacionTotal,
      calificacionMaxima: evaluacion.calificacionMaxima,
      cerradaEn: evaluacion.cerradaEn,
      puntajes: puntajes.map(({ ordenCategoria: _categoria, ordenIndicador: _indicador, ...puntaje }) => puntaje),
      estudiantesTraspasados: estudiantes,
    };
  }

  private async evaluacionBloqueada(manager: EntityManager, evaluacionId: string): Promise<{
    id: string;
    idTrabajo: string;
    idMiembroTribunal: string;
    idEstudiante: string | null;
    idVersionRubrica: string;
    idEtapaRubrica: string | null;
    etapa: EtapaEvaluacion;
    estado: EstadoEvaluacion;
    revision: number;
  }> {
    const filas = await manager.query(`
      SELECT "id", "id_trabajo" AS "idTrabajo", "id_miembro_tribunal" AS "idMiembroTribunal",
             "id_estudiante" AS "idEstudiante", "id_version_rubrica" AS "idVersionRubrica",
             "id_etapa_rubrica" AS "idEtapaRubrica", "etapa", "estado", "revision"
      FROM "evaluaciones" WHERE "id" = $1 FOR UPDATE
    `, [evaluacionId]) as Array<{
      id: string; idTrabajo: string; idMiembroTribunal: string; idEstudiante: string | null;
      idVersionRubrica: string; idEtapaRubrica: string | null; etapa: EtapaEvaluacion;
      estado: EstadoEvaluacion; revision: number;
    }>;
    if (!filas[0]) throw new NotFoundException('No existe la evaluaci\u00f3n solicitada.');
    return filas[0];
  }

  private async resolverEtapa(manager: EntityManager, evaluacion: {
    idVersionRubrica: string; idEtapaRubrica: string | null; etapa: EtapaEvaluacion;
  }): Promise<EtapaContexto> {
    const filas = evaluacion.idEtapaRubrica
      ? await manager.query(`
          SELECT "id", "id_version_rubrica" AS "idVersionRubrica", "kind", "scope", "codigo", "nombre",
                 "descripcion", "calificacion_maxima" AS "calificacionMaxima", "orden"
          FROM "etapas_rubrica" WHERE "id" = $1 AND "id_version_rubrica" = $2
        `, [evaluacion.idEtapaRubrica, evaluacion.idVersionRubrica])
      : await manager.query(`
          SELECT "id", "id_version_rubrica" AS "idVersionRubrica", "kind", "scope", "codigo", "nombre",
                 "descripcion", "calificacion_maxima" AS "calificacionMaxima", "orden"
          FROM "etapas_rubrica" WHERE "id_version_rubrica" = $1 AND "kind" = $2 ORDER BY "orden"
        `, [evaluacion.idVersionRubrica, evaluacion.etapa]);
    if (filas.length !== 1) throw new ConflictException('No se pudo resolver una etapa inequ\u00edvoca para esta evaluaci\u00f3n.');
    return filas[0] as EtapaContexto;
  }

  private async indicadoresDeEtapa(manager: EntityManager, etapaId: string): Promise<IndicadorEsperado[]> {
    return manager.query(`
      SELECT indicador."id", indicador."label", indicador."calificacion_maxima" AS "calificacionMaxima",
             indicador."orden"
      FROM "indicadores_rubrica" indicador
      JOIN "categorias_rubrica" categoria ON categoria."id" = indicador."id_categoria"
      WHERE categoria."id_etapa_rubrica" = $1 ORDER BY categoria."orden", indicador."orden", indicador."id"
    `, [etapaId]) as Promise<IndicadorEsperado[]>;
  }

  private async crearInstantanea(manager: EntityManager, versionId: string): Promise<InstantaneaRubrica> {
    const versiones = await manager.query(`
      SELECT version."id", version."version", version."periodo_academico_id" AS "periodId",
             periodo."codigo" AS "periodCode", rubrica."id" AS "rubricId", rubrica."nombre" AS "rubricName",
             modalidad."codigo" AS "modalityCode"
      FROM "versiones_rubrica" version
      JOIN "rubricas" rubrica ON rubrica."id" = version."id_rubrica"
      JOIN "modalidades" modalidad ON modalidad."id" = rubrica."id_modalidad"
      JOIN "periodos_academicos" periodo ON periodo."id" = version."periodo_academico_id"
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
      FROM "etapas_rubrica" WHERE "id_version_rubrica" = $1 ORDER BY "orden", "id"
    `, [versionId]) as InstantaneaRubrica['stages'];
    const categoriesRows = await manager.query(`
      SELECT categoria."id", categoria."codigo", categoria."nombre", categoria."id_etapa_rubrica" AS "stageId",
             categoria."calificacion_maxima" AS "calificacionMaxima", categoria."orden" AS "categoryOrder",
             indicador."id" AS "indicatorId", indicador."label", indicador."descripcion" AS "indicatorDescription",
             indicador."calificacion_maxima" AS "indicatorMaximum", indicador."orden" AS "indicatorOrder"
      FROM "categorias_rubrica" categoria
      LEFT JOIN "indicadores_rubrica" indicador ON indicador."id_categoria" = categoria."id"
      JOIN "etapas_rubrica" etapa ON etapa."id" = categoria."id_etapa_rubrica"
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

  private async miembroAutorizado(manager: EntityManager, trabajoId: string, actorId: string): Promise<string> {
    const miembros = await manager.query(`
      SELECT miembro."id" FROM "cuentas_usuario" cuenta
      JOIN "perfiles_docente" docente ON docente."id_persona" = cuenta."id_persona"
      JOIN "miembros_tribunal" miembro ON miembro."id_docente" = docente."id"
      JOIN "asignaciones_tribunal" asignacion ON asignacion."id" = miembro."id_asignacion"
      WHERE cuenta."sujeto_autenticacion" = $1 AND cuenta."esta_activo" = true
        AND docente."esta_activo" = true AND asignacion."id_trabajo" = $2 AND asignacion."estado" = 'CONFIRMADO'
    `, [actorId, trabajoId]) as Array<{ id: string }>;
    if (!miembros[0]) throw new ForbiddenException('El evaluador no pertenece al tribunal confirmado de este trabajo.');
    return miembros[0].id;
  }

  private async estudiantePertenece(manager: EntityManager, trabajoId: string, estudianteId: string): Promise<boolean> {
    const filas = await manager.query(`
      SELECT 1 FROM "estudiantes_trabajo" WHERE "id_trabajo" = $1 AND "id_estudiante" = $2
    `, [trabajoId, estudianteId]);
    return filas.length > 0;
  }

  private async registrarAuditoria(
    manager: EntityManager,
    evaluacionId: string,
    actorId: string,
    accion: string,
    detalles: Record<string, unknown>,
    correlationId: string | null,
  ): Promise<void> {
    await manager.query(`
      INSERT INTO "eventos_auditoria_evaluacion" ("id_evaluacion", "actor_id", "accion", "detalles", "correlation_id")
      VALUES ($1, $2, $3, $4::jsonb, $5)
    `, [evaluacionId, actorId, accion, JSON.stringify(detalles), correlationId]);
  }

  private codigoPostgres(error: unknown): string | undefined {
    const errorPg = error as { code?: string; driverError?: { code?: string } };
    return errorPg.driverError?.code ?? errorPg.code;
  }
}
