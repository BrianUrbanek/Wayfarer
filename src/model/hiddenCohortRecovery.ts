import type { IslandAffinityReport, CohortAffinityEstimate } from './affinity.js';
import { buildIslandTruthComparison } from './islandTruthComparison.js';
import type { ObservedBehaviorEvent } from './observedBehavior.js';
import type { RatingEvent } from './simulation.js';
import type { HiddenTasteCohort, HiddenTasteCohortKind, CohortId, Island, IslandId, User } from './types.js';

export type HiddenCohortRecoveryStatus =
  | 'seed-recovered'
  | 'seed-emerging'
  | 'unseeded-recovered'
  | 'unseeded-emerging'
  | 'unresolved'
  | 'random-correctly-uncertain'
  | 'possible-overfit'
  | 'missing-truth-data';

export type HiddenCohortRecoveryTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface HiddenCohortRecoveryRow {
  hiddenTasteCohortId: CohortId;
  hiddenTasteCohortLabel: string;
  hiddenTasteCohortKind: HiddenTasteCohortKind;
  projectedVisibleSeedCohortId: CohortId;
  projectedVisibleSeedCohortLabel: string;
  assignedUserCount: number;
  targetedIslandCount: number;
  learnedIslandCount: number;
  ratedEventCount: number;
  observedBehaviorCount: number;
  averageLearnedCertainty: number;
  averageLearnedAffinity: number;
  averageLearnedRatingDeviation: number;
  averageLearnedVolatility: number;
  averageLearnedEffectiveWeight: number;
  status: HiddenCohortRecoveryStatus;
  statusLabel: string;
  statusTone: HiddenCohortRecoveryTone;
  explanation: string;
}

export interface HiddenCohortRecoveryRandomIslandRow {
  islandId: IslandId;
  islandLabel: string;
  status: HiddenCohortRecoveryStatus;
  statusLabel: string;
  statusTone: HiddenCohortRecoveryTone;
  headlineEstimateLabel: string;
  headlineEstimateAffinity: number;
  headlineEstimateCertainty: number;
  headlineEstimateRatingDeviation: number;
  headlineEstimateVolatility: number;
  explanation: string;
}

export interface HiddenCohortRecoveryReport {
  status: HiddenCohortRecoveryStatus;
  statusLabel: string;
  statusTone: HiddenCohortRecoveryTone;
  summarySentence: string;
  caveatCopy: string;
  seedHiddenCohortCount: number;
  unseededHiddenCohortCount: number;
  seedRecoveredCount: number;
  seedEmergingCount: number;
  unseededRecoveredCount: number;
  unseededEmergingCount: number;
  unresolvedCount: number;
  randomCorrectlyUncertainCount: number;
  possibleOverfitCount: number;
  randomIslandCount: number;
  rows: HiddenCohortRecoveryRow[];
  randomIslandRows: HiddenCohortRecoveryRandomIslandRow[];
}

export interface HiddenCohortRecoveryHeadlineInput {
  seedRecoveredCount: number;
  seedEmergingCount: number;
  unseededRecoveredCount: number;
  unseededEmergingCount: number;
  unresolvedCount: number;
  randomCorrectlyUncertainCount: number;
  possibleOverfitCount: number;
}

export interface BuildHiddenCohortRecoveryReportInput {
  hiddenTasteCohorts: readonly HiddenTasteCohort[];
  users: readonly User[];
  islands: readonly Island[];
  ratingEvents: readonly RatingEvent[];
  observedBehaviorEvents: readonly ObservedBehaviorEvent[];
  islandAffinityReports: ReadonlyMap<IslandId, IslandAffinityReport>;
  cohortLabelById: ReadonlyMap<CohortId, string>;
}

const RECOVERED_CERTAINTY_THRESHOLD = 0.55;
const EMERGING_CERTAINTY_THRESHOLD = 0.35;
const RECOVERED_AFFINITY_THRESHOLD = 0.18;
const EMERGING_AFFINITY_THRESHOLD = 0.08;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatSigned(value: number, digits = 3): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

function toneForStatus(status: HiddenCohortRecoveryStatus): HiddenCohortRecoveryTone {
  switch (status) {
    case 'seed-recovered':
    case 'unseeded-recovered':
      return 'success';
    case 'seed-emerging':
    case 'unseeded-emerging':
      return 'accent';
    case 'possible-overfit':
      return 'danger';
    case 'random-correctly-uncertain':
      return 'warning';
    case 'missing-truth-data':
      return 'neutral';
    case 'unresolved':
    default:
      return 'neutral';
  }
}

function statusLabelFor(status: HiddenCohortRecoveryStatus): string {
  switch (status) {
    case 'seed-recovered':
      return 'Seed recovered';
    case 'seed-emerging':
      return 'Seed emerging';
    case 'unseeded-recovered':
      return 'Unseeded recovered';
    case 'unseeded-emerging':
      return 'Unseeded signal emerging';
    case 'possible-overfit':
      return 'Possible overfit';
    case 'random-correctly-uncertain':
      return 'Random correctly uncertain';
    case 'missing-truth-data':
      return 'Missing truth data';
    case 'unresolved':
    default:
      return 'Mostly unresolved';
  }
}

function summarizeStatus(status: HiddenCohortRecoveryStatus, rowCount: number): string {
  switch (status) {
    case 'seed-recovered':
      return 'The seeded hidden cohorts are being recovered cleanly by the learned read.';
    case 'seed-emerging':
      return 'Seeded hidden structure is visible, but the read is still soft enough to stay cautious.';
    case 'unseeded-recovered':
      return 'The learned read is recovering hidden structure beyond the original seed cohorts.';
    case 'unseeded-emerging':
      return 'Unseeded hidden structure is emerging, but the proof is still compact and cautious.';
    case 'possible-overfit':
      return 'Random or noisy islands are being explained too confidently, which looks like possible overfit.';
    case 'random-correctly-uncertain':
      return 'Random or noisy islands remain appropriately uncertain in the toy-world audit data.';
    case 'missing-truth-data':
      return 'This dataset does not expose the hidden truth fields needed for a recovery read.';
    case 'unresolved':
    default:
      return rowCount > 0
        ? 'The hidden cohort read is still too mixed or sparse to call recovery with confidence.'
        : 'There is not enough hidden cohort signal yet to form a recovery read.';
  }
}

function explanationForRow(row: HiddenCohortRecoveryRow): string {
  const certaintyText = row.learnedIslandCount > 0 ? `${Math.round(row.averageLearnedCertainty * 100)}% average certainty` : 'no learned estimate';
  const affinityText = row.learnedIslandCount > 0 ? `affinity ${formatSigned(row.averageLearnedAffinity)}` : 'no projected affinity';

  switch (row.status) {
    case 'seed-recovered':
      return `Seeded cohort ${row.hiddenTasteCohortLabel} is recovered across ${row.learnedIslandCount} targeted islands (${certaintyText}, ${affinityText}).`;
    case 'seed-emerging':
      return `Seeded cohort ${row.hiddenTasteCohortLabel} is emerging across ${row.learnedIslandCount} targeted islands (${certaintyText}, ${affinityText}).`;
    case 'unseeded-recovered':
      return `Unseeded cohort ${row.hiddenTasteCohortLabel} is recovered beyond the initial seed read across ${row.learnedIslandCount} targeted islands (${certaintyText}, ${affinityText}).`;
    case 'unseeded-emerging':
      return `Unseeded cohort ${row.hiddenTasteCohortLabel} is emerging beyond the initial seed read across ${row.learnedIslandCount} targeted islands (${certaintyText}, ${affinityText}).`;
    case 'unresolved':
    default:
      return `${row.hiddenTasteCohortLabel} has ${row.learnedIslandCount} learned targeted islands, but the read is still too soft to call recovery.`;
  }
}

function deriveHiddenCohortStatus(
  kind: HiddenTasteCohortKind,
  learnedIslandCount: number,
  averageLearnedCertainty: number,
  averageLearnedAffinity: number
): HiddenCohortRecoveryStatus {
  if (learnedIslandCount === 0) {
    return 'unresolved';
  }

  const affinityFloor = kind === 'unseeded' ? EMERGING_AFFINITY_THRESHOLD : EMERGING_AFFINITY_THRESHOLD / 2;
  const recoveredAffinityFloor = kind === 'unseeded' ? RECOVERED_AFFINITY_THRESHOLD : RECOVERED_AFFINITY_THRESHOLD - 0.03;
  const emergingCertaintyFloor = kind === 'unseeded' ? EMERGING_CERTAINTY_THRESHOLD : EMERGING_CERTAINTY_THRESHOLD + 0.05;
  const recoveredCertaintyFloor = kind === 'unseeded' ? RECOVERED_CERTAINTY_THRESHOLD : RECOVERED_CERTAINTY_THRESHOLD - 0.05;

  if (averageLearnedCertainty >= recoveredCertaintyFloor && averageLearnedAffinity >= recoveredAffinityFloor) {
    return kind === 'unseeded' ? 'unseeded-recovered' : 'seed-recovered';
  }

  if (averageLearnedCertainty >= emergingCertaintyFloor && averageLearnedAffinity >= affinityFloor) {
    return kind === 'unseeded' ? 'unseeded-emerging' : 'seed-emerging';
  }

  return 'unresolved';
}

function averageEstimateField(
  estimates: readonly CohortAffinityEstimate[],
  selector: (estimate: CohortAffinityEstimate) => number
): number {
  return average(estimates.map(selector));
}

function buildHiddenCohortRow(
  cohort: HiddenTasteCohort,
  users: readonly User[],
  islands: readonly Island[],
  ratingEvents: readonly RatingEvent[],
  observedBehaviorEvents: readonly ObservedBehaviorEvent[],
  islandAffinityReports: ReadonlyMap<IslandId, IslandAffinityReport>,
  cohortLabelById: ReadonlyMap<CohortId, string>
): HiddenCohortRecoveryRow {
  const projectedVisibleSeedCohortLabel = cohortLabelById.get(cohort.projectedSeedCohortId) ?? cohort.projectedSeedCohortId;
  const assignedUsers = users.filter((user) => user.hiddenTasteCohortId === cohort.id);
  const targetedIslands = islands.filter((island) => island.hiddenTargetTasteCohortId === cohort.id);
  const targetedEstimates = targetedIslands.flatMap((island) => {
    const report = islandAffinityReports.get(island.id);
    if (!report) {
      return [];
    }

    return report.estimates.filter((estimate) => estimate.cohortId === cohort.projectedSeedCohortId);
  });
  const relevantUserIds = new Set(assignedUsers.map((user) => user.id));
  const ratedEventCount = ratingEvents.filter((event) => relevantUserIds.has(event.userId)).length;
  const observedBehaviorCount = observedBehaviorEvents.filter((event) => relevantUserIds.has(event.userId)).length;
  const averageLearnedCertainty = averageEstimateField(targetedEstimates, (estimate) => clamp01(estimate.confidence));
  const averageLearnedAffinity = averageEstimateField(targetedEstimates, (estimate) => estimate.affinity);
  const averageLearnedRatingDeviation = averageEstimateField(
    targetedEstimates,
    (estimate) => estimate.ratingDeviation ?? 1
  );
  const averageLearnedVolatility = averageEstimateField(targetedEstimates, (estimate) => estimate.volatility ?? 0);
  const averageLearnedEffectiveWeight = averageEstimateField(targetedEstimates, (estimate) => estimate.effectiveWeight);
  const status = deriveHiddenCohortStatus(
    cohort.kind,
    targetedEstimates.length,
    averageLearnedCertainty,
    averageLearnedAffinity
  );

  return {
    hiddenTasteCohortId: cohort.id,
    hiddenTasteCohortLabel: cohort.label,
    hiddenTasteCohortKind: cohort.kind,
    projectedVisibleSeedCohortId: cohort.projectedSeedCohortId,
    projectedVisibleSeedCohortLabel,
    assignedUserCount: assignedUsers.length,
    targetedIslandCount: targetedIslands.length,
    learnedIslandCount: targetedEstimates.length,
    ratedEventCount,
    observedBehaviorCount,
    averageLearnedCertainty,
    averageLearnedAffinity,
    averageLearnedRatingDeviation,
    averageLearnedVolatility,
    averageLearnedEffectiveWeight,
    status,
    statusLabel: statusLabelFor(status),
    statusTone: toneForStatus(status),
    explanation: ''
  };
}

function summarizeRandomIsland(
  island: Island,
  islandAffinityReports: ReadonlyMap<IslandId, IslandAffinityReport>,
  hiddenTasteCohorts: readonly HiddenTasteCohort[],
  cohortLabelById: ReadonlyMap<CohortId, string>
): HiddenCohortRecoveryRandomIslandRow {
  const truthComparison = buildIslandTruthComparison({
    island,
    affinityReport: islandAffinityReports.get(island.id) ?? null,
    hiddenTasteCohorts,
    cohortLabelById
  });
  const headlineEstimate = truthComparison.headlineEstimate;
  const status = truthComparison.status === 'random-correctly-uncertain'
    ? 'random-correctly-uncertain'
    : truthComparison.status === 'possible-false-positive' || truthComparison.status === 'possible-contradiction'
      ? 'possible-overfit'
      : 'unresolved';

  return {
    islandId: island.id,
    islandLabel: island.label,
    status,
    statusLabel: statusLabelFor(status),
    statusTone: toneForStatus(status),
    headlineEstimateLabel: headlineEstimate?.cohortLabel ?? 'n/a',
    headlineEstimateAffinity: headlineEstimate?.affinity ?? 0,
    headlineEstimateCertainty: headlineEstimate?.confidence ?? 0,
    headlineEstimateRatingDeviation: headlineEstimate?.ratingDeviation ?? 1,
    headlineEstimateVolatility: headlineEstimate?.volatility ?? 0,
    explanation:
      status === 'possible-overfit'
        ? `The random island is being explained with unusually confident structure, which suggests possible overfit.`
        : status === 'random-correctly-uncertain'
          ? `The random island remains appropriately uncertain in the toy-world audit data.`
          : `The random island is not yet being explained with enough confidence to call overfit.`
  };
}

function summarizeHeadline(report: HiddenCohortRecoveryHeadlineInput): HiddenCohortRecoveryStatus {
  if (report.unseededRecoveredCount > 0) {
    return 'unseeded-recovered';
  }

  if (report.unseededEmergingCount > 0) {
    return 'unseeded-emerging';
  }

  if (report.seedRecoveredCount > 0) {
    return 'seed-recovered';
  }

  if (report.seedEmergingCount > 0) {
    return 'seed-emerging';
  }

  if (report.unresolvedCount > 0) {
    return 'unresolved';
  }

  if (report.possibleOverfitCount > 0) {
    return 'possible-overfit';
  }

  if (report.randomCorrectlyUncertainCount > 0) {
    return 'random-correctly-uncertain';
  }

  return 'unresolved';
}

export function pickHiddenCohortRecoveryHeadline(
  report: HiddenCohortRecoveryHeadlineInput
): HiddenCohortRecoveryStatus {
  return summarizeHeadline(report);
}

export function buildHiddenCohortRecoveryReport(
  input: BuildHiddenCohortRecoveryReportInput
): HiddenCohortRecoveryReport {
  if (input.hiddenTasteCohorts.length === 0) {
    return {
      status: 'missing-truth-data',
      statusLabel: statusLabelFor('missing-truth-data'),
      statusTone: toneForStatus('missing-truth-data'),
      summarySentence: summarizeStatus('missing-truth-data', 0),
      caveatCopy:
        'Hidden generator truth is toy-world audit data, not production-known truth. It is available here only so seeded versus unseeded structure can be checked against a controlled target.',
      seedHiddenCohortCount: 0,
      unseededHiddenCohortCount: 0,
      seedRecoveredCount: 0,
      seedEmergingCount: 0,
      unseededRecoveredCount: 0,
      unseededEmergingCount: 0,
      unresolvedCount: 0,
      randomCorrectlyUncertainCount: 0,
      possibleOverfitCount: 0,
      randomIslandCount: 0,
      rows: [],
      randomIslandRows: []
    };
  }

  const rows = input.hiddenTasteCohorts
    .slice()
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.label.localeCompare(right.label))
    .map((cohort) =>
      buildHiddenCohortRow(
        cohort,
        input.users,
        input.islands,
        input.ratingEvents,
        input.observedBehaviorEvents,
        input.islandAffinityReports,
        input.cohortLabelById
      )
    );

  for (const row of rows) {
    row.explanation = explanationForRow(row);
  }

  const randomIslandRows = input.islands
    .filter((island) => island.hiddenTruthClass === 'random')
    .map((island) => summarizeRandomIsland(island, input.islandAffinityReports, input.hiddenTasteCohorts, input.cohortLabelById))
    .sort((left, right) => left.islandLabel.localeCompare(right.islandLabel));

  const seedHiddenCohortCount = rows.filter((row) => row.hiddenTasteCohortKind === 'seed').length;
  const unseededHiddenCohortCount = rows.filter((row) => row.hiddenTasteCohortKind === 'unseeded').length;
  const seedRecoveredCount = rows.filter((row) => row.status === 'seed-recovered').length;
  const seedEmergingCount = rows.filter((row) => row.status === 'seed-emerging').length;
  const unseededRecoveredCount = rows.filter((row) => row.status === 'unseeded-recovered').length;
  const unseededEmergingCount = rows.filter((row) => row.status === 'unseeded-emerging').length;
  const unresolvedCount = rows.filter((row) => row.status === 'unresolved').length;
  const randomCorrectlyUncertainCount = randomIslandRows.filter((row) => row.status === 'random-correctly-uncertain').length;
  const possibleOverfitCount = randomIslandRows.filter((row) => row.status === 'possible-overfit').length;
  const randomIslandCount = randomIslandRows.length;
  const aggregate = {
    status: 'unresolved' as HiddenCohortRecoveryStatus,
    statusLabel: '',
    statusTone: 'neutral' as HiddenCohortRecoveryTone,
    summarySentence: '',
    caveatCopy:
      'Hidden generator truth is toy-world audit data, not production-known truth. It is available here only so seeded versus unseeded structure can be checked against a controlled target.',
    seedHiddenCohortCount,
    unseededHiddenCohortCount,
    seedRecoveredCount,
    seedEmergingCount,
    unseededRecoveredCount,
    unseededEmergingCount,
    unresolvedCount,
    randomCorrectlyUncertainCount,
    possibleOverfitCount,
    randomIslandCount
  };
  const status = summarizeHeadline(aggregate);

  return {
    ...aggregate,
    status,
    statusLabel: statusLabelFor(status),
    statusTone: toneForStatus(status),
    summarySentence: summarizeStatus(status, rows.length),
    rows,
    randomIslandRows
  };
}
