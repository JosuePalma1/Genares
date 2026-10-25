import { ESTADO_EVALUACION } from '../datos/datosPrototipo';
import { limitarCalificacion } from './flujoTrabajo';

const clonarRegistro = (registro = {}) => ({
  calificaciones: { ...(registro.calificaciones ?? {}) },
  observaciones: { ...(registro.observaciones ?? {}) },
  tieneCambios: false,
  mostrarErrores: false,
});

export function crearFormulariosOrales(estudiantes, evaluacion) {
  return estudiantes.reduce((formularios, estudiante) => ({
    ...formularios,
    [estudiante.id]: clonarRegistro(evaluacion?.oralPorEstudiante?.[estudiante.id]),
  }), {});
}

export function actualizarCalificacionOral(formularios, evaluacion, idEstudiante, idIndicador, valor, maximo) {
  if (evaluacion?.oralPorEstudiante?.[idEstudiante]?.estado === ESTADO_EVALUACION.CERRADA) return formularios;
  const formulario = formularios[idEstudiante] ?? clonarRegistro();
  return {
    ...formularios,
    [idEstudiante]: {
      ...formulario,
      calificaciones: {
        ...formulario.calificaciones,
        [idIndicador]: limitarCalificacion(valor, maximo),
      },
      tieneCambios: true,
    },
  };
}

export function actualizarObservacionOral(formularios, evaluacion, idEstudiante, idIndicador, valor) {
  if (evaluacion?.oralPorEstudiante?.[idEstudiante]?.estado === ESTADO_EVALUACION.CERRADA) return formularios;
  const formulario = formularios[idEstudiante] ?? clonarRegistro();
  return {
    ...formularios,
    [idEstudiante]: {
      ...formulario,
      observaciones: { ...formulario.observaciones, [idIndicador]: valor },
      tieneCambios: true,
    },
  };
}

export function marcarErroresFormularioOral(formularios, idEstudiante) {
  return {
    ...formularios,
    [idEstudiante]: { ...formularios[idEstudiante], mostrarErrores: true },
  };
}

export function marcarFormulariosOralesGuardados(formularios, idsEstudiantes) {
  return idsEstudiantes.reduce((resultado, idEstudiante) => ({
    ...resultado,
    [idEstudiante]: {
      ...resultado[idEstudiante],
      tieneCambios: false,
      mostrarErrores: false,
    },
  }), { ...formularios });
}

export function crearAccionesGuardadoOral(idEvaluacion, formularios, evaluacion, idsEstudiantes) {
  return idsEstudiantes
    .filter((idEstudiante) => evaluacion?.oralPorEstudiante?.[idEstudiante]?.estado !== ESTADO_EVALUACION.CERRADA)
    .filter((idEstudiante) => formularios[idEstudiante]?.tieneCambios)
    .map((idEstudiante) => ({
      tipo: 'GUARDAR_ORAL',
      idEvaluacion,
      idEstudiante,
      calificaciones: formularios[idEstudiante]?.calificaciones ?? {},
      observaciones: formularios[idEstudiante]?.observaciones ?? {},
    }));
}

export function crearAccionFinalizacionOral(idEvaluacion, formularios, evaluacion, idEstudiante) {
  if (evaluacion?.oralPorEstudiante?.[idEstudiante]?.estado === ESTADO_EVALUACION.CERRADA) return null;
  const formulario = formularios[idEstudiante];
  if (!formulario) return null;
  return {
    tipo: 'FINALIZAR_ORAL',
    idEvaluacion,
    idEstudiante,
    calificaciones: formulario.calificaciones ?? {},
    observaciones: formulario.observaciones ?? {},
  };
}

export function hayCambiosFormulariosOrales(formularios) {
  return Object.values(formularios).some((formulario) => formulario?.tieneCambios);
}
