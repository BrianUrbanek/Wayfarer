import { recomputeSimulationStateFromCanonicalEvents, serializeSimulationState, type RatingEvent, type SimulationState } from '../model/simulation.js';
import { computeInference } from '../model/inference.js';
import { buildRaterSignalProfiles } from '../model/raterSignal.js';
import { recommendIslandsForUser, type IslandRecommendation } from '../model/recommendations.js';
import { loadModelingFixture } from './fixtures.js';
import type { ModelingTraceRun, ModelingTraceStep } from './types.js';

function createSyntheticTurnHistoryEntry(turn: number, event: RatingEvent) {
  return {
    turn,
    mode: 'organic' as const,
    participatingUserIds: [event.userId],
    ratingsCreated: 1,
    organicRatingsCreated: event.source === 'organic' ? 1 : 0,
    guidedRatingsCreated: event.source === 'guided' ? 1 : 0,
    newlyRatedIslandIds: [event.islandId],
    routedIslandIds: event.source === 'guided' ? [event.islandId] : [],
    recommendationKinds: {
      SAFE_FIT: 0,
      SMART_GAMBLE: 0,
      DISCOVERY_PROBE: 0
    },
    diagnosisCounts: {
      HIGH_SIGNAL: 0,
      MISMATCH_RETAG: 0,
      INVERSE_PROFILE: 0,
      UNKNOWN_OR_NOISY: 0,
      LOW_SIGNAL: 0,
      AMBIGUOUS: 0,
      UNEXPLAINED_PREDICTIVE: 0
    }
  };
}

function recommendationFacingStateForUser(state: SimulationState, userId: string): IslandRecommendation[] {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) {
    return [];
  }

  return recommendIslandsForUser(
    user,
    state.islandAffinityReports,
    state.raterSignalProfiles,
    state.islands,
    { topLimit: 5 }
  ).recommendations;
}

function pickPredictionForIsland(recommendations: readonly IslandRecommendation[], islandId: string): IslandRecommendation | null {
  return recommendations.find((entry) => entry.islandId === islandId) ?? null;
}

function unsupportedConceptsForStep(rating: RatingEvent, hasSignalProfile: boolean): string[] {
  const concepts = ['trustRD', 'signalVolatility', 'sourceAuthority', 'deferredEvidence'];

  if (rating.rating === 0) {
    concepts.push('mehSemanticsChange');
  }

  if (!hasSignalProfile) {
    concepts.push('trustEstimate');
  }

  return concepts;
}

export function runModelingFixture(fixtureId: string): ModelingTraceRun {
  const fixture = loadModelingFixture(fixtureId);
  const beforeState = fixture.simulationState;
  const user = beforeState.users.find((entry) => entry.id === fixture.targetUserId) ?? beforeState.users[0];
  const island = beforeState.islands.find((entry) => entry.id === fixture.targetIslandId) ?? beforeState.islands[0];
  if (!user || !island) {
    throw new Error(`Fixture ${fixtureId} could not resolve user/island targets.`);
  }

  const inferenceBefore = computeInference(user, beforeState.cohorts, beforeState.allTags, beforeState.islands);
  const signalBefore = buildRaterSignalProfiles(beforeState.users, beforeState.inferenceByUserId, beforeState.cohorts).byUserId.get(user.id) ?? null;
  const predictionBeforeCandidates = recommendationFacingStateForUser(beforeState, user.id);
  const predictionBefore = pickPredictionForIsland(predictionBeforeCandidates, island.id);

  const nextState = recomputeSimulationStateFromCanonicalEvents({
    seed: beforeState.seed,
    allTags: beforeState.allTags,
    latentUsers: beforeState.latentUsers,
    cohorts: beforeState.cohorts,
    islands: beforeState.islands,
    ratingEvents: [...beforeState.ratingEvents, fixture.ratingEvent],
    turnHistory: [...beforeState.turnHistory, createSyntheticTurnHistoryEntry(fixture.ratingEvent.turn, fixture.ratingEvent)],
    hiddenTasteCohorts: beforeState.hiddenTasteCohorts,
    observedBehaviorEvents: beforeState.observedBehaviorEvents
  });
  const signalAfter = buildRaterSignalProfiles(nextState.users, nextState.inferenceByUserId, nextState.cohorts).byUserId.get(user.id) ?? null;
  const predictionAfterCandidates = recommendationFacingStateForUser(nextState, user.id);
  const predictionAfter = pickPredictionForIsland(predictionAfterCandidates, island.id);

  const ratingEvidence = {
    rating: fixture.ratingEvent.rating,
    signalStrength: signalBefore?.overallSignal ?? null,
    sourceAuthority: null,
    trustEstimate: signalBefore?.overallSignal ?? null,
    trustRD: null,
    signalVolatility: null
  };

  const unsupportedConcepts = unsupportedConceptsForStep(fixture.ratingEvent, Boolean(signalBefore));
  const recommendationFacingState = predictionBeforeCandidates;

  const step: ModelingTraceStep = {
    rawRating: fixture.ratingEvent,
    assignedRating: fixture.ratingEvent.rating,
    playerDescriptors: {
      declaredTags: user.declaredTags.slice(),
      targetAlignment: inferenceBefore.targetAlignment,
      behaviorTopCohortId: inferenceBefore.behaviorTop.cohortId,
      declaredTopCohortId: inferenceBefore.declaredTop.cohortId
    },
    ratingEvidence,
    predictionBefore: predictionBefore
      ? {
          predictionFacingState: predictionBefore,
          recommendationFacingState
        }
      : null,
    recommendationFacingState,
    predictionError: predictionBefore ? fixture.ratingEvent.rating - predictionBefore.predictedFit : null,
    islandUpdate: {
      before: beforeState.islandAffinityReports.get(island.id) ?? null,
      after: nextState.islandAffinityReports.get(island.id) ?? null
    },
    playerSignalUpdate: {
      before: signalBefore,
      after: signalAfter
    },
    deferredEvidence: fixture.ratingEvent.rating === 0
      ? {
          supported: false,
          reason: 'Current model does not defer meh ratings; unsupportedConcepts records the gap.'
        }
      : null,
    predictionAfter: predictionAfter
      ? {
          predictionFacingState: predictionAfter,
          recommendationFacingState: predictionAfterCandidates
        }
      : null,
    updatedModelState: serializeSimulationState(nextState),
    unsupportedConcepts
  };

  return {
    fixtureId,
    fixtureDescription: fixture.description,
    steps: [step],
    finalState: step.updatedModelState
  };
}
