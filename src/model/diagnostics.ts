import type { CohortAnchor, CohortMatch, CohortId, Diagnosis, DiagnosisType, TagId } from './types.js';

export interface DiagnosisThresholds {
  highSignal: number;
  lowSignal: number;
  strongCohortMatch: number;
  mediumCohortMatch: number;
  strongInverse: number;
  strongBehaviorMatch: number;
  strongBehaviorSpecificity: number;
}

export const DEFAULT_THRESHOLDS: DiagnosisThresholds = {
  highSignal: 0.75,
  lowSignal: 0.35,
  strongCohortMatch: 0.6,
  mediumCohortMatch: 0.4,
  strongInverse: 0.6,
  strongBehaviorMatch: 0.35,
  strongBehaviorSpecificity: 0.06
};

export interface DiagnoseInput {
  declaredDistribution: CohortMatch[];
  behaviorDistribution: CohortMatch[];
  inverseBehaviorDistribution: CohortMatch[];
  declaredTop: CohortMatch;
  behaviorTop: CohortMatch;
  inverseTop: CohortMatch;
  behaviorMatchStrength: number;
  behaviorSpecificity: number;
  effectiveSignal: number;
  cohorts?: readonly CohortAnchor[];
}

function priorityForType(type: DiagnosisType): Diagnosis['analystPriority'] {
  switch (type) {
    case 'HIGH_SIGNAL':
      return 'none';
    case 'MISMATCH_RETAG':
      return 'medium';
    case 'INVERSE_PROFILE':
      return 'high';
    case 'UNKNOWN_OR_NOISY':
      return 'low';
    case 'LOW_SIGNAL':
      return 'medium';
    case 'AMBIGUOUS':
      return 'low';
    case 'UNEXPLAINED_PREDICTIVE':
      return 'critical';
    default:
      return 'none';
  }
}

function suggestTagsFromCohorts(
  cohorts: readonly CohortAnchor[] | undefined,
  cohortId: CohortId | null
): TagId[] | undefined {
  if (!cohorts || cohortId === null) {
    return undefined;
  }

  const cohort = cohorts.find((entry) => entry.id === cohortId);
  return cohort ? cohort.tags.slice() : undefined;
}

export function diagnoseInference(
  input: DiagnoseInput,
  thresholds: DiagnosisThresholds = DEFAULT_THRESHOLDS
): Diagnosis {
  let type: DiagnosisType = 'AMBIGUOUS';
  let suggestedCohortId: CohortId | undefined;

  // Precedence matters:
  // 1) strong agreement, 2) structured inverse profile, 3) explicit retag mismatch,
  // 4) unstructured/noisy behavior, 5) lower-confidence signal mismatch, 6) fallback ambiguity.
  if (
    input.effectiveSignal >= thresholds.highSignal &&
    input.behaviorMatchStrength >= thresholds.strongBehaviorMatch &&
    input.behaviorSpecificity >= thresholds.strongBehaviorSpecificity
  ) {
    type = 'HIGH_SIGNAL';
  } else if (
    input.inverseTop.score >= thresholds.strongInverse &&
    input.behaviorTop.score < thresholds.mediumCohortMatch
  ) {
    type = 'INVERSE_PROFILE';
    suggestedCohortId = input.inverseTop.cohortId ?? undefined;
  } else if (
    input.declaredTop.cohortId !== null &&
    input.behaviorTop.cohortId !== null &&
    input.declaredTop.score >= thresholds.strongCohortMatch &&
    input.behaviorTop.score >= thresholds.mediumCohortMatch &&
    input.declaredTop.cohortId !== input.behaviorTop.cohortId
  ) {
    type = 'MISMATCH_RETAG';
    suggestedCohortId = input.behaviorTop.cohortId;
  } else if (
    input.behaviorTop.score < thresholds.mediumCohortMatch &&
    input.inverseTop.score < thresholds.strongInverse
  ) {
    type = 'UNKNOWN_OR_NOISY';
  } else if (
    input.effectiveSignal < thresholds.lowSignal &&
    (input.declaredTop.score >= thresholds.mediumCohortMatch ||
      input.behaviorTop.score >= thresholds.mediumCohortMatch ||
      input.inverseTop.score >= thresholds.mediumCohortMatch)
  ) {
    type = 'LOW_SIGNAL';
  }

  const reasons = [
    `effectiveSignal=${input.effectiveSignal.toFixed(3)}`,
    `declaredTop=${input.declaredTop.cohortId ?? 'none'}:${input.declaredTop.score.toFixed(3)}`,
    `behaviorTop=${input.behaviorTop.cohortId ?? 'none'}:${input.behaviorTop.score.toFixed(3)}`,
    `inverseTop=${input.inverseTop.cohortId ?? 'none'}:${input.inverseTop.score.toFixed(3)}`,
    `behaviorMatchStrength=${input.behaviorMatchStrength.toFixed(3)}`,
    `behaviorSpecificity=${input.behaviorSpecificity.toFixed(3)}`
  ];

  const diagnosis: Diagnosis = {
    type,
    message:
      type === 'HIGH_SIGNAL'
        ? 'High signal: declared identity and observed behavior agree.'
        : type === 'MISMATCH_RETAG'
          ? `Observed behavior aligns more strongly with ${suggestedCohortId ?? 'another cohort'}.`
          : type === 'INVERSE_PROFILE'
            ? 'Observed behavior is strongly anti-correlated with a known cohort.'
            : type === 'UNKNOWN_OR_NOISY'
              ? 'Observed behavior does not strongly match or invert any known cohort.'
              : type === 'LOW_SIGNAL'
                ? 'Declared identity weakly explains observed behavior.'
                : 'Identity and behavior are not decisively separated.',
    suggestedCohortId,
    suggestedTags: suggestTagsFromCohorts(input.cohorts, suggestedCohortId ?? null),
    analystPriority: priorityForType(type),
    reasons
  };

  return diagnosis;
}
