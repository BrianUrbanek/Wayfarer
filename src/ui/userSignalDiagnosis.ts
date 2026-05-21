import type { InferenceAnalysis } from '../model/inference.js';

export type UserSignalDiagnosisKind =
  | 'positive'
  | 'inverse'
  | 'mismatch'
  | 'diffuse'
  | 'insufficient'
  | 'weak';

export interface UserSignalDiagnosisSummary {
  kind: UserSignalDiagnosisKind;
  titleKey:
    | 'positive'
    | 'inverse'
    | 'mismatch'
    | 'diffuse'
    | 'insufficient'
    | 'weak';
  message: string;
  primaryCohortId?: string | null;
  inverseCohortId?: string | null;
  showSecondaryInverse: boolean;
}

export function buildPrimarySignalSummary(inference: InferenceAnalysis): UserSignalDiagnosisSummary {
  const hasBehaviorEvidence = inference.targetAlignment.ratedCount > 0 && inference.ratingEvidence >= 0.08;
  const strongTargetAgreement = inference.targetAlignment.agreementRate >= 0.7 && inference.targetAlignment.ratedCount >= 3;
  const inverseDominant =
    inference.inverseTop.score >= Math.max(0.45, inference.behaviorTop.score + 0.12) &&
    inference.targetAlignment.agreementRate < 0.55;
  const mismatchCandidate =
    inference.declaredTop.cohortId !== null &&
    inference.behaviorTop.cohortId !== null &&
    inference.declaredTop.cohortId !== inference.behaviorTop.cohortId &&
    inference.behaviorTop.score >= 0.35 &&
    inference.targetAlignment.ratedCount >= 3;

  if (!hasBehaviorEvidence) {
    return {
      kind: 'insufficient',
      titleKey: 'insufficient',
      message: 'Not enough rating evidence to classify behavior yet.',
      showSecondaryInverse: false
    };
  }

  if (strongTargetAgreement) {
    return {
      kind: 'positive',
      titleKey: 'positive',
      message:
        inference.cohortSeparability.label === 'low'
          ? 'Reliable reviewer, low cohort separation so far.'
          : `Reliable reviewer with ${inference.cohortSeparability.label} cohort separation.`
      ,
      primaryCohortId: inference.behaviorTop.cohortId,
      showSecondaryInverse: inference.inverseTop.score >= 0.35 && inference.inverseTop.score >= inference.behaviorTop.score - 0.08
    };
  }

  if (inverseDominant) {
    return {
      kind: 'inverse',
      titleKey: 'inverse',
      message: 'This player consistently moves against that cohort preference pattern; treat as negative evidence.',
      inverseCohortId: inference.inverseTop.cohortId,
      showSecondaryInverse: true
    };
  }

  if (mismatchCandidate) {
    return {
      kind: 'mismatch',
      titleKey: 'mismatch',
      message: 'Declared tags and observed behavior currently point to different cohorts; possible retag candidate if behavior strengthens.',
      showSecondaryInverse: false
    };
  }

  if (inference.cohortSeparability.label === 'low' || inference.behaviorSpecificity < 0.08) {
    return {
      kind: 'diffuse',
      titleKey: 'diffuse',
      message: 'Observed behavior is diffuse; top cohort lead is too small to over-interpret.',
      showSecondaryInverse: false
    };
  }

  return {
    kind: 'weak',
    titleKey: 'weak',
    message: 'Weak behavior read: this profile should contribute lightly until more evidence accumulates.',
    showSecondaryInverse: false
  };
}
