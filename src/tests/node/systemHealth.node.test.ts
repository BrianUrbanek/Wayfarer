import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { createInitialSimulationState, advancePolicyTurn } from '../../model/simulation.js';
import { buildSystemHealthSummary } from '../../ui/systemHealth.js';

function buildState() {
  const dataset = generateColumbusDataset({
    seed: 12345,
    numUsers: 8,
    numIslands: 10,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: { kind: 'fixed', value: 8 },
    ratingAlignmentDistribution: { kind: 'fixed', value: 8 }
  });
  let state = createInitialSimulationState({
    seed: 12345,
    allTags: dataset.allTags,
    latentUsers: dataset.users,
    cohorts: dataset.cohorts,
    islands: dataset.islands,
    initialRatingsPerUser: 3
  });
  state = advancePolicyTurn(state, {
    turnMode: 'mixed',
    participationModel: 'fixed-count',
    participatingUsersPerTurn: 3,
    participationChance: 0.5,
    organicRatingCountModel: 'fixed-count',
    organicRatingsPerUser: 2,
    organicRatingDice: '1d2',
    guidedRatingCountModel: 'fixed-count',
    guidedRecommendationsPerUser: 2,
    guidedRecommendationDice: '1d2',
    routingRiskProfile: 'balanced',
    customExplorationWeight: 0.55,
    customBadFitGuardThreshold: -0.1
  });
  state = advancePolicyTurn(state, {
    turnMode: 'mixed',
    participationModel: 'fixed-count',
    participatingUsersPerTurn: 3,
    participationChance: 0.5,
    organicRatingCountModel: 'fixed-count',
    organicRatingsPerUser: 2,
    organicRatingDice: '1d2',
    guidedRatingCountModel: 'fixed-count',
    guidedRecommendationsPerUser: 2,
    guidedRecommendationDice: '1d2',
    routingRiskProfile: 'balanced',
    customExplorationWeight: 0.55,
    customBadFitGuardThreshold: -0.1
  });
  return state;
}

function buildNoEvidenceState() {
  const dataset = generateColumbusDataset({
    seed: 777,
    numUsers: 8,
    numIslands: 10,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: { kind: 'fixed', value: 8 },
    ratingAlignmentDistribution: { kind: 'fixed', value: 8 }
  });
  return createInitialSimulationState({
    seed: 777,
    allTags: dataset.allTags,
    latentUsers: dataset.users,
    cohorts: dataset.cohorts,
    islands: dataset.islands,
    initialRatingsPerUser: 0
  });
}

function buildBootstrapOnlyState() {
  const dataset = generateColumbusDataset({
    seed: 778,
    numUsers: 8,
    numIslands: 10,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: { kind: 'fixed', value: 8 },
    ratingAlignmentDistribution: { kind: 'fixed', value: 8 }
  });
  return createInitialSimulationState({
    seed: 778,
    allTags: dataset.allTags,
    latentUsers: dataset.users,
    cohorts: dataset.cohorts,
    islands: dataset.islands,
    initialRatingsPerUser: 2
  });
}

describe('system health helper', () => {
  it('builds bounded top-level coverage and confidence values', () => {
    const summary = buildSystemHealthSummary(buildState());
    assert.equal(summary.systemCoverage >= 0 && summary.systemCoverage <= 1, true);
    assert.equal(summary.systemConfidence >= 0 && summary.systemConfidence <= 1, true);
  });

  it('returns turn-ordered bounded trend points', () => {
    const summary = buildSystemHealthSummary(buildState());
    for (let i = 1; i < summary.trend.length; i += 1) {
      assert.equal(summary.trend[i - 1].turn <= summary.trend[i].turn, true);
    }
    assert.equal(summary.trend.every((point) => point.systemCoverage >= 0 && point.systemCoverage <= 1), true);
    assert.equal(summary.trend.every((point) => point.systemConfidence >= 0 && point.systemConfidence <= 1), true);
  });

  it('uses comparable cumulative trend values for both deltas', () => {
    const summary = buildSystemHealthSummary(buildState());
    const first = summary.trend[0] ?? summary;
    assert.equal(summary.coverageDelta, summary.systemCoverage - first.systemCoverage);
    assert.equal(summary.confidenceDelta, summary.systemConfidence - first.systemConfidence);
  });

  it('coverage and confidence are distinct values', () => {
    const summary = buildSystemHealthSummary(buildState());
    assert.equal(summary.systemCoverage === summary.systemConfidence, false);
  });

  it('no rating events yields very low coverage and confidence', () => {
    const summary = buildSystemHealthSummary(buildNoEvidenceState());
    assert.equal(summary.systemCoverage < 0.2, true);
    assert.equal(summary.systemConfidence < 0.2, true);
    assert.equal(summary.playerConfidence < 0.1, true);
  });

  it('bootstrap can produce nonzero coverage without high confidence', () => {
    const summary = buildSystemHealthSummary(buildBootstrapOnlyState());
    assert.equal(summary.systemCoverage > 0, true);
    assert.equal(summary.systemConfidence < 0.75, true);
  });

  it('prevents final-state confidence leakage into early trend points', () => {
    const summary = buildSystemHealthSummary(buildState());
    assert.equal(summary.trend.length > 1, true);

    const first = summary.trend[0];
    const last = summary.trend[summary.trend.length - 1];

    assert.equal(first.turn <= last.turn, true);
    assert.equal(first.systemConfidence >= 0 && first.systemConfidence <= 1, true);
    assert.equal(last.systemConfidence >= 0 && last.systemConfidence <= 1, true);

    // Guard against regressions where every trend point is stamped with final-state confidence.
    const nonFinalPoint = summary.trend.slice(0, -1).some((point) =>
      Math.abs(point.systemConfidence - summary.systemConfidence) > 0.0001
    );
    assert.equal(nonFinalPoint, true);

    // Final cumulative trend point should align with the headline confidence.
    assert.equal(Math.abs(last.systemConfidence - summary.systemConfidence) < 0.05, true);
  });
});
