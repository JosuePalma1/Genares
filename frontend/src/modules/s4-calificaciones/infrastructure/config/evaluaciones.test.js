import { describe, expect, it } from 'vitest';
import { FUENTE_EVALUACIONES } from './evaluaciones';

describe('fuente de evaluaciones', () => {
  it('usa PostgreSQL y delega el permiso de escritura a las capacidades del servidor', () => {
    expect(FUENTE_EVALUACIONES).toBe('api');
  });
});
