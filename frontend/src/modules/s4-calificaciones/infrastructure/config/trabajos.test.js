import { describe, expect, it } from 'vitest';
import { FUENTE_TRABAJOS } from './trabajos';

describe('fuente del módulo de trabajos', () => {
  it('mantiene PostgreSQL como fuente única independientemente de los flags de entorno', () => {
    expect(FUENTE_TRABAJOS).toBe('api');
  });
});
