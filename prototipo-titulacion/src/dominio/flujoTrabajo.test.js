import { describe, expect, it } from 'vitest';
import { crearEstadoInicial } from '../datos/datosPrototipo';
import { estanCerradasRevisionesEscritas, fechaHoraLocalISO, fechaLocalISO, limitarCalificacion, calificacionMiembro, calificacionEtapa, calificacionFinalEstudiante, formatearFecha, obtenerEtapasRubrica } from './flujoTrabajo';

describe('reglas del flujo de evaluación', () => {
  it('impide superar el máximo de un indicador', () => {
    expect(limitarCalificacion(0.7, 0.33)).toBe(0.33);
    expect(limitarCalificacion(-1, 0.33)).toBe(0);
  });

  it('formatea fechas con valores válidos para Intl.DateTimeFormat', () => {
    expect(() => formatearFecha('2026-10-05')).not.toThrow();
    expect(formatearFecha('2026-10-05')).toMatch(/05.*10.*2026/);
  });

  it('obtiene la fecha local sin convertirla a UTC cerca de medianoche', () => {
    const cercaDeMedianoche = new Date(2026, 9, 7, 0, 5);
    expect(fechaLocalISO(cercaDeMedianoche)).toBe('2026-10-07');
    expect(fechaHoraLocalISO(cercaDeMedianoche)).toBe('2026-10-07T00:05');
  });

  it('normaliza el máximo de etapas antiguas con la propiedad en español', () => {
    const [etapa] = obtenerEtapasRubrica({
      categorias: [{ etapa: 'ESCRITA', maximo: 5 }],
    });

    expect(etapa.maximo).toBe(5);
    expect(etapa).not.toHaveProperty('max');
  });

  it('bloquea la sustentación si falta una revisión escrita', () => {
    const estado = crearEstadoInicial();
    const trabajo = estado.trabajos.find((elemento) => elemento.id === 'trabajo-184');
    expect(estanCerradasRevisionesEscritas(estado, trabajo)).toBe(false);
  });

  it('mantiene la parte escrita en una escala máxima de cinco', () => {
    const estado = crearEstadoInicial();
    const evaluacion = estado.evaluaciones.find((elemento) => elemento.id === 'trabajo-241-docente-maria');
    expect(calificacionEtapa(evaluacion, 'ESCRITA')).toBeLessThanOrEqual(5);
  });

  it('calcula la nota individual sin mezclar estudiantes', () => {
    const estado = crearEstadoInicial();
    const trabajo = estado.trabajos.find((elemento) => elemento.id === 'trabajo-419');
    const evaluacion = estado.evaluaciones.find((elemento) => elemento.id === 'trabajo-419-docente-maria');
    const resultadoMiembro = calificacionMiembro(evaluacion, 'estudiante-noelia');
    expect(resultadoMiembro).toBeGreaterThan(0);
    expect(calificacionMiembro(evaluacion, 'estudiante-andrea')).toBeNull();
    expect(calificacionFinalEstudiante(estado, trabajo, 'estudiante-noelia')).toBeGreaterThan(0);
    expect(calificacionFinalEstudiante(estado, trabajo, 'estudiante-noelia')).toBeLessThanOrEqual(10);
  });

  it('calcula una rúbrica dinámica sin depender de las categorías A a E', () => {
    const evaluacion = {
      instantaneaRubrica: {
        etapas: [
          { id: 'ESCRITA', alcance: 'TRABAJO_COMPARTIDO', orden: 1, maximo: 4 },
          { id: 'ORAL', alcance: 'ESTUDIANTE_INDIVIDUAL', orden: 2, maximo: 6 },
        ],
        categorias: [
          { id: 'X', codigo: 'X', etapa: 'ESCRITA', indicadores: [{ id: 'X1', maximo: 4 }] },
          { id: 'Y', codigo: 'Y', etapa: 'ORAL', indicadores: [{ id: 'Y1', maximo: 6 }] },
        ],
      },
      escrita: { estado: 'CERRADA', calificaciones: { X1: 3.5 } },
      oralPorEstudiante: { estudiante: { estado: 'CERRADA', calificaciones: { Y1: 5.25 } } },
    };

    expect(calificacionEtapa(evaluacion, 'ESCRITA')).toBe(3.5);
    expect(calificacionEtapa(evaluacion, 'ORAL', 'estudiante')).toBe(5.25);
    expect(calificacionMiembro(evaluacion, 'estudiante')).toBe(8.75);
  });
});
