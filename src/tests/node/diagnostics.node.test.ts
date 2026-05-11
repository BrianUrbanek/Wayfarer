import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_THRESHOLDS, diagnoseInference } from '../../model/diagnostics.js';
import type { CohortMatch, Diagnosis } from '../../model/types.js';

function match(cohortId: string | null, score: number): CohortMatch {
  return { cohortId, score };
}

function fixture(overrides: Partial<{
  declaredTop: CohortMatch;
  behaviorTop: CohortMatch;
  inverseTop: CohortMatch;
  effectiveSignal: number;
}> = {}) {
  return {
    declaredDistribution: [match('cohort-a', 1)],
    behaviorDistribution: [match('cohort-a', 1)],
    inverseBehaviorDistribution: [match('cohort-a', 0)],
    declaredTop: overrides.declaredTop ?? match('cohort-a', 0.9),
    behaviorTop: overrides.behaviorTop ?? match('cohort-a', 0.9),
    inverseTop: overrides.inverseTop ?? match('cohort-a', 0.1),
    effectiveSignal: overrides.effectiveSignal ?? 0.9
  };
}

describe('diagnosis precedence', () => {
  it('returns HIGH_SIGNAL for strong agreement', () => {
    const diagnosis = diagnoseInference(fixture());
    assert.equal(diagnosis.type, 'HIGH_SIGNAL');
    assert.match(diagnosis.message, /signal/i);
  });

  it('returns INVERSE_PROFILE before retag mismatch when inverse is strong', () => {
    const diagnosis = diagnoseInference(
      fixture({
        behaviorTop: match('cohort-a', 0.31),
        inverseTop: match('cohort-b', 0.77),
        effectiveSignal: 0.12
      })
    );

    assert.equal(diagnosis.type, 'INVERSE_PROFILE');
  });

  it('returns MISMATCH_RETAG before LOW_SIGNAL when both top matches are meaningful', () => {
    const diagnosis = diagnoseInference(
      fixture({
        declaredTop: match('cohort-a', 0.82),
        behaviorTop: match('cohort-b', 0.81),
        inverseTop: match('cohort-b', 0.2),
        effectiveSignal: 0.41
      })
    );

    assert.equal(diagnosis.type, 'MISMATCH_RETAG');
    assert.equal(diagnosis.suggestedCohortId, 'cohort-b');
  });

  it('returns UNKNOWN_OR_NOISY when behavior and inverse are both weak', () => {
    const diagnosis = diagnoseInference(
      fixture({
        behaviorTop: match('cohort-a', 0.2),
        inverseTop: match('cohort-b', 0.1),
        effectiveSignal: 0.1
      })
    );

    assert.equal(diagnosis.type, 'UNKNOWN_OR_NOISY');
  });

  it('returns LOW_SIGNAL only when there is some structure to explain', () => {
    const diagnosis = diagnoseInference(
      fixture({
        behaviorTop: match('cohort-a', 0.51),
        inverseTop: match('cohort-b', 0.2),
        effectiveSignal: DEFAULT_THRESHOLDS.lowSignal - 0.01
      })
    );

    assert.equal(diagnosis.type, 'LOW_SIGNAL');
  });

  it('falls back to AMBIGUOUS for blended, non-extreme matches', () => {
    const diagnosis = diagnoseInference(
      fixture({
        declaredTop: match('cohort-a', 0.51),
        behaviorTop: match('cohort-a', 0.53),
        inverseTop: match('cohort-b', 0.24),
        effectiveSignal: 0.48
      })
    );

    assert.equal(diagnosis.type, 'AMBIGUOUS');
  });

  it('returns a full diagnosis object', () => {
    const diagnosis: Diagnosis = diagnoseInference(fixture());
    assert.ok(Array.isArray(diagnosis.reasons));
    assert.equal(typeof diagnosis.message, 'string');
  });
});
