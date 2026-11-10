import { describe, expect, it } from 'vitest';
import {
  adaptarCarreraApi, adaptarListadoCarrerasApi, mapearActualizarCarrera,
  mapearCrearCarrera, mapearEstadoCarrera,
} from './carrerasApi';

const carrera = {
  id: '11111111-1111-4111-8111-111111111111', codigo: 'PRUEBA_9H3', nombre: 'Carrera de prueba',
  estaActivo: true, revision: 3, creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-02T00:00:00.000Z',
};

describe('adaptador de carreras API', () => {
  it('conserva UUID, código y revisión, y marca el origen', () => {
    expect(adaptarCarreraApi(carrera)).toMatchObject({ id: carrera.id, codigo: carrera.codigo, revision: 3, fuenteDatos: 'api' });
    expect(adaptarListadoCarrerasApi([carrera])).toHaveLength(1);
  });
  it('rechaza respuestas inválidas sin mezclar datos locales', () => {
    expect(() => adaptarListadoCarrerasApi({ carreras: [] })).toThrow();
    expect(() => adaptarCarreraApi({ ...carrera, revision: '3' })).toThrow();
  });
  it('mapea creación, edición completa y cambio de estado sin actor del navegador', () => {
    expect(mapearCrearCarrera({ codigo: ' CARRERA_X ', nombre: ' Prueba ', estaActivo: true, actorId: 'falso' }))
      .toEqual({ codigo: 'CARRERA_X', nombre: 'Prueba', estaActivo: true });
    expect(mapearActualizarCarrera({ ...carrera, nombre: ' Actualizada ', actorId: 'falso' }))
      .toEqual({ id: carrera.id, dto: { revision: 3, nombre: 'Actualizada' } });
    expect(mapearEstadoCarrera({ ...carrera, estaActivo: false }))
      .toEqual({ id: carrera.id, dto: { revision: 3, estaActivo: false } });
    expect(() => mapearActualizarCarrera({ ...carrera, revision: null })).toThrow();
  });
});
