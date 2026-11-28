import {
  centesimasPonderacion, ESQUEMA_CALIFICACION, nuevaCategoriaRubrica, nuevaEtapaRubrica,
  nuevoIndicadorRubrica, subtotalCategoriaCompleta, subtotalEtapaCompleta,
} from './creacionRubricaCompleta';

const limpiar = (texto) => String(texto ?? '').replace(/\s+/g, ' ').trim();
const normalizar = (texto) => limpiar(texto).normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
const quitarNumero = (texto) => texto.replace(/^\d+\s*[.)]\s*/, '');
const PUNTOS = /(\d+(?:[.,]\d{1,2})?)\.?\s*(?:puntos?|pts\.?)(?!\w)/i;
const PORCENTAJE = /(\d+(?:[.,]\d{1,2})?)\s*%/;
const TOTAL_TABLA = /^(?:SUMATORIA|SUBTOTAL|TOTAL)\b/;
const FORMATO_DECIMAL = /^\d{1,3}(?:[.,]\d{1,2})?$/;

function decimal(texto) {
  const valor = limpiar(texto);
  return FORMATO_DECIMAL.test(valor) ? valor.replace(',', '.') : '';
}

export function columnasRubrica(celdas) {
  const encabezados = celdas.map(normalizar);
  const indicador = encabezados.findIndex((c) => /^(?:INDICADORES?|CRITERIOS?(?: DE EVALUACION)?)$/.test(c));
  const valoracion = encabezados.findIndex((c) => /^(?:VALORACION|PONDERACION|PUNTOS(?: MAXIMOS)?|PUNTAJE(?: MAXIMO)?|MAXIMO(?: DE PUNTOS)?)$/.test(c));
  return indicador >= 0 && valoracion >= 0 ? { indicador, valoracion } : null;
}

export function esTotalTablaRubrica(texto) {
  return TOTAL_TABLA.test(normalizar(texto));
}

function quitarPuntosYPeso(texto) {
  return texto.replace(PUNTOS, '').replace(PORCENTAJE, '').replace(/\(\s*\)/g, '').replace(/[\s.:\-–]+$/, '').trim();
}

function contextoEtapa(texto) {
  const titulo = normalizar(texto);
  if (/^(?:ESCRITA\b|REVIS(?:ION|ION DEL) .*ESCRIT|PROYECTO ESCRITO|EVALUACION ESCRITA)/.test(titulo) || /\bPOR TRABAJO\b/.test(titulo)) {
    return 'TRABAJO_COMPARTIDO';
  }
  if (/^(?:ORAL\b|SUSTENTACION\b|DEFENSA ORAL\b|EVALUACION ORAL)/.test(titulo) || /\b(?:POR ESTUDIANTE|INDIVIDUAL)\b/.test(titulo)) {
    return 'ESTUDIANTE_INDIVIDUAL';
  }
  return '';
}

export function interpretarFilasRubrica(filas) {
  const etapas = [];
  const codigos = [];
  const avisos = new Set();
  let etapa;
  let categoria;
  let columnas;
  let parte;
  let anterior = '';
  let escalaDeclarada;
  let enResumen = false;

  function empezarEtapa(titulo = parte || 'Etapa ' + (etapas.length + 1)) {
    const nueva = nuevaEtapaRubrica(etapas);
    nueva.nombre = quitarPuntosYPeso(titulo).replace(/^etapa\s*:\s*/i, '');
    nueva.alcance = contextoEtapa(nueva.nombre);
    nueva.valor = decimal(titulo.match(PUNTOS)?.[1]);
    nueva.porcentaje = decimal(titulo.match(PORCENTAJE)?.[1]);
    if (etapa?.categorias.length === 0) etapas.pop();
    etapas.push(nueva);
    etapa = nueva;
    parte = null;
  }

  for (const fila of filas) {
    if (!fila) {
      columnas = null;
      anterior = '';
      continue;
    }
    const celdas = fila.map(limpiar);
    const texto = limpiar(celdas.join(' '));
    const clave = normalizar(texto);
    if (!texto) continue;

    if (/^(?:CALIFICACION FINAL|ESCALA FINAL|NOTA FINAL)\b/.test(clave)) {
      const valor = celdas.slice(1).find(decimal) ?? texto.match(/(?:final|sobre)\s*:?\s*(\d+(?:[.,]\d{1,2})?)/i)?.[1];
      const escala = Number(decimal(valor));
      if ([10, 20, 100].includes(escala)) escalaDeclarada = escala;
      continue;
    }
    if (/^RESUMEN DE (?:LA )?EVALUACION\b/.test(clave)) enResumen = true;
    if (enResumen) continue;

    const encabezado = columnasRubrica(celdas);
    if (encabezado) {
      if (!etapa || parte) empezarEtapa();
      categoria = nuevaCategoriaRubrica(etapa, codigos);
      codigos.push(categoria.codigo);
      const nombre = anterior.replace(/^[A-Z]\s*[.)]\s*/i, '');
      categoria.nombre = quitarPuntosYPeso(nombre) || 'Categoría ' + (etapa.categorias.length + 1);
      categoria.indicadores = [];
      etapa.categorias.push(categoria);
      columnas = encabezado;
      continue;
    }

    if (columnas) {
      const descripcion = celdas[columnas.indicador] ?? '';
      const puntos = decimal(celdas[columnas.valoracion]);
      if (esTotalTablaRubrica(descripcion)) {
        if (puntos && subtotalCategoriaCompleta(categoria) !== centesimasPonderacion(puntos)) {
          avisos.add('Revisa las categorías cuyos indicadores no coinciden con el subtotal del archivo.');
        }
        columnas = null;
        anterior = '';
        continue;
      }
      if (descripcion) {
        const anteriorIndicador = categoria.indicadores.at(-1);
        if (!puntos && celdas.length === 1 && anteriorIndicador && !/^\d+\s*[.)]/.test(descripcion)) {
          anteriorIndicador.descripcion += ' ' + descripcion;
        } else {
          const indicador = nuevoIndicadorRubrica(categoria.indicadores);
          categoria.indicadores.push({ ...indicador, descripcion: quitarNumero(descripcion), calificacionMaxima: puntos });
        }
      }
      continue;
    }

    const encabezadoParte = clave.match(/\bPARTE\s+([IVXLCDM]+|\d+)\s*[:\-–]?\s*(.*)$/);
    if (encabezadoParte) {
      parte = 'Parte ' + encabezadoParte[1];
      anterior = '';
      if (encabezadoParte[2] && !/^MODALIDAD\b/.test(clave)) empezarEtapa(texto);
      continue;
    }
    if (/^ETAPA\s*:/i.test(texto) || contextoEtapa(texto) || (parte && (PUNTOS.test(texto) || PORCENTAJE.test(texto)) && !/^[A-Z]\s*[.)]/i.test(texto))) {
      empezarEtapa(texto);
      anterior = '';
      continue;
    }
    if (!/^(?:PAGINA\b|RUBRICA\b|MODALIDAD\b|TITULO\b|NOMBRE\b|FUENTE\b|MIEMBRO\b)/.test(clave)) anterior = texto;
  }

  const etapasLeidas = etapas.filter((parte) => parte.categorias.some((grupo) => grupo.indicadores.length > 0));
  if (!etapasLeidas.length) throw new Error('No se encontraron tablas con indicadores y una columna de valoración.');
  for (const parte of etapasLeidas) {
    if (!parte.alcance) avisos.add('Elige el ámbito de las etapas cuyo tipo de evaluación no se identificó.');
    if (parte.categorias.some((grupo) => grupo.indicadores.some((ind) => !ind.calificacionMaxima))) {
      avisos.add('Completa los indicadores que quedaron sin ponderación.');
    }
    if (parte.valor && subtotalEtapaCompleta(parte) !== centesimasPonderacion(parte.valor)) {
      avisos.add('Revisa que las ponderaciones coincidan con los máximos declarados de cada etapa.');
    }
  }
  const valores = etapasLeidas.map((parte) => centesimasPonderacion(parte.valor) ?? subtotalEtapaCompleta(parte));
  const total = valores.every((valor) => valor !== null) ? Number(valores.reduce((suma, valor) => suma + valor, 0n)) / 100 : null;
  const modo = etapasLeidas.some(({ porcentaje }) => porcentaje) ? ESQUEMA_CALIFICACION.PORCENTAJES : ESQUEMA_CALIFICACION.SUMA;
  return { etapas: etapasLeidas, esquema: { modo }, escalaFinal: escalaDeclarada ?? ([10, 20, 100].includes(total) ? total : null), avisos: [...avisos] };
}
