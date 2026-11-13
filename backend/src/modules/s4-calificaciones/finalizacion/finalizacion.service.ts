import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EstadoTrabajo } from '../../../common/domain/enums-dominio';
import { establecerActorAuditoria } from '../auditoria/contexto-auditoria';
import { pendientesActa } from '../documentos/modelo-documental';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { CONSULTA_PERIODOS, ESTADO_CALCULADO_TRABAJO, TEXTO_BUSCABLE_TRABAJO } from '../trabajos/trabajos.service';
import { leerPaginacion, normalizarBusqueda, periodoAplicado, TODOS_LOS_PERIODOS } from '../trabajos/paginacion-trabajos';
import { ConsultarFinalizacionDto } from './consultar-finalizacion.dto';
import { evaluarFinalizacion } from './finalizacion.reglas';

// Mismo filtro de acceso que Documentos: fuera del acceso local, solo el tribunal del trabajo.
const ACCESO_TRIBUNAL = `EXISTS (
  SELECT 1 FROM s3.asignacion_tribunal at
  JOIN s3.miembros_tribunal m ON m.miembro_tribunal_id = at.miembro_tribunal_id
  JOIN s3.docente_carrera_periodo dc ON dc.docente_carrera_periodo_id = m.docente_carrera_periodo_id
  JOIN gen.docente d ON d.id = dc.docente_id AND d.activo
  JOIN gen.usuario u ON u.id = d.usuario_id AND u.activo
  WHERE at.asignacion_tema_id = a.id AND u.sujeto_autenticacion = $1)`;

/** Cada elemento exige una consulta documental completa: páginas cortas. */
export const LIMITE_FINALIZACION_PREDETERMINADO = 10;
export const LIMITE_FINALIZACION_MAXIMO = 25;
/** Consultas documentales simultáneas por página, para no ocupar todo el pool de conexiones. */
const CONSULTAS_SIMULTANEAS = 4;

/**
 * Mismo universo que `listar`, filtrado y paginado en PostgreSQL. Solo se calculan después
 * las condiciones de los trabajos de la página.
 * $1 actor · $2 acceso local · $3 periodo · $4 situación · $5 búsqueda · $6 límite · $7 desplazamiento.
 */
export const CONSULTA_PAGINA_FINALIZACION = `
WITH filtrados AS (
  SELECT a.id, t.titulo
  FROM s2.asignacion_tema a
  JOIN gen.tema t ON t.id = a.tema_id
  JOIN s4.procesos_evaluacion p ON p.asignacion_tema_id = a.id AND p.estado_registro = 1
  JOIN s4.versiones_rubrica vr ON vr.id = p.id_version_rubrica AND vr.estado_registro = 1
  LEFT JOIN gen.carrera c ON c.id = t.carrera_id
  LEFT JOIN gen.periodo_academico pa ON pa.id = t.periodo_academico_id
  LEFT JOIN gen.modalidad m ON m.id = t.modalidad_id
  WHERE a.estado = 'VIGENTE' AND ($2::boolean OR ${ACCESO_TRIBUNAL})
    AND ($3::text IS NULL OR pa.codigo = $3::text)
    AND ($4::text IS NULL OR ($4::text = 'finalizados') = (COALESCE(p.estado, '') = '${EstadoTrabajo.FINALIZADO}'))
    AND ($5::text IS NULL OR strpos(${TEXTO_BUSCABLE_TRABAJO}, $5::text) > 0)
)
SELECT
  (SELECT count(*)::integer FROM filtrados) AS total,
  COALESCE((SELECT array_agg(pagina.id ORDER BY pagina.titulo, pagina.id) FROM (
    SELECT id, titulo FROM filtrados ORDER BY titulo, id LIMIT $6 OFFSET $7
  ) pagina), '{}'::uuid[]) AS ids
`;

@Injectable()
export class FinalizacionService {
  constructor(private readonly db: DataSource, private readonly evaluaciones: EvaluacionesService) {}

  /** Lista los trabajos vigentes con sus condiciones de finalización. */
  async listar(actor: string, accesoLocal: boolean) {
    const trabajos: Array<{ id: string }> = await this.db.query(`
      SELECT a.id
      FROM s2.asignacion_tema a
      JOIN gen.tema tema ON tema.id = a.tema_id
      JOIN s4.procesos_evaluacion p ON p.asignacion_tema_id = a.id AND p.estado_registro = 1
      JOIN s4.versiones_rubrica vr ON vr.id = p.id_version_rubrica AND vr.estado_registro = 1
      WHERE a.estado = 'VIGENTE' AND ($2::boolean OR ${ACCESO_TRIBUNAL})
      ORDER BY tema.titulo, a.id`, [actor, accesoLocal]);
    const elementos = [];
    for (const { id } of trabajos) elementos.push(await this.consultar(id, actor, accesoLocal));
    return { elementos };
  }

  /** Una página filtrada: solo calcula las condiciones de los trabajos que se van a mostrar. */
  async listarPagina(actor: string, accesoLocal: boolean, filtros: ConsultarFinalizacionDto) {
    const { limite, pagina, desplazamiento } = leerPaginacion(filtros.limite, filtros.pagina, {
      predeterminado: LIMITE_FINALIZACION_PREDETERMINADO, maximo: LIMITE_FINALIZACION_MAXIMO,
    });
    const periodos: Array<{ codigo: string; nombre: string | null; activo: boolean }> = await this.db.query(CONSULTA_PERIODOS);
    const periodo = periodoAplicado(filtros.periodo, periodos);
    const [{ total, ids }]: Array<{ total: number; ids: string[] }> = await this.db.query(CONSULTA_PAGINA_FINALIZACION, [
      actor, accesoLocal, periodo, filtros.situacion ?? null, normalizarBusqueda(filtros.buscar), limite, desplazamiento,
    ]);
    return {
      elementos: await this.consultarVarios(ids, actor, accesoLocal),
      paginacion: { pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)) },
      filtros: { periodo: periodo ?? TODOS_LOS_PERIODOS, periodos },
    };
  }

  /** Consulta varios trabajos con concurrencia limitada y conserva el orden recibido. */
  private async consultarVarios(ids: string[], actor: string, accesoLocal: boolean) {
    const resultado: Array<Awaited<ReturnType<FinalizacionService['consultar']>>> = new Array(ids.length);
    let siguiente = 0;
    const trabajar = async () => {
      while (siguiente < ids.length) {
        const indice = siguiente++;
        resultado[indice] = await this.consultar(ids[indice], actor, accesoLocal);
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONSULTAS_SIMULTANEAS, ids.length) }, trabajar));
    return resultado;
  }

  /** Condiciones de finalización de un trabajo, calculadas con datos confirmados del servidor. */
  async consultar(trabajoId: string, actor: string, accesoLocal: boolean) {
    const datos = await this.evaluaciones.datosDocumentales(trabajoId, actor, accesoLocal);
    const procesoId = datos.trabajo.procesoId as string;
    // estado: el guardado (decide si ya está finalizado); estadoCalculado: el que se muestra (Paso 1 §3.1).
    const [proceso]: Array<{ estado: string | null; estadoCalculado?: string | null }> = await this.db.query(`
      SELECT p.estado, estado_calculado.estado AS "estadoCalculado"
      FROM s4.procesos_evaluacion p
      JOIN s2.asignacion_tema a ON a.id = p.asignacion_tema_id
      LEFT JOIN s4.versiones_rubrica vr ON vr.id = p.id_version_rubrica AND vr.estado_registro = 1
      ${ESTADO_CALCULADO_TRABAJO}
      WHERE p.id = $1 AND p.estado_registro = 1`, [procesoId]);
    if (!proceso) throw new NotFoundException('No existe un proceso de evaluación vigente para este trabajo.');
    const conActa = new Set((await this.db.query(`
      SELECT DISTINCT id_estudiante AS "idEstudiante" FROM s4.actas_archivadas
      WHERE id_proceso_evaluacion = $1 AND estado_registro = 1`, [procesoId]) as Array<{ idEstudiante: string }>)
      .map(({ idEstudiante }) => idEstudiante));

    const evaluacion = evaluarFinalizacion({
      estadoProceso: proceso.estado,
      estudiantes: datos.estudiantes.map((estudiante: { id: string; nombres: string; apellidos: string }) => ({
        id: estudiante.id,
        nombre: `${estudiante.nombres} ${estudiante.apellidos}`.trim(),
        pendientesActa: pendientesActa(datos, estudiante.id),
        actaArchivada: conActa.has(estudiante.id),
      })),
    });
    return {
      trabajo: {
        id: datos.trabajo.id as string, titulo: datos.trabajo.titulo as string,
        carrera: datos.trabajo.carrera as string, codigoCarrera: datos.trabajo.carreraCodigo as string,
        periodo: datos.trabajo.periodo as string, estado: proceso.estadoCalculado ?? proceso.estado ?? EstadoTrabajo.REGISTRADO,
      },
      ...evaluacion,
    };
  }

  /**
   * Finaliza el trabajo. Bloquea el proceso, vuelve a comprobar todas las condiciones con
   * datos confirmados y registra el evento en la trazabilidad del trabajo.
   */
  async finalizar(trabajoId: string, actor: string, accesoLocal: boolean) {
    await this.db.transaction(async (manager) => {
      const correlacion = await establecerActorAuditoria(manager, actor);
      const [proceso]: Array<{ id: string }> = await manager.query(`
        SELECT id FROM s4.procesos_evaluacion
        WHERE asignacion_tema_id = $1 AND estado_registro = 1 FOR UPDATE`, [trabajoId]);
      if (!proceso) throw new NotFoundException('No existe un proceso de evaluación vigente para este trabajo.');

      const evaluacion = await this.consultar(trabajoId, actor, accesoLocal);
      if (!evaluacion.puedeFinalizar) {
        throw new ConflictException({
          message: 'El trabajo no cumple las condiciones para finalizarse.',
          details: [...evaluacion.pendientesTrabajo,
            ...evaluacion.estudiantes.flatMap((e) => e.pendientes.map((p) => `${e.nombre}: ${p}`))],
        });
      }

      await manager.query(`
        UPDATE s4.procesos_evaluacion SET estado = $2, actualizado_en = clock_timestamp()
        WHERE id = $1`, [proceso.id, EstadoTrabajo.FINALIZADO]);
      await manager.query(`
        INSERT INTO s4.eventos_trazabilidad_trabajo
          (id_proceso_evaluacion, ocurrido_en, tipo_evento, entidad_tipo, entidad_id, actor_id,
           actor_tipo, origen, correlation_id, detalles, evidencia, fuente_tipo, fuente_id)
        VALUES ($1, clock_timestamp(), 'TRABAJO_FINALIZADO', 'trabajo', $1, $2,
          'USUARIO', 'SEGUIMIENTO', $3, $4::jsonb, 'DIRECTA', 'finalizacion_trabajo', gen_random_uuid())`,
      [proceso.id, actor, correlacion, JSON.stringify({ estudiantes: evaluacion.estudiantes.map((e) => e.idEstudiante) })]);
    });
    return this.consultar(trabajoId, actor, accesoLocal);
  }
}
