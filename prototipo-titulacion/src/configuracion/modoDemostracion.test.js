import { describe, expect, it } from 'vitest';
import { modoDemostracionPermitido } from './modoDemostracion';

describe('modo de demostración', () => {
  it('solo se habilita con el servidor de desarrollo de Vite', () => {
    expect(modoDemostracionPermitido('development')).toBe(true);
    expect(modoDemostracionPermitido('production')).toBe(false);
    expect(modoDemostracionPermitido('test')).toBe(false);
    expect(modoDemostracionPermitido(undefined)).toBe(false);
  });
});
