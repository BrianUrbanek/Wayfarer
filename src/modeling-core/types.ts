import type { RatingEvent, SimulationState, SerializedSimulationState } from '../model/simulation.js';
import type { IslandRecommendation } from '../model/recommendations.js';
import type { InferenceResult } from '../model/inference.js';
import type { RaterSignalProfile } from '../model/raterSignal.js';
import type { IslandAffinityReport } from '../model/affinity.js';

export interface ModelingFixtureState {
  simulationState: SimulationState;
  targetUserId: string;
  targetIslandId: string;
  ratingEvent: RatingEvent;
  description: string;
}

export interface ModelingTracePrediction {
  predictionFacingState: IslandRecommendation | null;
  recommendationFacingState: IslandRecommendation[] | null;
}

export interface ModelingTraceStep {
  rawRating: RatingEvent;
  assignedRating: number;
  playerDescriptors: {
    declaredTags: string[];
    targetAlignment: InferenceResult['targetAlignment'];
    behaviorTopCohortId: string | null;
    declaredTopCohortId: string | null;
  };
  ratingEvidence: {
    rating: number;
    signalStrength: number | null;
    sourceAuthority: string | null;
    trustEstimate: number | null;
    trustRD: number | null;
    signalVolatility: number | null;
  };
  predictionBefore: ModelingTracePrediction | null;
  recommendationFacingState: ModelingTracePrediction['recommendationFacingState'];
  predictionError: number | null;
  islandUpdate: {
    before: IslandAffinityReport | null;
    after: IslandAffinityReport | null;
  } | null;
  playerSignalUpdate: {
    before: RaterSignalProfile | null;
    after: RaterSignalProfile | null;
  } | null;
  deferredEvidence: {
    supported: boolean;
    reason: string | null;
  } | null;
  predictionAfter: ModelingTracePrediction | null;
  updatedModelState: SerializedSimulationState;
  unsupportedConcepts: string[];
}

export interface ModelingTraceRun {
  fixtureId: string;
  fixtureDescription: string;
  steps: ModelingTraceStep[];
  finalState: SerializedSimulationState;
}
