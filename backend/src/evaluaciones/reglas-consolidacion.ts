export interface Racional {
  numerador: bigint;
  denominador: bigint;
}

export interface RacionalSerializable {
  numerador: string;
  denominador: string;
  unidad: 'PUNTOS';
}

function maximoComunDivisor(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

export function racional(numerador: bigint, denominador: bigint = 1n): Racional {
  if (denominador === 0n) throw new RangeError('El denominador de un racional no puede ser cero.');
  const signo = denominador < 0n ? -1n : 1n;
  const divisor = maximoComunDivisor(numerador, denominador);
  return {
    numerador: (numerador / divisor) * signo,
    denominador: (denominador / divisor) * signo,
  };
}

export function racionalDesdeDecimal(valor: string): Racional {
  const coincidencia = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(valor);
  if (!coincidencia) throw new TypeError('La calificación debe ser un decimal no negativo sin notación exponencial.');
  const decimales = coincidencia[2] ?? '';
  const denominador = 10n ** BigInt(decimales.length);
  const parteDecimal = decimales ? BigInt(decimales) : 0n;
  return racional(BigInt(coincidencia[1]) * denominador + parteDecimal, denominador);
}

export function sumarRacionales(a: Racional, b: Racional): Racional {
  return racional(
    a.numerador * b.denominador + b.numerador * a.denominador,
    a.denominador * b.denominador,
  );
}

export function promedioRacional(valores: readonly Racional[]): Racional | null {
  if (valores.length === 0) return null;
  const suma = valores.reduce(sumarRacionales, racional(0n));
  return racional(suma.numerador, suma.denominador * BigInt(valores.length));
}

export function redondearRacionalHalfUp(valor: Racional): string {
  if (valor.numerador < 0n || valor.denominador <= 0n) {
    throw new RangeError('Las calificaciones deben ser racionales no negativos.');
  }
  const centesimasEscaladas = valor.numerador * 100n;
  let centesimas = centesimasEscaladas / valor.denominador;
  const resto = centesimasEscaladas % valor.denominador;
  if (resto * 2n >= valor.denominador) centesimas += 1n;
  return `${centesimas / 100n}.${(centesimas % 100n).toString().padStart(2, '0')}`;
}

export function serializarRacional(valor: Racional): RacionalSerializable {
  return {
    numerador: valor.numerador.toString(),
    denominador: valor.denominador.toString(),
    unidad: 'PUNTOS',
  };
}
