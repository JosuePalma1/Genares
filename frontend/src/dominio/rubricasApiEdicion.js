const DECIMAL_CANONICO = /^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/;

function centesimas(valor) {
  if (typeof valor !== 'string' || !DECIMAL_CANONICO.test(valor)) {
    throw new TypeError('Cada máximo debe ser un decimal válido con hasta dos cifras decimales.');
  }
  const [entero, fraccion = ''] = valor.split('.');
  return Number(entero) * 100 + Number(fraccion.padEnd(2, '0'));
}

function decimalDesdeCentesimas(total) {
  if (!Number.isSafeInteger(total) || total < 0 || total > 99999) {
    throw new TypeError('La suma de máximos excede el formato decimal admitido.');
  }
  return `${Math.floor(total / 100)}.${String(total % 100).padStart(2, '0')}`;
}

export function sumarMaximosRubrica(decimales) {
  return decimalDesdeCentesimas(decimales.reduce((total, valor) => total + centesimas(valor), 0));
}

/** Prepara la jerarquía completa sin convertir ni redondear los importes editados. */
export function prepararVersionApiParaGuardar(version, etapas, categorias) {
  const categoriasPreparadas = categorias.map((categoria) => {
    const maximoDecimal = sumarMaximosRubrica(categoria.indicadores.map((indicador) => indicador.maximoDecimal));
    return { ...categoria, maximoDecimal };
  });
  const etapasPreparadas = etapas.map((etapa) => {
    const maximoDecimal = sumarMaximosRubrica(
      categoriasPreparadas.filter((categoria) => categoria.etapa === (etapa.id ?? etapa.claveLocal)).map((categoria) => categoria.maximoDecimal),
    );
    return { ...etapa, maximoDecimal };
  });
  return { ...version, etapas: etapasPreparadas, categorias: categoriasPreparadas };
}

export function mensajeErrorEscrituraRubrica(error) {
  if (error?.status === 400) return error.message || 'Los datos no son válidos. Revise los campos e intente guardar.';
  if (error?.status === 401) return 'La sesión no tiene una identidad validada para guardar.';
  if (error?.status === 403) return 'Su perfil no tiene permiso para editar este borrador.';
  if (error?.status === 404) return 'La rúbrica o versión ya no existe. Recargue el catálogo para comprobarlo.';
  if (error?.status === 409) return 'El borrador cambió o dejó de ser editable. Recargue la versión antes de continuar.';
  if (error?.status >= 500) return 'No fue posible guardar el borrador. Sus cambios siguen disponibles en el editor.';
  if (error?.name === 'ErrorConexionApi') return 'No fue posible guardar la rúbrica. Sus cambios siguen disponibles en el editor.';
  return error?.message || 'No fue posible guardar el borrador. Sus cambios locales siguen disponibles.';
}
