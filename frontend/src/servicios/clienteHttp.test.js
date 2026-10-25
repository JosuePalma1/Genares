import { describe, expect, it, vi } from 'vitest';
import {
  crearClienteHttp,
  ErrorApiHttp,
  ErrorConexionApi,
  ErrorEscrituraApiDeshabilitada,
  crearClientesHttpPorModulo,
} from './clienteHttp';

describe('cliente HTTP de escritura local', () => {
  it('envía JSON por same-origin sin credenciales ni identidad seleccionable', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'creada' }), { status: 201 }));
    const cliente = crearClienteHttp({
      baseUrl: '/api/v1',
      habilitado: true,
      escriturasHabilitadas: true,
      fetcher,
    });

    await expect(cliente.postJson('/rubricas', { modalidadId: 'uuid' })).resolves.toEqual({ id: 'creada' });
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = fetcher.mock.calls[0];
    expect(url).toBe('/api/v1/rubricas');
    expect(request).toMatchObject({ method: 'POST', credentials: 'omit', body: '{"modalidadId":"uuid"}' });
    expect(request.headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Genares-Write-Intent': 'local-development',
    });
    expect(request.headers).not.toHaveProperty('Authorization');
    expect(request.headers).not.toHaveProperty('x-capacidades');
    expect(request.headers).not.toHaveProperty('x-principal-prueba');
  });

  it('no emite encabezados de identidad ni selección de perfiles', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const cliente = crearClienteHttp({
      baseUrl: '/api/v1',
      habilitado: true,
      fetcher,
    });

    await cliente.getJson('/documentos/trabajos');
    await cliente.getJson('/evaluaciones/trabajos/uuid');

    for (const [, request] of fetcher.mock.calls) {
      expect(request.headers).not.toHaveProperty('X-Genares-Dev-Identity');
      expect(request.headers).not.toHaveProperty('Authorization');
    }
  });

  it('mantiene las escrituras deshabilitadas por defecto y no intenta conectar', async () => {
    const fetcher = vi.fn();
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true, fetcher });
    await expect(cliente.putJson('/versiones-rubrica/id', {})).rejects.toBeInstanceOf(ErrorEscrituraApiDeshabilitada);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('separa el opt-in de escritura entre modalidades y rúbricas', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const clientes = crearClientesHttpPorModulo({
      habilitado: true,
      escriturasRubricasHabilitadas: false,
      escriturasModalidadesHabilitadas: true,
      fetcher,
    });

    await expect(clientes.modalidades.postJson('/modalidades', {})).resolves.toEqual({ ok: true });
    await expect(clientes.rubricas.postJson('/rubricas', {})).rejects.toBeInstanceOf(ErrorEscrituraApiDeshabilitada);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('mantiene carreras en lectura si su opt-in de escritura está apagado', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const clientes = crearClientesHttpPorModulo({
      habilitado: true,
      escriturasRubricasHabilitadas: true,
      escriturasModalidadesHabilitadas: true,
      escriturasCarrerasHabilitadas: false,
      fetcher,
    });
    await expect(clientes.carreras.getJson('/carreras')).resolves.toEqual([]);
    await expect(clientes.carreras.postJson('/carreras', {})).rejects.toBeInstanceOf(ErrorEscrituraApiDeshabilitada);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('propaga 409 como conflicto visible sin reintentar ni alterar la solicitud', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'La solicitud entra en conflicto con el estado actual.',
    }), { status: 409 }));
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true, escriturasHabilitadas: true, fetcher });
    await expect(cliente.putJson('/versiones-rubrica/id', { revision: 1, etapas: [] }))
      .rejects.toMatchObject({ name: ErrorApiHttp.name, status: 409, code: 'CONFLICT' });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('protege PATCH con la misma intención local y no envía identidad', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ estaActivo: false }), { status: 200 }));
    const cliente = crearClienteHttp({ habilitado: true, escriturasHabilitadas: true, fetcher });
    await expect(cliente.patchJson('/modalidades/id/estado', { revision: 2, estaActivo: false })).resolves.toEqual({ estaActivo: false });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'PATCH', credentials: 'omit' });
    expect(fetcher.mock.calls[0][1].headers).toEqual({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Genares-Write-Intent': 'local-development',
    });
  });

  it('conserva errores de validación y fallos de red', async () => {
    const badRequest = crearClienteHttp({
      habilitado: true,
      escriturasHabilitadas: true,
      fetcher: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'La solicitud no es válida.',
        details: ['etapas debe ser un arreglo.'],
      }), { status: 400 })),
    });
    await expect(badRequest.postJson('/rubricas', {})).rejects.toMatchObject({
      name: ErrorApiHttp.name,
      status: 400,
      code: 'VALIDATION_ERROR',
      details: ['etapas debe ser un arreglo.'],
    });

    const offline = crearClienteHttp({
      habilitado: true,
      escriturasHabilitadas: true,
      fetcher: vi.fn().mockRejectedValue(new TypeError('offline')),
    });
    await expect(offline.postJson('/rubricas', {})).rejects.toBeInstanceOf(ErrorConexionApi);
    await expect(offline.getJson('/carreras')).rejects.toMatchObject({
      name: ErrorConexionApi.name,
      message: expect.stringContaining('No fue posible completar la consulta'),
    });
  });

  it('distingue el error de proxy de Vite de un error JSON devuelto por NestJS', async () => {
    const proxyCaido = crearClienteHttp({
      baseUrl: '/api/v1',
      habilitado: true,
      fetcher: vi.fn().mockResolvedValue(new Response('http proxy error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })),
    });
    await expect(proxyCaido.getJson('/trabajos')).rejects.toBeInstanceOf(ErrorConexionApi);

    const errorNest = crearClienteHttp({
      baseUrl: '/api/v1',
      habilitado: true,
      fetcher: vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: 500 }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })),
    });
    await expect(errorNest.getJson('/trabajos')).rejects.toMatchObject({
      name: ErrorApiHttp.name,
      status: 500,
      message: 'No se pudo completar la operación (código 500).',
    });
  });
});
