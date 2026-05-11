import { describe, expect, it } from 'vitest';
import { diagnoseInference, DEFAULT_THRESHOLDS } from '../model/diagnostics';
import type { CohortMatch, Diagnosis } from '../model/types';

function match(cohortId: string | null, score: number): CohortMatch {
  return { cohortId, score };
}

function inferenceFixture(overrides: Partial<{
  declaredTop: CohortMatch;
  behaviorTop: CohortMatch;
  inverseTop: CohortMatch;
  behaviorMatchStrength: number;
  behaviorSpecificity: number;
  effectiveSignal: number;
}> = {}) {
  return {
    declaredDistribution: [match('cohort-a', 1)],
    behaviorDistribution: [match('cohort-a', 1)],
    inverseBehaviorDistribution: [match('cohort-a', 0)],
    declaredTop: overrides.declaredTop ?? match('cohort-a', 0.9),
    behaviorTop: overrides.behaviorTop ?? match('cohort-a', 0.9),
    inverseTop: overrides.inverseTop ?? match('cohort-a', 0.1),
    behaviorMatchStrength: overrides.behaviorMatchStrength ?? 0.9,
    behaviorSpecificity: overrides.behaviorSpecificity ?? 0.1,
    effectiveSignal: overrides.effectiveSignal ?? 0.9
  };
}

describe('diagnosis rules', () => {
  it('returns HIGH_SIGNAL when effective signal clears the high threshold', () => {
    const diagnosis = diagnoseInference(inferenceFixture());

    expect(diagnosis.type).toBe('HIGH_SIGNAL');
    expect(diagnosis.analystPriority).toBe('none');
  });

  it('treats flat behavior fallback as non-informative', () => {
    const diagnosis = diagnoseInference(
      inferenceFixture({
        effectiveSignal: 0.92,
        behaviorTop: match('cohort-a', 0.2),
        inverseTop: match('cohort-b', 0.2),
        behaviorMatchStrength: 0,
        behaviorSpecificity: 0
      })
    );

    expect(['UNKNOWN_OR_NOISY', 'AMBIGUOUS']).toContain(diagnosis.type);
  });

  it('returns MISMATCH_RETAG when declared and behavioral top cohorts differ', () => {
    const diagnosis = diagnoseInference(
      inferenceFixture({
        declaredTop: match('cohort-a', 0.82),
        behaviorTop: match('cohort-b', 0.81),
        effectiveSignal: 0.41
      })
    );

    expect(diagnosis.type).toBe('MISMATCH_RETAG');
    expect(diagnosis.suggestedCohortId).toBe('cohort-b');
  });

  it('returns INVERSE_PROFILE when inverse behavior is strong and positive behavior is weak', () => {
    const diagnosis = diagnoseInference(
      inferenceFixture({
        behaviorTop: match('cohort-a', 0.31),
        inverseTop: match('cohort-b', 0.77),
        effectiveSignal: 0.12
      })
    );

    expect(diagnosis.type).toBe('INVERSE_PROFILE');
  });

  it('returns UNKNOWN_OR_NOISY when behavior and inverse matches are both weak', () => {
    const diagnosis = diagnoseInference(
      inferenceFixture({
        behaviorTop: match('cohort-a', 0.2),
        inverseTop: match('cohort-b', 0.1),
        effectiveSignal: 0.1
      })
    );

    expect(diagnosis.type).toBe('UNKNOWN_OR_NOISY');
  });

  it('returns LOW_SIGNAL when the effective signal drops below the low threshold', () => {
    const diagnosis = diagnoseInference(
      inferenceFixture({
        behaviorTop: match('cohort-a', 0.51),
        inverseTop: match('cohort-b', 0.2),
        effectiveSignal: DEFAULT_THRESHOLDS.lowSignal - 0.01
      })
    );

    expect(diagnosis.type).toBe('LOW_SIGNAL');
  });

  it('falls back to AMBIGUOUS for blended, non-extreme matches', () => {
    const diagnosis = diagnoseInference(
      inferenceFixture({
        declaredTop: match('cohort-a', 0.51),
        behaviorTop: match('cohort-a', 0.53),
        inverseTop: match('cohort-b', 0.24),
        effectiveSignal: 0.48
      })
    );

    expect(diagnosis.type).toBe('AMBIGUOUS');
  });

  it('produces a diagnosis object with the required fields', () => {
    const diagnosis: Diagnosis = diagnoseInference(inferenceFixture());

    expect(diagnosis.message).toContain('signal');
    expect(Array.isArray(diagnosis.reasons)).toBe(true);
  });
});
