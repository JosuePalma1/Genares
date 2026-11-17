import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import PDFDocument = require('pdfkit');

/**
 * Dibujo de los PDF de S4 con pdfkit, sin Word ni PowerShell: funciona igual en Windows y Linux.
 * Medidas tomadas de las plantillas oficiales (1 pt = 1/72 pulgada; A4 = 595,28 × 841,89 pt).
 */
export type Documento = PDFKit.PDFDocument;

export const FUENTE = 'Helvetica';
export const FUENTE_NEGRITA = 'Helvetica-Bold';

/** Imágenes extraídas de la plantilla oficial de la rúbrica (Facultad de Ciencias de la Vida y Tecnologías). */
export const IMAGENES = Object.freeze({
  encabezado: 'imagenes/encabezado-facultad.png',
  marca: 'imagenes/marca-uleam.png',
  pie: 'imagenes/pie-contacto.png',
});

export function rutaRecursoDocumental(nombre: string): string {
  let carpeta = __dirname;
  while (true) {
    const archivo = join(carpeta, 'docs', 's4', 'Plantillas-documentos', nombre);
    if (existsSync(archivo)) return archivo;
    const padre = dirname(carpeta);
    if (padre === carpeta) throw new Error(`Falta el recurso documental ${nombre}.`);
    carpeta = padre;
  }
}

export interface Margenes { top: number; bottom: number; left: number; right: number }

export function crearDocumento(titulo: string, margins: Margenes): Documento {
  return new PDFDocument({
    size: 'A4', margins, bufferPages: true, autoFirstPage: true,
    info: { Title: titulo, Creator: 'Genares S4' },
  });
}

/** Termina el documento y devuelve sus bytes. */
export function aBuffer(doc: Documento): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolver(Buffer.concat(partes)));
    doc.on('error', rechazar);
    doc.end();
  });
}

export function anchoUtil(doc: Documento): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

export function limiteInferior(doc: Documento): number {
  return doc.page.height - doc.page.margins.bottom;
}

/** Salta de página si lo que viene no cabe en lo que queda de esta. */
export function asegurarEspacio(doc: Documento, alto: number): void {
  if (doc.y + alto > limiteInferior(doc)) doc.addPage();
}

export function parrafo(doc: Documento, texto: string, opciones: {
  negrita?: boolean; tamano?: number; alineacion?: 'left' | 'center' | 'right' | 'justify'; despues?: number;
} = {}): void {
  doc.font(opciones.negrita ? FUENTE_NEGRITA : FUENTE).fontSize(opciones.tamano ?? 10).fillColor('black');
  doc.text(texto, doc.page.margins.left, doc.y, { width: anchoUtil(doc), align: opciones.alineacion ?? 'left' });
  if (opciones.despues) doc.y += opciones.despues;
}

export interface OpcionesTabla {
  anchos: number[];
  /** Columnas que van centradas (las de puntos y notas). */
  centradas?: number[];
  tamano?: number;
  /** Filas en negrita: la cabecera y las sumatorias. */
  negritas?: number[];
  /** Fila que se repite arriba si la tabla continúa en otra página. */
  cabecera?: number;
  /** Espacio entre el borde de la celda y el texto. */
  relleno?: number;
}

/** Tabla con bordes; cada fila crece con su texto y la tabla continúa en la página siguiente si hace falta. */
export function tabla(doc: Documento, filas: readonly (readonly string[])[], opciones: OpcionesTabla): void {
  const relleno = opciones.relleno ?? 4;
  const tamano = opciones.tamano ?? 9;
  const x0 = doc.page.margins.left;
  const altoFila = (fila: readonly string[], negrita: boolean) => {
    doc.font(negrita ? FUENTE_NEGRITA : FUENTE).fontSize(tamano);
    return Math.max(...fila.map((celda, i) => doc.heightOfString(celda || ' ', { width: opciones.anchos[i] - 2 * relleno }))) + 2 * relleno;
  };
  const dibujarFila = (fila: readonly string[], indice: number) => {
    const negrita = opciones.negritas?.includes(indice) ?? false;
    const alto = altoFila(fila, negrita);
    let x = x0;
    const y = doc.y;
    fila.forEach((celda, i) => {
      const ancho = opciones.anchos[i];
      if (indice === opciones.cabecera) doc.rect(x, y, ancho, alto).fillColor('#e7e6e6').fill();
      doc.rect(x, y, ancho, alto).lineWidth(0.6).strokeColor('black').stroke();
      doc.font(negrita ? FUENTE_NEGRITA : FUENTE).fontSize(tamano).fillColor('black')
        .text(celda, x + relleno, y + relleno, { width: ancho - 2 * relleno, align: opciones.centradas?.includes(i) ? 'center' : 'left' });
      x += ancho;
    });
    doc.y = y + alto;
  };
  filas.forEach((fila, indice) => {
    const alto = altoFila(fila, opciones.negritas?.includes(indice) ?? false);
    if (doc.y + alto > limiteInferior(doc)) {
      doc.addPage();
      if (opciones.cabecera !== undefined && indice > opciones.cabecera) dibujarFila(filas[opciones.cabecera], opciones.cabecera);
    }
    dibujarFila(fila, indice);
  });
  doc.x = x0;
}

/**
 * Pone en cada página el encabezado y el pie oficiales. Se llama al final, con todas las páginas
 * ya escritas, para poder numerar «Página X de Y».
 */
export function decorarPaginas(doc: Documento, extra: (pagina: number, total: number) => void): void {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    // Se escribe en los márgenes: se anula el inferior para que pdfkit no abra otra página.
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    extra(i - start + 1, count);
    doc.page.margins.bottom = margenInferior;
  }
}

/** Encabezado de la facultad alineado a la derecha, como en la plantilla (450,7 × 60,7 pt a 35,4 pt del borde). */
export function encabezadoFacultad(doc: Documento, ancho = 450.7): void {
  doc.image(rutaRecursoDocumental(IMAGENES.encabezado), doc.page.width - doc.page.margins.right - ancho, 35.4, { width: ancho });
}
