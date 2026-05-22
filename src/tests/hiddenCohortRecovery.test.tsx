import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { CohortAffinityEstimate, IslandAffinityReport } from '../model/affinity';
import { buildHiddenCohortRecoveryReport } from '../model/hiddenCohortRecovery';
import { HiddenCohortRecoveryPanel, HiddenCohortRecoveryModal } from '../ui/recovery/HiddenCohortRecoveryPanel';
import type { HiddenTasteCohort, Island, Rating, User } from '../model/types';
import type { ObservedBehaviorEvent } from '../model/observedBehavior';
import type { RatingEvent } from '../model/simulation';

function makeEstimate(overrides: Partial<CohortAffinityEstimate> & { cohortId: string }): CohortAffinityEstimate {
  const { cohortId, islandId: ignoredIslandId, ...rest } = overrides;
  void ignoredIslandId;
  return {
    islandId: 'island',
    cohortId,
    rating: 0,
    affinity: 0,
    confidence: 0,
    ratingDeviation: 1,
    volatility: 0.08,
    observedMean: 0,
    disagreement: 0,
    uncertainty: 1,
    rawCount: 0,
    effectiveWeight: 0,
    evidenceCount: 0,
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0,
    contributions: [],
    lastUpdatedTurn: 0,
    version: 1,
    ...rest
  };
}

const cohortLabels = new Map([
  ['cohort-action', 'Competitive / Skill Expression'],
  ['cohort-story', 'Roleplay / Social']
]);

function makeIsland(overrides: Partial<Island> & { id: string; label: string }): Island {
  const { id, label, ...rest } = overrides;
  return {
    id,
    label,
    ...rest
  };
}

function makeUser(overrides: Partial<User> & { id: string; label: string; hiddenTasteCohortId: string }): User {
  const {
    id,
    label,
    hiddenTasteCohortId,
    hiddenTasteCohortKind,
    hiddenSeedCohortId,
    hiddenDeclaredCohortId,
    hiddenBehaviorCohortId,
    hiddenBehaviorProfile,
    hiddenTastePreferenceVector,
    hiddenTagAlignment,
    hiddenRatingAlignment,
    hiddenReviewerArchetype,
    hiddenReviewerChecksum,
    ...rest
  } = overrides;
  return {
    id,
    label,
    declaredTags: [],
    ratings: { island: null },
    hiddenTasteCohortId,
    hiddenTasteCohortKind: hiddenTasteCohortKind ?? 'seed',
    hiddenSeedCohortId,
    hiddenDeclaredCohortId,
    hiddenBehaviorCohortId,
    hiddenBehaviorProfile,
    hiddenTastePreferenceVector,
    hiddenTagAlignment,
    hiddenRatingAlignment,
    hiddenReviewerArchetype,
    hiddenReviewerChecksum,
    ...rest
  };
}

describe('hidden cohort recovery', () => {
  it('counts seeded and unseeded cohorts and marks them recovered when learned evidence supports them', () => {
    const hiddenTasteCohorts: HiddenTasteCohort[] = [
      {
        id: 'hidden-seed-1',
        label: 'Hidden Action',
        kind: 'seed',
        sourceSeedCohortId: 'cohort-action',
        projectedSeedCohortId: 'cohort-action',
        preferenceVector: { 'tag-action': 1 },
        tagSignature: ['tag-action']
      },
      {
        id: 'hidden-unseeded-1',
        label: 'Hidden Social',
        kind: 'unseeded',
        sourceSeedCohortId: 'cohort-story',
        projectedSeedCohortId: 'cohort-story',
        preferenceVector: { 'tag-story': 1 },
        tagSignature: ['tag-story']
      }
    ];
    const users: User[] = [
      makeUser({ id: 'user-1', label: 'User 1', hiddenTasteCohortId: 'hidden-seed-1', hiddenTasteCohortKind: 'seed' }),
      makeUser({ id: 'user-2', label: 'User 2', hiddenTasteCohortId: 'hidden-unseeded-1', hiddenTasteCohortKind: 'unseeded' })
    ];
    const islands: Island[] = [
      makeIsland({
        id: 'island-seed',
        label: 'Island Seed',
        hiddenTruthClass: 'seed-cohort-match',
        hiddenTargetTasteCohortId: 'hidden-seed-1'
      }),
      makeIsland({
        id: 'island-unseeded',
        label: 'Island Unseeded',
        hiddenTruthClass: 'unseeded-cohort-match',
        hiddenTargetTasteCohortId: 'hidden-unseeded-1'
      })
    ];
    const ratingEvents: RatingEvent[] = [
      {
        id: 'event-1',
        turn: 1,
        userId: 'user-1',
        islandId: 'island-seed',
        rating: 1 as Rating,
        source: 'organic',
        raterSignalWeights: { 'cohort-action': 1, 'cohort-story': 0.2 }
      },
      {
        id: 'event-2',
        turn: 1,
        userId: 'user-2',
        islandId: 'island-unseeded',
        rating: 1 as Rating,
        source: 'organic',
        raterSignalWeights: { 'cohort-action': 0.2, 'cohort-story': 1 }
      }
    ];
    const observedBehaviorEvents: ObservedBehaviorEvent[] = [
      {
        id: 'behavior-1',
        turn: 1,
        userId: 'user-1',
        islandId: 'island-seed',
        kind: 'completion',
        value: 1,
        sourceRatingEventId: 'event-1',
        sourceRatingEventSource: 'organic'
      },
      {
        id: 'behavior-2',
        turn: 1,
        userId: 'user-2',
        islandId: 'island-unseeded',
        kind: 'completion',
        value: 1,
        sourceRatingEventId: 'event-2',
        sourceRatingEventSource: 'organic'
      }
    ];
    const islandAffinityReports = new Map<string, IslandAffinityReport>([
      [
        'island-seed',
        {
          islandId: 'island-seed',
          estimates: [
            makeEstimate({
              cohortId: 'cohort-action',
              affinity: 0.41,
              confidence: 0.72,
              ratingDeviation: 0.28,
              volatility: 0.06,
              effectiveWeight: 3.1,
              evidenceCount: 4,
              observedMean: 0.41,
              rawCount: 4,
              lastUpdatedTurn: 2
            })
          ],
          topPositive: null,
          topNegative: null
        }
      ],
      [
        'island-unseeded',
        {
          islandId: 'island-unseeded',
          estimates: [
            makeEstimate({
              cohortId: 'cohort-story',
              affinity: 0.29,
              confidence: 0.65,
              ratingDeviation: 0.34,
              volatility: 0.07,
              effectiveWeight: 2.4,
              evidenceCount: 3,
              observedMean: 0.3,
              rawCount: 3,
              lastUpdatedTurn: 2
            })
          ],
          topPositive: null,
          topNegative: null
        }
      ]
    ]);

    const report = buildHiddenCohortRecoveryReport({
      hiddenTasteCohorts,
      users,
      islands,
      ratingEvents,
      observedBehaviorEvents,
      islandAffinityReports,
      cohortLabelById: cohortLabels
    });

    expect(report.seedHiddenCohortCount).toBe(1);
    expect(report.unseededHiddenCohortCount).toBe(1);
    expect(report.seedRecoveredCount).toBe(1);
    expect(report.unseededRecoveredCount).toBe(1);
    expect(report.rows[0].assignedUserCount).toBe(1);
    expect(report.rows[1].targetedIslandCount).toBe(1);
    expect(report.rows[1].status).toBe('unseeded-recovered');
  });

  it('marks unseeded cohorts as emerging when evidence is present but not strong enough to recover', () => {
    const hiddenTasteCohorts: HiddenTasteCohort[] = [
      {
        id: 'hidden-unseeded-1',
        label: 'Hidden Social',
        kind: 'unseeded',
        sourceSeedCohortId: 'cohort-story',
        projectedSeedCohortId: 'cohort-story',
        preferenceVector: { 'tag-story': 1 },
        tagSignature: ['tag-story']
      }
    ];
    const report = buildHiddenCohortRecoveryReport({
      hiddenTasteCohorts,
      users: [makeUser({ id: 'user-1', label: 'User 1', hiddenTasteCohortId: 'hidden-unseeded-1', hiddenTasteCohortKind: 'unseeded' })],
      islands: [
        makeIsland({
          id: 'island-unseeded',
          label: 'Island Unseeded',
          hiddenTruthClass: 'unseeded-cohort-match',
          hiddenTargetTasteCohortId: 'hidden-unseeded-1'
        })
      ],
      ratingEvents: [
        {
          id: 'event-1',
          turn: 1,
          userId: 'user-1',
          islandId: 'island-unseeded',
          rating: 1 as Rating,
          source: 'organic',
          raterSignalWeights: { 'cohort-story': 1 }
        }
      ],
      observedBehaviorEvents: [],
      islandAffinityReports: new Map<string, IslandAffinityReport>([
        [
          'island-unseeded',
          {
            islandId: 'island-unseeded',
            estimates: [
              makeEstimate({
                cohortId: 'cohort-story',
                affinity: 0.11,
                confidence: 0.42,
                ratingDeviation: 0.51,
                volatility: 0.07,
                effectiveWeight: 1.8,
                evidenceCount: 2,
                observedMean: 0.12,
                rawCount: 2,
                lastUpdatedTurn: 2
              })
            ],
            topPositive: null,
            topNegative: null
          }
        ]
      ]),
      cohortLabelById: cohortLabels
    });

    expect(report.rows[0].status).toBe('unseeded-emerging');
    expect(report.status).toBe('unseeded-emerging');
  });

  it('flags confident random islands as possible overfit instead of calling them recovered', () => {
    const hiddenTasteCohorts: HiddenTasteCohort[] = [
      {
        id: 'hidden-seed-1',
        label: 'Hidden Action',
        kind: 'seed',
        sourceSeedCohortId: 'cohort-action',
        projectedSeedCohortId: 'cohort-action',
        preferenceVector: { 'tag-action': 1 },
        tagSignature: ['tag-action']
      }
    ];
    const report = buildHiddenCohortRecoveryReport({
      hiddenTasteCohorts,
      users: [makeUser({ id: 'user-1', label: 'User 1', hiddenTasteCohortId: 'hidden-seed-1', hiddenTasteCohortKind: 'seed' })],
      islands: [
        makeIsland({
          id: 'island-random',
          label: 'Island Random',
          hiddenTruthClass: 'random',
          hiddenAppealVector: { 'tag-random': 0.2 }
        })
      ],
      ratingEvents: [
        {
          id: 'event-1',
          turn: 1,
          userId: 'user-1',
          islandId: 'island-random',
          rating: 1 as Rating,
          source: 'organic',
          raterSignalWeights: { 'cohort-action': 1 }
        }
      ],
      observedBehaviorEvents: [],
      islandAffinityReports: new Map<string, IslandAffinityReport>([
        [
          'island-random',
          {
            islandId: 'island-random',
            estimates: [
              makeEstimate({
                cohortId: 'cohort-action',
                affinity: 0.51,
                confidence: 0.74,
                ratingDeviation: 0.26,
                volatility: 0.08,
                effectiveWeight: 3.2,
                evidenceCount: 4,
                observedMean: 0.51,
                rawCount: 4,
                lastUpdatedTurn: 2
              })
            ],
            topPositive: null,
            topNegative: null
          }
        ]
      ]),
      cohortLabelById: cohortLabels
    });

    expect(report.possibleOverfitCount).toBe(1);
    expect(report.status).toBe('possible-overfit');
    expect(report.randomIslandRows[0].status).toBe('possible-overfit');
  });

  it('renders a compact summary card without the proof table and a modal with recovery detail', () => {
    const report = buildHiddenCohortRecoveryReport({
      hiddenTasteCohorts: [
        {
          id: 'hidden-seed-1',
          label: 'Hidden Action',
          kind: 'seed',
          sourceSeedCohortId: 'cohort-action',
          projectedSeedCohortId: 'cohort-action',
          preferenceVector: { 'tag-action': 1 },
          tagSignature: ['tag-action']
        }
      ],
      users: [makeUser({ id: 'user-1', label: 'User 1', hiddenTasteCohortId: 'hidden-seed-1', hiddenTasteCohortKind: 'seed' })],
      islands: [],
      ratingEvents: [],
      observedBehaviorEvents: [],
      islandAffinityReports: new Map(),
      cohortLabelById: cohortLabels
    });

    const cardHtml = renderToString(<HiddenCohortRecoveryPanel id="hidden-cohort-recovery" report={report} />);
    expect(cardHtml).toContain('Hidden Cohort Recovery');
    expect(cardHtml).toContain('Inspect recovery detail');
    expect(cardHtml).not.toContain('Hidden cohort rows');

    const modalHtml = renderToString(<HiddenCohortRecoveryModal open report={report} onClose={() => undefined} />);
    expect(modalHtml).toContain('Hidden cohort rows');
    expect(modalHtml).toContain('Random / noisy islands');
    expect(modalHtml).toContain('toy-world audit data');
  });

  it('renders missing truth data safely', () => {
    const report = buildHiddenCohortRecoveryReport({
      hiddenTasteCohorts: [],
      users: [],
      islands: [],
      ratingEvents: [],
      observedBehaviorEvents: [],
      islandAffinityReports: new Map(),
      cohortLabelById: cohortLabels
    });

    expect(report.status).toBe('missing-truth-data');
    expect(renderToString(<HiddenCohortRecoveryPanel report={report} />)).toContain('Missing truth data');
  });
});
