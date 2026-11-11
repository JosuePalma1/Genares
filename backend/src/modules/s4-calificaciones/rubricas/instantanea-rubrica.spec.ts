import { filtrarInstantaneaVisible, InstantaneaRubrica } from './instantanea-rubrica';

const indicador = (id: string) => ({ id, label: id, descripcion: '', calificacionMaxima: '1.00', orden: 1 });
const etapa = (id: string) => ({
  id, kind: 'ESCRITA', scope: 'TRABAJO_COMPARTIDO', codigo: id, nombre: id,
  descripcion: null, calificacionMaxima: '5.00', porcentaje: null, orden: 1,
}) as InstantaneaRubrica['stages'][number];
const base = (overrides: Partial<InstantaneaRubrica> = {}): InstantaneaRubrica => ({
  rubricId: 'r', rubricVersionId: 'v1', rubricName: 'R', version: '1',
  academicPeriodCode: '2026-1', modalityCode: 'M',
  stages: [etapa('e1'), etapa('e2')],
  categories: [
    { id: 'c1', codigo: 'A', nombre: 'A', stageId: 'e1', calificacionMaxima: '2.00', orden: 1,
      indicators: [indicador('i1'), indicador('i2')] },
    { id: 'c2', codigo: 'B', nombre: 'B', stageId: 'e2', calificacionMaxima: '2.00', orden: 2,
      indicators: [indicador('i3')] },
  ],
  ...overrides,
});

describe('filtrarInstantaneaVisible', () => {
  it('omite etapas, categorías e indicadores retirados sin mutar la instantánea guardada', () => {
    const guardada = base();
    const visible = base({
      stages: [etapa('e1')],
      categories: [{ ...guardada.categories[0], indicators: [indicador('i1')] }],
    });

    const resultado = filtrarInstantaneaVisible(guardada, visible);

    expect(resultado.stages.map(({ id }) => id)).toEqual(['e1']);
    expect(resultado.categories.map(({ id }) => id)).toEqual(['c1']);
    expect(resultado.categories[0].indicators.map(({ id }) => id)).toEqual(['i1']);
    expect(guardada.categories[0].indicators).toHaveLength(2);
  });

  it('no altera una instantánea de otra versión', () => {
    const guardada = base({ rubricVersionId: 'v0' });
    expect(filtrarInstantaneaVisible(guardada, base({ stages: [] }))).toBe(guardada);
  });
});
