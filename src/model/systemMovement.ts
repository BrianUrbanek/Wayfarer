import type { ObservedBehaviorEvent } from './observedBehavior.js';
import type { SimulationState } from './simulation.js';
import type { IslandId } from './types.js';
import type { IslandCohortRatingState } from './islandCohortRating.js';

export type SystemMovementSignalType =
  | 'narrow-appeal'
  | 'broad-appeal'
  | 'polarized-appeal'
  | 'coverage-gap'
  | 'contradiction'
  | 'volatility';

export interface SystemMovementPoint {
  turn: number;
  islandId: IslandId;
  islandLabel: string;
  profilePosition: number;
  legibility: number;
  evidenceWeight: number;
  averageConfidence: number;
  minConfidence: number;
  averageVolatility: number;
  positiveCohortCount: number;
  negativeCohortCount: number;
  unresolvedCohortCount: number;
  dominantSignal: SystemMovementSignalType;
  trail: Array<{
    turn: number;
    profilePosition: number;
    legibility: number;
  }>;
}

export interface SystemMovementDomain {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface SystemMovementFrame {
  turn: number;
  points: SystemMovementPoint[];
  domain: SystemMovementDomain;
  summary: {
    islandCount: number;
    movingIslandCount: number;
    coverageGapCount: number;
    contradictionCount: number;
    volatilityCount: number;
    averageLegibility: number;
    totalEvidenceWeight: number;
  };
}

export interface SystemMovementAuditRow {
  turn: number;
  islandId: IslandId;
  islandLabel: string;
  dominantSignal: SystemMovementSignalType;
  profilePosition: number;
  previousProfilePosition: number | null;
  profileDelta: number | null;
  legibility: number;
  previousLegibility: number | null;
  legibilityDelta: number | null;
  evidenceWeight: number;
  previousEvidenceWeight: number | null;
  evidenceDelta: number | null;
  averageConfidence: number;
  minConfidence: number;
  averageVolatility: number;
  positiveCohortCount: number;
  negativeCohortCount: number;
  unresolvedCohortCount: number;
  movementScore: number;
  moverReason: string;
}

export interface SystemMovementAnalysis {
  frames: SystemMovementFrame[];
  auditRows: SystemMovementAuditRow[];
  signalCounts: Record<SystemMovementSignalType, number>;
  maxEvidenceWeight: number;
}

const SIGNAL_TYPES: SystemMovementSignalType[] = [
  'narrow-appeal',
  'broad-appeal',
  'polarized-appeal',
  'coverage-gap',
  'contradiction',
  'volatility'
];

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedMean(values: ReadonlyArray<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) {
    return mean(values.map((entry) => entry.value));
  }
  return values.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight;
}

function behaviorPolarity(kind: ObservedBehaviorEvent['kind']): -1 | 0 | 1 {
  switch (kind) {
    case 'completion':
    case 'replay':
    case 'return':
      return 1;
    case 'bounce':
    case 'abandon':
      return -1;
    default:
      return 0;
  }
}

function snapshotLegibility(snapshot: IslandCohortRatingState): number {
  const evidenceRead = snapshot.effectiveWeight / (snapshot.effectiveWeight + 6);
  return clamp(snapshot.confidence * 0.65 + evidenceRead * 0.35, 0, 1);
}

function buildDomain(points: readonly SystemMovementPoint[]): SystemMovementDomain {
  if (points.length === 0) {
    return { xMin: -1, xMax: 1, yMin: 0, yMax: 1 };
  }

  const xValues = points.flatMap((point) => [point.profilePosition, ...point.trail.map((trailPoint) => trailPoint.profilePosition), 0]);
  const yValues = points.flatMap((point) => [point.legibility, ...point.trail.map((trailPoint) => trailPoint.legibility)]);
  const rawXMin = Math.min(...xValues);
  const rawXMax = Math.max(...xValues);
  const rawYMin = Math.min(...yValues, 0);
  const rawYMax = Math.max(...yValues);
  const xPad = Math.max(0.08, (rawXMax - rawXMin) * 0.18);
  const yPad = Math.max(0.08, (rawYMax - rawYMin) * 0.2);

  return {
    xMin: clamp(rawXMin - xPad, -1, 1),
    xMax: clamp(rawXMax + xPad, -1, 1),
    yMin: clamp(rawYMin - yPad, 0, 1),
    yMax: clamp(rawYMax + yPad, 0, 1)
  };
}

function movementScoreFor(point: SystemMovementPoint, previous: SystemMovementPoint | null): number {
  if (!previous) {
    return 0;
  }
  return Math.abs(point.profilePosition - previous.profilePosition) + Math.abs(point.legibility - previous.legibility);
}

function moverReasonFor(point: SystemMovementPoint, previous: SystemMovementPoint | null): string {
  const deltas = previous
    ? ([
        ['profile', Math.abs(point.profilePosition - previous.profilePosition)],
        ['legibility', Math.abs(point.legibility - previous.legibility)],
        ['evidence', Math.abs(point.evidenceWeight - previous.evidenceWeight) / Math.max(1, previous.evidenceWeight)]
      ] satisfies Array<[string, number]>).sort((left, right) => right[1] - left[1])
    : [];

  const dominantDelta = deltas[0]?.[0] ?? 'baseline';
  return `${point.dominantSignal}; dominant delta: ${dominantDelta}`;
}

function groupSnapshotsByTurnAndIsland(
  snapshots: readonly IslandCohortRatingState[]
): Map<number, Map<IslandId, IslandCohortRatingState[]>> {
  const byTurn = new Map<number, Map<IslandId, IslandCohortRatingState[]>>();
  for (const snapshot of snapshots) {
    const byIsland = byTurn.get(snapshot.turn) ?? new Map<IslandId, IslandCohortRatingState[]>();
    const islandSnapshots = byIsland.get(snapshot.islandId) ?? [];
    islandSnapshots.push(snapshot);
    byIsland.set(snapshot.islandId, islandSnapshots);
    byTurn.set(snapshot.turn, byIsland);
  }
  return byTurn;
}

function hasContradiction(input: {
  centroid: number;
  turn: number;
  islandId: IslandId;
  observedBehaviorEvents: readonly ObservedBehaviorEvent[];
}): boolean {
  if (Math.abs(input.centroid) < 0.12) {
    return false;
  }

  const polarity = input.observedBehaviorEvents
    .filter((event) => event.turn === input.turn && event.islandId === input.islandId)
    .reduce((sum, event) => sum + behaviorPolarity(event.kind), 0);

  return polarity !== 0 && Math.sign(polarity) !== Math.sign(input.centroid);
}

function classifySignal(input: {
  snapshots: readonly IslandCohortRatingState[];
  centroid: number;
  previousCentroid: number | null;
  legibility: number;
  observedBehaviorEvents: readonly ObservedBehaviorEvent[];
  turn: number;
  islandId: IslandId;
  cohortCount: number;
}): SystemMovementSignalType {
  const positiveCohorts = input.snapshots.filter((snapshot) => snapshot.confidence >= 0.42 && snapshot.affinity >= 0.18).length;
  const negativeCohorts = input.snapshots.filter((snapshot) => snapshot.confidence >= 0.42 && snapshot.affinity <= -0.18).length;
  const unresolvedCohorts = input.snapshots.filter((snapshot) => snapshot.confidence < 0.32 || snapshot.evidenceCount <= 1).length;
  const averageVolatility = mean(input.snapshots.map((snapshot) => snapshot.volatility));
  const centroidMovement = input.previousCentroid === null ? 0 : Math.abs(input.centroid - input.previousCentroid);

  if (
    hasContradiction({
      centroid: input.centroid,
      turn: input.turn,
      islandId: input.islandId,
      observedBehaviorEvents: input.observedBehaviorEvents
    })
  ) {
    return 'contradiction';
  }

  if (averageVolatility >= 0.18 || centroidMovement >= 0.2) {
    return 'volatility';
  }

  if (unresolvedCohorts > 0 && input.legibility >= 0.4) {
    return 'coverage-gap';
  }

  if (positiveCohorts > 0 && negativeCohorts > 0) {
    return 'polarized-appeal';
  }

  if (positiveCohorts >= Math.max(2, Math.ceil(input.cohortCount * 0.5)) && negativeCohorts === 0) {
    return 'broad-appeal';
  }

  if (positiveCohorts > 0 || negativeCohorts > 0) {
    return 'narrow-appeal';
  }

  return 'coverage-gap';
}

export function buildSystemMovementAnalysis(
  state: Pick<SimulationState, 'islands' | 'cohorts' | 'islandCohortRatingSnapshots' | 'observedBehaviorEvents'>
): SystemMovementAnalysis {
  const byTurn = groupSnapshotsByTurnAndIsland(state.islandCohortRatingSnapshots);
  const turns = Array.from(byTurn.keys()).sort((left, right) => left - right);
  const islandLabelById = new Map(state.islands.map((island) => [island.id, island.label] as const));
  const previousPointByIslandId = new Map<IslandId, SystemMovementPoint>();
  const allPoints: SystemMovementPoint[] = [];
  const auditRows: SystemMovementAuditRow[] = [];

  const frames = turns.map<SystemMovementFrame>((turn) => {
    const byIsland = byTurn.get(turn) ?? new Map<IslandId, IslandCohortRatingState[]>();
    const points = Array.from(byIsland.entries())
      .map<SystemMovementPoint>(([islandId, snapshots]) => {
        const evidenceWeight = snapshots.reduce((sum, snapshot) => sum + snapshot.effectiveWeight, 0);
        const profilePosition = clamp(
          weightedMean(snapshots.map((snapshot) => ({ value: snapshot.affinity, weight: Math.max(0.05, snapshot.confidence) }))),
          -1,
          1
        );
        const averageConfidence = mean(snapshots.map((snapshot) => snapshot.confidence));
        const minConfidence = Math.min(...snapshots.map((snapshot) => snapshot.confidence));
        const legibility = clamp(
          weightedMean(snapshots.map((snapshot) => ({ value: snapshotLegibility(snapshot), weight: Math.max(0.1, snapshot.effectiveWeight) }))),
          0,
          1
        );
        const previous = previousPointByIslandId.get(islandId) ?? null;
        const trail = previous
          ? previous.trail
              .concat({
                turn: previous.turn,
                profilePosition: previous.profilePosition,
                legibility: previous.legibility
              })
              .slice(-4)
          : [];
        const point: SystemMovementPoint = {
          turn,
          islandId,
          islandLabel: islandLabelById.get(islandId) ?? islandId,
          profilePosition,
          legibility,
          evidenceWeight,
          averageConfidence,
          minConfidence,
          averageVolatility: mean(snapshots.map((snapshot) => snapshot.volatility)),
          positiveCohortCount: snapshots.filter((snapshot) => snapshot.confidence >= 0.42 && snapshot.affinity >= 0.18).length,
          negativeCohortCount: snapshots.filter((snapshot) => snapshot.confidence >= 0.42 && snapshot.affinity <= -0.18).length,
          unresolvedCohortCount: snapshots.filter((snapshot) => snapshot.confidence < 0.32 || snapshot.evidenceCount <= 1).length,
          dominantSignal: classifySignal({
            snapshots,
            centroid: profilePosition,
            previousCentroid: previous?.profilePosition ?? null,
            legibility,
            observedBehaviorEvents: state.observedBehaviorEvents,
            turn,
            islandId,
            cohortCount: state.cohorts.length
          }),
          trail
        };
        previousPointByIslandId.set(islandId, point);
        allPoints.push(point);
        auditRows.push({
          turn,
          islandId,
          islandLabel: point.islandLabel,
          dominantSignal: point.dominantSignal,
          profilePosition: point.profilePosition,
          previousProfilePosition: previous?.profilePosition ?? null,
          profileDelta: previous ? point.profilePosition - previous.profilePosition : null,
          legibility: point.legibility,
          previousLegibility: previous?.legibility ?? null,
          legibilityDelta: previous ? point.legibility - previous.legibility : null,
          evidenceWeight: point.evidenceWeight,
          previousEvidenceWeight: previous?.evidenceWeight ?? null,
          evidenceDelta: previous ? point.evidenceWeight - previous.evidenceWeight : null,
          averageConfidence: point.averageConfidence,
          minConfidence: point.minConfidence,
          averageVolatility: point.averageVolatility,
          positiveCohortCount: point.positiveCohortCount,
          negativeCohortCount: point.negativeCohortCount,
          unresolvedCohortCount: point.unresolvedCohortCount,
          movementScore: movementScoreFor(point, previous),
          moverReason: moverReasonFor(point, previous)
        });
        return point;
      })
      .sort((left, right) => left.islandLabel.localeCompare(right.islandLabel) || left.islandId.localeCompare(right.islandId));

    const signalCount = (signal: SystemMovementSignalType) => points.filter((point) => point.dominantSignal === signal).length;
    return {
      turn,
      points,
      domain: buildDomain(points),
      summary: {
        islandCount: points.length,
        movingIslandCount: points.filter((point) => point.trail.some((trailPoint) => Math.abs(trailPoint.profilePosition - point.profilePosition) >= 0.08)).length,
        coverageGapCount: signalCount('coverage-gap'),
        contradictionCount: signalCount('contradiction'),
        volatilityCount: signalCount('volatility'),
        averageLegibility: mean(points.map((point) => point.legibility)),
        totalEvidenceWeight: points.reduce((sum, point) => sum + point.evidenceWeight, 0)
      }
    };
  });

  const signalCounts = Object.fromEntries(
    SIGNAL_TYPES.map((signal) => [signal, allPoints.filter((point) => point.dominantSignal === signal).length])
  ) as Record<SystemMovementSignalType, number>;

  return {
    frames,
    auditRows,
    signalCounts,
    maxEvidenceWeight: Math.max(1, ...allPoints.map((point) => point.evidenceWeight))
  };
}
