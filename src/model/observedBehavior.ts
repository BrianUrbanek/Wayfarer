import { createSeededRandom } from '../generator/seededRandom.js';
import type { RatingEventSource, RatingEvent } from './simulation.js';
import type { HiddenBehaviorProfile, IslandId, User, UserId } from './types.js';

export type ObservedBehaviorKind =
  | 'qualified-play'
  | 'completion'
  | 'replay'
  | 'return'
  | 'bounce'
  | 'abandon';

export interface ObservedBehaviorEvent {
  id: string;
  turn: number;
  userId: UserId;
  islandId: IslandId;
  kind: ObservedBehaviorKind;
  value: number;
  sourceRatingEventId: string;
  sourceRatingEventSource?: RatingEventSource;
}

export interface ObservedBehaviorKindCounts {
  qualifiedPlay: number;
  completion: number;
  replay: number;
  return: number;
  bounce: number;
  abandon: number;
}

export interface ObservedBehaviorIslandSummary {
  islandId: IslandId;
  totalEvents: number;
  counts: ObservedBehaviorKindCounts;
}

export interface ObservedBehaviorTurnSummary {
  turn: number;
  totalEvents: number;
  counts: ObservedBehaviorKindCounts;
}

export interface ObservedBehaviorAnalysis {
  totalEvents: number;
  counts: ObservedBehaviorKindCounts;
  byTurn: ObservedBehaviorTurnSummary[];
  byIslandId: ReadonlyMap<IslandId, ObservedBehaviorIslandSummary>;
}

export interface ObservedBehaviorRow {
  eventId: string;
  turn: number;
  userId: UserId;
  islandId: IslandId;
  kind: ObservedBehaviorKind;
  value: number;
  sourceRatingEventId: string;
  sourceRatingEventSource?: RatingEventSource;
}

const POSITIVE_KINDS: readonly Exclude<ObservedBehaviorKind, 'qualified-play' | 'bounce' | 'abandon'>[] = ['completion', 'replay', 'return'];
const NEGATIVE_KINDS: readonly Exclude<ObservedBehaviorKind, 'qualified-play' | 'completion' | 'replay' | 'return'>[] = ['bounce', 'abandon'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function blankCounts(): ObservedBehaviorKindCounts {
  return {
    qualifiedPlay: 0,
    completion: 0,
    replay: 0,
    return: 0,
    bounce: 0,
    abandon: 0
  };
}

function seedFromString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function resolveBehaviorProfile(user: User | undefined, seed: number, userIndex: number): HiddenBehaviorProfile {
  if (user?.hiddenBehaviorProfile) {
    return user.hiddenBehaviorProfile;
  }

  const profiles: HiddenBehaviorProfile[] = ['aligned', 'positive-drift', 'negative-drift'];
  const mixed = Math.imul(seed >>> 0, 1103515245) ^ Math.imul(userIndex + 1, 12345);
  return profiles[Math.abs(mixed) % profiles.length];
}

function chooseDelta(profile: HiddenBehaviorProfile, rng: ReturnType<typeof createSeededRandom>): number {
  if (profile === 'aligned') {
    return 0;
  }

  const roll = rng.next();
  if (roll < 0.5) {
    return 0;
  }

  if (profile === 'positive-drift') {
    return roll < 0.85 ? 1 : -1;
  }

  return roll < 0.65 ? 1 : -1;
}

function behaviorKindForPolarity(polarity: number, rng: ReturnType<typeof createSeededRandom>): ObservedBehaviorKind {
  if (polarity > 0) {
    return POSITIVE_KINDS[rng.int(POSITIVE_KINDS.length)];
  }

  if (polarity < 0) {
    return NEGATIVE_KINDS[rng.int(NEGATIVE_KINDS.length)];
  }

  return 'qualified-play';
}

export function buildObservedBehaviorEvents(
  ratingEvents: readonly RatingEvent[],
  users: readonly User[],
  seed: number
): ObservedBehaviorEvent[] {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const userIndexById = new Map(users.map((user, index) => [user.id, index]));

  return ratingEvents.map((ratingEvent) => {
    const user = usersById.get(ratingEvent.userId);
    const userIndex = userIndexById.get(ratingEvent.userId) ?? 0;
    const profile = resolveBehaviorProfile(user, seed, userIndex);
    const rng = createSeededRandom(seedFromString(`${seed}:${ratingEvent.id}:${ratingEvent.userId}:${ratingEvent.islandId}`));
    const delta = chooseDelta(profile, rng);
    const polarity = clamp(ratingEvent.rating + delta, -1, 1);
    const kind = behaviorKindForPolarity(polarity, rng);

    return {
      id: `behavior:${ratingEvent.id}`,
      turn: ratingEvent.turn,
      userId: ratingEvent.userId,
      islandId: ratingEvent.islandId,
      kind,
      value: Math.abs(polarity),
      sourceRatingEventId: ratingEvent.id,
      sourceRatingEventSource: ratingEvent.source
    };
  });
}

function addCounts(counts: ObservedBehaviorKindCounts, kind: ObservedBehaviorKind): void {
  switch (kind) {
    case 'qualified-play':
      counts.qualifiedPlay += 1;
      break;
    case 'completion':
      counts.completion += 1;
      break;
    case 'replay':
      counts.replay += 1;
      break;
    case 'return':
      counts.return += 1;
      break;
    case 'bounce':
      counts.bounce += 1;
      break;
    case 'abandon':
      counts.abandon += 1;
      break;
  }
}

export function buildObservedBehaviorAnalysis(events: readonly ObservedBehaviorEvent[]): ObservedBehaviorAnalysis {
  const counts = blankCounts();
  const byTurn = new Map<number, ObservedBehaviorTurnSummary>();
  const byIslandId = new Map<IslandId, ObservedBehaviorIslandSummary>();

  for (const event of events) {
    addCounts(counts, event.kind);

    const turnSummary = byTurn.get(event.turn) ?? {
      turn: event.turn,
      totalEvents: 0,
      counts: blankCounts()
    };
    turnSummary.totalEvents += 1;
    addCounts(turnSummary.counts, event.kind);
    byTurn.set(event.turn, turnSummary);

    const islandSummary = byIslandId.get(event.islandId) ?? {
      islandId: event.islandId,
      totalEvents: 0,
      counts: blankCounts()
    };
    islandSummary.totalEvents += 1;
    addCounts(islandSummary.counts, event.kind);
    byIslandId.set(event.islandId, islandSummary);
  }

  return {
    totalEvents: events.length,
    counts,
    byTurn: Array.from(byTurn.values()).sort((left, right) => left.turn - right.turn),
    byIslandId
  };
}

export function buildObservedBehaviorRowsForIsland(
  islandId: IslandId,
  events: readonly ObservedBehaviorEvent[]
): ObservedBehaviorRow[] {
  return events
    .filter((event) => event.islandId === islandId)
    .sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id))
    .map((event) => ({
      eventId: event.id,
      turn: event.turn,
      userId: event.userId,
      islandId: event.islandId,
      kind: event.kind,
      value: event.value,
      sourceRatingEventId: event.sourceRatingEventId,
      sourceRatingEventSource: event.sourceRatingEventSource
    }));
}
