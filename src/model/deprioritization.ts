import type { CohortId, Island, IslandId, Rating, User, UserId } from './types.js';
import type { IslandAffinityReport } from './affinity.js';
import type { RaterSignalProfile } from './raterSignal.js';

export interface DeprioritizationRow {
  userId: UserId;
  islandId: IslandId;
  predictedFit: number;
  confidenceSupport: number;
  effectiveWeight: number;
  topNegativeCohortId: CohortId | null;
  topNegativeAffinity: number;
  topNegativeConfidence: number;
  deprioritizationScore: number;
  explanation: string;
}

export interface DeprioritizationAnalysis {
  userId: UserId;
  rows: DeprioritizationRow[];
}

export interface DeprioritizationOptions {
  minConfidenceSupport?: number;
  supportK?: number;
  topLimit?: number;
}

const DEFAULT_OPTIONS: Required<DeprioritizationOptions> = {
  minConfidenceSupport: 0.55,
  supportK: 6,
  topLimit: 12
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, value));
}

function weightedAverage(values: Array<{ weight: number; value: number }>): number {
  const totalWeight = values.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (totalWeight <= 0) {
    return 0;
  }

  return values.reduce((sum, entry) => sum + Math.max(0, entry.weight) * entry.value, 0) / totalWeight;
}

function supportStrength(effectiveWeight: number, k: number): number {
  if (effectiveWeight <= 0) {
    return 0;
  }

  return clamp01(effectiveWeight / (effectiveWeight + Math.max(0, k)));
}

function isRated(rating: Rating | null | undefined): boolean {
  return rating !== null && rating !== undefined;
}

function buildExplanation(topNegativeCohortId: CohortId | null, predictedFit: number, confidenceSupport: number): string {
  if (!topNegativeCohortId) {
    return 'Negative fit is too weak to justify deprioritization yet.';
  }

  return `Deprioritize for this user: strongest negative cohort read is ${topNegativeCohortId}, predicted fit ${predictedFit.toFixed(2)}, confidence ${confidenceSupport.toFixed(2)}.`;
}

export function buildUserDeprioritizationAnalysis(
  user: User,
  affinityReports: ReadonlyMap<IslandId, IslandAffinityReport>,
  signalProfile: RaterSignalProfile | undefined,
  islands: readonly Island[],
  options: DeprioritizationOptions = {}
): DeprioritizationAnalysis {
  if (!signalProfile) {
    return { userId: user.id, rows: [] };
  }

  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const candidateRows = islands
    .map<DeprioritizationRow | null>((island) => {
      if (isRated(user.ratings[island.id])) {
        return null;
      }

      const affinityReport = affinityReports.get(island.id);
      if (!affinityReport) {
        return null;
      }

      const activeEstimates = affinityReport.estimates.filter((estimate) => (signalProfile.cohortWeights[estimate.cohortId] ?? 0) > 0);
      if (activeEstimates.length === 0) {
        return null;
      }

      const cohortWeights = activeEstimates.map((estimate) => ({
        weight: signalProfile.cohortWeights[estimate.cohortId] ?? 0,
        value: estimate.affinity
      }));
      const confidenceWeights = activeEstimates.map((estimate) => ({
        weight: signalProfile.cohortWeights[estimate.cohortId] ?? 0,
        value: estimate.confidence
      }));
      const evidenceWeights = activeEstimates.map((estimate) => ({
        weight: signalProfile.cohortWeights[estimate.cohortId] ?? 0,
        value: estimate.effectiveWeight
      }));

      const predictedFit = clampSigned(weightedAverage(cohortWeights));
      const confidenceSupport = clamp01(weightedAverage(confidenceWeights));
      const effectiveWeight = weightedAverage(evidenceWeights);
      const deprioritizationSupport = supportStrength(effectiveWeight, mergedOptions.supportK);
      const topNegative = activeEstimates.slice().sort((left, right) => left.affinity - right.affinity)[0] ?? null;
      const deprioritizationScore = Math.abs(predictedFit) * confidenceSupport * deprioritizationSupport;

      if (predictedFit >= 0 || confidenceSupport < mergedOptions.minConfidenceSupport || deprioritizationScore <= 0) {
        return null;
      }

      return {
        userId: user.id,
        islandId: island.id,
        predictedFit,
        confidenceSupport,
        effectiveWeight,
        topNegativeCohortId: topNegative?.cohortId ?? null,
        topNegativeAffinity: topNegative?.affinity ?? 0,
        topNegativeConfidence: topNegative?.confidence ?? 0,
        deprioritizationScore,
        explanation: buildExplanation(topNegative?.cohortId ?? null, predictedFit, confidenceSupport)
      };
    });

  const rows = candidateRows
    .filter((row) => row !== null)
    .map((row) => row as DeprioritizationRow)
    .sort((left, right) => {
      if (right.deprioritizationScore !== left.deprioritizationScore) {
        return right.deprioritizationScore - left.deprioritizationScore;
      }
      if (left.predictedFit !== right.predictedFit) {
        return left.predictedFit - right.predictedFit;
      }
      return left.islandId.localeCompare(right.islandId);
    })
    .slice(0, mergedOptions.topLimit);

  return {
    userId: user.id,
    rows
  };
}
