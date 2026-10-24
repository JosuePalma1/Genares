import { describe, expect, it, vi } from 'vitest';
import { crearServicioEvaluacionesApi } from './evaluacionesApi';
import { crearClienteHttp, ErrorApiHttp } from './clienteHttp';

const trabajoId = '11000000-0000-4000-8000-000000000001';
const estudianteId = '22000000-0000-4000-8000-000000000001';
const etapaId = '55000000-0000-4000-8000-000000000001';
const evaluacionId = '66000000-0000-4000-8000-000000000001';
const indicadorId = '77000000-0000-4000-8000-000000000001';
const miembroId = '88000000-0000-4000-8000-000000000001';
const trabajoListado = {
  id: trabajoId, codigo: 'T-10', titulo: 'Trabajo de prueba', carrera: 'TI', periodo: '2026-2', modalidad: 'Proyecto integrador',
  estudiantes: [{ id: estudianteId, nombres: 'Ana', apellidos: 'Paz' }],
  miembrosTribunal: [{ idMiembroTribunal: miembroId, posicion: 1, nombres: 'Luis', apellidos: 'Vera' }],
};

function evaluacion({ estado = 'BORRADOR', revision = 1, puntajes = [] } = {}) {
  return {
    id: evaluacionId, idTrabajo: trabajoId, idMiembroTribunal: miembroId, idEstudiante: estudianteId,
    idVersionRubrica: '33000000-0000-4000-8000-000000000001', idEtapaRubrica: etapaId,
    etapa: 'PERSONALIZADA', estado, revision, alcance: 'ESTUDIANTE_INDIVIDUAL',
    etapaRubrica: { id: etapaId, codigo: 'P', nombre: 'PresentaciÃ³n', orden: 1 },
    instantaneaRubrica: {
      rubricVersionId: '33000000-0000-4000-8000-000000000001',
      version: 'V1', stages: [{ id: etapaId, scope: 'ESTUDIANTE_INDIVIDUAL' }],
      categories: [{ id: '99000000-0000-4000-8000-000000000001', stageId: etapaId, nombre: 'Criterio', calificacionMaxima: '10.00', indicators: [{ id: indicadorId, label: 'Indicador', calificacionMaxima: '10.00' }] }],
    },
    calificacionTotal: '0.00', calificacionMaxima: '10.00',
    puntajes, estudiantesTraspasados: [],
  };
}

const consolidacion = {
  tipo: 'CONSOLIDACION_INDIVIDUAL_DINAMICA',
  trabajoId,
  trabajo: { id: trabajoId, codigo: 'T-10', titulo: 'Trabajo de prueba' },
  versionRubrica: { id: '33000000-0000-4000-8000-000000000001' },
  estudiantes: [{
    estudiante: { id: estudianteId, nombres: 'Ana', apellidos: 'Paz', orden: 1 },
    trabajo: { id: trabajoId, codigo: 'T-10', titulo: 'Trabajo de prueba' },
    trabajoId,
    versionRubrica: { id: '33000000-0000-4000-8000-000000000001' },
    estado: 'RESULTADO_COMPLETO',
    etapas: [{
      id: etapaId, orden: 1, nombre: 'Presentación', alcance: 'ESTUDIANTE_INDIVIDUAL',
      calificacionMaxima: '10.00', estado: 'COMPLETA',
      evaluadoresEsperados: [{ idMiembroTribunal: miembroId, posicion: 1 }],
      evaluadoresPendientes: [],
      evaluaciones: [{
        id: evaluacionId, idMiembroTribunal: miembroId, idEstudiante: estudianteId,
        estado: 'CERRADA', calificacionOriginal: '0.00', calificacionUtilizada: '0.00', traspaso: null,
      }],
      promedioEtapa: { exacto: { numerador: '0', denominador: '1', unidad: 'PUNTOS' }, presentado: '0.00' },
    }],
    resultadoFinal: {
      exacto: { numerador: '0', denominador: '1', unidad: 'PUNTOS' },
      calificacion: '0.00', calificacionMaxima: '10.00', redondeo: 'HALF_UP_A_DOS_DECIMALES',
    },
  }],
};

describe('servicio API de evaluaciones', () => {
  it('consulta las rutas de trabajo y consolidados mediante GET y adapta datos decimales sin cambiarlos', async () => {
    const contexto = {
      idMiembroTribunal: miembroId, posicion: 1, puedeCalificar: true,
      miembrosTribunal: [{ idMiembroTribunal: miembroId, posicion: 1, nombres: 'Ana', apellidos: 'Paz' }],
    };
    const getJson = vi.fn()
      .mockResolvedValueOnce({ elementos: [trabajoListado] })
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(consolidacion)
      .mockResolvedValueOnce(contexto);
    const servicio = crearServicioEvaluacionesApi({ getJson });

    await expect(servicio.listarTrabajos()).resolves.toEqual([trabajoListado]);
    await expect(servicio.listarEvaluacionesTrabajo(trabajoId)).resolves.toEqual([]);
    const resultado = await servicio.consolidarTrabajo(trabajoId);
    await expect(servicio.contextoEvaluador(trabajoId)).resolves.toEqual(contexto);

    expect(resultado.estudiantes[0].resultadoFinal.calificacion).toBe('0.00');
    expect(getJson.mock.calls.map(([path]) => path)).toEqual([
      '/trabajos',
      `/evaluaciones/trabajos/${trabajoId}`,
      `/evaluaciones/trabajos/${trabajoId}/consolidados`,
      `/evaluaciones/trabajos/${trabajoId}/contexto-evaluador`,
    ]);
    expect(Object.keys(servicio)).toEqual([
      'listarTrabajos', 'listarEvaluacionesTrabajo', 'consolidarTrabajo', 'contextoEvaluador', 'crearEvaluacion', 'guardarPuntajes', 'cerrarEvaluacion',
    ]);
  });

  it('no consulta si el UUID es inválido y conserva errores de autorización HTTP', async () => {
    const getJson = vi.fn();
    const servicio = crearServicioEvaluacionesApi({ getJson });
    await expect(servicio.listarEvaluacionesTrabajo('trabajo-simulado')).rejects.toThrow('UUID válido');
    expect(getJson).not.toHaveBeenCalled();
    const denegado = new ErrorApiHttp(403);
    const servicioDenegado = crearServicioEvaluacionesApi({ getJson: vi.fn().mockRejectedValue(denegado) });
    await expect(servicioDenegado.consolidarTrabajo(trabajoId)).rejects.toBe(denegado);
  });

  it('en modo prototipo mantiene deshabilitadas las consultas API', async () => {
    const getJson = vi.fn();
    const servicio = crearServicioEvaluacionesApi({ getJson, habilitado: false });
    await expect(servicio.listarEvaluacionesTrabajo(trabajoId)).rejects.toThrow('respuesta inválida');
    await expect(servicio.consolidarTrabajo(trabajoId)).rejects.toThrow('respuesta inválida');
    expect(getJson).not.toHaveBeenCalled();
  });

  it('rechaza respuestas incompletas y estados inconsistentes sin inventar resultados', async () => {
    const servicio = crearServicioEvaluacionesApi({ getJson: vi.fn().mockResolvedValue({ ...consolidacion, estudiantes: [] }) });
    await expect(servicio.consolidarTrabajo(trabajoId)).resolves.toMatchObject({ estudiantes: [] });
    const incompleta = {
      ...consolidacion,
      estudiantes: [{ ...consolidacion.estudiantes[0], estado: 'EN_PROGRESO', resultadoFinal: consolidacion.estudiantes[0].resultadoFinal }],
    };
    const servicioInvalido = crearServicioEvaluacionesApi({ getJson: vi.fn().mockResolvedValue(incompleta) });
    await expect(servicioInvalido.consolidarTrabajo(trabajoId)).rejects.toThrow('respuesta inválida');
  });

  it('usa los contratos POST/PUT reales sin enviar ámbito, nota final ni datos de identidad', async () => {
    const postJson = vi.fn()
      .mockResolvedValueOnce(evaluacion())
      .mockResolvedValueOnce(evaluacion({ estado: 'CERRADA', revision: 3 }));
    const putJson = vi.fn().mockResolvedValueOnce(evaluacion({ revision: 2, puntajes: [{
      idIndicador: indicadorId, label: 'Indicador', puntaje: '0.00', calificacionMaxima: '10.00', observacion: null,
    }] }));
    const servicio = crearServicioEvaluacionesApi({ getJson: vi.fn(), postJson, putJson, escriturasHabilitadas: true });

    await servicio.crearEvaluacion(trabajoId, { idEtapaRubrica: etapaId, idEstudiante: estudianteId });
    await servicio.guardarPuntajes(evaluacionId, { revision: 1, puntajes: [{ idIndicador: indicadorId, puntaje: '0.00' }] });
    const cerrada = await servicio.cerrarEvaluacion(evaluacionId, { revision: 2 });

    expect(postJson.mock.calls).toEqual([
      [`/evaluaciones/trabajos/${trabajoId}`, { idEtapaRubrica: etapaId, idEstudiante: estudianteId }],
      [`/evaluaciones/${evaluacionId}/cierre`, { revision: 2 }],
    ]);
    expect(putJson).toHaveBeenCalledWith(`/evaluaciones/${evaluacionId}/puntajes`, {
      revision: 1, puntajes: [{ idIndicador: indicadorId, puntaje: '0.00' }],
    });
    expect(cerrada.estado).toBe('CERRADA');
  });

  it('acepta UUID canónicos PostgreSQL sin versión RFC en todos los contratos de escritura', async () => {
    const uuidPostgres = '10000000-0000-0000-0000-000000000001';
    const otroUuidPostgres = '20000000-0000-0000-0000-000000000002';
    const postJson = vi.fn().mockResolvedValueOnce(evaluacion()).mockResolvedValueOnce(evaluacion({ estado: 'CERRADA', revision: 3 }));
    const putJson = vi.fn().mockResolvedValueOnce(evaluacion({ revision: 2 }));
    const servicio = crearServicioEvaluacionesApi({ getJson: vi.fn(), postJson, putJson, escriturasHabilitadas: true });

    await servicio.crearEvaluacion(uuidPostgres, {
      idEtapaRubrica: otroUuidPostgres, idEstudiante: uuidPostgres, idMiembroTribunal: otroUuidPostgres,
    });
    await servicio.guardarPuntajes(uuidPostgres, {
      revision: 1, idMiembroTribunal: otroUuidPostgres,
      puntajes: [{ idIndicador: uuidPostgres, puntaje: '4.00' }],
    });
    await servicio.cerrarEvaluacion(uuidPostgres, { revision: 2, idMiembroTribunal: otroUuidPostgres });

    expect(postJson.mock.calls).toEqual([
      [`/evaluaciones/trabajos/${uuidPostgres}`, {
        idEtapaRubrica: otroUuidPostgres, idEstudiante: uuidPostgres, idMiembroTribunal: otroUuidPostgres,
      }],
      [`/evaluaciones/${uuidPostgres}/cierre`, { revision: 2, idMiembroTribunal: otroUuidPostgres }],
    ]);
    expect(putJson).toHaveBeenCalledWith(`/evaluaciones/${uuidPostgres}/puntajes`, {
      revision: 1, puntajes: [{ idIndicador: uuidPostgres, puntaje: '4.00' }], idMiembroTribunal: otroUuidPostgres,
    });
  });

  it('rechaza UUID malformados en recursos e indicadores antes de solicitar al servidor', async () => {
    const postJson = vi.fn();
    const putJson = vi.fn();
    const servicio = crearServicioEvaluacionesApi({ getJson: vi.fn(), postJson, putJson, escriturasHabilitadas: true });

    await expect(servicio.crearEvaluacion('trabajo-simulado', { idEtapaRubrica: etapaId })).rejects.toThrow('UUID válido');
    await expect(servicio.crearEvaluacion(trabajoId, { idEtapaRubrica: 'etapa-invalida' })).rejects.toThrow('UUID válido');
    await expect(servicio.guardarPuntajes(evaluacionId, {
      revision: 1, puntajes: [{ idIndicador: 'indicador-invalido', puntaje: '1.00' }],
    })).rejects.toThrow(/contrato API/);
    await expect(servicio.cerrarEvaluacion('evaluacion-invalida', { revision: 1 })).rejects.toThrow('UUID válido');

    expect(postJson).not.toHaveBeenCalled();
    expect(putJson).not.toHaveBeenCalled();
  });

  it('propaga errores de recurso, autorización y concurrencia de las escrituras', async () => {
    const noEncontrado = new ErrorApiHttp(404);
    const denegado = new ErrorApiHttp(403);
    const conflicto = new ErrorApiHttp(409);
    const postJson = vi.fn().mockRejectedValueOnce(noEncontrado).mockRejectedValueOnce(denegado);
    const putJson = vi.fn().mockRejectedValueOnce(conflicto);
    const servicio = crearServicioEvaluacionesApi({ getJson: vi.fn(), postJson, putJson, escriturasHabilitadas: true });

    await expect(servicio.crearEvaluacion(trabajoId, { idEtapaRubrica: etapaId })).rejects.toBe(noEncontrado);
    await expect(servicio.cerrarEvaluacion(evaluacionId, { revision: 1 })).rejects.toBe(denegado);
    await expect(servicio.guardarPuntajes(evaluacionId, {
      revision: 1, puntajes: [{ idIndicador: indicadorId, puntaje: '1.00' }],
    })).rejects.toBe(conflicto);
  });

  it('bloquea escrituras sin opt-in antes de solicitar al servidor', async () => {
    const postJson = vi.fn();
    const putJson = vi.fn();
    const servicio = crearServicioEvaluacionesApi({ getJson: vi.fn(), postJson, putJson });
    await expect(servicio.crearEvaluacion(trabajoId, { idEtapaRubrica: etapaId })).rejects.toThrow(/escritura.*no est[aá] habilitado/i);
    await expect(servicio.guardarPuntajes(evaluacionId, { revision: 1, puntajes: [{ idIndicador: indicadorId, puntaje: '1.00' }] }))
      .rejects.toThrow(/escritura.*no est[aá] habilitado/i);
    expect(postJson).not.toHaveBeenCalled();
    expect(putJson).not.toHaveBeenCalled();
  });

  it('usa solicitudes HTTP JSON con marca local, sin enviar identidad ni credenciales', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(evaluacion()), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(evaluacion({ revision: 2 })), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(evaluacion({ estado: 'CERRADA', revision: 3 })), { status: 201 }));
    const cliente = crearClienteHttp({ baseUrl: '/api/v1', habilitado: true, escriturasHabilitadas: true, fetcher });
    const servicio = crearServicioEvaluacionesApi({
      getJson: cliente.getJson, postJson: cliente.postJson, putJson: cliente.putJson, escriturasHabilitadas: true,
    });
    await servicio.crearEvaluacion(trabajoId, { idEtapaRubrica: etapaId, idEstudiante: estudianteId });
    await servicio.guardarPuntajes(evaluacionId, { revision: 1, puntajes: [{ idIndicador: indicadorId, puntaje: '1.00' }] });
    await servicio.cerrarEvaluacion(evaluacionId, { revision: 2 });

    expect(fetcher.mock.calls.map(([url, opciones]) => [url, opciones.method])).toEqual([
      [`/api/v1/evaluaciones/trabajos/${trabajoId}`, 'POST'],
      [`/api/v1/evaluaciones/${evaluacionId}/puntajes`, 'PUT'],
      [`/api/v1/evaluaciones/${evaluacionId}/cierre`, 'POST'],
    ]);
    for (const [, opciones] of fetcher.mock.calls) {
      expect(opciones.credentials).toBe('omit');
      expect(opciones.headers['Content-Type']).toBe('application/json');
      expect(opciones.headers['X-Genares-Write-Intent']).toBe('local-development');
      expect(opciones.headers).not.toHaveProperty('Authorization');
      expect(opciones.headers).not.toHaveProperty('x-principal-prueba');
      expect(opciones.headers).not.toHaveProperty('x-capacidades');
    }
  });

  it('rechaza campos decimales inválidos e indicadores duplicados antes de enviar', async () => {
    const putJson = vi.fn();
    const servicio = crearServicioEvaluacionesApi({ getJson: vi.fn(), putJson, escriturasHabilitadas: true });
    await expect(servicio.guardarPuntajes(evaluacionId, { revision: 1, puntajes: [
      { idIndicador: indicadorId, puntaje: '1.001' },
    ] })).rejects.toThrow(/contrato API/);
    await expect(servicio.guardarPuntajes(evaluacionId, { revision: 1, puntajes: [
      { idIndicador: indicadorId, puntaje: '1.00' }, { idIndicador: indicadorId, puntaje: '2.00' },
    ] })).rejects.toThrow(/repetir un indicador/);
    expect(putJson).not.toHaveBeenCalled();
  });
});
