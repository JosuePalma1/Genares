import { describe, expect, it } from 'vitest';
import { resolverFuenteRubricas, resolverEscrituraApi } from './rubricas';

describe('fuente de lectura de rúbricas', () => {
  it('usa API solo cuando se habilita en desarrollo', () => {
    expect(resolverFuenteRubricas({ esDesarrollo: true, fuenteConfigurada: 'api' })).toBe('api');
  });

  it('mantiene el prototipo por defecto y en producción', () => {
    expect(resolverFuenteRubricas({ esDesarrollo: true, fuenteConfigurada: undefined })).toBe('prototipo');
    expect(resolverFuenteRubricas({ esDesarrollo: false, fuenteConfigurada: 'api' })).toBe('prototipo');
  });
});

describe('escrituras API', () => {
  it('requiere modo desarrollo, fuente API y opt-in explicito', () => {
    const base = { esDesarrollo: true, fuente: 'api', escrituraConfigurada: 'true' };
    expect(resolverEscrituraApi(base)).toBe(true);
    expect(resolverEscrituraApi({ ...base, escrituraConfigurada: 'false' })).toBe(false);
    expect(resolverEscrituraApi({ ...base, esDesarrollo: false })).toBe(false);
    expect(resolverEscrituraApi({ ...base, fuente: 'prototipo' })).toBe(false);
  });
});
