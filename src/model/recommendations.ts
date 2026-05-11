import type { CohortId, Island, IslandId, User, UserId } from './types.js';
import type { CohortAffinityEstimate, IslandAffinityReport } from './affinity.js';
import type { RaterSignalProfile } from './raterSignal.js';

export type RecommendationKind = 'SAFE_FIT' | 'DISCOVERY_PROBE';

export interface IslandRecommendation {
  userId: UserId;
  islandId: IslandId;
  predictedFit: number;
  affinitySupport: number;
  discoveryValue: number;
  recommendationScore: number;
  recommendationKind: RecommendationKind;
  explanation: string;
  unrated: boolean;
  topCohorts: Array<{
    cohortId: CohortId;
    affinity: number;
    confidence: number;
    effectiveWeight: number;
  }>;
}

export interface RecommendationOptions {
  explorationWeight?: number;
  minPredictedFitFloor?: number;
  safeFitSupportThreshold?: number;
  safeFitConfidenceThreshold?: number;
  discoveryProbeSupportThreshold?: number;
  underReviewedK?: number;
  topLimit?: number;
}

export interface UserRecommendationAnalysis {
  userId: UserId;
  recommendations: IslandRecommendation[];
}

const DEFAULT_OPTIONS: Required<RecommendationOptions> = {
  explorationWeight: 0.55,
  minPredictedFitFloor: 0.2,
  safeFitSupportThreshold: 0.6,
  safeFitConfidenceThreshold: 0.55,
  discoveryProbeSupportThreshold: 0.35,
  underReviewedK: 6,
  topLimit: 12
};

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function clampSigned(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function weightedAverage(values: Array<{ weight: number; value: number }>): number {
  const totalWeight = values.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);
  if (totalWeight <= 0) {
    return 0;
  }

  return values.reduce((sum, entry) => sum + Math.max(0, entry.weight) * entry.value, 0) / totalWeight;
}

function eligibleAffinityEstimates(
  report: IslandAffinityReport | undefined,
  profile: RaterSignalProfile | undefined
): CohortAffinityEstimate[] {
  if (!report || !profile) {
    return [];
  }

  return report.estimates.filter((estimate) => (profile.cohortWeights[estimate.cohortId] ?? 0) > 0);
}

function buildExplanation(
  predictedFit: number,
  affinitySupport: number,
  discoveryValue: number,
  recommendationKind: RecommendationKind
): string {
  const fitText = predictedFit >= 0 ? 'positive fit' : 'weak or negative fit';
  const supportText = affinitySupport >= 0.5 ? 'established evidence' : 'limited evidence';
  const explorationText =
    recommendationKind === 'DISCOVERY_PROBE'
      ? 'good probe candidate'
      : 'safe recommendation';

  return `${explorationText}: ${fitText}, ${supportText}, discovery=${discoveryValue.toFixed(2)}`;
}

export function scoreIslandRecommendation(
  user: User,
  island: Island,
  affinityReport: IslandAffinityReport | undefined,
  signalProfile: RaterSignalProfile | undefined,
  options: RecommendationOptions = {}
): IslandRecommendation | null {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const userRating = user.ratings[island.id] ?? null;
  const unrated = userRating === null;
  if (!unrated || !affinityReport || !signalProfile) {
    return null;
  }

  const activeCohortEstimates = eligibleAffinityEstimates(affinityReport, signalProfile);
  if (activeCohortEstimates.length === 0) {
    return null;
  }

  const cohortWeights = activeCohortEstimates.map((estimate) => ({
    weight: signalProfile.cohortWeights[estimate.cohortId] ?? 0,
    value: estimate.affinity
  }));
  const supportWeights = activeCohortEstimates.map((estimate) => ({
    weight: signalProfile.cohortWeights[estimate.cohortId] ?? 0,
    value: estimate.confidence
  }));
  const evidenceWeights = activeCohortEstimates.map((estimate) => ({
    weight: signalProfile.cohortWeights[estimate.cohortId] ?? 0,
    value: estimate.effectiveWeight
  }));

  const predictedFit = clampSigned(weightedAverage(cohortWeights));
  if (predictedFit < mergedOptions.minPredictedFitFloor) {
    return null;
  }

  const affinitySupport = clamp01(weightedAverage(supportWeights));
  const weightedEvidence = weightedAverage(evidenceWeights);
  const underReviewedScore = 1 - clamp01(weightedEvidence / (weightedEvidence + mergedOptions.underReviewedK));
  const relevanceToUser = clamp01((predictedFit + 1) / 2);
  const uncertainty = 1 - affinitySupport;
  const discoveryValue = clamp01(uncertainty * underReviewedScore * relevanceToUser);
  const recommendationScore = predictedFit + mergedOptions.explorationWeight * discoveryValue;
  const recommendationKind: RecommendationKind =
    predictedFit >= mergedOptions.minPredictedFitFloor &&
    affinitySupport >= mergedOptions.safeFitSupportThreshold &&
    underReviewedScore < 0.5
      ? 'SAFE_FIT'
      : 'DISCOVERY_PROBE';

  const topCohorts = activeCohortEstimates
    .map((estimate) => ({
      cohortId: estimate.cohortId,
      affinity: estimate.affinity,
      confidence: estimate.confidence,
      effectiveWeight: estimate.effectiveWeight
    }))
    .sort((left, right) => Math.abs(right.affinity) - Math.abs(left.affinity))
    .slice(0, 3);

  return {
    userId: user.id,
    islandId: island.id,
    predictedFit,
    affinitySupport,
    discoveryValue,
    recommendationScore,
    recommendationKind,
    explanation: buildExplanation(predictedFit, affinitySupport, discoveryValue, recommendationKind),
    unrated,
    topCohorts
  };
}

export function recommendIslandsForUser(
  user: User,
  affinityReports: ReadonlyMap<IslandId, IslandAffinityReport>,
  signalProfiles: ReadonlyMap<UserId, RaterSignalProfile>,
  islands: readonly Island[],
  options: RecommendationOptions = {}
): UserRecommendationAnalysis {
  const recommendations = islands
    .map((island) => scoreIslandRecommendation(
      user,
      island,
      affinityReports.get(island.id),
      signalProfiles.get(user.id),
      options
    ))
    .filter((entry): entry is IslandRecommendation => entry !== null)
    .sort((left, right) => right.recommendationScore - left.recommendationScore || left.islandId.localeCompare(right.islandId));

  return {
    userId: user.id,
    recommendations: recommendations.slice(0, options.topLimit ?? DEFAULT_OPTIONS.topLimit)
  };
}

export function recommendRouteTargets(
  users: readonly User[],
  affinityReports: ReadonlyMap<IslandId, IslandAffinityReport>,
  signalProfiles: ReadonlyMap<UserId, RaterSignalProfile>,
  islands: readonly Island[],
  options: RecommendationOptions = {}
): UserRecommendationAnalysis[] {
  return users.map((user) => recommendIslandsForUser(user, affinityReports, signalProfiles, islands, options));
}
