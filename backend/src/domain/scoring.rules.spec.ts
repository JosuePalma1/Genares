import {
  calculateMemberFinalScore,
  calculateRubricTotal,
  calculateStudentFinalScore,
  calculateStudentResults,
} from './scoring.rules';

describe('reglas de calificación', () => {
  it('suma con precisión centesimal los indicadores reales de una categoría', () => {
    expect(
      calculateRubricTotal([
        { indicatorId: 'A1', score: 0.33, maxScore: 0.33 },
        { indicatorId: 'A2', score: 0.33, maxScore: 0.33 },
        { indicatorId: 'A3', score: 0.34, maxScore: 0.34 },
      ]),
    ).toBe(1);

    expect(
      calculateRubricTotal([
        { indicatorId: 'D1', score: 0.83, maxScore: 0.83 },
        { indicatorId: 'D2', score: 0.83, maxScore: 0.83 },
        { indicatorId: 'D3', score: 0.84, maxScore: 0.84 },
      ]),
    ).toBe(2.5);
  });

  it('rechaza una calificación superior al máximo del indicador', () => {
    expect(() =>
      calculateRubricTotal([{ indicatorId: 'A1', score: 0.34, maxScore: 0.33 }]),
    ).toThrow('debe estar entre 0 y 0.33');
  });

  it('calcula la nota de cada miembro sobre diez', () => {
    expect(calculateMemberFinalScore(4.6, 4.7)).toBe(9.3);
  });

  it('promedia exactamente las notas finales de los dos miembros', () => {
    expect(calculateStudentFinalScore([10, 9])).toBe(9.5);
    expect(() => calculateStudentFinalScore([10])).toThrow('exactamente dos miembros');
  });

  it('mantiene separada la sustentación de cada estudiante del mismo trabajo', () => {
    const results = calculateStudentResults(
      [
        { memberId: 'tribunal-1', total: 4.6 },
        { memberId: 'tribunal-2', total: 4.4 },
      ],
      [
        { studentId: 'student-A', memberId: 'tribunal-1', total: 4.7 },
        { studentId: 'student-A', memberId: 'tribunal-2', total: 4.5 },
        { studentId: 'student-B', memberId: 'tribunal-1', total: 4.2 },
        { studentId: 'student-B', memberId: 'tribunal-2', total: 4.0 },
      ],
    );

    expect(results).toEqual([
      {
        studentId: 'student-A',
        memberFinalScores: [
          { memberId: 'tribunal-1', finalScore: 9.3 },
          { memberId: 'tribunal-2', finalScore: 8.9 },
        ],
        finalScore: 9.1,
      },
      {
        studentId: 'student-B',
        memberFinalScores: [
          { memberId: 'tribunal-1', finalScore: 8.8 },
          { memberId: 'tribunal-2', finalScore: 8.4 },
        ],
        finalScore: 8.6,
      },
    ]);
  });
});
