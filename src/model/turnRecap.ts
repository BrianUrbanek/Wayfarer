import type { CohortAnchor, CohortId, Island, IslandId } from './types.js';
import type { IslandCohortRatingState } from './islandCohortRating.js';
import type { SimulationTurnSummary } from './simulation.js';

export type TurnRecapStatus = 'bootstrap' | 'quiet-turn' | 'movers' | 'no-turn-history';
export type TurnRecapTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export type TurnRecapMoverKind = 'affinity' | 'certainty' | 'rating-deviation' | 'volatility' | 'evidence';

export interface TurnRecapRow {
  islandId: IslandId;
  islandLabel: string;
  cohortId: CohortId;
  cohortLabel: string;
  comparisonAvailable: boolean;
  currentTurn: number;
  previousTurn: number | null;
  currentAffinity: number;
  previousAffinity: number | null;
  affinityDelta: number | null;
  currentConfidence: number;
  previousConfidence: number | null;
  confidenceDelta: number | null;
  currentRatingDeviation: number;
  previousRatingDeviation: number | null;
  ratingDeviationDelta: number | null;
  currentVolatility: number;
  previousVolatility: number | null;
  volatilityDelta: number | null;
  currentEffectiveWeight: number;
  previousEffectiveWeight: number | null;
  effectiveWeightDelta: number | null;
  currentEvidenceCount: number;
  previousEvidenceCount: number | null;
  evidenceCountDelta: number | null;
  moverKind: TurnRecapMoverKind | null;
  moverLabel: string;
  moverDirectionLabel: string;
  score: number;
}

export interface TurnRecapReport {
  status: TurnRecapStatus;
  statusLabel: string;
  statusTone: TurnRecapTone;
  summarySentence: string;
  caveatCopy: string;
  currentTurn: number | null;
  previousTurn: number | null;
  turnMode: SimulationTurnSummary['mode'] | null;
  ratingsCreated: number;
  organicRatingsCreated: number;
  guidedRatingsCreated: number;
  meaningfulMoverCount: number;
  rows: TurnRecapRow[];
  highlightRows: TurnRecapRow[];
  hasComparison: boolean;
}

export interface BuildTurnRecapReportInput {
  turnHistory: readonly SimulationTurnSummary[];
  islandCohortRatingSnapshots: readonly IslandCohortRatingState[];
  islands: readonly Island[];
  cohorts: readonly CohortAnchor[];
  islandLabelById: ReadonlyMap<IslandId, string>;
  cohortLabelById: ReadonlyMap<CohortId, string>;
}

const MEANINGFUL_SCORE_THRESHOLD = 0.05;

function formatSigned(value: number, digits = 3): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

function statusToneFor(status: TurnRecapStatus): TurnRecapTone {
  switch (status) {
    case 'movers':
      return 'accent';
    case 'bootstrap':
      return 'warning';
    case 'no-turn-history':
      return 'neutral';
    case 'quiet-turn':
    default:
      return 'neutral';
  }
}

function statusLabelFor(status: TurnRecapStatus): string {
  switch (status) {
    case 'movers':
      return 'Meaningful movers';
    case 'bootstrap':
      return 'Bootstrap turn';
    case 'no-turn-history':
      return 'No turn history';
    case 'quiet-turn':
    default:
      return 'Quiet turn';
  }
}

function compareByPriority(left: TurnRecapRow, right: TurnRecapRow): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.islandLabel !== right.islandLabel) {
    return left.islandLabel.localeCompare(right.islandLabel);
  }

  if (left.cohortLabel !== right.cohortLabel) {
    return left.cohortLabel.localeCompare(right.cohortLabel);
  }

  return `${left.islandId}:${left.cohortId}`.localeCompare(`${right.islandId}:${right.cohortId}`);
}

function compareByLabel(left: TurnRecapRow, right: TurnRecapRow): number {
  if (left.islandLabel !== right.islandLabel) {
    return left.islandLabel.localeCompare(right.islandLabel);
  }

  if (left.cohortLabel !== right.cohortLabel) {
    return left.cohortLabel.localeCompare(right.cohortLabel);
  }

  return `${left.islandId}:${left.cohortId}`.localeCompare(`${right.islandId}:${right.cohortId}`);
}

function summarizeMoverKindFromDeltas(input: {
  affinityDelta: number | null;
  confidenceDelta: number | null;
  ratingDeviationDelta: number | null;
  volatilityDelta: number | null;
  effectiveWeightDelta: number | null;
  evidenceCountDelta: number | null;
}): { kind: TurnRecapMoverKind | null; score: number } {
  const scores: Array<[TurnRecapMoverKind, number]> = [
    ['affinity', Math.abs(input.affinityDelta ?? 0)],
    ['certainty', Math.abs(input.confidenceDelta ?? 0)],
    ['rating-deviation', Math.abs(input.ratingDeviationDelta ?? 0)],
    ['volatility', Math.abs(input.volatilityDelta ?? 0)],
    ['evidence', Math.max(Math.abs(input.effectiveWeightDelta ?? 0), Math.abs(input.evidenceCountDelta ?? 0) * 0.05)]
  ];

  scores.sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const top = scores[0];

  if (!top || top[1] <= 0) {
    return { kind: null, score: 0 };
  }

  return { kind: top[0], score: top[1] };
}

function moverLabelFor(kind: TurnRecapMoverKind | null): string {
  switch (kind) {
    case 'affinity':
      return 'Affinity';
    case 'certainty':
      return 'Certainty';
    case 'rating-deviation':
      return 'RD';
    case 'volatility':
      return 'Volatility';
    case 'evidence':
      return 'Evidence';
    default:
      return 'Baseline';
  }
}

function directionLabelFor(value: number | null, kind: TurnRecapMoverKind | null): string {
  if (value === null || !Number.isFinite(value)) {
    return 'n/a';
  }

  if (Math.abs(value) < 0.001) {
    return 'flat';
  }

  if (kind === 'rating-deviation') {
    return value < 0 ? `down ${formatSigned(value)}` : `up ${formatSigned(value)}`;
  }

  if (kind === 'volatility') {
    return value > 0 ? `up ${formatSigned(value)}` : `down ${formatSigned(value)}`;
  }

  return value > 0 ? `up ${formatSigned(value)}` : `down ${formatSigned(value)}`;
}

function buildSnapshotIndex(
  snapshots: readonly IslandCohortRatingState[],
  turn: number
): ReadonlyMap<string, IslandCohortRatingState> {
  const map = new Map<string, IslandCohortRatingState>();
  for (const snapshot of snapshots) {
    if (snapshot.turn !== turn) {
      continue;
    }

    map.set(`${snapshot.islandId}:${snapshot.cohortId}`, snapshot);
  }
  return map;
}

function buildRowsForTurn(
  currentTurn: number,
  previousTurn: number | null,
  currentByPair: ReadonlyMap<string, IslandCohortRatingState>,
  previousByPair: ReadonlyMap<string, IslandCohortRatingState> | null,
  islandLabelById: ReadonlyMap<IslandId, string>,
  cohortLabelById: ReadonlyMap<CohortId, string>
): TurnRecapRow[] {
  const rows = Array.from(currentByPair.values()).map<TurnRecapRow>((current) => {
    const previous = previousByPair?.get(`${current.islandId}:${current.cohortId}`) ?? null;
    const comparisonAvailable = Boolean(previous);
    const affinityDelta = comparisonAvailable ? current.affinity - (previous?.affinity ?? 0) : null;
    const confidenceDelta = comparisonAvailable ? current.confidence - (previous?.confidence ?? 0) : null;
    const ratingDeviationDelta = comparisonAvailable ? current.ratingDeviation - (previous?.ratingDeviation ?? 0) : null;
    const volatilityDelta = comparisonAvailable ? current.volatility - (previous?.volatility ?? 0) : null;
    const effectiveWeightDelta = comparisonAvailable ? current.effectiveWeight - (previous?.effectiveWeight ?? 0) : null;
    const evidenceCountDelta = comparisonAvailable ? current.evidenceCount - (previous?.evidenceCount ?? 0) : null;
    const mover = comparisonAvailable
      ? summarizeMoverKindFromDeltas({
          affinityDelta,
          confidenceDelta,
          ratingDeviationDelta,
          volatilityDelta,
          effectiveWeightDelta,
          evidenceCountDelta
        })
      : { kind: null, score: 0 };

    return {
      islandId: current.islandId,
      islandLabel: islandLabelById.get(current.islandId) ?? current.islandId,
      cohortId: current.cohortId,
      cohortLabel: cohortLabelById.get(current.cohortId) ?? current.cohortId,
      comparisonAvailable,
      currentTurn,
      previousTurn,
      currentAffinity: current.affinity,
      previousAffinity: previous?.affinity ?? null,
      affinityDelta,
      currentConfidence: current.confidence,
      previousConfidence: previous?.confidence ?? null,
      confidenceDelta,
      currentRatingDeviation: current.ratingDeviation,
      previousRatingDeviation: previous?.ratingDeviation ?? null,
      ratingDeviationDelta,
      currentVolatility: current.volatility,
      previousVolatility: previous?.volatility ?? null,
      volatilityDelta,
      currentEffectiveWeight: current.effectiveWeight,
      previousEffectiveWeight: previous?.effectiveWeight ?? null,
      effectiveWeightDelta,
      currentEvidenceCount: current.evidenceCount,
      previousEvidenceCount: previous?.evidenceCount ?? null,
      evidenceCountDelta,
      moverKind: mover.kind,
      moverLabel: moverLabelFor(mover.kind),
      moverDirectionLabel:
        mover.kind === 'rating-deviation'
          ? directionLabelFor(ratingDeviationDelta, mover.kind)
          : mover.kind === 'volatility'
            ? directionLabelFor(volatilityDelta, mover.kind)
            : mover.kind === 'evidence'
              ? directionLabelFor(effectiveWeightDelta ?? evidenceCountDelta, mover.kind)
              : mover.kind === 'certainty'
                ? directionLabelFor(confidenceDelta, mover.kind)
                : directionLabelFor(affinityDelta, mover.kind),
      score: mover.score
    };
  });

  return rows.sort(compareByPriority);
}

function summarizeHeadline(rows: TurnRecapRow[], hasComparison: boolean): TurnRecapStatus {
  if (!hasComparison) {
    return rows.length > 0 ? 'bootstrap' : 'no-turn-history';
  }

  if (rows.some((row) => row.score >= MEANINGFUL_SCORE_THRESHOLD)) {
    return 'movers';
  }

  return 'quiet-turn';
}

function summarizeSentence(
  status: TurnRecapStatus,
  currentTurn: number | null,
  previousTurn: number | null,
  ratingsCreated: number,
  organicRatingsCreated: number,
  guidedRatingsCreated: number,
  highlightRows: TurnRecapRow[]
): string {
  if (status === 'no-turn-history') {
    return 'No turn history is available yet, so there is nothing to recap.';
  }

  if (status === 'bootstrap') {
    return 'This is the bootstrap turn, so the recap shows the current baseline instead of a turn-over-turn delta.';
  }

  if (status === 'quiet-turn') {
    if (ratingsCreated === 0) {
      return `Turn ${currentTurn} created no ratings, so there were no meaningful movers to call out.`;
    }

    return `Turn ${currentTurn} created ${ratingsCreated} ratings (${organicRatingsCreated} organic / ${guidedRatingsCreated} guided), but no island/cohort read moved enough to stand out over the previous turn ${previousTurn}.`;
  }

  const top = highlightRows[0];
  if (!top) {
    return `Turn ${currentTurn} created ${ratingsCreated} ratings, but no mover could be highlighted.`;
  }

  return `Turn ${currentTurn} created ${ratingsCreated} ratings (${organicRatingsCreated} organic / ${guidedRatingsCreated} guided); the biggest mover was ${top.islandLabel} / ${top.cohortLabel} with ${top.moverLabel.toLowerCase()} ${top.moverDirectionLabel}.`;
}

export function buildTurnRecapReport(input: BuildTurnRecapReportInput): TurnRecapReport {
  const turnHistory = input.turnHistory.slice().sort((left, right) => left.turn - right.turn);
  const currentTurnSummary = turnHistory[turnHistory.length - 1] ?? null;
  const previousTurnSummary = turnHistory.length > 1 ? turnHistory[turnHistory.length - 2] : null;
  const turnNumbers = Array.from(new Set(turnHistory.map((summary) => summary.turn))).sort((left, right) => left - right);
  const snapshotTurnNumbers = Array.from(new Set(input.islandCohortRatingSnapshots.map((snapshot) => snapshot.turn))).sort((left, right) => left - right);
  const currentTurn = currentTurnSummary?.turn ?? turnNumbers[turnNumbers.length - 1] ?? snapshotTurnNumbers[snapshotTurnNumbers.length - 1] ?? null;
  const previousTurn =
    previousTurnSummary?.turn ??
    (turnNumbers.length > 1 ? turnNumbers[turnNumbers.length - 2] : null) ??
    (snapshotTurnNumbers.length > 1 ? snapshotTurnNumbers[snapshotTurnNumbers.length - 2] : null);
  const currentByPair = currentTurn !== null ? buildSnapshotIndex(input.islandCohortRatingSnapshots, currentTurn) : new Map();
  const previousByPair = previousTurn !== null ? buildSnapshotIndex(input.islandCohortRatingSnapshots, previousTurn) : null;
  const hasComparison = previousByPair !== null && previousByPair.size > 0 && currentByPair.size > 0;
  const rows = buildRowsForTurn(
    currentTurn ?? 0,
    previousTurn,
    currentByPair,
    previousByPair,
    input.islandLabelById,
    input.cohortLabelById
  );
  const highlightRows = rows.filter((row) => row.score >= MEANINGFUL_SCORE_THRESHOLD).slice(0, 3);
  const status = summarizeHeadline(rows, hasComparison);
  const ratingsCreated = currentTurnSummary?.ratingsCreated ?? 0;
  const organicRatingsCreated = currentTurnSummary?.organicRatingsCreated ?? 0;
  const guidedRatingsCreated = currentTurnSummary?.guidedRatingsCreated ?? 0;
  const summarySentence = summarizeSentence(
    status,
    currentTurn,
    previousTurn,
    ratingsCreated,
    organicRatingsCreated,
    guidedRatingsCreated,
    highlightRows
  );
  const moverScores = rows.map((row) => row.score).filter((score) => score >= MEANINGFUL_SCORE_THRESHOLD);
  const meaningfulMoverCount = moverScores.length;

  return {
    status,
    statusLabel: statusLabelFor(status),
    statusTone: statusToneFor(status),
    summarySentence,
    caveatCopy:
      'Turn recap compares the latest turn/update boundary against the previous boundary using stored island/cohort rating snapshots. It is a diagnostic read, not a model change or routing decision.',
    currentTurn,
    previousTurn,
    turnMode: currentTurnSummary?.mode ?? null,
    ratingsCreated,
    organicRatingsCreated,
    guidedRatingsCreated,
    meaningfulMoverCount,
    rows: rows.sort(compareByLabel),
    highlightRows,
    hasComparison
  };
}
