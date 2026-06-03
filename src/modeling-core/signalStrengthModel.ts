import type { RatingEventSource } from './types.js';
import { clamp, lerp, round } from './math.js';

export interface SignalStrengthInputs {
  trustEstimate: number;
  aggregateTrustConfidence: number;
  aggregateTrustStability: number;
  sourceAuthority: number;
  laneSignalUsefulness: number;
  laneSignalConfidence: number;
  laneSignalStability: number;
  lanePolarityClarity: number;
  source: RatingEventSource;
}

export interface SignalStrengthCalculation {
  baseSignal: number;
  confidence: number;
  stability: number;
  polarityClarityMultiplier: number;
  contextMultiplier: number;
  signalStrength: number;
}

export interface SignalStrengthModel {
  calculateBaseSignal(inputs: SignalStrengthInputs): number;
  calculateConfidence(inputs: SignalStrengthInputs): number;
  calculateStability(inputs: SignalStrengthInputs): number;
  calculatePolarityClarityMultiplier(inputs: SignalStrengthInputs): number;
  calculateContextMultiplier(inputs: SignalStrengthInputs): number;
  calculateSignalStrength(inputs: SignalStrengthInputs): SignalStrengthCalculation;
}

const LANE_WEIGHT = 0.65;
const MIN_CONFIDENCE_MULTIPLIER = 0.35;
const MIN_STABILITY_MULTIPLIER = 0.5;
const MIN_POLARITY_CLARITY_MULTIPLIER = 0.6;
const GUIDED_CONTEXT_MULTIPLIER = 1.08;

function blend(aggregateValue: number, laneValue: number, laneWeight: number = LANE_WEIGHT): number {
  return clamp(aggregateValue * (1 - laneWeight) + laneValue * laneWeight, 0, 1);
}

export const blendedSignalStrengthModel: SignalStrengthModel = {
  calculateBaseSignal(inputs) {
    return blend(inputs.trustEstimate, inputs.laneSignalUsefulness);
  },

  calculateConfidence(inputs) {
    const rawConfidence = blend(inputs.aggregateTrustConfidence, inputs.laneSignalConfidence);
    return lerp(MIN_CONFIDENCE_MULTIPLIER, 1, rawConfidence);
  },

  calculateStability(inputs) {
    const rawStability = blend(inputs.aggregateTrustStability, inputs.laneSignalStability);
    return lerp(MIN_STABILITY_MULTIPLIER, 1, rawStability);
  },

  calculatePolarityClarityMultiplier(inputs) {
    return lerp(MIN_POLARITY_CLARITY_MULTIPLIER, 1, inputs.lanePolarityClarity);
  },

  calculateContextMultiplier(inputs) {
    const diagnosticContextWeight = inputs.source === 'guided' ? GUIDED_CONTEXT_MULTIPLIER : 1;
    return inputs.sourceAuthority * diagnosticContextWeight;
  },

  calculateSignalStrength(inputs) {
    const baseSignal = this.calculateBaseSignal(inputs);
    const confidence = this.calculateConfidence(inputs);
    const stability = this.calculateStability(inputs);
    const polarityClarityMultiplier = this.calculatePolarityClarityMultiplier(inputs);
    const contextMultiplier = this.calculateContextMultiplier(inputs);
    const signalStrength = baseSignal * confidence * stability * polarityClarityMultiplier * contextMultiplier;

    return {
      baseSignal: round(baseSignal),
      confidence: round(confidence),
      stability: round(stability),
      polarityClarityMultiplier: round(polarityClarityMultiplier),
      contextMultiplier: round(contextMultiplier),
      signalStrength: round(signalStrength)
    };
  }
};
