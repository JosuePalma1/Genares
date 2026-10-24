import { describe, expect, it } from 'vitest';
import { resolverFuenteTrabajos } from './trabajos';

describe('fuente del módulo de trabajos', () => {
  it('usa PostgreSQL cuando el modo API está habilitado en desarrollo', () => {
    expect(resolverFuenteTrabajos({ esDesarrollo: true, fuenteConfigurada: 'api' })).toBe('api');
  });

  it('mantiene el prototipo local fuera del modo API y nunca habilita la API en producción', () => {
    expect(resolverFuenteTrabajos({ esDesarrollo: true, fuenteConfigurada: 'prototipo' })).toBe('prototipo');
    expect(resolverFuenteTrabajos({ esDesarrollo: false, fuenteConfigurada: 'api' })).toBe('prototipo');
  });
});
