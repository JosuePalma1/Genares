import { ErrorReglaDominio } from './error-regla-dominio';

export interface EntradaCalificacionIndicador {
  idIndicador: string;
  score: number;
  calificacionMaxima: number;
}

export interface CalificacionEtapaMiembro {
  idMiembro: string;
  total: number;
}

export interface CalificacionEtapaOral extends CalificacionEtapaMiembro {
  idEstudiante: string;
}

export interface ResultadoEvaluacionEstudiante {
  idEstudiante: string;
  calificacionesFinalesMiembros: Array<{ idMiembro: string; calificacionFinal: number }>;
  calificacionFinal: number;
}

const EPSILON_CALIFICACION = 1e-8;

function aCentavos(valor: number, campo: string): number {
  if (!Number.isFinite(valor)) {
    throw new ErrorReglaDominio(`${campo} debe ser un número finito.`);
  }

  const scaled = valor * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > EPSILON_CALIFICACION) {
    throw new ErrorReglaDominio(`${campo} admite como máximo dos decimales.`);
  }

  return rounded;
}

function desdeCentavos(valor: number): number {
  return Math.round(valor) / 100;
}

function validarDentroDelMaximo(valor: number, maximo: number, campo: string): void {
  const valueCents = aCentavos(valor, campo);
  const maximumCents = aCentavos(maximo, `${campo}.max`);

  if (maximumCents <= 0) {
    throw new ErrorReglaDominio(`El máximo de ${campo} debe ser mayor que cero.`);
  }
  if (valueCents < 0 || valueCents > maximumCents) {
    throw new ErrorReglaDominio(
      `${campo} debe estar entre 0 y ${desdeCentavos(maximumCents).toFixed(2)}.`,
    );
  }
}

export function calcularTotalRubrica(calificaciones: EntradaCalificacionIndicador[]): number {
  const indicatorIds = new Set<string>();
  let totalCents = 0;

  for (const elemento of calificaciones) {
    if (indicatorIds.has(elemento.idIndicador)) {
      throw new ErrorReglaDominio(`El indicador ${elemento.idIndicador} está repetido.`);
    }
    indicatorIds.add(elemento.idIndicador);
    validarDentroDelMaximo(elemento.score, elemento.calificacionMaxima, `Puntaje de ${elemento.idIndicador}`);
    totalCents += aCentavos(elemento.score, `Puntaje de ${elemento.idIndicador}`);
  }

  return desdeCentavos(totalCents);
}

export function calcularCalificacionFinalMiembro(
  calificacionEscrita: number,
  calificacionOral: number,
  maximoEscrita = 5,
  maximoOral = 5,
): number {
  validarDentroDelMaximo(calificacionEscrita, maximoEscrita, 'Revisión escrita');
  validarDentroDelMaximo(calificacionOral, maximoOral, 'Sustentación');
  return desdeCentavos(aCentavos(calificacionEscrita, 'Revisión escrita') + aCentavos(calificacionOral, 'Sustentación'));
}

export function calcularCalificacionFinalEstudiante(calificacionesFinalesMiembros: number[], maximoRubrica = 10): number {
  if (calificacionesFinalesMiembros.length !== 2) {
    throw new ErrorReglaDominio('La calificación final requiere exactamente dos miembros del tribunal.');
  }

  const totalCents = calificacionesFinalesMiembros.reduce((total, score, indice) => {
    validarDentroDelMaximo(score, maximoRubrica, `Calificación del miembro ${indice + 1}`);
    return total + aCentavos(score, `Calificación del miembro ${indice + 1}`);
  }, 0);

  return desdeCentavos(totalCents / 2);
}

export function calcularResultadosEstudiante(
  calificacionesEscritas: CalificacionEtapaMiembro[],
  calificacionesOrales: CalificacionEtapaOral[],
  maxima: { written: number; oral: number } = { written: 5, oral: 5 },
): ResultadoEvaluacionEstudiante[] {
  if (calificacionesEscritas.length !== 2 || new Set(calificacionesEscritas.map(({ idMiembro }) => idMiembro)).size !== 2) {
    throw new ErrorReglaDominio('Se requieren las revisiones escritas de dos miembros distintos.');
  }

  const escritaPorMiembro = new Map<string, number>();
  for (const written of calificacionesEscritas) {
    validarDentroDelMaximo(written.total, maxima.written, `Revisión escrita de ${written.idMiembro}`);
    escritaPorMiembro.set(written.idMiembro, written.total);
  }

  const oralPorEstudiante = new Map<string, Map<string, number>>();
  for (const oral of calificacionesOrales) {
    validarDentroDelMaximo(oral.total, maxima.oral, `Sustentación de ${oral.idEstudiante}/${oral.idMiembro}`);
    if (!escritaPorMiembro.has(oral.idMiembro)) {
      throw new ErrorReglaDominio(`El miembro ${oral.idMiembro} no pertenece al tribunal evaluador.`);
    }

    const calificacionesPorMiembro = oralPorEstudiante.get(oral.idEstudiante) ?? new Map<string, number>();
    if (calificacionesPorMiembro.has(oral.idMiembro)) {
      throw new ErrorReglaDominio(
        `Ya existe una sustentación de ${oral.idMiembro} para ${oral.idEstudiante}.`,
      );
    }
    calificacionesPorMiembro.set(oral.idMiembro, oral.total);
    oralPorEstudiante.set(oral.idEstudiante, calificacionesPorMiembro);
  }

  return [...oralPorEstudiante.entries()].map(([idEstudiante, calificacionesPorMiembro]) => {
    const calificacionesFinalesMiembros = [...escritaPorMiembro.entries()].map(([idMiembro, writtenTotal]) => {
      const oralTotal = calificacionesPorMiembro.get(idMiembro);
      if (oralTotal === undefined) {
        throw new ErrorReglaDominio(
          `Falta la sustentación de ${idEstudiante} por parte de ${idMiembro}.`,
        );
      }
      return {
        idMiembro,
        calificacionFinal: calcularCalificacionFinalMiembro(writtenTotal, oralTotal, maxima.written, maxima.oral),
      };
    });

    if (calificacionesPorMiembro.size !== 2) {
      throw new ErrorReglaDominio(`La sustentación de ${idEstudiante} debe tener exactamente dos miembros.`);
    }

    return {
      idEstudiante,
      calificacionesFinalesMiembros,
      calificacionFinal: calcularCalificacionFinalEstudiante(
        calificacionesFinalesMiembros.map(({ calificacionFinal }) => calificacionFinal),
        maxima.written + maxima.oral,
      ),
    };
  });
}
