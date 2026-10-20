import { BadRequestException } from '@nestjs/common';
import { AlcanceEtapaRubrica, EtapaEvaluacion } from '../comun/enums-dominio';
import {
  ActualizarVersionRubricaDto,
  CategoriaBorradorRubricaDto,
  EtapaBorradorRubricaDto,
  IndicadorBorradorRubricaDto,
} from './dto/actualizar-version-rubrica.dto';

const maximoCentavos = (valor: string, maxDigitosEnteros: number, nombre: string, grupoVacio = false): bigint => {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(valor)) {
    throw new BadRequestException(`${nombre} debe tener como máximo dos decimales.`);
  }
  const [enteros, decimales = ''] = valor.split('.');
  if (enteros.length > maxDigitosEnteros) {
    throw new BadRequestException(`${nombre} supera la precisión permitida.`);
  }
  const centavos = BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, '0') || '0');
  if (centavos <= 0n && !grupoVacio) throw new BadRequestException(`${nombre} debe ser mayor que cero.`);
  return centavos;
};

const asegurarUnicos = (valores: string[], nombre: string): void => {
  const vistos = new Set<string>();
  for (const valor of valores) {
    const clave = valor.trim().toLocaleUpperCase('es');
    if (vistos.has(clave)) throw new BadRequestException(`${nombre} no puede repetirse.`);
    vistos.add(clave);
  }
};

const asegurarOrdenes = (valores: number[], nombre: string): void => {
  if (valores.some((valor) => !Number.isInteger(valor) || valor <= 0 || valor > 32767)) {
    throw new BadRequestException(`${nombre} debe ser un entero positivo válido.`);
  }
  if (new Set(valores).size !== valores.length) {
    throw new BadRequestException(`${nombre} no puede repetirse.`);
  }
};

const asegurarIdsUnicos = (estructura: ActualizarVersionRubricaDto): void => {
  const ids = [
    ...estructura.etapas.flatMap((etapa) => [
      ...(etapa.id ? [etapa.id] : []),
      ...etapa.categorias.flatMap((categoria) => [
        ...(categoria.id ? [categoria.id] : []),
        ...categoria.indicadores.flatMap((indicador) => indicador.id ? [indicador.id] : []),
      ]),
    ]),
  ];
  if (new Set(ids).size !== ids.length) {
    throw new BadRequestException('Los identificadores de la estructura no pueden repetirse.');
  }
};

const compararSumatoria = (valores: bigint[], esperado: bigint, nombre: string): void => {
  const total = valores.reduce((suma, valor) => suma + valor, 0n);
  if (total !== esperado) {
    throw new BadRequestException(`La sumatoria de ${nombre} debe coincidir con su calificación máxima.`);
  }
};

/** Valida restricciones de persistencia en borradores y sumas solo cuando la estructura está completa. */
export const validarEstructuraBorradorRubrica = (estructura: ActualizarVersionRubricaDto): void => {
  asegurarIdsUnicos(estructura);
  asegurarUnicos(estructura.etapas.map(({ codigo }) => codigo), 'Los códigos de etapa');
  asegurarOrdenes(estructura.etapas.map(({ orden }) => orden), 'Los órdenes de etapa');
  asegurarUnicos(estructura.etapas.map(({ tipo }) => tipo), 'Los tipos de etapa');

  const categorias: CategoriaBorradorRubricaDto[] = [];
  for (const etapa of estructura.etapas) {
    const alcanceEsperado = etapa.tipo === EtapaEvaluacion.ESCRITA
      ? AlcanceEtapaRubrica.TRABAJO_COMPARTIDO
      : AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL;
    if (etapa.alcance !== alcanceEsperado) {
      throw new BadRequestException('El alcance no corresponde a la etapa de evaluación.');
    }
    maximoCentavos(etapa.calificacionMaxima, 3, 'La calificación máxima de etapa',
      etapa.categorias.every((categoria) => categoria.indicadores.length === 0));
    if (etapa.porcentaje !== undefined && etapa.porcentaje !== null) {
      const porcentaje = maximoCentavos(etapa.porcentaje, 3, 'El porcentaje de etapa');
      if (porcentaje > 10000n) throw new BadRequestException('El porcentaje de etapa no puede superar 100.');
    }
    asegurarUnicos(etapa.categorias.map(({ codigo }) => codigo), 'Los códigos de categoría');
    categorias.push(...etapa.categorias);
    for (const categoria of etapa.categorias) {
      maximoCentavos(categoria.calificacionMaxima, 2, 'La calificación máxima de categoría', categoria.indicadores.length === 0);
      asegurarOrdenes(etapa.categorias.map(({ orden }) => orden), 'Los órdenes de categoría');
      asegurarOrdenes(categoria.indicadores.map(({ orden }) => orden), 'Los órdenes de indicador');
      for (const indicador of categoria.indicadores) {
        maximoCentavos(indicador.calificacionMaxima, 2, 'La calificación máxima de indicador');
      }
    }
  }

  // El esquema impone orden único global para las categorías de una versión.
  asegurarUnicos(categorias.map(({ codigo }) => codigo), 'Los códigos de categoría');
  asegurarOrdenes(categorias.map(({ orden }) => orden), 'Los órdenes de categoría');

  const esCompleta = estructura.etapas.length === 2
    && estructura.etapas.some(({ tipo }) => tipo === EtapaEvaluacion.ESCRITA)
    && estructura.etapas.some(({ tipo }) => tipo === EtapaEvaluacion.ORAL)
    && estructura.etapas.every((etapa) => etapa.categorias.length > 0
      && etapa.categorias.every((categoria) => categoria.indicadores.length > 0));
  if (!esCompleta) return;

  for (const etapa of estructura.etapas) {
    const categoriasEtapa = etapa.categorias;
    compararSumatoria(
      categoriasEtapa.map((categoria) => maximoCentavos(categoria.calificacionMaxima, 2, 'La calificación máxima de categoría')),
      maximoCentavos(etapa.calificacionMaxima, 3, 'La calificación máxima de etapa'),
      'las categorías de la etapa',
    );
    for (const categoria of categoriasEtapa) {
      compararSumatoria(
        categoria.indicadores.map((indicador) => maximoCentavos(indicador.calificacionMaxima, 2, 'La calificación máxima de indicador')),
        maximoCentavos(categoria.calificacionMaxima, 2, 'La calificación máxima de categoría'),
        'los indicadores de la categoría',
      );
    }
  }
};

/** Reglas de activación ya presentes en PostgreSQL; no aplica sumas de porcentajes ni otros criterios. */
export const validarEstructuraActivableRubrica = (estructura: ActualizarVersionRubricaDto): void => {
  const tipos = new Set(estructura.etapas.map(({ tipo }) => tipo));
  if (
    estructura.etapas.length !== 2
    || !tipos.has(EtapaEvaluacion.ESCRITA)
    || !tipos.has(EtapaEvaluacion.ORAL)
  ) {
    throw new BadRequestException('La versión debe configurar las etapas escrita y oral.');
  }
  if (estructura.etapas.some((etapa) => etapa.categorias.length === 0)) {
    throw new BadRequestException('Cada etapa debe tener al menos una categoría.');
  }
  if (estructura.etapas.some((etapa) =>
    etapa.categorias.some((categoria) => categoria.indicadores.length === 0))) {
    throw new BadRequestException('Cada categoría debe tener al menos un indicador.');
  }
  validarEstructuraBorradorRubrica(estructura);
};
