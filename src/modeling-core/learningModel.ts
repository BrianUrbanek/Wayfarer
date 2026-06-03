import type {
  ModelUpdateTrace,
  ModelingCoreState,
  ModelingPrediction,
  RatingEvent,
  RatingEvidence,
  RdDelta,
  TagDelta,
  TagId,
  UpdateAllocation
} from './types.js';
import { clamp, round } from './math.js';
import { cloneModelingState, findIsland, findPlayer } from './stateStore.js';
import { buildRdDelta, glickoInspiredUncertaintyModel, type UncertaintyModel } from './uncertaintyModel.js';

const LEARNING_RATE = 0.28;

export interface LearningModel {
  applyRatingEvent(
    state: ModelingCoreState,
    event: RatingEvent,
    predictionBefore: ModelingPrediction,
    evidence: RatingEvidence,
    allocation: UpdateAllocation | null
  ): { nextState: ModelingCoreState; updateTrace: ModelUpdateTrace };
}

function observationDelta(event: RatingEvent): ModelUpdateTrace['rawObservationDelta'] {
  return {
    positiveCount: event.rating === 1 ? 1 : 0,
    neutralCount: event.rating === 0 ? 1 : 0,
    negativeCount: event.rating === -1 ? 1 : 0
  };
}

function buildTagDelta(tag: TagId, before: number, after: number): TagDelta {
  return { tag, before: round(before), after: round(after), delta: round(after - before) };
}

function buildUncertaintyInputs(
  allocation: UpdateAllocation | null,
  pressure: ReturnType<UncertaintyModel['evaluateContradictionPressure']> | null,
  evidence: RatingEvidence
): ModelUpdateTrace['learningPressure']['uncertaintyInputs'] {
  return {
    playerAverageRD: allocation ? round(allocation.playerAverageRD) : null,
    islandAverageRD: allocation ? round(allocation.islandAverageRD) : null,
    playerConfidence: pressure ? pressure.playerConfidence : null,
    islandConfidence: pressure ? pressure.islandConfidence : null,
    normalizedSurprise: pressure ? pressure.normalizedSurprise : null,
    confidenceConflict: pressure ? pressure.confidenceConflict : null,
    signalStrength: round(evidence.signalStrength)
  };
}

function explanationForReason(reason: ModelUpdateTrace['learningPressure']['updateReason']['primaryReason']): string {
  switch (reason) {
    case 'nonTraining':
      return 'Neutral/meh ratings are stored as exposure evidence but do not train preference, confidence, volatility, contradiction, or shared fit.';
    case 'focusedExpectationFailure':
      return 'Focused rating is treated as expectation-fulfillment evidence for the attached tag; update pressure is biased toward island audience-fit rather than rewriting player affinity.';
    case 'confidenceConflict':
      return 'Confident models produced a surprising outcome, so estimate movement is smoothly dampened and volatility receives more of the learning pressure.';
    case 'playerLessCertain':
      return 'The player preference model has higher RD than the island audience-fit model, so more estimate movement is allocated to the player side.';
    case 'islandLessCertain':
      return 'The island audience-fit model has higher RD than the player preference model, so more estimate movement is allocated to the island side.';
    case 'balancedUncertainty':
      return 'Player and island uncertainty are similar, so update pressure is split roughly evenly.';
  }
}

function normalizeReasonFactors(
  rawFactors: Array<{ reason: ModelUpdateTrace['learningPressure']['updateReason']['primaryReason']; rawMagnitude: number }>
): ModelUpdateTrace['learningPressure']['updateReason']['factors'] {
  const cleaned = rawFactors
    .map((factor) => ({
      ...factor,
      rawMagnitude: round(Math.max(0, factor.rawMagnitude))
    }))
    .filter((factor) => factor.rawMagnitude > 0);
  const totalMagnitude = cleaned.reduce((sum, factor) => sum + factor.rawMagnitude, 0);

  if (totalMagnitude <= 0) {
    return [];
  }

  return cleaned
    .map((factor) => ({
      reason: factor.reason,
      rawMagnitude: factor.rawMagnitude,
      normalizedMagnitude: round(factor.rawMagnitude / totalMagnitude),
      explanation: explanationForReason(factor.reason)
    }))
    .sort((left, right) => right.normalizedMagnitude - left.normalizedMagnitude);
}

function describeUpdateReason(
  event: RatingEvent,
  allocation: UpdateAllocation | null,
  pressure: ReturnType<UncertaintyModel['evaluateContradictionPressure']> | null,
  evidence: RatingEvidence
): ModelUpdateTrace['learningPressure']['updateReason'] {
  if (!evidence.trainingEligible || !allocation) {
    const primaryReason = 'nonTraining' as const;
    return {
      primaryReason,
      explanation: explanationForReason(primaryReason),
      factors: [
        {
          reason: primaryReason,
          rawMagnitude: 1,
          normalizedMagnitude: 1,
          explanation: explanationForReason(primaryReason)
        }
      ]
    };
  }

  const uncertaintySkew = allocation.playerUpdateShare - allocation.islandUpdateShare;
  const balancedMagnitude = Math.max(0, 0.1 - Math.abs(uncertaintySkew));
  const factors = normalizeReasonFactors([
    {
      reason: 'focusedExpectationFailure',
      rawMagnitude: event.focusTag ? allocation.focusTagIslandBias : 0
    },
    {
      reason: 'confidenceConflict',
      rawMagnitude: pressure?.confidenceConflict ?? 0
    },
    {
      reason: 'playerLessCertain',
      rawMagnitude: Math.max(0, uncertaintySkew)
    },
    {
      reason: 'islandLessCertain',
      rawMagnitude: Math.max(0, -uncertaintySkew)
    },
    {
      reason: 'balancedUncertainty',
      rawMagnitude: balancedMagnitude
    }
  ]);

  const primaryReason = factors[0]?.reason ?? 'balancedUncertainty';
  return {
    primaryReason,
    explanation: explanationForReason(primaryReason),
    factors
  };
}

export function createRdWeightedLearningModel(uncertaintyModel: UncertaintyModel = glickoInspiredUncertaintyModel): LearningModel {
  return {
  applyRatingEvent(state, event, predictionBefore, evidence, allocation) {
    const nextState = cloneModelingState(state);
    const nextPlayer = findPlayer(nextState, event.userId);
    const nextIsland = findIsland(nextState, event.islandId);
    const rawObservationDelta = observationDelta(event);

    nextIsland.rawObservations.positiveCount += rawObservationDelta.positiveCount;
    nextIsland.rawObservations.neutralCount += rawObservationDelta.neutralCount;
    nextIsland.rawObservations.negativeCount += rawObservationDelta.negativeCount;
    nextState.ratingEvents.push({ ...event });

    if (!evidence.trainingEligible || !allocation) {
      return {
        nextState,
        updateTrace: {
          audienceFitDeltas: [],
          demonstratedAffinityDeltas: [],
          islandRDDeltas: [],
          playerRDDeltas: [],
          islandVolatilityDeltas: [],
          learningPressure: {
            predictionError: null,
            surprise: null,
            normalizedSurprise: null,
            playerConfidence: null,
            islandConfidence: null,
            confidenceConflict: null,
            estimateUpdateMultiplier: 0,
            volatilityPressure: 0,
            contradictionDampened: false,
            updateTags: [],
            uncertaintyInputs: buildUncertaintyInputs(null, null, evidence),
            updateReason: describeUpdateReason(event, null, null, evidence)
          },
          rawObservationDelta
        }
      };
    }

    const updateTags = event.focusTag ? [event.focusTag] : nextState.allTags;
    const predictionError = event.rating - predictionBefore.predictedRating;
    const surprise = Math.abs(predictionError);
    const uncertaintyPressure = uncertaintyModel.evaluateContradictionPressure(allocation, predictionError, evidence);
    const multiplier = uncertaintyPressure.estimateUpdateMultiplier;
    const audienceFitDeltas: TagDelta[] = [];
    const demonstratedAffinityDeltas: TagDelta[] = [];
    const islandRDDeltas: RdDelta[] = [];
    const playerRDDeltas: RdDelta[] = [];
    const islandVolatilityDeltas: RdDelta[] = [];

    for (const tag of updateTags) {
      const playerAffinity = nextPlayer.demonstratedAffinityByTag[tag] ?? 0;
      const islandAudienceFit = nextIsland.audienceFitByTag[tag] ?? 0;
      const islandBefore = islandAudienceFit;
      const playerBefore = playerAffinity;
      const islandDelta = LEARNING_RATE * multiplier * evidence.signalStrength * allocation.islandUpdateShare * playerAffinity * predictionError;
      const playerDeltaMultiplier = event.focusTag ? 0.25 : 1;
      const playerDelta = LEARNING_RATE * multiplier * evidence.signalStrength * allocation.playerUpdateShare * islandAudienceFit * predictionError * playerDeltaMultiplier;

      nextIsland.audienceFitByTag[tag] = clamp(islandAudienceFit + islandDelta);
      nextPlayer.demonstratedAffinityByTag[tag] = clamp(playerAffinity + playerDelta);
      audienceFitDeltas.push(buildTagDelta(tag, islandBefore, nextIsland.audienceFitByTag[tag] ?? 0));
      demonstratedAffinityDeltas.push(buildTagDelta(tag, playerBefore, nextPlayer.demonstratedAffinityByTag[tag] ?? 0));

      const islandRdBefore = nextIsland.audienceFitRDByTag[tag] ?? 1;
      const playerRdBefore = nextPlayer.preferenceRDByTag[tag] ?? 1;
      const islandVolBefore = nextIsland.audienceFitVolatilityByTag[tag] ?? 0;
      nextIsland.audienceFitRDByTag[tag] = uncertaintyModel.tightenRD(islandRdBefore, evidence.signalStrength, allocation.islandUpdateShare, multiplier);
      nextPlayer.preferenceRDByTag[tag] = uncertaintyModel.tightenRD(playerRdBefore, evidence.signalStrength, allocation.playerUpdateShare, multiplier);
      nextIsland.audienceFitVolatilityByTag[tag] = uncertaintyModel.updateVolatility(islandVolBefore, uncertaintyPressure);
      islandRDDeltas.push(buildRdDelta(tag, islandRdBefore, nextIsland.audienceFitRDByTag[tag] ?? 1));
      playerRDDeltas.push(buildRdDelta(tag, playerRdBefore, nextPlayer.preferenceRDByTag[tag] ?? 1));
      islandVolatilityDeltas.push(buildRdDelta(tag, islandVolBefore, nextIsland.audienceFitVolatilityByTag[tag] ?? 0));
    }

    return {
      nextState,
      updateTrace: {
        learningPressure: {
          predictionError: round(predictionError),
          surprise: round(surprise),
          normalizedSurprise: uncertaintyPressure.normalizedSurprise,
          playerConfidence: uncertaintyPressure.playerConfidence,
          islandConfidence: uncertaintyPressure.islandConfidence,
          confidenceConflict: uncertaintyPressure.confidenceConflict,
          estimateUpdateMultiplier: round(multiplier),
          volatilityPressure: uncertaintyPressure.volatilityPressure,
          contradictionDampened: multiplier < 1,
          updateTags: updateTags.slice(),
          uncertaintyInputs: buildUncertaintyInputs(allocation, uncertaintyPressure, evidence),
          updateReason: describeUpdateReason(event, allocation, uncertaintyPressure, evidence)
        },
        audienceFitDeltas,
        demonstratedAffinityDeltas,
        islandRDDeltas,
        playerRDDeltas,
        islandVolatilityDeltas,
        rawObservationDelta
      }
    };
  }
  };
}

export const rdWeightedLearningModel: LearningModel = createRdWeightedLearningModel();
