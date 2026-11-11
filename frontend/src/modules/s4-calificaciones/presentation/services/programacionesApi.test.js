import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearClienteHttp } from './clienteHttp';
import {
  adaptarProgramacionApi,
  adaptarListadoProgramacionesApi,
  crearQueryProgramacion,
  crearServicioProgramacionesApi,
  adaptarTrabajosDisponiblesApi,
  mapearActualizacionProgramacion,
  mapearCrearProgramacion,
} from './programacionesApi';
import { periodoEfectivoCronograma } from '../pages/PaginaCronograma';

const ids = {
  schedule: '11111111-1111-4111-8111-111111111111',
  work: '22222222-2222-4222-8222-222222222222',
  career: '33333333-3333-4333-8333-333333333333',
  period: '44444444-4444-4444-8444-444444444444',
  student: '55555555-5555-4555-8555-555555555555',
  member: '66666666-6666-4666-8666-666666666666',
};

const programacion = {
  id: ids.schedule,
  idTrabajo: ids.work,
  fechaProgramada: '2026-10-24',
  horaProgramada: '09:30',
  sala: 'Sala 1',
  estado: 'PROGRAMADA',
  duracionEstimadaMinutos: 60,
  inicioRealEn: null,
  finalizacionRealEn: null,
  creadoEn: '2026-10-20T12:00:00.000Z',
  actualizadoEn: '2026-10-20T12:00:00.000Z',
  trabajo: { id: ids.work, codigo: 'TT-001', titulo: 'Proyecto de prueba' },
  carrera: { id: ids.career, codigo: 'SIS', nombre: 'Sistemas' },
  periodo: { id: ids.period, codigo: '2026-2' },
  estudiantes: [{ id: ids.student, nombres: 'Ana', apellidos: 'Pérez' }],
  tribunal: [{ id: ids.member, posicion: 1, nombres: 'Eva', apellidos: 'Gómez' }],
};

const filtros = {
  carreras: [{ id: ids.career, codigo: 'SIS', nombre: 'Sistemas' }],
  periodos: [{ id: ids.period, codigo: '2026-2' }],
};

afterEach(() => vi.restoreAllMocks());

describe('servicio API de cronogramas', () => {
  it('serializa filtros de carrera y período sin fixtures alternativos', async () => {
    expect(crearQueryProgramacion({ carreraId: ids.career, periodoId: ids.period, buscar: 'TT 1' }))
      .toBe(`?carreraId=${ids.career}&periodoId=${ids.period}&buscar=TT+1`);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ elementos: [programacion], filtros }), { status: 200 }));
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true });
    const servicio = crearServicioProgramacionesApi(cliente);

    const respuesta = await servicio.listar({ carreraId: ids.career, periodoId: ids.period });

    expect(respuesta.elementos[0]).toMatchObject({ id: ids.schedule, trabajo: { codigo: 'TT-001' }, estudiantes: [{ nombres: 'Ana' }] });
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/v1/programaciones-sustentacion?carreraId=${ids.career}&periodoId=${ids.period}`);
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit');
  });

  it('crea y actualiza con DTOs explícitos, y toma la respuesta guardada para imprimir', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(programacion), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...programacion, fechaProgramada: '2026-10-25', actualizadoEn: '2026-10-21T09:00:00.000Z' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ generadoEn: '2026-10-21T09:01:00.000Z', filtros, elementos: [{ ...programacion, fechaProgramada: '2026-10-25' }] }), { status: 200 }));
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true, escriturasHabilitadas: true });
    const servicio = crearServicioProgramacionesApi(cliente);

    await servicio.crear({ idTrabajo: ids.work, fechaProgramada: '2026-10-24', horaProgramada: '09:30', sala: ' Sala 1 ' });
    const actualizada = await servicio.actualizar({ id: ids.schedule, fechaProgramada: '2026-10-25', horaProgramada: '09:30', sala: 'Sala 1', motivo: ' Cambio de aula ' });
    const impresion = await servicio.impresion({ estado: 'PROGRAMADA' });

    expect(actualizada.fechaProgramada).toBe('2026-10-25');
    expect(impresion.elementos[0].fechaProgramada).toBe('2026-10-25');
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['/api/v1/programaciones-sustentacion', 'POST'],
      [`/api/v1/programaciones-sustentacion/${ids.schedule}`, 'PUT'],
      ['/api/v1/programaciones-sustentacion/impresion?estado=PROGRAMADA', 'GET'],
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      idTrabajo: ids.work, fechaProgramada: '2026-10-24', horaProgramada: '09:30', sala: 'Sala 1',
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      fechaProgramada: '2026-10-25', horaProgramada: '09:30', sala: 'Sala 1', motivo: 'Cambio de aula',
    });
  });

  it('no envía una reprogramación sin motivo (RN-27)', () => {
    const base = { id: ids.schedule, fechaProgramada: '2026-10-25', horaProgramada: '09:30', sala: 'Sala 1' };
    expect(() => mapearActualizacionProgramacion(base)).toThrow();
    expect(() => mapearActualizacionProgramacion({ ...base, motivo: '   ' })).toThrow();
    expect(() => mapearActualizacionProgramacion({ ...base, motivo: 'x'.repeat(501) })).toThrow();
  });

  it('envía los participantes elegidos para una sesión separada (RN-28)', () => {
    const base = { idTrabajo: ids.work, fechaProgramada: '2026-10-24', horaProgramada: '09:30', sala: 'Sala 1' };
    expect(mapearCrearProgramacion({ ...base, idEstudiantes: [ids.student] })).toMatchObject({ idEstudiantes: [ids.student] });
    expect(mapearCrearProgramacion(base)).not.toHaveProperty('idEstudiantes');
    expect(() => mapearCrearProgramacion({ ...base, idEstudiantes: [] })).toThrow();
    expect(() => mapearCrearProgramacion({ ...base, idEstudiantes: [ids.student, ids.student] })).toThrow();
  });

  it('adapta los estudiantes pendientes de cada trabajo disponible', () => {
    const otro = { id: '55555555-5555-4555-8555-555555555556', nombres: 'Luis', apellidos: 'Mora' };
    const disponible = { ...programacion, idTrabajo: ids.work, estudiantes: [...programacion.estudiantes, otro] };
    const conPendiente = adaptarTrabajosDisponiblesApi({ filtros, elementos: [{ ...disponible, estudiantesPendientes: [otro] }] });
    expect(conPendiente.elementos[0].estudiantesPendientes).toEqual([otro]);
    // Respuesta anterior, sin el dato: todos los estudiantes están pendientes.
    expect(adaptarTrabajosDisponiblesApi({ filtros, elementos: [disponible] }).elementos[0].estudiantesPendientes).toHaveLength(2);
    expect(() => adaptarTrabajosDisponiblesApi({ filtros, elementos: [{ ...disponible, estudiantesPendientes: [{ id: ids.member }] }] })).toThrow();
  });

  it('preserva duraciones personalizadas, estado operativo e inicio/final reales', async () => {
    const enCurso = {
      ...programacion,
      duracionEstimadaMinutos: 90,
      estado: 'EN_SUSTENTACION',
      inicioRealEn: '2026-10-24T14:00:00.000Z',
    };
    const finalizada = {
      ...enCurso,
      estado: 'FINALIZADA',
      finalizacionRealEn: '2026-10-24T15:12:00.000Z',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(enCurso), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(finalizada), { status: 200 }));
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true, escriturasHabilitadas: true });
    const servicio = crearServicioProgramacionesApi(cliente);

    const iniciada = await servicio.cambiarEstado({ id: ids.schedule, estado: 'EN_SUSTENTACION' });
    const terminada = await servicio.cambiarEstado({ id: ids.schedule, estado: 'FINALIZADA' });

    expect(iniciada).toMatchObject({ estado: 'EN_SUSTENTACION', duracionEstimadaMinutos: 90, finalizacionRealEn: null });
    expect(terminada.finalizacionRealEn).toBe('2026-10-24T15:12:00.000Z');
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method, JSON.parse(init.body)])).toEqual([
      [`/api/v1/programaciones-sustentacion/${ids.schedule}/estado`, 'PATCH', { estado: 'EN_SUSTENTACION' }],
      [`/api/v1/programaciones-sustentacion/${ids.schedule}/estado`, 'PATCH', { estado: 'FINALIZADA' }],
    ]);
  });

  it('adapta el estado histórico COMPLETADA al estado operativo FINALIZADA', () => {
    expect(adaptarProgramacionApi({ ...programacion, estado: 'COMPLETADA', duracionEstimadaMinutos: undefined })).toMatchObject({
      estado: 'FINALIZADA', duracionEstimadaMinutos: 60, inicioRealEn: null, finalizacionRealEn: null,
    });
  });

  it('omite una programación archivada de la lista y rechaza estados inválidos', () => {
    expect(adaptarListadoProgramacionesApi({
      elementos: [{ ...programacion, estadoRegistro: 1 }, { ...programacion, id: '11111111-1111-4111-8111-111111111112', estadoRegistro: 0 }],
      filtros,
    }).elementos).toHaveLength(1);
    expect(() => adaptarListadoProgramacionesApi({
      elementos: [{ ...programacion, estadoRegistro: 2 }], filtros,
    })).toThrow(/información recibida no es válida/i);
  });

  it('rechaza respuestas inválidas y mantiene permisos/errores de la API sin convertirlos en datos simulados', () => {
    expect(() => adaptarListadoProgramacionesApi({ elementos: [programacion], filtros: null })).toThrow(/información recibida no es válida/i);
  });

  it('pide una página del cronograma y vuelve a la última si la pedida ya no existe', async () => {
    const pagina = (numero) => ({ elementos: [programacion], filtros, periodoAplicado: ids.period, paginacion: { pagina: numero, limite: 25, total: 30, paginas: 2 } });
    const getJson = vi.fn().mockResolvedValueOnce(pagina(1)).mockResolvedValueOnce(pagina(5)).mockResolvedValueOnce(pagina(2));
    const servicio = crearServicioProgramacionesApi({ getJson });

    await expect(servicio.listarPagina({ estado: 'PROGRAMADA', periodoId: '' })).resolves.toMatchObject({
      periodoAplicado: ids.period, paginacion: { pagina: 1, total: 30 }, elementos: [{ id: ids.schedule }],
    });
    expect(getJson.mock.calls[0][0]).toBe('/programaciones-sustentacion?estado=PROGRAMADA&limite=25&pagina=1');

    await expect(servicio.listarPagina({ periodoId: 'TODOS', pagina: 5 })).resolves.toMatchObject({ paginacion: { pagina: 2 } });
    expect(getJson.mock.calls[2][0]).toBe('/programaciones-sustentacion?periodoId=TODOS&limite=25&pagina=2');
  });

  it('rechaza una página sin paginación válida o con un periodo aplicado inválido', async () => {
    for (const respuesta of [
      { elementos: [], filtros },
      { elementos: [], filtros, periodoAplicado: null, paginacion: { pagina: 0, limite: 25, total: 0, paginas: 1 } },
      { elementos: [], filtros, periodoAplicado: 'DEV-2026B', paginacion: { pagina: 1, limite: 25, total: 0, paginas: 1 } },
    ]) {
      await expect(crearServicioProgramacionesApi({ getJson: vi.fn().mockResolvedValue(respuesta) }).listarPagina()).rejects.toThrow();
    }
  });

  it('usa en impresión y trabajos disponibles el periodo elegido o el aplicado por el listado', () => {
    expect(periodoEfectivoCronograma(null, undefined)).toBe('');
    expect(periodoEfectivoCronograma(null, ids.period)).toBe(ids.period);
    expect(periodoEfectivoCronograma(null, null)).toBe('TODOS');
    expect(periodoEfectivoCronograma('TODOS', ids.period)).toBe('TODOS');
  });
});
