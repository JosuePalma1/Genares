import { describe, expect, it } from 'vitest';
import { adaptarConsolidacionTrabajoApi, adaptarContextoEvaluadorApi, adaptarEvaluacionApi, esUuidPostgres } from './evaluacionesApi';
import { ErrorRespuestaApi } from '../servicios/clienteHttp';

const ids = {
  trabajo: '11000000-0000-4000-8000-000000000001',
  estudianteA: '22000000-0000-4000-8000-000000000001',
  estudianteB: '22000000-0000-4000-8000-000000000002',
  version: '33000000-0000-4000-8000-000000000001',
  miembroUno: '44000000-0000-4000-8000-000000000001',
  miembroDos: '44000000-0000-4000-8000-000000000002',
  escrita: '55000000-0000-4000-8000-000000000001',
  oral: '55000000-0000-4000-8000-000000000002',
  personalizadaUno: '55000000-0000-4000-8000-000000000003',
  personalizadaDos: '55000000-0000-4000-8000-000000000004',
  evaluacion: '66000000-0000-4000-8000-000000000001',
  traspaso: '77000000-0000-4000-8000-000000000001',
};

function etapa(id, orden, alcance, estado = 'COMPLETA', promedio = '9.30', tipo = 'PERSONALIZADA') {
  return {
    id, tipo, codigo: `ETAPA-${orden}`, nombre: `Etapa ${orden}`, orden, alcance,
    calificacionMaxima: '10.00', estado, evaluadoresEsperados: [], evaluadoresPendientes: [],
    evaluaciones: alcance === 'TRABAJO_COMPARTIDO' ? [{
      id: ids.evaluacion, idMiembroTribunal: ids.miembroUno, posicionEvaluador: 1,
      estado: 'CERRADA', calificacionOriginal: '9.30', calificacionUtilizada: '9.30', maximo: '10.00',
      idEstudiante: null, procedencia: 'EVALUACION_COMPARTIDA_TRASPASADA',
      traspaso: { id: ids.traspaso, traspasadoEn: '2026-10-01T12:00:00.000Z' },
    }] : [{
      id: ids.evaluacion, idMiembroTribunal: ids.miembroUno, posicionEvaluador: 1,
      estado: 'CERRADA', calificacionOriginal: '8.70', calificacionUtilizada: '8.70', maximo: '10.00',
      idEstudiante: ids.estudianteA, procedencia: 'EVALUACION_INDIVIDUAL', traspaso: null,
    }],
    promedioEtapa: promedio === null ? null : {
      exacto: { numerador: promedio === '9.30' ? '93' : '0', denominador: '10', unidad: 'PUNTOS' },
      presentado: promedio,
    },
  };
}

function resultado({ estudiante = ids.estudianteA, estado = 'RESULTADO_COMPLETO', calificacion = '9.25', etapas = [] } = {}) {
  return {
    estudiante: { id: estudiante, nombres: estudiante === ids.estudianteA ? 'Ana' : 'Beto', apellidos: 'Paz', orden: 1 },
    trabajo: { id: ids.trabajo, codigo: 'T-10', titulo: 'Trabajo de titulación' },
    trabajoId: ids.trabajo,
    versionRubrica: { id: ids.version, version: '10.4A-1', estado: 'ACTIVA' },
    modo: estado === 'LEGACY_NO_CONSOLIDADA' ? estado : 'CONSOLIDACION_DINAMICA',
    incluyeEvaluacionesLegacy: false,
    evaluacionesLegacyExcluidas: estado === 'LEGACY_NO_CONSOLIDADA' ? 1 : 0,
    cantidadEtapasEsperadas: etapas.length,
    cantidadEvaluadoresEsperados: 2,
    estado,
    etapas,
    resultadoFinal: estado === 'RESULTADO_COMPLETO' ? {
      exacto: { numerador: '37', denominador: '4', unidad: 'PUNTOS' },
      calificacion, calificacionMaxima: '10.00', escala: '0.00-10.00',
      formula: 'PROMEDIO_ARITMETICO_DE_ETAPAS', redondeo: 'HALF_UP_A_DOS_DECIMALES',
    } : null,
  };
}

function consolidado(estudiantes = [resultado({ etapas: [etapa(ids.escrita, 1, 'TRABAJO_COMPARTIDO')] })]) {
  return {
    tipo: 'CONSOLIDACION_INDIVIDUAL_DINAMICA', trabajoId: ids.trabajo,
    trabajo: { id: ids.trabajo, codigo: 'T-10', titulo: 'Trabajo de titulación' },
    versionRubrica: { id: ids.version, version: '10.4A-1' }, estudiantes,
  };
}

describe('adaptadores de evaluaciones y consolidaciones', () => {
  it('acepta UUID can\u00f3nicos de PostgreSQL sin asumir versi\u00f3n RFC y rechaza texto arbitrario', () => {
    expect(esUuidPostgres('10000000-0000-0000-0000-000000000001')).toBe(true);
    expect(esUuidPostgres(ids.trabajo)).toBe(true);
    expect(esUuidPostgres('10000000-0000-0000-0000-00000000000z')).toBe(false);
    expect(esUuidPostgres('evaluacion-1')).toBe(false);
  });

  it('conserva etapas personalizadas con UUID propio, orden y ámbitos combinados', () => {
    const stages = [
      etapa(ids.escrita, 1, 'TRABAJO_COMPARTIDO'),
      etapa(ids.personalizadaUno, 2, 'ESTUDIANTE_INDIVIDUAL'),
      etapa(ids.personalizadaDos, 3, 'TRABAJO_COMPARTIDO'),
    ];
    const api = consolidado([resultado({ etapas: stages })]);
    expect(adaptarConsolidacionTrabajoApi(api).estudiantes[0].etapas.map(({ id, orden, tipo, alcance }) => ({ id, orden, tipo, alcance }))).toEqual([
      { id: ids.escrita, orden: 1, tipo: 'PERSONALIZADA', alcance: 'TRABAJO_COMPARTIDO' },
      { id: ids.personalizadaUno, orden: 2, tipo: 'PERSONALIZADA', alcance: 'ESTUDIANTE_INDIVIDUAL' },
      { id: ids.personalizadaDos, orden: 3, tipo: 'PERSONALIZADA', alcance: 'TRABAJO_COMPARTIDO' },
    ]);
  });

  it('conserva resultados separados por estudiante y valores decimales que devuelve backend', () => {
    const escrita = etapa(ids.escrita, 1, 'TRABAJO_COMPARTIDO');
    escrita.evaluaciones[0].id = '10000000-0000-0000-0000-000000000001';
    const api = consolidado([
      resultado({ etapas: [escrita], calificacion: '9.30' }),
      resultado({ estudiante: ids.estudianteB, etapas: [etapa(ids.escrita, 1, 'TRABAJO_COMPARTIDO')], calificacion: '9.25' }),
    ]);
    const adaptado = adaptarConsolidacionTrabajoApi(api);
    expect(adaptado.estudiantes.map(({ resultadoFinal }) => resultadoFinal.calificacion)).toEqual(['9.30', '9.25']);
    expect(adaptado.estudiantes[0].etapas[0].evaluaciones[0].traspaso.id).toBe(ids.traspaso);
    expect(adaptado.estudiantes[0].etapas[0].evaluaciones[0].id).toBe('10000000-0000-0000-0000-000000000001');
  });

  it.each(['SIN_EVALUACIONES', 'EN_PROGRESO', 'EVALUACIONES_CERRADAS_INCOMPLETAS', 'LEGACY_NO_CONSOLIDADA'])(
    'acepta el estado %s sin resultado definitivo', (estado) => {
      const legacyEtapas = estado === 'LEGACY_NO_CONSOLIDADA' ? [] : [etapa(ids.escrita, 1, 'TRABAJO_COMPARTIDO', 'SIN_EVALUACIONES', null)];
      const api = consolidado([resultado({ estado, etapas: legacyEtapas })]);
      expect(adaptarConsolidacionTrabajoApi(api).estudiantes[0].resultadoFinal).toBeNull();
    },
  );

  it('acepta 0.00 como resultado válido y no lo interpreta como ausencia de evaluación', () => {
    const cero = resultado({ etapas: [etapa(ids.escrita, 1, 'TRABAJO_COMPARTIDO')] });
    cero.resultadoFinal.calificacion = '0.00';
    cero.resultadoFinal.exacto = { numerador: '0', denominador: '1', unidad: 'PUNTOS' };
    expect(adaptarConsolidacionTrabajoApi(consolidado([cero])).estudiantes[0].resultadoFinal.calificacion).toBe('0.00');
  });

  it('rechaza ámbitos inválidos, etapas duplicadas y resultados definitivos incompletos', () => {
    const invalidScope = consolidado([resultado({ etapas: [{ ...etapa(ids.escrita, 1, 'TRABAJO_COMPARTIDO'), alcance: 'ESCRITA' }] })]);
    expect(() => adaptarConsolidacionTrabajoApi(invalidScope)).toThrow(ErrorRespuestaApi);
    const duplicated = consolidado([resultado({ etapas: [etapa(ids.escrita, 1, 'TRABAJO_COMPARTIDO'), etapa(ids.escrita, 2, 'ESTUDIANTE_INDIVIDUAL')] })]);
    expect(() => adaptarConsolidacionTrabajoApi(duplicated)).toThrow(ErrorRespuestaApi);
    const finalIncompleto = consolidado([resultado({ estado: 'EN_PROGRESO', etapas: [] })]);
    finalIncompleto.estudiantes[0].resultadoFinal = { calificacion: '0.00' };
    expect(() => adaptarConsolidacionTrabajoApi(finalIncompleto)).toThrow(ErrorRespuestaApi);
  });

  it('acepta evaluaciones individuales y compartidas con indicadores originales y observaciones autorizadas', () => {
    const evaluacion = {
      id: ids.evaluacion, idTrabajo: ids.trabajo, idMiembroTribunal: ids.miembroUno,
      idEstudiante: null, idVersionRubrica: ids.version, idEtapaRubrica: ids.escrita,
      estado: 'CERRADA', alcance: 'TRABAJO_COMPARTIDO', etapa: 'PERSONALIZADA',
      etapaRubrica: { id: ids.escrita, codigo: 'INF', nombre: 'Informe', orden: 1 },
      instantaneaRubrica: {
        rubricVersionId: ids.version, version: '10.4A-1', stages: [{ id: ids.escrita, scope: 'TRABAJO_COMPARTIDO' }],
        categories: [{ id: '88000000-0000-4000-8000-000000000001', stageId: ids.escrita, nombre: 'Análisis', calificacionMaxima: '10.00', indicators: [{ id: ids.evaluacion, label: 'Indicador', calificacionMaxima: '10.00' }] }],
      },
      calificacionTotal: '0.00', calificacionMaxima: '10.00',
      puntajes: [{ idIndicador: ids.evaluacion, label: 'Indicador', puntaje: '0.00', calificacionMaxima: '10.00', observacion: 'Observación registrada' }],
      estudiantesTraspasados: [{ idEstudiante: ids.estudianteA, traspasadoEn: '2026-10-01T12:00:00.000Z' }],
    };
    expect(adaptarEvaluacionApi(evaluacion).puntajes[0].puntaje).toBe('0.00');
    expect(adaptarEvaluacionApi(evaluacion).estudiantesTraspasados).toHaveLength(1);
  });

  it('adapta una evaluaci\u00f3n cerrada del fixture 10.9B y valida su estructura de r\u00fabrica', () => {
    const evaluacion = {
      id: '10000000-0000-0000-0000-000000000001',
      idTrabajo: ids.trabajo,
      idMiembroTribunal: ids.miembroUno,
      idEstudiante: null,
      idVersionRubrica: ids.version,
      idEtapaRubrica: ids.escrita,
      estado: 'CERRADA',
      revision: 1,
      alcance: 'TRABAJO_COMPARTIDO',
      etapaRubrica: { id: ids.escrita, codigo: 'ESCRITA', nombre: 'Revisi\u00f3n escrita', orden: 1 },
      instantaneaRubrica: {
        rubricVersionId: ids.version,
        version: '10.9B-DEMO',
        stages: [{ id: ids.escrita, scope: 'TRABAJO_COMPARTIDO' }],
        categories: [{
          id: '88000000-0000-4000-8000-000000000001', stageId: ids.escrita,
          nombre: 'Criterio', calificacionMaxima: '5.00',
          indicators: [{ id: '99000000-0000-0000-0000-000000000001', label: 'I1', calificacionMaxima: '5.00' }],
        }],
      },
      calificacionTotal: '4.60',
      calificacionMaxima: '5.00',
      puntajes: [{ idIndicador: '99000000-0000-0000-0000-000000000001', label: 'I1', puntaje: '4.60', calificacionMaxima: '5.00', observacion: null }],
      estudiantesTraspasados: [{ idEstudiante: ids.estudianteA, traspasadoEn: '2026-10-01T12:00:00.000Z' }],
    };

    expect(adaptarEvaluacionApi(evaluacion)).toMatchObject({ id: '10000000-0000-0000-0000-000000000001', estado: 'CERRADA' });
    expect(() => adaptarEvaluacionApi({ ...evaluacion, id: 'registro-1' })).toThrow(ErrorRespuestaApi);
    expect(() => adaptarEvaluacionApi({ ...evaluacion, puntajes: [{ ...evaluacion.puntajes[0], idIndicador: 'indicador-1' }] })).toThrow(ErrorRespuestaApi);
    expect(() => adaptarEvaluacionApi({ ...evaluacion, instantaneaRubrica: { ...evaluacion.instantaneaRubrica, categories: [] } })).toThrow(ErrorRespuestaApi);
    expect(() => adaptarEvaluacionApi({ ...evaluacion, puntajes: [{ ...evaluacion.puntajes[0], idIndicador: ids.evaluacion }] })).toThrow(ErrorRespuestaApi);
  });

  it('conserva evaluaciones legacy sin reinterpretar una instant\u00e1nea hist\u00f3rica incompleta', () => {
    const legacy = {
      id: '10000000-0000-0000-0000-000000000007',
      idTrabajo: ids.trabajo,
      idMiembroTribunal: ids.miembroUno,
      idEstudiante: null,
      idVersionRubrica: ids.version,
      idEtapaRubrica: null,
      estado: 'CERRADA',
      alcance: 'TRABAJO_COMPARTIDO',
      etapaRubrica: { id: null, codigo: 'ESCRITA', nombre: 'Escrita hist\u00f3rica', orden: null },
      instantaneaRubrica: { rubricVersionId: ids.version, fixture: 'LEGACY' },
      calificacionTotal: '8.50',
      calificacionMaxima: '10.00',
      puntajes: [],
      estudiantesTraspasados: [],
    };

    expect(adaptarEvaluacionApi(legacy)).toMatchObject({ estado: 'CERRADA', idEtapaRubrica: null, calificacionTotal: '8.50' });
  });

  it('solo acepta permisos de escritura en el contexto emitido por el backend', () => {
    const contexto = {
      idMiembroTribunal: ids.miembroUno, posicion: 1, puedeCalificar: false,
      miembrosTribunal: [{ idMiembroTribunal: ids.miembroUno, posicion: 1, nombres: 'Ana', apellidos: 'Paz' }],
    };
    expect(adaptarContextoEvaluadorApi(contexto)).toEqual(contexto);
    expect(() => adaptarContextoEvaluadorApi({ ...contexto, idMiembroTribunal: 'miembro-ajeno' })).toThrow(ErrorRespuestaApi);
    expect(() => adaptarContextoEvaluadorApi({ ...contexto, puedeCalificar: 'true' })).toThrow(ErrorRespuestaApi);
  });
});
