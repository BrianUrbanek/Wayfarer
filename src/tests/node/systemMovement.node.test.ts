import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemMovementAnalysis } from '../../model/systemMovement.js';
import type { ObservedBehaviorEvent } from '../../model/observedBehavior.js';
import type { IslandCohortRatingState } from '../../model/islandCohortRating.js';
import type { CohortAnchor } from '../../model/types.js';

function snapshot(input: Partial<IslandCohortRatingState> & Pick<IslandCohortRatingState, 'turn' | 'islandId' | 'cohortId' | 'affinity' | 'confidence'>): IslandCohortRatingState {
  return {
    rating: input.affinity,
    ratingDeviation: 0.4,
    volatility: 0.05,
    uncertainty: 1 - input.confidence,
    effectiveWeight: 2,
    evidenceCount: 3,
    lastUpdatedTurn: input.turn,
    version: 1,
    ...input
  };
}

function cohort(id: string): CohortAnchor {
  return { id, label: id.toUpperCase(), tags: [], ratings: {}, source: 'analyst_defined' };
}

describe('system movement analysis', () => {
  it('classifies island-level dominant signal without duplicating confidence color', () => {
    const analysis = buildSystemMovementAnalysis({
      islands: [
        { id: 'narrow', label: 'Narrow Fit' },
        { id: 'broad', label: 'Broad Fit' },
        { id: 'polarized', label: 'Polarized Fit' },
        { id: 'gap', label: 'Gap Fit' }
      ],
      cohorts: [cohort('c1'), cohort('c2'), cohort('c3')],
      observedBehaviorEvents: [],
      islandCohortRatingSnapshots: [
        snapshot({ turn: 1, islandId: 'narrow', cohortId: 'c1', affinity: 0.55, confidence: 0.75 }),
        snapshot({ turn: 1, islandId: 'narrow', cohortId: 'c2', affinity: 0.04, confidence: 0.62 }),
        snapshot({ turn: 1, islandId: 'narrow', cohortId: 'c3', affinity: 0.01, confidence: 0.6 }),
        snapshot({ turn: 1, islandId: 'broad', cohortId: 'c1', affinity: 0.5, confidence: 0.7 }),
        snapshot({ turn: 1, islandId: 'broad', cohortId: 'c2', affinity: 0.42, confidence: 0.72 }),
        snapshot({ turn: 1, islandId: 'broad', cohortId: 'c3', affinity: 0.36, confidence: 0.69 }),
        snapshot({ turn: 1, islandId: 'polarized', cohortId: 'c1', affinity: 0.48, confidence: 0.76 }),
        snapshot({ turn: 1, islandId: 'polarized', cohortId: 'c2', affinity: -0.52, confidence: 0.78 }),
        snapshot({ turn: 1, islandId: 'polarized', cohortId: 'c3', affinity: 0.02, confidence: 0.5 }),
        snapshot({ turn: 1, islandId: 'gap', cohortId: 'c1', affinity: 0.45, confidence: 0.72 }),
        snapshot({ turn: 1, islandId: 'gap', cohortId: 'c2', affinity: 0.42, confidence: 0.68 }),
        snapshot({ turn: 1, islandId: 'gap', cohortId: 'c3', affinity: 0.1, confidence: 0.2, evidenceCount: 1 })
      ]
    });

    const frame = analysis.frames[0];
    const signalByIsland = new Map(frame.points.map((point) => [point.islandId, point.dominantSignal] as const));

    assert.equal(signalByIsland.get('narrow'), 'narrow-appeal');
    assert.equal(signalByIsland.get('broad'), 'broad-appeal');
    assert.equal(signalByIsland.get('polarized'), 'polarized-appeal');
    assert.equal(signalByIsland.get('gap'), 'coverage-gap');
    assert.ok((frame.points.find((point) => point.islandId === 'gap')?.legibility ?? 0) > 0.4);
    assert.ok(frame.domain.xMin < frame.domain.xMax);
    assert.ok(frame.domain.yMin < frame.domain.yMax);
    assert.equal(analysis.auditRows.length, 4);
  });

  it('prioritizes contradiction and volatility as dominant system movement signals', () => {
    const observedBehaviorEvents: ObservedBehaviorEvent[] = [
      {
        id: 'behavior-1',
        turn: 2,
        userId: 'u1',
        islandId: 'contradiction',
        sourceRatingEventId: 'rating-1',
        kind: 'bounce',
        value: 1
      }
    ];

    const analysis = buildSystemMovementAnalysis({
      islands: [
        { id: 'contradiction', label: 'Contradiction' },
        { id: 'volatile', label: 'Volatile' }
      ],
      cohorts: [cohort('c1'), cohort('c2')],
      observedBehaviorEvents,
      islandCohortRatingSnapshots: [
        snapshot({ turn: 1, islandId: 'contradiction', cohortId: 'c1', affinity: 0.45, confidence: 0.7 }),
        snapshot({ turn: 1, islandId: 'contradiction', cohortId: 'c2', affinity: 0.4, confidence: 0.7 }),
        snapshot({ turn: 2, islandId: 'contradiction', cohortId: 'c1', affinity: 0.48, confidence: 0.76 }),
        snapshot({ turn: 2, islandId: 'contradiction', cohortId: 'c2', affinity: 0.42, confidence: 0.73 }),
        snapshot({ turn: 1, islandId: 'volatile', cohortId: 'c1', affinity: -0.1, confidence: 0.55 }),
        snapshot({ turn: 1, islandId: 'volatile', cohortId: 'c2', affinity: -0.08, confidence: 0.57 }),
        snapshot({ turn: 2, islandId: 'volatile', cohortId: 'c1', affinity: 0.55, confidence: 0.7, volatility: 0.22 }),
        snapshot({ turn: 2, islandId: 'volatile', cohortId: 'c2', affinity: 0.5, confidence: 0.69, volatility: 0.2 })
      ]
    });

    const frame = analysis.frames.find((entry) => entry.turn === 2);
    const signalByIsland = new Map(frame?.points.map((point) => [point.islandId, point.dominantSignal] as const));
    const volatileTrail = frame?.points.find((point) => point.islandId === 'volatile')?.trail ?? [];

    assert.equal(signalByIsland.get('contradiction'), 'contradiction');
    assert.equal(signalByIsland.get('volatile'), 'volatility');
    assert.deepEqual(volatileTrail.map((point) => point.turn), [1]);
    assert.deepEqual(
      analysis.auditRows
        .filter((row) => row.turn === 2)
        .map((row) => [row.islandId, row.dominantSignal, row.profileDelta !== null, row.moverReason.includes('dominant delta')]),
      [
        ['contradiction', 'contradiction', true, true],
        ['volatile', 'volatility', true, true]
      ]
    );
  });
});
