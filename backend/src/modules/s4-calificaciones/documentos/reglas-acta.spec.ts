import { BadRequestException } from '@nestjs/common';
import { centesimasActa, decimalActaDesdeCentesimas, notaAprobada, notaMinimaEnEscala } from './reglas-acta';

describe('Reglas de actas internas', () => {
  it.each([['6.99', false], ['7.00', true], ['8.74', true]] as const)(
    'compara %s con la nota mínima provisional 7.00', (nota, aprobado) => {
      expect(notaAprobada(nota, '7.00')).toBe(aprobado);
    },
  );
  it.each([[10, '7.00', '6.99'], [20, '14.00', '13.99'], [100, '70.00', '69.99']])(
    'aplica el mínimo de 70 %% a la nota publicada sobre %i', (escala, minimo, inferior) => {
      expect(notaMinimaEnEscala('70.00', escala)).toBe(minimo);
      expect(notaAprobada(minimo, minimo, escala)).toBe(true);
      expect(notaAprobada(inferior, minimo, escala)).toBe(false);
    },
  );
  it('conserva el umbral exacto si cae entre dos notas publicables', () => {
    expect(notaMinimaEnEscala('70.01', 10)).toBe('7.01');
  });
  it('representa decimales en centésimas sin Number', () => {
    expect(centesimasActa('7')).toBe(700n);
    expect(decimalActaDesdeCentesimas(874n)).toBe('8.74');
    expect(centesimasActa('10.00')).toBe(1000n);
  });
  it.each(['10.01', '11.00', '-0.01', '7.001', 'abc'])('rechaza nota mínima inválida %s', (nota) => {
    expect(() => centesimasActa(nota, 'La nota mínima')).toThrow(BadRequestException);
  });
});