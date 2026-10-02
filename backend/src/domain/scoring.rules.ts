import { DomainRuleError } from './domain-rule.error';

export interface IndicatorScoreInput {
  indicatorId: string;
  score: number;
  maxScore: number;
}

export interface MemberStageScore {
  memberId: string;
  total: number;
}

export interface OralStageScore extends MemberStageScore {
  studentId: string;
}

export interface StudentEvaluationResult {
  studentId: string;
  memberFinalScores: Array<{ memberId: string; finalScore: number }>;
  finalScore: number;
}

const SCORE_EPSILON = 1e-8;

function toCents(value: number, field: string): number {
  if (!Number.isFinite(value)) {
    throw new DomainRuleError(`${field} debe ser un número finito.`);
  }

  const scaled = value * 100;
  const rounded = Math.round(scaled);
  if (Math.abs(scaled - rounded) > SCORE_EPSILON) {
    throw new DomainRuleError(`${field} admite como máximo dos decimales.`);
  }

  return rounded;
}

function fromCents(value: number): number {
  return Math.round(value) / 100;
}

function assertWithin(value: number, maximum: number, field: string): void {
  const valueCents = toCents(value, field);
  const maximumCents = toCents(maximum, `${field}.max`);

  if (maximumCents <= 0) {
    throw new DomainRuleError(`El máximo de ${field} debe ser mayor que cero.`);
  }
  if (valueCents < 0 || valueCents > maximumCents) {
    throw new DomainRuleError(
      `${field} debe estar entre 0 y ${fromCents(maximumCents).toFixed(2)}.`,
    );
  }
}

export function calculateRubricTotal(scores: IndicatorScoreInput[]): number {
  const indicatorIds = new Set<string>();
  let totalCents = 0;

  for (const item of scores) {
    if (indicatorIds.has(item.indicatorId)) {
      throw new DomainRuleError(`El indicador ${item.indicatorId} está repetido.`);
    }
    indicatorIds.add(item.indicatorId);
    assertWithin(item.score, item.maxScore, `Puntaje de ${item.indicatorId}`);
    totalCents += toCents(item.score, `Puntaje de ${item.indicatorId}`);
  }

  return fromCents(totalCents);
}

export function calculateMemberFinalScore(writtenScore: number, oralScore: number): number {
  assertWithin(writtenScore, 5, 'Revisión escrita');
  assertWithin(oralScore, 5, 'Sustentación');
  return fromCents(toCents(writtenScore, 'Revisión escrita') + toCents(oralScore, 'Sustentación'));
}

export function calculateStudentFinalScore(memberFinalScores: number[]): number {
  if (memberFinalScores.length !== 2) {
    throw new DomainRuleError('La calificación final requiere exactamente dos miembros del tribunal.');
  }

  const totalCents = memberFinalScores.reduce((total, score, index) => {
    assertWithin(score, 10, `Calificación del miembro ${index + 1}`);
    return total + toCents(score, `Calificación del miembro ${index + 1}`);
  }, 0);

  return fromCents(totalCents / 2);
}

export function calculateStudentResults(
  writtenScores: MemberStageScore[],
  oralScores: OralStageScore[],
): StudentEvaluationResult[] {
  if (writtenScores.length !== 2 || new Set(writtenScores.map(({ memberId }) => memberId)).size !== 2) {
    throw new DomainRuleError('Se requieren las revisiones escritas de dos miembros distintos.');
  }

  const writtenByMember = new Map<string, number>();
  for (const written of writtenScores) {
    assertWithin(written.total, 5, `Revisión escrita de ${written.memberId}`);
    writtenByMember.set(written.memberId, written.total);
  }

  const oralByStudent = new Map<string, Map<string, number>>();
  for (const oral of oralScores) {
    assertWithin(oral.total, 5, `Sustentación de ${oral.studentId}/${oral.memberId}`);
    if (!writtenByMember.has(oral.memberId)) {
      throw new DomainRuleError(`El miembro ${oral.memberId} no pertenece al tribunal evaluador.`);
    }

    const scoresByMember = oralByStudent.get(oral.studentId) ?? new Map<string, number>();
    if (scoresByMember.has(oral.memberId)) {
      throw new DomainRuleError(
        `Ya existe una sustentación de ${oral.memberId} para ${oral.studentId}.`,
      );
    }
    scoresByMember.set(oral.memberId, oral.total);
    oralByStudent.set(oral.studentId, scoresByMember);
  }

  return [...oralByStudent.entries()].map(([studentId, scoresByMember]) => {
    const memberFinalScores = [...writtenByMember.entries()].map(([memberId, writtenTotal]) => {
      const oralTotal = scoresByMember.get(memberId);
      if (oralTotal === undefined) {
        throw new DomainRuleError(
          `Falta la sustentación de ${studentId} por parte de ${memberId}.`,
        );
      }
      return {
        memberId,
        finalScore: calculateMemberFinalScore(writtenTotal, oralTotal),
      };
    });

    if (scoresByMember.size !== 2) {
      throw new DomainRuleError(`La sustentación de ${studentId} debe tener exactamente dos miembros.`);
    }

    return {
      studentId,
      memberFinalScores,
      finalScore: calculateStudentFinalScore(
        memberFinalScores.map(({ finalScore }) => finalScore),
      ),
    };
  });
}
