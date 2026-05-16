import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { advancePolicyTurn, createInitialSimulationState } from '../../model/simulation.js';
import { buildSystemHealthSummary } from '../../ui/systemHealth.js';
import {
  getPlayerDiagnosisWeight,
  SYSTEM_HEALTH_FORMULA_AUDIT,
  SYSTEM_HEALTH_FORMULA_SPEC,
  sumFormulaWeights
} from '../../ui/systemHealthFormulas.js';

function buildState() {
  const dataset = generateColumbusDataset({
    seed: 9102,
    numUsers: 10,
    numIslands: 12,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: { kind: 'fixed', value: 8 },
    ratingAlignmentDistribution: { kind: 'fixed', value: 8 }
  });

  let state = createInitialSimulationState({
    seed: 9102,
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

  return state;
}

describe('system health formula specs', () => {
  it('exposes top-level composite weights for coverage and confidence', () => {
    assert.equal(SYSTEM_HEALTH_FORMULA_AUDIT.coverageComposite.length, 4);
    assert.equal(SYSTEM_HEALTH_FORMULA_AUDIT.confidenceComposite.length, 4);
    assert.equal(sumFormulaWeights(SYSTEM_HEALTH_FORMULA_AUDIT.coverageComposite), 1);
    assert.equal(sumFormulaWeights(SYSTEM_HEALTH_FORMULA_AUDIT.confidenceComposite), 1);
  });

  it('exposes and resolves player diagnosis weight lookup', () => {
    assert.equal(getPlayerDiagnosisWeight('HIGH_SIGNAL'), 1);
    assert.equal(getPlayerDiagnosisWeight('MISMATCH_RETAG'), 1);
    assert.equal(getPlayerDiagnosisWeight('LOW_SIGNAL'), 0.4);
    assert.equal(getPlayerDiagnosisWeight('SOMETHING_ELSE'), SYSTEM_HEALTH_FORMULA_SPEC.confidence.player.diagnosisWeights.AMBIGUOUS);
  });

  it('computation uses the same composite weights exposed to formula audit', () => {
    const summary = buildSystemHealthSummary(buildState());

    const expectedCoverage =
      (summary.playerCoverage * SYSTEM_HEALTH_FORMULA_AUDIT.coverageComposite[0].weight) +
      (summary.islandCoverage * SYSTEM_HEALTH_FORMULA_AUDIT.coverageComposite[1].weight) +
      (summary.cohortCoverage * SYSTEM_HEALTH_FORMULA_AUDIT.coverageComposite[2].weight) +
      (summary.tagCoverage * SYSTEM_HEALTH_FORMULA_AUDIT.coverageComposite[3].weight);

    const expectedConfidence =
      (summary.playerConfidence * SYSTEM_HEALTH_FORMULA_AUDIT.confidenceComposite[0].weight) +
      (summary.islandConfidence * SYSTEM_HEALTH_FORMULA_AUDIT.confidenceComposite[1].weight) +
      (summary.cohortConfidence * SYSTEM_HEALTH_FORMULA_AUDIT.confidenceComposite[2].weight) +
      (summary.tagConfidence * SYSTEM_HEALTH_FORMULA_AUDIT.confidenceComposite[3].weight);

    assert.equal(Math.abs(summary.systemCoverage - expectedCoverage) < 1e-9, true);
    assert.equal(Math.abs(summary.systemConfidence - expectedConfidence) < 1e-9, true);
  });
});
