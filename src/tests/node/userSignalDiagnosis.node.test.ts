import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrimarySignalSummary } from '../../ui/userSignalDiagnosis.js';
import type { InferenceAnalysis } from '../../model/inference.js';

function baseInference(): InferenceAnalysis {
  return {
    declaredSimilarities: [],
    behavioralSimilarities: [],
    inverseBehavioralSimilarities: [],
    declaredDistribution: [{ cohortId: 'cohort-a', score: 0.7 }],
    behaviorDistribution: [{ cohortId: 'cohort-a', score: 0.7 }, { cohortId: 'cohort-b', score: 0.3 }],
    inverseBehaviorDistribution: [{ cohortId: 'cohort-b', score: 0.2 }],
    declaredTop: { cohortId: 'cohort-a', score: 0.7 },
    behaviorTop: { cohortId: 'cohort-a', score: 0.7 },
    inverseTop: { cohortId: 'cohort-b', score: 0.2 },
    behaviorMatchStrength: 0.6,
    behaviorSpecificity: 0.15,
    signalFit: 0.8,
    signalEvidence: 0.8,
    ratingEvidence: 0.8,
    effectiveSignal: 0.64,
    targetAlignment: {
      cohortId: 'cohort-a',
      agreementCount: 8,
      disagreementCount: 1,
      ratedCount: 9,
      agreementRate: 8 / 9,
      similarity: 0.7,
      evidence: 1
    },
    cohortSeparability: {
      topGap: 0.05,
      topShare: 0.38,
      label: 'low',
      message: 'Low separability'
    },
    diagnosis: {
      type: 'AMBIGUOUS',
      message: 'legacy',
      analystPriority: 'low',
      reasons: []
    }
  };
}

describe('user signal diagnosis summary', () => {
  it('keeps high target agreement + low separability as reliable positive signal', () => {
    const summary = buildPrimarySignalSummary(baseInference());
    assert.equal(summary.kind, 'positive');
    assert.equal(summary.titleKey, 'positive');
    assert.equal(summary.primaryCohortId, 'cohort-a');
    assert.match(summary.message, /Reliable reviewer, low cohort separation so far/);
  });
});
