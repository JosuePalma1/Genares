import { EstadoTrabajo } from '../../../common/domain/enums-dominio';

/**
 * SE-03 · Finalización del trabajo (Paso 2, MF-05; RF-22, RF-24, RF-41, RF-45).
 * Un trabajo se finaliza administrativamente solo si cada estudiante tiene su
 * evaluación completa, su acta archivada y ninguna validación institucional pendiente.
 */
export interface EstudianteFinalizacion {
  id: string;
  nombre: string;
  /** Motivos por los que no se podría emitir su acta (pendientesActa). */
  pendientesActa: string[];
  actaArchivada: boolean;
}

export interface EntradaFinalizacion {
  estadoProceso: string | null;
  estudiantes: EstudianteFinalizacion[];
}

export interface CondicionEstudiante {
  idEstudiante: string;
  nombre: string;
  cumplida: boolean;
  pendientes: string[];
}

export interface EvaluacionFinalizacion {
  finalizado: boolean;
  puedeFinalizar: boolean;
  /** Motivos generales del trabajo (no ligados a un estudiante). */
  pendientesTrabajo: string[];
  estudiantes: CondicionEstudiante[];
}

export function evaluarFinalizacion(entrada: EntradaFinalizacion): EvaluacionFinalizacion {
  const finalizado = entrada.estadoProceso === EstadoTrabajo.FINALIZADO;
  const pendientesTrabajo: string[] = [];
  if (finalizado) pendientesTrabajo.push('El trabajo ya está finalizado.');
  if (entrada.estudiantes.length === 0) pendientesTrabajo.push('El trabajo no tiene estudiantes vinculados.');

  const estudiantes = entrada.estudiantes.map((estudiante) => {
    const pendientes = [...estudiante.pendientesActa];
    if (!estudiante.actaArchivada) pendientes.push('Falta el acta de calificación archivada.');
    return { idEstudiante: estudiante.id, nombre: estudiante.nombre, cumplida: pendientes.length === 0, pendientes };
  });

  return {
    finalizado,
    puedeFinalizar: pendientesTrabajo.length === 0 && estudiantes.every((estudiante) => estudiante.cumplida),
    pendientesTrabajo,
    estudiantes,
  };
}
