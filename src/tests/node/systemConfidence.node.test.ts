import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { createInitialSimulationState, advancePolicyTurn } from '../../model/simulation.js';
import { buildSystemConfidenceSummary } from '../../ui/systemConfidence.js';

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
    customMinimumPredictedFit: -0.1
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
    customMinimumPredictedFit: -0.1
  });
  return state;
}

describe('system confidence helper', () => {
  it('builds bounded top-level and subcomponent confidence values', () => {
    const summary = buildSystemConfidenceSummary(buildState());
    assert.equal(summary.systemConfidence >= 0 && summary.systemConfidence <= 1, true);
    assert.equal(summary.playerBaseConfidence >= 0 && summary.playerBaseConfidence <= 1, true);
    assert.equal(summary.islandOptionsConfidence >= 0 && summary.islandOptionsConfidence <= 1, true);
    assert.equal(summary.cohortOptionsConfidence >= 0 && summary.cohortOptionsConfidence <= 1, true);
    assert.equal(summary.tagOptionsConfidence >= 0 && summary.tagOptionsConfidence <= 1, true);
  });

  it('returns turn-ordered bounded trend points', () => {
    const summary = buildSystemConfidenceSummary(buildState());
    for (let i = 1; i < summary.trend.length; i += 1) {
      assert.equal(summary.trend[i - 1].turn <= summary.trend[i].turn, true);
    }
    assert.equal(summary.trend.every((point) => point.systemConfidence >= 0 && point.systemConfidence <= 1), true);
  });

  it('uses comparable cumulative trend values for run delta', () => {
    const summary = buildSystemConfidenceSummary(buildState());
    const first = summary.trend[0]?.systemConfidence ?? summary.systemConfidence;
    assert.equal(summary.runDelta, summary.systemConfidence - first);
  });

  it('keeps stable-run trend and delta plausible', () => {
    const summary = buildSystemConfidenceSummary(buildState());
    const first = summary.trend[0]?.systemConfidence ?? summary.systemConfidence;
    assert.equal(summary.systemConfidence >= first, true);
  });
});
