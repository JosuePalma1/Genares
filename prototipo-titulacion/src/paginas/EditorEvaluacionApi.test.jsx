import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorEvaluacionApi, mensajeErrorEscrituraEvaluacion } from './EditorEvaluacionApi';

vi.mock('../servicios/evaluacionesApi', () => ({
  cerrarEvaluacionApi: vi.fn(),
  crearEvaluacionApi: vi.fn(),
  guardarPuntajesEvaluacionApi: vi.fn(),
}));

const ids = {
  trabajo: '11000000-0000-4000-8000-000000000001',
  estudiante: '22000000-0000-4000-8000-000000000001',
  etapa: '33000000-0000-4000-8000-000000000001',
  version: '44000000-0000-4000-8000-000000000001',
  miembro: '55000000-0000-4000-8000-000000000001',
  evaluacion: '66000000-0000-4000-8000-000000000001',
  categoria: '77000000-0000-4000-8000-000000000001',
  indicador: '88000000-0000-4000-8000-000000000001',
};

const consolidacion = (alcance = 'TRABAJO_COMPARTIDO') => ({
  trabajo: { id: ids.trabajo, codigo: 'T-1', titulo: 'Trabajo' },
  estudiantes: [{
    estudiante: { id: ids.estudiante, nombres: 'Ana', apellidos: 'Paz' },
    etapas: [{ id: ids.etapa, orden: 1, nombre: 'Informe técnico', alcance }],
  }],
});

const contexto = {
  idMiembroTribunal: ids.miembro, posicion: 1, puedeCalificar: true,
  miembrosTribunal: [{ idMiembroTribunal: ids.miembro, posicion: 1, nombres: 'Ana', apellidos: 'Paz' }],
};

function evaluacion(estado = 'BORRADOR', alcance = 'TRABAJO_COMPARTIDO') {
  return {
    id: ids.evaluacion, idTrabajo: ids.trabajo, idMiembroTribunal: ids.miembro,
    idEstudiante: alcance === 'TRABAJO_COMPARTIDO' ? null : ids.estudiante,
    idVersionRubrica: ids.version, idEtapaRubrica: ids.etapa, estado, revision: 2,
    etapaRubrica: { id: ids.etapa, nombre: 'Informe técnico' },
    instantaneaRubrica: { categories: [{
      id: ids.categoria, stageId: ids.etapa, nombre: 'Análisis',
      indicators: [{ id: ids.indicador, label: 'Calidad de fuentes', calificacionMaxima: '5.00' }],
    }] },
    puntajes: [],
  };
}

function markup({ puedeCalificar = true, evaluaciones = [], alcance = 'TRABAJO_COMPARTIDO' } = {}) {
  return renderToStaticMarkup(createElement(EditorEvaluacionApi, {
    idTrabajo: ids.trabajo,
    evaluaciones,
    consolidacion: consolidacion(alcance),
    contexto: { ...contexto, puedeCalificar },
    recargar: vi.fn(),
  }));
}

describe('registro API de evaluaciones', () => {
  it('oculta toda acción de escritura para el miembro con permiso de solo lectura', () => {
    const html = markup({ puedeCalificar: false, evaluaciones: [evaluacion()] });
    expect(html).toContain('Su perfil puede consultar esta evaluación');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('<button');
    expect(html).toContain('Calidad de fuentes');
  });

  it('muestra alta idempotente y rotula la etapa compartida como evaluación del trabajo', () => {
    const html = markup();
    expect(html).toContain('Crear o continuar evaluación');
    expect(html).toContain('Informe técnico');
    expect(html).toContain('Evaluación del trabajo');
    expect(html).not.toContain('evaluacion-api-estudiante');
  });

  it('muestra selección de estudiante para una etapa individual autorizada', () => {
    const html = markup({ alcance: 'ESTUDIANTE_INDIVIDUAL' });
    expect(html).toContain('evaluacion-api-estudiante');
    expect(html).toContain('Ana Paz');
    expect(html).toContain('Crear o continuar evaluación');
  });

  it('mantiene cerrada una evaluación de solo lectura y no muestra controles de edición', () => {
    const html = markup({ evaluaciones: [evaluacion('CERRADA')] });
    expect(html).toContain('Cerrada');
    expect(html).toContain('no admite cambios');
    expect(html).toContain(`/rubrica/${ids.trabajo}/${ids.estudiante}/${ids.miembro}`);
    expect(html).not.toContain('puntaje-');
    expect(html).not.toContain('Cerrar evaluación</button>');
  });

  it('traduce autorización, acceso, conflicto y conexión sin ocultar cambios locales', () => {
    expect(mensajeErrorEscrituraEvaluacion({ status: 403 })).toMatch(/perfil no tiene permiso/i);
    expect(mensajeErrorEscrituraEvaluacion({ status: 404 })).toMatch(/solicitada para este trabajo/i);
    expect(mensajeErrorEscrituraEvaluacion({ status: 409 })).toMatch(/entradas se conservaron/i);
    expect(mensajeErrorEscrituraEvaluacion({ name: 'ErrorConexionApi' })).toMatch(/permanecen en el formulario/i);
  });
});
