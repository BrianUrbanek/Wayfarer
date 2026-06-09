import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStatedRevealedPreferenceDiagnostic,
  chooseCurrentInferredEvidence
} from '../../model/inferredRatingEvidence.js';

describe('inferred rating evidence diagnostics', () => {
  it('covers aligned positive negative contradiction and insufficient states directly', () => {
    const alignedPositive = buildStatedRevealedPreferenceDiagnostic({
      userId: 'user-1',
      islandId: 'island-1',
      explicitRating: 1,
      inferredEvidence: {
        id: 'inf-1',
        turn: 2,
        userId: 'user-1',
        islandId: 'island-1',
        rating: 1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v1',
        confidence: 0.9,
        provenance: 'source'
      }
    });
    const alignedNegative = buildStatedRevealedPreferenceDiagnostic({
      userId: 'user-1',
      islandId: 'island-1',
      explicitRating: -1,
      inferredEvidence: {
        id: 'inf-2',
        turn: 2,
        userId: 'user-1',
        islandId: 'island-1',
        rating: -1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v1',
        confidence: 0.9,
        provenance: 'source'
      }
    });
    const statedPositiveRevealedNegative = buildStatedRevealedPreferenceDiagnostic({
      userId: 'user-1',
      islandId: 'island-1',
      explicitRating: 1,
      inferredEvidence: {
        id: 'inf-3',
        turn: 2,
        userId: 'user-1',
        islandId: 'island-1',
        rating: -1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v1',
        confidence: 0.9,
        provenance: 'source'
      }
    });
    const statedNegativeRevealedPositive = buildStatedRevealedPreferenceDiagnostic({
      userId: 'user-1',
      islandId: 'island-1',
      explicitRating: -1,
      inferredEvidence: {
        id: 'inf-4',
        turn: 2,
        userId: 'user-1',
        islandId: 'island-1',
        rating: 1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v1',
        confidence: 0.9,
        provenance: 'source'
      }
    });
    const insufficient = buildStatedRevealedPreferenceDiagnostic({
      userId: 'user-1',
      islandId: 'island-1',
      explicitRating: 1,
      inferredEvidence: null
    });

    assert.equal(alignedPositive.state, 'aligned-positive');
    assert.equal(alignedNegative.state, 'aligned-negative');
    assert.equal(statedPositiveRevealedNegative.state, 'stated-positive-revealed-negative');
    assert.equal(statedNegativeRevealedPositive.state, 'stated-negative-revealed-positive');
    assert.equal(insufficient.state, 'insufficient-evidence');
  });

  it('prefers the most recent inferred evidence deterministically', () => {
    const inferred = chooseCurrentInferredEvidence([
      {
        id: 'stale',
        turn: 1,
        userId: 'user-1',
        islandId: 'island-1',
        rating: -1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v1',
        confidence: 0.99,
        provenance: 'older'
      },
      {
        id: 'current-low',
        turn: 2,
        userId: 'user-1',
        islandId: 'island-1',
        rating: 1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v1',
        confidence: 0.5,
        provenance: 'current'
      },
      {
        id: 'current-high',
        turn: 2,
        userId: 'user-1',
        islandId: 'island-1',
        rating: 1,
        source: 'inferred',
        sourceSystem: 'upstream',
        sourceVersion: 'v1',
        confidence: 0.95,
        provenance: 'best'
      }
    ]);

    assert.equal(inferred?.id, 'current-high');
  });
});
