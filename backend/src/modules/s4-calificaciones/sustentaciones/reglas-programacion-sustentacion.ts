import { BadRequestException, ConflictException } from '@nestjs/common';

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

export function validarMotivoReprogramacion(motivo: unknown): string {
  const normalizado = typeof motivo === 'string' ? motivo.trim() : '';
  if (!normalizado) throw new BadRequestException('Indique el motivo de la reprogramación.');
  if (normalizado.length > 500) throw new BadRequestException('El motivo no puede superar 500 caracteres.');
  return normalizado;
}

export interface EstudianteProgramable {
  id: string;
  /** Ya figura en alguna programación del proceso, en cualquier estado o visibilidad. */
  programado: boolean;
}

/**
 * Participantes de una nueva sesión (RN-28): sin selección, todos los que aún no tienen
 * programación; con selección, solo esos, que deben pertenecer al trabajo y no estar programados.
 */
export function elegirParticipantesSesion(estudiantes: EstudianteProgramable[], solicitados?: string[]): string[] {
  if (!estudiantes.length) throw new ConflictException('El trabajo no tiene estudiantes asignados.');
  if (!solicitados) {
    const pendientes = estudiantes.filter((estudiante) => !estudiante.programado).map(({ id }) => id);
    if (!pendientes.length) {
      throw new ConflictException('El trabajo ya tiene una programación registrada; edítela desde el cronograma.');
    }
    return pendientes;
  }
  const porId = new Map(estudiantes.map((estudiante) => [estudiante.id.toLowerCase(), estudiante]));
  const elegidos = [...new Set(solicitados.map((id) => id.toLowerCase()))];
  if (!elegidos.length) throw new BadRequestException('Seleccione al menos un estudiante para la sesión.');
  if (elegidos.some((id) => !porId.has(id))) {
    throw new BadRequestException('Un estudiante seleccionado no pertenece al trabajo.');
  }
  if (elegidos.some((id) => porId.get(id)!.programado)) {
    throw new ConflictException('Un estudiante seleccionado ya tiene una programación registrada; edítela desde el cronograma.');
  }
  return elegidos.map((id) => porId.get(id)!.id);
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

/**
 * El cronograma es de horario previsto: no se registra el inicio ni el fin real de la defensa
 * (decisión posterior del proyecto). Solo se puede cancelar una sesión programada; las sesiones
 * EN_SUSTENTACION o FINALIZADA que ya existan se conservan y se consultan sin cambios.
 */
export function permiteTransicionEstadoProgramacion(actual: string, siguiente: string): boolean {
  return actual === 'PROGRAMADA' && siguiente === 'CANCELADA';
}

export function patronBusquedaProgramacion(busqueda?: string): string | null {
  const limpia = busqueda?.trim();
  if (!limpia) return null;
  return `%${limpia.replace(/[\\%_]/g, '\\$&')}%`;
}
