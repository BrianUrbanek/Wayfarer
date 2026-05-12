import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSeededRandom } from '../../generator/seededRandom.js';
import {
  DEFAULT_TURN_POLICY,
  describeRoutingRiskProfile,
  getTurnModeVisibility,
  resolveRatingCount,
  resolveRoutingRiskProfileValues,
  selectParticipatingUsers
} from '../../model/turnPolicy.js';
import type { User } from '../../model/types.js';

function buildUsers(count: number): User[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `user-${index + 1}`,
    label: `User ${index + 1}`,
    declaredTags: [],
    ratings: {}
  }));
}

describe('turn policy helpers', () => {
  it('shows the correct dynamic sections for each turn mode', () => {
    assert.deepEqual(getTurnModeVisibility('organic'), {
      showOrganic: true,
      showGuided: false,
      showRouting: false
    });

    assert.deepEqual(getTurnModeVisibility('guided'), {
      showOrganic: false,
      showGuided: true,
      showRouting: true
    });

    assert.deepEqual(getTurnModeVisibility('mixed'), {
      showOrganic: true,
      showGuided: true,
      showRouting: true
    });
  });

  it('resolves routing presets and preserves custom values', () => {
    assert.deepEqual(resolveRoutingRiskProfileValues('balanced', DEFAULT_TURN_POLICY.customRoutingValues), {
      explorationWeight: 0.55,
      minimumPredictedFit: 0.25
    });

    assert.deepEqual(
      resolveRoutingRiskProfileValues('custom', { explorationWeight: 0.9, minimumPredictedFit: 0.4 }),
      { explorationWeight: 0.9, minimumPredictedFit: 0.4 }
    );

    assert.equal(
      describeRoutingRiskProfile('custom', { explorationWeight: 0.9, minimumPredictedFit: 0.4 }).includes('0.90'),
      true
    );
  });

  it('describes non-custom routing profiles with their preset values', () => {
    const description = describeRoutingRiskProfile('conservative', DEFAULT_TURN_POLICY.customRoutingValues);

    assert.equal(description, 'Conservative: exploration 0.25 | minimum fit 0.45');
  });

  it('selects participating users by fixed count or chance per user', () => {
    const users = buildUsers(5);
    const fixed = selectParticipatingUsers(createSeededRandom(12), users, 'fixed-count', 3, 0.5);
    const chanceAll = selectParticipatingUsers(createSeededRandom(12), users, 'chance-per-user', 5, 1);
    const chanceNone = selectParticipatingUsers(createSeededRandom(12), users, 'chance-per-user', 5, 0);

    assert.equal(fixed.length, 3);
    assert.equal(chanceAll.length, users.length);
    assert.equal(chanceNone.length, 0);
  });

  it('resolves rating counts from fixed values and dice expressions', () => {
    assert.equal(resolveRatingCount(createSeededRandom(12), 'fixed-count', 4, '1d6'), 4);

    const value = resolveRatingCount(createSeededRandom(12), 'dice-expression', 4, '2d6');
    assert.ok(value >= 2 && value <= 12);
  });

  it('treats seeded chance-per-user selection deterministically', () => {
    const users = buildUsers(8);
    const first = selectParticipatingUsers(createSeededRandom(99), users, 'chance-per-user', 4, 0.5);
    const second = selectParticipatingUsers(createSeededRandom(99), users, 'chance-per-user', 4, 0.5);

    assert.deepEqual(first.map((user) => user.id), second.map((user) => user.id));
  });
});
