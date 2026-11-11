import { EstadoTrabajo } from '../../../common/domain/enums-dominio';
import { PuntajeBorrador, validarPuntajesCierre } from '../evaluaciones/mer/borrador-oral.reglas';

/**
 * RF-36 · Corrección extraordinaria de una evaluación cerrada (AU-02 / AU-03).
 * La solicitud lleva el cambio exacto; solo se aplica si un autorizador la aprueba.
 */
export const ESTADO_SOLICITUD = Object.freeze({
  PENDIENTE: 'PENDIENTE',
  APROBADA: 'APROBADA',
  RECHAZADA: 'RECHAZADA',
  APLICADA: 'APLICADA',
});

export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 2000;
export const JUSTIFICATIVO_MAXIMO_BYTES = 5 * 1024 * 1024;

export interface PuntajeActual {
  idIndicador: string;
  /** Texto decimal exacto de PostgreSQL, o null si el indicador no tiene nota. */
  score: string | null;
  observation: string | null;
  calificacionMaxima: string;
}

export interface PuntajeCorregido {
  idIndicador: string;
  /** Texto decimal para conservar la precisión exacta en PostgreSQL. */
  score: string;
  observation: string | null;
}

export function validarMotivo(motivo: unknown): string {
  const texto = typeof motivo === 'string' ? motivo.trim() : '';
  if (texto.length < MOTIVO_MINIMO || texto.length > MOTIVO_MAXIMO) {
    throw new Error(`El motivo debe tener entre ${MOTIVO_MINIMO} y ${MOTIVO_MAXIMO} caracteres.`);
  }
  return texto;
}

/**
 * Valida los puntajes propuestos con las mismas reglas del cierre (todos los indicadores,
 * entre 0 y el máximo congelado en la evaluación) y exige al menos un cambio real.
 */
export function prepararCorreccion(actuales: PuntajeActual[], propuestos: PuntajeBorrador[]): PuntajeCorregido[] {
  validarPuntajesCierre(
    actuales.map(({ idIndicador, calificacionMaxima }) => ({ id: idIndicador, calificacionMaxima })),
    propuestos,
  );
  const porIndicador = new Map(actuales.map((actual) => [actual.idIndicador, actual]));
  const corregidos = propuestos.map((propuesto) => ({
    idIndicador: propuesto.idIndicador,
    score: String(propuesto.score),
    observation: propuesto.observation?.trim() || null,
  }));
  const hayCambio = corregidos.some((corregido) => {
    const actual = porIndicador.get(corregido.idIndicador)!;
    return actual.score === null || Number(actual.score) !== Number(corregido.score)
      || (actual.observation?.trim() || null) !== corregido.observation;
  });
  if (!hayCambio) throw new Error('La corrección no modifica ninguna nota ni observación.');
  return corregidos;
}

export interface EstadoParaCorreccion {
  estadoEvaluacion: string;
  estadoRegistro: number;
  estadoProceso: string | null;
  actasArchivadas: number;
}

/**
 * Motivos que impiden corregir. No se revierten estados protegidos: un trabajo finalizado o
 * un acta archivada no se reabren desde este procedimiento.
 */
export function bloqueosCorreccion(estado: EstadoParaCorreccion): string[] {
  const bloqueos: string[] = [];
  if (estado.estadoRegistro !== 1) bloqueos.push('La evaluación está oculta.');
  if (estado.estadoEvaluacion !== 'CERRADA') bloqueos.push('Solo se corrigen evaluaciones cerradas; un borrador se edita por el flujo ordinario.');
  if (estado.estadoProceso === EstadoTrabajo.FINALIZADO) bloqueos.push('El trabajo está finalizado; la finalización no se revierte con una corrección.');
  if (estado.actasArchivadas > 0) bloqueos.push('Ya existe un acta archivada para el estudiante afectado; el acta no se sobrescribe.');
  return bloqueos;
}

/** Un archivo es aceptable si declara y contiene un PDF y no supera el tamaño máximo. */
export function validarJustificativo(archivo: { buffer?: Buffer; size?: number; mimetype?: string } | undefined): Buffer {
  if (!archivo?.buffer?.length) throw new Error('Adjunte el PDF justificativo; es obligatorio.');
  if (archivo.buffer.length > JUSTIFICATIVO_MAXIMO_BYTES) throw new Error('El PDF justificativo supera 5 MB.');
  if (archivo.mimetype !== 'application/pdf' || archivo.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new Error('El justificativo debe ser un archivo PDF.');
  }
  return archivo.buffer;
}
