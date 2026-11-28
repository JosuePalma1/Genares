import { columnasRubrica, esTotalTablaRubrica, interpretarFilasRubrica } from '../../domain/importarRubrica';

const MAXIMO_ARCHIVO = 10 * 1024 * 1024;
const MAXIMO_XML = 4 * 1024 * 1024;
const MAXIMO_PAGINAS = 50;
const XML_DOCUMENTO = 'word/document.xml';
const ESPACIO_WORD = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const descendientesWord = (nodo, nombre) => Array.from(nodo.getElementsByTagNameNS(ESPACIO_WORD, nombre));
const textoParrafo = (parrafo) => descendientesWord(parrafo, 't').map((texto) => texto.textContent).join('');

async function filasDocx(datos) {
  const { unzipSync } = await import('fflate');
  let xml;
  try {
    xml = unzipSync(datos, { filter: (archivo) => archivo.name === XML_DOCUMENTO && archivo.originalSize <= MAXIMO_XML })[XML_DOCUMENTO];
  } catch {
    throw new Error('No se pudo abrir el documento Word. Comprueba que sea un archivo .docx válido.');
  }
  if (!xml?.length) throw new Error('El archivo Word no contiene un documento legible dentro del límite de importación.');
  const fuente = new TextDecoder('utf-8').decode(xml);
  const documento = new DOMParser().parseFromString(fuente, 'application/xml');
  const cuerpo = descendientesWord(documento, 'body')[0];
  if (!cuerpo) throw new Error('El contenido del documento Word no tiene una estructura válida.');
  return Array.from(cuerpo.children).flatMap((nodo) => {
    if (nodo.localName === 'p') return [[textoParrafo(nodo)]];
    if (nodo.localName !== 'tbl') return [];
    const filas = Array.from(nodo.children).filter(({ localName }) => localName === 'tr').map((fila) =>
      Array.from(fila.children).filter(({ localName }) => localName === 'tc')
        .map((celda) => descendientesWord(celda, 'p').map(textoParrafo).join(' ')));
    return [...filas, null];
  });
}

function agruparFragmentos(fragmentos) {
  const celdas = [];
  for (const fragmento of fragmentos) {
    const anterior = celdas.at(-1);
    if (anterior && fragmento.x - anterior.fin < 5) {
      anterior.texto += ' ' + fragmento.texto;
      anterior.fin = fragmento.fin;
    } else celdas.push({ ...fragmento });
  }
  return celdas;
}

export function filasDePaginaPdf(elementos) {
  const fragmentos = elementos.filter((item) => typeof item.str === 'string' && item.str.trim() && item.transform)
    .map((item) => ({ x: item.transform[4], y: item.transform[5], fin: item.transform[4] + item.width, texto: item.str.trim() }))
    .sort((a, b) => b.y - a.y);
  const porLinea = [];
  for (const fragmento of fragmentos) {
    const linea = porLinea.at(-1);
    if (linea && Math.abs(linea.y - fragmento.y) < 2.5) linea.fragmentos.push(fragmento);
    else porLinea.push({ y: fragmento.y, fragmentos: [fragmento] });
  }
  let limites;
  return porLinea.map(({ fragmentos }) => {
    fragmentos.sort((a, b) => a.x - b.x);
    const columnasDirectas = columnasRubrica(fragmentos.map(({ texto }) => texto));
    const celdas = columnasDirectas ? fragmentos : agruparFragmentos(fragmentos);
    const columnas = columnasDirectas ?? columnasRubrica(celdas.map(({ texto }) => texto));
    if (columnas && columnas.indicador < columnas.valoracion) {
      limites = {
        desde: celdas[columnas.valoracion].x - 4,
        hasta: celdas[columnas.valoracion + 1]?.x ?? Infinity,
      };
      return [celdas[columnas.indicador].texto, celdas[columnas.valoracion].texto];
    }
    if (!limites) return [fragmentos.map(({ texto }) => texto).join(' ')];

    const descripcion = fragmentos.filter(({ x }) => x < limites.desde).map(({ texto }) => texto).join(' ');
    const valoracion = fragmentos.filter(({ x }) => x >= limites.desde && x < limites.hasta).map(({ texto }) => texto).join(' ');
    if (esTotalTablaRubrica(descripcion)) limites = null;
    return valoracion ? [descripcion, valoracion] : [descripcion];
  });
}

async function filasPdf(datos, signal) {
  const [{ getDocument, GlobalWorkerOptions }, { default: workerSrc }] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  signal?.throwIfAborted();
  GlobalWorkerOptions.workerSrc = workerSrc;
  const carga = getDocument({ data: datos, useSystemFonts: false });
  const cancelar = () => { void carga.destroy().catch(() => {}); };
  signal?.addEventListener('abort', cancelar, { once: true });
  try {
    const documento = await carga.promise.catch((error) => {
      if (signal?.aborted) throw error;
      const mensaje = error?.name === 'PasswordException'
        ? 'El PDF está protegido con contraseña. Selecciona una copia con texto que se pueda abrir.'
        : 'No se pudo abrir el archivo como PDF. Comprueba que el archivo sea válido.';
      throw new Error(mensaje);
    });
    if (documento.numPages > MAXIMO_PAGINAS) throw new Error('El PDF debe tener un máximo de 50 páginas.');
    const filas = [];
    for (let numero = 1; numero <= documento.numPages; numero += 1) {
      signal?.throwIfAborted();
      const pagina = await documento.getPage(numero);
      filas.push(...filasDePaginaPdf((await pagina.getTextContent()).items));
      pagina.cleanup();
    }
    if (!filas.length) throw new Error('El PDF no contiene texto seleccionable. Usa el archivo Word o un PDF con texto.');
    return filas;
  } finally {
    signal?.removeEventListener('abort', cancelar);
    if (!signal?.aborted) await carga.destroy();
  }
}

export async function importarRubricaArchivo(archivo, { signal } = {}) {
  const extension = archivo?.name?.split('.').at(-1)?.toLowerCase();
  if (!['docx', 'pdf'].includes(extension)) throw new Error('Selecciona un archivo .docx o .pdf.');
  if (!archivo.size || archivo.size > MAXIMO_ARCHIVO) throw new Error('El archivo debe tener contenido y pesar como máximo 10 MB.');
  const datos = new Uint8Array(await archivo.arrayBuffer());
  signal?.throwIfAborted();
  const filas = extension === 'docx' ? await filasDocx(datos) : await filasPdf(datos, signal);
  signal?.throwIfAborted();
  return interpretarFilasRubrica(filas);
}
