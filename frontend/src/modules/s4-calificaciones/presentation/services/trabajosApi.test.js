import { describe, expect, it, vi } from 'vitest';
import { ErrorRespuestaApi } from './clienteHttp';
import { crearServicioTrabajosApi } from './trabajosApi';

const idTrabajo = '11000000-0000-4000-8000-000000000001';
const idCarrera = '22000000-0000-4000-8000-000000000001';
const idPeriodo = '33000000-0000-4000-8000-000000000001';
const idModalidad = '44000000-0000-4000-8000-000000000001';
const idVersion = '55000000-0000-4000-8000-000000000001';
const idEstudiante = '66000000-0000-4000-8000-000000000001';
const idTutor = '77000000-0000-4000-8000-000000000001';
const idAsignacionTutor = '88000000-0000-4000-8000-000000000001';
const idMiembroTribunal = '99000000-0000-4000-8000-000000000001';
const idSesion = 'aa000000-0000-4000-8000-000000000001';

const trabajo = {
  id: idTrabajo,
  codigo: 'DEV-TI-001',
  titulo: 'Sistema de prueba',
  estado: 'TRIBUNAL_ASIGNADO',
  idCarrera,
  codigoCarrera: 'TI',
  carrera: 'Tecnologías de la Información',
  idPeriodo,
  periodo: '2026-2',
  idModalidad,
  codigoModalidad: 'PI',
  modalidad: 'Proyecto Integrador',
  idVersionRubrica: idVersion,
  versionRubrica: '10.9B-1',
  estadoVersionRubrica: 'ACTIVA',
  rubrica: 'Rúbrica TI',
  estudiantes: [{ id: idEstudiante, nombres: 'Andrea', apellidos: 'Vera', ordenAutoria: 1 }],
  tutores: [{ idAsignacion: idAsignacionTutor, idDocente: idTutor, nombres: 'Tutor', apellidos: 'Prueba', carrera: 'Tecnologías de la Información', asignadoEn: '2026-01-01T00:00:00.000Z', finalizadoEn: null }],
  estadoTribunal: 'CONFIRMADO',
  tribunalConfirmadoEn: '2026-01-02T00:00:00.000Z',
  miembrosTribunal: [{ idMiembroTribunal, posicion: 1, nombres: 'Jurado', apellidos: 'Uno' }],
  escritasCerradas: 2,
  sesiones: [{
    id: idSesion, fecha: '2026-12-15', inicio: '09:00', fin: '10:00', sala: 'DEV-AULA-101',
    duracionEstimadaMinutos: 60, creadoEn: '2026-11-01T09:00:00.000Z', actualizadoEn: '2026-11-01T09:00:00.000Z',
    inicioRealEn: null, finalizacionRealEn: null, participantes: [idEstudiante], tipo: 'CONJUNTA',
    estado: 'PROGRAMADA', cantidadParticipantes: 1,
  }],
  programacion: null,
};

describe('servicio API de trabajos', () => {
  it('lista y obtiene el detalle usando las rutas PostgreSQL y conserva sus relaciones', async () => {
    const getJson = vi.fn()
      .mockResolvedValueOnce({ elementos: [trabajo] })
      .mockResolvedValueOnce(trabajo);
    const servicio = crearServicioTrabajosApi({ getJson });

    await expect(servicio.listar()).resolves.toEqual([trabajo]);
    await expect(servicio.detalle(idTrabajo)).resolves.toEqual(trabajo);
    expect(getJson.mock.calls.map(([path]) => path)).toEqual(['/trabajos', `/trabajos/${idTrabajo}`]);
  });

  it('pide una página filtrada y valida la paginación del servidor', async () => {
    const pagina = {
      elementos: [trabajo],
      paginacion: { pagina: 2, limite: 25, total: 26, paginas: 2 },
      filtros: { periodo: '2026-2', periodos: [{ codigo: '2026-2', nombre: 'Período 2026-2', activo: true }], estados: ['TRIBUNAL_ASIGNADO'] },
    };
    const getJson = vi.fn().mockResolvedValue(pagina);
    const servicio = crearServicioTrabajosApi({ getJson });

    await expect(servicio.listarPagina({ pagina: 2, limite: 25, periodo: 'TODOS', buscar: '  Lucía Pérez ', tribunal: 'con' }))
      .resolves.toEqual({ trabajos: [trabajo], paginacion: pagina.paginacion, filtros: { ...pagina.filtros, carreras: [], modalidades: [] } });
    expect(getJson.mock.calls[0][0]).toBe('/trabajos?limite=25&pagina=2&periodo=TODOS&buscar=Luc%C3%ADa+P%C3%A9rez&tribunal=con');

    await servicio.listarPagina();
    expect(getJson.mock.calls[1][0]).toBe('/trabajos?limite=25&pagina=1');

    const adaptarLista = vi.fn(() => ['adaptado']);
    await expect(servicio.listarPagina({}, { adaptarLista })).resolves.toMatchObject({ trabajos: ['adaptado'] });
    expect(adaptarLista).toHaveBeenCalledWith({ elementos: [trabajo] });
  });

  it('envía los filtros de RF-13 y adapta los catálogos de carrera y modalidad', async () => {
    const filtros = {
      periodo: 'TODOS', periodos: [], estados: [],
      carreras: [{ codigo: 'TI', nombre: 'Tecnologías de la Información' }], modalidades: [{ codigo: 'PI', nombre: null }],
    };
    const getJson = vi.fn().mockResolvedValue({ elementos: [], paginacion: { pagina: 1, limite: 25, total: 0, paginas: 1 }, filtros });
    const servicio = crearServicioTrabajosApi({ getJson });

    const respuesta = await servicio.listarPagina({ carrera: 'TI', modalidad: 'PI', estudiante: ' Ana ', tema: 'Sistema', tutor: '  ' });

    expect(getJson.mock.calls[0][0]).toBe('/trabajos?limite=25&pagina=1&carrera=TI&modalidad=PI&estudiante=Ana&tema=Sistema');
    expect(respuesta.filtros.carreras).toEqual([{ codigo: 'TI', nombre: 'Tecnologías de la Información' }]);
    expect(respuesta.filtros.modalidades).toEqual([{ codigo: 'PI', nombre: 'PI' }]);
  });

  it('rechaza catálogos de filtros mal formados', async () => {
    const respuesta = { elementos: [], paginacion: { pagina: 1, limite: 25, total: 0, paginas: 1 },
      filtros: { periodo: 'TODOS', periodos: [], estados: [], modalidades: [{ codigo: 7 }] } };
    const servicio = crearServicioTrabajosApi({ getJson: vi.fn().mockResolvedValue(respuesta) });
    await expect(servicio.listarPagina()).rejects.toBeInstanceOf(ErrorRespuestaApi);
  });

  it('vuelve a la última página si la pedida ya no existe', async () => {
    const filtros = { periodo: 'TODOS', periodos: [], estados: [] };
    const getJson = vi.fn()
      .mockResolvedValueOnce({ elementos: [], paginacion: { pagina: 4, limite: 25, total: 30, paginas: 2 }, filtros })
      .mockResolvedValueOnce({ elementos: [trabajo], paginacion: { pagina: 2, limite: 25, total: 30, paginas: 2 }, filtros });
    const servicio = crearServicioTrabajosApi({ getJson });

    await expect(servicio.listarPagina({ pagina: 4, buscar: 'x' })).resolves.toMatchObject({ trabajos: [trabajo], paginacion: { pagina: 2 } });
    expect(getJson.mock.calls.map(([ruta]) => ruta)).toEqual(['/trabajos?limite=25&pagina=4&buscar=x', '/trabajos?limite=25&pagina=2&buscar=x']);
  });

  it('rechaza una página sin paginación o con filtros mal formados', async () => {
    for (const respuesta of [
      { elementos: [trabajo] },
      { elementos: [trabajo], paginacion: { pagina: 0, limite: 25, total: 1, paginas: 1 }, filtros: { periodo: 'TODOS', periodos: [], estados: [] } },
      { elementos: [trabajo], paginacion: { pagina: 1, limite: 25, total: 1, paginas: 1 }, filtros: { periodo: 'TODOS', periodos: [{ codigo: 1 }], estados: [] } },
    ]) {
      const servicio = crearServicioTrabajosApi({ getJson: vi.fn().mockResolvedValue(respuesta) });
      await expect(servicio.listarPagina()).rejects.toBeInstanceOf(ErrorRespuestaApi);
    }
  });

  it('omite trabajos y sesiones con estado de registro 0 y conserva visibles con estado 1', async () => {
    const getJson = vi.fn().mockResolvedValue({ elementos: [
      { ...trabajo, estadoRegistro: 1,
        sesiones: [{ ...trabajo.sesiones[0], estadoRegistro: 0 }],
        programacion: { ...trabajo.programacion, estadoRegistro: 0 } },
      { ...trabajo, id: '11000000-0000-4000-8000-000000000002', estadoRegistro: 0 },
    ] });
    const servicio = crearServicioTrabajosApi({ getJson });

    const respuesta = await servicio.listar();

    expect(respuesta).toHaveLength(1);
    expect(respuesta[0].estadoRegistro).toBe(1);
    expect(respuesta[0].sesiones).toEqual([]);
    expect(respuesta[0].programacion).toBeNull();
  });

  it('rechaza IDs locales antes de enviar una solicitud API', async () => {
    const getJson = vi.fn();
    const servicio = crearServicioTrabajosApi({ getJson });

    await expect(servicio.detalle('trabajo-184')).rejects.toThrow('UUID');
    expect(getJson).not.toHaveBeenCalled();
  });

  it('exige los conteos de evaluaciones cerradas y sesiones que alimentan el expediente', async () => {
    const sinConteo = crearServicioTrabajosApi({ getJson: vi.fn().mockResolvedValue({ elementos: [{ ...trabajo, escritasCerradas: undefined }] }) });
    const sinSesiones = crearServicioTrabajosApi({ getJson: vi.fn().mockResolvedValue({ elementos: [{ ...trabajo, sesiones: undefined }] }) });

    await expect(sinConteo.listar()).rejects.toBeInstanceOf(ErrorRespuestaApi);
    await expect(sinSesiones.listar()).rejects.toBeInstanceOf(ErrorRespuestaApi);
  });

  it('consulta la trazabilidad persistida y valida su cobertura', async () => {
    const respuesta = {
      trabajoId: idTrabajo,
      elementos: [{
        id: 'aa000000-0000-4000-8000-000000000001',
        ocurridoEn: '2026-10-24T10:00:00.000Z',
        tipo: 'EVALUACION_CERRADA',
        actor: { disponible: false },
        origen: 'EVALUACION',
        evidencia: 'DIRECTA',
      }],
      siguienteCursor: null,
      metadatos: { completa: false, nota: 'Historial parcial.' },
    };
    const getJson = vi.fn().mockResolvedValue(respuesta);
    const servicio = crearServicioTrabajosApi({ getJson });

    await expect(servicio.trazabilidad(idTrabajo, { cursor: 'abc' })).resolves.toEqual(respuesta);
    expect(getJson).toHaveBeenCalledWith(`/trabajos/${idTrabajo}/trazabilidad?cursor=abc`, { signal: undefined });

    const servicioInvalido = crearServicioTrabajosApi({ getJson: vi.fn().mockResolvedValue({ ...respuesta, trabajoId: idEstudiante }) });
    await expect(servicioInvalido.trazabilidad(idTrabajo)).rejects.toBeInstanceOf(ErrorRespuestaApi);
  });

  it('no sustituye respuestas inválidas o una fuente desconectada por datos locales', async () => {
    const servicioInvalido = crearServicioTrabajosApi({ getJson: vi.fn().mockResolvedValue({ elementos: [{ ...trabajo, id: 'trabajo-184' }] }) });
    await expect(servicioInvalido.listar()).rejects.toBeInstanceOf(ErrorRespuestaApi);

    const servicioDeshabilitado = crearServicioTrabajosApi({ habilitado: false, getJson: vi.fn() });
    await expect(servicioDeshabilitado.listar()).rejects.toBeInstanceOf(ErrorRespuestaApi);
  });
});
