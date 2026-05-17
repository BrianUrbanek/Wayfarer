import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePseudoCohorts, tagCombinationKey } from '../../model/pseudoCohorts.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import type { InferenceResult } from '../../model/inference.js';
import type { CohortMatch, Island, MaybeRating, User } from '../../model/types.js';

const allIslands: Island[] = Array.from({ length: 24 }, (_, index) => ({
  id: `island-${index + 1}`,
  label: `Island ${index + 1}`
}));

function buildRatings(pattern: MaybeRating[]): Record<string, MaybeRating> {
  return Object.fromEntries(allIslands.map((island, index) => [island.id, pattern[index] ?? null]));
}

function buildUser(id: string, tags: string[], pattern: MaybeRating[]): User {
  return {
    id,
    label: id,
    declaredTags: tags,
    ratings: buildRatings(pattern)
  };
}

function match(cohortId: string, score: number): CohortMatch {
  return { cohortId, score };
}

function buildInferenceResult(
  declaredScore: number,
  behaviorScore: number,
  inverseScore: number,
  effectiveSignal: number
): InferenceResult {
  const declaredTop = match('cohort-known-a', declaredScore);
  const behaviorTop = match('cohort-known-a', behaviorScore);
  const inverseTop = match('cohort-known-b', inverseScore);

  return {
    declaredSimilarities: [],
    behavioralSimilarities: [],
    inverseBehavioralSimilarities: [],
    declaredDistribution: [declaredTop],
    behaviorDistribution: [behaviorTop],
    inverseBehaviorDistribution: [inverseTop],
    declaredTop,
    behaviorTop,
    inverseTop,
    behaviorMatchStrength: behaviorScore,
    behaviorSpecificity: Math.max(0, behaviorScore - inverseScore),
    signalFit: effectiveSignal,
    signalEvidence: 1,
    ratingEvidence: 1,
    effectiveSignal,
    targetAlignment: {
      cohortId: 'cohort-known-a',
      agreementCount: 2,
      disagreementCount: 0,
      ratedCount: 2,
      agreementRate: 1,
      similarity: behaviorScore,
      evidence: 1
    },
    cohortSeparability: {
      topGap: Math.max(0, behaviorScore - inverseScore),
      topShare: behaviorScore,
      label: 'moderate',
      message: 'fixture'
    }
  };
}

function buildAnalysisFixture() {
  const consistentPattern: MaybeRating[] = Array.from({ length: 24 }, (_, index) =>
    index % 2 === 0 ? 1 : -1
  );
  const inconsistentPatternA: MaybeRating[] = Array.from({ length: 24 }, (_, index) =>
    index % 2 === 0 ? 1 : -1
  );
  const inconsistentPatternB: MaybeRating[] = Array.from({ length: 24 }, (_, index) =>
    index % 2 === 0 ? -1 : 1
  );

  const users = [
    buildUser('u-consistent-1', ['alpha', 'beta'], consistentPattern),
    buildUser('u-consistent-2', ['alpha', 'beta'], consistentPattern),
    buildUser('u-consistent-3', ['alpha', 'beta'], consistentPattern),
    buildUser('u-consistent-4', ['alpha', 'beta'], consistentPattern),
    buildUser('u-consistent-5', ['alpha', 'beta'], consistentPattern),
    buildUser('u-inconsistent-1', ['gamma', 'delta'], inconsistentPatternA),
    buildUser('u-inconsistent-2', ['gamma', 'delta'], inconsistentPatternA),
    buildUser('u-inconsistent-3', ['gamma', 'delta'], inconsistentPatternB),
    buildUser('u-inconsistent-4', ['gamma', 'delta'], inconsistentPatternB),
    buildUser('u-small-1', ['tiny', 'group'], consistentPattern),
    buildUser('u-small-2', ['tiny', 'group'], consistentPattern)
  ];

  const inferenceLookup = new Map<string, InferenceResult>([
    ['u-consistent-1', buildInferenceResult(0.18, 0.22, 0.06, 0.24)],
    ['u-consistent-2', buildInferenceResult(0.18, 0.22, 0.06, 0.24)],
    ['u-consistent-3', buildInferenceResult(0.18, 0.22, 0.06, 0.24)],
    ['u-consistent-4', buildInferenceResult(0.18, 0.22, 0.06, 0.24)],
    ['u-consistent-5', buildInferenceResult(0.18, 0.22, 0.06, 0.24)],
    ['u-inconsistent-1', buildInferenceResult(0.12, 0.08, 0.74, 0.08)],
    ['u-inconsistent-2', buildInferenceResult(0.12, 0.08, 0.74, 0.08)],
    ['u-inconsistent-3', buildInferenceResult(0.12, 0.08, 0.74, 0.08)],
    ['u-inconsistent-4', buildInferenceResult(0.12, 0.08, 0.74, 0.08)],
    ['u-small-1', buildInferenceResult(0.15, 0.16, 0.05, 0.14)],
    ['u-small-2', buildInferenceResult(0.15, 0.16, 0.05, 0.14)]
  ]);

  return {
    users,
    inferenceLookup
  };
}

describe('pseudo-cohort analysis', () => {
  it('ranks a consistent tag combination in the top consistent list', () => {
    const { users, inferenceLookup } = buildAnalysisFixture();
    const analysis = analyzePseudoCohorts(users, inferenceLookup, { minGroupSize: 3 });

    assert.equal(analysis.topConsistentPseudoCohorts[0]?.key, tagCombinationKey(['alpha', 'beta']));
    assert.deepEqual(analysis.topConsistentPseudoCohorts[0]?.users, [
      'u-consistent-1',
      'u-consistent-2',
      'u-consistent-3',
      'u-consistent-4',
      'u-consistent-5'
    ]);
    assert.equal(analysis.topConsistentPseudoCohorts[0]?.reportType, 'CONSISTENT_CANDIDATE');
    assert.ok((analysis.topConsistentPseudoCohorts[0]?.internalConsistency ?? 0) > 0.95);
    assert.ok(
      ['high', 'critical'].includes(analysis.topConsistentPseudoCohorts[0]?.analystPriority ?? 'low')
    );
  });

  it('ranks a low-consistency tag combination in the top inconsistent list', () => {
    const { users, inferenceLookup } = buildAnalysisFixture();
    const analysis = analyzePseudoCohorts(users, inferenceLookup, { minGroupSize: 3 });

    assert.equal(analysis.topInconsistentPseudoCohorts[0]?.key, tagCombinationKey(['delta', 'gamma']));
    assert.equal(analysis.topInconsistentPseudoCohorts[0]?.reportType, 'INCONSISTENT_TAG_RISK');
    assert.ok((analysis.topInconsistentPseudoCohorts[0]?.internalConsistency ?? 0) < 0);
  });

  it('excludes groups below the minimum size', () => {
    const { users, inferenceLookup } = buildAnalysisFixture();
    const analysis = analyzePseudoCohorts(users, inferenceLookup, { minGroupSize: 3 });

    assert.equal(
      analysis.allReports.some((report) => report.key === tagCombinationKey(['group', 'tiny'])),
      false
    );
  });

  it('increases analyst priority when consistency is high and known-cohort fit is low', () => {
    const { users, inferenceLookup } = buildAnalysisFixture();
    const analysis = analyzePseudoCohorts(users, inferenceLookup, { minGroupSize: 3 });

    const consistent = analysis.topConsistentPseudoCohorts[0];
    assert.ok(consistent);
    assert.ok(consistent.averageKnownCohortFit < 0.25);
    assert.ok(['high', 'critical'].includes(consistent.analystPriority));
  });

  it('includes user ids and tag combination keys in reports', () => {
    const { users, inferenceLookup } = buildAnalysisFixture();
    const analysis = analyzePseudoCohorts(users, inferenceLookup, { minGroupSize: 3 });
    const consistent = analysis.topConsistentPseudoCohorts[0];

    assert.equal(consistent?.key, 'alpha|beta');
    assert.ok(consistent?.users.includes('u-consistent-3') ?? false);
  });

  it('does not mutate seeded cohorts or their tag lists', () => {
    const cohorts = createDefaultCohorts();
    const snapshot = JSON.parse(JSON.stringify(cohorts));
    const { users, inferenceLookup } = buildAnalysisFixture();

    analyzePseudoCohorts(users, inferenceLookup, { minGroupSize: 3 });

    assert.deepEqual(cohorts, snapshot);
  });
});
