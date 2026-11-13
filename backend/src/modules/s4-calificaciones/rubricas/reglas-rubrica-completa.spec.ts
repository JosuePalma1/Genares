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

// Decisión 2026-11-12: una versión creada desde «Nueva rúbrica» debe poder activarse (BORRADOR → ACTIVA).
describe('versión completa lista para activarse', () => {
  const escritaYOral = () => normalizarEstructuraRubricaCompleta([
    { ...etapa('PARTE_I', 1), alcance: AlcanceEtapaRubrica.TRABAJO_COMPARTIDO },
    { ...etapa('PARTE_II', 2), alcance: AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL },
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
