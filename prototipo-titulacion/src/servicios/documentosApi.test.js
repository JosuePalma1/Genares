import { afterEach, describe, expect, it, vi } from 'vitest';

describe('servicio de actas archivadas', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('consulta el archivo por carrera y período y recupera los bytes archivados por su ID', async () => {
    vi.stubEnv('VITE_EVALUACIONES_SOURCE', 'api');
    vi.stubEnv('VITE_API_BASE_URL', '/api/v1');
    const actas = [{
      id: 'a1111111-1111-4111-8111-111111111111', numero: '001-2026-2-SOFT',
      estudiante: 'Estudiante de prueba', carrera: 'Ingeniería en Software', periodo: '2026-2', notaFinal: '9.00',
    }];
    const pdf = new Blob(['%PDF-1.4\nacta archivada\n%%EOF'], { type: 'application/pdf' });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(actas), {
        status: 200, headers: { 'content-type': 'application/json' },
      }))
      .mockResolvedValueOnce(new Response(pdf, {
        status: 200, headers: { 'content-type': 'application/pdf' },
      }));
    vi.stubGlobal('fetch', fetcher);

    const { consultarDocumentos, obtenerPdfDocumento, DOCUMENTOS_API_HABILITADA } = await import('./documentosApi');
    expect(DOCUMENTOS_API_HABILITADA).toBe(true);
    await expect(consultarDocumentos('/actas?carrera=SOFT&periodo=2026-2')).resolves.toEqual(actas);
    const documento = await obtenerPdfDocumento(`/actas/${actas[0].id}/pdf`);
    await expect(documento.text()).resolves.toContain('acta archivada');

    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/documentos/actas?carrera=SOFT&periodo=2026-2');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'omit' });
    expect(fetcher.mock.calls[1][0]).toBe(`/api/v1/documentos/actas/${actas[0].id}/pdf`);
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/pdf' },
    });
  });
});
