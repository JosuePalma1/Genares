import { describe, it, expect } from 'vitest';
import { adaptarEtapaRubricaMer, obtenerCalificacionesEditables, obtenerObservacionesEditables } from './adaptacionRubricaMer';

const etapa = { id: 'oral', codigo: 'ORAL', nombre: 'Sustentación oral',
  calificacionMaxima: '10', scope: 'ESTUDIANTE_INDIVIDUAL', orden: 2,
  categorias: [
    { id: 'cat1', nombre: 'Exposición', calificacionMaxima: '6', indicadores: [
      { id: 'ind1', label: 'Argumentación', descripcion: 'Explica la metodología', calificacionMaxima: '4' },
      { id: 'ind2', label: 'Claridad', calificacionMaxima: '2' },
    ] },
    { id: 'cat2', nombre: 'Preguntas', calificacionMaxima: '4', indicadores: [
      { id: 'ind3', label: 'Respuestas', calificacionMaxima: '4' },
    ] },
  ] };

describe('Adaptación de la rúbrica del MER sin cambiar su estructura', () => {
  it('respeta cada indicador y genera letras de categoría', () => {
    const rubrica = adaptarEtapaRubricaMer(etapa);
    expect(rubrica.categorias.map((cat) => cat.codigo)).toEqual(['A', 'B']);
    expect(rubrica.categorias[0].indicadores.map((ind) => ind.maximo)).toEqual([4, 2]);
    expect(rubrica.categorias[0].indicadores[0].etiqueta).toContain('Explica la metodología');
    expect(rubrica.etapas[0].maximo).toBe(10);
  });
  it('distingue un cero válido de un indicador pendiente', () => {
    const notas = { a: { score: '0', observation: '' }, b: { score: '', observation: 'Pendiente' } };
    expect(obtenerCalificacionesEditables(notas)).toEqual({ a: '0', b: '' });
    expect(obtenerObservacionesEditables(notas).b).toBe('Pendiente');
  });
  it('conserva precisión de borradores al adaptar valores', () => {
    const notas = { a: { score: '8.456', observation: 'Prueba' } };
    expect(obtenerCalificacionesEditables(notas).a).toBe('8.456');
  });
});
