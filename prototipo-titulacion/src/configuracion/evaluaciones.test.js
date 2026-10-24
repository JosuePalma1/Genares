import { describe, expect, it } from 'vitest';
import { resolverEscrituraEvaluaciones, resolverFuenteEvaluaciones } from './evaluaciones';

describe('fuente de evaluaciones', () => {
  it('activa API solo mediante opt-in explícito de desarrollo', () => {
    expect(resolverFuenteEvaluaciones({ esDesarrollo: true, fuenteConfigurada: 'api' })).toBe('api');
    expect(resolverFuenteEvaluaciones({ esDesarrollo: true, fuenteConfigurada: undefined })).toBe('prototipo');
    expect(resolverFuenteEvaluaciones({ esDesarrollo: false, fuenteConfigurada: 'api' })).toBe('prototipo');
  });

  it('activa escrituras solo con modo API y opt-in de desarrollo exacto', () => {
    expect(resolverEscrituraEvaluaciones({ esDesarrollo: true, fuenteConfigurada: 'api', escrituraConfigurada: 'true' })).toBe(true);
    expect(resolverEscrituraEvaluaciones({ esDesarrollo: true, fuenteConfigurada: 'api', escrituraConfigurada: 'false' })).toBe(false);
    expect(resolverEscrituraEvaluaciones({ esDesarrollo: false, fuenteConfigurada: 'api', escrituraConfigurada: 'true' })).toBe(false);
    expect(resolverEscrituraEvaluaciones({ esDesarrollo: true, fuenteConfigurada: 'prototipo', escrituraConfigurada: 'true' })).toBe(false);
  });
});
