import { BadRequestException } from '@nestjs/common';

/** Convierte un decimal académico no negativo a centésimas sin Number. */
export function centesimasActa(valor: string, campo = 'La calificación'): bigint {
  if (typeof valor !== 'string' || !/^(?:0|[1-9]\d?)(?:\.\d{1,2})?$/.test(valor)) {
    throw new BadRequestException(`${campo} debe estar entre 0.00 y 10.00 y tener como máximo dos decimales.`);
  }
  const [entero, decimal = ''] = valor.split('.');
  const centesimas = BigInt(entero) * 100n + BigInt(decimal.padEnd(2, '0') || '0');
  if (centesimas > 1000n) throw new BadRequestException(`${campo} no puede ser mayor que 10.00.`);
  return centesimas;
}

export function decimalActaDesdeCentesimas(valor: bigint): string {
  return `${valor / 100n}.${(valor % 100n).toString().padStart(2, '0')}`;
}

export function notaAprobada(notaFinal: string, notaMinima: string): boolean {
  return centesimasActa(notaFinal, 'La nota final') >= centesimasActa(notaMinima, 'La nota mínima');
}
