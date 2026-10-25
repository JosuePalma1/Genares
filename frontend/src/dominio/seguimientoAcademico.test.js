import { describe, expect, it } from 'vitest';
import {
  etiquetaEstadoResultado,
  etiquetaEstadoTrabajo,
  filtrarTrabajosApi,
  obtenerResultadoEstudiante,
  resultadosCompletos,
} from './seguimientoAcademico';

const trabajos = [
  {
    id: 'ti-1', codigo: 'TI-001', titulo: 'Sistema de laboratorio', codigoCarrera: 'TI', carrera: 'Tecnologías de la Información',
    periodo: '2026-2', modalidad: 'Proyecto Integrador', estado: 'EVALUACION_COMPLETADA',
    estudiantes: [{ nombres: 'Andrea', apellidos: 'Mendoza' }, { nombres: 'Mateo', apellidos: 'Alcívar' }],
    tutores: [{ nombres: 'Ana', apellidos: 'Pérez' }],
  },
  {
    id: 'soft-1', codigo: 'SOFT-001', titulo: 'Aplicación móvil', codigoCarrera: 'SOFT', carrera: 'Ingeniería en Software',
    periodo: '2026-1', modalidad: 'Proyecto Integrador', estado: 'REGISTRADO', estudiantes: [], tutores: [],
  },
];

describe('seguimiento académico API', () => {
  it('filtra expedientes por carrera, estado, período y nombres de participantes', () => {
    expect(filtrarTrabajosApi(trabajos, { carrera: 'TI' })).toEqual([trabajos[0]]);
    expect(filtrarTrabajosApi(trabajos, { estado: 'REGISTRADO' })).toEqual([trabajos[1]]);
    expect(filtrarTrabajosApi(trabajos, { periodo: '2026-1' })).toEqual([trabajos[1]]);
    expect(filtrarTrabajosApi(trabajos, { texto: 'mateo alcívar' })).toEqual([trabajos[0]]);
    expect(filtrarTrabajosApi(trabajos, { texto: 'sistema de laboratorio' })).toEqual([trabajos[0]]);
  });

  it('usa las etiquetas del contrato API y conserva estados de resultado incompleto', () => {
    expect(etiquetaEstadoTrabajo('TRIBUNAL_ASIGNADO')).toBe('Tribunal asignado');
    expect(etiquetaEstadoResultado('EVALUACIONES_CERRADAS_INCOMPLETAS')).toBe('Evaluaciones cerradas, consolidación incompleta');
    expect(etiquetaEstadoResultado('LEGACY_NO_CONSOLIDADA')).toBe('Histórico sin consolidación dinámica');
  });

  it('consume la calificación oficial devuelta y no deriva una nota para resultados incompletos', () => {
    const porTrabajo = { 'ti-1': { datos: { estudiantes: [
      { estudiante: { id: 'a' }, estado: 'RESULTADO_COMPLETO', resultadoFinal: { calificacion: '9.25' } },
      { estudiante: { id: 'b' }, estado: 'EVALUACIONES_CERRADAS_INCOMPLETAS', resultadoFinal: null },
    ] } } };
    expect(obtenerResultadoEstudiante(porTrabajo, 'ti-1', 'a').resultadoFinal.calificacion).toBe('9.25');
    expect(obtenerResultadoEstudiante(porTrabajo, 'ti-1', 'b').resultadoFinal).toBeNull();
    expect(resultadosCompletos([porTrabajo['ti-1'].datos])).toEqual(['9.25']);
  });
});
