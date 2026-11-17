import { rubricaDocumental, DatosDocumentales } from './modelo-documental';
import { PLANTILLAS } from './plantillas-institucionales';
import { notaAprobada, notaMinimaEnEscala } from './reglas-acta';
import { pdfPat01, pdfPat04 } from './pdf-pat-04';
import { dibujarRubricaPdf } from './pdf-rubrica';

const nombre = (persona: { nombres: string; apellidos: string } | null | undefined) =>
  persona ? `${persona.nombres} ${persona.apellidos}` : '';

/** Letra de la categoría por su orden en toda la rúbrica: A, B… Z, AA, AB… */
export const letra = (orden: number): string => orden < 26 ? String.fromCharCode(65 + orden)
  : letra(Math.floor(orden / 26) - 1) + letra(orden % 26);

/** Número romano de la parte, como en la plantilla («PARTE I», «PARTE II»). */
export function romano(numero: number): string {
  const valores: Array<[number, string]> = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let resto = numero; let texto = '';
  for (const [valor, cifra] of valores) while (resto >= valor) { texto += cifra; resto -= valor; }
  return texto;
}

/** Puntos sin ceros sobrantes, como en los títulos de la plantilla: 5.00 → 5, 2.50 → 2.5. */
export function puntos(valor: string | null | undefined): string {
  if (!valor) return '';
  return valor.includes('.') ? valor.replace(/0+$/, '').replace(/\.$/, '') : valor;
}

/** Título de cada parte, como en la plantilla: «REVISIÓN PROYECTO ESCRITO (50%) 5 PUNTOS». */
function tituloParte(nombreEtapa: string, maximo: string, porcentaje: string | null | undefined): string {
  return `${nombreEtapa.toUpperCase()}${porcentaje ? ` (${puntos(porcentaje)}%)` : ''} ${puntos(maximo)} PUNTOS`;
}

/**
 * Porcentaje que se imprime en cada parte. Sin porcentajes guardados, la consolidación hace pesar cada parte
 * según lo que vale (5 + 5 → 50 % y 50 %; 3 + 7 → 30 % y 70 %), así que se imprime ese reparto.
 */
function porcentajes(etapas: Array<{ porcentaje?: string | null; maximo: string }>): Array<string | null> {
  if (etapas.length === 0 || etapas.some(({ porcentaje }) => porcentaje != null)) return etapas.map(({ porcentaje }) => porcentaje ?? null);
  const total = etapas.reduce((suma, { maximo }) => suma + Number(maximo), 0);
  return etapas.map(({ maximo }) => (total > 0 ? ((Number(maximo) * 100) / total).toFixed(2) : null));
}

const tituloCategoria = (etiqueta: string, maximo: string) =>
  `${etiqueta} (${puntos(maximo)} ${puntos(maximo) === '1' ? 'punto' : 'puntos'})`;

/** Contenido de la rúbrica en PDF, en el orden y con los textos de la plantilla oficial. */
export interface RubricaPdf {
  modalidad: string;
  trabajo: string; estudiante: string; tutor: string;
  partes: Array<{
    numero: string; titulo: string;
    categorias: Array<{ titulo: string; filas: Array<{ texto: string; valor: string; nota: string }>; sumatoria: { valor: string; nota: string } }>;
  }>;
  resumen: { filas: Array<{ texto: string; valor: string; nota: string }>; final: { valor: string; nota: string } };
}

/** Estructura de una versión de rúbrica tal como la devuelve RubricasService (solo lo visible). */
export interface VersionRubricaEnBlanco {
  escalaFinal?: number;
  modalidad: string;
  etapas: Array<{
    nombre: string; calificacionMaxima: string; porcentaje?: string | null;
    categorias: Array<{ nombre: string; calificacionMaxima: string; indicadores: Array<{ label: string; descripcion?: string | null; calificacionMaxima: string }> }>;
  }>;
}

/** El texto del indicador; el código interno (I1, DEV-1…) solo se usa si no hay descripción. */
const textoIndicador = (codigo: string, descripcion?: string | null) => (descripcion?.trim() ? descripcion.trim() : codigo);

/** Vista previa de la rúbrica sin trabajo, estudiante ni notas: el formato que se imprimirá, con las casillas vacías. */
export function camposRubricaEnBlanco(datos: VersionRubricaEnBlanco): RubricaPdf {
  let ordenCategoria = 0;
  const resumen: RubricaPdf['resumen']['filas'] = [];
  const pesos = porcentajes(datos.etapas.map((etapa) => ({ porcentaje: etapa.porcentaje, maximo: etapa.calificacionMaxima })));
  const partes = datos.etapas.map((etapa, index) => ({
    numero: romano(index + 1),
    titulo: tituloParte(etapa.nombre, etapa.calificacionMaxima, pesos[index]),
    categorias: etapa.categorias.map((categoria) => {
      const etiqueta = `${letra(ordenCategoria++)}. ${categoria.nombre}`;
      resumen.push({ texto: etiqueta, valor: categoria.calificacionMaxima, nota: '' });
      return {
        titulo: tituloCategoria(etiqueta, categoria.calificacionMaxima),
        filas: categoria.indicadores.map((indicador) => ({ texto: textoIndicador(indicador.label, indicador.descripcion), valor: indicador.calificacionMaxima, nota: '' })),
        sumatoria: { valor: categoria.calificacionMaxima, nota: '' },
      };
    }),
  }));
  return { modalidad: datos.modalidad.toUpperCase(), trabajo: '', estudiante: '', tutor: '', partes, resumen: { filas: resumen, final: { valor: (datos.escalaFinal ?? 10).toFixed(2), nota: '' } } };
}

/**
 * Rúbrica de un miembro del tribunal para un estudiante. Las notas solo se imprimen cuando la
 * evaluación de esa parte está cerrada; un borrador deja las casillas vacías, como la plantilla.
 */
export function camposRubrica(modelo: ReturnType<typeof rubricaDocumental>): RubricaPdf {
  let ordenCategoria = 0;
  const resumen: RubricaPdf['resumen']['filas'] = [];
  const pesos = porcentajes(modelo.etapas);
  const partes = modelo.etapas.map((etapa, index) => {
    const cerrada = etapa.estado === 'CERRADA';
    return {
      numero: romano(index + 1),
      titulo: tituloParte(etapa.nombre, etapa.maximo, pesos[index]),
      categorias: etapa.categorias.map((categoria) => {
        const etiqueta = `${letra(ordenCategoria++)}. ${categoria.nombre}`;
        const subtotal = cerrada ? categoria.subtotal ?? '' : '';
        resumen.push({ texto: etiqueta, valor: categoria.maximo, nota: subtotal });
        return {
          titulo: tituloCategoria(etiqueta, categoria.maximo),
          filas: categoria.filas.map((fila) => ({ texto: textoIndicador(fila.indicador, fila.descripcion), valor: fila.maximo, nota: cerrada ? fila.nota ?? '' : '' })),
          sumatoria: { valor: categoria.maximo, nota: subtotal },
        };
      }),
    };
  });
  return {
    modalidad: (modelo.trabajo.modalidad ?? '').toUpperCase(),
    trabajo: modelo.trabajo.titulo ?? '', estudiante: nombre(modelo.estudiante), tutor: nombre(modelo.tutor),
    partes,
    resumen: { filas: resumen, final: { valor: (modelo.rubrica.escalaFinal ?? 10).toFixed(2), nota: modelo.resultadoAcademico?.calificacion ?? '' } },
  };
}

export function pdfRubrica(modelo: ReturnType<typeof rubricaDocumental>): Promise<Buffer> {
  // El título del PDF (pestaña del visor) lleva el nombre del estudiante.
  return dibujarRubricaPdf(camposRubrica(modelo), `${modelo.estudiante.nombres} ${modelo.estudiante.apellidos} - rúbrica`);
}

export function pdfActaPreliminar(
  datos: DatosDocumentales,
  estudianteId: string,
  formato: keyof typeof PLANTILLAS,
  pendientes: string[],
  notaMinima?: string,
) {
  const consolidacion = (datos.consolidacion.estudiantes as Array<Record<string, any>>)
    .find((c) => c.estudiante.id === estudianteId);
  const calificacion = pendientes.length === 0 ? consolidacion?.resultadoFinal?.calificacion as string | undefined : undefined;
  const escala = Number(consolidacion?.resultadoFinal?.calificacionMaxima ?? datos.rubrica.escalaFinal ?? 10);
  const aprobado = calificacion !== undefined && notaAprobada(calificacion, notaMinima ?? notaMinimaEnEscala('70', escala), escala);
  const exportar = formato === 'PAT-04-F-017' ? pdfPat04 : pdfPat01;
  return exportar(datos, estudianteId, 'No. (sin número)', calificacion, aprobado);
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
  if (notaAprobada(calificacion, notaMinima, Number(consolidacion.resultadoFinal?.calificacionMaxima ?? datos.rubrica.escalaFinal ?? 10)) !== aprobado) {
    throw new Error('El resultado no coincide con la nota mínima aplicada.');
  }
  const exportar = formato === 'PAT-04-F-017' ? pdfPat04 : pdfPat01;
  return exportar(datos, estudianteId, `No. ${numero}`, calificacion, aprobado);
}
