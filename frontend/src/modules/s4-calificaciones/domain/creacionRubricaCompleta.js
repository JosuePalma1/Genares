const ALCANCES_VALIDOS = new Set(['TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL']);
const DECIMAL = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/;
const CODIGO = /^[A-Za-z][A-Za-z0-9_-]*$/;

export function claveLocalRubrica() {
  return `nuevo-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function codigoDisponible(prefijo, usados, maximo = 40) {
  const normalizados = new Set(usados.map((codigo) => String(codigo).toUpperCase()));
  for (let numero = 1; numero < 32768; numero += 1) {
    const candidato = `${prefijo}${numero}`.slice(0, maximo);
    if (!normalizados.has(candidato.toUpperCase())) return candidato;
  }
  throw new Error('Se alcanzó el límite de códigos para este grupo.');
}

export function crearEstructuraInicialRubrica() {
  return [
    { claveLocal: claveLocalRubrica(), codigo: 'ETAPA_1', nombre: 'Escrita', alcance: 'TRABAJO_COMPARTIDO', valor: '', porcentaje: '', categorias: [] },
    { claveLocal: claveLocalRubrica(), codigo: 'ETAPA_2', nombre: 'Oral', alcance: 'ESTUDIANTE_INDIVIDUAL', valor: '', porcentaje: '', categorias: [] },
  ];
}

/**
 * Esquema de calificación en «Nueva rúbrica».
 * - SUMA: las partes suman la nota final (rúbrica oficial: 5 + 5 = 10). No se guardan porcentajes.
 * - PORCENTAJES: cada parte vale lo que quiera y se indica su peso; los pesos suman 100 %.
 */
export const ESQUEMA_CALIFICACION = Object.freeze({ SUMA: 'SUMA', PORCENTAJES: 'PORCENTAJES' });

export function crearEsquemaInicialRubrica() {
  return { modo: ESQUEMA_CALIFICACION.SUMA };
}

/** Esquemas frecuentes: rellenan el valor (y el peso) de las dos partes. */
export const ATAJOS_ESQUEMA = Object.freeze([
  { id: 'OFICIAL_5_5', etiqueta: 'Oficial: 5 + 5 = 10', modo: ESQUEMA_CALIFICACION.SUMA, valores: ['5.00', '5.00'], porcentajes: ['', ''] },
  { id: 'DIEZ_DIEZ_50', etiqueta: '10 + 10 al 50 % cada una', modo: ESQUEMA_CALIFICACION.PORCENTAJES, valores: ['10.00', '10.00'], porcentajes: ['50', '50'] },
]);

/** Aplica un esquema frecuente sin tocar categorías ni indicadores. */
export function aplicarAtajoEsquemaRubrica(datos, idAtajo) {
  const atajo = ATAJOS_ESQUEMA.find(({ id }) => id === idAtajo);
  if (!atajo) return datos;
  return {
    ...datos,
    esquema: { modo: atajo.modo },
    etapas: datos.etapas.map((etapa, indice) => ({
      ...etapa,
      valor: atajo.valores[indice] ?? etapa.valor ?? '',
      porcentaje: atajo.porcentajes[indice] ?? '',
    })),
  };
}

/** Cambia la forma de combinar las partes; en «sumar puntos» se vacían los pesos para no guardarlos. */
export function cambiarModoEsquemaRubrica(datos, modo) {
  return {
    ...datos,
    esquema: { modo },
    etapas: modo === ESQUEMA_CALIFICACION.SUMA ? datos.etapas.map((etapa) => ({ ...etapa, porcentaje: '' })) : datos.etapas,
  };
}

/** Resumen del esquema: cuánto suman las partes (modo SUMA) o los pesos (modo PORCENTAJES). */
export function resumenEsquemaRubrica(datos) {
  const escala = (datos?.escalaFinal ?? 10).toFixed(2);
  const maximo = BigInt((datos?.escalaFinal ?? 10) * 100);
  const modo = datos?.esquema?.modo ?? ESQUEMA_CALIFICACION.SUMA;
  const etapas = datos?.etapas ?? [];
  if (modo === ESQUEMA_CALIFICACION.PORCENTAJES) {
    const pesos = etapas.map((etapa) => centesimasPonderacion(etapa.porcentaje));
    if (pesos.some((peso) => peso === null || peso <= 0n)) {
      return { modo, estado: 'incompleta', mensaje: 'Indique el peso (%) de cada parte.' };
    }
    const suma = pesos.reduce((total, peso) => total + peso, 0n);
    return suma === 10000n
      ? { modo, estado: 'completa', mensaje: 'Los pesos suman 100 %.' }
      : { modo, estado: suma < 10000n ? 'faltante' : 'excedida', mensaje: `Los pesos deben sumar 100 % (suman ${formatearCentesimas(suma)} %).` };
  }
  const totales = etapas.map((etapa) => valorDeclaradoEtapa(etapa) ?? subtotalEtapaCompleta(etapa));
  if (totales.some((total) => total === null || total <= 0n)) {
    return { modo, estado: 'incompleta', mensaje: `Indique cuánto vale cada parte; deben sumar ${escala}.` };
  }
  const suma = totales.reduce((total, valor) => total + valor, 0n);
  return suma === maximo
    ? { modo, estado: 'completa', mensaje: `Las partes suman ${escala}, la nota final.` }
    : { modo, estado: suma < maximo ? 'faltante' : 'excedida', mensaje: `Las partes deben sumar ${escala} (suman ${formatearCentesimas(suma)}). Ajuste los puntos o use porcentajes.` };
}

/** Valor declarado de la etapa en el esquema (null si no se indicó o no es válido). */
export function valorDeclaradoEtapa(etapa) {
  if (etapa?.valor === undefined || etapa?.valor === null || String(etapa.valor).trim() === '') return null;
  const valor = centesimasPonderacion(String(etapa.valor).trim());
  return valor !== null && valor > 0n ? valor : null;
}

export function nuevaEtapaRubrica(etapas) {
  return {
    claveLocal: claveLocalRubrica(),
    codigo: codigoDisponible('ETAPA_', etapas.map((etapa) => etapa.codigo)),
    nombre: 'Nueva etapa',
    alcance: '',
    valor: '',
    porcentaje: '',
    categorias: [],
  };
}

/** El código no se repite en toda la versión: es lo que exige la activación (C1, C2 en la escrita; C3 en la oral). */
export function nuevaCategoriaRubrica(etapa, codigosUsados = etapa.categorias.map((categoria) => categoria.codigo)) {
  return {
    claveLocal: claveLocalRubrica(),
    codigo: codigoDisponible('C', codigosUsados, 10),
    nombre: 'Nueva categoría',
    indicadores: [nuevoIndicadorRubrica([])],
  };
}

export function nuevoIndicadorRubrica(indicadores) {
  return {
    claveLocal: claveLocalRubrica(),
    label: codigoDisponible('I', indicadores.map((indicador) => indicador.label), 40),
    descripcion: '',
    calificacionMaxima: '',
  };
}

export function moverElementoRubrica(elementos, indice, direccion) {
  const destino = indice + direccion;
  if (destino < 0 || destino >= elementos.length) return elementos;
  const copia = [...elementos];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

export function agregarEtapaRubrica(etapas) {
  return [...etapas, nuevaEtapaRubrica(etapas)];
}

export function eliminarEtapaRubrica(etapas, clave) {
  return etapas.filter((etapa) => etapa.claveLocal !== clave);
}

export function cambiarEtapaRubrica(etapas, clave, cambios) {
  return etapas.map((etapa) => etapa.claveLocal === clave ? { ...etapa, ...cambios } : etapa);
}

export function agregarCategoriaRubrica(etapas, claveEtapa) {
  const codigosUsados = etapas.flatMap((etapa) => etapa.categorias.map((categoria) => categoria.codigo));
  return etapas.map((etapa) => etapa.claveLocal === claveEtapa
    ? { ...etapa, categorias: [...etapa.categorias, nuevaCategoriaRubrica(etapa, codigosUsados)] }
    : etapa);
}

export function eliminarCategoriaRubrica(etapas, claveEtapa, claveCategoria) {
  return etapas.map((etapa) => etapa.claveLocal === claveEtapa
    ? { ...etapa, categorias: etapa.categorias.filter((categoria) => categoria.claveLocal !== claveCategoria) }
    : etapa);
}

export function cambiarCategoriaRubrica(etapas, claveEtapa, claveCategoria, cambios) {
  return etapas.map((etapa) => etapa.claveLocal === claveEtapa
    ? { ...etapa, categorias: etapa.categorias.map((categoria) => categoria.claveLocal === claveCategoria ? { ...categoria, ...cambios } : categoria) }
    : etapa);
}

export function agregarIndicadorRubrica(etapas, claveEtapa, claveCategoria) {
  return etapas.map((etapa) => etapa.claveLocal === claveEtapa
    ? { ...etapa, categorias: etapa.categorias.map((categoria) => categoria.claveLocal === claveCategoria
      ? { ...categoria, indicadores: [...categoria.indicadores, nuevoIndicadorRubrica(categoria.indicadores)] }
      : categoria) }
    : etapa);
}

export function eliminarIndicadorRubrica(etapas, claveEtapa, claveCategoria, claveIndicador) {
  return etapas.map((etapa) => etapa.claveLocal === claveEtapa
    ? { ...etapa, categorias: etapa.categorias.map((categoria) => categoria.claveLocal === claveCategoria
      ? { ...categoria, indicadores: categoria.indicadores.filter((indicador) => indicador.claveLocal !== claveIndicador) }
      : categoria) }
    : etapa);
}

export function cambiarIndicadorRubrica(etapas, claveEtapa, claveCategoria, claveIndicador, cambios) {
  return etapas.map((etapa) => etapa.claveLocal === claveEtapa
    ? { ...etapa, categorias: etapa.categorias.map((categoria) => categoria.claveLocal === claveCategoria
      ? { ...categoria, indicadores: categoria.indicadores.map((indicador) => indicador.claveLocal === claveIndicador ? { ...indicador, ...cambios } : indicador) }
      : categoria) }
    : etapa);
}

export function centesimasPonderacion(valor) {
  if (typeof valor !== 'string' || !DECIMAL.test(valor.trim())) return null;
  const [enteros, fraccion = ''] = valor.trim().split('.');
  return BigInt(enteros) * 100n + BigInt(fraccion.padEnd(2, '0') || '0');
}

export function formatearCentesimas(valor) {
  const centesimas = typeof valor === 'bigint' ? valor : BigInt(valor);
  const entero = centesimas / 100n;
  const fraccion = String(centesimas % 100n).padStart(2, '0');
  return `${entero}.${fraccion}`;
}

export function sumarPonderacionesRubrica(valores) {
  let total = 0n;
  for (const valor of valores) {
    const centesimas = centesimasPonderacion(valor);
    if (centesimas === null) return null;
    total += centesimas;
  }
  return total;
}

export function subtotalCategoriaCompleta(categoria) {
  return sumarPonderacionesRubrica(categoria.indicadores.map((indicador) => indicador.calificacionMaxima));
}

export function subtotalEtapaCompleta(etapa) {
  return sumarPonderacionesRubrica(etapa.categorias.flatMap((categoria) => (
    categoria.indicadores.map((indicador) => indicador.calificacionMaxima)
  )));
}

export function resumenPonderacionEtapa(etapa) {
  const total = subtotalEtapaCompleta(etapa);
  if (total === null || !etapa.categorias.some((categoria) => categoria.indicadores.length)) {
    const declarado = valorDeclaradoEtapa(etapa);
    return {
      total, ...(declarado === null ? {} : { declarado }), estado: 'incompleta',
      mensaje: declarado === null ? 'Agregue indicadores con ponderaciones válidas.' : `Agregue indicadores hasta llegar a ${formatearCentesimas(declarado)} puntos.`,
    };
  }
  // Cada etapa vale lo que suman sus indicadores (5 + 5, 10 + 10…); la nota final se calcula sobre 10.
  if (total > MAXIMO_CENTESIMAS_ETAPA) {
    return { total, estado: 'excedida', mensaje: `Una etapa puede valer como máximo ${formatearCentesimas(MAXIMO_CENTESIMAS_ETAPA)} puntos.` };
  }
  // Con el valor declarado en el esquema, los indicadores deben llegar exactamente a ese valor.
  const declarado = valorDeclaradoEtapa(etapa);
  if (declarado !== null && total < declarado) {
    return { total, declarado, estado: 'faltante', mensaje: `Faltan ${formatearCentesimas(declarado - total)} de ${formatearCentesimas(declarado)} puntos.` };
  }
  if (declarado !== null && total > declarado) {
    return { total, declarado, estado: 'excedida', mensaje: `Sobran ${formatearCentesimas(total - declarado)}: la etapa vale ${formatearCentesimas(declarado)} puntos.` };
  }
  if (declarado !== null) return { total, declarado, estado: 'completa', mensaje: `Completa: ${formatearCentesimas(total)} de ${formatearCentesimas(declarado)} puntos.` };
  return { total, estado: 'completa', mensaje: `La etapa vale ${formatearCentesimas(total)} puntos.` };
}

/**
 * Peso de cada etapa en la nota final, igual que la consolidación del servidor cuando la rúbrica no guarda
 * porcentajes: según lo que vale cada etapa (5 + 5 → 50 % y 50 %; 3 + 7 → 30 % y 70 %).
 * Devuelve null si alguna etapa todavía no tiene un total válido.
 */
export function pesosEtapasPorValor(totales) {
  if (!totales.length || totales.some((total) => total === null || total <= 0n)) return null;
  const suma = totales.reduce((acumulado, total) => acumulado + total, 0n);
  return totales.map((total) => Number((total * 10000n) / suma) / 100);
}

/** Tope de una etapa para atrapar errores de tecleo (igual que el servidor). */
export const MAXIMO_CENTESIMAS_ETAPA = 10000n;

function agregarError(errores, campo, mensaje) {
  errores.push({ campo, mensaje });
}

function validarTexto(valor, minimo, maximo) {
  return typeof valor === 'string' && valor.trim().length >= minimo && valor.trim().length <= maximo;
}

export function validarRubricaCompleta(formulario) {
  const errores = [];
  if (!formulario?.modalidadId) agregarError(errores, 'modalidadId', 'Seleccione una modalidad.');
  if (!formulario?.periodoId) agregarError(errores, 'periodoId', 'Seleccione un período académico.');
  if (!validarTexto(formulario?.nombre, 1, 220)) agregarError(errores, 'nombre', 'Indique un nombre de rúbrica de hasta 220 caracteres.');
  if (!validarTexto(formulario?.version, 1, 30)) agregarError(errores, 'version', 'Indique el identificador de versión (hasta 30 caracteres).');

  const carreras = formulario?.carreras ?? [];
  if (!Array.isArray(carreras) || carreras.length === 0) {
    agregarError(errores, 'carreras', 'Seleccione al menos una carrera.');
  } else {
    const ids = carreras.map((carrera) => carrera.carreraId);
    if (new Set(ids).size !== ids.length || carreras.some((carrera) => (
      !validarTexto(carrera.carreraId, 1, 80)
      || !Number.isInteger(carrera.revision)
      || carrera.revision < 1
      || typeof carrera.vigente !== 'boolean'
      || !(carrera.vigenciaEsperada?.versionId === null || validarTexto(carrera.vigenciaEsperada?.versionId, 36, 36))
    ))) agregarError(errores, 'carreras', 'Revise la revisión y la vigencia esperada de cada carrera seleccionada.');
  }

  const etapas = formulario?.etapas ?? [];
  if (!Array.isArray(etapas) || etapas.length === 0) {
    agregarError(errores, 'etapas', 'Agregue al menos una etapa.');
    return errores;
  }
  const codigosEtapa = new Set();
  etapas.forEach((etapa, indiceEtapa) => {
    const ruta = `etapas.${indiceEtapa}`;
    const etiqueta = `Etapa ${indiceEtapa + 1}${etapa?.nombre?.trim() ? ` «${etapa.nombre.trim()}»` : ''}`;
    if (!validarTexto(etapa?.codigo, 1, 40) || !CODIGO.test(etapa.codigo)) {
      agregarError(errores, `${ruta}.codigo`, `${etiqueta}: el código generado no es válido.`);
    }
    const codigoNormalizado = String(etapa?.codigo ?? '').toUpperCase();
    if (codigosEtapa.has(codigoNormalizado)) agregarError(errores, `${ruta}.codigo`, `${etiqueta}: el código está repetido.`);
    codigosEtapa.add(codigoNormalizado);
    if (!validarTexto(etapa?.nombre, 1, 220)) agregarError(errores, `${ruta}.nombre`, `${etiqueta}: indique un nombre de hasta 220 caracteres.`);
    if (!ALCANCES_VALIDOS.has(etapa?.alcance)) agregarError(errores, `${ruta}.alcance`, `${etiqueta}: seleccione si se evalúa por trabajo o por estudiante.`);
    if (!Array.isArray(etapa?.categorias) || etapa.categorias.length === 0) {
      agregarError(errores, `${ruta}.categorias`, `${etiqueta}: agregue al menos una categoría.`);
      return;
    }

    const codigosCategoria = new Set();
    etapa.categorias.forEach((categoria, indiceCategoria) => {
      const rutaCategoria = `${ruta}.categorias.${indiceCategoria}`;
      const etiquetaCategoria = `${etiqueta}, categoría ${indiceCategoria + 1}`;
      if (!validarTexto(categoria?.codigo, 1, 10) || !CODIGO.test(categoria.codigo)) {
        agregarError(errores, `${rutaCategoria}.codigo`, `${etiquetaCategoria}: el código generado no es válido.`);
      }
      const codigoNormalizado = String(categoria?.codigo ?? '').toUpperCase();
      if (codigosCategoria.has(codigoNormalizado)) agregarError(errores, `${rutaCategoria}.codigo`, `${etiquetaCategoria}: el código está repetido.`);
      codigosCategoria.add(codigoNormalizado);
      if (!validarTexto(categoria?.nombre, 1, 240)) agregarError(errores, `${rutaCategoria}.nombre`, `${etiquetaCategoria}: indique un nombre de hasta 240 caracteres.`);
      if (!Array.isArray(categoria?.indicadores) || categoria.indicadores.length === 0) {
        agregarError(errores, `${rutaCategoria}.indicadores`, `${etiquetaCategoria}: agregue al menos un indicador.`);
        return;
      }

      categoria.indicadores.forEach((indicador, indiceIndicador) => {
        const rutaIndicador = `${rutaCategoria}.indicadores.${indiceIndicador}`;
        const etiquetaIndicador = `${etiquetaCategoria}, indicador ${indiceIndicador + 1}`;
        if (!validarTexto(indicador?.label, 1, 40) || !CODIGO.test(indicador.label)) {
          agregarError(errores, `${rutaIndicador}.label`, `${etiquetaIndicador}: el código generado no es válido.`);
        }
        if (!validarTexto(indicador?.descripcion, 1, Number.MAX_SAFE_INTEGER)) {
          agregarError(errores, `${rutaIndicador}.descripcion`, `${etiquetaIndicador}: describa el criterio de evaluación.`);
        }
        const ponderacion = centesimasPonderacion(indicador?.calificacionMaxima);
        if (ponderacion === null || ponderacion <= 0n) {
          agregarError(errores, `${rutaIndicador}.calificacionMaxima`, `${etiquetaIndicador}: indique una ponderación positiva con hasta dos decimales.`);
        }
      });
    });

    const valorTexto = String(etapa?.valor ?? '').trim();
    if (valorTexto && (valorDeclaradoEtapa(etapa) === null || valorDeclaradoEtapa(etapa) > MAXIMO_CENTESIMAS_ETAPA)) {
      agregarError(errores, `${ruta}.valor`, `${etiqueta}: indique cuánto vale la parte (más de 0 y hasta 100.00, con dos decimales como máximo).`);
    }
    const modo = formulario?.esquema?.modo ?? ESQUEMA_CALIFICACION.SUMA;
    const porcentaje = centesimasPonderacion(String(etapa?.porcentaje ?? '').trim());
    if (modo === ESQUEMA_CALIFICACION.PORCENTAJES && (porcentaje === null || porcentaje <= 0n || porcentaje > 10000n)) {
      agregarError(errores, `${ruta}.porcentaje`, `${etiqueta}: indique su peso en la nota final (más de 0 y hasta 100 %).`);
    }

    const resumen = resumenPonderacionEtapa(etapa);
    if (resumen.estado !== 'completa') {
      agregarError(errores, `${ruta}.total`, `${etiqueta}: ${resumen.mensaje}`);
    }
  });

  // El esquema completo: las partes suman la escala final («sumar puntos») o los pesos suman 100 % («porcentajes»).
  const esquema = resumenEsquemaRubrica(formulario);
  if (esquema.estado === 'faltante' || esquema.estado === 'excedida') agregarError(errores, 'esquema', esquema.mensaje);
  return errores;
}
