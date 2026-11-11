import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { ActualizarNotaMinimaDto, BuscarActasDto, FormatoActaDto } from './documentos.dto';
import { pendientesActa, resultadoFinalActa, rubricaDocumental } from './modelo-documental';
import { archivarActaEn } from './archivo-actas';
import { pdfActaInterna, pdfActaPreliminar, pdfRubrica } from './pdf-documental';
import { PLANTILLAS } from './plantillas-institucionales';
import { centesimasActa, decimalActaDesdeCentesimas, notaAprobada } from './reglas-acta';
import { establecerActorAuditoria } from '../auditoria/contexto-auditoria';

const acceso = `EXISTS (
  SELECT 1 FROM s3.asignacion_tribunal a
  JOIN s3.miembros_tribunal m ON m.miembro_tribunal_id = a.miembro_tribunal_id
  JOIN s3.docente_carrera_periodo dc ON dc.docente_carrera_periodo_id = m.docente_carrera_periodo_id
  JOIN gen.docente d ON d.id = dc.docente_id AND d.activo
  JOIN gen.usuario u ON u.id = d.usuario_id AND u.activo
  WHERE a.asignacion_tema_id = t.id AND u.sujeto_autenticacion = $1)`;

@Injectable()
export class DocumentosService {
  constructor(private readonly db: DataSource, private readonly evaluaciones: EvaluacionesService) {}

  trabajos(actor: string, puedeConsultarDemostracion = false) {
    return this.db.query(`SELECT t.id, t.id::text AS codigo, tema.titulo, c.nombre AS carrera, p.codigo AS periodo
      FROM s2.asignacion_tema t JOIN gen.tema tema ON tema.id = t.tema_id
      JOIN s4.procesos_evaluacion proceso ON proceso.asignacion_tema_id = t.id
      JOIN s4.versiones_rubrica version ON version.id = proceso.id_version_rubrica AND version.estado_registro = 1
      JOIN s4.rubricas rubrica ON rubrica.id = version.id_rubrica AND rubrica.estado_registro = 1
      JOIN gen.carrera c ON c.id = tema.carrera_id
      JOIN gen.periodo_academico p ON p.id = tema.periodo_academico_id
      WHERE t.estado = 'VIGENTE' AND proceso.estado_registro = 1 AND proceso.id_version_rubrica IS NOT NULL
        AND ($2::boolean OR ${acceso}) ORDER BY tema.titulo, t.id`, [actor, puedeConsultarDemostracion]);
  }

  async contexto(trabajoId: string, actor: string, puedeEmitirDocumentos = false, puedeConsultarDemostracion = false) {
    const [datos, configuracion] = await Promise.all([
      this.evaluaciones.datosDocumentales(trabajoId, actor, puedeConsultarDemostracion),
      this.valorNotaMinima(),
    ]);
    return { trabajo: datos.trabajo, estudiantes: datos.estudiantes, evaluadores: datos.evaluadores,
      notaMinimaProvisional: configuracion.valor,
      actas: datos.estudiantes.map((estudiante: { id: string }) => {
        const pendientes = pendientesActa(datos, estudiante.id);
        const resultado = resultadoFinalActa(datos, estudiante.id);
        return { estudianteId: estudiante.id, estadoConsolidacion: (datos.consolidacion.estudiantes as Array<Record<string, any>>)
          .find((c) => c.estudiante.id === estudiante.id)?.estado ?? 'SIN_EVALUACIONES',
          calificacionFinal: resultado?.calificacion ?? null, escala: resultado?.calificacionMaxima ?? '10.00',
          notaMinimaProvisional: configuracion.valor,
          aprobadoProvisional: resultado?.calificacion ? notaAprobada(resultado.calificacion, configuracion.valor) : null,
          puedeEmitir: puedeEmitirDocumentos && pendientes.length === 0, pendientes };
      }) };
  }

  async configuracionNotaMinima(puedeEditar = false) {
    const configuracion = await this.valorNotaMinima();
    return { notaMinima: configuracion.valor, provisional: true, actualizadoEn: configuracion.actualizadoEn,
      ...(puedeEditar ? { actualizadoPor: configuracion.actualizadoPor } : {}), puedeEditar };
  }

  async actualizarNotaMinima(dto: ActualizarNotaMinimaDto, actor: string) {
    const centesimas = centesimasActa(dto.notaMinima, 'La nota mínima');
    const valor = decimalActaDesdeCentesimas(centesimas);
    return this.db.transaction(async (manager) => {
      await establecerActorAuditoria(manager, actor);
      const [actual] = await manager.query(`SELECT valor::text, actualizado_en AS "actualizadoEn", actualizado_por AS "actualizadoPor"
        FROM s4.configuracion_nota_minima WHERE id=1 FOR UPDATE`);
      if (!actual) throw new ConflictException('La configuración académica de nota mínima no está instalada.');
      if (actual.valor === valor) return { notaMinima: actual.valor, provisional: true,
        actualizadoEn: actual.actualizadoEn, actualizadoPor: actual.actualizadoPor, cambio: false };
      const [filasActualizadas] = await manager.query(`UPDATE s4.configuracion_nota_minima
        SET valor=$1, actualizado_en=now(), actualizado_por=$2 WHERE id=1
        RETURNING valor::text AS "valor", actualizado_en AS "actualizadoEn", actualizado_por AS "actualizadoPor"`, [valor, actor]);
      const [actualizada] = filasActualizadas ?? [];
      if (!actualizada) throw new ConflictException('No se pudo guardar la configuración académica de nota mínima.');
      await manager.query(`INSERT INTO s4.historial_nota_minima(id,valor_anterior,valor_nuevo,cambiado_en,cambiado_por)
        SELECT COALESCE(max(id), 0) + 1, $1, $2, now(), $3 FROM s4.historial_nota_minima`, [actual.valor, valor, actor]);
      return { notaMinima: actualizada.valor, provisional: true, actualizadoEn: actualizada.actualizadoEn,
        actualizadoPor: actualizada.actualizadoPor, cambio: true };
    });
  }

  async rubrica(trabajoId: string, estudianteId: string, miembroId: string, actor: string, puedeConsultarDemostracion = false) {
    return rubricaDocumental(await this.evaluaciones.datosDocumentales(trabajoId, actor, puedeConsultarDemostracion), estudianteId, miembroId);
  }

  async rubricaPdf(trabajoId: string, estudianteId: string, miembroId: string, actor: string, puedeConsultarDemostracion = false) {
    return pdfRubrica(await this.rubrica(trabajoId, estudianteId, miembroId, actor, puedeConsultarDemostracion));
  }

  async preliminar(trabajoId: string, estudianteId: string, formato: FormatoActaDto['formato'], actor: string, puedeConsultarDemostracion = false) {
    const datos = await this.evaluaciones.datosDocumentales(trabajoId, actor, puedeConsultarDemostracion);
    const pendientes = pendientesActa(datos, estudianteId);
    const configuracion = await this.valorNotaMinima();
    return pdfActaPreliminar(datos, estudianteId, formato, pendientes, configuracion.valor);
  }

  async emitir(trabajoId: string, estudianteId: string, dto: FormatoActaDto, actor: string, puedeConsultarDemostracion = false) {
    const datos = await this.evaluaciones.datosDocumentales(trabajoId, actor, puedeConsultarDemostracion);
    const pendientes = pendientesActa(datos, estudianteId);
    if (pendientes.length) throw new ConflictException({ message: 'No se puede generar todavía el documento interno.', details: pendientes });
    const resultado = resultadoFinalActa(datos, estudianteId);
    if (!resultado?.calificacion || resultado.calificacionMaxima !== '10.00') {
      throw new ConflictException({ message: 'No existe una calificación final consolidada válida sobre 10.00.', details: [] });
    }

    return this.db.transaction(async (manager) => {
      await establecerActorAuditoria(manager, actor);
      // Bloquea el umbral durante la emisión para que el PDF y su snapshot coincidan.
      const [configuracion] = await manager.query(`SELECT valor::text FROM s4.configuracion_nota_minima WHERE id=1 FOR SHARE`);
      if (!configuracion) throw new ConflictException('La configuración académica de nota mínima no está instalada.');
      const aprobado = notaAprobada(resultado.calificacion, configuracion.valor);
      const trabajo = datos.trabajo;
      const estudiante = estudianteId;
      const acta = await archivarActaEn(manager, {
        trabajoId, estudianteId: estudiante, carreraId: trabajo.carreraId, periodoId: trabajo.periodoId,
        periodo: trabajo.periodo, carreraCodigo: trabajo.carreraCodigo, formato: dto.formato, actor,
        notaFinal: resultado.calificacion, notaMinimaAplicada: configuracion.valor, aprobado,
      }, (numero) => pdfActaInterna(datos, estudiante, dto.formato, numero,
        resultado.calificacion, configuracion.valor, aprobado));
      return acta;
    });
  }

  listar(actor: string, filtro: BuscarActasDto, puedeConsultarDemostracion = false) {
    return this.db.query(`SELECT ar.id,ar.estado_registro AS "estadoRegistro",ar.numero,ar.formato,ar.revision,ar.generado_en AS "generadoEn",
      ar.nota_final::text AS "notaFinal",ar.nota_minima_aplicada::text AS "notaMinimaAplicada",ar.aprobado,
      p.nombres || ' ' || p.apellidos AS estudiante,c.nombre AS carrera,ar.periodo
      FROM s4.actas_archivadas ar
      JOIN s4.procesos_evaluacion proceso ON proceso.id = ar.id_proceso_evaluacion AND proceso.estado_registro = 1
      JOIN s2.asignacion_tema t ON t.id = proceso.asignacion_tema_id
      JOIN gen.estudiante e ON e.id=ar.id_estudiante JOIN gen.persona p ON p.id=e.persona_id
      JOIN gen.carrera c ON c.id=ar.id_carrera WHERE ar.estado_registro = 1 AND ($5::boolean OR ${acceso})
      AND ($2::text IS NULL OR strpos(lower(p.nombres || ' ' || p.apellidos),lower($2))>0)
      AND ($3::text IS NULL OR c.codigo=$3) AND ($4::text IS NULL OR ar.periodo=$4)
      ORDER BY ar.generado_en DESC`, [actor, filtro.estudiante ?? null, filtro.carrera ?? null, filtro.periodo ?? null, puedeConsultarDemostracion]);
  }

  async archivada(id: string, actor: string, conPdf = false, puedeConsultarDemostracion = false) {
    const [acta] = await this.db.query(`SELECT ar.id,ar.numero,ar.formato,ar.revision,
      ar.generado_en AS "generadoEn",ar.sha256,ar.nota_final::text AS "notaFinal",
      ar.nota_minima_aplicada::text AS "notaMinimaAplicada",ar.aprobado${conPdf ? ',ar.pdf' : ''}
      FROM s4.actas_archivadas ar
      JOIN s4.procesos_evaluacion proceso ON proceso.id = ar.id_proceso_evaluacion AND proceso.estado_registro = 1
      JOIN s2.asignacion_tema t ON t.id = proceso.asignacion_tema_id
      WHERE ar.estado_registro = 1 AND ($3::boolean OR ${acceso}) AND ar.id=$2`, [actor, id, puedeConsultarDemostracion]);
    if (!acta) throw new NotFoundException('No existe el acta solicitada.');
    return acta;
  }

  private async valorNotaMinima(): Promise<{ valor: string; actualizadoEn: Date; actualizadoPor: string }> {
    const [configuracion] = await this.db.query(`SELECT valor::text, actualizado_en AS "actualizadoEn", actualizado_por AS "actualizadoPor"
      FROM s4.configuracion_nota_minima WHERE id=1`);
    if (!configuracion) throw new ConflictException('La configuración académica de nota mínima no está instalada.');
    return configuracion;
  }
}
