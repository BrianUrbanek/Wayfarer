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
  title: string;
  message: string;
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
      title: 'Insufficient behavior evidence',
      message: 'Not enough rating evidence to classify behavior yet.'
    };
  }

  if (strongTargetAgreement) {
    return {
      kind: 'positive',
      title: `Primary signal: positive ${inference.behaviorTop.cohortId ?? 'cohort'} audience signal`,
      message:
        inference.cohortSeparability.label === 'low'
          ? 'Reliable reviewer, low cohort separation so far.'
          : `Reliable reviewer with ${inference.cohortSeparability.label} cohort separation.`
    };
  }

  if (inverseDominant) {
    return {
      kind: 'inverse',
      title: `Primary signal: anti-match against ${inference.inverseTop.cohortId ?? 'known cohort'}`,
      message: 'This player consistently moves against that cohort preference pattern; treat as negative evidence.'
    };
  }

  if (mismatchCandidate) {
    return {
      kind: 'mismatch',
      title: 'Primary signal: declared/observed mismatch',
      message: 'Declared tags and observed behavior currently point to different cohorts; possible retag candidate if behavior strengthens.'
    };
  }

  if (inference.cohortSeparability.label === 'low' || inference.behaviorSpecificity < 0.08) {
    return {
      kind: 'diffuse',
      title: 'Primary signal: diffuse behavior',
      message: 'Observed behavior is diffuse; top cohort lead is too small to over-interpret.'
    };
  }

  return {
    kind: 'weak',
    title: 'Primary signal: weak explanatory value',
    message: 'Weak signal: this profile should contribute lightly until more evidence accumulates.'
  };
}
