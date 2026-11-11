import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EstadoTrabajo } from '../../../common/domain/enums-dominio';
import { establecerActorAuditoria } from '../auditoria/contexto-auditoria';
import { pendientesActa } from '../documentos/modelo-documental';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { evaluarFinalizacion } from './finalizacion.reglas';

// Mismo filtro de acceso que Documentos: fuera del acceso local, solo el tribunal del trabajo.
const ACCESO_TRIBUNAL = `EXISTS (
  SELECT 1 FROM s3.asignacion_tribunal at
  JOIN s3.miembros_tribunal m ON m.miembro_tribunal_id = at.miembro_tribunal_id
  JOIN s3.docente_carrera_periodo dc ON dc.docente_carrera_periodo_id = m.docente_carrera_periodo_id
  JOIN gen.docente d ON d.id = dc.docente_id AND d.activo
  JOIN gen.usuario u ON u.id = d.usuario_id AND u.activo
  WHERE at.asignacion_tema_id = a.id AND u.sujeto_autenticacion = $1)`;

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

  /** Condiciones de finalización de un trabajo, calculadas con datos confirmados del servidor. */
  async consultar(trabajoId: string, actor: string, accesoLocal: boolean) {
    const datos = await this.evaluaciones.datosDocumentales(trabajoId, actor, accesoLocal);
    const procesoId = datos.trabajo.procesoId as string;
    const [proceso]: Array<{ estado: string | null }> = await this.db.query(
      'SELECT estado FROM s4.procesos_evaluacion WHERE id = $1 AND estado_registro = 1', [procesoId]);
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
        periodo: datos.trabajo.periodo as string, estado: proceso.estado ?? EstadoTrabajo.REGISTRADO,
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
