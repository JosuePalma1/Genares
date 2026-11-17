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
