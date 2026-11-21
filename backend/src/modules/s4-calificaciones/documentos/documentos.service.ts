import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EvaluacionesService } from '../evaluaciones/evaluaciones.service';
import { ActualizarNotaMinimaDto, BuscarActasDto, BuscarTrabajosDocumentosDto, FormatoActaDto } from './documentos.dto';
import { CONSULTA_PERIODOS } from '../trabajos/trabajos.service';
import { leerPaginacion, periodoAplicado, TODOS_LOS_PERIODOS } from '../trabajos/paginacion-trabajos';
import { pendientesActa, resultadoFinalActa, rubricaDocumental } from './modelo-documental';
import { archivarActaEn } from './archivo-actas';
import { nombreArchivoPdf } from './nombre-archivo-pdf';
import { pdfActaInterna, pdfActaPreliminar, pdfRubrica } from './pdf-documental';
import { PLANTILLAS } from './plantillas-institucionales';
import { centesimasActa, decimalActaDesdeCentesimas, notaAprobada, notaMinimaEnEscala } from './reglas-acta';
import { establecerActorAuditoria } from '../auditoria/contexto-auditoria';
import { accesoPorAlcance, conAlcance } from '../../../common/api/contexto-alcance';

const acceso = `EXISTS (
  SELECT 1 FROM s3.asignacion_tribunal a
  JOIN s3.miembros_tribunal m ON m.miembro_tribunal_id = a.miembro_tribunal_id
  JOIN s3.docente_carrera_periodo dc ON dc.docente_carrera_periodo_id = m.docente_carrera_periodo_id
  JOIN gen.docente d ON d.id = dc.docente_id AND d.activo
  JOIN gen.usuario u ON u.id = d.usuario_id AND u.activo
  WHERE a.asignacion_tema_id = t.id AND u.sujeto_autenticacion = $1)`;

// Fuera del acceso local: el tribunal del trabajo o, para roles por carrera, las carreras del usuario.
const accesoAmbito = `(${acceso} OR ${accesoPorAlcance('t', 'c.codigo')})`;

@Injectable()
export class DocumentosService {
  constructor(private readonly db: DataSource, private readonly evaluaciones: EvaluacionesService) {}

  /** Selector de trabajos. Con `periodo` filtra (por defecto `ACTIVO`) y devuelve también los periodos. */
  async trabajosPorPeriodo(actor: string, filtro: BuscarTrabajosDocumentosDto, puedeConsultarDemostracion = false) {
    if (filtro.periodo === undefined) return this.trabajos(actor, puedeConsultarDemostracion);
    const periodos: Array<{ codigo: string; nombre: string | null; activo: boolean }> = await this.db.query(CONSULTA_PERIODOS);
    const periodo = periodoAplicado(filtro.periodo === 'ACTIVO' ? undefined : filtro.periodo, periodos);
    return {
      elementos: await this.trabajos(actor, puedeConsultarDemostracion, periodo),
      periodo: periodo ?? TODOS_LOS_PERIODOS,
      periodos,
    };
  }

  trabajos(actor: string, puedeConsultarDemostracion = false, periodo: string | null = null) {
    return this.db.query(...conAlcance(`SELECT t.id, t.id::text AS codigo, tema.titulo, c.nombre AS carrera, p.codigo AS periodo
      FROM s2.asignacion_tema t JOIN gen.tema tema ON tema.id = t.tema_id
      JOIN s4.procesos_evaluacion proceso ON proceso.asignacion_tema_id = t.id
      JOIN s4.versiones_rubrica version ON version.id = proceso.id_version_rubrica AND version.estado_registro = 1
      JOIN s4.rubricas rubrica ON rubrica.id = version.id_rubrica AND rubrica.estado_registro = 1
      JOIN gen.carrera c ON c.id = tema.carrera_id
      JOIN gen.periodo_academico p ON p.id = tema.periodo_academico_id
      WHERE t.estado = 'VIGENTE' AND proceso.estado_registro = 1 AND proceso.id_version_rubrica IS NOT NULL
        AND ($2::boolean OR ${accesoAmbito}) AND ($3::text IS NULL OR p.codigo = $3::text)
      ORDER BY tema.titulo, t.id`, [actor, puedeConsultarDemostracion, periodo]));
  }

  async contexto(trabajoId: string, actor: string, puedeEmitirDocumentos = false, puedeConsultarDemostracion = false) {
    const [datos, configuracion] = await Promise.all([
      this.evaluaciones.datosDocumentales(trabajoId, actor, puedeConsultarDemostracion),
      this.valorNotaMinima(trabajoId),
    ]);
    const escala = datos.rubrica.escalaFinal ?? 10;
    const umbral = notaMinimaEnEscala(configuracion.valor, escala);
    return { trabajo: datos.trabajo, estudiantes: datos.estudiantes, evaluadores: datos.evaluadores,
      notaMinimaProvisional: umbral,
      actas: datos.estudiantes.map((estudiante: { id: string }) => {
        const pendientes = pendientesActa(datos, estudiante.id);
        const resultado = resultadoFinalActa(datos, estudiante.id);
        return { estudianteId: estudiante.id, estadoConsolidacion: (datos.consolidacion.estudiantes as Array<Record<string, any>>)
          .find((c) => c.estudiante.id === estudiante.id)?.estado ?? 'SIN_EVALUACIONES',
          calificacionFinal: resultado?.calificacion ?? null, escala: escala.toFixed(2),
          notaMinimaProvisional: umbral,
          aprobadoProvisional: resultado?.calificacion ? notaAprobada(resultado.calificacion, umbral, escala) : null,
          puedeEmitir: puedeEmitirDocumentos && pendientes.length === 0, pendientes };
      }) };
  }

  async configuracionNotaMinima(puedeEditar = false) {
    const configuracion = await this.valorNotaMinima();
    return { notaMinima: configuracion.valor, provisional: true, actualizadoEn: configuracion.actualizadoEn,
      ...(puedeEditar ? { actualizadoPor: configuracion.actualizadoPor } : {}), puedeEditar };
  }

  async actualizarNotaMinima(dto: ActualizarNotaMinimaDto, actor: string) {
    const centesimas = centesimasActa(dto.notaMinima, 'La nota mínima porcentual', 100);
    const valor = decimalActaDesdeCentesimas(centesimas);
    return this.db.transaction(async (manager) => {
      await establecerActorAuditoria(manager, actor);
      const [actual] = await manager.query(`SELECT porcentaje::text AS valor, actualizado_en AS "actualizadoEn", actualizado_por AS "actualizadoPor"
        FROM s4.configuracion_nota_minima WHERE id=1 FOR UPDATE`);
      if (!actual) throw new ConflictException('La configuración académica de nota mínima no está instalada.');
      if (actual.valor === valor) return { notaMinima: actual.valor, provisional: true,
        actualizadoEn: actual.actualizadoEn, actualizadoPor: actual.actualizadoPor, cambio: false };
      const [filasActualizadas] = await manager.query(`UPDATE s4.configuracion_nota_minima
        SET porcentaje=$1, actualizado_en=now(), actualizado_por=$2 WHERE id=1
        RETURNING porcentaje::text AS "valor", actualizado_en AS "actualizadoEn", actualizado_por AS "actualizadoPor"`, [valor, actor]);
      const [actualizada] = filasActualizadas ?? [];
      if (!actualizada) throw new ConflictException('No se pudo guardar la configuración académica de nota mínima.');
      await manager.query(`INSERT INTO s4.historial_nota_minima(id,porcentaje_anterior,porcentaje_nuevo,cambiado_en,cambiado_por)
        SELECT COALESCE(max(id), 0) + 1, $1, $2, now(), $3 FROM s4.historial_nota_minima`, [actual.valor, valor, actor]);
      return { notaMinima: actualizada.valor, provisional: true, actualizadoEn: actualizada.actualizadoEn,
        actualizadoPor: actualizada.actualizadoPor, cambio: true };
    });
  }

  async rubrica(trabajoId: string, estudianteId: string, miembroId: string, actor: string, puedeConsultarDemostracion = false) {
    return rubricaDocumental(await this.evaluaciones.datosDocumentales(trabajoId, actor, puedeConsultarDemostracion), estudianteId, miembroId);
  }

  /** El PDF y su nombre de archivo: «Nombre completo del estudiante - rúbrica miembro N.pdf». */
  async rubricaPdf(trabajoId: string, estudianteId: string, miembroId: string, actor: string, puedeConsultarDemostracion = false) {
    const modelo = await this.rubrica(trabajoId, estudianteId, miembroId, actor, puedeConsultarDemostracion);
    const posicion = (modelo.evaluador as { posicion?: number }).posicion;
    return {
      pdf: await pdfRubrica(modelo),
      nombre: nombreArchivoPdf(`${modelo.estudiante.nombres} ${modelo.estudiante.apellidos}`, posicion ? `rúbrica miembro ${posicion}` : 'rúbrica'),
    };
  }

  async preliminar(trabajoId: string, estudianteId: string, formato: FormatoActaDto['formato'], actor: string, puedeConsultarDemostracion = false) {
    const datos = await this.evaluaciones.datosDocumentales(trabajoId, actor, puedeConsultarDemostracion);
    const pendientes = pendientesActa(datos, estudianteId);
    const configuracion = await this.valorNotaMinima(trabajoId);
    const estudiante = datos.estudiantes.find(({ id }) => id === estudianteId);
    return {
      pdf: await pdfActaPreliminar(datos, estudianteId, formato, pendientes, notaMinimaEnEscala(configuracion.valor, datos.rubrica.escalaFinal ?? 10)),
      nombre: nombreArchivoPdf(estudiante && `${estudiante.nombres} ${estudiante.apellidos}`, `acta preliminar ${formato}`),
    };
  }

  async emitir(trabajoId: string, estudianteId: string, dto: FormatoActaDto, actor: string, puedeConsultarDemostracion = false) {
    const datos = await this.evaluaciones.datosDocumentales(trabajoId, actor, puedeConsultarDemostracion);
    const pendientes = pendientesActa(datos, estudianteId);
    if (pendientes.length) throw new ConflictException({ message: 'No se puede generar todavía el documento interno.', details: pendientes });
    const resultado = resultadoFinalActa(datos, estudianteId);
    if (!resultado?.calificacion) {
      throw new ConflictException({ message: 'No existe una calificación final consolidada válida para la escala de la rúbrica.', details: [] });
    }

    return this.db.transaction(async (manager) => {
      await establecerActorAuditoria(manager, actor);
      // Bloquea el umbral durante la emisión para que el PDF y su snapshot coincidan.
      const [configuracion] = await manager.query(`SELECT COALESCE((SELECT to_jsonb(p)->>'porcentaje_aprobacion' FROM s4.procesos_evaluacion p WHERE p.asignacion_tema_id=$1 AND p.estado_registro=1), porcentaje::text) AS valor FROM s4.configuracion_nota_minima WHERE id=1 FOR SHARE`,[trabajoId]);
      if (!configuracion) throw new ConflictException('La configuración académica de nota mínima no está instalada.');
      const escala = Number(resultado.calificacionMaxima);
      const umbral = notaMinimaEnEscala(configuracion.valor, escala);
      const aprobado = notaAprobada(resultado.calificacion, umbral, escala);
      const trabajo = datos.trabajo;
      const estudiante = estudianteId;
      const acta = await archivarActaEn(manager, {
        trabajoId, estudianteId: estudiante, carreraId: trabajo.carreraId, periodoId: trabajo.periodoId,
        periodo: trabajo.periodo, carreraCodigo: trabajo.carreraCodigo, formato: dto.formato, actor,
        notaFinal: resultado.calificacion, notaMinimaAplicada: umbral, escala, aprobado,
      }, (numero) => pdfActaInterna(datos, estudiante, dto.formato, numero,
        resultado.calificacion, umbral, aprobado));
      return acta;
    });
  }

  /** Actas archivadas, de la más reciente a la más antigua. Con `limite` devuelve una página. */
  async listar(actor: string, filtro: BuscarActasDto, puedeConsultarDemostracion = false) {
    if (filtro.limite === undefined) return this.consultarActas(actor, filtro, puedeConsultarDemostracion, null, 0);
    const { limite, pagina, desplazamiento } = leerPaginacion(filtro.limite, filtro.pagina);
    const filas: Array<Record<string, unknown> & { total: number }> = await this.consultarActas(
      actor, filtro, puedeConsultarDemostracion, limite, desplazamiento, true);
    let total = filas[0]?.total;
    if (total === undefined) {
      // Página vacía: se cuenta aparte para informar el total real.
      const [conteo] = await this.consultarActas(actor, filtro, puedeConsultarDemostracion, 1, 0, true);
      total = conteo?.total ?? 0;
    }
    return {
      elementos: filas.map(({ total: _total, ...acta }) => acta),
      paginacion: { pagina, limite, total, paginas: Math.max(1, Math.ceil(total / limite)) },
    };
  }

  private consultarActas(actor: string, filtro: BuscarActasDto, puedeConsultarDemostracion: boolean,
    limite: number | null, desplazamiento: number, conTotal = false) {
    return this.db.query(...conAlcance(`SELECT ar.id,${conTotal ? 'count(*) OVER()::integer AS total,' : ''}ar.estado_registro AS "estadoRegistro",ar.numero,ar.formato,ar.revision,ar.generado_en AS "generadoEn",
      ar.nota_final::text AS "notaFinal",ar.nota_minima_aplicada::text AS "notaMinimaAplicada",ar.escala_final AS escala,ar.aprobado,
      p.nombres || ' ' || p.apellidos AS estudiante,c.nombre AS carrera,ar.periodo
      FROM s4.actas_archivadas ar
      JOIN s4.procesos_evaluacion proceso ON proceso.id = ar.id_proceso_evaluacion AND proceso.estado_registro = 1
      JOIN s2.asignacion_tema t ON t.id = proceso.asignacion_tema_id
      JOIN gen.estudiante e ON e.id=ar.id_estudiante JOIN gen.persona p ON p.id=e.persona_id
      JOIN gen.carrera c ON c.id=ar.id_carrera WHERE ar.estado_registro = 1 AND ($5::boolean OR ${accesoAmbito})
      AND ($2::text IS NULL OR strpos(lower(p.nombres || ' ' || p.apellidos),lower($2))>0)
      AND ($3::text IS NULL OR c.codigo=$3) AND ($4::text IS NULL OR ar.periodo=$4)
      ORDER BY ar.generado_en DESC, ar.id LIMIT $6 OFFSET $7`,
    [actor, filtro.estudiante ?? null, filtro.carrera ?? null, filtro.periodo ?? null, puedeConsultarDemostracion, limite, desplazamiento]));
  }

  async archivada(id: string, actor: string, conPdf = false, puedeConsultarDemostracion = false) {
    const [acta] = await this.db.query(...conAlcance(`SELECT ar.id,ar.numero,ar.formato,ar.revision,
      ar.generado_en AS "generadoEn",ar.sha256,ar.nota_final::text AS "notaFinal",
      ar.nota_minima_aplicada::text AS "notaMinimaAplicada",ar.escala_final AS escala,ar.aprobado,
      (SELECT pe.nombres || ' ' || pe.apellidos FROM gen.estudiante es JOIN gen.persona pe ON pe.id = es.persona_id
        WHERE es.id = ar.id_estudiante) AS estudiante${conPdf ? ',ar.pdf' : ''}
      FROM s4.actas_archivadas ar
      JOIN s4.procesos_evaluacion proceso ON proceso.id = ar.id_proceso_evaluacion AND proceso.estado_registro = 1
      JOIN s2.asignacion_tema t ON t.id = proceso.asignacion_tema_id
      LEFT JOIN gen.carrera c ON c.id = ar.id_carrera
      WHERE ar.estado_registro = 1 AND ($3::boolean OR ${accesoAmbito}) AND ar.id=$2`, [actor, id, puedeConsultarDemostracion]));
    if (!acta) throw new NotFoundException('No existe el acta solicitada.');
    return acta;
  }

  private async valorNotaMinima(trabajoId?:string): Promise<{ valor: string; actualizadoEn: Date; actualizadoPor: string }> {
    const [configuracion] = await this.db.query(`SELECT COALESCE((SELECT to_jsonb(p)->>'porcentaje_aprobacion' FROM s4.procesos_evaluacion p WHERE p.asignacion_tema_id=$1 AND p.estado_registro=1), porcentaje::text) AS valor, actualizado_en AS "actualizadoEn", actualizado_por AS "actualizadoPor"
      FROM s4.configuracion_nota_minima WHERE id=1`,[trabajoId ?? null]);
    if (!configuracion) throw new ConflictException('La configuración académica de nota mínima no está instalada.');
    return configuracion;
  }
}
