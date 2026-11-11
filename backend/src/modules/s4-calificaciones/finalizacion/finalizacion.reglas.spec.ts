import { evaluarFinalizacion, EstudianteFinalizacion } from './finalizacion.reglas';

const completo = (id: string): EstudianteFinalizacion => ({ id, nombre: `Estudiante ${id}`, pendientesActa: [], actaArchivada: true });

describe('evaluarFinalizacion', () => {
  it('permite finalizar cuando todos los estudiantes están completos y con acta archivada', () => {
    const resultado = evaluarFinalizacion({ estadoProceso: 'REGISTRADO', estudiantes: [completo('A'), completo('B')] });
    expect(resultado.puedeFinalizar).toBe(true);
    expect(resultado.pendientesTrabajo).toEqual([]);
    expect(resultado.estudiantes.every((e) => e.cumplida)).toBe(true);
  });

  it('bloquea la bina si un estudiante tiene evaluaciones o validaciones pendientes', () => {
    const resultado = evaluarFinalizacion({
      estadoProceso: 'REGISTRADO',
      estudiantes: [completo('A'), { ...completo('B'), pendientesActa: ['Hay evaluaciones en progreso que todavía no están cerradas.'] }],
    });
    expect(resultado.puedeFinalizar).toBe(false);
    expect(resultado.estudiantes.find((e) => e.idEstudiante === 'A')?.cumplida).toBe(true);
    expect(resultado.estudiantes.find((e) => e.idEstudiante === 'B')?.pendientes)
      .toEqual(['Hay evaluaciones en progreso que todavía no están cerradas.']);
  });

  it('exige el acta archivada aunque las evaluaciones estén completas', () => {
    const resultado = evaluarFinalizacion({ estadoProceso: 'REGISTRADO', estudiantes: [{ ...completo('A'), actaArchivada: false }] });
    expect(resultado.puedeFinalizar).toBe(false);
    expect(resultado.estudiantes[0].pendientes).toEqual(['Falta el acta de calificación archivada.']);
  });

  it('no vuelve a finalizar un trabajo finalizado ni uno sin estudiantes', () => {
    const finalizado = evaluarFinalizacion({ estadoProceso: 'FINALIZADO', estudiantes: [completo('A')] });
    expect(finalizado).toMatchObject({ finalizado: true, puedeFinalizar: false, pendientesTrabajo: ['El trabajo ya está finalizado.'] });
    expect(evaluarFinalizacion({ estadoProceso: 'REGISTRADO', estudiantes: [] }).puedeFinalizar).toBe(false);
  });
});
