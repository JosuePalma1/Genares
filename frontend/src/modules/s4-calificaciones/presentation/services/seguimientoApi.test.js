import { describe, expect, it, vi } from 'vitest';
import { ErrorRespuestaApi } from './clienteHttp';
import { crearServicioSeguimientoApi } from './seguimientoApi';
import { listarPaginaActasApi, listarTrabajosDocumentosApi, rutaPaginaActas } from './documentosApi';

const resumen = {
  periodo: '2026-2',
  periodos: [{ codigo: '2026-2', nombre: null, activo: true }],
  trabajos: { total: 3, porCarrera: [{ codigo: 'TI', cantidad: 3 }], porEstado: [{ estado: 'REGISTRADO', cantidad: 3 }] },
  programaciones: 2,
  actas: 1,
  resultados: { estado: 'parcial', completos: 4, trabajosConsultados: 3, trabajosConError: 1 },
};

describe('resumen de seguimiento calculado en el servidor', () => {
  it('pide el resumen del periodo y valida el contrato', async () => {
    const getJson = vi.fn().mockResolvedValue(resumen);
    const servicio = crearServicioSeguimientoApi({ getJson });
    await expect(servicio.resumen()).resolves.toEqual(resumen);
    await servicio.resumen('TODOS');
    expect(getJson.mock.calls.map(([ruta]) => ruta)).toEqual(['/seguimiento/resumen', '/seguimiento/resumen?periodo=TODOS']);
  });

  it('rechaza un resumen incompleto o con conteos inválidos', async () => {
    for (const invalido of [
      { ...resumen, resultados: { ...resumen.resultados, estado: 'otro' } },
      { ...resumen, trabajos: { ...resumen.trabajos, total: -1 } },
      { ...resumen, actas: undefined },
    ]) {
      await expect(crearServicioSeguimientoApi({ getJson: vi.fn().mockResolvedValue(invalido) }).resumen())
        .rejects.toBeInstanceOf(ErrorRespuestaApi);
    }
  });
});

describe('documentos paginados', () => {
  const acta = { id: 'a1', estadoRegistro: 1, numero: '001' };

  it('pide una página de actas con los filtros escritos y vuelve a la última si la pedida ya no existe', async () => {
    expect(rutaPaginaActas({ estudiante: ' Ana ', carrera: '', periodo: '2026-2' })).toBe('/actas?limite=25&pagina=1&estudiante=Ana&periodo=2026-2');
    const getJson = vi.fn()
      .mockResolvedValueOnce({ elementos: [], paginacion: { pagina: 4, limite: 25, total: 30, paginas: 2 } })
      .mockResolvedValueOnce({ elementos: [acta, { ...acta, id: 'a2', estadoRegistro: 0 }], paginacion: { pagina: 2, limite: 25, total: 30, paginas: 2 } });
    await expect(listarPaginaActasApi({ pagina: 4 }, { getJson })).resolves.toEqual({
      elementos: [acta], paginacion: { pagina: 2, limite: 25, total: 30, paginas: 2 },
    });
    expect(getJson.mock.calls[1][0]).toBe('/documentos/actas?limite=25&pagina=2');
  });

  it('rechaza una página de actas sin paginación válida', async () => {
    await expect(listarPaginaActasApi({}, { getJson: vi.fn().mockResolvedValue([acta]) })).rejects.toBeInstanceOf(ErrorRespuestaApi);
  });

  it('consulta los trabajos de Documentos por periodo, por defecto el activo', async () => {
    const respuesta = { elementos: [{ id: 't1' }], periodo: '2026-2', periodos: [{ codigo: '2026-2', activo: true }] };
    const getJson = vi.fn().mockResolvedValue(respuesta);
    await expect(listarTrabajosDocumentosApi(undefined, { getJson })).resolves.toEqual(respuesta);
    expect(getJson.mock.calls[0][0]).toBe('/documentos/trabajos?periodo=ACTIVO');
    await expect(listarTrabajosDocumentosApi('TODOS', { getJson: vi.fn().mockResolvedValue([{ id: 't1' }]) }))
      .rejects.toBeInstanceOf(ErrorRespuestaApi);
  });
});
