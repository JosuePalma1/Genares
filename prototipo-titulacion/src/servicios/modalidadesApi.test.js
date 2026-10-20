import { describe, expect, it, vi } from 'vitest';
import {
  actualizarModalidadApi,
  cambiarEstadoModalidadApi,
  cargarModalidadApi,
  cargarModalidadesApi,
  crearModalidadApi,
} from './modalidadesApi';
import { ErrorApiHttp } from './clienteHttp';

const id = 'b9946db9-05ea-4592-9966-1e53f0d9cb69';
const dto = {
  id,
  codigo: 'PI',
  nombre: 'Proyecto integrador',
  descripcion: null,
  estaActivo: true,
  revision: 1,
  creadoEn: '2026-10-15T10:00:00.000Z',
  actualizadoEn: '2026-10-15T10:00:00.000Z',
  familiaRubricas: null,
};

describe('contratos HTTP de modalidades', () => {
  it('consulta catálogo, disponibilidad para asociación y detalle', async () => {
    const solicitarJson = vi.fn().mockResolvedValueOnce([dto]).mockResolvedValueOnce([dto]).mockResolvedValueOnce(dto);
    await expect(cargarModalidadesApi({ solicitarJson })).resolves.toMatchObject([{ id, fuenteDatos: 'api' }]);
    await cargarModalidadesApi({ disponiblesParaFamilia: true, solicitarJson });
    await expect(cargarModalidadApi(id, { solicitarJson })).resolves.toMatchObject({ id });
    expect(solicitarJson.mock.calls.map(([path]) => path)).toEqual([
      '/modalidades', '/modalidades?disponiblesParaFamilia=true', `/modalidades/${id}`,
    ]);
    await expect(cargarModalidadApi('not-uuid', { solicitarJson })).rejects.toThrow(/UUID/);
  });

  it('envía crear, PUT completo y PATCH con revisión sin credenciales de identidad', async () => {
    const solicitarJson = vi.fn().mockResolvedValue(dto);
    await crearModalidadApi({ codigo: ' PI ', nombre: ' Proyecto ', estaActivo: true }, { solicitarJson });
    await actualizarModalidadApi({ id, revision: 1, codigo: 'PI', nombre: 'Proyecto editado', descripcion: null }, { solicitarJson });
    await cambiarEstadoModalidadApi({ id, revision: 2, estaActivo: false }, { solicitarJson });
    expect(solicitarJson.mock.calls).toEqual([
      ['/modalidades', { codigo: 'PI', nombre: 'Proyecto', descripcion: null, estaActivo: true }],
      [`/modalidades/${id}`, { revision: 1, codigo: 'PI', nombre: 'Proyecto editado', descripcion: null }],
      [`/modalidades/${id}/estado`, { revision: 2, estaActivo: false }],
    ]);
    for (const [, body] of solicitarJson.mock.calls) expect(body).not.toHaveProperty('actorId');
  });

  it('propaga 409, 403 y errores de red sin fabricar registros', async () => {
    const conflicto = new ErrorApiHttp(409, { code: 'CONFLICT' });
    await expect(actualizarModalidadApi(
      { id, revision: 1, codigo: 'PI', nombre: 'Editada', descripcion: null },
      { solicitarJson: vi.fn().mockRejectedValue(conflicto) },
    )).rejects.toMatchObject({ status: 409 });
    const prohibido = new ErrorApiHttp(403);
    await expect(cambiarEstadoModalidadApi(
      { id, revision: 1, estaActivo: false },
      { solicitarJson: vi.fn().mockRejectedValue(prohibido) },
    )).rejects.toMatchObject({ status: 403 });
    await expect(crearModalidadApi(
      { codigo: 'NUEVA', nombre: 'Nueva', estaActivo: true },
      { solicitarJson: vi.fn().mockRejectedValue(new TypeError('offline')) },
    )).rejects.toThrow('offline');
  });
});
