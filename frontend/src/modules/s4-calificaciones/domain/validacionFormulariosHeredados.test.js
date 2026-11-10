import { describe, expect, it } from 'vitest';
import { validarAsignacionTribunal, validarFormularioTrabajo } from './validacionFormulariosHeredados';

const formularioCompleto = {
  titulo: 'Sistema institucional de seguimiento',
  idTutor: 'docente-1',
};

const estudianteCompleto = {
  cedula: '1300000001',
  nombres: 'Andrea',
  apellidos: 'Mendoza',
};

describe('validarFormularioTrabajo', () => {
  it('identifica cada campo obligatorio vacío', () => {
    expect(validarFormularioTrabajo({ titulo: ' ', idTutor: '' }, [{ cedula: '', nombres: ' ', apellidos: '' }])).toEqual({
      titulo: 'Ingrese el título del trabajo.',
      idTutor: 'Seleccione el docente tutor.',
      'estudiantes.0.cedula': 'Ingrese la cédula del estudiante 1.',
      'estudiantes.0.nombres': 'Ingrese los nombres del estudiante 1.',
      'estudiantes.0.apellidos': 'Ingrese los apellidos del estudiante 1.',
    });
  });

  it('marca todas las cédulas repetidas sin alterar las demás reglas', () => {
    const errores = validarFormularioTrabajo(formularioCompleto, [
      estudianteCompleto,
      { ...estudianteCompleto, nombres: 'Mateo' },
    ]);

    expect(errores).toEqual({
      'estudiantes.0.cedula': 'La cédula debe ser diferente para cada estudiante.',
      'estudiantes.1.cedula': 'La cédula debe ser diferente para cada estudiante.',
    });
  });

  it('acepta los datos que cumplen las reglas actuales', () => {
    expect(validarFormularioTrabajo(formularioCompleto, [estudianteCompleto])).toEqual({});
  });
});

describe('validarAsignacionTribunal', () => {
  it('identifica por separado los dos miembros obligatorios', () => {
    expect(validarAsignacionTribunal(['', ''])).toEqual({
      'miembro.0': 'Seleccione el miembro 1 del tribunal.',
      'miembro.1': 'Seleccione el miembro 2 del tribunal.',
    });
  });

  it('rechaza docentes duplicados y acepta dos docentes distintos', () => {
    expect(validarAsignacionTribunal(['docente-1', 'docente-1'])).toEqual({
      'miembro.0': 'Seleccione dos docentes diferentes.',
      'miembro.1': 'Seleccione dos docentes diferentes.',
    });
    expect(validarAsignacionTribunal(['docente-1', 'docente-2'])).toEqual({});
  });
});
