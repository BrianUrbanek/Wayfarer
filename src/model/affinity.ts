import type { CohortAnchor, CohortId, Island, IslandId, Rating, UserId } from './types.js';
import type { RaterSignalProfile } from './raterSignal.js';

export interface AffinityContribution {
  userId: UserId;
  rating: Rating;
  raterSignal: number;
  weightedContribution: number;
}

export interface CohortAffinityEstimate {
  islandId: IslandId;
  cohortId: CohortId;
  observedMean: number;
  affinity: number;
  confidence: number;
  disagreement: number;
  rawCount: number;
  effectiveWeight: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  contributions: AffinityContribution[];
}

export interface IslandAffinityReport {
  islandId: IslandId;
  estimates: CohortAffinityEstimate[];
  topPositive: CohortAffinityEstimate | null;
  topNegative: CohortAffinityEstimate | null;
}

export interface IslandAffinityAnalysis {
  allReports: IslandAffinityReport[];
  byIslandId: ReadonlyMap<IslandId, IslandAffinityReport>;
}

export interface AffinityRatingEvent {
  userId: UserId;
  islandId: IslandId;
  rating: Rating;
}

export interface BuildAffinityOptions {
  priorWeight?: number;
  confidenceK?: number;
}

const DEFAULT_OPTIONS: Required<BuildAffinityOptions> = {
  priorWeight: 4,
  confidenceK: 4
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function sampleConfidence(effectiveWeight: number, k: number): number {
  if (effectiveWeight <= 0) {
    return 0;
  }

  return effectiveWeight / (effectiveWeight + Math.max(0, k));
}

function shrinkMean(observedMean: number, effectiveWeight: number, priorWeight: number): number {
  if (effectiveWeight <= 0) {
    return 0;
  }

  return (effectiveWeight * observedMean) / (priorWeight + effectiveWeight);
}

interface Accumulator {
  weightedSum: number;
  effectiveWeight: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  contributions: AffinityContribution[];
}

interface IslandCounts {
  rawCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
}

function createAccumulator(): Accumulator {
  return {
    weightedSum: 0,
    effectiveWeight: 0,
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0,
    contributions: []
  };
}

function createIslandCounts(): IslandCounts {
  return {
    rawCount: 0,
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0
  };
}

function compareEstimateByAffinity(left: CohortAffinityEstimate, right: CohortAffinityEstimate): number {
  if (right.affinity !== left.affinity) {
    return right.affinity - left.affinity;
  }

  if (right.effectiveWeight !== left.effectiveWeight) {
    return right.effectiveWeight - left.effectiveWeight;
  }

  return left.cohortId.localeCompare(right.cohortId);
}

function buildEmptyEstimate(islandId: IslandId, cohortId: CohortId): CohortAffinityEstimate {
  return {
    islandId,
    cohortId,
    observedMean: 0,
    affinity: 0,
    confidence: 0,
    disagreement: 0,
    rawCount: 0,
    effectiveWeight: 0,
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0,
    contributions: []
  };
}

export function buildIslandAffinityReports(
  ratingEvents: readonly AffinityRatingEvent[],
  signalProfiles: ReadonlyMap<UserId, RaterSignalProfile>,
  cohorts: readonly CohortAnchor[],
  islands: readonly Island[],
  options: BuildAffinityOptions = {}
): IslandAffinityAnalysis {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const countsByIslandId = new Map<IslandId, IslandCounts>();
  const accumulatorsByIslandId = new Map<IslandId, Map<CohortId, Accumulator>>();

  for (const island of islands) {
    countsByIslandId.set(island.id, createIslandCounts());
    accumulatorsByIslandId.set(
      island.id,
      new Map(cohorts.map((cohort) => [cohort.id, createAccumulator()]))
    );
  }

  for (const event of ratingEvents) {
    const islandCounts = countsByIslandId.get(event.islandId);
    const cohortAccumulators = accumulatorsByIslandId.get(event.islandId);

    if (!islandCounts || !cohortAccumulators) {
      continue;
    }

    islandCounts.rawCount += 1;
    if (event.rating === 1) {
      islandCounts.positiveCount += 1;
    } else if (event.rating === -1) {
      islandCounts.negativeCount += 1;
    } else {
      islandCounts.neutralCount += 1;
    }

    const profile = signalProfiles.get(event.userId);

    for (const cohort of cohorts) {
      const accumulator = cohortAccumulators.get(cohort.id);
      if (!accumulator) {
        continue;
      }

      const raterSignal = profile?.cohortWeights[cohort.id] ?? 0;
      if (raterSignal <= 0) {
        continue;
      }

      accumulator.weightedSum += event.rating * raterSignal;
      accumulator.effectiveWeight += raterSignal;
      accumulator.contributions.push({
        userId: event.userId,
        rating: event.rating,
        raterSignal,
        weightedContribution: event.rating * raterSignal
      });

      if (event.rating === 1) {
        accumulator.positiveCount += 1;
      } else if (event.rating === -1) {
        accumulator.negativeCount += 1;
      } else {
        accumulator.neutralCount += 1;
      }
    }
  }

  const allReports = islands.map<IslandAffinityReport>((island) => {
    const islandCounts = countsByIslandId.get(island.id) ?? createIslandCounts();
    const cohortAccumulators = accumulatorsByIslandId.get(island.id) ?? new Map();
    const estimates = cohorts.map<CohortAffinityEstimate>((cohort) => {
      const accumulator = cohortAccumulators.get(cohort.id);
      const estimate = buildEmptyEstimate(island.id, cohort.id);

      if (!accumulator) {
        return {
          ...estimate,
          rawCount: islandCounts.rawCount,
          positiveCount: islandCounts.positiveCount,
          neutralCount: islandCounts.neutralCount,
          negativeCount: islandCounts.negativeCount
        };
      }

      const observedMean = accumulator.effectiveWeight > 0 ? accumulator.weightedSum / accumulator.effectiveWeight : 0;
      const affinity = shrinkMean(observedMean, accumulator.effectiveWeight, mergedOptions.priorWeight);
      const confidence = sampleConfidence(accumulator.effectiveWeight, mergedOptions.confidenceK);
      const deviation = accumulator.contributions.reduce((sum: number, contribution: AffinityContribution) => {
        return (
          sum +
          Math.abs(contribution.weightedContribution / Math.max(contribution.raterSignal, 1e-9) - observedMean) *
            contribution.raterSignal
        );
      }, 0);
      const disagreement = accumulator.effectiveWeight > 0 ? clamp01((deviation / accumulator.effectiveWeight) / 2) : 0;

      return {
        ...estimate,
        observedMean,
        affinity,
        confidence,
        disagreement,
        rawCount: islandCounts.rawCount,
        effectiveWeight: accumulator.effectiveWeight,
        positiveCount: islandCounts.positiveCount,
        neutralCount: islandCounts.neutralCount,
        negativeCount: islandCounts.negativeCount,
        contributions: accumulator.contributions
          .slice()
          .sort((left: AffinityContribution, right: AffinityContribution) => Math.abs(right.weightedContribution) - Math.abs(left.weightedContribution))
      };
    });

    const rankedEstimates = estimates.slice().sort(compareEstimateByAffinity);
    const topPositive = rankedEstimates.find((estimate) => estimate.affinity > 0) ?? null;
    const topNegative =
      rankedEstimates
        .slice()
        .reverse()
        .find((estimate) => estimate.affinity < 0) ?? null;

    return {
      islandId: island.id,
      estimates,
      topPositive,
      topNegative
    };
  });

  return {
    allReports,
    byIslandId: new Map(allReports.map((report) => [report.islandId, report]))
  };
}
