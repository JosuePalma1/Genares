import {
  promedioRacional, racional, racionalDesdeDecimal, redondearRacionalHalfUp, serializarRacional, sumarRacionales,
} from '../reglas-consolidacion';

/** Reglas del formulario local; el máximo lo establece la rúbrica de PostgreSQL. */
export interface IndicadorBorrador {
  id: string;
  calificacionMaxima: number | string | null;
}

export interface PuntajeBorrador {
  idIndicador: string;
  score?: number | null;
  observation?: string;
}

export function validarPuntajesBorrador(indicadores: IndicadorBorrador[], puntajes: PuntajeBorrador[]): void {
  const permitidos = new Map(indicadores.map((item) => [item.id, Number(item.calificacionMaxima)]));
  if (!permitidos.size || puntajes.length !== permitidos.size) {
    throw new Error('Se deben incluir todos los indicadores de esta etapa, aunque estén pendientes.');
  }
  const vistos = new Set<string>();
  for (const item of puntajes) {
    if (vistos.has(item.idIndicador) || !permitidos.has(item.idIndicador)) {
      throw new Error('Hay indicadores duplicados o ajenos a la rúbrica asignada.');
    }
    vistos.add(item.idIndicador);
    const maximo = permitidos.get(item.idIndicador)!;
    if (!Number.isFinite(maximo) || maximo < 0) {
      throw new Error('La puntuación máxima de la rúbrica no es válida.');
    }
    if (item.score !== null && item.score !== undefined &&
      (typeof item.score !== 'number' || !Number.isFinite(item.score) || item.score < 0 || item.score > maximo)) {
      throw new Error(`El puntaje debe estar entre 0 y ${maximo}.`);
    }
    if (item.observation !== undefined && (typeof item.observation !== 'string' || item.observation.length > 2000)) {
      throw new Error('La observación supera el límite permitido.');
    }
  }
}

export function validarPuntajesCierre(indicadores: IndicadorBorrador[], puntajes: PuntajeBorrador[]): void {
  validarPuntajesBorrador(indicadores, puntajes);
  if (puntajes.some(({ score }) => score == null)) {
    throw new Error('Completa todos los indicadores antes de cerrar la evaluación.');
  }
}

export interface EtapaConsolidada {
  id: string;
  scope: string;
  porcentaje: string | null;
  calificacionMaxima: string | null;
}

export interface NotaConsolidada {
  id?: string;
  idEtapaRubrica: string;
  idAsignacionTribunal: string;
  idEstudiante: string | null;
  estado: string;
  total: string | null;
}

export function detallarConsolidacionMer<T extends EtapaConsolidada>(
  etapas: T[], evaluadores: string[], notas: NotaConsolidada[], estudiante: string,
) {
  let resultado = racional(0n);
  let ponderacion = racional(0n);
  const ponderacionUniforme = etapas.length > 0 && etapas.every((etapa) => etapa.porcentaje == null)
    ? racional(100n, BigInt(etapas.length)) : null;
  const detalle = etapas.map((etapa) => {
    const titular = etapa.scope === 'TRABAJO_COMPARTIDO' ? null : estudiante;
    const deEtapa = notas.filter((nota) => nota.idEtapaRubrica === etapa.id && nota.idEstudiante === titular);
    const maximo = etapa.calificacionMaxima ? racionalDesdeDecimal(etapa.calificacionMaxima) : null;
    const peso = etapa.porcentaje ? racionalDesdeDecimal(etapa.porcentaje) : ponderacionUniforme;
    const puntos: ReturnType<typeof racional>[] = [];
    const pendientes = evaluadores.flatMap((id, i) => {
      const nota = deEtapa.find((item) => item.idAsignacionTribunal === id);
      const valor = nota?.estado === 'CERRADA' && nota.total != null ? racionalDesdeDecimal(nota.total) : null;
      if (!maximo || !valor || valor.numerador * maximo.denominador > maximo.numerador * valor.denominador) {
        return [{ idMiembroTribunal: id, posicion: i + 1, causa: nota ? 'EVALUACION_NO_CERRADA' : 'SIN_EVALUACION' }];
      }
      puntos.push(valor);
      return [];
    });
    const promedio = pendientes.length ? null : promedioRacional(puntos);
    if (peso) ponderacion = sumarRacionales(ponderacion, peso);
    if (promedio && maximo?.numerador && peso) {
      resultado = sumarRacionales(resultado, racional(
        promedio.numerador * maximo.denominador * peso.numerador,
        promedio.denominador * maximo.numerador * peso.denominador * 10n,
      ));
    }
    return {
      ...etapa,
      estado: promedio ? 'COMPLETA' : deEtapa.some((nota) => nota.estado === 'BORRADOR')
        ? 'EN_PROGRESO' : deEtapa.length ? 'CERRADA_INCOMPLETA' : 'SIN_EVALUACIONES',
      evaluadoresPendientes: pendientes,
      promedioEtapa: promedio ? { exacto: serializarRacional(promedio), presentado: redondearRacionalHalfUp(promedio) } : null,
      evaluaciones: deEtapa.filter((nota) => evaluadores.includes(nota.idAsignacionTribunal)).map((nota) => ({
        id: nota.id, idMiembroTribunal: nota.idAsignacionTribunal, idEstudiante: nota.idEstudiante,
        estado: nota.estado, calificacionOriginal: nota.total,
        calificacionUtilizada: nota.estado === 'CERRADA' ? nota.total : null, traspaso: null,
      })),
    };
  });
  const completo = detalle.length > 0 && detalle.every((etapa) => etapa.estado === 'COMPLETA'
    && Number(etapa.calificacionMaxima) > 0 && (etapa.porcentaje != null || ponderacionUniforme)
    && ['TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL'].includes(etapa.scope))
    && ponderacion.numerador === 100n * ponderacion.denominador;
  return {
    etapas: detalle,
    estado: completo ? 'RESULTADO_COMPLETO' : detalle.some((e) => e.estado === 'EN_PROGRESO')
      ? 'EN_PROGRESO' : detalle.some((e) => e.evaluaciones.length)
        ? 'EVALUACIONES_CERRADAS_INCOMPLETAS' : 'SIN_EVALUACIONES',
    resultadoFinal: completo ? {
      exacto: serializarRacional(resultado), calificacion: redondearRacionalHalfUp(resultado),
      calificacionMaxima: '10.00', redondeo: 'HALF_UP_A_DOS_DECIMALES',
    } : null,
  };
}

export function calcularConsolidadoMer(
  etapas: EtapaConsolidada[], evaluadores: string[], notas: NotaConsolidada[], estudiante: string,
): string | null {
  return detallarConsolidacionMer(etapas, evaluadores, notas, estudiante).resultadoFinal?.calificacion ?? null;
}
