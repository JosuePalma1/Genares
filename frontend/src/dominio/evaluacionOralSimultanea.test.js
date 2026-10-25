import { describe, expect, it } from 'vitest';
import {
  actualizarCalificacionOral,
  actualizarObservacionOral,
  crearAccionFinalizacionOral,
  crearAccionesGuardadoOral,
  crearFormulariosOrales,
  hayCambiosFormulariosOrales,
  marcarFormulariosOralesGuardados,
} from './evaluacionOralSimultanea';

const estudiantes = [{ id: 'estudiante-a' }, { id: 'estudiante-b' }];
const evaluacion = {
  id: 'evaluacion-1',
  oralPorEstudiante: {
    'estudiante-a': { estado: 'BORRADOR', calificaciones: { D1: 0.5 }, observaciones: { D1: 'A' } },
    'estudiante-b': { estado: 'PENDIENTE', calificaciones: { D1: 0.25 }, observaciones: { D1: 'B' } },
  },
};

describe('formularios orales simultáneos', () => {
  it('mantiene un formulario individual sin introducir datos adicionales', () => {
    const formularios = crearFormulariosOrales([estudiantes[0]], evaluacion);
    expect(Object.keys(formularios)).toEqual(['estudiante-a']);
    expect(formularios['estudiante-a'].calificaciones.D1).toBe(0.5);
  });

  it('mantiene puntuaciones y observaciones independientes por estudiante', () => {
    let formularios = crearFormulariosOrales(estudiantes, evaluacion);
    formularios = actualizarCalificacionOral(formularios, evaluacion, 'estudiante-a', 'D1', 0.8, 0.83);
    formularios = actualizarCalificacionOral(formularios, evaluacion, 'estudiante-b', 'D1', 0.65, 0.83);
    formularios = actualizarObservacionOral(formularios, evaluacion, 'estudiante-a', 'D1', 'Observación A');

    expect(formularios['estudiante-a'].calificaciones.D1).toBe(0.8);
    expect(formularios['estudiante-b'].calificaciones.D1).toBe(0.65);
    expect(formularios['estudiante-a'].observaciones.D1).toBe('Observación A');
    expect(formularios['estudiante-b'].observaciones.D1).toBe('B');
  });

  it('genera guardados separados y permite guardar solo el formulario modificado', () => {
    let formularios = crearFormulariosOrales(estudiantes, evaluacion);
    formularios = actualizarCalificacionOral(formularios, evaluacion, 'estudiante-a', 'D1', 0.7, 0.83);
    const accionesA = crearAccionesGuardadoOral(evaluacion.id, formularios, evaluacion, estudiantes.map(({ id }) => id));
    expect(accionesA).toHaveLength(1);
    expect(accionesA[0]).toMatchObject({ idEstudiante: 'estudiante-a', calificaciones: { D1: 0.7 } });

    formularios = actualizarCalificacionOral(formularios, evaluacion, 'estudiante-b', 'D1', 0.6, 0.83);
    const accionesAmbos = crearAccionesGuardadoOral(evaluacion.id, formularios, evaluacion, estudiantes.map(({ id }) => id));
    expect(accionesAmbos.map(({ idEstudiante }) => idEstudiante)).toEqual(['estudiante-a', 'estudiante-b']);
    expect(accionesAmbos.map(({ calificaciones }) => calificaciones.D1)).toEqual([0.7, 0.6]);
  });

  it('no modifica ni guarda una evaluación cerrada', () => {
    const mixta = {
      ...evaluacion,
      oralPorEstudiante: { ...evaluacion.oralPorEstudiante, 'estudiante-a': { ...evaluacion.oralPorEstudiante['estudiante-a'], estado: 'CERRADA' } },
    };
    const formularios = crearFormulariosOrales(estudiantes, mixta);
    const resultado = actualizarCalificacionOral(formularios, mixta, 'estudiante-a', 'D1', 0.1, 0.83);
    expect(resultado).toBe(formularios);
    expect(crearAccionesGuardadoOral(mixta.id, formularios, mixta, ['estudiante-a'])).toEqual([]);
    expect(crearAccionFinalizacionOral(mixta.id, formularios, mixta, 'estudiante-a')).toBeNull();
  });

  it('crea un cierre exclusivamente para el estudiante solicitado', () => {
    const formularios = crearFormulariosOrales(estudiantes, evaluacion);
    const accion = crearAccionFinalizacionOral(evaluacion.id, formularios, evaluacion, 'estudiante-a');
    expect(accion).toMatchObject({
      tipo: 'FINALIZAR_ORAL',
      idEvaluacion: evaluacion.id,
      idEstudiante: 'estudiante-a',
      calificaciones: { D1: 0.5 },
      observaciones: { D1: 'A' },
    });
    expect(accion.idEstudiante).not.toBe('estudiante-b');
  });

  it('acepta cero, limita máximos y conserva la protección de cambios pendientes', () => {
    let formularios = crearFormulariosOrales(estudiantes, evaluacion);
    formularios = actualizarCalificacionOral(formularios, evaluacion, 'estudiante-a', 'D1', 0, 0.83);
    formularios = actualizarCalificacionOral(formularios, evaluacion, 'estudiante-b', 'D1', 9, 0.83);
    expect(formularios['estudiante-a'].calificaciones.D1).toBe(0);
    expect(formularios['estudiante-b'].calificaciones.D1).toBe(0.83);
    expect(hayCambiosFormulariosOrales(formularios)).toBe(true);

    const guardados = marcarFormulariosOralesGuardados(formularios, ['estudiante-a', 'estudiante-b']);
    expect(hayCambiosFormulariosOrales(guardados)).toBe(false);
  });
});
