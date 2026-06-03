export { cloneModelingState, findIsland, findPlayer } from './stateStore.js';
export { dotProductPredictionModel } from './predictionModel.js';
export type { PredictionModel } from './predictionModel.js';
export { calculateRoutingDecision, createRiskBandRecommendationPolicy } from './routingPolicy.js';
export type { RecommendationPolicy } from './routingPolicy.js';
export { createExpectationFulfillmentEvidenceModel, expectationFulfillmentEvidenceModel } from './ratingEvidenceModel.js';
export type { RatingEvidenceModel } from './ratingEvidenceModel.js';
export { rdWeightedUpdateAllocator } from './updateAllocator.js';
export type { UpdateAllocator } from './updateAllocator.js';
export { createRdWeightedLearningModel, rdWeightedLearningModel } from './learningModel.js';
export type { LearningModel } from './learningModel.js';
export { glickoInspiredUncertaintyModel } from './uncertaintyModel.js';
export type { UncertaintyModel, UncertaintyPressure } from './uncertaintyModel.js';
export { laneLocalPlayerSignalModel } from './playerSignalModel.js';
export type { PlayerSignalModelLayer } from './playerSignalModel.js';
export { blendedSignalStrengthModel } from './signalStrengthModel.js';
export type { SignalStrengthCalculation, SignalStrengthInputs, SignalStrengthModel } from './signalStrengthModel.js';

import type { ModelingAlgorithms } from './types.js';
import { dotProductPredictionModel } from './predictionModel.js';
import { createRiskBandRecommendationPolicy } from './routingPolicy.js';
import { expectationFulfillmentEvidenceModel } from './ratingEvidenceModel.js';
import { rdWeightedUpdateAllocator } from './updateAllocator.js';
import { rdWeightedLearningModel } from './learningModel.js';
import { laneLocalPlayerSignalModel } from './playerSignalModel.js';

export const defaultModelingAlgorithms: ModelingAlgorithms = {
  predictionModel: dotProductPredictionModel,
  recommendationPolicy: createRiskBandRecommendationPolicy(dotProductPredictionModel),
  ratingEvidenceModel: expectationFulfillmentEvidenceModel,
  updateAllocator: rdWeightedUpdateAllocator,
  learningModel: rdWeightedLearningModel,
  playerSignalModel: laneLocalPlayerSignalModel
};
