import { EtapaEvaluacion, AlcanceEtapaRubrica } from '../comun/enums-dominio';

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
