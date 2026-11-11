import { EtapaEvaluacion, AlcanceEtapaRubrica } from '../../../common/domain/enums-dominio';

export interface InstantaneaIndicadorRubrica {
  id: string;
  label: string;
  descripcion: string;
  calificacionMaxima: string;
  orden: number;
}

export interface InstantaneaCategoriaRubrica {
  id: string;
  codigo: string;
  nombre: string;
  stageId: string;
  calificacionMaxima: string;
  orden: number;
  indicators: InstantaneaIndicadorRubrica[];
}

export interface InstantaneaEtapaRubrica {
  id: string;
  kind: EtapaEvaluacion;
  scope: AlcanceEtapaRubrica;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  calificacionMaxima: string;
  porcentaje: string | null;
  orden: number;
}

export interface InstantaneaRubrica {
  rubricId: string;
  rubricVersionId: string;
  rubricName: string;
  version: string;
  academicPeriodCode: string;
  modalityCode: string;
  stages: InstantaneaEtapaRubrica[];
  categories: InstantaneaCategoriaRubrica[];
}

/**
 * Copia para presentación: conserva de la instantánea guardada solo las etapas,
 * categorías e indicadores que siguen visibles en la estructura actual de la misma
 * versión. No reescribe la instantánea almacenada ni afecta los totales cerrados.
 */
export function filtrarInstantaneaVisible(
  instantanea: InstantaneaRubrica, visible: InstantaneaRubrica,
): InstantaneaRubrica {
  if (instantanea.rubricVersionId !== visible.rubricVersionId) return instantanea;
  const etapas = new Set(visible.stages.map(({ id }) => id));
  const categorias = new Set(visible.categories.map(({ id }) => id));
  const indicadores = new Set(visible.categories.flatMap((c) => c.indicators.map(({ id }) => id)));
  return {
    ...instantanea,
    stages: instantanea.stages.filter(({ id }) => etapas.has(id)),
    categories: instantanea.categories
      .filter(({ id, stageId }) => categorias.has(id) && etapas.has(stageId))
      .map((categoria) => ({
        ...categoria,
        indicators: categoria.indicators.filter(({ id }) => indicadores.has(id)),
      })),
  };
}
