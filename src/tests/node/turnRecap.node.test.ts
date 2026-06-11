import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildTurnRecapReport } from '../../model/turnRecap.js';
import type { IslandCohortRatingState } from '../../model/islandCohortRating.js';
import type { SimulationTurnSummary } from '../../model/simulation.js';
import type { CohortAnchor, Island } from '../../model/types.js';

function makeTurnSummary(turn: number, ratingsCreated: number, organicRatingsCreated: number, guidedRatingsCreated: number, mode: SimulationTurnSummary['mode']): SimulationTurnSummary {
  return {
    turn,
    mode,
    participatingUserIds: ['u-1'],
    ratingsCreated,
    organicRatingsCreated,
    guidedRatingsCreated,
    newlyRatedIslandIds: ['island-1'],
    routedIslandIds: ['island-1'],
    recommendationKinds: { SAFE_FIT: 1, SMART_GAMBLE: 0, DISCOVERY_PROBE: 0 },
    diagnosisCounts: { HIGH_SIGNAL: 0, MISMATCH_RETAG: 0, INVERSE_PROFILE: 0, UNKNOWN_OR_NOISY: 0, LOW_SIGNAL: 0, AMBIGUOUS: 0, UNEXPLAINED_PREDICTIVE: 0 }
  };
}

function makeSnapshot(overrides: Partial<IslandCohortRatingState> & Pick<IslandCohortRatingState, 'turn' | 'islandId' | 'cohortId'>): IslandCohortRatingState {
  return {
    rating: 0,
    ratingDeviation: 0.5,
    volatility: 0.08,
    affinity: 0,
    confidence: 0.5,
    uncertainty: 0.5,
    support: 0,
    effectiveWeight: 1,
    evidenceCount: 1,
    lastUpdatedTurn: overrides.turn,
    version: 1,
    ...overrides
  };
}

const islands: Island[] = [
  { id: 'island-1', label: 'Island 1' },
  { id: 'island-2', label: 'Island 2' }
];

const cohorts: CohortAnchor[] = [
  { id: 'cohort-a', label: 'Action', tags: ['tag-action'], ratings: { 'island-1': null, 'island-2': null }, source: 'analyst_defined' },
  { id: 'cohort-b', label: 'Story', tags: ['tag-story'], ratings: { 'island-1': null, 'island-2': null }, source: 'analyst_defined' }
];

const islandLabelById = new Map(islands.map((island) => [island.id, island.label] as const));
const cohortLabelById = new Map(cohorts.map((cohort) => [cohort.id, cohort.label] as const));

describe('turn recap helper', () => {
  it('highlights the largest turn-over-turn mover', () => {
    const report = buildTurnRecapReport({
      turnHistory: [
        makeTurnSummary(0, 0, 0, 0, 'organic'),
        makeTurnSummary(1, 4, 3, 1, 'mixed')
      ],
      islandCohortRatingSnapshots: [
        makeSnapshot({ turn: 0, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.1, confidence: 0.4, ratingDeviation: 0.6, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 }),
        makeSnapshot({ turn: 1, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.5, confidence: 0.8, ratingDeviation: 0.2, volatility: 0.05, effectiveWeight: 3, evidenceCount: 3 }),
        makeSnapshot({ turn: 0, islandId: 'island-1', cohortId: 'cohort-b', affinity: -0.1, confidence: 0.3, ratingDeviation: 0.7, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 }),
        makeSnapshot({ turn: 1, islandId: 'island-1', cohortId: 'cohort-b', affinity: -0.05, confidence: 0.31, ratingDeviation: 0.69, volatility: 0.09, effectiveWeight: 1.2, evidenceCount: 2 })
      ],
      islands,
      cohorts,
      islandLabelById,
      cohortLabelById
    });

    assert.equal(report.status, 'movers');
    assert.equal(report.highlightRows[0]?.islandLabel, 'Island 1');
    assert.equal(report.highlightRows[0]?.cohortLabel, 'Action');
  });

  it('keeps the headline on turn recap movers instead of unrelated audit language', () => {
    const report = buildTurnRecapReport({
      turnHistory: [
        makeTurnSummary(0, 0, 0, 0, 'organic'),
        makeTurnSummary(1, 1, 1, 0, 'organic')
      ],
      islandCohortRatingSnapshots: [
        makeSnapshot({ turn: 0, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.1, confidence: 0.4, ratingDeviation: 0.6, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 }),
        makeSnapshot({ turn: 1, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.3, confidence: 0.65, ratingDeviation: 0.35, volatility: 0.04, effectiveWeight: 2, evidenceCount: 2 }),
        makeSnapshot({ turn: 0, islandId: 'island-1', cohortId: 'cohort-b', affinity: -0.1, confidence: 0.3, ratingDeviation: 0.7, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 }),
        makeSnapshot({ turn: 1, islandId: 'island-1', cohortId: 'cohort-b', affinity: -0.05, confidence: 0.31, ratingDeviation: 0.69, volatility: 0.09, effectiveWeight: 1.2, evidenceCount: 2 })
      ],
      islands,
      cohorts,
      islandLabelById,
      cohortLabelById
    });

    assert.notEqual(report.status, 'possible-overfit');
    assert.equal(report.status, 'movers');
  });

  it('uses quiet-turn for a no-event turn instead of inventing movers', () => {
    const report = buildTurnRecapReport({
      turnHistory: [
        makeTurnSummary(0, 2, 2, 0, 'organic'),
        makeTurnSummary(1, 0, 0, 0, 'organic')
      ],
      islandCohortRatingSnapshots: [
        makeSnapshot({ turn: 0, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.1, confidence: 0.4, ratingDeviation: 0.6, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 }),
        makeSnapshot({ turn: 1, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.1, confidence: 0.4, ratingDeviation: 0.6, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 })
      ],
      islands: [islands[0]],
      cohorts: [cohorts[0]],
      islandLabelById: new Map([[islands[0].id, islands[0].label]]),
      cohortLabelById: new Map([[cohorts[0].id, cohorts[0].label]])
    });

    assert.equal(report.status, 'quiet-turn');
    assert.equal(report.ratingsCreated, 0);
    assert.match(report.summarySentence, /no ratings/i);
  });

  it('sorts equal-score movers deterministically by island and cohort label', () => {
    const report = buildTurnRecapReport({
      turnHistory: [
        makeTurnSummary(0, 1, 1, 0, 'organic'),
        makeTurnSummary(1, 1, 1, 0, 'organic')
      ],
      islandCohortRatingSnapshots: [
        makeSnapshot({ turn: 0, islandId: 'island-2', cohortId: 'cohort-b', affinity: 0.1, confidence: 0.4, ratingDeviation: 0.6, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 }),
        makeSnapshot({ turn: 1, islandId: 'island-2', cohortId: 'cohort-b', affinity: 0.3, confidence: 0.6, ratingDeviation: 0.4, volatility: 0.06, effectiveWeight: 2, evidenceCount: 2 }),
        makeSnapshot({ turn: 0, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.1, confidence: 0.4, ratingDeviation: 0.6, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 }),
        makeSnapshot({ turn: 1, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.3, confidence: 0.6, ratingDeviation: 0.4, volatility: 0.06, effectiveWeight: 2, evidenceCount: 2 })
      ],
      islands,
      cohorts,
      islandLabelById,
      cohortLabelById
    });

    assert.equal(report.highlightRows[0]?.islandLabel, 'Island 1');
    assert.equal(report.highlightRows[1]?.islandLabel, 'Island 2');
  });

  it('limits modal mover groups to meaningful rows only', () => {
    const report = buildTurnRecapReport({
      turnHistory: [
        makeTurnSummary(0, 1, 1, 0, 'organic'),
        makeTurnSummary(1, 1, 1, 0, 'organic')
      ],
      islandCohortRatingSnapshots: [
        makeSnapshot({ turn: 0, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.1, confidence: 0.4, ratingDeviation: 0.6, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 }),
        makeSnapshot({ turn: 1, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.12, confidence: 0.41, ratingDeviation: 0.59, volatility: 0.08, effectiveWeight: 1.02, evidenceCount: 1 }),
        makeSnapshot({ turn: 0, islandId: 'island-1', cohortId: 'cohort-b', affinity: -0.1, confidence: 0.3, ratingDeviation: 0.7, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 }),
        makeSnapshot({ turn: 1, islandId: 'island-1', cohortId: 'cohort-b', affinity: 0.3, confidence: 0.6, ratingDeviation: 0.4, volatility: 0.06, effectiveWeight: 2, evidenceCount: 2 })
      ],
      islands,
      cohorts,
      islandLabelById,
      cohortLabelById
    });

    assert.equal(report.meaningfulMoverCount, 1);
    assert.equal(report.highlightRows.length, 1);
    assert.equal(report.meaningfulRows.length, 1);
    assert.equal(report.meaningfulRows[0]?.cohortLabel, 'Story');
    assert.equal(report.rows[0]?.cohortLabel, 'Action');
  });

  it('marks bootstrap turns without a previous boundary as bootstrap', () => {
    const report = buildTurnRecapReport({
      turnHistory: [makeTurnSummary(0, 0, 0, 0, 'organic')],
      islandCohortRatingSnapshots: [
        makeSnapshot({ turn: 0, islandId: 'island-1', cohortId: 'cohort-a', affinity: 0.1, confidence: 0.4, ratingDeviation: 0.6, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 })
      ],
      islands: [islands[0]],
      cohorts: [cohorts[0]],
      islandLabelById: new Map([[islands[0].id, islands[0].label]]),
      cohortLabelById: new Map([[cohorts[0].id, cohorts[0].label]])
    });

    assert.equal(report.status, 'bootstrap');
    assert.equal(report.hasComparison, false);
  });
});
