import { BadRequestException } from '@nestjs/common';

export const DURACION_ESTIMADA_MINIMA_MINUTOS = 1;
export const DURACION_ESTIMADA_MAXIMA_MINUTOS = 240;
export const DURACION_ESTIMADA_PREDETERMINADA_MINUTOS = 60;

export function validarFechaProgramada(fecha: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha.startsWith('0000-')) {
    throw new BadRequestException('La fecha debe usar el formato AAAA-MM-DD.');
  }
  const fechaUtc = new Date(`${fecha}T00:00:00.000Z`);
  if (Number.isNaN(fechaUtc.getTime()) || fechaUtc.toISOString().slice(0, 10) !== fecha) {
    throw new BadRequestException('La fecha programada no existe en el calendario.');
  }
  return fecha;
}

export function validarHoraProgramada(hora: string): string {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?$/.test(hora)) {
    throw new BadRequestException('La hora debe estar entre 00:00 y 23:59.');
  }
  return hora;
}

export function validarSalaProgramada(sala: string): string {
  const normalizada = sala.trim();
  if (!normalizada) throw new BadRequestException('La sala es obligatoria.');
  if (normalizada.length > 160) throw new BadRequestException('La sala no puede superar 160 caracteres.');
  return normalizada;
}

export function validarDuracionEstimada(valor: unknown): number {
  if (!Number.isInteger(valor)
    || (valor as number) < DURACION_ESTIMADA_MINIMA_MINUTOS
    || (valor as number) > DURACION_ESTIMADA_MAXIMA_MINUTOS) {
    throw new BadRequestException(
      `La duración estimada debe ser un número entero entre ${DURACION_ESTIMADA_MINIMA_MINUTOS} y ${DURACION_ESTIMADA_MAXIMA_MINUTOS} minutos.`,
    );
  }
  return valor as number;
}

export interface IntervaloProgramacion {
  fecha: string;
  hora: string;
  sala: string;
  duracionMinutos: number;
  estado: string;
}

function minutosDesdeMedianoche(hora: string): number {
  const [horas, minutos, segundos = '0'] = hora.split(':');
  return Number(horas) * 60 + Number(minutos) + Number(segundos) / 60;
}

export function seSolapanEnLaMismaSala(a: IntervaloProgramacion, b: IntervaloProgramacion): boolean {
  if (a.estado === 'CANCELADA' || b.estado === 'CANCELADA') return false;
  if (a.sala.trim().toLocaleLowerCase() !== b.sala.trim().toLocaleLowerCase()) return false;
  const diaEnMinutos = (fecha: string) => {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return Date.UTC(anio, mes - 1, dia) / 60_000;
  };
  const inicioA = diaEnMinutos(a.fecha) + minutosDesdeMedianoche(a.hora);
  const finA = inicioA + a.duracionMinutos;
  const inicioB = diaEnMinutos(b.fecha) + minutosDesdeMedianoche(b.hora);
  const finB = inicioB + b.duracionMinutos;
  // Intervalos semiabiertos: [inicio, fin). La sustentación siguiente puede
  // empezar exactamente al terminar la anterior.
  return inicioA < finB && inicioB < finA;
}

export function permiteTransicionEstadoProgramacion(actual: string, siguiente: string): boolean {
  return (actual === 'PROGRAMADA' && ['EN_SUSTENTACION', 'CANCELADA'].includes(siguiente))
    || (actual === 'EN_SUSTENTACION' && siguiente === 'FINALIZADA');
}

export function patronBusquedaProgramacion(busqueda?: string): string | null {
  const limpia = busqueda?.trim();
  if (!limpia) return null;
  return `%${limpia.replace(/[\\%_]/g, '\\$&')}%`;
}
