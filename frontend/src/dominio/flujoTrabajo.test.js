import { describe, expect, it } from 'vitest';
import { crearEstadoInicial } from '../datos/datosPrototipo';
import { clasificarFechaSustentacion, derivarEstadoTrabajo, estanCerradasRevisionesEscritas, fechaHoraLocalISO, fechaLocalISO, limitarCalificacion, calificacionMiembro, calificacionEtapa, calificacionFinalEstudiante, formatearFecha, obtenerEtapasRubrica, puedeEvaluarSustentacion, redondearCalificacion, valorCalificacionPresentable } from './flujoTrabajo';

describe('reglas del flujo de evaluación', () => {
  it('impide superar el máximo de un indicador', () => {
    expect(limitarCalificacion(0.7, 0.33)).toBe(0.33);
    expect(limitarCalificacion(-1, 0.33)).toBe(0);
  });

  it('normaliza artefactos de punto flotante antes de mostrarlos en inputs', () => {
    expect(valorCalificacionPresentable(0.1 + 0.2)).toBe(0.3);
    expect(valorCalificacionPresentable('0.33000000000000002')).toBe(0.33);
    expect(valorCalificacionPresentable('')).toBe('');
    expect(redondearCalificacion(0.1 + 0.2)).toBe(0.3);
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

  it('clasifica fechas futuras, de hoy y pasadas sin confundir disponibilidad con ocurrencia', () => {
    const hoy = '2026-10-14';
    expect(clasificarFechaSustentacion('2026-10-15', hoy)).toBe('FUTURA');
    expect(clasificarFechaSustentacion(hoy, hoy)).toBe('HOY');
    expect(clasificarFechaSustentacion('2026-10-13', hoy)).toBe('PASADA');
    expect(clasificarFechaSustentacion(null, hoy)).toBe('SIN_PROGRAMACION');
    expect(puedeEvaluarSustentacion('2026-10-15', hoy)).toBe(false);
    expect(puedeEvaluarSustentacion(hoy, hoy)).toBe(true);
    expect(puedeEvaluarSustentacion('2026-10-13', hoy)).toBe(true);
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

  it('mantiene la evaluación individual completada sin depender de marcas históricas de impresión', () => {
    const estado = crearEstadoInicial();
    const trabajo = estado.trabajos.find((elemento) => elemento.id === 'trabajo-419');
    const evaluacion = estado.evaluaciones.find((elemento) => elemento.id === 'trabajo-419-docente-maria');
    const marcaHistorica = evaluacion.oralPorEstudiante['estudiante-noelia'].printedAt;

    expect(marcaHistorica).toBeTruthy();
    expect(derivarEstadoTrabajo(estado, trabajo)).toBe('Evaluación completada');

    const sinMarcas = {
      ...estado,
      evaluaciones: estado.evaluaciones.map((elemento) => elemento.idTrabajo !== trabajo.id ? elemento : {
        ...elemento,
        oralPorEstudiante: Object.fromEntries(Object.entries(elemento.oralPorEstudiante).map(([id, oral]) => {
          const { printedAt, ...registro } = oral;
          return [id, registro];
        })),
      }),
    };

    expect(derivarEstadoTrabajo(sinMarcas, trabajo)).toBe('Evaluación completada');
    expect(evaluacion.oralPorEstudiante['estudiante-noelia'].printedAt).toBe(marcaHistorica);
  });

  it('transiciona un trabajo grupal a evaluación completada al cerrar todas las orales, sin exigir impresión', () => {
    const estado = crearEstadoInicial();
    const trabajo = estado.trabajos.find((elemento) => elemento.id === 'trabajo-184');
    const trabajoProgramado = { ...trabajo, programacion: { fecha: '2020-01-01', hora: '10:00', sala: 'Sala de prueba' } };
    expect(trabajo.idsEstudiantes).toHaveLength(2);
    expect(derivarEstadoTrabajo(estado, trabajo)).toBe('Revisión escrita pendiente');

    const evaluacionesCompletas = {
      ...estado,
      evaluaciones: estado.evaluaciones.map((elemento) => elemento.idTrabajo !== trabajo.id ? elemento : ({
        ...elemento,
        escrita: { ...elemento.escrita, estado: 'CERRADA' },
        oralPorEstudiante: Object.fromEntries(trabajo.idsEstudiantes.map((idEstudiante) => [idEstudiante, {
          estado: 'CERRADA', calificaciones: {}, observaciones: {}, finalizedAt: '2026-10-01T10:00:00-05:00',
        }])),
      })),
    };

    expect(derivarEstadoTrabajo(evaluacionesCompletas, trabajoProgramado)).toBe('Evaluación completada');
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
