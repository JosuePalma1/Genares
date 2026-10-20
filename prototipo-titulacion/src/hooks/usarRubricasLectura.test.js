import { describe, expect, it } from 'vitest';
import { seleccionarVersionesRubricas } from './usarRubricasLectura';

describe('separación de origen de rúbricas', () => {
  const prototipo = [{ id: 'simulada', fuenteDatos: 'prototipo' }];
  const api = [{ id: 'uuid-postgres', fuenteDatos: 'api' }];

  it('usa únicamente datos API cuando esa fuente está seleccionada', () => {
    expect(seleccionarVersionesRubricas({ fuente: 'api', versionesApi: api, versionesPrototipo: prototipo })).toEqual(api);
  });

  it('no sustituye una respuesta API vacía por registros del prototipo', () => {
    expect(seleccionarVersionesRubricas({ fuente: 'api', versionesApi: [], versionesPrototipo: prototipo })).toEqual([]);
  });

  it('mantiene el prototipo como fuente predeterminada', () => {
    expect(seleccionarVersionesRubricas({ fuente: 'prototipo', versionesApi: api, versionesPrototipo: prototipo })).toEqual(prototipo);
  });
});
