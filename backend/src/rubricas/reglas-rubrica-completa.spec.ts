import { BadRequestException } from '@nestjs/common';
import { AlcanceEtapaRubrica } from '../comun/enums-dominio';
import { EtapaRubricaCompletaDto } from './dto/estructura-rubrica-completa.dto';
import { normalizarEstructuraRubricaCompleta, siguienteEtiquetaVersionRubrica } from './reglas-rubrica-completa';

const indicador = (orden: number, calificacionMaxima: string) => ({
  label: `Indicador ${orden}`,
  descripcion: `Descripci\u00f3n ${orden}`,
  calificacionMaxima,
  orden,
});

const etapa = (codigo: string, orden = 1, valores = ['1.25', '0.75', '3.00', '2.00', '3.00']) => ({
  codigo,
  nombre: `Etapa ${codigo}`,
  alcance: AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL,
  orden,
  categorias: [
    { codigo: 'RES', nombre: 'Resumen', orden: 1, indicadores: valores.slice(0, 2).map((peso, i) => indicador(i + 1, peso)) },
    { codigo: 'DES', nombre: 'Desarrollo', orden: 2, indicadores: valores.slice(2).map((peso, i) => indicador(i + 1, peso)) },
  ],
});

describe('normalizarEstructuraRubricaCompleta', () => {
  it('elige la siguiente etiqueta Vn de acuerdo con el historial de la familia', () => {
    expect(siguienteEtiquetaVersionRubrica(['V1', 'v3', 'versión antigua'])).toBe('V4');
    expect(siguienteEtiquetaVersionRubrica(['9H.7B'])).toBe('V2');
    expect(siguienteEtiquetaVersionRubrica(['V2'])).toBe('V3');
  });

  it.each([AlcanceEtapaRubrica.TRABAJO_COMPARTIDO, AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL])(
    'acepta una etapa %s con categor\u00edas e indicadores variables y suma exacta', (alcance) => {
      const estructura = [{ ...etapa('ETAPA'), alcance }] as EtapaRubricaCompletaDto[];
      const resultado = normalizarEstructuraRubricaCompleta(estructura);
      expect(resultado[0].categorias.map(({ calificacionMaxima }) => calificacionMaxima)).toEqual(['2.00', '8.00']);
    },
  );

  it('valida diez puntos por etapa aunque la r\u00fabrica mezcle sus alcances', () => {
    const estructura = [
      { ...etapa('COMPARTIDA'), alcance: AlcanceEtapaRubrica.TRABAJO_COMPARTIDO },
      { ...etapa('INDIVIDUAL', 2), alcance: AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL },
    ] as EtapaRubricaCompletaDto[];
    expect(normalizarEstructuraRubricaCompleta(estructura)).toHaveLength(2);
  });

  it.each([
    ['9.99', ['1.25', '0.75', '3.00', '2.00', '2.99']],
    ['10.01', ['1.25', '0.75', '3.00', '2.00', '3.01']],
  ])('rechaza una etapa con total %s', (_total, valores) => {
    expect(() => normalizarEstructuraRubricaCompleta([etapa('PRODUCTO', 1, valores)])).toThrow(BadRequestException);
  });

  it('acepta cinco indicadores cuando su suma exacta es diez', () => {
    const unaCategoria = {
      ...etapa('INDICADORES'),
      categorias: [{
        codigo: 'MIX', nombre: 'Mixta', orden: 1,
        indicadores: ['1.25', '0.75', '3.00', '2.00', '3.00'].map((peso, i) => indicador(i + 1, peso)),
      }],
    };
    expect(normalizarEstructuraRubricaCompleta([unaCategoria as EtapaRubricaCompletaDto])[0].categorias[0].calificacionMaxima)
      .toBe('10.00');
  });

  it('rechaza indicadores cero o con m\u00e1s decimales que las columnas actuales', () => {
    expect(() => normalizarEstructuraRubricaCompleta([etapa('CERO', 1, ['0', '2', '3', '2', '3']) as EtapaRubricaCompletaDto]))
      .toThrow(BadRequestException);
    expect(() => normalizarEstructuraRubricaCompleta([etapa('PRECISION', 1, ['1.001', '0.999', '3', '2', '3']) as EtapaRubricaCompletaDto]))
      .toThrow(BadRequestException);
  });

  it('rechaza etapa vac\u00eda, alcance inv\u00e1lido, c\u00f3digos duplicados y \u00f3rdenes repetidos', () => {
    expect(() => normalizarEstructuraRubricaCompleta([])).toThrow(BadRequestException);
    expect(() => normalizarEstructuraRubricaCompleta([
      { ...etapa('ALCANCE'), alcance: 'ALCANCE_INVALIDO' } as unknown as EtapaRubricaCompletaDto,
    ])).toThrow(BadRequestException);
    expect(() => normalizarEstructuraRubricaCompleta([etapa('DUP'), etapa('dup', 2)] as EtapaRubricaCompletaDto[]))
      .toThrow(BadRequestException);
    expect(() => normalizarEstructuraRubricaCompleta([etapa('ORDEN'), etapa('OTRA', 1)] as EtapaRubricaCompletaDto[]))
      .toThrow(BadRequestException);
  });
});
