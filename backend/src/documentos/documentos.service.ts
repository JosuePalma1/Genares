import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { ActualizarNotaMinimaDto, BuscarActasDto, FormatoActaDto } from './documentos.dto';
import { pendientesActa, resultadoFinalActa, rubricaDocumental } from './modelo-documental';
import { archivarActaEn } from './archivo-actas';
import { pdfActaInterna, pdfActaPreliminar, pdfRubrica } from './pdf-documental';
import { PLANTILLAS } from './plantillas-institucionales';
import { centesimasActa, decimalActaDesdeCentesimas, notaAprobada } from './reglas-acta';

const acceso = `EXISTS (SELECT 1 FROM asignaciones_tribunal a
  JOIN miembros_tribunal m ON m.id_asignacion=a.id
  JOIN perfiles_docente d ON d.id=m.id_docente
  JOIN cuentas_usuario u ON u.id_persona=d.id_persona
  WHERE a.id_trabajo=t.id AND a.estado='CONFIRMADO' AND d.esta_activo AND u.esta_activo
    AND u.sujeto_autenticacion=$1)`;

@Injectable()
export class DocumentosService {
  constructor(private readonly db: DataSource, private readonly evaluaciones: EvaluacionesService) {}

  trabajos(actor: string, puedeConsultarDemostracion = false) {
    return this.db.query(`SELECT t.id,t.codigo,t.titulo,c.nombre AS carrera,p.codigo AS periodo
      FROM trabajos_titulacion t JOIN carreras c ON c.id=t.id_carrera
      JOIN periodos_academicos p ON p.id=t.periodo_academico_id
      WHERE ($2::boolean OR ${acceso}) ORDER BY t.codigo`, [actor, puedeConsultarDemostracion]);
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
      const [actual] = await manager.query(`SELECT valor::text, actualizado_en AS "actualizadoEn", actualizado_por AS "actualizadoPor"
        FROM configuracion_nota_minima WHERE id=1 FOR UPDATE`);
      if (!actual) throw new ConflictException('La configuración académica de nota mínima no está instalada.');
      if (actual.valor === valor) return { notaMinima: actual.valor, provisional: true,
        actualizadoEn: actual.actualizadoEn, actualizadoPor: actual.actualizadoPor, cambio: false };
      const [filasActualizadas] = await manager.query(`UPDATE configuracion_nota_minima
        SET valor=$1, actualizado_en=now(), actualizado_por=$2 WHERE id=1
        RETURNING valor::text AS "valor", actualizado_en AS "actualizadoEn", actualizado_por AS "actualizadoPor"`, [valor, actor]);
      const [actualizada] = filasActualizadas ?? [];
      if (!actualizada) throw new ConflictException('No se pudo guardar la configuraciÃ³n acadÃ©mica de nota mÃ­nima.');
      await manager.query(`INSERT INTO historial_nota_minima(valor_anterior,valor_nuevo,cambiado_por)
        VALUES ($1,$2,$3)`, [actual.valor, valor, actor]);
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
      // Bloquea el umbral durante la emisión para que el PDF y su snapshot coincidan.
      const [configuracion] = await manager.query(`SELECT valor::text FROM configuracion_nota_minima WHERE id=1 FOR SHARE`);
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
    return this.db.query(`SELECT ar.id,ar.numero,ar.formato,ar.revision,ar.generado_en AS "generadoEn",
      ar.nota_final::text AS "notaFinal",ar.nota_minima_aplicada::text AS "notaMinimaAplicada",ar.aprobado,
      p.nombres || ' ' || p.surnames AS estudiante,c.nombre AS carrera,ar.periodo
      FROM actas_archivadas ar JOIN trabajos_titulacion t ON t.id=ar.id_trabajo
      JOIN perfiles_estudiante e ON e.id=ar.id_estudiante JOIN personas p ON p.id=e.id_persona
      JOIN carreras c ON c.id=ar.id_carrera WHERE ($5::boolean OR ${acceso})
      AND ($2::text IS NULL OR strpos(lower(p.nombres || ' ' || p.surnames),lower($2))>0)
      AND ($3::text IS NULL OR c.codigo=$3) AND ($4::text IS NULL OR ar.periodo=$4)
      ORDER BY ar.generado_en DESC`, [actor, filtro.estudiante ?? null, filtro.carrera ?? null, filtro.periodo ?? null, puedeConsultarDemostracion]);
  }

  async archivada(id: string, actor: string, conPdf = false, puedeConsultarDemostracion = false) {
    const [acta] = await this.db.query(`SELECT ar.id,ar.numero,ar.formato,ar.revision,
      ar.generado_en AS "generadoEn",ar.sha256,ar.nota_final::text AS "notaFinal",
      ar.nota_minima_aplicada::text AS "notaMinimaAplicada",ar.aprobado${conPdf ? ',ar.pdf' : ''}
      FROM actas_archivadas ar JOIN trabajos_titulacion t ON t.id=ar.id_trabajo
      WHERE ($3::boolean OR ${acceso}) AND ar.id=$2`, [actor, id, puedeConsultarDemostracion]);
    if (!acta) throw new NotFoundException('No existe el acta solicitada.');
    return acta;
  }

  private async valorNotaMinima(): Promise<{ valor: string; actualizadoEn: Date; actualizadoPor: string }> {
    const [configuracion] = await this.db.query(`SELECT valor::text, actualizado_en AS "actualizadoEn", actualizado_por AS "actualizadoPor"
      FROM configuracion_nota_minima WHERE id=1`);
    if (!configuracion) throw new ConflictException('La configuración académica de nota mínima no está instalada.');
    return configuracion;
  }
}
