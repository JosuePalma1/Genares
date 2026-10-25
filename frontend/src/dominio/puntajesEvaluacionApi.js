const DECIMAL_DOS_DECIMALES = /^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/;

export function decimalEvaluacionACentavos(valor) {
  if (typeof valor !== 'string' || !DECIMAL_DOS_DECIMALES.test(valor)) return null;
  const [entero, fraccion = ''] = valor.split('.');
  return BigInt(entero) * 100n + BigInt(fraccion.padEnd(2, '0') || '0');
}

export function validarFormularioPuntajes({ indicadores, puntajesGuardados = [], valores = {} }) {
  const guardados = new Map(puntajesGuardados.map((puntaje) => [puntaje.idIndicador, puntaje.puntaje]));
  const errores = {};
  const puntajes = [];
  const faltantes = [];
  let completos = indicadores.length > 0;
  let tieneValor = false;
  let tieneCambios = false;

  for (const indicador of indicadores) {
    const valor = valores[indicador.id] ?? '';
    const anterior = guardados.get(indicador.id);
    if (valor === '') {
      completos = false;
      faltantes.push(indicador.id);
      if (anterior !== undefined) {
        tieneCambios = true;
        errores[indicador.id] = 'No se puede borrar un puntaje ya guardado. Ingrese un valor para conservarlo.';
      }
      continue;
    }

    tieneValor = true;
    const centavos = decimalEvaluacionACentavos(valor);
    if (centavos === null) {
      completos = false;
      errores[indicador.id] = 'Use un decimal no negativo con hasta dos cifras decimales.';
      if (anterior === undefined || valor !== anterior) tieneCambios = true;
      continue;
    }
    const maximo = decimalEvaluacionACentavos(indicador.calificacionMaxima);
    if (maximo === null) {
      completos = false;
      errores[indicador.id] = 'El máximo recibido para este indicador no es válido.';
      continue;
    }
    if (centavos > maximo) {
      completos = false;
      errores[indicador.id] = `No puede superar ${indicador.calificacionMaxima}.`;
      if (anterior === undefined || valor !== anterior) tieneCambios = true;
      continue;
    }

    puntajes.push({ idIndicador: indicador.id, puntaje: valor });
    if (anterior === undefined || decimalEvaluacionACentavos(anterior) !== centavos) tieneCambios = true;
  }

  return {
    errores,
    puntajes,
    faltantes,
    completos: completos && Object.keys(errores).length === 0,
    tieneValor,
    tieneCambios,
    puedeGuardar: tieneValor && tieneCambios && Object.keys(errores).length === 0,
  };
}
