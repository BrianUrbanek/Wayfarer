import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPairEvidenceViewModel } from '../../ui/liveEvidenceViewModel.js';
import type { RatingEvent, RatingRefreshEvent } from '../../model/simulation.js';
import type { InferredRatingEvidenceRecord } from '../../model/types.js';

const weights = { cohort: 1 };

describe('canonical live evidence view model', () => {
  it('separates current explicit stated evidence from historical and superseded ratings', () => {
    const refreshEvents: RatingRefreshEvent[] = [{ id: 'patch-1', turn: 1, kind: 'gamePatch' }];
    const ratingEvents: RatingEvent[] = [
      {
        id: 'rating-0',
        turn: 0,
        userId: 'user-1',
        islandId: 'island-1',
        rating: -1,
        source: 'organic',
        raterSignalWeights: weights,
        epoch: { world: 0, island: 0 },
        islandVersionId: 'island:island-1:v0',
        gameRulesVersionId: 'game-rules-v0'
      },
      {
        id: 'rating-2',
        turn: 2,
        userId: 'user-1',
        islandId: 'island-1',
        rating: 1,
        source: 'guided',
        raterSignalWeights: weights,
        revisionReason: 'gamePatchRefresh',
        supersedesEventId: 'rating-0',
        epoch: { world: 1, island: 0 },
        islandVersionId: 'island:island-1:v1',
        gameRulesVersionId: 'game-rules-v1'
      }
    ];

    const view = buildPairEvidenceViewModel({
      userId: 'user-1',
      islandId: 'island-1',
      ratingEvents,
      inferredRatingEvidence: [],
      observedBehaviorEvents: [],
      refreshEvents
    });

    assert.equal(view.explicitStated.current?.id, 'rating-2');
    assert.deepEqual(view.explicitStated.historical.map((event) => event.id), ['rating-0']);
    assert.deepEqual(view.explicitStated.superseded.map((event) => event.id), ['rating-0']);
    assert.equal(view.refreshContext.state, 'canonical');
  });

  it('derives current and historical explicit evidence from refresh boundaries instead of version fields', () => {
    const view = buildPairEvidenceViewModel({
      userId: 'user-1',
      islandId: 'island-1',
      ratingEvents: [
        {
          id: 'rating-before-update',
          turn: 0,
          userId: 'user-1',
          islandId: 'island-1',
          rating: 1,
          source: 'organic',
          raterSignalWeights: weights,
          epoch: { world: 0, island: 0 }
        },
        {
          id: 'rating-after-update',
          turn: 2,
          userId: 'user-1',
          islandId: 'island-1',
          rating: -1,
          source: 'organic',
          raterSignalWeights: weights,
          epoch: { world: 0, island: 1 }
        }
      ],
      inferredRatingEvidence: [],
      observedBehaviorEvents: [],
      refreshEvents: [{ id: 'update-1', turn: 1, kind: 'islandUpdate', islandId: 'island-1' }]
    });

    assert.equal(view.explicitStated.current?.id, 'rating-after-update');
    assert.deepEqual(view.explicitStated.historical.map((event) => event.id), ['rating-before-update']);
    assert.equal(view.explicitStated.state, 'canonical');
    assert.deepEqual(view.explicitStated.currentEpoch, { world: 0, island: 1 });
    assert.deepEqual(view.explicitStated.currentIslandEpoch, { world: 0, island: 1 });
    assert.equal(view.explicitStated.freshness, 'current-context');
  });

  it('preserves latest stated rating as prior-context after refresh when no current re-rating exists', () => {
    const view = buildPairEvidenceViewModel({
      userId: 'user-1',
      islandId: 'island-1',
      ratingEvents: [
        {
          id: 'rating-before-update',
          turn: 0,
          userId: 'user-1',
          islandId: 'island-1',
          rating: 1,
          source: 'organic',
          raterSignalWeights: weights,
          epoch: { world: 0, island: 0 }
        }
      ],
      inferredRatingEvidence: [],
      observedBehaviorEvents: [],
      refreshEvents: [{ id: 'update-1', turn: 1, kind: 'gamePatch' }]
    });

    assert.equal(view.explicitStated.current?.id, 'rating-before-update');
    assert.deepEqual(view.explicitStated.historical.map((event) => event.id), ['rating-before-update']);
    assert.equal(view.explicitStated.state, 'canonical');
    assert.equal(view.explicitStated.freshness, 'prior-world-context');
    assert.match(view.explicitStated.note, /prior/i);
  });

  it('keeps inferred revealed evidence and synthetic observed behavior distinct', () => {
    const inferred: InferredRatingEvidenceRecord[] = [
      {
        id: 'inferred-old',
        turn: 1,
        userId: 'user-1',
        islandId: 'island-1',
        rating: -1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v1',
        confidence: 0.99,
        provenance: 'older upstream inference',
        epoch: { world: 0, island: 0 }
      },
      {
        id: 'inferred-current',
        turn: 2,
        userId: 'user-1',
        islandId: 'island-1',
        rating: 1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v2',
        confidence: 0.7,
        provenance: 'current upstream inference',
        epoch: { world: 0, island: 0 }
      }
    ];

    const view = buildPairEvidenceViewModel({
      userId: 'user-1',
      islandId: 'island-1',
      ratingEvents: [],
      inferredRatingEvidence: inferred,
      observedBehaviorEvents: [
        {
          id: 'behavior-1',
          turn: 2,
          userId: 'user-1',
          islandId: 'island-1',
          kind: 'completion',
          value: 1,
          sourceRatingEventId: 'rating-2'
        }
      ],
      refreshEvents: []
    });

    assert.equal(view.inferredRevealed.current?.id, 'inferred-current');
    assert.equal(view.inferredRevealed.records.length, 2);
    assert.equal(view.syntheticObservedBehavior.records.length, 1);
    assert.equal(view.inferredRevealed.category, 'inferred-revealed-preference-evidence');
    assert.equal(view.syntheticObservedBehavior.category, 'synthetic-observed-behavior');
    assert.equal(view.diagnostics.state, 'insufficient-evidence');
  });

  it('treats stale inferred evidence as historical after refresh', () => {
    const inferred: InferredRatingEvidenceRecord[] = [
      {
        id: 'stale-inferred',
        turn: 1,
        userId: 'user-1',
        islandId: 'island-1',
        rating: 1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v1',
        confidence: 0.99,
        provenance: 'old upstream read',
        epoch: { world: 0, island: 0 },
        gameRulesVersionId: 'game-rules-v0',
        islandVersionId: 'island:island-1:v0'
      },
      {
        id: 'current-inferred',
        turn: 2,
        userId: 'user-1',
        islandId: 'island-1',
        rating: -1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v1',
        confidence: 0.5,
        provenance: 'current upstream read',
        epoch: { world: 1, island: 0 },
        gameRulesVersionId: 'game-rules-v3',
        islandVersionId: 'island:island-1:v3'
      }
    ];

    const view = buildPairEvidenceViewModel({
      userId: 'user-1',
      islandId: 'island-1',
      ratingEvents: [],
      inferredRatingEvidence: inferred,
      observedBehaviorEvents: [],
      refreshEvents: [{ id: 'patch-3', turn: 3, kind: 'gamePatch' }]
    });

    assert.equal(view.inferredRevealed.current?.id, 'current-inferred');
    assert.deepEqual(view.inferredRevealed.historical.map((entry) => entry.id), ['stale-inferred']);
    assert.equal(view.inferredRevealed.freshness, 'current-context');
  });

  it('marks inferred evidence without epoch as context unknown', () => {
    const view = buildPairEvidenceViewModel({
      userId: 'user-1',
      islandId: 'island-1',
      ratingEvents: [],
      inferredRatingEvidence: [
        {
          id: 'legacy-inferred',
          turn: 1,
          userId: 'user-1',
          islandId: 'island-1',
          rating: 1,
          source: 'inferred',
          sourceSystem: 'upstream',
          sourceVersion: 'v1',
          confidence: 0.5,
          provenance: 'legacy upstream read'
        }
      ],
      observedBehaviorEvents: [],
      refreshEvents: []
    });

    assert.equal(view.inferredRevealed.current?.id, 'legacy-inferred');
    assert.equal(view.inferredRevealed.state, 'compatibility');
    assert.equal(view.inferredRevealed.freshness, 'context-unknown');
  });

  it('keeps explicit ratings without version context current when no refresh boundary excludes them', () => {
    const view = buildPairEvidenceViewModel({
      userId: 'user-1',
      islandId: 'island-1',
      ratingEvents: [
        {
          id: 'legacy-rating',
          turn: 0,
          userId: 'user-1',
          islandId: 'island-1',
          rating: 1,
          source: 'organic',
          raterSignalWeights: weights
        }
      ],
      inferredRatingEvidence: [],
      observedBehaviorEvents: [],
      refreshEvents: []
    });

    assert.equal(view.explicitStated.current?.id, 'legacy-rating');
    assert.equal(view.explicitStated.state, 'canonical');
    assert.deepEqual(view.explicitStated.currentEpoch, { world: 0, island: 0 });
    assert.equal(view.explicitStated.freshness, 'current-context');
  });
});
