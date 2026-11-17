import { BadRequestException } from '@nestjs/common';

/** Convierte un decimal académico no negativo a centésimas sin Number. */
export function centesimasActa(valor: string, campo = 'La calificación', escala = 10): bigint {
  if (typeof valor !== 'string' || !/^(?:0|[1-9]\d{0,2})(?:\.\d{1,2})?$/.test(valor)) {
    throw new BadRequestException(`${campo} debe estar entre 0.00 y ${escala.toFixed(2)} y tener como máximo dos decimales.`);
  }
  const [entero, decimal = ''] = valor.split('.');
  const centesimas = BigInt(entero) * 100n + BigInt(decimal.padEnd(2, '0') || '0');
  if (centesimas > BigInt(escala * 100)) throw new BadRequestException(`${campo} no puede ser mayor que ${escala.toFixed(2)}.`);
  return centesimas;
}

export function decimalActaDesdeCentesimas(valor: bigint): string {
  return `${valor / 100n}.${(valor % 100n).toString().padStart(2, '0')}`;
}

export function notaAprobada(notaFinal: string, notaMinima: string, escala = 10): boolean {
  return centesimasActa(notaFinal, 'La nota final', escala) >= centesimasActa(notaMinima, 'La nota mínima', escala);
}

/** Devuelve la menor nota publicable que alcanza el porcentaje requerido. */
export function notaMinimaEnEscala(porcentaje: string, escala: number): string {
  const centesimas = centesimasActa(porcentaje, 'La nota mínima porcentual', 100);
  return decimalActaDesdeCentesimas((centesimas * BigInt(escala) + 99n) / 100n);
}

export function notaEnLetras(valor: string, escala = 10): string {
  const centesimas = centesimasActa(valor, 'La calificación', escala);
  const digitos = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];
  const entero = Number(centesimas / 100n);
  const hastaVeintinueve = [...digitos, 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis',
    'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés',
    'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  const decenas = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  const unidad = entero % 10;
  const letras = entero === 100 ? 'cien' : hastaVeintinueve[entero]
    ?? [decenas[Math.floor(entero / 10)], unidad ? digitos[unidad] : ''].filter(Boolean).join(' y ');
  return `${letras} coma ${digitos[Number(centesimas / 10n % 10n)]} ${digitos[Number(centesimas % 10n)]}`;
}

const UNIDADES = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte',
  'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Número de 0 a 99 en letras: «treinta y uno», «veintiséis». */
export function numeroEnLetras(numero: number): string {
  if (!Number.isInteger(numero) || numero < 0 || numero > 99) throw new RangeError('Solo se escriben en letras números de 0 a 99.');
  if (numero < 30) return UNIDADES[numero];
  const unidad = numero % 10;
  return unidad ? `${DECENAS[Math.floor(numero / 10)]} y ${UNIDADES[unidad]}` : DECENAS[numero / 10];
}

/**
 * Fecha y hora de la sustentación tal como las escriben las actas PAT:
 * «a los quince días del mes de diciembre del dos mil veintiséis, siendo las 09h00» y «15 de diciembre del 2026».
 * La fecha llega como AAAA-MM-DD y la hora como HH:MM (programación de S4).
 */
export function fechaSustentacionActa(fecha: string, hora: string) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  const reloj = /^(\d{2}):(\d{2})$/.exec(hora);
  if (!coincidencia || !reloj) throw new BadRequestException('La fecha u hora de la sustentación no es válida.');
  const [anio, mes, dia] = [Number(coincidencia[1]), Number(coincidencia[2]), Number(coincidencia[3])];
  if (anio < 2000 || anio > 2099 || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    throw new BadRequestException('La fecha de la sustentación está fuera del rango que escriben las actas.');
  }
  const nombreMes = MESES[mes - 1];
  const anioEnLetras = anio === 2000 ? 'dos mil' : `dos mil ${numeroEnLetras(anio - 2000)}`;
  const dias = dia === 1 ? 'al primer día' : `a los ${numeroEnLetras(dia)} días`;
  return {
    enLetras: `${dias} del mes de ${nombreMes} del ${anioEnLetras}, siendo las ${reloj[1]}h${reloj[2]}`,
    numerica: `${dia} de ${nombreMes} del ${anio}`,
  };
}
