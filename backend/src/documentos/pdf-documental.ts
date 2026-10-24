import PDFDocument = require('pdfkit');
import { rubricaDocumental, DatosDocumentales } from './modelo-documental';
import { PLANTILLAS } from './plantillas-institucionales';
import { notaAprobada } from './reglas-acta';

function generar(escribir: (doc: PDFKit.PDFDocument) => void, pie: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 44, bufferPages: true, info: { Title: 'Documento académico Genares' } });
    const partes: Buffer[] = [];
    doc.on('data', (parte) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    try {
      escribir(doc);
      const paginas = doc.bufferedPageRange();
      for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(8).fillColor('#576777')
          .text(`${pie} · Página ${i + 1} de ${paginas.count}`, 44, 778, { width: 505, lineBreak: false });
      }
      doc.end();
    } catch (error) { reject(error); }
  });
}
const nombre = (persona: { nombres: string; apellidos: string } | null) => persona ? `${persona.nombres} ${persona.apellidos}` : 'No registrado';
function texto(doc: PDFKit.PDFDocument, valor: string) { doc.font('Helvetica').fontSize(10).fillColor('#172b40').text(valor).moveDown(0.4); }
function titulo(doc: PDFKit.PDFDocument, valor: string) { doc.font('Helvetica-Bold').fontSize(14).fillColor('#123b56').text(valor).moveDown(0.5); }
function firma(doc: PDFKit.PDFDocument, rol: string, persona = '') {
  if (doc.y > 690) doc.addPage();
  doc.moveDown(2); texto(doc, '________________________________________'); texto(doc, persona); texto(doc, rol);
}
function firmasActa(doc: PDFKit.PDFDocument, roles: readonly string[]) {
  for (let i = 0; i < roles.length; i += 2) {
    if (doc.y + 90 > 750) doc.addPage();
    const y = doc.y + 42;
    roles.slice(i, i + 2).forEach((rol, columna) => {
      const x = 44 + columna * 260;
      doc.moveTo(x, y).lineTo(x + 230, y).strokeColor('#576777').stroke();
      doc.font('Helvetica').fontSize(10).fillColor('#172b40').text(rol, x, y + 8, { width: 230, align: 'center' });
    });
    doc.x = 44; doc.y = y + 42;
  }
}
function tabla(doc: PDFKit.PDFDocument, filas: string[][]) {
  const anchos = [345, 80, 80];
  for (const fila of filas) {
    doc.font('Helvetica').fontSize(9);
    const alto = Math.max(24, ...fila.map((celda, i) => doc.heightOfString(celda, { width: anchos[i] - 12 }) + 12));
    if (doc.y + alto > 750) doc.addPage();
    const y = doc.y;
    let x = 44;
    fila.forEach((celda, i) => {
      doc.rect(x, y, anchos[i], alto).strokeColor('#b0bec8').stroke();
      doc.fillColor('#172b40').text(celda, x + 6, y + 6, { width: anchos[i] - 12 });
      x += anchos[i];
    });
    doc.x = 44; doc.y = y + alto;
  }
  doc.moveDown();
}

export function pdfRubrica(modelo: ReturnType<typeof rubricaDocumental>): Promise<Buffer> {
  return generar((doc) => {
    modelo.etapas.forEach((etapa, index) => {
      if (index) doc.addPage();
      titulo(doc, 'RÚBRICA DE EVALUACIÓN');
      texto(doc, `${modelo.rubrica.rubricName} · Versión ${modelo.rubrica.version}`);
      titulo(doc, `${etapa.nombre} — ${etapa.estado === 'CERRADA' ? 'Evaluación cerrada' : 'PRELIMINAR · INCOMPLETA'}`);
      texto(doc, `Trabajo: ${modelo.trabajo.codigo} — ${modelo.trabajo.titulo}`);
      texto(doc, `Modalidad: ${modelo.trabajo.modalidad} · Período: ${modelo.trabajo.periodo}`);
      texto(doc, `Estudiante: ${nombre(modelo.estudiante)} · Identificación: ${modelo.estudiante.identificacion}`);
      texto(doc, `Tutor: ${nombre(modelo.tutor)} · Evaluador: ${nombre(modelo.evaluador)}`);
      texto(doc, `Ámbito: ${etapa.alcance}. ${etapa.traspaso ? 'Nota compartida asignada mediante traspaso; se utiliza el registro original.' : ''}`);
      texto(doc, `Evaluación de origen: ${etapa.evaluacionId ?? 'Sin evaluación registrada'}`);
      for (const categoria of etapa.categorias) {
        titulo(doc, categoria.nombre);
        tabla(doc, [['INDICADORES', 'VALORACIÓN', 'CALIFICACIÓN'], ...categoria.filas.map((fila) => [
          [fila.indicador, fila.descripcion].filter(Boolean).join('\n'), fila.maximo, fila.nota ?? 'Pendiente',
        ]), ['SUBTOTAL REGISTRADO', categoria.maximo, categoria.subtotal ?? 'Incompleto']]);
      }
      tabla(doc, [['TOTAL DE LA EVALUACIÓN', etapa.maximo, etapa.total ?? 'Sin cierre']]);
      firma(doc, 'MIEMBRO DEL TRIBUNAL', nombre(modelo.evaluador));
    });
    doc.addPage(); titulo(doc, 'RESUMEN DE LA EVALUACIÓN');
    texto(doc, `Estudiante: ${nombre(modelo.estudiante)} · Evaluador: ${nombre(modelo.evaluador)}`);
    texto(doc, `Estado del documento: ${modelo.estado}`);
    tabla(doc, [['ETAPA', 'MÁXIMO', 'NOTA'], ...modelo.etapas.map((e) => [e.nombre, e.maximo, e.total ?? 'Pendiente'])]);
    texto(doc, 'Las notas anteriores pertenecen a este evaluador. No se suman etapas de escalas independientes.');
    texto(doc, modelo.resultadoAcademico
      ? `Resultado consolidado individual: ${modelo.resultadoAcademico.calificacion} / ${modelo.resultadoAcademico.calificacionMaxima}. Promedio aritmético de etapas, considerando los dos evaluadores; HALF_UP a dos decimales, sin redondeo intermedio. No equivale a oficialización mediante acta.`
      : 'Resultado consolidado individual: pendiente de completar todas las evaluaciones.');
    if (modelo.legacyExcluidas) texto(doc, 'Existen evaluaciones históricas legacy; no se mezclan con esta rúbrica dinámica.');
    firma(doc, 'MIEMBRO DEL TRIBUNAL', nombre(modelo.evaluador));
  }, `Rúbrica ${modelo.estado.toLowerCase()} · No es un acta institucional`);
}

export function pdfActaPreliminar(
  datos: DatosDocumentales,
  estudianteId: string,
  formato: keyof typeof PLANTILLAS,
  pendientes: string[],
  notaMinima = '7.00',
) {
  const plantilla = PLANTILLAS[formato];
  const estudiante = datos.estudiantes.find((e: { id: string }) => e.id === estudianteId);
  const consolidacion = (datos.consolidacion.estudiantes as Array<Record<string, any>>)
    .find((c) => c.estudiante.id === estudianteId);
  const calificacion = pendientes.length === 0 ? consolidacion?.resultadoFinal?.calificacion as string | undefined : undefined;
  const aprobado = calificacion !== undefined && notaAprobada(calificacion, notaMinima);
  return generar((doc) => {
    titulo(doc, 'VISTA PREVIA DEL DOCUMENTO INTERNO');
    texto(doc, `${formato} · Revisión ${plantilla.revision} · Sin número de archivo`);
    titulo(doc, formato === 'PAT-01-F-019' ? 'ACTA DE CALIFICACIÓN DE TITULACIÓN' : 'ACTA DE CALIFICACIÓN DEL TRABAJO DE INTEGRACIÓN CURRICULAR O EXAMEN COMPLEXIVO');
    texto(doc, `Carrera: ${datos.trabajo.carrera} · Período: ${datos.trabajo.periodo}`);
    texto(doc, `Trabajo: ${datos.trabajo.codigo} · ${datos.trabajo.titulo}`);
    texto(doc, `Estudiante: ${nombre(estudiante)} · Identificación: ${estudiante?.identificacion ?? 'No registrada'}`);
    texto(doc, `Modalidad: ${datos.trabajo.modalidad}`);
    texto(doc, `Tutor: ${nombre(datos.tutor)} · Tribunal: ${datos.evaluadores.map(nombre).join('; ') || 'No registrado'}`);
    tabla(doc, [['RESULTADO ACADÉMICO', 'NOTA', 'ESTADO'],
      ['Calificación final individual /10', calificacion ?? 'Pendiente', calificacion === undefined ? 'Incompleta' : aprobado ? 'APROBADO' : 'REPROBADO'],
      ['Nota mínima provisional vigente /10', notaMinima, 'Umbral configurable']]);
    if (calificacion !== undefined) {
      titulo(doc, 'Etapas de la versión de rúbrica');
      const etapas = (consolidacion?.etapas ?? []) as Array<Record<string, any>>;
      tabla(doc, [['ETAPA', 'ÁMBITO', 'PROMEDIO /10'], ...etapas.map((etapa) => [
        etapa.nombre, etapa.alcance, etapa.promedioEtapa?.presentado ?? 'Pendiente',
      ])]);
      texto(doc, 'El resultado final se toma del servicio de consolidación: promedio aritmético exacto de todas las etapas y HALF_UP a dos decimales, sin redondeos intermedios.');
      if (consolidacion?.evaluacionesLegacyExcluidas) texto(doc, 'Las evaluaciones históricas legacy se excluyen y no se reinterpretan en esta consolidación dinámica.');
    }
    texto(doc, plantilla.constancia);
    firmasActa(doc, plantilla.firmas);
    texto(doc, 'Los espacios de firma se mantienen en blanco para su uso institucional.');
    if (pendientes.length) {
      titulo(doc, 'Pendientes para generar el documento numerado');
      pendientes.forEach((pendiente) => texto(doc, `• ${pendiente}`));
    }
  }, 'VISTA PREVIA · DOCUMENTO INTERNO · SIN NÚMERO');
}

export function pdfActaInterna(
  datos: DatosDocumentales,
  estudianteId: string,
  formato: keyof typeof PLANTILLAS,
  numero: string,
  calificacion: string,
  notaMinima: string,
  aprobado: boolean,
) {
  const plantilla = PLANTILLAS[formato];
  const estudiante = datos.estudiantes.find((e: { id: string }) => e.id === estudianteId);
  const consolidacion = (datos.consolidacion.estudiantes as Array<Record<string, any>>)
    .find((c) => c.estudiante.id === estudianteId);
  if (!estudiante || !consolidacion || consolidacion.estado !== 'RESULTADO_COMPLETO') {
    throw new Error('El documento requiere un estudiante perteneciente al trabajo y una consolidación completa.');
  }
  return generar((doc) => {
    titulo(doc, 'DOCUMENTO INTERNO DE RESULTADO ACADÉMICO');
    texto(doc, `${formato} · Revisión ${plantilla.revision} · Número: ${numero}`);
    titulo(doc, formato === 'PAT-01-F-019' ? 'ACTA DE CALIFICACIÓN DE TITULACIÓN' : 'ACTA DE CALIFICACIÓN DEL TRABAJO DE INTEGRACIÓN CURRICULAR O EXAMEN COMPLEXIVO');
    texto(doc, `Carrera: ${datos.trabajo.carrera} · Período: ${datos.trabajo.periodo}`);
    texto(doc, `Trabajo: ${datos.trabajo.codigo} · ${datos.trabajo.titulo}`);
    texto(doc, `Estudiante: ${nombre(estudiante)} · Identificación: ${estudiante.identificacion}`);
    texto(doc, `Modalidad: ${datos.trabajo.modalidad}`);
    texto(doc, `Tutor: ${nombre(datos.tutor)} · Tribunal: ${datos.evaluadores.map(nombre).join('; ')}`);
    tabla(doc, [['RESULTADO ACADÉMICO INDIVIDUAL', 'NOTA /10', 'DECISIÓN'],
      ['Calificación final consolidada', calificacion, aprobado ? 'APROBADO' : 'REPROBADO'],
      ['Nota mínima provisional aplicada', notaMinima, 'Umbral configurable']]);
    titulo(doc, 'Etapas de la versión de rúbrica utilizada');
    const etapas = consolidacion.etapas as Array<Record<string, any>>;
    tabla(doc, [['ETAPA', 'ÁMBITO', 'PROMEDIO /10'], ...etapas.map((etapa) => [
      etapa.nombre, etapa.alcance, etapa.promedioEtapa?.presentado ?? 'Pendiente',
    ])]);
    texto(doc, 'El resultado final corresponde al promedio aritmético exacto de las etapas, presentado con redondeo decimal HALF_UP a dos decimales. No se redondean promedios intermedios.');
    if (consolidacion?.evaluacionesLegacyExcluidas) texto(doc, 'Las evaluaciones históricas legacy se excluyen y no se reinterpretan en esta consolidación dinámica.');
    texto(doc, 'Documento interno generado desde las evaluaciones cerradas y la consolidación de esta versión de rúbrica. Su generación no modifica notas, evaluaciones ni estados académicos.');
    texto(doc, plantilla.constancia);
    firmasActa(doc, plantilla.firmas);
    texto(doc, 'Los espacios de firma se mantienen en blanco para su uso institucional.');
  }, `DOCUMENTO INTERNO · ${numero}`);
}
