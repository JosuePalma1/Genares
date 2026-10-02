import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/prototypeData';
import { areWrittenReviewsClosed, clampScore, memberGrade, stageScore, studentFinalGrade } from './workflow';

describe('reglas del flujo de evaluación', () => {
  it('impide superar el máximo de un indicador', () => {
    expect(clampScore(0.7, 0.33)).toBe(0.33);
    expect(clampScore(-1, 0.33)).toBe(0);
  });

  it('bloquea la sustentación si falta una revisión escrita', () => {
    const state = createInitialState();
    const work = state.works.find((item) => item.id === 'work-184');
    expect(areWrittenReviewsClosed(state, work)).toBe(false);
  });

  it('mantiene la parte escrita en una escala máxima de cinco', () => {
    const state = createInitialState();
    const evaluation = state.evaluations.find((item) => item.id === 'work-241-teacher-maria');
    expect(stageScore(evaluation, 'WRITTEN')).toBeLessThanOrEqual(5);
  });

  it('calcula la nota individual sin mezclar estudiantes', () => {
    const state = createInitialState();
    const work = state.works.find((item) => item.id === 'work-419');
    const evaluation = state.evaluations.find((item) => item.id === 'work-419-teacher-maria');
    const memberResult = memberGrade(evaluation, 'student-noelia');
    expect(memberResult).toBeGreaterThan(0);
    expect(memberGrade(evaluation, 'student-andrea')).toBeNull();
    expect(studentFinalGrade(state, work, 'student-noelia')).toBeGreaterThan(0);
    expect(studentFinalGrade(state, work, 'student-noelia')).toBeLessThanOrEqual(10);
  });
});
