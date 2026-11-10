import { describe, expect, it } from 'vitest';
import { construirPuntajesOrales, validarPuntajesOrales } from './evaluacionesMerDev';

const indicadores = [{ id: 'a', calificacionMaxima: '10' }];
describe('Formulario oral MER unificado', () => {
  it('no confunde puntaje vacío con cero', () => {
    expect(construirPuntajesOrales(indicadores, { a: { score: '' } })[0].score).toBeNull();
    expect(construirPuntajesOrales(indicadores, { a: { score: '0' } })[0].score).toBe(0);
  });
  it('valida los límites definidos en el servidor', () => {
    expect(() => validarPuntajesOrales(indicadores, [{ score: 10.1 }])).toThrow(/puntaje/);
    expect(() => validarPuntajesOrales(indicadores, [{ score: 9.5 }])).not.toThrow();
  });
});
