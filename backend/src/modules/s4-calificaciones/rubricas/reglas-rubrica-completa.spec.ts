import { BadRequestException } from '@nestjs/common';
import { AlcanceEtapaRubrica, EtapaEvaluacion } from '../../../common/domain/enums-dominio';
import { EtapaRubricaCompletaDto } from './dto/estructura-rubrica-completa.dto';
import {
  normalizarEstructuraRubricaCompleta, ordenesCategoriaEnVersion, siguienteEtiquetaVersionRubrica, tipoEtapaDesdeAlcance,
} from './reglas-rubrica-completa';
import { validarEstructuraActivableRubrica } from './reglas-borrador-rubrica';

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
    { codigo: `RES${orden}`, nombre: 'Resumen', orden: 1, indicadores: valores.slice(0, 2).map((peso, i) => indicador(i + 1, peso)) },
    { codigo: `DES${orden}`, nombre: 'Desarrollo', orden: 2, indicadores: valores.slice(2).map((peso, i) => indicador(i + 1, peso)) },
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

  it('admite dos etapas de 10 con porcentajes 50 y 50 aunque mezclen sus alcances', () => {
    const estructura = [
      { ...etapa('COMPARTIDA'), alcance: AlcanceEtapaRubrica.TRABAJO_COMPARTIDO, porcentaje: '50' },
      { ...etapa('INDIVIDUAL', 2), alcance: AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL, porcentaje: '50.00' },
    ] as EtapaRubricaCompletaDto[];
    expect(normalizarEstructuraRubricaCompleta(estructura).map(({ porcentaje }) => porcentaje)).toEqual(['50.00', '50.00']);
  });

  describe('esquema de calificaci\u00f3n', () => {
    const dos = (porcentajes: Array<string | undefined>, valores = ['1.25', '0.75', '3.00', '2.00', '3.00']) => [
      { ...etapa('ESCRITA', 1, valores), alcance: AlcanceEtapaRubrica.TRABAJO_COMPARTIDO, porcentaje: porcentajes[0] },
      { ...etapa('ORAL', 2, valores), alcance: AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL, porcentaje: porcentajes[1] },
    ] as EtapaRubricaCompletaDto[];

    it('\u00absumar puntos\u00bb: sin porcentajes, las etapas deben sumar 10.00', () => {
      expect(() => normalizarEstructuraRubricaCompleta(dos([undefined, undefined])))
        .toThrow('Sin porcentajes, las etapas se suman y deben dar la nota final 10.00 (suman 20.00).');
    });

    it('\u00abporcentajes\u00bb: van en todas las etapas o en ninguna', () => {
      expect(() => normalizarEstructuraRubricaCompleta(dos(['50', undefined]))).toThrow('Indique el porcentaje de todas las etapas o de ninguna.');
    });

    it('\u00abporcentajes\u00bb: deben sumar 100', () => {
      expect(() => normalizarEstructuraRubricaCompleta(dos(['40', '50']))).toThrow('Los porcentajes de las etapas deben sumar 100 (suman 90.00).');
      expect(normalizarEstructuraRubricaCompleta(dos(['30', '70'])).map(({ porcentaje }) => porcentaje)).toEqual(['30.00', '70.00']);
    });
  });

  // Escalas configurables (aprobado el 16/11/2026): cada etapa vale lo que suman sus indicadores.
  it.each([
    ['5.00', ['0.33', '0.67', '1.00', '1.00', '2.00']],
    ['9.99', ['1.25', '0.75', '3.00', '2.00', '2.99']],
    ['10.00', ['1.25', '0.75', '3.00', '2.00', '3.00']],
    ['20.00', ['2.50', '1.50', '6.00', '4.00', '6.00']],
  ])('con porcentaje, acepta una etapa que vale %s y guarda ese máximo', (total, valores) => {
    const unica = { ...etapa('PRODUCTO', 1, valores), porcentaje: '100' };
    expect(normalizarEstructuraRubricaCompleta([unica as EtapaRubricaCompletaDto])[0].calificacionMaxima).toBe(total);
  });

  it('acepta la rúbrica oficial 5 + 5 con sus categorías A–E', () => {
    const parte = (codigo: string, orden: number, categorias: Array<[string, string[]]>) => ({
      codigo, nombre: codigo, alcance: AlcanceEtapaRubrica.TRABAJO_COMPARTIDO, orden,
      categorias: categorias.map(([codigoCategoria, pesos], i) => ({
        codigo: codigoCategoria, nombre: codigoCategoria, orden: i + 1, indicadores: pesos.map((peso, j) => indicador(j + 1, peso)),
      })),
    });
    const resultado = normalizarEstructuraRubricaCompleta([
      parte('ESCRITA', 1, [['A', ['0.33', '0.33', '0.34']], ['B', ['0.33', '0.33', '0.34']], ['C', ['1.00', '1.00', '1.00']]]),
      parte('ORAL', 2, [['D', ['0.83', '0.83', '0.84']], ['E', ['0.83', '0.83', '0.84']]]),
    ] as EtapaRubricaCompletaDto[]);
    expect(resultado.map(({ calificacionMaxima }) => calificacionMaxima)).toEqual(['5.00', '5.00']);
    expect(resultado[1].categorias.map(({ calificacionMaxima }) => calificacionMaxima)).toEqual(['2.50', '2.50']);
  });

  it('rechaza una etapa de más de 100 puntos, que sería un error de tecleo', () => {
    const grande = etapa('ENORME', 1, ['100.00', '0.01', '1.00', '1.00', '1.00']);
    expect(() => normalizarEstructuraRubricaCompleta([grande as EtapaRubricaCompletaDto])).toThrow(BadRequestException);
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

// Decisión 2026-11-12: una versión creada desde «Nueva rúbrica» debe poder activarse (BORRADOR → ACTIVA).
describe('versión completa lista para activarse', () => {
  const escritaYOral = () => normalizarEstructuraRubricaCompleta([
    { ...etapa('PARTE_I', 1), alcance: AlcanceEtapaRubrica.TRABAJO_COMPARTIDO, porcentaje: '50' },
    { ...etapa('PARTE_II', 2), alcance: AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL, porcentaje: '50' },
  ] as EtapaRubricaCompletaDto[]);

  it('la etapa compartida es ESCRITA y la individual es ORAL', () => {
    expect(tipoEtapaDesdeAlcance(AlcanceEtapaRubrica.TRABAJO_COMPARTIDO)).toBe(EtapaEvaluacion.ESCRITA);
    expect(tipoEtapaDesdeAlcance(AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL)).toBe(EtapaEvaluacion.ORAL);
  });

  it('numera las categorías sin repetir en toda la versión, siguiendo el orden de etapas', () => {
    const etapas = escritaYOral();
    const ordenes = ordenesCategoriaEnVersion([...etapas].reverse());
    expect(etapas.flatMap(({ categorias }) => categorias.map(({ dto }) => ordenes.get(dto)))).toEqual([1, 2, 3, 4]);
  });

  it('la estructura guardada cumple las reglas de activación', () => {
    const etapas = escritaYOral();
    const ordenes = ordenesCategoriaEnVersion(etapas);
    expect(() => validarEstructuraActivableRubrica({
      revision: 1,
      etapas: etapas.map(({ dto, categorias }) => ({
        tipo: tipoEtapaDesdeAlcance(dto.alcance), alcance: dto.alcance, codigo: dto.codigo, nombre: dto.nombre,
        calificacionMaxima: '10.00', porcentaje: null, orden: dto.orden,
        categorias: categorias.map(({ dto: categoria, calificacionMaxima }) => ({
          codigo: categoria.codigo, nombre: categoria.nombre, calificacionMaxima, orden: ordenes.get(categoria)!,
          indicadores: categoria.indicadores,
        })),
      })),
    } as never)).not.toThrow();
  });
});

describe('códigos de categoría en la versión', () => {
  it('rechaza al crear un código de categoría repetido entre etapas, como hace la activación', () => {
    const repetida = { ...etapa('ORAL', 2), categorias: etapa('ESCRITA', 1).categorias };
    expect(() => normalizarEstructuraRubricaCompleta([etapa('ESCRITA', 1), repetida] as EtapaRubricaCompletaDto[]))
      .toThrow('Los c\u00f3digos de categor\u00eda de la versi\u00f3n no pueden repetirse.');
  });
});
