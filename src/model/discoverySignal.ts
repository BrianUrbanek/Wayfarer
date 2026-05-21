import type { SimulationState, RatingEvent } from './simulation.js';
import type { UserId } from './types.js';
import type { ObservedBehaviorKind } from './observedBehavior.js';

export interface DiscoverySignalTurnRow {
  turn: number;
  ratingEvents: number;
  behaviorAgreement: number;
  confidenceMomentum: number;
  usefulness: number;
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
    const turnBuckets = new Map<number, { agreement: number[]; momentum: number[] }>();

    for (const event of events) {
      const behavior = behaviorBySourceRatingEventId.get(event.id);
      const behaviorScore = behavior ? agreementForRating(event.rating, behaviorPolarity(behavior.kind)) : 0.5;
      const currentKey = `${event.islandId}:${event.turn}`;
      const previousKey = `${event.islandId}:${Math.max(0, event.turn - 1)}`;
      const currentConfidence = (snapshotsByIslandTurn.get(currentKey) ?? 0) / Math.max(1, snapshotCountByIslandTurn.get(currentKey) ?? 1);
      const previousConfidence = (snapshotsByIslandTurn.get(previousKey) ?? 0) / Math.max(1, snapshotCountByIslandTurn.get(previousKey) ?? 1);
      const confidenceMomentum = 0.5 + (currentConfidence - previousConfidence);
      const bucket = turnBuckets.get(event.turn) ?? { agreement: [], momentum: [] };
      bucket.agreement.push(behaviorScore);
      bucket.momentum.push(confidenceMomentum);
      turnBuckets.set(event.turn, bucket);
    }

    const turnRows = Array.from(turnBuckets.entries())
      .sort((left, right) => left[0] - right[0])
      .map(([turn, bucket]) => {
        const behaviorAgreement = average(bucket.agreement);
        const confidenceMomentum = clamp01(average(bucket.momentum));
        const usefulness = clamp01((behaviorAgreement * 0.6 + confidenceMomentum * 0.4) * clamp01(events.length / 6));

        return {
          turn,
          ratingEvents: bucket.agreement.length,
          behaviorAgreement,
          confidenceMomentum,
          usefulness
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
      turnRows
    };
  });

  return {
    totalEvents: state.observedBehaviorEvents.length,
    byUserId: new Map(profiles.map((profile) => [profile.userId, profile]))
  };
}
