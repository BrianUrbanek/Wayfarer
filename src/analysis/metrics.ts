import type { SimulationState } from '../model/simulation.js';
import type { ExperimentPolicyAggregateMetrics, ExperimentPolicyCase, ExperimentPolicyComparison, ExperimentRunAggregateMetrics, ExperimentRunMetrics, ExperimentReporterOptions, ExperimentTurnMetrics } from './experimentTypes.js';
import { DEFAULT_UNDER_REVIEWED_EVIDENCE_THRESHOLD, DEFAULT_USEFUL_SIGNAL_THRESHOLD } from './experimentTypes.js';

function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = values.slice().sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function safeRatio(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function collectNumberArray<T>(
  values: Iterable<T>,
  projector: (value: T) => number
): number[] {
  return Array.from(values, projector);
}

export function buildTurnMetrics(
  state: SimulationState,
  durationMs: number,
  reporterOptions: ExperimentReporterOptions = {}
): ExperimentTurnMetrics {
  const summary = state.turnHistory.at(-1);
  if (!summary) {
    throw new Error('Cannot build turn metrics without a turn summary.');
  }

  const underReviewedEvidenceThreshold =
    reporterOptions.underReviewedEvidenceThreshold ?? DEFAULT_UNDER_REVIEWED_EVIDENCE_THRESHOLD;

  const overallSignalValues = collectNumberArray(state.raterSignalProfiles.values(), (profile) => profile.overallSignal);
  const signalEvidenceValues = collectNumberArray(state.raterSignalProfiles.values(), (profile) => profile.signalEvidence);
  const affinityConfidenceValues = collectNumberArray(state.islandAffinityReports.values(), (report) =>
    report.estimates.length > 0 ? mean(report.estimates.map((estimate) => estimate.confidence)) : 0
  );
  const affinityEvidenceValues = collectNumberArray(state.islandAffinityReports.values(), (report) =>
    sum(report.estimates.map((estimate) => estimate.effectiveWeight))
  );
  const underReviewedIslandEvidence = affinityEvidenceValues.filter((evidence) => evidence < underReviewedEvidenceThreshold);

  return {
    turn: summary.turn,
    mode: summary.mode,
    participatingUserCount: summary.participatingUserIds.length,
    ratingsCreated: summary.ratingsCreated,
    organicRatingsCreated: summary.organicRatingsCreated,
    guidedRatingsCreated: summary.guidedRatingsCreated,
    newlyRatedIslandCount: summary.newlyRatedIslandIds.length,
    routedIslandCount: summary.routedIslandIds.length,
    recommendationKindCounts: { ...summary.recommendationKinds },
    durationMs,
    meanOverallSignal: mean(overallSignalValues),
    medianOverallSignal: median(overallSignalValues),
    meanSignalEvidence: mean(signalEvidenceValues),
    medianSignalEvidence: median(signalEvidenceValues),
    meanAffinityConfidence: mean(affinityConfidenceValues),
    medianAffinityConfidence: median(affinityConfidenceValues),
    meanAffinityEvidence: mean(affinityEvidenceValues),
    medianAffinityEvidence: median(affinityEvidenceValues),
    underReviewedIslandCount: underReviewedIslandEvidence.length,
    underReviewedIslandEvidenceMean: mean(underReviewedIslandEvidence),
    underReviewedIslandEvidenceMedian: median(underReviewedIslandEvidence)
  };
}

export function buildRunAggregateMetrics(
  state: SimulationState,
  turnMetrics: readonly ExperimentTurnMetrics[],
  reporterOptions: ExperimentReporterOptions = {}
): ExperimentRunAggregateMetrics {
  const usefulSignalThreshold = reporterOptions.usefulSignalThreshold ?? DEFAULT_USEFUL_SIGNAL_THRESHOLD;
  const turnDurations = turnMetrics.map((entry) => entry.durationMs);
  const ratingEvents = state.ratingEvents.length;
  const organicRatingsCreated = sum(turnMetrics.map((entry) => entry.organicRatingsCreated));
  const guidedRatingsCreated = sum(turnMetrics.map((entry) => entry.guidedRatingsCreated));
  const routedIslandCount = sum(turnMetrics.map((entry) => entry.routedIslandCount));
  const discoveryProbeVolume = sum(turnMetrics.map((entry) => entry.recommendationKindCounts.DISCOVERY_PROBE));
  const safeFitVolume = sum(turnMetrics.map((entry) => entry.recommendationKindCounts.SAFE_FIT));
  const signalStartMean = turnMetrics[0]?.meanOverallSignal ?? 0;
  const signalEndMean = turnMetrics.at(-1)?.meanOverallSignal ?? 0;
  const affinityEvidenceStartMean = turnMetrics[0]?.meanAffinityEvidence ?? 0;
  const affinityEvidenceEndMean = turnMetrics.at(-1)?.meanAffinityEvidence ?? 0;
  const underReviewedCoverage = safeRatio(
    turnMetrics.at(-1)?.underReviewedIslandCount ?? 0,
    state.islands.length
  );
  const timeToUsefulSignalTurn =
    turnMetrics.find((entry) => entry.meanOverallSignal >= usefulSignalThreshold)?.turn ?? null;

  return {
    totalDurationMs: sum(turnDurations),
    meanTurnDurationMs: mean(turnDurations),
    medianTurnDurationMs: median(turnDurations),
    ratingEvents,
    organicRatingsCreated,
    guidedRatingsCreated,
    routedIslandCount,
    discoveryProbeVolume,
    safeFitVolume,
    signalStartMean,
    signalEndMean,
    signalGrowth: signalEndMean - signalStartMean,
    affinityEvidenceStartMean,
    affinityEvidenceEndMean,
    affinityEvidenceGrowth: affinityEvidenceEndMean - affinityEvidenceStartMean,
    evidenceEfficiency: safeRatio(affinityEvidenceEndMean - affinityEvidenceStartMean, Math.max(1, ratingEvents)),
    underReviewedCoverage,
    timeToUsefulSignalTurn,
    usefulSignalThreshold,
    msPerTurn: safeRatio(sum(turnDurations), Math.max(1, turnMetrics.length - 1)),
    msPerPopulationUnit: safeRatio(sum(turnDurations), Math.max(1, state.users.length * state.islands.length))
  };
}

export function buildPolicyAggregateMetrics(
  policyCase: ExperimentPolicyCase,
  runs: readonly ExperimentRunMetrics[],
  userCount: number,
  islandCount: number,
  bootstrapRatingsPerUser: number,
  reporterOptions: ExperimentReporterOptions = {}
): ExperimentPolicyAggregateMetrics {
  const usefulSignalThreshold = reporterOptions.usefulSignalThreshold ?? DEFAULT_USEFUL_SIGNAL_THRESHOLD;
  const totalDurationMs = sum(runs.map((run) => run.aggregate.totalDurationMs));
  const aggregateSeedList = runs.map((run) => run.seed);

  return {
    policyCase,
    runCount: runs.length,
    seedList: aggregateSeedList,
    turnCount: runs[0]?.turnCount ?? 0,
    userCount,
    islandCount,
    bootstrapRatingsPerUser,
    usefulSignalThreshold,
    totalDurationMs,
    meanRunDurationMs: mean(runs.map((run) => run.aggregate.totalDurationMs)),
    medianRunDurationMs: median(runs.map((run) => run.aggregate.totalDurationMs)),
    ratingEvents: mean(runs.map((run) => run.aggregate.ratingEvents)),
    organicRatingsCreated: mean(runs.map((run) => run.aggregate.organicRatingsCreated)),
    guidedRatingsCreated: mean(runs.map((run) => run.aggregate.guidedRatingsCreated)),
    routedIslandCount: mean(runs.map((run) => run.aggregate.routedIslandCount)),
    discoveryProbeVolume: mean(runs.map((run) => run.aggregate.discoveryProbeVolume)),
    safeFitVolume: mean(runs.map((run) => run.aggregate.safeFitVolume)),
    signalStartMean: mean(runs.map((run) => run.aggregate.signalStartMean)),
    signalEndMean: mean(runs.map((run) => run.aggregate.signalEndMean)),
    signalGrowth: mean(runs.map((run) => run.aggregate.signalGrowth)),
    affinityEvidenceStartMean: mean(runs.map((run) => run.aggregate.affinityEvidenceStartMean)),
    affinityEvidenceEndMean: mean(runs.map((run) => run.aggregate.affinityEvidenceEndMean)),
    affinityEvidenceGrowth: mean(runs.map((run) => run.aggregate.affinityEvidenceGrowth)),
    evidenceEfficiency: mean(runs.map((run) => run.aggregate.evidenceEfficiency)),
    underReviewedCoverage: mean(runs.map((run) => run.aggregate.underReviewedCoverage)),
    timeToUsefulSignalTurn:
      runs.every((run) => run.aggregate.timeToUsefulSignalTurn !== null)
        ? mean(runs.map((run) => run.aggregate.timeToUsefulSignalTurn ?? 0))
        : null,
    msPerTurn: mean(runs.map((run) => run.aggregate.msPerTurn)),
    msPerPopulationUnit: mean(runs.map((run) => run.aggregate.msPerPopulationUnit))
  };
}

function compareNumericValues(left: number, right: number): number {
  return Number((left - right).toFixed(6));
}

function compareNullableNumbers(left: number | null, right: number | null): number | null {
  if (left === null || right === null) {
    return null;
  }

  return Number((left - right).toFixed(6));
}

export function buildPolicyComparison(
  organic: ExperimentPolicyAggregateMetrics,
  guided: ExperimentPolicyAggregateMetrics,
  mixed: ExperimentPolicyAggregateMetrics
): ExperimentPolicyComparison {
  return {
    baselinePolicySlug: organic.policyCase.slug,
    guidedMinusOrganic: {
      signalGrowth: compareNumericValues(guided.signalGrowth, organic.signalGrowth),
      affinityEvidenceGrowth: compareNumericValues(guided.affinityEvidenceGrowth, organic.affinityEvidenceGrowth),
      evidenceEfficiency: compareNumericValues(guided.evidenceEfficiency, organic.evidenceEfficiency),
      timeToUsefulSignalTurn: compareNullableNumbers(guided.timeToUsefulSignalTurn, organic.timeToUsefulSignalTurn),
      discoveryProbeVolume: compareNumericValues(guided.discoveryProbeVolume, organic.discoveryProbeVolume),
      safeFitVolume: compareNumericValues(guided.safeFitVolume, organic.safeFitVolume),
      underReviewedCoverage: compareNumericValues(guided.underReviewedCoverage, organic.underReviewedCoverage)
    },
    mixedMinusOrganic: {
      signalGrowth: compareNumericValues(mixed.signalGrowth, organic.signalGrowth),
      affinityEvidenceGrowth: compareNumericValues(mixed.affinityEvidenceGrowth, organic.affinityEvidenceGrowth),
      evidenceEfficiency: compareNumericValues(mixed.evidenceEfficiency, organic.evidenceEfficiency),
      timeToUsefulSignalTurn: compareNullableNumbers(mixed.timeToUsefulSignalTurn, organic.timeToUsefulSignalTurn),
      discoveryProbeVolume: compareNumericValues(mixed.discoveryProbeVolume, organic.discoveryProbeVolume),
      safeFitVolume: compareNumericValues(mixed.safeFitVolume, organic.safeFitVolume),
      underReviewedCoverage: compareNumericValues(mixed.underReviewedCoverage, organic.underReviewedCoverage)
    }
  };
}
