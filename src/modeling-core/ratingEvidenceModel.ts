import type { PlayerPreferenceModel, PlayerSignalModel, RatingEvent, RatingEvidence, TagId } from './types.js';
import { clamp, confidenceFromRD, round, volatilityPenalty } from './math.js';
import { blendedSignalStrengthModel, type SignalStrengthModel } from './signalStrengthModel.js';

export interface RatingEvidenceModel {
  constructRatingEvidence(player: PlayerPreferenceModel, event: RatingEvent): RatingEvidence;
}

function allSignalTags(signalModel: PlayerSignalModel): TagId[] {
  return Array.from(new Set([
    ...Object.keys(signalModel.laneSignalByTag),
    ...Object.keys(signalModel.signalUsefulnessByTag),
    ...Object.keys(signalModel.signalAlignmentByTag),
    ...Object.keys(signalModel.signalRDByTag),
    ...Object.keys(signalModel.signalVolatilityByTag)
  ])).sort();
}

function laneMetric(
  signalModel: PlayerSignalModel,
  tag: TagId,
  field: 'usefulness' | 'alignment' | 'rd' | 'volatility'
): number {
  switch (field) {
    case 'usefulness':
      return signalModel.signalUsefulnessByTag[tag]
        ?? signalModel.laneSignalByTag[tag]
        ?? signalModel.trustEstimate;
    case 'alignment':
      return signalModel.signalAlignmentByTag[tag] ?? 0;
    case 'rd':
      return signalModel.signalRDByTag[tag] ?? signalModel.trustRD;
    case 'volatility':
      return signalModel.signalVolatilityByTag[tag] ?? signalModel.signalVolatility;
  }
}

function weightedLaneAverage(
  player: PlayerPreferenceModel,
  field: 'usefulness' | 'alignment' | 'rd' | 'volatility'
): number {
  const tags = allSignalTags(player.signalModel);
  if (tags.length === 0) {
    return field === 'rd' ? player.signalModel.trustRD : field === 'volatility' ? player.signalModel.signalVolatility : player.signalModel.trustEstimate;
  }

  const weights = tags.map((tag) => Math.max(0.05, Math.abs(player.demonstratedAffinityByTag[tag] ?? 0)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  return tags.reduce((sum, tag, index) => sum + laneMetric(player.signalModel, tag, field) * weights[index], 0) / totalWeight;
}

export function createExpectationFulfillmentEvidenceModel(signalStrengthModel: SignalStrengthModel = blendedSignalStrengthModel): RatingEvidenceModel {
  return {
  constructRatingEvidence(player, event) {
    const focusTag = event.focusTag ?? null;
    const laneSignalUsefulness = focusTag
      ? laneMetric(player.signalModel, focusTag, 'usefulness')
      : weightedLaneAverage(player, 'usefulness');
    const laneSignalPolarity = focusTag
      ? laneMetric(player.signalModel, focusTag, 'alignment')
      : weightedLaneAverage(player, 'alignment');
    const laneSignalRD = focusTag
      ? laneMetric(player.signalModel, focusTag, 'rd')
      : weightedLaneAverage(player, 'rd');
    const laneSignalVolatility = focusTag
      ? laneMetric(player.signalModel, focusTag, 'volatility')
      : weightedLaneAverage(player, 'volatility');

    const laneSignalConfidence = confidenceFromRD(laneSignalRD);
    const laneSignalStability = volatilityPenalty(laneSignalVolatility);
    const lanePolarityClarity = clamp(0.65 + 0.35 * Math.abs(laneSignalPolarity), 0.65, 1);
    const aggregateTrustConfidence = confidenceFromRD(player.signalModel.trustRD);
    const aggregateTrustStability = volatilityPenalty(player.signalModel.signalVolatility);
    const signalCalculation = signalStrengthModel.calculateSignalStrength({
      trustEstimate: player.signalModel.trustEstimate,
      aggregateTrustConfidence,
      aggregateTrustStability,
      sourceAuthority: player.signalModel.sourceAuthority,
      laneSignalUsefulness,
      laneSignalConfidence,
      laneSignalStability,
      lanePolarityClarity,
      source: event.source
    });
    const diagnosticContextWeight = event.source === 'guided' ? 1.08 : 1;
    const signalStrength = event.rating === 0 ? 0 : signalCalculation.signalStrength;

    return {
      assignedRating: event.rating,
      trainingEligible: event.rating !== 0,
      focusTag,
      focusMeaning: event.focusMeaning ?? null,
      signalStrength: round(signalStrength),
      raterSignalEstimate: round(player.signalModel.trustEstimate),
      trustEstimate: round(player.signalModel.trustEstimate),
      trustRD: round(player.signalModel.trustRD),
      signalVolatility: round(player.signalModel.signalVolatility),
      sourceAuthority: round(player.signalModel.sourceAuthority),
      laneAlignment: round(Math.abs(laneSignalPolarity)),
      diagnosticContextWeight: round(diagnosticContextWeight),
      laneSignalUsefulness: round(laneSignalUsefulness),
      laneSignalPolarity: round(laneSignalPolarity),
      laneSignalRD: round(laneSignalRD),
      laneSignalVolatility: round(laneSignalVolatility),
      laneSignalConfidence: round(laneSignalConfidence),
      laneSignalStability: round(laneSignalStability),
      lanePolarityClarity: round(lanePolarityClarity),
      aggregateTrustConfidence: round(aggregateTrustConfidence),
      aggregateTrustStability: round(aggregateTrustStability),
      signalBaseStrength: signalCalculation.baseSignal,
      signalConfidenceMultiplier: signalCalculation.confidence,
      signalStabilityMultiplier: signalCalculation.stability,
      signalPolarityClarityMultiplier: signalCalculation.polarityClarityMultiplier,
      signalContextMultiplier: signalCalculation.contextMultiplier
    };
  }
  };
}

export const expectationFulfillmentEvidenceModel = createExpectationFulfillmentEvidenceModel();
