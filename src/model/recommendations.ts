import type { CohortId, Island, IslandId, User, UserId } from './types.js';
import type { CohortAffinityEstimate, IslandAffinityReport } from './affinity.js';
import type { RaterSignalProfile } from './raterSignal.js';

export type RecommendationKind = 'SAFE_FIT' | 'SMART_GAMBLE' | 'DISCOVERY_PROBE';

export type RecommendationAuditReason =
  | 'alreadyRated'
  | 'noSignalProfile'
  | 'noActiveCohortEstimates'
  | 'highConfidenceBadFit'
  | 'eligibleSafeFit'
  | 'eligibleSmartGamble'
  | 'eligibleDiscoveryProbe';

export type RecommendationAuditCounters = Record<RecommendationAuditReason, number>;

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
  highConfidenceBadFitThreshold?: number;
  badFitConfidenceThreshold?: number;
  safeFitPredictedFitThreshold?: number;
  safeFitSupportThreshold?: number;
  safeFitConfidenceThreshold?: number;
  discoveryProbeSupportThreshold?: number;
  underReviewedK?: number;
  topLimit?: number;
}

export interface UserRecommendationAnalysis {
  userId: UserId;
  recommendations: IslandRecommendation[];
  audit: RecommendationAuditCounters;
}

const DEFAULT_OPTIONS: Required<RecommendationOptions> = {
  explorationWeight: 0.55,
  highConfidenceBadFitThreshold: -0.35,
  badFitConfidenceThreshold: 0.65,
  safeFitPredictedFitThreshold: 0.55,
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
    recommendationKind === 'SAFE_FIT'
      ? 'safe recommendation'
      : recommendationKind === 'SMART_GAMBLE'
        ? 'smart gamble'
        : 'good probe candidate';

  return `${explorationText}: ${fitText}, ${supportText}, discovery=${discoveryValue.toFixed(2)}`;
}

function buildRecommendationAuditCounters(): RecommendationAuditCounters {
  return {
    alreadyRated: 0,
    noSignalProfile: 0,
    noActiveCohortEstimates: 0,
    highConfidenceBadFit: 0,
    eligibleSafeFit: 0,
    eligibleSmartGamble: 0,
    eligibleDiscoveryProbe: 0
  };
}

function auditReasonForRecommendationKind(kind: RecommendationKind): RecommendationAuditReason {
  if (kind === 'SAFE_FIT') {
    return 'eligibleSafeFit';
  }

  if (kind === 'SMART_GAMBLE') {
    return 'eligibleSmartGamble';
  }

  return 'eligibleDiscoveryProbe';
}

function classifyRecommendationKind(
  predictedFit: number,
  affinitySupport: number,
  underReviewedScore: number,
  options: Required<RecommendationOptions>
): RecommendationKind {
  if (
    predictedFit >= options.safeFitPredictedFitThreshold &&
    affinitySupport >= options.safeFitSupportThreshold &&
    underReviewedScore < 0.5
  ) {
    return 'SAFE_FIT';
  }

  if (predictedFit >= -0.15 || affinitySupport >= options.discoveryProbeSupportThreshold) {
    return 'SMART_GAMBLE';
  }

  return 'DISCOVERY_PROBE';
}

function recommendationScoreForKind(
  recommendationKind: RecommendationKind,
  predictedFit: number,
  affinitySupport: number,
  uncertainty: number,
  underReviewedScore: number,
  coverageGapValue: number
): number {
  if (recommendationKind === 'SAFE_FIT') {
    return predictedFit * 0.75 + affinitySupport * 0.25;
  }

  if (recommendationKind === 'SMART_GAMBLE') {
    return clamp01((predictedFit + 1) / 2) * 0.4 + uncertainty * 0.35 + underReviewedScore * 0.25;
  }

  return uncertainty * 0.45 + underReviewedScore * 0.35 + coverageGapValue * 0.2;
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
  const affinitySupport = clamp01(weightedAverage(supportWeights));
  if (
    predictedFit <= mergedOptions.highConfidenceBadFitThreshold &&
    affinitySupport >= mergedOptions.badFitConfidenceThreshold
  ) {
    return null;
  }

  const weightedEvidence = weightedAverage(evidenceWeights);
  const underReviewedScore = 1 - clamp01(weightedEvidence / (weightedEvidence + mergedOptions.underReviewedK));
  const uncertainty = 1 - affinitySupport;
  const coverageGapValue = Math.max(uncertainty, underReviewedScore);
  const discoveryValue = clamp01(uncertainty * 0.45 + underReviewedScore * 0.35 + coverageGapValue * 0.2);
  const recommendationKind = classifyRecommendationKind(predictedFit, affinitySupport, underReviewedScore, mergedOptions);
  const recommendationScore = recommendationScoreForKind(
    recommendationKind,
    predictedFit,
    affinitySupport,
    uncertainty,
    underReviewedScore,
    coverageGapValue
  );

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
  const audit = buildRecommendationAuditCounters();
  const signalProfile = signalProfiles.get(user.id);
  const recommendations: IslandRecommendation[] = [];

  for (const island of islands) {
    if ((user.ratings[island.id] ?? null) !== null) {
      audit.alreadyRated += 1;
      continue;
    }

    if (!signalProfile) {
      audit.noSignalProfile += 1;
      continue;
    }

    const affinityReport = affinityReports.get(island.id);
    if (eligibleAffinityEstimates(affinityReport, signalProfile).length === 0) {
      audit.noActiveCohortEstimates += 1;
      continue;
    }

    const recommendation = scoreIslandRecommendation(user, island, affinityReport, signalProfile, options);
    if (!recommendation) {
      audit.highConfidenceBadFit += 1;
      continue;
    }

    audit[auditReasonForRecommendationKind(recommendation.recommendationKind)] += 1;
    recommendations.push(recommendation);
  }

  const sortedRecommendations = recommendations
    .sort((left, right) => right.recommendationScore - left.recommendationScore || left.islandId.localeCompare(right.islandId));

  return {
    userId: user.id,
    recommendations: sortedRecommendations.slice(0, options.topLimit ?? DEFAULT_OPTIONS.topLimit),
    audit
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
