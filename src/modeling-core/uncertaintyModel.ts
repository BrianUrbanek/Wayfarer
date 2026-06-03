import type { RatingEvidence, RdDelta, UpdateAllocation } from './types.js';
import { clamp, confidenceFromRD, round } from './math.js';

const MAX_RATING_ERROR = 2;
const ESTIMATE_DAMPENING_STRENGTH = 1.2;
const MIN_ESTIMATE_UPDATE_MULTIPLIER = 0.25;
const VOLATILITY_LEARNING_RATE = 0.1;
const RD_TIGHTENING_LIMIT = 0.18;
const RD_TIGHTENING_RATE = 0.12;

export interface UncertaintyPressure {
  playerConfidence: number;
  islandConfidence: number;
  normalizedSurprise: number;
  confidenceConflict: number;
  estimateUpdateMultiplier: number;
  volatilityPressure: number;
}

export interface UncertaintyModel {
  evaluateContradictionPressure(
    allocation: UpdateAllocation,
    predictionError: number,
    evidence: RatingEvidence
  ): UncertaintyPressure;
  tightenRD(rd: number, signalStrength: number, share: number, estimateUpdateMultiplier: number): number;
  updateVolatility(volatility: number, pressure: UncertaintyPressure): number;
}

export function buildRdDelta(tag: string, before: number, after: number): RdDelta {
  return { tag, before: round(before), after: round(after) };
}

export const glickoInspiredUncertaintyModel: UncertaintyModel = {
  evaluateContradictionPressure(allocation, predictionError, evidence) {
    const playerConfidence = confidenceFromRD(allocation.playerAverageRD);
    const islandConfidence = confidenceFromRD(allocation.islandAverageRD);
    const normalizedSurprise = clamp(Math.abs(predictionError) / MAX_RATING_ERROR, 0, 1);
    const confidenceConflict = clamp(playerConfidence * islandConfidence * normalizedSurprise, 0, 1);
    const estimateUpdateMultiplier = clamp(
      1 - ESTIMATE_DAMPENING_STRENGTH * confidenceConflict,
      MIN_ESTIMATE_UPDATE_MULTIPLIER,
      1
    );
    const volatilityPressure = clamp(
      VOLATILITY_LEARNING_RATE * evidence.signalStrength * confidenceConflict,
      0,
      1
    );

    return {
      playerConfidence: round(playerConfidence),
      islandConfidence: round(islandConfidence),
      normalizedSurprise: round(normalizedSurprise),
      confidenceConflict: round(confidenceConflict),
      estimateUpdateMultiplier: round(estimateUpdateMultiplier),
      volatilityPressure: round(volatilityPressure)
    };
  },

  tightenRD(rd, signalStrength, share, estimateUpdateMultiplier) {
    const tightening = Math.min(RD_TIGHTENING_LIMIT, signalStrength * estimateUpdateMultiplier * share * RD_TIGHTENING_RATE);
    return clamp(rd * (1 - tightening), 0.05, 1);
  },

  updateVolatility(volatility, pressure) {
    return clamp(volatility + pressure.volatilityPressure, 0, 1);
  }
};
