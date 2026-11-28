import { describe, expect, it } from 'vitest';
import { interpretarFilasRubrica } from './importarRubrica';

describe('lectura de estructura de rúbricas', () => {
  it('conserva las etapas y distingue ponderación de calificación registrada', () => {
    const { etapas, escalaFinal, esquema, avisos } = interpretarFilasRubrica([
      ['MODALIDAD PROYECTO INTEGRADOR PARTE I'],
      ['REVISIÓN PROYECTO ESCRITO (50%)5 PUNTOS'],
      ['Nombre del estudiante: Persona de prueba'],
      ['A . Presentación (5. puntos)'],
      ['Indicadores', 'Valoración', 'Calificación'],
      ['1. Acentúa la idea', '2,50', '1,25'],
      ['2. Describe las referencias', '2.50', '0.00'],
      ['SUMATORIA', '5.00', '1.25'],
      ['PARTE II'],
      ['SUSTENTACIÓN DEL PROYECTO (50%) 5 PUNTOS'],
      ['B. Defensa (5 puntos)'],
      ['Indicadores', 'Valoración', 'Calificación'],
      ['1. Sustenta la propuesta', '5.00'],
      ['SUMATORIA', '5.00'],
      ['RESUMEN DE LA EVALUACIÓN'],
      ['CALIFICACIÓN FINAL', '10.00', '1.25'],
    ]);
    expect(avisos).toEqual([]);
    expect(escalaFinal).toBe(10);
    expect(esquema.modo).toBe('PORCENTAJES');
    expect(etapas.map(({ alcance, valor, porcentaje }) => ({ alcance, valor, porcentaje }))).toEqual([
      { alcance: 'TRABAJO_COMPARTIDO', valor: '5', porcentaje: '50' },
      { alcance: 'ESTUDIANTE_INDIVIDUAL', valor: '5', porcentaje: '50' },
    ]);
    expect(etapas[0].categorias[0].nombre).toBe('Presentación');
    expect(etapas[0].categorias[0].indicadores.map(({ descripcion, calificacionMaxima }) => [descripcion, calificacionMaxima])).toEqual([
      ['Acentúa la idea', '2.50'], ['Describe las referencias', '2.50'],
    ]);
    expect(etapas[0].categorias[0].codigo).not.toBe(etapas[1].categorias[0].codigo);
  });

  it('une texto envuelto, avisa sobre indicadores sin valoración y deja editable el ámbito desconocido', () => {
    const { etapas, avisos } = interpretarFilasRubrica([
      ['Etapa: Producto (2 puntos)'], ['A. Evidencias'],
      ['Indicadores', 'Puntos máximos'], ['1. Describe el sistema', '1.25'],
      ['con ejemplos prácticos.'], ['2. Justifica las decisiones'], ['TOTAL', '2.00'],
    ]);
    expect(etapas[0].alcance).toBe('');
    expect(etapas[0].categorias[0].indicadores.map(({ descripcion, calificacionMaxima }) => [descripcion, calificacionMaxima])).toEqual([
      ['Describe el sistema con ejemplos prácticos.', '1.25'], ['Justifica las decisiones', ''],
    ]);
    expect(avisos.join(' ')).toMatch(/ámbito/i);
    expect(avisos.join(' ')).toMatch(/ponderación/i);
  });

  it('rechaza un documento sin tablas de indicadores y valoración', () => {
    expect(() => interpretarFilasRubrica([['Acta de calificación'], ['Nota final', '10.00']])).toThrow(/indicadores/i);
  });
});
