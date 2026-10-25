import { describe, expect, it } from 'vitest';
import { decimalEvaluacionACentavos, validarFormularioPuntajes } from './puntajesEvaluacionApi';

const indicadores = [
  { id: 'indicador-a', calificacionMaxima: '5.00' },
  { id: 'indicador-b', calificacionMaxima: '5.00' },
];

describe('ediciÃ³n de puntajes desde API', () => {
  it('valida decimales y mÃ¡ximos mediante centavos enteros', () => {
    expect(decimalEvaluacionACentavos('0.00')).toBe(0n);
    expect(decimalEvaluacionACentavos('4.2')).toBe(420n);
    expect(decimalEvaluacionACentavos('5.001')).toBeNull();
    expect(decimalEvaluacionACentavos('-0.01')).toBeNull();
    expect(validarFormularioPuntajes({ indicadores, valores: { 'indicador-a': '5.01' } }).errores['indicador-a'])
      .toBe('No puede superar 5.00.');
  });

  it('acepta cero como entrada y permite guardar un parcial con campos pendientes', () => {
    expect(validarFormularioPuntajes({ indicadores, valores: { 'indicador-a': '0.00', 'indicador-b': '' } }))
      .toMatchObject({ completos: false, puedeGuardar: true, puntajes: [{ idIndicador: 'indicador-a', puntaje: '0.00' }] });
  });

  it('detecta formulario completo y no trata un formato equivalente como cambio', () => {
    const guardados = [
      { idIndicador: 'indicador-a', puntaje: '4.00' },
      { idIndicador: 'indicador-b', puntaje: '5.00' },
    ];
    expect(validarFormularioPuntajes({ indicadores, puntajesGuardados: guardados, valores: { 'indicador-a': '4.0', 'indicador-b': '5' } }))
      .toMatchObject({ completos: true, tieneCambios: false, puedeGuardar: false });
  });

  it('impide eliminar en el cliente un puntaje que el contrato API no puede borrar', () => {
    const estado = validarFormularioPuntajes({
      indicadores,
      puntajesGuardados: [{ idIndicador: 'indicador-a', puntaje: '2.50' }],
      valores: { 'indicador-a': '', 'indicador-b': '1.00' },
    });
    expect(estado.errores['indicador-a']).toMatch(/no se puede borrar/i);
    expect(estado.puedeGuardar).toBe(false);
  });

  it('mantiene los puntajes ingresados aunque otro indicador tenga un error', () => {
    const estado = validarFormularioPuntajes({ indicadores, valores: { 'indicador-a': '2.25', 'indicador-b': '6.00' } });
    expect(estado.puntajes).toEqual([{ idIndicador: 'indicador-a', puntaje: '2.25' }]);
    expect(estado.errores['indicador-b']).toBe('No puede superar 5.00.');
  });
});
