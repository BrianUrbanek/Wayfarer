import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { buildObservedBehaviorAnalysis, buildObservedBehaviorEvents } from '../../model/observedBehavior.js';
import type { RatingEvent } from '../../model/simulation.js';
import type { User } from '../../model/types.js';

function buildUser(id: string, profile: User['hiddenBehaviorProfile']): User {
  return {
    id,
    label: id,
    declaredTags: [],
    ratings: {},
    hiddenBehaviorProfile: profile
  };
}

describe('observed behavior evidence', () => {
  it('assigns hidden behavior profiles deterministically during generation', () => {
    const first = generateColumbusDataset({
      seed: 12345,
      numUsers: 6,
      numIslands: 4,
      allTags: DEFAULT_TAGS,
      cohorts: createDefaultCohorts(),
      tagAlignmentDistribution: { kind: 'fixed', value: 10 },
      ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
    });
    const second = generateColumbusDataset({
      seed: 12345,
      numUsers: 6,
      numIslands: 4,
      allTags: DEFAULT_TAGS,
      cohorts: createDefaultCohorts(),
      tagAlignmentDistribution: { kind: 'fixed', value: 10 },
      ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
    });

    assert.deepEqual(
      first.users.map((user) => user.hiddenBehaviorProfile),
      second.users.map((user) => user.hiddenBehaviorProfile)
    );
    assert.ok(first.users.every((user) => user.hiddenBehaviorProfile));
  });

  it('generates one observed behavior event per rating event with stable source linkage', () => {
    const users = [buildUser('user-1', 'aligned')];
    const ratingEvents: RatingEvent[] = [
      { id: 'rating-1', turn: 0, userId: 'user-1', islandId: 'island-1', rating: 1, source: 'organic', raterSignalWeights: {} },
      { id: 'rating-2', turn: 0, userId: 'user-1', islandId: 'island-2', rating: 0, source: 'guided', raterSignalWeights: {} }
    ];

    const first = buildObservedBehaviorEvents(ratingEvents, users, 99);
    const second = buildObservedBehaviorEvents(ratingEvents, users, 99);

    assert.equal(first.length, ratingEvents.length);
    assert.deepEqual(first, second);
    assert.equal(first[0]?.sourceRatingEventId, 'rating-1');
    assert.equal(first[1]?.sourceRatingEventId, 'rating-2');
  });

  it('skews positive-drift and negative-drift behavior in the expected directions', () => {
    const positiveUser = buildUser('positive-user', 'positive-drift');
    const negativeUser = buildUser('negative-user', 'negative-drift');
    const positiveRatings: RatingEvent[] = Array.from({ length: 80 }, (_, index) => ({
      id: `p-${index}`,
      turn: 0,
      userId: positiveUser.id,
      islandId: `island-${index}`,
      rating: 0,
      source: 'organic' as const,
      raterSignalWeights: {}
    }));
    const negativeRatings: RatingEvent[] = Array.from({ length: 80 }, (_, index) => ({
      id: `n-${index}`,
      turn: 0,
      userId: negativeUser.id,
      islandId: `island-${index}`,
      rating: 0,
      source: 'organic' as const,
      raterSignalWeights: {}
    }));

    const positiveEvents = buildObservedBehaviorEvents(positiveRatings, [positiveUser], 11);
    const negativeEvents = buildObservedBehaviorEvents(negativeRatings, [negativeUser], 11);

    const positiveCounts = positiveEvents.reduce(
      (counts, event) => {
        if (event.kind === 'completion' || event.kind === 'replay' || event.kind === 'return') {
          counts.positive += 1;
        } else if (event.kind === 'bounce' || event.kind === 'abandon') {
          counts.negative += 1;
        }
        return counts;
      },
      { positive: 0, negative: 0 }
    );
    const negativeCounts = negativeEvents.reduce(
      (counts, event) => {
        if (event.kind === 'completion' || event.kind === 'replay' || event.kind === 'return') {
          counts.positive += 1;
        } else if (event.kind === 'bounce' || event.kind === 'abandon') {
          counts.negative += 1;
        }
        return counts;
      },
      { positive: 0, negative: 0 }
    );

    assert.ok(positiveCounts.positive > positiveCounts.negative);
    assert.ok(negativeCounts.negative > negativeCounts.positive);
  });

  it('summarizes behavior counts by island and turn', () => {
    const events = [
      { id: 'b-1', turn: 0, userId: 'user-1', islandId: 'island-1', kind: 'completion' as const, value: 1, sourceRatingEventId: 'rating-1' },
      { id: 'b-2', turn: 1, userId: 'user-1', islandId: 'island-1', kind: 'bounce' as const, value: 1, sourceRatingEventId: 'rating-2' },
      { id: 'b-3', turn: 1, userId: 'user-1', islandId: 'island-2', kind: 'qualified-play' as const, value: 0, sourceRatingEventId: 'rating-3' }
    ];

    const analysis = buildObservedBehaviorAnalysis(events);

    assert.equal(analysis.totalEvents, 3);
    assert.equal(analysis.counts.completion, 1);
    assert.equal(analysis.counts.bounce, 1);
    assert.equal(analysis.byTurn[1]?.totalEvents, 2);
    assert.equal(analysis.byIslandId.get('island-1')?.totalEvents, 2);
  });
});
