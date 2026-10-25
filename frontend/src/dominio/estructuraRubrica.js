import { obtenerEtapasRubrica } from './flujoTrabajo';
import { sumarMaximosRubrica } from './rubricasApiEdicion';

export const claveElemento = (elemento) => elemento.id ?? elemento.claveLocal;
export const codigoIndicador = (indicador) => indicador.label ?? indicador.codigo ?? indicador.id ?? '';
const identidadNueva = (esApi) => esApi
  ? { claveLocal: `nuevo-${crypto.randomUUID()}` }
  : { id: `local-${crypto.randomUUID()}` };
export const decimalIndicador = (indicador) => indicador.maximoDecimal ?? String(indicador.maximo ?? 0);

/** Solo se completan las dos etapas aprobadas. Los UUID existentes nunca se sustituyen. */
export function etapasParaEditor(rubrica, esApi) {
  const existentes = obtenerEtapasRubrica(rubrica);
  const etapas = existentes.map((etapa) => ({ ...etapa, tipo: etapa.tipo ?? etapa.id }));
  for (const tipo of ['ESCRITA', 'ORAL']) {
    if (etapas.some((etapa) => etapa.tipo === tipo)) continue;
    const indice = etapas.length;
    etapas.push({
      ...(esApi ? identidadNueva(true) : { id: tipo }), tipo,
      alcance: tipo === 'ESCRITA' ? 'TRABAJO_COMPARTIDO' : 'ESTUDIANTE_INDIVIDUAL',
      codigo: tipo === 'ESCRITA' ? 'PARTE_I' : 'PARTE_II',
      nombre: tipo === 'ESCRITA' ? 'Revisión escrita' : 'Sustentación oral',
      descripcion: '', orden: indice + 1, maximo: 0, maximoDecimal: '0.00', porcentajeDecimal: null,
    });
  }
  return etapas;
}

export function nuevaCategoria(etapa, categorias, esApi) {
  const usados = new Set(categorias.map((categoria) => categoria.codigo.trim().toUpperCase()));
  let indice = 0;
  let codigo;
  do { codigo = indice < 26 ? String.fromCharCode(65 + indice) : `C${indice + 1}`; indice += 1; } while (usados.has(codigo));
  return { ...identidadNueva(esApi), etapa: claveElemento(etapa), codigo, nombre: 'Nueva categoría', indicadores: [], maximo: 0, maximoDecimal: '0.00' };
}

export function nuevoIndicador(indicadores, esApi) {
  const usados = new Set(indicadores.map(codigoIndicador));
  let numero = 1;
  while (usados.has(`I${numero}`)) numero += 1;
  return { ...identidadNueva(esApi), label: `I${numero}`, codigo: `I${numero}`, etiqueta: '', descripcion: '', maximo: 0, maximoDecimal: '0.00' };
}

/** Intercambia posiciones dentro del mismo padre, sin cambiar identificadores. */
export function moverElemento(elementos, clave, direccion, pertenece = () => true) {
  const indices = elementos.flatMap((elemento, indice) => pertenece(elemento) ? [indice] : []);
  const actual = indices.findIndex((indice) => claveElemento(elementos[indice]) === clave);
  const destino = actual + direccion;
  if (actual < 0 || destino < 0 || destino >= indices.length) return elementos;
  const copia = [...elementos];
  [copia[indices[actual]], copia[indices[destino]]] = [copia[indices[destino]], copia[indices[actual]]];
  return copia;
}

export function ordenarEstructura(etapas, categorias) {
  let orden = 0;
  return {
    etapas: etapas.map((etapa, indice) => ({ ...etapa, orden: indice + 1 })),
    categorias: etapas.flatMap((etapa) => categorias.filter((categoria) => categoria.etapa === claveElemento(etapa)).map((categoria) => ({
      ...categoria, orden: ++orden,
      indicadores: categoria.indicadores.map((indicador, indice) => ({ ...indicador, orden: indice + 1 })),
    }))),
  };
}

export function subtotalCategoria(categoria) {
  return sumarMaximosRubrica(categoria.indicadores.map(decimalIndicador));
}

export function subtotalEtapa(etapa, categorias) {
  return sumarMaximosRubrica(categorias.filter((categoria) => categoria.etapa === claveElemento(etapa)).map(subtotalCategoria));
}

/** Requisitos de persistencia para filas presentes; completar grupos se exige al activar. */
export function revisarEstructura(etapas, categorias) {
  const errores = [];
  const pendientes = [];
  const revisarTexto = (valor, maximo, campo) => {
    if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) errores.push(`${campo}: ${Number.isFinite(maximo) ? `complete un texto de hasta ${maximo} caracteres.` : 'complete el texto.'}`);
  };
  const codigos = new Set();
  const codigosEtapa = new Set();
  const tiposEtapa = etapas.map((etapa) => etapa.tipo ?? etapa.id);
  if (tiposEtapa.length !== 2 || new Set(tiposEtapa).size !== 2 || !['ESCRITA', 'ORAL'].every((tipo) => tiposEtapa.includes(tipo))) {
    errores.push('La estructura debe conservar únicamente las etapas ESCRITA y ORAL.');
  }
  const clavesEtapa = new Set(etapas.map(claveElemento));
  if (categorias.some((categoria) => !clavesEtapa.has(categoria.etapa))) {
    errores.push('Hay categorías asociadas a una etapa inexistente; no se guardaron para conservar su información.');
  }
  for (const etapa of etapas) {
    const tipo = etapa.tipo ?? etapa.id;
    const alcanceEsperado = tipo === 'ESCRITA' ? 'TRABAJO_COMPARTIDO' : tipo === 'ORAL' ? 'ESTUDIANTE_INDIVIDUAL' : null;
    if (alcanceEsperado && etapa.alcance !== alcanceEsperado) errores.push(`El alcance de ${tipo} no corresponde a la evaluación aprobada.`);
    revisarTexto(etapa.codigo, 40, 'Código de etapa');
    revisarTexto(etapa.nombre, 220, 'Nombre de etapa');
    const codigoEtapa = etapa.codigo?.trim().toUpperCase();
    if (codigosEtapa.has(codigoEtapa)) errores.push('Los códigos de etapa no pueden repetirse.');
    codigosEtapa.add(codigoEtapa);
    const grupo = categorias.filter((categoria) => categoria.etapa === claveElemento(etapa));
    if (!grupo.length) pendientes.push(`${etapa.nombre}: añada al menos una categoría.`);
    for (const categoria of grupo) {
      revisarTexto(categoria.codigo, 10, 'Código de categoría');
      revisarTexto(categoria.nombre, 240, `Nombre de categoría ${categoria.codigo}`);
      const codigo = categoria.codigo?.trim().toUpperCase();
      if (codigos.has(codigo)) errores.push(`El código de categoría ${categoria.codigo} está repetido.`);
      codigos.add(codigo);
      if (!categoria.indicadores.length) pendientes.push(`Categoría ${categoria.codigo}: añada al menos un indicador.`);
      for (const indicador of categoria.indicadores) {
        revisarTexto(codigoIndicador(indicador), 40, `Código de indicador en ${categoria.codigo}`);
        revisarTexto(indicador.etiqueta, Infinity, `Descripción de indicador en ${categoria.codigo}`);
        try {
          const maximo = sumarMaximosRubrica([decimalIndicador(indicador)]);
          if (Number(maximo) <= 0 || Number(maximo) > 99.99) throw new Error();
        } catch { errores.push(`Indicador de ${categoria.codigo}: indique un máximo positivo de hasta 99.99, con dos decimales como máximo.`); }
      }
      try { if (Number(subtotalCategoria(categoria)) > 99.99) throw new Error(); }
      catch { errores.push(`El subtotal de ${categoria.codigo} no puede superar 99.99 ni contener decimales inválidos.`); }
    }
    try { subtotalEtapa(etapa, categorias); } catch { errores.push(`El subtotal de ${etapa.nombre} debe ser válido y no superar 999.99.`); }
  }
  return { errores: [...new Set(errores)], pendientes: [...new Set([...errores, ...pendientes])] };
}
