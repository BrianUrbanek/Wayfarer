import type { CohortId, UserId } from './types.js';
import type { SimulationState, RatingEvent } from './simulation.js';
import type { ObservedBehaviorKind } from './observedBehavior.js';

export interface DiscoverySignalTurnRow {
  turn: number;
  ratingEvents: number;
  behaviorAgreement: number;
  confidenceMomentum: number;
  usefulness: number;
  earlyUsefulRatingCount: number;
  confirmedPositiveCount: number;
  confirmedNegativeCount: number;
  contradictedCount: number;
  lateConsensusCount: number;
}

export interface DiscoverySignalProfile {
  userId: UserId;
  score: number;
  behaviorConsistency: number;
  confidenceMomentum: number;
  support: number;
  eventCount: number;
  latestTurn: number;
  summary: string;
  earlyUsefulRatingCount: number;
  confirmedPositiveCount: number;
  confirmedNegativeCount: number;
  contradictedCount: number;
  lateConsensusCount: number;
  topUsefulCohortId: CohortId | null;
  topUsefulCohortExplanation: string;
  turnRows: DiscoverySignalTurnRow[];
}

export interface DiscoverySignalAnalysis {
  totalEvents: number;
  byUserId: ReadonlyMap<UserId, DiscoverySignalProfile>;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function behaviorPolarity(kind: ObservedBehaviorKind): number {
  if (kind === 'completion' || kind === 'replay' || kind === 'return') {
    return 1;
  }

  if (kind === 'bounce' || kind === 'abandon') {
    return -1;
  }

  return 0;
}

function agreementForRating(rating: number, polarity: number): number {
  return 1 - Math.min(1, Math.abs(rating - polarity) / 2);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildDiscoverySignalAnalysis(state: SimulationState): DiscoverySignalAnalysis {
  const behaviorBySourceRatingEventId = new Map(
    state.observedBehaviorEvents.map((event) => [event.sourceRatingEventId, event] as const)
  );
  const snapshotsByIslandTurn = new Map<string, number>();

  for (const snapshot of state.confidenceSnapshots) {
    const key = `${snapshot.islandId}:${snapshot.turn}`;
    const current = snapshotsByIslandTurn.get(key) ?? 0;
    snapshotsByIslandTurn.set(key, current + snapshot.confidence);
  }

  const snapshotCountByIslandTurn = new Map<string, number>();
  for (const snapshot of state.confidenceSnapshots) {
    const key = `${snapshot.islandId}:${snapshot.turn}`;
    snapshotCountByIslandTurn.set(key, (snapshotCountByIslandTurn.get(key) ?? 0) + 1);
  }

  const eventsByUser = new Map<UserId, RatingEvent[]>();
  for (const event of state.ratingEvents) {
    const list = eventsByUser.get(event.userId) ?? [];
    list.push(event);
    eventsByUser.set(event.userId, list);
  }

  const profiles = state.users.map<DiscoverySignalProfile>((user) => {
    const events = eventsByUser.get(user.id) ?? [];
    const turnBuckets = new Map<number, Array<{
      event: RatingEvent;
      behaviorAgreement: number;
      confidenceMomentum: number;
      currentConfidence: number;
    }>>();
    let earlyUsefulRatingCount = 0;
    let confirmedPositiveCount = 0;
    let confirmedNegativeCount = 0;
    let contradictedCount = 0;
    let lateConsensusCount = 0;

    for (const event of events) {
      const behavior = behaviorBySourceRatingEventId.get(event.id);
      const polarity = behavior ? behaviorPolarity(behavior.kind) : null;
      const behaviorScore = behavior ? agreementForRating(event.rating, polarity as number) : 0.5;
      const currentKey = `${event.islandId}:${event.turn}`;
      const previousKey = `${event.islandId}:${Math.max(0, event.turn - 1)}`;
      const currentConfidence = (snapshotsByIslandTurn.get(currentKey) ?? 0) / Math.max(1, snapshotCountByIslandTurn.get(currentKey) ?? 1);
      const previousConfidence = (snapshotsByIslandTurn.get(previousKey) ?? 0) / Math.max(1, snapshotCountByIslandTurn.get(previousKey) ?? 1);
      const confidenceMomentum = 0.5 + (currentConfidence - previousConfidence);
      const behaviorIsPositive = polarity !== null && polarity > 0;
      const behaviorIsNegative = polarity !== null && polarity < 0;
      const ratingIsPositive = event.rating > 0;
      const ratingIsNegative = event.rating < 0;

      if (behaviorScore >= 0.75 && currentConfidence <= 0.35) {
        earlyUsefulRatingCount += 1;
      }

      if (behaviorScore >= 0.75 && currentConfidence >= 0.7) {
        lateConsensusCount += 1;
      }

      if (ratingIsPositive && behaviorIsPositive) {
        confirmedPositiveCount += 1;
      } else if (ratingIsNegative && behaviorIsNegative) {
        confirmedNegativeCount += 1;
      } else if (polarity !== null && event.rating !== polarity) {
        contradictedCount += 1;
      }

      const bucket = turnBuckets.get(event.turn) ?? [];
      bucket.push({
        event,
        behaviorAgreement: behaviorScore,
        confidenceMomentum,
        currentConfidence
      });
      turnBuckets.set(event.turn, bucket);
    }

    const turnRows = Array.from(turnBuckets.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([turn, bucket]) => {
        const behaviorAgreement = average(bucket.map((entry) => entry.behaviorAgreement));
        const confidenceMomentum = clamp01(average(bucket.map((entry) => entry.confidenceMomentum)));
        const usefulness = clamp01((behaviorAgreement * 0.6 + confidenceMomentum * 0.4) * clamp01(events.length / 6));
        const turnEarlyUsefulRatingCount = bucket.filter((entry) => entry.behaviorAgreement >= 0.75 && entry.currentConfidence <= 0.35).length;
        const turnConfirmedPositiveCount = bucket.filter((entry) => entry.event.rating > 0 && entry.behaviorAgreement >= 0.75).length;
        const turnConfirmedNegativeCount = bucket.filter((entry) => entry.event.rating < 0 && entry.behaviorAgreement >= 0.75).length;
        const turnContradictedCount = bucket.filter((entry) => entry.behaviorAgreement < 0.5).length;
        const turnLateConsensusCount = bucket.filter((entry) => entry.behaviorAgreement >= 0.75 && entry.currentConfidence >= 0.7).length;

        return {
          turn,
          ratingEvents: bucket.length,
          behaviorAgreement,
          confidenceMomentum,
          usefulness,
          earlyUsefulRatingCount: turnEarlyUsefulRatingCount,
          confirmedPositiveCount: turnConfirmedPositiveCount,
          confirmedNegativeCount: turnConfirmedNegativeCount,
          contradictedCount: turnContradictedCount,
          lateConsensusCount: turnLateConsensusCount
        };
      });

    const behaviorConsistency = average(turnRows.map((row) => row.behaviorAgreement));
    const confidenceMomentum = average(turnRows.map((row) => row.confidenceMomentum));
    const support = clamp01(events.length / 8);
    const score = clamp01((behaviorConsistency * 0.6 + confidenceMomentum * 0.4) * (0.5 + support / 2));
    const latestTurn = events.length > 0 ? Math.max(...events.map((event) => event.turn)) : 0;

    return {
      userId: user.id,
      score,
      behaviorConsistency,
      confidenceMomentum,
      support,
      eventCount: events.length,
      latestTurn,
      summary:
        events.length === 0
          ? 'No observed behavior yet.'
          : `Synthetic discovery usefulness is based on ${events.length} rating-linked behavior events and stored confidence snapshots.`,
      earlyUsefulRatingCount,
      confirmedPositiveCount,
      confirmedNegativeCount,
      contradictedCount,
      lateConsensusCount,
      topUsefulCohortId: null,
      topUsefulCohortExplanation:
        'No cohort-level top useful read is derived yet. This prototype keeps Discovery Signal separate from Trust and derives it from rating-linked behavior plus stored confidence snapshots.',
      turnRows
    };
  });

  return {
    totalEvents: state.observedBehaviorEvents.length,
    byUserId: new Map(profiles.map((profile) => [profile.userId, profile]))
  };
}
