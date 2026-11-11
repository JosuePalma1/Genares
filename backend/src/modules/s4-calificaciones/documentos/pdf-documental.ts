import { rubricaDocumental, DatosDocumentales } from './modelo-documental';
import { PLANTILLAS } from './plantillas-institucionales';
import { notaAprobada } from './reglas-acta';
import { exportarPlantillaPdf, pdfPat01, pdfPat04 } from './pdf-pat-04';

const nombre = (persona: { nombres: string; apellidos: string } | null | undefined) =>
  persona ? `${persona.nombres} ${persona.apellidos}` : 'No registrado';

export function camposRubrica(modelo: ReturnType<typeof rubricaDocumental>) {
  let ordenCategoria = 0;
  const resumen = [['CATEGORÍAS', 'VALORACIÓN', 'CALIFICACIÓN PARCIAL']];
  const letra = (orden: number): string => orden < 26 ? String.fromCharCode(65 + orden)
    : letra(Math.floor(orden / 26) - 1) + letra(orden % 26);
  const partes = modelo.etapas.map((etapa, index) => ({
    modalidad: `MODALIDAD ${modelo.trabajo.modalidad ?? 'POR CONFIRMAR'} · PARTE ${index + 1}`,
    titulo: `${etapa.nombre} · ${etapa.maximo} puntos · ${etapa.estado === 'CERRADA' ? 'CERRADA' : 'PRELIMINAR'}`,
    total: `TOTAL DE LA ETAPA: ${etapa.total ?? 'Pendiente'} / ${etapa.maximo}`,
    categorias: etapa.categorias.map((categoria) => {
      const etiqueta = `${letra(ordenCategoria++)}. ${categoria.nombre}`;
      resumen.push([etiqueta, categoria.maximo, categoria.subtotal ?? 'Pendiente']);
      return {
        titulo: `${etiqueta} (${categoria.maximo} puntos)`,
        filas: [['INDICADORES', 'VALORACIÓN', 'CALIFICACIÓN'], ...categoria.filas.map((fila, i) => [
          `${i + 1}. ${[fila.indicador, fila.descripcion].filter(Boolean).join(' — ')}`, fila.maximo, fila.nota ?? 'Pendiente',
        ]), ['SUMATORIA', categoria.maximo, categoria.subtotal ?? 'Pendiente']],
      };
    }),
  }));
  resumen.push(['CALIFICACIÓN FINAL CONSOLIDADA', '10.00', modelo.resultadoAcademico?.calificacion ?? 'Pendiente']);
  return {
    partes, resumen,
    trabajo: `TÍTULO TRABAJO DE TITULACIÓN: ${modelo.trabajo.titulo}`,
    estudiante: `NOMBRE DE ESTUDIANTE: ${nombre(modelo.estudiante)}`,
    tutor: `NOMBRE TUTOR: ${nombre(modelo.tutor)}`,
    firma: `MIEMBRO DEL TRIBUNAL: ${nombre(modelo.evaluador)}`,
    estado: `${modelo.rubrica.rubricName} · Versión ${modelo.rubrica.version} · ${modelo.estado}`,
  };
}

export function pdfRubrica(modelo: ReturnType<typeof rubricaDocumental>): Promise<Buffer> {
  return exportarPlantillaPdf('RUBRICA DEFENSA TRABAJO IC 5 PUNTOS.docx', [], camposRubrica(modelo));
}

export function pdfActaPreliminar(
  datos: DatosDocumentales,
  estudianteId: string,
  formato: keyof typeof PLANTILLAS,
  pendientes: string[],
  notaMinima = '7.00',
) {
  const consolidacion = (datos.consolidacion.estudiantes as Array<Record<string, any>>)
    .find((c) => c.estudiante.id === estudianteId);
  const calificacion = pendientes.length === 0 ? consolidacion?.resultadoFinal?.calificacion as string | undefined : undefined;
  const aprobado = calificacion !== undefined && notaAprobada(calificacion, notaMinima);
  const exportar = formato === 'PAT-04-F-017' ? pdfPat04 : pdfPat01;
  return exportar(datos, estudianteId, 'Vista previa sin número', calificacion, aprobado);
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
  const estudiante = datos.estudiantes.find((e: { id: string }) => e.id === estudianteId);
  const consolidacion = (datos.consolidacion.estudiantes as Array<Record<string, any>>)
    .find((c) => c.estudiante.id === estudianteId);
  if (!estudiante || !consolidacion || consolidacion.estado !== 'RESULTADO_COMPLETO') {
    throw new Error('El documento requiere un estudiante perteneciente al trabajo y una consolidación completa.');
  }
  if (notaAprobada(calificacion, notaMinima) !== aprobado) {
    throw new Error('El resultado no coincide con la nota mínima aplicada.');
  }
  const exportar = formato === 'PAT-04-F-017' ? pdfPat04 : pdfPat01;
  return exportar(datos, estudianteId, `No. ${numero}`, calificacion, aprobado);
}
