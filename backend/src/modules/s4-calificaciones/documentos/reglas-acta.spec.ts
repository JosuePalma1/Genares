import { BadRequestException } from '@nestjs/common';
import { centesimasActa, decimalActaDesdeCentesimas, notaAprobada } from './reglas-acta';

describe('Reglas de actas internas', () => {
  it.each([['6.99', false], ['7.00', true], ['8.74', true]] as const)(
    'compara %s con la nota mínima provisional 7.00', (nota, aprobado) => {
      expect(notaAprobada(nota, '7.00')).toBe(aprobado);
    },
  );
  it('representa decimales en centésimas sin Number', () => {
    expect(centesimasActa('7')).toBe(700n);
    expect(decimalActaDesdeCentesimas(874n)).toBe('8.74');
    expect(centesimasActa('10.00')).toBe(1000n);
  });
  it.each(['10.01', '11.00', '-0.01', '7.001', 'abc'])('rechaza nota mínima inválida %s', (nota) => {
    expect(() => centesimasActa(nota, 'La nota mínima')).toThrow(BadRequestException);
  });
});