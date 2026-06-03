import { loadModelingFixture } from './fixtures.js';
import { cloneModelingState, defaultModelingAlgorithms, findIsland, findPlayer } from './engine.js';
import { createInMemoryModelingStores } from './modelingStores.js';
import { recordProjectedRatingEvent, reprojectPlayerHistoryForSeedProxies } from './projectionEngine.js';
import { attachSeedProxyRelationships, evaluateSeedProxyRelationships } from './sourceAuthorityModel.js';
import { inferAuthoritySummaryFromVisibleState, validateAuthoritySummaryAgainstChecksum } from './scenarioAuthoritySummary.js';
import type { ModelingAlgorithms, ModelingCoreState, ModelingTraceRun, ModelingTraceStep, RatingEvent } from './types.js';

function fixtureEvents(fixtureId: string, event: RatingEvent | undefined, events: RatingEvent[] | undefined): RatingEvent[] {
  const resolvedEvents = events ?? (event ? [event] : []);
  if (resolvedEvents.length === 0) {
    throw new Error(`Fixture ${fixtureId} did not provide rating events.`);
  }
  return resolvedEvents.map((entry) => ({ ...entry }));
}

function runStep(state: ModelingCoreState, event: RatingEvent, algorithms: ModelingAlgorithms): { nextState: ModelingCoreState; step: ModelingTraceStep } {
  const player = findPlayer(state, event.userId);
  const island = findIsland(state, event.islandId);
  const predictionBefore = algorithms.predictionModel.predictPlayerIslandFit(player, island, state.allTags);
  const recommendationFacingState = algorithms.recommendationPolicy.recommendForPlayer(player, state.islands, state.allTags);
  const ratingEvidence = algorithms.ratingEvidenceModel.constructRatingEvidence(player, event);
  const stores = createInMemoryModelingStores({
    players: state.players,
    islands: state.islands,
    ratingLedger: state.ratingLedger,
    evidenceProjections: state.evidenceProjections,
    dirtyProjections: state.dirtyProjections
  });
  const projectedRatingEvent = recordProjectedRatingEvent(stores, event, ratingEvidence);
  const updateAllocation = ratingEvidence.trainingEligible
    ? algorithms.updateAllocator.allocateUpdatePressure(player, island, state.allTags, ratingEvidence.focusTag)
    : null;
  const predictionError = ratingEvidence.trainingEligible
    ? event.rating - predictionBefore.predictedRating
    : null;
  const signalBefore = {
    ...player.signalModel,
    laneSignalByTag: { ...player.signalModel.laneSignalByTag },
    signalUsefulnessByTag: { ...player.signalModel.signalUsefulnessByTag },
    signalAlignmentByTag: { ...player.signalModel.signalAlignmentByTag },
    signalRDByTag: { ...player.signalModel.signalRDByTag },
    signalVolatilityByTag: { ...player.signalModel.signalVolatilityByTag }
  };
  const stateWithProjection = {
    ...state,
    ratingLedger: stores.ratingLedger.listEntries(),
    evidenceProjections: stores.evidenceProjections.list(),
    dirtyProjections: stores.dirtyProjections.list()
  };
  const { nextState: preferenceUpdatedState, updateTrace } = algorithms.learningModel.applyRatingEvent(
    stateWithProjection,
    event,
    predictionBefore,
    ratingEvidence,
    updateAllocation
  );
  const { nextState: signalUpdatedState, signalTrace } = algorithms.playerSignalModel.applySignalLearning(
    preferenceUpdatedState,
    event,
    predictionBefore,
    ratingEvidence,
    updateTrace.learningPressure
  );

  const signalUpdatedPlayer = findPlayer(signalUpdatedState, event.userId);
  const authorityEvaluation = evaluateSeedProxyRelationships(signalUpdatedState, signalUpdatedPlayer, event.turn);
  const authorityUpdatedPlayer = attachSeedProxyRelationships(signalUpdatedPlayer, authorityEvaluation.relationships);
  const stateWithAuthority = authorityEvaluation.relationships.length === 0
    ? signalUpdatedState
    : {
        ...signalUpdatedState,
        players: signalUpdatedState.players.map((entry) => entry.id === authorityUpdatedPlayer.id ? authorityUpdatedPlayer : entry)
      };
  const authorityStores = createInMemoryModelingStores({
    players: stateWithAuthority.players,
    islands: stateWithAuthority.islands,
    ratingLedger: stateWithAuthority.ratingLedger,
    evidenceProjections: stateWithAuthority.evidenceProjections,
    dirtyProjections: stateWithAuthority.dirtyProjections
  });
  const existingRelationships = authorityUpdatedPlayer.signalModel.seedProxyByTag
    ? Object.values(authorityUpdatedPlayer.signalModel.seedProxyByTag).flat()
    : [];
  const relationshipsReadableAtStartOfTurn = existingRelationships.filter((relationship) => relationship.establishedTurn < event.turn);
  const retroactiveProjectionUpdates = reprojectPlayerHistoryForSeedProxies(
    authorityStores,
    event.userId,
    relationshipsReadableAtStartOfTurn,
    event.turn,
    authorityEvaluation.relationships.length > 0 ? 'seedProxyEstablished' : 'seedProxyActive'
  );
  const nextState = {
    ...stateWithAuthority,
    ratingLedger: authorityStores.ratingLedger.listEntries(),
    evidenceProjections: authorityStores.evidenceProjections.list(),
    dirtyProjections: authorityStores.dirtyProjections.list()
  };
  const nextPlayer = findPlayer(nextState, event.userId);
  const nextIsland = findIsland(nextState, event.islandId);
  const predictionAfter = algorithms.predictionModel.predictPlayerIslandFit(nextPlayer, nextIsland, nextState.allTags);

  const step: ModelingTraceStep = {
    rawRating: event,
    turnTrace: {
      turn: event.turn,
      readModelStateTurn: Math.max(0, event.turn - 1),
      writeModelStateTurn: event.turn,
      capturePhase: event.source === 'guided' ? 'guidedDiscoveryCapture' : 'selfDirectedDiscoveryCapture',
      updatePhase: 'atomicModelUpdate',
      snapshotIsolation: true,
      explanation: 'This step reads the previous completed model snapshot, captures discovery evidence, and writes consequences atomically at the end of the turn; Phase 3 results are not readable by other Phase 3 calculations in the same turn.'
    },
    assignedRating: event.rating,
    playerDescriptors: {
      declaredAffinityByTag: { ...player.declaredAffinityByTag },
      demonstratedAffinityByTag: { ...player.demonstratedAffinityByTag },
      activeRoutingAffinityByTag: { ...player.activeRoutingAffinityByTag }
    },
    ratingEvidence,
    ratingLedgerEntry: projectedRatingEvent.ledgerEntry,
    ratingEvidenceProjection: authorityStores.evidenceProjections.getByLedgerEntryId(projectedRatingEvent.ledgerEntry.entryId) ?? projectedRatingEvent.evidenceProjection,
    activeRatingLedgerEntryIdsForIsland: authorityStores.evidenceProjections
      .getActiveForIsland(projectedRatingEvent.ledgerEntry.islandId, authorityStores.ratingLedger)
      .map((projection) => projection.ledgerEntryId),
    sourceAuthorityUpdates: authorityEvaluation.trace,
    retroactiveProjectionUpdates,
    predictionBefore,
    recommendationFacingState,
    predictionError,
    updateAllocation,
    islandUpdate: updateTrace,
    playerSignalUpdate: {
      before: signalBefore,
      after: {
        ...nextPlayer.signalModel,
        laneSignalByTag: { ...nextPlayer.signalModel.laneSignalByTag },
        signalUsefulnessByTag: { ...nextPlayer.signalModel.signalUsefulnessByTag },
        signalAlignmentByTag: { ...nextPlayer.signalModel.signalAlignmentByTag },
        signalRDByTag: { ...nextPlayer.signalModel.signalRDByTag },
        signalVolatilityByTag: { ...nextPlayer.signalModel.signalVolatilityByTag }
      },
      trace: signalTrace
    },
    deferredEvidence: ratingEvidence.trainingEligible
      ? null
      : {
          supported: true,
          reason: 'Neutral/meh ratings are stored as exposure evidence but do not train preference, confidence, volatility, contradiction, or shared island fit.'
        },
    predictionAfter,
    updatedModelState: nextState,
    unsupportedConcepts: []
  };

  return { nextState, step };
}

export function runModelingFixture(fixtureId: string, algorithms: ModelingAlgorithms = defaultModelingAlgorithms): ModelingTraceRun {
  const fixture = loadModelingFixture(fixtureId);
  const events = fixtureEvents(fixtureId, fixture.ratingEvent, fixture.ratingEvents);
  const steps: ModelingTraceStep[] = [];
  let currentState = cloneModelingState(fixture.initialState);

  for (const event of events) {
    const { nextState, step } = runStep(currentState, event, algorithms);
    steps.push(step);
    currentState = nextState;
  }

  const authoritySummary = inferAuthoritySummaryFromVisibleState(currentState);
  const scenarioAuthorityValidation = validateAuthoritySummaryAgainstChecksum(fixture.oracle?.hiddenTruthChecksum, authoritySummary);

  return {
    fixtureId,
    fixtureDescription: fixture.description,
    ...(fixture.oracle ? { fixtureOracle: fixture.oracle } : {}),
    ...(authoritySummary.length > 0 ? { authoritySummary } : {}),
    ...(scenarioAuthorityValidation ? { scenarioAuthorityValidation } : {}),
    steps,
    finalState: currentState
  };
}
