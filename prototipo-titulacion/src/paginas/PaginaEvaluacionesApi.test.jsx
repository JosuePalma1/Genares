import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Router } from 'react-router-dom';
import { ErrorConexionApi } from '../servicios/clienteHttp';
import {
  EstadoConsultaEvaluacionesApi,
  PanelEvaluacionesTrabajoApi,
  PanelResultadoIndividualApi,
  mensajeSeguroEvaluaciones,
} from './PaginaEvaluacionesApi';

const ids = {
  job: '11000000-0000-4000-8000-000000000001',
  studentA: '22000000-0000-4000-8000-000000000001',
  studentB: '22000000-0000-4000-8000-000000000002',
  stageA: '33000000-0000-4000-8000-000000000001',
  stageB: '33000000-0000-4000-8000-000000000002',
  stageC: '33000000-0000-4000-8000-000000000003',
  member: '44000000-0000-4000-8000-000000000001',
  transfer: '55000000-0000-4000-8000-000000000001',
  evalShared: '66000000-0000-4000-8000-000000000001',
  evalOralA: '66000000-0000-4000-8000-000000000002',
  evalOralB: '66000000-0000-4000-8000-000000000003',
};

function consolidatedStage(id, order, scope, state = 'COMPLETA', presented = '9.30') {
  return {
    id, tipo: 'PERSONALIZADA', codigo: `P-${order}`, nombre: `Etapa personalizada ${order}`,
    orden: order, alcance: scope, calificacionMaxima: '10.00', estado: state,
    evaluadoresEsperados: [{ idMiembroTribunal: ids.member, posicion: 1 }],
    evaluadoresPendientes: state === 'EN_PROGRESO' ? [{ idMiembroTribunal: ids.member, posicion: 1, causa: 'EVALUACION_NO_CERRADA' }] : [],
    evaluaciones: scope === 'TRABAJO_COMPARTIDO' ? [{
      id: ids.evalShared, idMiembroTribunal: ids.member, posicionEvaluador: 1,
      estado: 'CERRADA', calificacionOriginal: '9.30', calificacionUtilizada: '9.30', maximo: '10.00',
      idEstudiante: null, procedencia: 'EVALUACION_COMPARTIDA_TRASPASADA',
      traspaso: { id: ids.transfer, traspasadoEn: '2026-10-01T12:00:00.000Z' },
    }] : [],
    promedioEtapa: state === 'COMPLETA' ? {
      exacto: { numerador: '93', denominador: '10', unidad: 'PUNTOS' }, presented,
    } : null,
  };
}

function evalDetail(id, stage, student, score) {
  const shared = stage === ids.stageA;
  return {
    id, idTrabajo: ids.job, idMiembroTribunal: ids.member,
    idEstudiante: shared ? null : student, idVersionRubrica: '77000000-0000-4000-8000-000000000001',
    idEtapaRubrica: stage, etapa: 'PERSONALIZADA', estado: 'CERRADA', alcance: shared ? 'TRABAJO_COMPARTIDO' : 'ESTUDIANTE_INDIVIDUAL',
    etapaRubrica: { id: stage, codigo: `P-${shared ? 1 : 2}`, nombre: shared ? 'Documento compartido' : 'Exposición', orden: shared ? 1 : 2 },
    calificacionTotal: score, calificacionMaxima: '10.00',
    instantaneaRubrica: {
      version: 'V10', stages: [{ id: stage, scope: shared ? 'TRABAJO_COMPARTIDO' : 'ESTUDIANTE_INDIVIDUAL' }],
      categories: [{
        id: '88000000-0000-4000-8000-000000000001', stageId: stage, nombre: 'Análisis', calificacionMaxima: '10.00',
        indicators: [{ id: '99000000-0000-4000-8000-000000000001', label: 'Argumentación', calificacionMaxima: '10.00' }],
      }],
    },
    puntajes: [{ idIndicador: '99000000-0000-4000-8000-000000000001', label: 'Argumentación', puntaje: score, calificacionMaxima: '10.00', observacion: 'Observación autorizada' }],
    estudiantesTraspasados: shared ? [{ idEstudiante: ids.studentA }, { idEstudiante: ids.studentB }] : [],
  };
}

function workConsolidation({ state = 'RESULTADO_COMPLETO', final = '9.25', withStages = true } = {}) {
  const stagesA = withStages ? [
    consolidatedStage(ids.stageA, 1, 'TRABAJO_COMPARTIDO'),
    consolidatedStage(ids.stageB, 2, 'ESTUDIANTE_INDIVIDUAL'),
    consolidatedStage(ids.stageC, 3, 'TRABAJO_COMPARTIDO'),
  ] : [];
  const makeStudent = (id, name, result) => ({
    estudiante: { id, nombres: name, apellidos: 'Paz', orden: id === ids.studentA ? 1 : 2 },
    trabajo: { id: ids.job, codigo: 'T-1', titulo: 'Investigación aplicada' }, trabajoId: ids.job,
    versionRubrica: { id: '77000000-0000-4000-8000-000000000001', version: 'V10' },
    estado: state, etapas: stagesA,
    resultadoFinal: state === 'RESULTADO_COMPLETO' ? {
      exacto: { numerador: '37', denominador: '4', unidad: 'PUNTOS' },
      calificacion: result, calificacionMaxima: '10.00', redondeo: 'HALF_UP_A_DOS_DECIMALES',
    } : null,
  });
  return {
    tipo: 'CONSOLIDACION_INDIVIDUAL_DINAMICA', trabajoId: ids.job,
    trabajo: { id: ids.job, codigo: 'T-1', titulo: 'Investigación aplicada' },
    versionRubrica: { id: '77000000-0000-4000-8000-000000000001', version: 'V10' },
    estudiantes: [makeStudent(ids.studentA, 'Ana', final), makeStudent(ids.studentB, 'Luis', '9.00')],
  };
}

function html(elemento) {
  const navigator = {
    createHref: (to) => typeof to === 'string' ? to : `${to.pathname ?? ''}${to.search ?? ''}${to.hash ?? ''}`,
    encodeLocation: (location) => location,
    go: vi.fn(), push: vi.fn(), replace: vi.fn(), listen: () => () => {},
  };
  return renderToStaticMarkup(createElement(Router, {
    location: { pathname: '/', search: '', hash: '', state: null, key: 'test' }, navigator,
  }, elemento));
}

describe('presentación de consulta API de evaluaciones', () => {
  it('muestra varias etapas por ID y orden, sin confundir tipo PERSONALIZADA con identidad de etapa', () => {
    const consolidacion = workConsolidation();
    const evaluaciones = [
      evalDetail(ids.evalShared, ids.stageA, null, '9.30'),
      evalDetail(ids.evalOralA, ids.stageB, ids.studentA, '8.70'),
      evalDetail(ids.evalOralB, ids.stageB, ids.studentB, '9.00'),
    ];
    const markup = html(createElement(PanelEvaluacionesTrabajoApi, { evaluaciones, consolidacion }));
    expect(markup.indexOf('Etapa personalizada 1')).toBeLessThan(markup.indexOf('Etapa personalizada 2'));
    expect(markup.indexOf('Etapa personalizada 2')).toBeLessThan(markup.indexOf('Etapa personalizada 3'));
    expect(markup).toContain('ESTUDIANTE_INDIVIDUAL');
    expect(markup).toContain('TRABAJO_COMPARTIDO');
    expect(markup).toContain('Observación autorizada');
  });

  it('representa una evaluación compartida una vez y consulta los traspasos del servidor', () => {
    const markup = html(createElement(PanelEvaluacionesTrabajoApi, {
      evaluaciones: [evalDetail(ids.evalShared, ids.stageA, null, '9.30')],
      consolidacion: workConsolidation(),
    }));
    expect(markup.match(/Evaluación compartida del trabajo/g)).toHaveLength(1);
    expect(markup).toContain('Esta evaluación original no se duplica');
    expect(markup).toContain(ids.studentA);
    expect(markup).toContain(ids.studentB);
  });

  it('separa las evaluaciones individuales de estudiantes distintos', () => {
    const markup = html(createElement(PanelEvaluacionesTrabajoApi, {
      evaluaciones: [
        evalDetail(ids.evalOralA, ids.stageB, ids.studentA, '8.70'),
        evalDetail(ids.evalOralB, ids.stageB, ids.studentB, '9.00'),
      ],
      consolidacion: workConsolidation(),
    }));
    expect(markup).toContain(`Estudiante · ${ids.studentA}`);
    expect(markup).toContain(`Estudiante · ${ids.studentB}`);
    expect(markup).toContain('8.70');
    expect(markup).toContain('9.00');
  });

  it('muestra el resultado cero válido como 0.00 sin derivarlo en React', () => {
    const consolidacion = workConsolidation({ final: '0.00', withStages: false });
    const resultado = {
      ...consolidacion.estudiantes[0],
      resultadoFinal: { calificacion: '0.00', calificacionMaxima: '10.00' },
      cantidadEtapasEsperadas: 1, cantidadEvaluadoresEsperados: 2, etapas: [],
    };
    const markup = html(createElement(PanelResultadoIndividualApi, { resultado }));
    expect(markup).toContain('0.00');
    expect(markup).toContain('Resultado consultivo');
    expect(markup).toContain('ni crea una nota oficial');
    expect(markup).not.toContain('Aprobado');
  });

  it('ofrece la rúbrica PDF API de cada miembro esperado para el estudiante', () => {
    const consolidacion = workConsolidation();
    const resultado = consolidacion.estudiantes[0];
    const markup = html(createElement(PanelResultadoIndividualApi, { resultado }));
    expect(markup).toContain(`/rubrica/${ids.job}/${ids.studentA}/${ids.member}`);
    expect(markup).toContain('Ver rúbrica PDF');
  });

  it.each(['SIN_EVALUACIONES', 'EN_PROGRESO', 'EVALUACIONES_CERRADAS_INCOMPLETAS', 'LEGACY_NO_CONSOLIDADA'])(
    'no muestra una nota final para %s y explica el estado', (estado) => {
      const trabajo = workConsolidation({ state: estado, withStages: false });
      const resultado = { ...trabajo.estudiantes[0], cantidadEtapasEsperadas: 3, cantidadEvaluadoresEsperados: 2, etapas: [] };
      const markup = html(createElement(PanelResultadoIndividualApi, { resultado }));
      expect(markup).toContain('No disponible');
      expect(markup).not.toContain('>0.00<');
      if (estado === 'LEGACY_NO_CONSOLIDADA') expect(markup).toContain('Evaluación histórica');
      if (estado === 'EN_PROGRESO') expect(markup).toContain('Evaluaciones en progreso');
      if (estado === 'EVALUACIONES_CERRADAS_INCOMPLETAS') expect(markup).toContain('Faltan evaluaciones obligatorias');
    },
  );

  it('muestra un único error recuperable sin usar el estado vacío cuando falla la API', () => {
    expect(mensajeSeguroEvaluaciones({ status: 403 })).toBe(mensajeSeguroEvaluaciones({ status: 404 }));
    expect(mensajeSeguroEvaluaciones({ status: 404 })).not.toContain('No existe');
    const cargando = html(createElement(EstadoConsultaEvaluacionesApi, { estado: 'cargando' }));
    expect(cargando).toContain('Consultando al servidor');
    const desconectado = html(createElement(EstadoConsultaEvaluacionesApi, { estado: 'error', error: new ErrorConexionApi(), alReintentar: vi.fn() }));
    expect(desconectado.match(/role="alert"/g)).toHaveLength(1);
    expect(desconectado).toContain('No se pudo consultar la API de evaluaciones');
    expect(desconectado).toContain('Confirme que NestJS esté activo');
    expect(desconectado).toContain('Reintentar');
    expect(desconectado).not.toContain('empty-estado');

    const denegado = html(createElement(EstadoConsultaEvaluacionesApi, { estado: 'error', error: { status: 404 }, alReintentar: vi.fn() }));
    expect(denegado).toContain('No se pudo consultar este trabajo');
    expect(denegado).not.toContain('empty-estado');
  });
});
