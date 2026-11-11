import { describe, expect, it } from 'vitest';
import { esEstadoRegistroValido, esRegistroVisible, filtrarRegistrosVisibles } from './estadoRegistro';

describe('visibilidad del estado de registro', () => {
  it('conserva la visibilidad de datos previos sin el campo y del estado 1', () => {
    expect(esRegistroVisible({})).toBe(true);
    expect(esRegistroVisible({ estadoRegistro: 1 })).toBe(true);
    expect(esRegistroVisible({ estadoRegistro: '1' })).toBe(true);
  });

  it('oculta el estado 0 sin borrar ni alterar los demás registros', () => {
    const registros = [{ id: 'visible', estadoRegistro: 1 }, { id: 'oculto', estadoRegistro: 0 }];
    expect(filtrarRegistrosVisibles(registros)).toEqual([{ id: 'visible', estadoRegistro: 1 }]);
    expect(registros).toHaveLength(2);
    expect(esRegistroVisible({ estadoRegistro: '0' })).toBe(false);
  });

  it('permite detectar estados inválidos para rechazar la respuesta API', () => {
    expect(esEstadoRegistroValido({ estadoRegistro: 0 })).toBe(true);
    expect(esEstadoRegistroValido({ estadoRegistro: 2 })).toBe(false);
  });
});
