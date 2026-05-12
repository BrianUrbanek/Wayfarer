import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { buildIslandAffinityReports } from '../../model/affinity.js';
import { buildRaterSignalProfiles } from '../../model/raterSignal.js';
import { analyzeReviewerArchetypes } from '../../model/reviewerArchetypes.js';
import { computeInference } from '../../model/inference.js';
import { recommendIslandsForUser } from '../../model/recommendations.js';
import type { CohortAnchor, Island, MaybeRating, Rating, User } from '../../model/types.js';

function buildHiddenFixture() {
  const islands: Island[] = [
    { id: 'i-1', label: 'Island 1', hiddenClass: 'BROAD_HIT' },
    { id: 'i-2', label: 'Island 2', hiddenClass: 'NICHE_COHORT' },
    { id: 'i-3', label: 'Island 3', hiddenClass: 'BROAD_DUD' },
    { id: 'i-4', label: 'Island 4', hiddenClass: 'UNDECIDED' },
    { id: 'i-5', label: 'Island 5', hiddenClass: 'BROAD_HIT' },
    { id: 'i-6', label: 'Island 6', hiddenClass: 'NICHE_COHORT' }
  ];

  const cohorts: CohortAnchor[] = [
    {
      id: 'cohort-a',
      label: 'Cohort A',
      tags: ['alpha', 'beta'],
      ratings: {
        'i-1': 1,
        'i-2': 1,
        'i-3': -1,
        'i-4': 0,
        'i-5': 1,
        'i-6': -1
      },
      source: 'meta_moderator'
    },
    {
      id: 'cohort-b',
      label: 'Cohort B',
      tags: ['gamma', 'delta'],
      ratings: {
        'i-1': -1,
        'i-2': -1,
        'i-3': 1,
        'i-4': 0,
        'i-5': -1,
        'i-6': 1
      },
      source: 'meta_moderator'
    }
  ];

  const allTags = ['alpha', 'beta', 'gamma', 'delta', 'noise', 'random', 'theta', 'omega'];

  const makeUser = (
    id: string,
    label: string,
    declaredTags: string[],
    ratings: Record<string, MaybeRating>,
    hiddenReviewerArchetype: User['hiddenReviewerArchetype'],
    hiddenSeedCohortId?: string,
    hiddenDeclaredCohortId?: string,
    hiddenBehaviorCohortId?: string,
    hiddenReviewerChecksum = `${id}:checksum`
  ): User => ({
    id,
    label,
    declaredTags,
    ratings,
    hiddenSeedCohortId,
    hiddenDeclaredCohortId,
    hiddenBehaviorCohortId,
    hiddenReviewerArchetype,
    hiddenReviewerChecksum
  });

  const clean = makeUser('user-clean', 'Clean', cohorts[0].tags, { ...cohorts[0].ratings }, 'CLEAN_COHORT_MATCH', cohorts[0].id, cohorts[0].id, cohorts[0].id);
  const mislabeled = makeUser(
    'user-mislabeled',
    'Mislabeled',
    cohorts[1].tags,
    { ...cohorts[0].ratings },
    'MISLABELED_USER',
    cohorts[0].id,
    cohorts[1].id,
    cohorts[0].id
  );
  const inverse = makeUser(
    'user-inverse',
    'Inverse',
    cohorts[0].tags,
    {
      'i-1': -1,
      'i-2': -1,
      'i-3': 1,
      'i-4': 0,
      'i-5': -1,
      'i-6': 1
    },
    'INVERSE_RATER',
    cohorts[0].id,
    cohorts[0].id,
    cohorts[0].id
  );
  const noisy = makeUser(
    'user-noisy',
    'Noisy',
    ['noise', 'random'],
    {
      'i-1': null,
      'i-2': null,
      'i-3': null,
      'i-4': null,
      'i-5': null,
      'i-6': null
    },
    'RANDOM_NOISY_USER',
    cohorts[0].id,
    undefined,
    undefined
  );
  const tinaLike = makeUser(
    'user-tina',
    'Tina Like',
    ['theta', 'omega'],
    {
      'i-1': 1,
      'i-2': 1,
      'i-3': 0,
      'i-4': 0,
      'i-5': 1,
      'i-6': 1
    },
    'TINA_LIKE_DETACHED_PREDICTOR',
    cohorts[1].id,
    cohorts[1].id,
    cohorts[1].id
  );
  const early = makeUser(
    'user-early',
    'Early Scout',
    cohorts[0].tags,
    { ...cohorts[0].ratings },
    'EARLY_SCOUT',
    cohorts[0].id,
    cohorts[0].id,
    cohorts[0].id
  );
  const late = makeUser(
    'user-late',
    'Late Follower',
    cohorts[0].tags,
    { ...cohorts[0].ratings },
    'LATE_CONSENSUS_FOLLOWER',
    cohorts[0].id,
    cohorts[0].id,
    cohorts[0].id
  );
  const popularity = makeUser(
    'user-popularity',
    'Popularity Chaser',
    cohorts[1].tags,
    {
      'i-1': 1,
      'i-2': 0,
      'i-3': -1,
      'i-4': 0,
      'i-5': 1,
      'i-6': -1
    },
    'POPULARITY_CHASER',
    cohorts[1].id,
    cohorts[1].id,
    cohorts[1].id
  );
  const niche = makeUser(
    'user-niche',
    'Niche Specialist',
    cohorts[0].tags,
    {
      'i-1': -1,
      'i-2': 1,
      'i-3': -1,
      'i-4': 0,
      'i-5': -1,
      'i-6': 1
    },
    'NICHE_SPECIALIST',
    cohorts[0].id,
    cohorts[0].id,
    cohorts[0].id
  );

  const users = [clean, mislabeled, inverse, noisy, tinaLike, early, late, popularity, niche];

  const ratingEvents = users.flatMap((user) => {
    const turn = user.hiddenReviewerArchetype === 'EARLY_SCOUT' ? 1 : user.hiddenReviewerArchetype === 'LATE_CONSENSUS_FOLLOWER' ? 10 : 0;

      return Object.entries(user.ratings)
        .filter(([, rating]) => rating !== null)
        .map(([islandId, rating]) => ({
          id: `${turn}:${user.id}:${islandId}`,
          turn,
          userId: user.id,
          islandId,
          rating: rating as Rating,
          source:
            user.hiddenReviewerArchetype === 'EARLY_SCOUT' || user.hiddenReviewerArchetype === 'LATE_CONSENSUS_FOLLOWER'
              ? 'guided'
              : 'organic'
        }));
  });

  return { islands, cohorts, users, ratingEvents, allTags };
}

describe('reviewer archetype checksums', () => {
  it('adds hidden reviewer archetype metadata to generated users', () => {
    const dataset = generateColumbusDataset({
      seed: 90210,
      numUsers: 9,
      numIslands: 12,
      cohorts: createDefaultCohorts(),
      allTags: DEFAULT_TAGS,
      tagAlignmentDistribution: { kind: 'fixed', value: 10 },
      ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
    });

    assert.ok(dataset.users.every((user) => user.hiddenReviewerArchetype));
    assert.ok(dataset.users.every((user) => typeof user.hiddenReviewerChecksum === 'string' && user.hiddenReviewerChecksum.length > 0));
    assert.equal(dataset.users[0].hiddenReviewerArchetype, 'CLEAN_COHORT_MATCH');
  });

  it('keeps hidden archetype changes out of inference, signal, affinity, and recommendations', () => {
    const fixture = buildHiddenFixture();
    const first = fixture.users[0];
    const second: User = { ...first, hiddenReviewerArchetype: 'RANDOM_NOISY_USER', hiddenReviewerChecksum: 'mutated' };

    const firstInference = computeInference(first, fixture.cohorts, fixture.allTags, fixture.islands);
    const secondInference = computeInference(second, fixture.cohorts, fixture.allTags, fixture.islands);
    const firstSignals = buildRaterSignalProfiles([first], new Map([[first.id, firstInference]]), fixture.cohorts);
    const secondSignals = buildRaterSignalProfiles([second], new Map([[second.id, secondInference]]), fixture.cohorts);
    const firstAffinity = buildIslandAffinityReports(fixture.ratingEvents, firstSignals.byUserId, fixture.cohorts, fixture.islands);
    const secondAffinity = buildIslandAffinityReports(fixture.ratingEvents, secondSignals.byUserId, fixture.cohorts, fixture.islands);
    const firstRecommendations = recommendIslandsForUser(
      first,
      firstAffinity.byIslandId,
      firstSignals.byUserId,
      fixture.islands,
      { minPredictedFitFloor: -1, topLimit: 8 }
    );
    const secondRecommendations = recommendIslandsForUser(
      second,
      secondAffinity.byIslandId,
      secondSignals.byUserId,
      fixture.islands,
      { minPredictedFitFloor: -1, topLimit: 8 }
    );

    assert.deepEqual(secondInference, firstInference);
    assert.deepEqual(secondSignals.allProfiles[0], firstSignals.allProfiles[0]);
    assert.deepEqual(secondAffinity, firstAffinity);
    assert.deepEqual(secondRecommendations.recommendations, firstRecommendations.recommendations);
  });

  it('summarizes archetype recovery and analyst review candidates', () => {
    const fixture = buildHiddenFixture();
    const inferenceByUserId = new Map(
      fixture.users.map((user) => [user.id, computeInference(user, fixture.cohorts, fixture.allTags, fixture.islands)])
    );
    const signalProfiles = buildRaterSignalProfiles(fixture.users, inferenceByUserId, fixture.cohorts);
    const analysis = analyzeReviewerArchetypes(
      fixture.users,
      inferenceByUserId,
      signalProfiles.byUserId,
      fixture.cohorts,
      fixture.islands,
      fixture.ratingEvents
    );

    const byArchetype = analysis.recoverySummary.totalByArchetype;

    assert.equal(byArchetype.CLEAN_COHORT_MATCH, 1);
    assert.equal(byArchetype.MISLABELED_USER, 1);
    assert.equal(byArchetype.INVERSE_RATER, 1);
    assert.equal(byArchetype.RANDOM_NOISY_USER, 1);
    assert.equal(byArchetype.TINA_LIKE_DETACHED_PREDICTOR, 1);
    assert.ok(analysis.recoverySummary.matchCount >= 3);
    assert.ok(analysis.recoverySummary.uncertainCount >= 1);
    assert.ok(analysis.candidateSeedUsers.some((report) => report.hiddenReviewerArchetype === 'TINA_LIKE_DETACHED_PREDICTOR'));
    assert.ok(analysis.earlyScouts.some((report) => report.hiddenReviewerArchetype === 'EARLY_SCOUT'));
    assert.ok(analysis.popularityChasers.some((report) => report.hiddenReviewerArchetype === 'POPULARITY_CHASER'));
    assert.ok(analysis.noisyUsers.some((report) => report.hiddenReviewerArchetype === 'RANDOM_NOISY_USER'));
    assert.ok(Array.isArray(analysis.falsePositives));
    assert.ok(Array.isArray(analysis.falseNegatives));
  });
});
