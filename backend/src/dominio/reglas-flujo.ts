import { EstadoEvaluacion } from '../comun/enums-dominio';
import { ErrorReglaDominio } from './error-regla-dominio';

export interface EstadoRevisionEscrita {
  idMiembro: string;
  estado: EstadoEvaluacion;
}

export function puedeProgramarSustentacion(revisiones: EstadoRevisionEscrita[]): boolean {
  return (
    revisiones.length === 2 &&
    new Set(revisiones.map(({ idMiembro }) => idMiembro)).size === 2 &&
    revisiones.every(({ estado }) => estado === EstadoEvaluacion.CERRADA)
  );
}

export function validarSustentacionProgramable(revisiones: EstadoRevisionEscrita[]): void {
  if (!puedeProgramarSustentacion(revisiones)) {
    throw new ErrorReglaDominio(
      'La sustentación requiere las revisiones escritas cerradas de los dos miembros.',
    );
  }
}

export function validarDosMiembrosTribunalDistintos(idsMiembros: string[]): void {
  if (idsMiembros.length !== 2 || new Set(idsMiembros).size !== 2) {
    throw new ErrorReglaDominio('El tribunal debe tener exactamente dos docentes distintos.');
  }
}
