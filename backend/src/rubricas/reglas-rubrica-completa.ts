import { BadRequestException } from '@nestjs/common';
import { AlcanceEtapaRubrica } from '../comun/enums-dominio';
import { EtapaRubricaCompletaDto } from './dto/estructura-rubrica-completa.dto';

export interface CategoriaRubricaNormalizada {
  dto: EtapaRubricaCompletaDto['categorias'][number];
  calificacionMaxima: string;
}

export interface EtapaRubricaNormalizada {
  dto: EtapaRubricaCompletaDto;
  categorias: CategoriaRubricaNormalizada[];
}

/** Asigna la siguiente etiqueta Vn de una familia, sin depender del cliente. */
export const siguienteEtiquetaVersionRubrica = (versiones: string[]): string => {
  const existentes = new Set(versiones.map((version) => version.trim().toLocaleLowerCase('es')));
  const mayorNumero = versiones.reduce((mayor, version) => {
    const coincidencia = /^v(\d+)$/i.exec(version.trim());
    if (!coincidencia) return mayor;
    const numero = Number(coincidencia[1]);
    return Number.isSafeInteger(numero) ? Math.max(mayor, numero) : mayor;
  }, versiones.length);
  for (let numero = mayorNumero + 1; numero <= 2147483647; numero += 1) {
    const candidata = `V${numero}`;
    if (!existentes.has(candidata.toLocaleLowerCase('es'))) return candidata;
  }
  throw new BadRequestException('No fue posible asignar un identificador de versión disponible.');
};

const centavosDe = (valor: string, nombre: string): bigint => {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(valor)) {
    throw new BadRequestException(`${nombre} debe tener como m\u00e1ximo dos decimales.`);
  }
  const [enteros, decimales = ''] = valor.split('.');
  const resultado = BigInt(enteros) * 100n + BigInt(decimales.padEnd(2, '0') || '0');
  if (resultado <= 0n) throw new BadRequestException(`${nombre} debe ser mayor que cero.`);
  return resultado;
};

const validarOrdenes = (valores: number[], grupo: string): void => {
  if (valores.some((valor) => !Number.isInteger(valor) || valor <= 0 || valor > 32767)) {
    throw new BadRequestException(`Los \u00f3rdenes de ${grupo} deben ser enteros positivos v\u00e1lidos.`);
  }
  if (new Set(valores).size !== valores.length) {
    throw new BadRequestException(`Los \u00f3rdenes de ${grupo} no pueden repetirse.`);
  }
};

const validarCodigos = (valores: string[], grupo: string): void => {
  const normalizados = valores.map((valor) => valor.trim().toLocaleUpperCase('es'));
  if (new Set(normalizados).size !== normalizados.length) {
    throw new BadRequestException(`Los c\u00f3digos de ${grupo} no pueden repetirse.`);
  }
};

export const normalizarEstructuraRubricaCompleta = (
  etapas: EtapaRubricaCompletaDto[],
): EtapaRubricaNormalizada[] => {
  if (!Array.isArray(etapas) || etapas.length === 0) {
    throw new BadRequestException('La r\u00fabrica debe contener al menos una etapa.');
  }
  validarCodigos(etapas.map(({ codigo }) => codigo), 'etapa');
  validarOrdenes(etapas.map(({ orden }) => orden), 'etapa');

  let totalEtapas = 0;
  const normalizadas = etapas.map((etapa): EtapaRubricaNormalizada => {
    if (![AlcanceEtapaRubrica.TRABAJO_COMPARTIDO, AlcanceEtapaRubrica.ESTUDIANTE_INDIVIDUAL].includes(etapa.alcance)) {
      throw new BadRequestException('Cada etapa debe usar un alcance v\u00e1lido.');
    }
    if (!etapa.categorias?.length) throw new BadRequestException('No se guardan etapas vac\u00edas.');
    validarCodigos(etapa.categorias.map(({ codigo }) => codigo), 'categor\u00eda de una etapa');
    validarOrdenes(etapa.categorias.map(({ orden }) => orden), 'categor\u00eda de una etapa');

    let totalCategorias = 0;
    const categorias = etapa.categorias.map((categoria) => {
      if (!categoria.indicadores?.length) throw new BadRequestException('No se guardan categor\u00edas vac\u00edas.');
      validarOrdenes(categoria.indicadores.map(({ orden }) => orden), 'indicador de una categor\u00eda');
      const totalIndicadores = categoria.indicadores.reduce((suma, indicador) => (
        suma + centavosDe(indicador.calificacionMaxima, 'La ponderaci\u00f3n del indicador')
      ), 0n);
      totalCategorias += Number(totalIndicadores);
      return { dto: categoria, calificacionMaxima: decimalDesdeCentavos(totalIndicadores) };
    });

    if (totalCategorias !== 1000) {
      throw new BadRequestException(`La etapa ${etapa.codigo} debe sumar exactamente 10.00 puntos.`);
    }
    totalEtapas += totalCategorias;
    return { dto: etapa, categorias };
  });

  if (totalEtapas !== etapas.length * 1000) {
    throw new BadRequestException('Cada etapa debe sumar exactamente 10.00 puntos.');
  }
  return normalizadas;
};

export const decimalDesdeCentavos = (centavos: bigint): string => {
  const parteEntera = centavos / 100n;
  const parteDecimal = (centavos % 100n).toString().padStart(2, '0');
  return `${parteEntera}.${parteDecimal}`;
};
