import { describe, expect, it } from 'vitest';
import { FUENTE_PROGRAMACIONES } from './programaciones';

describe('configuración del cronograma API', () => {
  it('usa PostgreSQL y deja el control de permisos en la API', () => {
    expect(FUENTE_PROGRAMACIONES).toBe('api');
  });
});
