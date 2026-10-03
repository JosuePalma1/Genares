import { EstadoEvaluacion } from '../comun/enums-dominio';
import {
  validarSustentacionProgramable,
  validarDosMiembrosTribunalDistintos,
  puedeProgramarSustentacion,
} from './reglas-flujo';

describe('reglas de flujo', () => {
  it('habilita la sustentación únicamente con dos revisiones escritas cerradas', () => {
    expect(
      puedeProgramarSustentacion([
        { idMiembro: 'member-1', estado: EstadoEvaluacion.CERRADA },
        { idMiembro: 'member-2', estado: EstadoEvaluacion.CERRADA },
      ]),
    ).toBe(true);

    expect(
      puedeProgramarSustentacion([
        { idMiembro: 'member-1', estado: EstadoEvaluacion.CERRADA },
        { idMiembro: 'member-2', estado: EstadoEvaluacion.BORRADOR },
      ]),
    ).toBe(false);

    expect(() =>
      validarSustentacionProgramable([
        { idMiembro: 'member-1', estado: EstadoEvaluacion.CERRADA },
      ]),
    ).toThrow('dos miembros');
  });

  it('exige dos docentes distintos al confirmar el tribunal', () => {
    expect(() => validarDosMiembrosTribunalDistintos(['docente-1', 'docente-2'])).not.toThrow();
    expect(() => validarDosMiembrosTribunalDistintos(['docente-1', 'docente-1'])).toThrow(
      'dos docentes distintos',
    );
  });
});
