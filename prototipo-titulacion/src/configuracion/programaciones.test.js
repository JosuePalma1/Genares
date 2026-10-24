import { describe, expect, it } from 'vitest';
import { resolverEscrituraProgramaciones, resolverFuenteProgramaciones } from './programaciones';

describe('configuración del cronograma API', () => {
  it('solo usa la fuente API por opt-in explícito durante desarrollo', () => {
    expect(resolverFuenteProgramaciones({ esDesarrollo: true, fuenteConfigurada: 'api' })).toBe('api');
    expect(resolverFuenteProgramaciones({ esDesarrollo: false, fuenteConfigurada: 'api' })).toBe('deshabilitada');
    expect(resolverFuenteProgramaciones({ esDesarrollo: true, fuenteConfigurada: undefined })).toBe('deshabilitada');
  });

  it('habilita escrituras solo con fuente API y opt-in explícito', () => {
    expect(resolverEscrituraProgramaciones({ esDesarrollo: true, fuente: 'api', escrituraConfigurada: 'true' })).toBe(true);
    expect(resolverEscrituraProgramaciones({ esDesarrollo: false, fuente: 'api', escrituraConfigurada: 'true' })).toBe(false);
    expect(resolverEscrituraProgramaciones({ esDesarrollo: true, fuente: 'deshabilitada', escrituraConfigurada: 'true' })).toBe(false);
  });
});
