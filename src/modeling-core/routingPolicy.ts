import type {
  IslandTasteModel,
  ModelingPrediction,
  PlayerPreferenceModel,
  RecommendationFacingEntry,
  RecommendationKind,
  RoutingDecisionTrace,
  RoutingReasonFactor,
  RoutingReasonKind,
  TagId
} from './types.js';
import type { PredictionModel } from './predictionModel.js';
import { clamp, round, volatilityPenalty } from './math.js';

export interface RoutingScores {
  safeFitScore: number;
  smartGambleScore: number;
  discoveryProbeScore: number;
  suppressOrAvoidScore: number;
  guidedDiscoveryScore: number;
}

export interface RecommendationPolicy {
  recommendForPlayer(player: PlayerPreferenceModel, islands: readonly IslandTasteModel[], allTags: readonly TagId[]): RecommendationFacingEntry[];
}

function weightedAverage(values: readonly number[], weights: readonly number[]): number {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) {
    return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
}

function calculateAffinityFit(
  affinityByTag: Record<TagId, number>,
  island: IslandTasteModel,
  allTags: readonly TagId[]
): number {
  const weights = allTags.map((tag) => Math.max(0.05, Math.abs(island.audienceFitByTag[tag] ?? 0)));
  const contributions = allTags.map((tag) => (affinityByTag[tag] ?? 0) * (island.audienceFitByTag[tag] ?? 0));
  return round(clamp(weightedAverage(contributions, weights) * 2.25));
}

function normalizePositiveFit(predictedFit: number): number {
  return clamp(predictedFit, 0, 1);
}

function normalizeNegativeFit(predictedFit: number): number {
  return clamp(-predictedFit, 0, 1);
}

function calculateExplorationValue(prediction: ModelingPrediction): number {
  const uncertainty = 1 - prediction.confidence;
  const notConfidentlyBad = clamp(1 - normalizeNegativeFit(prediction.predictedRating) * 0.75, 0, 1);
  return round(clamp(uncertainty * (0.35 + prediction.scoutValue * 0.65) * notConfidentlyBad, 0, 1));
}

function calculateRoutingScores(input: {
  predictedFit: number;
  combinedConfidence: number;
  volatilityMultiplier: number;
  scoutValue: number;
  explorationValue: number;
  declaredDemonstratedGap: number;
}): RoutingScores {
  const positiveFit = normalizePositiveFit(input.predictedFit);
  const negativeFit = normalizeNegativeFit(input.predictedFit);
  const confidence = clamp(input.combinedConfidence, 0, 1);
  const volatility = clamp(input.volatilityMultiplier, 0, 1);
  const scout = clamp(input.scoutValue, 0, 1);
  const exploration = clamp(input.explorationValue, 0, 1);
  const mismatch = clamp(input.declaredDemonstratedGap, 0, 1);

  return {
    safeFitScore: round(positiveFit * confidence * volatility * volatility * (1 - mismatch * 0.35)),
    smartGambleScore: round(positiveFit * (1 - confidence * 0.55) * (0.55 + scout * 0.45) * volatility),
    discoveryProbeScore: round(exploration * (0.55 + scout * 0.45)),
    suppressOrAvoidScore: round(negativeFit * confidence * volatility),
    guidedDiscoveryScore: round(mismatch * (0.35 + scout * 0.45 + exploration * 0.2))
  };
}

function scoresToFactors(scores: RoutingScores): RoutingReasonFactor[] {
  const entries: Array<{ reason: RoutingReasonKind; rawMagnitude: number; explanation: string }> = [
    {
      reason: 'safeFit' as const,
      rawMagnitude: scores.safeFitScore,
      explanation: 'High predicted fit, confidence, and stability make this a low-risk recommendation.'
    },
    {
      reason: 'smartGamble' as const,
      rawMagnitude: scores.smartGambleScore,
      explanation: 'Predicted fit is positive, but uncertainty keeps this out of the safest band.'
    },
    {
      reason: 'discoveryProbe' as const,
      rawMagnitude: scores.discoveryProbeScore,
      explanation: 'This candidate is information-rich for learning even if the fit is not yet proven.'
    },
    {
      reason: 'suppressOrAvoid' as const,
      rawMagnitude: scores.suppressOrAvoidScore,
      explanation: 'The model predicts a negative fit with enough confidence to avoid casual routing.'
    },
    {
      reason: 'guidedDiscovery' as const,
      rawMagnitude: scores.guidedDiscoveryScore,
      explanation: 'Declared preference and demonstrated affinity disagree enough to justify guided probing.'
    }
  ].filter((entry) => entry.rawMagnitude > 0);

  const total = entries.reduce((sum, entry) => sum + entry.rawMagnitude, 0);
  return entries
    .map((entry) => ({
      ...entry,
      rawMagnitude: round(entry.rawMagnitude),
      normalizedMagnitude: total > 0 ? round(entry.rawMagnitude / total) : 0
    }))
    .sort((left, right) => right.normalizedMagnitude - left.normalizedMagnitude);
}

function chooseKind(factors: readonly RoutingReasonFactor[]): RecommendationKind {
  const dominant = factors[0]?.reason ?? 'discoveryProbe';
  switch (dominant) {
    case 'safeFit':
      return 'SAFE_FIT';
    case 'smartGamble':
      return 'SMART_GAMBLE';
    case 'suppressOrAvoid':
      return 'SUPPRESS_OR_AVOID';
    case 'guidedDiscovery':
      return 'GUIDED_DISCOVERY';
    case 'discoveryProbe':
    default:
      return 'DISCOVERY_PROBE';
  }
}

function explainKind(kind: RecommendationKind): string {
  switch (kind) {
    case 'SAFE_FIT':
      return 'Best current route: safe fit; predicted fit is positive with enough confidence and stability.';
    case 'SMART_GAMBLE':
      return 'Best current route: smart gamble; predicted fit is positive but confidence or stability is not yet strong enough for safe-fit routing.';
    case 'DISCOVERY_PROBE':
      return 'Best current route: discovery probe; the candidate is useful for learning or resolving uncertainty.';
    case 'SUPPRESS_OR_AVOID':
      return 'Best current route: suppress or avoid; the model predicts a negative fit with enough confidence.';
    case 'GUIDED_DISCOVERY':
      return 'Best current route: guided discovery; declared preference and demonstrated affinity appear misaligned.';
  }
}

function calculateRoutingScore(kind: RecommendationKind, scores: RoutingScores): number {
  switch (kind) {
    case 'SAFE_FIT':
      return round(scores.safeFitScore + scores.smartGambleScore * 0.35 + scores.discoveryProbeScore * 0.15 - scores.suppressOrAvoidScore);
    case 'SMART_GAMBLE':
      return round(scores.smartGambleScore + scores.safeFitScore * 0.4 + scores.discoveryProbeScore * 0.25 - scores.suppressOrAvoidScore * 0.7);
    case 'DISCOVERY_PROBE':
      return round(scores.discoveryProbeScore + scores.smartGambleScore * 0.25 - scores.suppressOrAvoidScore * 0.4);
    case 'GUIDED_DISCOVERY':
      return round(scores.guidedDiscoveryScore + scores.discoveryProbeScore * 0.25 - scores.suppressOrAvoidScore * 0.2);
    case 'SUPPRESS_OR_AVOID':
      return round(-scores.suppressOrAvoidScore);
  }
}

export function calculateRoutingDecision(
  player: PlayerPreferenceModel,
  island: IslandTasteModel,
  prediction: ModelingPrediction,
  allTags: readonly TagId[]
): { kind: RecommendationKind; routingScore: number; routingTrace: RoutingDecisionTrace } {
  const volatilityMultiplier = round(volatilityPenalty(prediction.averageIslandVolatility));
  const declaredFit = calculateAffinityFit(player.declaredAffinityByTag, island, allTags);
  const demonstratedFit = calculateAffinityFit(player.demonstratedAffinityByTag, island, allTags);
  const declaredDemonstratedGap = round(Math.abs(declaredFit - demonstratedFit));
  const explorationValue = calculateExplorationValue(prediction);
  const scores = calculateRoutingScores({
    predictedFit: prediction.predictedRating,
    combinedConfidence: prediction.confidence,
    volatilityMultiplier,
    scoutValue: prediction.scoutValue,
    explorationValue,
    declaredDemonstratedGap
  });
  const factors = scoresToFactors(scores);
  const kind = chooseKind(factors);
  const routingScore = calculateRoutingScore(kind, scores);

  return {
    kind,
    routingScore,
    routingTrace: {
      predictedFit: prediction.predictedRating,
      positiveFit: round(normalizePositiveFit(prediction.predictedRating)),
      negativeFit: round(normalizeNegativeFit(prediction.predictedRating)),
      playerPreferenceConfidence: prediction.playerPreferenceConfidence,
      islandAudienceConfidence: prediction.islandConfidence,
      combinedConfidence: prediction.confidence,
      volatilityMultiplier,
      scoutValue: prediction.scoutValue,
      explorationValue,
      declaredFit,
      demonstratedFit,
      declaredDemonstratedGap,
      safeFitScore: scores.safeFitScore,
      smartGambleScore: scores.smartGambleScore,
      discoveryProbeScore: scores.discoveryProbeScore,
      suppressOrAvoidScore: scores.suppressOrAvoidScore,
      guidedDiscoveryScore: scores.guidedDiscoveryScore,
      primaryReason: factors[0]?.reason ?? 'discoveryProbe',
      explanation: explainKind(kind),
      factors
    }
  };
}

export function createRiskBandRecommendationPolicy(predictionModel: PredictionModel): RecommendationPolicy {
  return {
    recommendForPlayer(player, islands, allTags) {
      return islands
        .map((island) => {
          const prediction = predictionModel.predictPlayerIslandFit(player, island, allTags);
          const decision = calculateRoutingDecision(player, island, prediction, allTags);
          return { ...prediction, ...decision };
        })
        .sort((left, right) => right.routingScore - left.routingScore);
    }
  };
}
