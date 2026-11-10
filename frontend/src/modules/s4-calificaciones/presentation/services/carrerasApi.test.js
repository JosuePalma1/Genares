import { describe, expect, it, vi } from 'vitest';
import {
  actualizarCarreraApi, cambiarEstadoCarreraApi, cargarCapacidadesCarrerasApi,
  cargarCarreraApi, cargarCarrerasApi, crearCarreraApi,
} from './carrerasApi';

const carrera = {
  id: '11111111-1111-4111-8111-111111111111', codigo: 'PRUEBA_9H3', nombre: 'Carrera de prueba',
  estaActivo: true, revision: 1, creadoEn: '2026-01-01T00:00:00.000Z', actualizadoEn: '2026-01-01T00:00:00.000Z',
};

describe('servicio de carreras API', () => {
  it('lee listado, detalle y capacidades sin persistir en el prototipo', async () => {
    const solicitarJson = vi.fn().mockResolvedValueOnce([carrera]).mockResolvedValueOnce(carrera).mockResolvedValueOnce({ puedeAdministrar: true });
    expect((await cargarCarrerasApi({ solicitarJson }))[0].fuenteDatos).toBe('api');
    expect((await cargarCarreraApi(carrera.id, { solicitarJson })).revision).toBe(1);
    expect(await cargarCapacidadesCarrerasApi({ solicitarJson })).toEqual({ puedeAdministrar: true });
    expect(solicitarJson.mock.calls.map(([ruta]) => ruta)).toEqual(['/carreras', `/carreras/${carrera.id}`, '/carreras/capacidades']);
  });
  it('envía únicamente campos autorizados y la revisión esperada', async () => {
    const solicitarJson = vi.fn().mockResolvedValue(carrera);
    await crearCarreraApi({ codigo: 'PRUEBA_9H3', nombre: 'Carrera de prueba', estaActivo: true, actorId: 'falso' }, { solicitarJson });
    await actualizarCarreraApi({ ...carrera, nombre: 'Nuevo nombre' }, { solicitarJson });
    await cambiarEstadoCarreraApi({ ...carrera, estaActivo: false }, { solicitarJson });
    expect(solicitarJson.mock.calls).toEqual([
      ['/carreras', { codigo: 'PRUEBA_9H3', nombre: 'Carrera de prueba', estaActivo: true }],
      [`/carreras/${carrera.id}`, { revision: 1, nombre: 'Nuevo nombre' }],
      [`/carreras/${carrera.id}/estado`, { revision: 1, estaActivo: false }],
    ]);
  });
  it('propaga conflictos y fallos de red sin fabricar éxitos', async () => {
    await expect(crearCarreraApi({ codigo: 'X', nombre: 'X', estaActivo: true }, {
      solicitarJson: () => Promise.reject(new Error('conflicto 409')),
    })).rejects.toThrow('409');
    await expect(cargarCarrerasApi({ solicitarJson: () => Promise.reject(new Error('sin conexión')) })).rejects.toThrow('sin conexión');
  });
});
