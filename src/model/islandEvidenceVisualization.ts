import type { CohortId, IslandId, Rating, UserId } from './types.js';
import type { IslandCohortRatingState } from './islandCohortRating.js';
import type { RatingEventWeightInputEvent, RatingEventWeightRow } from './ratingEventWeight.js';

export interface IslandRatingTimelineRow {
  turn: number;
  cohortId: CohortId;
  affinity: number;
  confidence: number;
  ratingDeviation: number;
  uncertainty: number;
  volatility: number;
  effectiveWeight: number;
  evidenceCount: number;
}

export interface IslandEvidenceConstellationPoint {
  eventId: string;
  turn: number;
  userId: UserId;
  rating: Rating;
  primaryCohortId: CohortId | null;
  secondaryCohortId: CohortId | null;
  primaryWeight: number;
  secondaryWeight: number;
  ambiguity: number;
  spokeCohortId: CohortId | null;
  angleJitter: number;
  radiusValue: number;
  sizeValue: number;
  opacityValue: number;
  directionalContribution: number;
  weightProxyLabel: string;
}

export interface IslandEvidenceConstellationSpoke {
  cohortId: CohortId;
  cohortLabel: string;
  pointCount: number;
  totalPrimaryWeight: number;
}

export interface IslandEvidenceConstellation {
  points: IslandEvidenceConstellationPoint[];
  spokes: IslandEvidenceConstellationSpoke[];
  usesRatingEventWeightRows: boolean;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function buildIslandRatingTimelineRows(
  islandId: IslandId,
  snapshots: readonly IslandCohortRatingState[]
): IslandRatingTimelineRow[] {
  return snapshots
    .filter((snapshot) => snapshot.islandId === islandId)
    .map((snapshot) => ({
      turn: snapshot.turn,
      cohortId: snapshot.cohortId,
      affinity: snapshot.affinity,
      confidence: snapshot.confidence,
      ratingDeviation: snapshot.ratingDeviation,
      uncertainty: snapshot.uncertainty,
      volatility: snapshot.volatility,
      effectiveWeight: snapshot.effectiveWeight,
      evidenceCount: snapshot.evidenceCount
    }))
    .sort((left, right) => left.turn - right.turn || left.cohortId.localeCompare(right.cohortId));
}

function strongestCohorts(weights: Readonly<Record<CohortId, number>>): {
  primaryCohortId: CohortId | null;
  primaryWeight: number;
  secondaryCohortId: CohortId | null;
  secondaryWeight: number;
} {
  const ranked = Object.entries(weights)
    .map(([cohortId, value]) => [cohortId as CohortId, Math.max(0, Number.isFinite(value) ? value : 0)] as const)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const primary = ranked[0];
  const secondary = ranked[1];
  return {
    primaryCohortId: primary && primary[1] > 0 ? primary[0] : null,
    primaryWeight: primary?.[1] ?? 0,
    secondaryCohortId: secondary && secondary[1] > 0 ? secondary[0] : null,
    secondaryWeight: secondary?.[1] ?? 0
  };
}

function deterministicJitter(eventId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < eventId.length; i += 1) {
    hash ^= eventId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1000) / 1000;
}

export function buildIslandEvidenceConstellation(input: {
  islandId: IslandId;
  events: readonly RatingEventWeightInputEvent[];
  ratingEventWeightRows?: readonly RatingEventWeightRow[];
  cohortLabelById: ReadonlyMap<CohortId, string>;
}): IslandEvidenceConstellation {
  const islandEvents = input.events
    .filter((event) => event.islandId === input.islandId)
    .sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id));
  const maxTurn = islandEvents.length > 0 ? islandEvents[islandEvents.length - 1].turn : 0;
  const byEventId = new Map<string, RatingEventWeightRow[]>();
  for (const row of input.ratingEventWeightRows ?? []) {
    const rows = byEventId.get(row.eventId) ?? [];
    rows.push(row);
    byEventId.set(row.eventId, rows);
  }

  const points = islandEvents.map<IslandEvidenceConstellationPoint>((event) => {
    const strongest = strongestCohorts(event.raterSignalWeights);
    const eventRows = byEventId.get(event.id) ?? [];
    const primaryRow = strongest.primaryCohortId
      ? eventRows.find((row) => row.cohortId === strongest.primaryCohortId) ?? null
      : null;
    const ambiguity =
      strongest.primaryWeight > 0 ? clamp01(1 - (strongest.primaryWeight - strongest.secondaryWeight) / strongest.primaryWeight) : 1;
    const recency = maxTurn > 0 ? clamp01(event.turn / maxTurn) : 1;
    const radiusValue = primaryRow ? primaryRow.eventWeight : strongest.primaryWeight;
    const sizeValue = strongest.primaryWeight;
    const directionalContribution = primaryRow ? primaryRow.directionalContribution : event.rating * strongest.primaryWeight;
    return {
      eventId: event.id,
      turn: event.turn,
      userId: event.userId,
      rating: event.rating,
      primaryCohortId: strongest.primaryCohortId,
      secondaryCohortId: strongest.secondaryCohortId,
      primaryWeight: strongest.primaryWeight,
      secondaryWeight: strongest.secondaryWeight,
      ambiguity,
      spokeCohortId: strongest.primaryCohortId,
      angleJitter: (deterministicJitter(event.id) - 0.5) * ambiguity,
      radiusValue,
      sizeValue,
      opacityValue: 0.35 + recency * 0.65,
      directionalContribution,
      weightProxyLabel: primaryRow
        ? 'radius uses existing Rating Event Weight eventWeight for the event primary cohort'
        : 'radius uses visualization-only proxy: primary cohort trust weight'
    };
  });

  const spokes = Array.from(input.cohortLabelById.entries()).map(([cohortId, cohortLabel]) => {
    const spokePoints = points.filter((point) => point.spokeCohortId === cohortId);
    return {
      cohortId,
      cohortLabel,
      pointCount: spokePoints.length,
      totalPrimaryWeight: spokePoints.reduce((sum, point) => sum + point.primaryWeight, 0)
    };
  });

  return {
    points,
    spokes,
    usesRatingEventWeightRows: (input.ratingEventWeightRows?.length ?? 0) > 0
  };
}
