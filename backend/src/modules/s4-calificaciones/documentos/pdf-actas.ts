import {
  aBuffer, anchoUtil, asegurarEspacio, crearDocumento, decorarPaginas, encabezadoFacultad, FUENTE_NEGRITA, FUENTE, Margenes, parrafo, tabla,
} from './pdf-dibujo';
import { PLANTILLAS } from './plantillas-institucionales';

export type FormatoActa = keyof typeof PLANTILLAS;

/** Un cambio sobre el texto de la plantilla: se busca `original` y se pone `valor` (y la nota en letras al lado). */
export interface CambioActa { original: string; valor: string; letras?: string; ocurrencia?: number }

/** Espacio de firma: se imprime tal cual el formato; la facultad completa títulos y nombres a mano. */
interface Firma { nombre: string; cargos: string[] }
type Bloque =
  | { tipo: 'parrafo'; texto: string; negrita?: boolean; alineacion?: 'left' | 'center' | 'right' | 'justify'; despues?: number }
  | { tipo: 'tabla'; filas: string[][] }
  | { tipo: 'firmas'; filas: Firma[][] }
  | { tipo: 'dato'; izquierda: string; derecha?: string };

const NOMBRE = '… (Título académico) …(Nombres)';
const GRADUADO = 'Sr/Señora/Señorita …(Nombres)';

/** Texto literal de cada plantilla, en el orden del documento. Los «…» y «xx» son los huecos del original. */
const ACTAS: Record<FormatoActa, { margenes: Margenes; bloques: Bloque[] }> = {
  'PAT-01-F-019': {
    // Márgenes del original (superior 3,5 cm, inferior 2 cm, izquierdo 3 cm, derecho 2,25 cm). Las actas no llevan pie.
    margenes: { top: 99.25, bottom: 56.7, left: 85.05, right: 63.75 },
    bloques: [
      { tipo: 'parrafo', texto: 'No. ……', negrita: true, alineacion: 'right', despues: 8 },
      { tipo: 'parrafo', texto: 'ACTA DE CALIFICACIÓN DE TITULACIÓN', negrita: true, alineacion: 'center', despues: 14 },
      { tipo: 'parrafo', texto: PLANTILLAS['PAT-01-F-019'].introduccion, negrita: true, alineacion: 'justify' },
      { tipo: 'parrafo', texto: '… (NOMBRES DEL/LA ESTUDIANTE) con número de identificación ...(identificación).', negrita: true, alineacion: 'justify', despues: 12 },
      { tipo: 'parrafo', texto: 'El tema evaluado fue: “………”, calificado por el Tribunal de titulación, desglosado de la siguiente forma:', negrita: true, alineacion: 'justify', despues: 8 },
      { tipo: 'tabla', filas: [
        ['Trabajo de titulación', 'Calificación en números', 'Calificación en letras'],
        ['Trabajo de titulación', 'XX/10', ''],
        ['Sustentación del trabajo de titulación', 'XX/10', ''],
        ['Sumatoria calificación final', 'XX/10', ''],
      ] },
      { tipo: 'parrafo', texto: 'En consecuencia, el tribunal de titulación declara APROBADO el grado de… (TITULO OBTENIDO) al/la graduado/a… (NOMBRES).', negrita: true, alineacion: 'justify', despues: 12 },
      { tipo: 'parrafo', texto: PLANTILLAS['PAT-01-F-019'].constancia, alineacion: 'justify', despues: 18 },
      { tipo: 'parrafo', texto: 'Manta, xx de xxxx del 20xx.', despues: 6 },
      { tipo: 'firmas', filas: [
        [{ nombre: NOMBRE, cargos: ['Decano (a)', 'Presidente Tribunal'] }, { nombre: NOMBRE, cargos: ['Miembro del tribunal'] }],
        [{ nombre: NOMBRE, cargos: ['Miembro del tribunal'] }, { nombre: GRADUADO, cargos: ['Graduado(a)'] }],
        [{ nombre: '… (título académico) …(Nombres)', cargos: ['Secretario (a) Facultad'] }],
      ] },
      { tipo: 'dato', izquierda: 'CARRERA:       ………………….', derecha: 'MODALIDAD: PRESENCIAL' },
      { tipo: 'dato', izquierda: 'NIVEL:            Tercer Nivel', derecha: 'LUGAR: ' },
      { tipo: 'dato', izquierda: 'Elaborado por: ' },
    ],
  },
  'PAT-04-F-017': {
    // El original tiene 0,25 cm abajo; se deja 1,5 cm para que el texto no toque el borde al imprimir.
    margenes: { top: 99.25, bottom: 42.5, left: 85.05, right: 49.6 },
    bloques: [
      { tipo: 'parrafo', texto: 'ACTA DE CALIFICACIÓN DEL', negrita: true, alineacion: 'center' },
      { tipo: 'parrafo', texto: 'TRABAJO DE INTEGRACIÓN CURRICULAR O EXAMEN COMPLEXIVO No……', negrita: true, alineacion: 'center', despues: 14 },
      { tipo: 'parrafo', texto: PLANTILLAS['PAT-04-F-017'].introduccion, negrita: true, alineacion: 'justify' },
      { tipo: 'parrafo', texto: '… (NOMBRES DEL/LA ESTUDIANTE) con número de identificación ...(identificación).', negrita: true, alineacion: 'justify', despues: 12 },
      { tipo: 'parrafo', texto: 'El tema evaluado fue: “………”, calificado por el Tribunal de Titulación, desglosado de la siguiente forma:', negrita: true, alineacion: 'justify', despues: 8 },
      { tipo: 'tabla', filas: [
        ['Trabajo de integración curricular/Examen de carácter complexivo', 'Calificación en números', 'Calificación en letras'],
        ['Trabajo de Integración curricular/Trabajo escrito', '7/10', ''],
        ['Sustentación/Componente oral', '9/10', ''],
        ['Calificación final de titulación', '16/20', ''],
      ] },
      { tipo: 'parrafo', texto: 'En consecuencia, el tribunal de titulación declara APROBADO el grado de… (TITULO OBTENIDO) al/la graduado/a… (NOMBRES).', negrita: true, alineacion: 'justify', despues: 12 },
      { tipo: 'parrafo', texto: PLANTILLAS['PAT-04-F-017'].constancia, alineacion: 'justify', despues: 18 },
      { tipo: 'parrafo', texto: 'Lugar, xx de xxxx del 20xx.', despues: 6 },
      { tipo: 'firmas', filas: [
        [{ nombre: NOMBRE, cargos: ['Presidente Tribunal'] }, { nombre: NOMBRE, cargos: ['Miembro del tribunal'] }],
        [{ nombre: NOMBRE, cargos: ['Miembro del tribunal'] }, { nombre: GRADUADO, cargos: ['Graduado(a)'] }],
        [{ nombre: NOMBRE, cargos: ['Tutor/a'] }, { nombre: NOMBRE, cargos: ['Analista 2 Facultad/Extensión'] }],
      ] },
      { tipo: 'dato', izquierda: 'CARRERA:       ………………….', derecha: 'MODALIDAD: PRESENCIAL/VIRTUAL' },
      { tipo: 'dato', izquierda: 'NIVEL:            Tercer Nivel', derecha: 'LUGAR: ' },
      { tipo: 'dato', izquierda: 'Elaborado por: ' },
    ],
  },
};

/** Huecos de texto de la plantilla en el orden del documento; las celdas recuerdan su tabla, fila y columna. */
interface Hueco { leer: () => string; escribir: (texto: string) => void; celda?: { filas: string[][]; fila: number; columna: number } }

function huecos(bloques: Bloque[]): Hueco[] {
  return bloques.flatMap((bloque): Hueco[] => {
    if (bloque.tipo === 'parrafo') return [{ leer: () => bloque.texto, escribir: (t) => { bloque.texto = t; } }];
    if (bloque.tipo === 'dato') return [{ leer: () => bloque.izquierda, escribir: (t) => { bloque.izquierda = t; } }];
    if (bloque.tipo === 'firmas') return [];
    return bloque.filas.flatMap((fila, f) => fila.map((_, c) => ({
      leer: () => bloque.filas[f][c], escribir: (t: string) => { bloque.filas[f][c] = t; },
      celda: { filas: bloque.filas, fila: f, columna: c },
    })));
  });
}

/**
 * Rellena una copia de la plantilla. Cada cambio busca su marcador (la n-ésima vez que aparece) en el
 * texto ORIGINAL, así un valor ya puesto nunca se confunde con otro marcador. Falla si falta alguno.
 */
export function rellenarActa(formato: FormatoActa, cambios: readonly CambioActa[]): Bloque[] {
  const bloques: Bloque[] = structuredClone(ACTAS[formato].bloques);
  const lista = huecos(bloques);
  const originales = lista.map((h) => h.leer());
  const aplicar: Array<{ hueco: number; inicio: number; cambio: CambioActa }> = [];
  for (const cambio of cambios) {
    let restantes = cambio.ocurrencia ?? 1;
    let encontrado: { hueco: number; inicio: number } | null = null;
    for (let h = 0; h < originales.length && !encontrado; h++) {
      let desde = 0;
      while (!encontrado) {
        const inicio = originales[h].indexOf(cambio.original, desde);
        if (inicio < 0) break;
        if (--restantes === 0) encontrado = { hueco: h, inicio };
        desde = inicio + cambio.original.length;
      }
    }
    if (!encontrado) throw new Error(`Falta un marcador en la plantilla: ${cambio.original}`);
    aplicar.push({ ...encontrado, cambio });
  }
  // De derecha a izquierda dentro de cada hueco, para no mover las posiciones pendientes.
  aplicar.sort((a, b) => a.hueco - b.hueco || b.inicio - a.inicio);
  for (const { hueco, inicio, cambio } of aplicar) {
    const actual = lista[hueco].leer();
    lista[hueco].escribir(actual.slice(0, inicio) + cambio.valor + actual.slice(inicio + cambio.original.length));
    const celda = lista[hueco].celda;
    if (cambio.letras !== undefined && celda && celda.columna + 1 < celda.filas[celda.fila].length) {
      celda.filas[celda.fila][celda.columna + 1] = cambio.letras;
    }
  }
  return bloques;
}

export function dibujarActaPdf(formato: FormatoActa, cambios: readonly CambioActa[], titulo = `Acta ${formato}`): Promise<Buffer> {
  const { margenes } = ACTAS[formato];
  const bloques = rellenarActa(formato, cambios);
  const doc = crearDocumento(titulo, margenes);
  const ancho = anchoUtil(doc);
  const x0 = margenes.left;

  for (const bloque of bloques) {
    if (bloque.tipo === 'parrafo') {
      parrafo(doc, bloque.texto, { negrita: bloque.negrita, tamano: 11, alineacion: bloque.alineacion, despues: bloque.despues ?? 2 });
    } else if (bloque.tipo === 'tabla') {
      tabla(doc, bloque.filas, { anchos: [ancho * 0.5, ancho * 0.22, ancho * 0.28], centradas: [1, 2], cabecera: 0, negritas: [0], tamano: 10 });
      doc.y += 12;
    } else if (bloque.tipo === 'firmas') {
      for (const fila of bloque.filas) {
        // Espacio para firmar; el nombre y el cargo de cada firma no se separan entre páginas.
        asegurarEspacio(doc, 30 + 40);
        doc.y += 30;
        const y = doc.y;
        const columnas = fila.length === 1 ? [{ x: x0, ancho }] : [{ x: x0, ancho: ancho / 2 }, { x: x0 + ancho / 2, ancho: ancho / 2 }];
        let fin = y;
        fila.forEach((firma, i) => {
          doc.font(FUENTE).fontSize(10).fillColor('black').text(firma.nombre, columnas[i].x, y, { width: columnas[i].ancho, align: 'center' });
          for (const cargo of firma.cargos) doc.font(FUENTE_NEGRITA).text(cargo, columnas[i].x, doc.y, { width: columnas[i].ancho, align: 'center' });
          fin = Math.max(fin, doc.y);
        });
        doc.y = fin;
      }
      doc.y += 24;
    } else {
      asegurarEspacio(doc, 16);
      const y = doc.y;
      doc.font(FUENTE_NEGRITA).fontSize(10).fillColor('black').text(bloque.izquierda, x0, y, { width: ancho * 0.6 });
      const fin = doc.y;
      if (bloque.derecha !== undefined) doc.text(bloque.derecha, x0 + ancho * 0.6, y, { width: ancho * 0.4 });
      doc.y = Math.max(fin, doc.y) + 2;
    }
  }

  const revision = PLANTILLAS[formato].revision;
  decorarPaginas(doc, () => {
    // Imagen algo menor que en la rúbrica para que el código y la revisión quepan debajo (termina en y ≈ 80).
    encabezadoFacultad(doc, 330);
    doc.font(FUENTE_NEGRITA).fontSize(8).fillColor('black')
      .text(`CÓDIGO: ${formato}    REVISIÓN: ${revision}`, x0, 84, { width: ancho, align: 'right' });
  });
  return aBuffer(doc);
}
