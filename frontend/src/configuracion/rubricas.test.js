import { describe, expect, it } from 'vitest';
import { FUENTE_RUBRICAS } from './rubricas';

describe('fuente de lectura de rúbricas', () => {
  it('usa PostgreSQL y deja lectura y escritura bajo las capacidades NestJS', () => {
    expect(FUENTE_RUBRICAS).toBe('api');
  });
});
