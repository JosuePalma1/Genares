import { getJsonApi, postJsonApi } from './clienteHttp';

export async function obtenerEvaluacionesMerDev(asignacionId, { signal } = {}) {
  const respuesta = await getJsonApi(`/evaluaciones/mer/${encodeURIComponent(asignacionId)}`, { signal });
  if (!respuesta || !Array.isArray(respuesta.etapas) || !Array.isArray(respuesta.evaluadores)
    || !Array.isArray(respuesta.estudiantes) || !Array.isArray(respuesta.evaluaciones)) {
    throw new Error('El expediente de rúbrica no tiene la estructura esperada.');
  }
  return respuesta;
}

export async function guardarBorradorOralMerDev(asignacionId, cuerpo, tipo = 'ORAL') {
  return postJsonApi(`/evaluaciones/mer/${encodeURIComponent(asignacionId)}/borrador-${tipo === 'ORAL' ? 'oral' : 'escrito'}`, cuerpo);
}

export function cerrarEvaluacionOralMerDev(asignacionId, cuerpo, tipo = 'ORAL') {
  return postJsonApi(`/evaluaciones/mer/${encodeURIComponent(asignacionId)}/cierre-${tipo === 'ORAL' ? 'oral' : 'escrito'}`, cuerpo);
}

export function construirPuntajesOrales(indicadores, notas) {
  return indicadores.map((indicador) => {
    const dato = notas[indicador.id] ?? { score: '', observation: '' };
    const score = String(dato.score ?? '').trim();
    return {
      idIndicador: indicador.id,
      score: score === '' ? null : Number(score),
      observation: String(dato.observation ?? '').trim(),
    };
  });
}

export function validarPuntajesOrales(indicadores, puntajes) {
  if (!indicadores.length) throw new Error('No se encontraron indicadores para esta etapa.');
  for (let i = 0; i < indicadores.length; i += 1) {
    const max = Number(indicadores[i].calificacionMaxima);
    const puntaje = puntajes[i]?.score;
    if (!Number.isFinite(max) || max < 0 || (puntaje !== null &&
      (typeof puntaje !== 'number' || !Number.isFinite(puntaje) || puntaje < 0 || puntaje > max))) {
      throw new Error(`Revisa el indicador ${i + 1}: su puntaje debe estar entre 0 y ${max}.`);
    }
  }
}
