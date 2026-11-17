import { aBuffer, crearDocumento, Documento, IMAGENES, rutaRecursoDocumental } from './pdf-dibujo';
import type { RubricaPdf } from './pdf-documental';

/**
 * Rúbrica en PDF, copiando la plantilla oficial «RUBRICA DEFENSA TRABAJO IC 5 PUNTOS».
 * Todas las medidas (en puntos, desde el borde superior) se tomaron del PDF exportado por Word.
 * La letra es Carlito, libre y con las mismas medidas que la Calibri del original.
 */
const LETRA = { normal: 'Carlito', negrita: 'Carlito-Bold', cursiva: 'Carlito-Italic', negritaCursiva: 'Carlito-BoldItalic' } as const;
/** Altura de la línea base respecto a lo alto del texto en Carlito (ascendente 1950/2048). */
const ASCENDENTE = 1950 / 2048;
const INTERLINEA = 2500 / 2048;

const MARGEN_IZQUIERDO = 85.05;
const MARGEN_DERECHO = 595.28 - 85.05;
/** El contenido termina antes del pie (la imagen de contacto empieza en 746,5). */
const LIMITE_INFERIOR = 740;

/** Cuadro de título, estudiante y tutor. */
const CUADRO = { x: 82.6, ancho: 433.1, texto: 85, valor: 226.7 };
/** Columnas de las tablas: indicadores, valoración y calificación. */
const COLUMNAS = { x: 85.4, anchos: [297.9, 67.6, 66.1] };
const BORDE = 0.4;

function registrarLetras(doc: Documento) {
  doc.registerFont(LETRA.normal, rutaRecursoDocumental('fuentes/Carlito-Regular.ttf'));
  doc.registerFont(LETRA.negrita, rutaRecursoDocumental('fuentes/Carlito-Bold.ttf'));
  doc.registerFont(LETRA.cursiva, rutaRecursoDocumental('fuentes/Carlito-Italic.ttf'));
  doc.registerFont(LETRA.negritaCursiva, rutaRecursoDocumental('fuentes/Carlito-BoldItalic.ttf'));
}

/** Escribe con la línea base en `base`, como se midió en el original. Devuelve la base de la última línea. */
function escribir(doc: Documento, texto: string, x: number, base: number, opciones: {
  letra?: string; tamano?: number; ancho?: number; alineacion?: 'left' | 'center' | 'right' | 'justify';
} = {}): number {
  const tamano = opciones.tamano ?? 10;
  doc.font(opciones.letra ?? LETRA.normal).fontSize(tamano).fillColor('black');
  const ancho = opciones.ancho ?? MARGEN_DERECHO - x;
  doc.text(texto, x, base - ASCENDENTE * tamano, { width: ancho, align: opciones.alineacion ?? 'left', lineGap: 0 });
  const lineas = Math.max(1, Math.round(doc.heightOfString(texto || ' ', { width: ancho, lineGap: 0 }) / (INTERLINEA * tamano)));
  return base + (lineas - 1) * INTERLINEA * tamano;
}

function lineasDe(doc: Documento, texto: string, letra: string, tamano: number, ancho: number, sangria = 0): number {
  doc.font(letra).fontSize(tamano);
  return Math.max(1, Math.round(doc.heightOfString(texto || ' ', { width: ancho, lineGap: 0, indent: sangria }) / (INTERLINEA * tamano)));
}

/** Título de categoría como en la plantilla: la letra y, tras un tabulador, el nombre. */
function tituloCategoria(doc: Documento, titulo: string, base: number, xNombre: number) {
  const corte = titulo.indexOf('. ');
  if (corte < 0) { escribir(doc, titulo, 85, base, { letra: LETRA.negrita, tamano: 11 }); return; }
  escribir(doc, titulo.slice(0, corte + 1), 85, base, { letra: LETRA.negrita, tamano: 11, ancho: xNombre - 85 });
  escribir(doc, titulo.slice(corte + 2), xNombre, base, { letra: LETRA.negrita, tamano: 11, ancho: CUADRO.x + CUADRO.ancho - 2.4 - xNombre });
}

function linea(doc: Documento, x1: number, y1: number, x2: number, y2: number, grosor = BORDE) {
  doc.moveTo(x1, y1).lineTo(x2, y2).lineWidth(grosor).strokeColor('black').stroke();
}

function marco(doc: Documento, x: number, y: number, ancho: number, alto: number) {
  doc.rect(x, y, ancho, alto).lineWidth(BORDE).strokeColor('black').stroke();
}

/** Cuadro superior: título del trabajo, estudiante, tutor y el nombre de la primera categoría. */
function cuadroDatos(doc: Documento, datos: RubricaPdf, primeraCategoria: string, arriba: number): number {
  const anchoTexto = CUADRO.ancho - 2 * (CUADRO.texto - CUADRO.x);
  const alturaFila = (lineas: number) => lineas * 13.43 + 2.6;
  const filas: Array<{ alto: number; dibujar: (y: number) => void }> = [];
  const etiquetaTitulo = 'TÍTULO TRABAJO DE TITULACIÓN';
  filas.push({
    alto: alturaFila(lineasDe(doc, `${etiquetaTitulo} ${datos.trabajo}`, LETRA.negrita, 11, anchoTexto)),
    dibujar: (y) => {
      doc.font(LETRA.normal).fontSize(11).fillColor('black')
        .text(`${etiquetaTitulo} `, CUADRO.texto, y + 11.7 - ASCENDENTE * 11, { width: anchoTexto, continued: Boolean(datos.trabajo), lineGap: 0 });
      if (datos.trabajo) doc.font(LETRA.negrita).text(datos.trabajo, { lineGap: 0 });
    },
  });
  const anchoValor = CUADRO.x + CUADRO.ancho - (CUADRO.texto - CUADRO.x) - CUADRO.valor;
  for (const [etiqueta, valor] of [['NOMBRE DE ESTUDIANTE:', datos.estudiante], ['NOMBRE TUTOR:', datos.tutor]] as const) {
    filas.push({
      alto: alturaFila(lineasDe(doc, valor, LETRA.negrita, 11, anchoValor)),
      dibujar: (y) => {
        escribir(doc, etiqueta, CUADRO.texto, y + 11.7, { tamano: 11, ancho: CUADRO.valor - CUADRO.texto });
        if (valor) escribir(doc, valor, CUADRO.valor, y + 11.7, { letra: LETRA.negrita, tamano: 11, ancho: anchoValor });
      },
    });
  }
  filas.push({
    alto: alturaFila(lineasDe(doc, primeraCategoria, LETRA.negrita, 11, anchoTexto)),
    dibujar: (y) => tituloCategoria(doc, primeraCategoria, y + 11.7, 104.4),
  });
  let y = arriba;
  for (const fila of filas) {
    fila.dibujar(y);
    y += fila.alto;
    linea(doc, CUADRO.x, y, CUADRO.x + CUADRO.ancho, y);
  }
  linea(doc, CUADRO.x, arriba, CUADRO.x + CUADRO.ancho, arriba);
  linea(doc, CUADRO.x, arriba, CUADRO.x, y);
  linea(doc, CUADRO.x + CUADRO.ancho, arriba, CUADRO.x + CUADRO.ancho, y);
  return y;
}

const xColumna = (i: number) => COLUMNAS.x + COLUMNAS.anchos.slice(0, i).reduce((a, b) => a + b, 0);

/** Fila de tabla de tres columnas; si no cabe, pasa a la página siguiente. Devuelve el borde inferior. */
function filaTabla(doc: Documento, arriba: number, alto: number, dibujar: (y: number) => void): number {
  let y = arriba;
  if (y + alto > LIMITE_INFERIOR) { doc.addPage(); y = doc.page.margins.top; }
  dibujar(y);
  COLUMNAS.anchos.forEach((ancho, i) => marco(doc, xColumna(i), y, ancho, alto));
  return y + alto;
}

function centrado(doc: Documento, texto: string, columna: number, base: number, letra: string = LETRA.normal, tamano = 10) {
  escribir(doc, texto, xColumna(columna), base, { letra, tamano, ancho: COLUMNAS.anchos[columna], alineacion: 'center' });
}

function tablaCategoria(doc: Documento, categoria: RubricaPdf['partes'][number]['categorias'][number], arriba: number): number {
  let y = filaTabla(doc, arriba, 14.8, (fila) => {
    centrado(doc, 'INDICADORES', 0, fila + 9, LETRA.negrita, 9);
    centrado(doc, 'VALORACIÓN', 1, fila + 10.2);
    centrado(doc, 'CALIFICACIÓN', 2, fila + 10.2);
  });
  // Número y texto forman un solo párrafo con sangría francesa: la primera línea empieza en 90,8 y las demás en 100,6.
  const xTexto = 100.6;
  const sangria = 90.8 - xTexto;
  // Word deja llegar el texto casi hasta el borde de la celda; se deja 1 pt para que el justificado no lo toque.
  const anchoTexto = xColumna(1) - 1 - xTexto;
  categoria.filas.forEach((indicador, i) => {
    const texto = `${i + 1}. ${indicador.texto}`;
    const lineas = lineasDe(doc, texto, LETRA.normal, 10, anchoTexto, sangria);
    // Alto medido en la plantilla: 20,3 (1 línea), 28,8 (2) y 37,2 (3).
    const alto = Math.max(lineas * INTERLINEA * 10 + 1, 11.9 + 8.45 * lineas);
    y = filaTabla(doc, y, alto, (fila) => {
      doc.font(LETRA.normal).fontSize(10).fillColor('black')
        .text(texto, xTexto, fila + 10 - ASCENDENTE * 10, { width: anchoTexto, align: 'justify', indent: sangria, lineGap: 0 });
      centrado(doc, indicador.valor, 1, fila + 10);
      if (indicador.nota) centrado(doc, indicador.nota, 2, fila + 10);
    });
  });
  return filaTabla(doc, y, 14.8, (fila) => {
    escribir(doc, 'SUMATORIA', COLUMNAS.x, fila + 10, { letra: LETRA.negrita, ancho: COLUMNAS.anchos[0] - 5, alineacion: 'right' });
    centrado(doc, categoria.sumatoria.valor, 1, fila + 10);
    if (categoria.sumatoria.nota) centrado(doc, categoria.sumatoria.nota, 2, fila + 10);
  });
}

function tablaResumen(doc: Documento, resumen: RubricaPdf['resumen'], arriba: number): number {
  let y = filaTabla(doc, arriba, 22.4, (fila) => {
    escribir(doc, 'CATEGORÍAS', 90.6, fila + 9, { letra: LETRA.negrita, tamano: 9 });
    centrado(doc, 'VALORACIÓN', 1, fila + 9, LETRA.negrita, 9);
    centrado(doc, 'CALIFICACIÓN\nPARCIAL', 2, fila + 9, LETRA.negrita, 9);
  });
  for (const categoria of resumen.filas) {
    const lineas = lineasDe(doc, categoria.texto, LETRA.negrita, 10, COLUMNAS.anchos[0] - 10);
    y = filaTabla(doc, y, lineas * INTERLINEA * 10 + 0.6, (fila) => {
      escribir(doc, categoria.texto, 90.6, fila + 10, { letra: LETRA.negrita, ancho: COLUMNAS.anchos[0] - 10 });
      centrado(doc, categoria.valor, 1, fila + 10);
      if (categoria.nota) centrado(doc, categoria.nota, 2, fila + 10);
    });
  }
  return filaTabla(doc, y, 14, (fila) => {
    escribir(doc, 'CALIFICACIÓN FINAL', COLUMNAS.x, fila + 10.8, { letra: LETRA.negrita, tamano: 11, ancho: COLUMNAS.anchos[0] - 5, alineacion: 'right' });
    centrado(doc, resumen.final.valor, 1, fila + 10);
    if (resumen.final.nota) centrado(doc, resumen.final.nota, 2, fila + 10);
  });
}

/** Línea «Fuente: …» en cursiva bajo la última tabla de cada parte, como en la plantilla (8 pt). */
const FUENTE_RUBRICA = "Comisión Académica carreras Tic´s Facultad de Ciencias de la Vida y Tecnologías";
function fuente(doc: Documento, debajoDe: number, x: number) {
  const y = debajoDe + 8.3 - ASCENDENTE * 8;
  doc.font(LETRA.negritaCursiva).fontSize(8).fillColor('black').text('Fuente: ', x, y, { continued: true, lineBreak: false, lineGap: 0 });
  doc.font(LETRA.cursiva).text(FUENTE_RUBRICA, { lineBreak: false, lineGap: 0 });
}

/** Firma del miembro del tribunal. La primera parte usa una raya y las siguientes guiones, como el original. */
function firma(doc: Documento, debajoDe: number, primera: boolean) {
  const separacion = primera ? 61 : 52.4;
  let abajo = debajoDe;
  // La firma puede bajar hasta justo encima del pie (empieza en 746,5).
  if (abajo + separacion > 744) { doc.addPage(); abajo = doc.page.margins.top; }
  const base = abajo + separacion;
  if (primera) {
    linea(doc, 85.6, base - 13, 238, base - 13, 0.6);
    escribir(doc, 'MIEMBRO TRIBUNAL', 85.6, base, { letra: LETRA.negrita, tamano: 11 });
  } else {
    escribir(doc, '----------------------------', 113.5, base - 13.4, { tamano: 11 });
    escribir(doc, 'MIEMBRO TRIBUNAL', 113.5, base, { letra: LETRA.negrita, tamano: 11 });
  }
}

/** Encabezado, «Página X de Y» y pie de la plantilla, en todas las páginas. */
function decorar(doc: Documento) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.image(rutaRecursoDocumental(IMAGENES.encabezado), 85, 35.4, { width: 450.8 });
    // «Página X de Y» en cursiva, con los números en negrita, alineado al margen derecho.
    const piezas: Array<[string, string]> = [['Página ', LETRA.cursiva], [String(i - start + 1), LETRA.negritaCursiva], [' de ', LETRA.cursiva], [String(count), LETRA.negritaCursiva]];
    const ancho = piezas.reduce((total, [texto, letra]) => total + doc.font(letra).fontSize(9).widthOfString(texto), 0);
    let x = MARGEN_DERECHO - ancho;
    for (const [texto, letra] of piezas) {
      doc.font(letra).fontSize(9).fillColor('black').text(texto, x, 105 - ASCENDENTE * 9, { lineBreak: false });
      x += doc.widthOfString(texto);
    }
    // El pie de contacto está recortado un 13,187 % por arriba en la plantilla (no se ve el teléfono).
    doc.save();
    doc.rect(85, 746.5, 153.8, 59.3).clip();
    doc.image(rutaRecursoDocumental(IMAGENES.pie), 85, 746.5 - 0.13187 * (153.8 * 91 / 205), { width: 153.8 });
    doc.restore();
    doc.image(rutaRecursoDocumental(IMAGENES.marca), 234, 747.3, { width: 288.8 });
    doc.page.margins.bottom = margenInferior;
  }
}

export function dibujarRubricaPdf(datos: RubricaPdf, tituloPdf = 'Rúbrica de evaluación'): Promise<Buffer> {
  const doc = crearDocumento(tituloPdf, { top: 106.35, bottom: 841.89 - LIMITE_INFERIOR, left: MARGEN_IZQUIERDO, right: 85.05 });
  registrarLetras(doc);
  const ancho = MARGEN_DERECHO - MARGEN_IZQUIERDO;
  // Centrado entre márgenes; `desplazamiento` reproduce las sangrías de la plantilla en algunos renglones.
  const titulo = (texto: string, base: number, desplazamiento = 0) =>
    escribir(doc, texto, MARGEN_IZQUIERDO + desplazamiento, base, { letra: LETRA.negrita, tamano: 13, ancho, alineacion: 'center' });

  datos.partes.forEach((parte, indice) => {
    const primera = indice === 0;
    if (!primera) doc.addPage();
    // La primera parte junta modalidad y parte en una línea; las siguientes las separan y empiezan una línea más abajo.
    let base = primera ? 119.4 : 135.4;
    base = titulo('RUBRICA DE EVALUACIÓN DE TRABAJO DE INTEGRACIÓN CURRICULAR', base) + 15.9;
    if (primera) base = titulo(`MODALIDAD ${datos.modalidad} PARTE ${parte.numero}`, base, 21.3) + 15.9;
    else base = titulo(`PARTE ${parte.numero}`, titulo(`MODALIDAD ${datos.modalidad}`, base) + 15.9) + 15.9;
    base = titulo(parte.titulo, base, -16.6);

    const [inicial, ...resto] = parte.categorias;
    let abajo = cuadroDatos(doc, datos, inicial?.titulo ?? '', base + (primera ? 3.6 : 10.9));
    if (inicial) abajo = tablaCategoria(doc, inicial, abajo);
    for (const categoria of resto) {
      if (abajo + 60 > LIMITE_INFERIOR) { doc.addPage(); abajo = doc.page.margins.top; }
      tituloCategoria(doc, categoria.titulo, abajo + 10.8, 106.4);
      abajo = tablaCategoria(doc, categoria, abajo + 13.8);
    }
    if (indice === datos.partes.length - 1) {
      if (abajo + 80 > LIMITE_INFERIOR) { doc.addPage(); abajo = doc.page.margins.top; }
      escribir(doc, 'RESUMEN DE LA EVALUACIÓN', 87.2, abajo + 12.3, { letra: LETRA.negrita, tamano: 11 });
      abajo = tablaResumen(doc, datos.resumen, abajo + 21.4);
    }
    fuente(doc, abajo, primera ? 88 : 85.6);
    firma(doc, abajo, primera);
  });

  decorar(doc);
  return aBuffer(doc);
}
