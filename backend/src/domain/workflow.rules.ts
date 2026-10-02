import { EvaluationStatus } from '../common/domain.enums';
import { DomainRuleError } from './domain-rule.error';

export interface WrittenReviewState {
  memberId: string;
  status: EvaluationStatus;
}

export function canScheduleDefense(reviews: WrittenReviewState[]): boolean {
  return (
    reviews.length === 2 &&
    new Set(reviews.map(({ memberId }) => memberId)).size === 2 &&
    reviews.every(({ status }) => status === EvaluationStatus.CLOSED)
  );
}

export function assertDefenseCanBeScheduled(reviews: WrittenReviewState[]): void {
  if (!canScheduleDefense(reviews)) {
    throw new DomainRuleError(
      'La sustentación requiere las revisiones escritas cerradas de los dos miembros.',
    );
  }
}

export function assertTwoDistinctTribunalMembers(memberIds: string[]): void {
  if (memberIds.length !== 2 || new Set(memberIds).size !== 2) {
    throw new DomainRuleError('El tribunal debe tener exactamente dos docentes distintos.');
  }
}
