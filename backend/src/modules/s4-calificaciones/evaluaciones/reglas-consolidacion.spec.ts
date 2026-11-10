import {
  promedioRacional,
  racionalDesdeDecimal,
  redondearRacionalHalfUp,
  serializarRacional,
} from './reglas-consolidacion';

describe('aritmética exacta para consolidación académica', () => {
  it.each([
    ['9.389', '9.39'],
    ['9.384', '9.38'],
    ['9.385', '9.39'],
    ['9.999', '10.00'],
    ['8.999', '9.00'],
    ['9.940', '9.94'],
    ['9.025', '9.03'],
  ])('redondea %s a %s con HALF_UP', (entrada, esperado) => {
    expect(redondearRacionalHalfUp(racionalDesdeDecimal(entrada))).toBe(esperado);
  });

  it('promedia cualquier número de etapas sin redondear los promedios de etapa antes del final', () => {
    const promedioDeEtapa = (a: string, b: string) => promedioRacional([
      racionalDesdeDecimal(a), racionalDesdeDecimal(b),
    ])!;
    const etapas = [
      promedioDeEtapa('9.00', '9.01'),
      promedioDeEtapa('9.00', '9.01'),
      racionalDesdeDecimal('9.00'),
    ];
    const finalExacto = promedioRacional(etapas)!;

    expect(serializarRacional(etapas[0])).toEqual({ numerador: '1801', denominador: '200', unidad: 'PUNTOS' });
    expect(serializarRacional(finalExacto)).toEqual({ numerador: '2701', denominador: '300', unidad: 'PUNTOS' });
    expect(redondearRacionalHalfUp(finalExacto)).toBe('9.00');

    const finalConRedondeoIntermedio = promedioRacional(etapas.map((etapa) => (
      racionalDesdeDecimal(redondearRacionalHalfUp(etapa))
    )))!;
    expect(redondearRacionalHalfUp(finalConRedondeoIntermedio)).toBe('9.01');
  });

  it('conserva resultados racionales periódicos hasta la presentación oficial', () => {
    const finalExacto = promedioRacional([
      racionalDesdeDecimal('9.00'),
      racionalDesdeDecimal('8.50'),
      racionalDesdeDecimal('10.00'),
    ])!;
    expect(serializarRacional(finalExacto)).toEqual({ numerador: '55', denominador: '6', unidad: 'PUNTOS' });
    expect(redondearRacionalHalfUp(finalExacto)).toBe('9.17');
  });

  it('calcula los ejemplos de estudiantes sin sumar etapas como puntos acumulados', () => {
    const estudianteA = promedioRacional([
      promedioRacional([racionalDesdeDecimal('9.20'), racionalDesdeDecimal('9.40')])!,
      promedioRacional([racionalDesdeDecimal('8.50'), racionalDesdeDecimal('8.90')])!,
    ])!;
    const estudianteB = promedioRacional([
      promedioRacional([racionalDesdeDecimal('9.20'), racionalDesdeDecimal('9.40')])!,
      promedioRacional([racionalDesdeDecimal('9.10'), racionalDesdeDecimal('9.30')])!,
    ])!;
    expect(redondearRacionalHalfUp(estudianteA)).toBe('9.00');
    expect(redondearRacionalHalfUp(estudianteB)).toBe('9.25');
  });
});
