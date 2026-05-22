import type { IslandAffinityReport, CohortAffinityEstimate } from './affinity.js';
import type { HiddenTasteCohort, HiddenTasteCohortKind, HiddenTasteTruthClass, Island, IslandId, CohortId } from './types.js';

export type IslandTruthComparisonStatus =
  | 'emerging-match'
  | 'unresolved'
  | 'possible-false-positive'
  | 'possible-contradiction'
  | 'random-correctly-uncertain'
  | 'missing-truth-data';

export type IslandTruthComparisonTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface IslandTruthComparisonEstimate {
  cohortId: CohortId;
  cohortLabel: string;
  affinity: number;
  confidence: number;
  ratingDeviation: number;
  volatility: number;
  effectiveWeight: number;
  evidenceCount: number;
  observedMean: number;
  uncertainty: number;
  rawCount: number;
  lastUpdatedTurn: number | null;
}

export interface IslandTruthComparisonReport {
  islandId: IslandId;
  status: IslandTruthComparisonStatus;
  statusLabel: string;
  statusTone: IslandTruthComparisonTone;
  summarySentence: string;
  caveatCopy: string;
  hiddenTruthClass: HiddenTasteTruthClass | null;
  hiddenTruthClassLabel: string;
  hiddenTargetTasteCohortId: CohortId | null;
  hiddenTargetTasteCohortKind: HiddenTasteCohortKind | null;
  hiddenTargetTasteCohortLabel: string | null;
  hiddenTargetProjectableVisibleCohortId: CohortId | null;
  hiddenTargetProjectableVisibleCohortLabel: string | null;
  hiddenAppealVectorSummary: string;
  learnedTopPositiveVisibleEstimate: IslandTruthComparisonEstimate | null;
  learnedTopNegativeVisibleEstimate: IslandTruthComparisonEstimate | null;
  learnedEstimateForHiddenTarget: IslandTruthComparisonEstimate | null;
  headlineEstimate: IslandTruthComparisonEstimate | null;
  visibleEstimates: IslandTruthComparisonEstimate[];
}

export interface BuildIslandTruthComparisonInput {
  island: Island;
  affinityReport: IslandAffinityReport | null | undefined;
  hiddenTasteCohorts: readonly HiddenTasteCohort[];
  cohortLabelById: ReadonlyMap<CohortId, string>;
}

const MATCH_CONFIDENCE_THRESHOLD = 0.5;
const TARGET_POSITIVE_AFFINITY_THRESHOLD = 0.15;
const TARGET_NEGATIVE_AFFINITY_THRESHOLD = -0.15;
const HIGH_CONFIDENCE_THRESHOLD = 0.6;
const LOW_CONFIDENCE_THRESHOLD = 0.35;
const LOW_EVIDENCE_THRESHOLD = 1.5;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function formatSigned(value: number, digits = 3): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function summarizeVector(vector: Record<string, number> | undefined): string {
  if (!vector) {
    return 'n/a';
  }

  const entries = Object.entries(vector);
  if (entries.length === 0) {
    return 'n/a';
  }

  return entries
    .slice()
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]) || right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 4)
    .map(([key, value]) => `${key} ${formatSigned(value, 2)}`)
    .join(' | ');
}

function mapEstimate(
  estimate: CohortAffinityEstimate,
  cohortLabelById: ReadonlyMap<CohortId, string>
): IslandTruthComparisonEstimate {
  return {
    cohortId: estimate.cohortId,
    cohortLabel: cohortLabelById.get(estimate.cohortId) ?? estimate.cohortId,
    affinity: estimate.affinity,
    confidence: clamp01(estimate.confidence),
    ratingDeviation: estimate.ratingDeviation ?? 1,
    volatility: estimate.volatility ?? 0,
    effectiveWeight: estimate.effectiveWeight,
    evidenceCount: estimate.evidenceCount ?? estimate.rawCount,
    observedMean: estimate.observedMean,
    uncertainty: clamp01(estimate.uncertainty ?? 1 - clamp01(estimate.confidence)),
    rawCount: estimate.rawCount,
    lastUpdatedTurn: estimate.lastUpdatedTurn ?? null
  };
}

function describeTruthClass(truthClass: HiddenTasteTruthClass | null): string {
  switch (truthClass) {
    case 'seed-cohort-match':
      return 'Seed cohort match';
    case 'unseeded-cohort-match':
      return 'Unseeded cohort match';
    case 'random':
      return 'Random / noisy truth';
    default:
      return 'n/a';
  }
}

function summarizeEstimate(estimates: readonly IslandTruthComparisonEstimate[]): IslandTruthComparisonEstimate | null {
  return estimates[0] ?? null;
}

function pickHeadlineEstimate(
  targetEstimate: IslandTruthComparisonEstimate | null,
  topPositive: IslandTruthComparisonEstimate | null,
  topNegative: IslandTruthComparisonEstimate | null
): IslandTruthComparisonEstimate | null {
  return targetEstimate ?? topPositive ?? topNegative;
}

function summarizeStatus(
  status: IslandTruthComparisonStatus,
  headlineEstimate: IslandTruthComparisonEstimate | null,
  targetLabel: string | null
): string {
  const targetFragment = targetLabel ? ` toward ${targetLabel}` : '';
  switch (status) {
    case 'emerging-match':
      return `The learned read is pointing${targetFragment}, with enough confidence to call it an emerging match.`;
    case 'possible-false-positive':
      return `The learned read is confidently favoring a different visible cohort than the hidden target projection${targetFragment ? ` ${targetFragment}` : ''}.`;
    case 'possible-contradiction':
      return `The hidden target projection is being read against the grain, so this looks like a possible contradiction${targetFragment}.`;
    case 'random-correctly-uncertain':
      return `This island is tagged as random in the toy-world audit data, and the learned read is appropriately uncertain.`;
    case 'missing-truth-data':
      return 'This island has no hidden truth fields to compare against.';
    case 'unresolved':
    default:
      return headlineEstimate
        ? `The learned read is still too soft or mixed to claim a truth alignment${targetFragment}.`
        : 'The learned read is still too sparse to compare confidently against the hidden truth.';
  }
}

function deriveStatus(
  island: Island,
  hiddenTargetCohort: HiddenTasteCohort | null,
  targetEstimate: IslandTruthComparisonEstimate | null,
  topPositive: IslandTruthComparisonEstimate | null,
  topNegative: IslandTruthComparisonEstimate | null
): IslandTruthComparisonStatus {
  const hasTruthData =
    island.hiddenTruthClass !== undefined ||
    island.hiddenTargetTasteCohortId !== undefined ||
    island.hiddenAppealVector !== undefined;

  if (!hasTruthData) {
    return 'missing-truth-data';
  }

  const truthClass = island.hiddenTruthClass ?? null;
  const targetConfidence = targetEstimate?.confidence ?? 0;
  const targetAffinity = targetEstimate?.affinity ?? 0;
  const targetEffectiveWeight = targetEstimate?.effectiveWeight ?? 0;
  const topConfidence = Math.max(topPositive?.confidence ?? 0, topNegative?.confidence ?? 0);

  if (truthClass === 'random') {
    if (topConfidence < LOW_CONFIDENCE_THRESHOLD || targetEffectiveWeight < LOW_EVIDENCE_THRESHOLD) {
      return 'random-correctly-uncertain';
    }

    if (topPositive && topPositive.confidence >= HIGH_CONFIDENCE_THRESHOLD && topPositive.affinity > 0) {
      return 'possible-false-positive';
    }

    return 'unresolved';
  }

  if (!hiddenTargetCohort || !targetEstimate) {
    return targetEffectiveWeight < LOW_EVIDENCE_THRESHOLD || topConfidence < LOW_CONFIDENCE_THRESHOLD ? 'unresolved' : 'possible-false-positive';
  }

  if (targetConfidence >= MATCH_CONFIDENCE_THRESHOLD && targetAffinity >= TARGET_POSITIVE_AFFINITY_THRESHOLD) {
    return 'emerging-match';
  }

  if (targetConfidence >= LOW_CONFIDENCE_THRESHOLD && targetAffinity <= TARGET_NEGATIVE_AFFINITY_THRESHOLD) {
    return 'possible-contradiction';
  }

  if (
    topPositive &&
    topPositive.cohortId !== targetEstimate.cohortId &&
    topPositive.confidence >= HIGH_CONFIDENCE_THRESHOLD &&
    (targetConfidence < MATCH_CONFIDENCE_THRESHOLD || targetAffinity < TARGET_POSITIVE_AFFINITY_THRESHOLD)
  ) {
    return 'possible-false-positive';
  }

  if (targetEffectiveWeight < LOW_EVIDENCE_THRESHOLD || targetConfidence < LOW_CONFIDENCE_THRESHOLD) {
    return 'unresolved';
  }

  return 'unresolved';
}

export function buildIslandTruthComparison(input: BuildIslandTruthComparisonInput): IslandTruthComparisonReport {
  const hiddenTruthClass = input.island.hiddenTruthClass ?? null;
  const hiddenTargetCohort = input.hiddenTasteCohorts.find((cohort) => cohort.id === input.island.hiddenTargetTasteCohortId) ?? null;
  const estimates = input.affinityReport?.estimates
    .slice()
    .sort((left, right) => right.affinity - left.affinity || right.confidence - left.confidence || left.cohortId.localeCompare(right.cohortId))
    .map((estimate) => mapEstimate(estimate, input.cohortLabelById)) ?? [];

  const targetVisibleCohortId = hiddenTargetCohort?.projectedSeedCohortId ?? hiddenTargetCohort?.sourceSeedCohortId ?? null;
  const targetEstimate = targetVisibleCohortId
    ? estimates.find((estimate) => estimate.cohortId === targetVisibleCohortId) ?? null
    : null;
  const topPositive = summarizeEstimate(estimates.filter((estimate) => estimate.affinity > 0));
  const topNegative = summarizeEstimate(
    estimates
      .filter((estimate) => estimate.affinity < 0)
      .slice()
      .sort((left, right) => left.affinity - right.affinity || right.confidence - left.confidence || left.cohortId.localeCompare(right.cohortId))
  );
  const headlineEstimate = pickHeadlineEstimate(targetEstimate, topPositive, topNegative);
  const status = deriveStatus(input.island, hiddenTargetCohort, targetEstimate, topPositive, topNegative);
  const targetLabel = hiddenTargetCohort ? hiddenTargetCohort.label : null;

  return {
    islandId: input.island.id,
    status,
    statusLabel:
      status === 'emerging-match'
        ? 'Emerging match'
        : status === 'possible-false-positive'
          ? 'Possible false positive'
          : status === 'possible-contradiction'
            ? 'Possible contradiction'
            : status === 'random-correctly-uncertain'
              ? 'Random correctly uncertain'
              : status === 'missing-truth-data'
                ? 'Missing truth data'
                : 'Unresolved',
    statusTone:
      status === 'emerging-match'
        ? 'success'
        : status === 'possible-false-positive'
          ? 'warning'
          : status === 'possible-contradiction'
            ? 'danger'
            : status === 'random-correctly-uncertain'
              ? 'accent'
              : status === 'missing-truth-data'
                ? 'neutral'
                : 'neutral',
    summarySentence: summarizeStatus(status, headlineEstimate, targetLabel),
    caveatCopy:
      'Hidden generator truth is toy-world audit data, not production-known truth. It is available here only so the learned read can be checked against a controlled target.',
    hiddenTruthClass,
    hiddenTruthClassLabel: describeTruthClass(hiddenTruthClass),
    hiddenTargetTasteCohortId: input.island.hiddenTargetTasteCohortId ?? null,
    hiddenTargetTasteCohortKind: hiddenTargetCohort?.kind ?? null,
    hiddenTargetTasteCohortLabel: hiddenTargetCohort?.label ?? null,
    hiddenTargetProjectableVisibleCohortId: targetVisibleCohortId,
    hiddenTargetProjectableVisibleCohortLabel: targetVisibleCohortId ? input.cohortLabelById.get(targetVisibleCohortId) ?? targetVisibleCohortId : null,
    hiddenAppealVectorSummary: summarizeVector(input.island.hiddenAppealVector),
    learnedTopPositiveVisibleEstimate: topPositive,
    learnedTopNegativeVisibleEstimate: topNegative,
    learnedEstimateForHiddenTarget: targetEstimate,
    headlineEstimate,
    visibleEstimates: estimates
  };
}
