import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  crearClienteHttp,
  ErrorApiDeshabilitada,
  ErrorApiHttp,
  ErrorConexionApi,
} from './clienteHttp';
import {
  cargarCatalogosRubricasApi,
  cargarCapacidadesRubricasApi,
  cargarRubricasApi,
  actualizarVersionRubricaApi,
  clonarVersionRubricaApi,
  crearRubricaApi,
  crearRubricaCompletaApi,
  crearVersionCompletaRubricaApi,
} from './rubricasApi';

const ids = {
  rubrica: '7926b9ab-a1d2-4a3e-91ce-697fc746f12e',
  version: '22e5d7a9-2c3d-4c72-867b-cde5d0ceeb4e',
  periodo: 'ed405a53-7836-4e48-84f3-9c11150e7e42',
  modalidad: 'b9946db9-05ea-4592-9966-1e53f0d9cb69',
};

const listado = [{
  id: ids.rubrica,
  nombre: 'Rúbrica de prueba',
  descripcion: null,
  modalidad: { id: ids.modalidad, codigo: 'PI', nombre: 'Proyecto integrador' },
  versiones: [{
    id: ids.version,
    version: '1.0',
    revision: 1,
    estado: 'BORRADOR',
    periodo: { id: ids.periodo, codigo: '2026-2' },
    activadaEn: null,
    creadaEn: '2026-08-20T08:00:00.000Z',
    carreras: [],
  }],
}];

const detalle = {
  rubricaId: ids.rubrica,
  versiones: [{
    ...listado[0].versiones[0],
    carreras: [],
    etapas: [
      { id: 'c8d03e56-c2a7-4f39-ae82-56cf5c9a2a50', tipo: 'ESCRITA', alcance: 'TRABAJO_COMPARTIDO', codigo: 'ESC', nombre: 'Revisión escrita', descripcion: null, calificacionMaxima: '5.00', porcentaje: null, orden: 1, categorias: [] },
      { id: 'c40a5e9b-0e9c-4a78-9747-9e4b89ad99f3', tipo: 'ORAL', alcance: 'ESTUDIANTE_INDIVIDUAL', codigo: 'ORA', nombre: 'Sustentación oral', descripcion: null, calificacionMaxima: '5.00', porcentaje: null, orden: 2, categorias: [] },
    ],
  }],
};

afterEach(() => vi.restoreAllMocks());

describe('lectura HTTP de rúbricas', () => {
  it('consulta listado e historial por HTTP GET sin identidad simulada y adapta la respuesta', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(listado), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(detalle), { status: 200 }));

    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true });
    const rows = await cargarRubricasApi({ solicitarJson: cliente.getJson });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: ids.version, idRubrica: ids.rubrica, revision: 1, fuenteDatos: 'api' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/v1/rubricas',
      `/api/v1/rubricas/${ids.rubrica}/versiones`,
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.method).toBe('GET');
      expect(init.credentials).toBe('omit');
      expect(init.headers).toEqual({ Accept: 'application/json' });
      expect(init.headers).not.toHaveProperty('Authorization');
      expect(init.headers).not.toHaveProperty('x-principal-prueba');
    }
  });

  it('propaga la falta de autorización sin pedir detalles ni devolver datos alternativos', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 401 }));
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true });
    await expect(cargarRubricasApi({ solicitarJson: cliente.getJson })).rejects.toMatchObject({ name: ErrorApiHttp.name, status: 401 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('reporta fallos de conexión y no los convierte en un listado vacío', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('offline'));
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true });
    await expect(cargarRubricasApi({ solicitarJson: cliente.getJson })).rejects.toBeInstanceOf(ErrorConexionApi);
  });

  it('rechaza JSON inválido y DTO con estructura incompleta', async () => {
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true });
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('{', { status: 200 }));
    await expect(cargarRubricasApi({ solicitarJson: cliente.getJson })).rejects.toThrow(/información recibida no es válida/i);

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ ...listado[0], versiones: 'mal' }]), { status: 200 }));
    await expect(cargarRubricasApi({ solicitarJson: cliente.getJson })).rejects.toThrow(/contrato esperado/i);
  });

  it('mantiene la API deshabilitada si no se opta por lectura de desarrollo', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: false });
    await expect(cliente.getJson('/rubricas')).rejects.toBeInstanceOf(ErrorApiDeshabilitada);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('contratos HTTP de preparación de escritura', () => {
  it('adapta catálogos activos y conserva UUID de modalidad y período', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      modalidades: [{ id: ids.modalidad, codigo: 'PI', nombre: 'Proyecto integrador' }],
      periodos: [{ id: ids.periodo, codigo: '2026-2' }],
    }), { status: 200 }));
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true });
    await expect(cargarCatalogosRubricasApi({ solicitarJson: cliente.getJson })).resolves.toEqual({
      modalidades: [{ id: ids.modalidad, codigo: 'PI', nombre: 'Proyecto integrador' }],
      periodos: [{ id: ids.periodo, codigo: '2026-2' }],
    });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/rubricas/catalogos');
  });

  it('serializa llamadas de creación y clonación con los endpoints existentes', async () => {
    const solicitud = vi.fn().mockResolvedValue({ id: ids.rubrica });
    await crearRubricaApi({ modalidadId: ids.modalidad, nombre: 'Rúbrica nueva' }, { solicitarJson: solicitud });
    expect(solicitud).toHaveBeenLastCalledWith('/rubricas', { modalidadId: ids.modalidad, nombre: 'Rúbrica nueva' });

    const base = {
      id: ids.version,
      idRubrica: ids.rubrica,
      periodoId: ids.periodo,
      fuenteDatos: 'api',
      estado: 'ACTIVA',
    };
    await clonarVersionRubricaApi({ versionBase: base, version: '2.0' }, { solicitarJson: solicitud });
    expect(solicitud).toHaveBeenLastCalledWith(`/rubricas/${ids.rubrica}/versiones`, {
      periodoId: ids.periodo,
      version: '2.0',
      copiarDesdeVersionId: ids.version,
    });
  });

  it('guarda la estructura completa en una sola petición POST con asociaciones y ámbitos', async () => {
    const solicitarJson = vi.fn().mockResolvedValue({ id: ids.version });
    const etapa = (codigo, alcance) => ({
      codigo, nombre: codigo, alcance,
      categorias: [{ codigo: 'C1', nombre: 'Contenido', indicadores: [
        { label: 'I1', descripcion: 'Introducción', calificacionMaxima: '10.00' },
      ] }],
    });
    await crearRubricaCompletaApi({
      modalidadId: ids.modalidad,
      periodoId: ids.periodo,
      nombre: 'Rúbrica académica',
      version: '1.0',
      etapas: [etapa('E1', 'TRABAJO_COMPARTIDO'), etapa('E2', 'ESTUDIANTE_INDIVIDUAL')],
      carreras: [{ carreraId: ids.rubrica, revision: 4, vigente: true, vigenciaEsperada: { versionId: null } }],
    }, { solicitarJson });
    expect(solicitarJson).toHaveBeenCalledTimes(1);
    expect(solicitarJson).toHaveBeenCalledWith('/rubricas/completas', expect.objectContaining({
      modalidadId: ids.modalidad,
      periodoId: ids.periodo,
      nombre: 'Rúbrica académica',
      etapas: expect.arrayContaining([
        expect.objectContaining({ alcance: 'TRABAJO_COMPARTIDO' }),
        expect.objectContaining({ alcance: 'ESTUDIANTE_INDIVIDUAL' }),
      ]),
      carreras: [{ carreraId: ids.rubrica, revision: 4, vigente: true, vigenciaEsperada: { versionId: null } }],
    }));
  });

  it('usa el endpoint de versión completa y deja el identificador final al servidor', async () => {
    const solicitarJson = vi.fn().mockResolvedValue({ id: ids.version, version: 'V2' });
    const versionBase = {
      id: ids.version, idRubrica: ids.rubrica, fuenteDatos: 'api', revision: 2,
      modalidadId: ids.modalidad, periodoId: ids.periodo, titulo: 'Rúbrica',
      etapas: [{ id: 'c8d03e56-c2a7-4f39-ae82-56cf5c9a2a50', codigo: 'ESC', nombre: 'Escrita', alcance: 'TRABAJO_COMPARTIDO', orden: 1 }],
      categorias: [{ id: '748f7401-0714-430f-a36c-b25d43c9c6df', etapa: 'c8d03e56-c2a7-4f39-ae82-56cf5c9a2a50', codigo: 'C1', nombre: 'Contenido', orden: 1, indicadores: [
        { id: '5a72f971-20f8-4d7b-9f83-7c75cc68e2bc', label: 'I1', descripcion: 'Indicador', maximoDecimal: '10.00', orden: 1 },
      ] }],
    };
    await crearVersionCompletaRubricaApi({
      versionBase,
      periodoId: ids.periodo,
      etapas: [{ codigo: 'ESC', nombre: 'Escrita', alcance: 'TRABAJO_COMPARTIDO', categorias: [{ codigo: 'C1', nombre: 'Contenido', indicadores: [{ label: 'I1', descripcion: 'Indicador', calificacionMaxima: '10.00' }] }] }],
      carreras: [{ carreraId: ids.rubrica, revision: 4, vigente: false, vigenciaEsperada: { versionId: null } }],
    }, { solicitarJson });
    expect(solicitarJson).toHaveBeenCalledWith(`/rubricas/${ids.rubrica}/versiones/completas`, {
      periodoId: ids.periodo,
      copiarDesdeVersionId: ids.version,
      revisionBase: 2,
      carreras: [{ carreraId: ids.rubrica, revision: 4, vigente: false, vigenciaEsperada: { versionId: null } }],
    });
  });
});


describe('escrituras API de versiones borrador', () => {
  it('consulta la capacidad efectiva del servidor y rechaza respuestas con forma invalida', async () => {
    const solicitarJson = vi.fn().mockResolvedValue({ puedeAdministrar: false });
    await expect(cargarCapacidadesRubricasApi({ solicitarJson })).resolves.toEqual({ puedeAdministrar: false });
    expect(solicitarJson).toHaveBeenCalledWith('/rubricas/capacidades', { signal: undefined });
    await expect(cargarCapacidadesRubricasApi({ solicitarJson: vi.fn().mockResolvedValue({ puedeAdministrar: 'true' }) }))
      .rejects.toThrow();
  });

  it('envia actualizacion integral con UUID, revision y decimales de texto', async () => {
    const solicitarJson = vi.fn().mockResolvedValue({ id: ids.version, revision: 8 });
    const etapaId = 'c8d03e56-c2a7-4f39-ae82-56cf5c9a2a50';
    const categoriaId = '748f7401-0714-430f-a36c-b25d43c9c6df';
    const indicadorId = '5a72f971-20f8-4d7b-9f83-7c75cc68e2bc';
    await actualizarVersionRubricaApi({
      id: ids.version, idRubrica: ids.rubrica, fuenteDatos: 'api', estado: 'BORRADOR', revision: 7,
      etapas: [{ id: etapaId, tipo: 'ESCRITA', alcance: 'TRABAJO_COMPARTIDO', codigo: 'ESC', nombre: 'Etapa', descripcion: null, maximoDecimal: '0.30', porcentajeDecimal: null, orden: 1 }],
      categorias: [{ id: categoriaId, etapa: etapaId, codigo: 'A', nombre: 'Categoria', maximoDecimal: '0.30', orden: 1, indicadores: [{ id: indicadorId, label: 'A1', descripcion: 'Indicador', maximoDecimal: '0.30', orden: 1 }] }],
    }, { solicitarJson });
    expect(solicitarJson).toHaveBeenCalledWith(`/versiones-rubrica/${ids.version}`, {
      revision: 7,
      etapas: [{ id: etapaId, tipo: 'ESCRITA', alcance: 'TRABAJO_COMPARTIDO', codigo: 'ESC', nombre: 'Etapa', descripcion: null, calificacionMaxima: '0.30', porcentaje: null, orden: 1, categorias: [{ id: categoriaId, codigo: 'A', nombre: 'Categoria', calificacionMaxima: '0.30', orden: 1, indicadores: [{ id: indicadorId, label: 'A1', descripcion: 'Indicador', calificacionMaxima: '0.30', orden: 1 }] }] }],
    });
  });
});
