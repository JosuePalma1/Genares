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

  it('rechaza IDs locales antes de enviar una solicitud API', async () => {
    const getJson = vi.fn();
    const servicio = crearServicioTrabajosApi({ getJson });

    await expect(servicio.detalle('trabajo-184')).rejects.toThrow('UUID');
    expect(getJson).not.toHaveBeenCalled();
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
