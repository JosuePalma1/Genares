import {
  calcularCalificacionFinalMiembro,
  calcularTotalRubrica,
  calcularCalificacionFinalEstudiante,
  calcularResultadosEstudiante,
} from './reglas-calificacion';

describe('reglas de calificación', () => {
  it('suma con precisión centesimal los indicadores reales de una categoría', () => {
    expect(
      calcularTotalRubrica([
        { idIndicador: 'A1', score: 0.33, calificacionMaxima: 0.33 },
        { idIndicador: 'A2', score: 0.33, calificacionMaxima: 0.33 },
        { idIndicador: 'A3', score: 0.34, calificacionMaxima: 0.34 },
      ]),
    ).toBe(1);

    expect(
      calcularTotalRubrica([
        { idIndicador: 'D1', score: 0.83, calificacionMaxima: 0.83 },
        { idIndicador: 'D2', score: 0.83, calificacionMaxima: 0.83 },
        { idIndicador: 'D3', score: 0.84, calificacionMaxima: 0.84 },
      ]),
    ).toBe(2.5);
  });

  it('rechaza una calificación superior al máximo del indicador', () => {
    expect(() =>
      calcularTotalRubrica([{ idIndicador: 'A1', score: 0.34, calificacionMaxima: 0.33 }]),
    ).toThrow('debe estar entre 0 y 0.33');
  });

  it('calcula la nota de cada miembro sobre diez', () => {
    expect(calcularCalificacionFinalMiembro(4.6, 4.7)).toBe(9.3);
  });

  it('acepta máximos configurados por la versión de rúbrica', () => {
    expect(calcularCalificacionFinalMiembro(3.5, 5.25, 4, 6)).toBe(8.75);
    expect(() => calcularCalificacionFinalMiembro(4.1, 5, 4, 6)).toThrow('entre 0 y 4.00');
  });

  it('promedia exactamente las notas finales de los dos miembros', () => {
    expect(calcularCalificacionFinalEstudiante([10, 9])).toBe(9.5);
    expect(() => calcularCalificacionFinalEstudiante([10])).toThrow('exactamente dos miembros');
  });

  it('mantiene separada la sustentación de cada estudiante del mismo trabajo', () => {
    const results = calcularResultadosEstudiante(
      [
        { idMiembro: 'tribunal-1', total: 4.6 },
        { idMiembro: 'tribunal-2', total: 4.4 },
      ],
      [
        { idEstudiante: 'estudiante-A', idMiembro: 'tribunal-1', total: 4.7 },
        { idEstudiante: 'estudiante-A', idMiembro: 'tribunal-2', total: 4.5 },
        { idEstudiante: 'estudiante-B', idMiembro: 'tribunal-1', total: 4.2 },
        { idEstudiante: 'estudiante-B', idMiembro: 'tribunal-2', total: 4.0 },
      ],
    );

    expect(results).toEqual([
      {
        idEstudiante: 'estudiante-A',
        calificacionesFinalesMiembros: [
          { idMiembro: 'tribunal-1', calificacionFinal: 9.3 },
          { idMiembro: 'tribunal-2', calificacionFinal: 8.9 },
        ],
        calificacionFinal: 9.1,
      },
      {
        idEstudiante: 'estudiante-B',
        calificacionesFinalesMiembros: [
          { idMiembro: 'tribunal-1', calificacionFinal: 8.8 },
          { idMiembro: 'tribunal-2', calificacionFinal: 8.4 },
        ],
        calificacionFinal: 8.6,
      },
    ]);
  });
});
