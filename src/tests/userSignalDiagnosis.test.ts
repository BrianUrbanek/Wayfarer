import { describe, expect, it } from 'vitest';
import { buildPrimarySignalSummary } from '../ui/userSignalDiagnosis';
import type { InferenceAnalysis } from '../model/inference';

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
    expect(summary.kind).toBe('positive');
    expect(summary.titleKey).toBe('positive');
    expect(summary.primaryCohortId).toBe('cohort-a');
    expect(summary.message).toContain('Reliable reviewer, low cohort separation so far');
  });

  it('promotes inverse only when inverse clearly dominates and agreement is weak', () => {
    const inference = baseInference();
    inference.targetAlignment.agreementRate = 0.3;
    inference.inverseTop.score = 0.6;
    inference.behaviorTop.score = 0.35;
    const summary = buildPrimarySignalSummary(inference);
    expect(summary.kind).toBe('inverse');
    expect(summary.titleKey).toBe('inverse');
    expect(summary.inverseCohortId).toBe('cohort-b');
  });

  it('reports mismatch when declared and behavior diverge with evidence', () => {
    const inference = baseInference();
    inference.targetAlignment.agreementRate = 0.6;
    inference.declaredTop = { cohortId: 'cohort-a', score: 0.7 };
    inference.behaviorTop = { cohortId: 'cohort-b', score: 0.45 };
    const summary = buildPrimarySignalSummary(inference);
    expect(summary.kind).toBe('mismatch');
  });

  it('reports insufficient evidence when behavior evidence is too low', () => {
    const inference = baseInference();
    inference.targetAlignment.ratedCount = 1;
    inference.ratingEvidence = 0.02;
    const summary = buildPrimarySignalSummary(inference);
    expect(summary.kind).toBe('insufficient');
  });

  it('reports diffuse behavior when separation is weak without strong target agreement', () => {
    const inference = baseInference();
    inference.targetAlignment.agreementRate = 0.58;
    inference.behaviorSpecificity = 0.03;
    const summary = buildPrimarySignalSummary(inference);
    expect(summary.kind).toBe('diffuse');
  });
});
