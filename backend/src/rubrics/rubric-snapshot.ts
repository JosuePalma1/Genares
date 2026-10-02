import { EvaluationStage } from '../common/domain.enums';

export interface RubricIndicatorSnapshot {
  id: string;
  label: string;
  description: string;
  maxScore: string;
  order: number;
}

export interface RubricCategorySnapshot {
  id: string;
  code: string;
  name: string;
  stage: EvaluationStage;
  maxScore: string;
  order: number;
  indicators: RubricIndicatorSnapshot[];
}

export interface RubricSnapshot {
  rubricId: string;
  rubricVersionId: string;
  rubricName: string;
  version: string;
  academicPeriodCode: string;
  modalityCode: string;
  categories: RubricCategorySnapshot[];
}
