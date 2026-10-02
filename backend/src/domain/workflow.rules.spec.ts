import { EvaluationStatus } from '../common/domain.enums';
import {
  assertDefenseCanBeScheduled,
  assertTwoDistinctTribunalMembers,
  canScheduleDefense,
} from './workflow.rules';

describe('reglas de flujo', () => {
  it('habilita la sustentación únicamente con dos revisiones escritas cerradas', () => {
    expect(
      canScheduleDefense([
        { memberId: 'member-1', status: EvaluationStatus.CLOSED },
        { memberId: 'member-2', status: EvaluationStatus.CLOSED },
      ]),
    ).toBe(true);

    expect(
      canScheduleDefense([
        { memberId: 'member-1', status: EvaluationStatus.CLOSED },
        { memberId: 'member-2', status: EvaluationStatus.DRAFT },
      ]),
    ).toBe(false);

    expect(() =>
      assertDefenseCanBeScheduled([
        { memberId: 'member-1', status: EvaluationStatus.CLOSED },
      ]),
    ).toThrow('dos miembros');
  });

  it('exige dos docentes distintos al confirmar el tribunal', () => {
    expect(() => assertTwoDistinctTribunalMembers(['teacher-1', 'teacher-2'])).not.toThrow();
    expect(() => assertTwoDistinctTribunalMembers(['teacher-1', 'teacher-1'])).toThrow(
      'dos docentes distintos',
    );
  });
});
