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
    { claveLocal: claveLocalRubrica(), codigo: 'ETAPA_1', nombre: 'Escrita', alcance: 'TRABAJO_COMPARTIDO', categorias: [] },
    { claveLocal: claveLocalRubrica(), codigo: 'ETAPA_2', nombre: 'Oral', alcance: 'ESTUDIANTE_INDIVIDUAL', categorias: [] },
  ];
}

export function nuevaEtapaRubrica(etapas) {
  return {
    claveLocal: claveLocalRubrica(),
    codigo: codigoDisponible('ETAPA_', etapas.map((etapa) => etapa.codigo)),
    nombre: 'Nueva etapa',
    alcance: '',
    categorias: [],
  };
}

export function nuevaCategoriaRubrica(etapa) {
  return {
    claveLocal: claveLocalRubrica(),
    codigo: codigoDisponible('C', etapa.categorias.map((categoria) => categoria.codigo), 10),
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
  return etapas.map((etapa) => etapa.claveLocal === claveEtapa
    ? { ...etapa, categorias: [...etapa.categorias, nuevaCategoriaRubrica(etapa)] }
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
    return { total, estado: 'incompleta', mensaje: 'Agregue indicadores con ponderaciones válidas.' };
  }
  if (total < 1000n) {
    return { total, estado: 'faltante', mensaje: `Faltan ${formatearCentesimas(1000n - total)} puntos.` };
  }
  if (total > 1000n) {
    return { total, estado: 'excedida', mensaje: `Excede ${formatearCentesimas(total - 1000n)} puntos.` };
  }
  return { total, estado: 'completa', mensaje: 'Completo.' };
}

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

    const resumen = resumenPonderacionEtapa(etapa);
    if (resumen.estado !== 'completa') {
      agregarError(errores, `${ruta}.total`, `${etiqueta}: debe sumar exactamente 10.00 puntos. ${resumen.mensaje}`);
    }
  });
  return errores;
}
