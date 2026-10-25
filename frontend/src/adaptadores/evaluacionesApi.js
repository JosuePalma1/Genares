import { ErrorRespuestaApi } from '../servicios/clienteHttp';
import { esUuidPostgres } from './uuidPostgres';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ESTADOS_CONSOLIDACION = new Set([
  'SIN_EVALUACIONES',
  'EN_PROGRESO',
  'EVALUACIONES_CERRADAS_INCOMPLETAS',
  'RESULTADO_COMPLETO',
  'LEGACY_NO_CONSOLIDADA',
]);
const ESTADOS_EVALUACION = new Set(['BORRADOR', 'CERRADA']);
const ESTADOS_ETAPA = new Set(['SIN_EVALUACIONES', 'EN_PROGRESO', 'CERRADA_INCOMPLETA', 'COMPLETA']);
const ALCANCES = new Set(['TRABAJO_COMPARTIDO', 'ESTUDIANTE_INDIVIDUAL']);

export function esUuidV4(valor) {
  return typeof valor === 'string' && UUID_V4.test(valor);
}

// PostgreSQL valida la forma UUID, no el n\u00famero de versi\u00f3n ni la variante RFC.
export { esUuidPostgres };

export function adaptarListaTrabajosEvaluacionApi(respuesta) {
  exigir(objeto(respuesta) && Array.isArray(respuesta.elementos));
  exigir(respuesta.elementos.every((trabajo) => objeto(trabajo)
    && esUuidPostgres(trabajo.id)
    && typeof trabajo.codigo === 'string' && typeof trabajo.titulo === 'string'
    && typeof trabajo.carrera === 'string' && typeof trabajo.periodo === 'string'
    && typeof trabajo.modalidad === 'string'
    && Array.isArray(trabajo.estudiantes)
    && trabajo.estudiantes.every((estudiante) => objeto(estudiante) && esUuidPostgres(estudiante.id)
      && typeof estudiante.nombres === 'string' && typeof estudiante.apellidos === 'string')
    && Array.isArray(trabajo.miembrosTribunal)
    && trabajo.miembrosTribunal.every((miembro) => objeto(miembro)
      && esUuidPostgres(miembro.idMiembroTribunal) && Number.isInteger(miembro.posicion)
      && typeof miembro.nombres === 'string' && typeof miembro.apellidos === 'string')));
  return respuesta.elementos;
}

function objeto(valor) {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}

function esDecimal(valor) {
  return typeof valor === 'string' && /^(?:0|[1-9]\d{0,2})(?:\.\d+)?$/.test(valor);
}

function exigir(condicion) {
  if (!condicion) throw new ErrorRespuestaApi();
}

function validarPuntaje(puntaje) {
  exigir(objeto(puntaje)
    && esUuidPostgres(puntaje.idIndicador)
    && typeof puntaje.label === 'string'
    && esDecimal(puntaje.puntaje)
    && esDecimal(puntaje.calificacionMaxima)
    && (puntaje.observacion === null || typeof puntaje.observacion === 'string'));
}

export function adaptarEvaluacionApi(evaluacion) {
  exigir(objeto(evaluacion)
    && esUuidPostgres(evaluacion.id)
    && esUuidPostgres(evaluacion.idTrabajo)
    && esUuidPostgres(evaluacion.idVersionRubrica)
    && (evaluacion.idEtapaRubrica === null || esUuidPostgres(evaluacion.idEtapaRubrica))
    && (evaluacion.idEstudiante === null || esUuidPostgres(evaluacion.idEstudiante))
    && ESTADOS_EVALUACION.has(evaluacion.estado)
    && esDecimal(evaluacion.calificacionTotal)
    && esDecimal(evaluacion.calificacionMaxima)
    && typeof evaluacion.alcance === 'string'
    && ALCANCES.has(evaluacion.alcance)
    && objeto(evaluacion.etapaRubrica)
    && (evaluacion.idEtapaRubrica === null
      ? evaluacion.etapaRubrica.id === null
      : evaluacion.etapaRubrica.id === evaluacion.idEtapaRubrica)
    && objeto(evaluacion.instantaneaRubrica)
    && (evaluacion.idEtapaRubrica === null
      ? (evaluacion.instantaneaRubrica.rubricVersionId === undefined
        || evaluacion.instantaneaRubrica.rubricVersionId === evaluacion.idVersionRubrica)
      : evaluacion.instantaneaRubrica.rubricVersionId === evaluacion.idVersionRubrica)
    && (evaluacion.idEtapaRubrica === null || typeof evaluacion.instantaneaRubrica.version === 'string')
    && (evaluacion.idEtapaRubrica === null
      ? (evaluacion.instantaneaRubrica.stages === undefined || Array.isArray(evaluacion.instantaneaRubrica.stages))
        && (evaluacion.instantaneaRubrica.categories === undefined || Array.isArray(evaluacion.instantaneaRubrica.categories))
      : Array.isArray(evaluacion.instantaneaRubrica.stages) && evaluacion.instantaneaRubrica.stages.length > 0
        && Array.isArray(evaluacion.instantaneaRubrica.categories) && evaluacion.instantaneaRubrica.categories.length > 0)
    && (evaluacion.instantaneaRubrica.stages ?? []).every((etapa) => objeto(etapa) && esUuidPostgres(etapa.id) && ALCANCES.has(etapa.scope))
    && (evaluacion.instantaneaRubrica.categories ?? []).every((categoria) => (
      objeto(categoria) && esUuidPostgres(categoria.id) && esUuidPostgres(categoria.stageId)
      && typeof categoria.nombre === 'string' && esDecimal(categoria.calificacionMaxima)
      && Array.isArray(categoria.indicators)
      && categoria.indicators.every((indicador) => (
        objeto(indicador) && esUuidPostgres(indicador.id)
        && typeof indicador.label === 'string' && esDecimal(indicador.calificacionMaxima)
      ))
    ))
    && Array.isArray(evaluacion.puntajes)
    && Array.isArray(evaluacion.estudiantesTraspasados)
    && evaluacion.estudiantesTraspasados.every((traspaso) => objeto(traspaso) && esUuidPostgres(traspaso.idEstudiante)));
  if (evaluacion.idEtapaRubrica !== null) {
    const etapa = evaluacion.instantaneaRubrica.stages.find(({ id }) => id === evaluacion.idEtapaRubrica);
    exigir(etapa && etapa.scope === evaluacion.alcance);
    const etapasIds = new Set(evaluacion.instantaneaRubrica.stages.map(({ id }) => id.toLowerCase()));
    exigir(evaluacion.instantaneaRubrica.categories.every(({ stageId }) => etapasIds.has(stageId.toLowerCase())));
    const indicadores = new Map(evaluacion.instantaneaRubrica.categories.flatMap(({ indicators }) => (
      indicators.map((indicador) => [indicador.id.toLowerCase(), indicador])
    )));
    exigir(evaluacion.puntajes.every((puntaje) => {
      const indicador = indicadores.get(puntaje.idIndicador.toLowerCase());
      return indicador && indicador.label === puntaje.label
        && indicador.calificacionMaxima === puntaje.calificacionMaxima;
    }));
  } else if (Array.isArray(evaluacion.instantaneaRubrica.categories)) {
    const etapasIds = new Set((evaluacion.instantaneaRubrica.stages ?? []).map(({ id }) => id.toLowerCase()));
    exigir(evaluacion.instantaneaRubrica.categories.every(({ stageId }) => etapasIds.has(stageId.toLowerCase())));
  }
  exigir(evaluacion.puntajes.every((puntaje) => {
    try { validarPuntaje(puntaje); return true; } catch { return false; }
  }));
  return evaluacion;
}

export function adaptarContextoEvaluadorApi(contexto) {
  exigir(objeto(contexto)
    && esUuidPostgres(contexto.idMiembroTribunal)
    && Number.isInteger(contexto.posicion)
    && contexto.posicion > 0
    && typeof contexto.puedeCalificar === 'boolean'
    && Array.isArray(contexto.miembrosTribunal)
    && contexto.miembrosTribunal.length > 0
    && contexto.miembrosTribunal.every((miembro) => objeto(miembro)
      && esUuidPostgres(miembro.idMiembroTribunal)
      && Number.isInteger(miembro.posicion) && miembro.posicion > 0
      && typeof miembro.nombres === 'string' && typeof miembro.apellidos === 'string')
    && contexto.miembrosTribunal.some(({ idMiembroTribunal }) => idMiembroTribunal === contexto.idMiembroTribunal));
  return contexto;
}

function validarRacional(valor) {
  exigir(objeto(valor)
    && typeof valor.numerador === 'string' && /^\d+$/.test(valor.numerador)
    && typeof valor.denominador === 'string' && /^[1-9]\d*$/.test(valor.denominador)
    && valor.unidad === 'PUNTOS');
}

function adaptarEtapaConsolidada(etapa) {
  exigir(objeto(etapa)
    && esUuidPostgres(etapa.id)
    && Number.isInteger(etapa.orden)
    && typeof etapa.nombre === 'string'
    && ALCANCES.has(etapa.alcance)
    && typeof etapa.calificacionMaxima === 'string'
    && ESTADOS_ETAPA.has(etapa.estado)
    && Array.isArray(etapa.evaluaciones)
    && Array.isArray(etapa.evaluadoresPendientes)
    && (etapa.promedioEtapa === null || objeto(etapa.promedioEtapa)));
  if (etapa.promedioEtapa !== null) {
    validarRacional(etapa.promedioEtapa.exacto);
    exigir(esDecimal(etapa.promedioEtapa.presentado));
  }
  exigir((etapa.estado === 'COMPLETA') === (etapa.promedioEtapa !== null));
  exigir(etapa.estado === 'COMPLETA' ? etapa.evaluadoresPendientes.length === 0 : true);
  exigir(etapa.evaluadoresPendientes.every((pendiente) => objeto(pendiente)
    && esUuidPostgres(pendiente.idMiembroTribunal)
    && Number.isInteger(pendiente.posicion) && pendiente.posicion > 0
    && ['SIN_EVALUACION', 'EVALUACION_NO_CERRADA'].includes(pendiente.causa)));
  for (const evaluacion of etapa.evaluaciones) {
    exigir(objeto(evaluacion)
      && esUuidPostgres(evaluacion.id)
      && esUuidPostgres(evaluacion.idMiembroTribunal)
      && ESTADOS_EVALUACION.has(evaluacion.estado)
      && (evaluacion.idEstudiante === null || esUuidPostgres(evaluacion.idEstudiante))
      && (evaluacion.calificacionOriginal === null || esDecimal(evaluacion.calificacionOriginal))
      && (evaluacion.calificacionUtilizada === null || esDecimal(evaluacion.calificacionUtilizada))
      && (evaluacion.estado === 'CERRADA' || evaluacion.calificacionUtilizada === null)
      && (evaluacion.traspaso === null || (objeto(evaluacion.traspaso) && esUuidPostgres(evaluacion.traspaso.id))));
  }
  return etapa;
}

function adaptarConsolidacionEstudiante(consolidacion) {
  exigir(objeto(consolidacion)
    && objeto(consolidacion.estudiante)
    && esUuidPostgres(consolidacion.estudiante.id)
    && objeto(consolidacion.trabajo)
    && esUuidPostgres(consolidacion.trabajo.id)
    && esUuidPostgres(consolidacion.trabajoId)
    && objeto(consolidacion.versionRubrica)
    && esUuidPostgres(consolidacion.versionRubrica.id)
    && ESTADOS_CONSOLIDACION.has(consolidacion.estado)
    && Array.isArray(consolidacion.etapas));
  exigir(consolidacion.etapas.every((etapa) => {
    try { adaptarEtapaConsolidada(etapa); return true; } catch { return false; }
  }));
  exigir(new Set(consolidacion.etapas.map(({ id }) => id.toLowerCase())).size === consolidacion.etapas.length);
  if (consolidacion.resultadoFinal === null) {
    exigir(consolidacion.estado !== 'RESULTADO_COMPLETO');
    exigir(consolidacion.etapas.every((etapa) => etapa.estado !== 'COMPLETA'));
  } else {
    exigir(consolidacion.estado === 'RESULTADO_COMPLETO'
      && consolidacion.etapas.length > 0
      && consolidacion.etapas.every((etapa) => etapa.estado === 'COMPLETA' && etapa.promedioEtapa !== null)
      && esDecimal(consolidacion.resultadoFinal.calificacion)
      && consolidacion.resultadoFinal.calificacionMaxima === '10.00'
      && consolidacion.resultadoFinal.redondeo === 'HALF_UP_A_DOS_DECIMALES');
    validarRacional(consolidacion.resultadoFinal.exacto);
  }
  return consolidacion;
}

export function adaptarConsolidacionTrabajoApi(respuesta) {
  exigir(objeto(respuesta)
    && respuesta.tipo === 'CONSOLIDACION_INDIVIDUAL_DINAMICA'
    && esUuidPostgres(respuesta.trabajoId)
    && objeto(respuesta.trabajo)
    && respuesta.trabajo.id === respuesta.trabajoId
    && Array.isArray(respuesta.estudiantes));
  respuesta.estudiantes.forEach(adaptarConsolidacionEstudiante);
  return respuesta;
}
