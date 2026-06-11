import type { ObservedBehaviorEvent } from '../model/observedBehavior.js';
import type { RatingEvent, RatingRefreshEvent } from '../model/simulation.js';
import {
  buildEvidenceEpochState,
  compareEvidenceEpoch,
  createInitialEpoch,
  getCurrentEpochForIsland,
  type EvidenceFreshness
} from '../model/evidenceEpoch.js';
import type { EvidenceEpoch, InferredRatingEvidenceRecord, Island, IslandId, Rating, UserId } from '../model/types.js';
import {
  buildStatedRevealedPreferenceDiagnostic,
  chooseCurrentInferredEvidence,
  type StatedRevealedPreferenceDiagnostic
} from '../model/inferredRatingEvidence.js';
import type { LiveEvidenceState } from './liveEvidenceAdapter.js';

export type CanonicalEvidenceCategory =
  | 'explicit-stated-rating-evidence'
  | 'inferred-revealed-preference-evidence'
  | 'synthetic-observed-behavior'
  | 'projected-model-evidence'
  | 'diagnostic-interpretation'
  | 'refresh-revision-context'
  | 'compatibility-proxy-evidence';

export interface PairEvidenceViewModel {
  userId: UserId;
  islandId: IslandId;
  explicitStated: {
    category: 'explicit-stated-rating-evidence';
    state: LiveEvidenceState;
    current: RatingEvent | null;
    currentEpoch: EvidenceEpoch | null;
    currentIslandEpoch: EvidenceEpoch;
    freshness: EvidenceFreshness;
    historical: RatingEvent[];
    superseded: RatingEvent[];
    note: string;
  };
  inferredRevealed: {
    category: 'inferred-revealed-preference-evidence';
    state: LiveEvidenceState;
    current: InferredRatingEvidenceRecord | null;
    currentEpoch: EvidenceEpoch | null;
    currentIslandEpoch: EvidenceEpoch;
    freshness: EvidenceFreshness;
    records: InferredRatingEvidenceRecord[];
    historical: InferredRatingEvidenceRecord[];
    note: string;
  };
  syntheticObservedBehavior: {
    category: 'synthetic-observed-behavior';
    state: LiveEvidenceState;
    records: ObservedBehaviorEvent[];
    note: string;
  };
  refreshContext: {
    category: 'refresh-revision-context';
    state: LiveEvidenceState;
    activeGameRulesVersionId: string;
    activeIslandVersionId: string;
    refreshEvents: RatingRefreshEvent[];
    note: string;
  };
  diagnostics: StatedRevealedPreferenceDiagnostic & {
    category: 'diagnostic-interpretation';
    state: StatedRevealedPreferenceDiagnostic['state'];
  };
}

function compareLatestRatingEvent(left: RatingEvent, right: RatingEvent): number {
  if (left.turn !== right.turn) {
    return right.turn - left.turn;
  }

  return left.id.localeCompare(right.id);
}

function currentExplicitRating(
  ratingEvents: readonly RatingEvent[],
  supersededIds: ReadonlySet<string>
): RatingEvent | null {
  return (
    ratingEvents
      .filter((event) => !supersededIds.has(event.id))
      .sort(compareLatestRatingEvent)[0] ?? null
  );
}

function explicitRatingEpoch(event: RatingEvent | null): EvidenceEpoch | undefined {
  return event?.epoch ?? (event ? createInitialEpoch() : undefined);
}

function explicitStateForEvent(event: RatingEvent | null, freshness: EvidenceFreshness): LiveEvidenceState {
  if (!event) {
    return 'degraded';
  }

  if (freshness === 'context-unknown') {
    return 'compatibility';
  }

  return 'canonical';
}

function inferredStateForEvent(event: InferredRatingEvidenceRecord | null, freshness: EvidenceFreshness): LiveEvidenceState {
  if (!event) {
    return 'degraded';
  }

  if (freshness === 'context-unknown') {
    return 'compatibility';
  }

  return 'canonical';
}

function diagnosticForPair(input: {
  userId: UserId;
  islandId: IslandId;
  explicitRating: Rating | null;
  inferredEvidence: InferredRatingEvidenceRecord | null;
}): PairEvidenceViewModel['diagnostics'] {
  return {
    ...buildStatedRevealedPreferenceDiagnostic({
      userId: input.userId,
      islandId: input.islandId,
      explicitRating: input.explicitRating,
      inferredEvidence: input.inferredEvidence
    }),
    category: 'diagnostic-interpretation'
  };
}

export function buildPairEvidenceViewModel(input: {
  userId: UserId;
  islandId: IslandId;
  islands?: readonly Pick<Island, 'id' | 'label'>[];
  ratingEvents: readonly RatingEvent[];
  inferredRatingEvidence: readonly InferredRatingEvidenceRecord[];
  observedBehaviorEvents: readonly ObservedBehaviorEvent[];
  refreshEvents: readonly RatingRefreshEvent[];
}): PairEvidenceViewModel {
  const relevantRatings = input.ratingEvents
    .filter((event) => event.userId === input.userId && event.islandId === input.islandId)
    .slice()
    .sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id));
  const relevantInferred = input.inferredRatingEvidence.filter(
    (entry) => entry.userId === input.userId && entry.islandId === input.islandId
  );
  const relevantBehavior = input.observedBehaviorEvents.filter(
    (entry) => entry.userId === input.userId && entry.islandId === input.islandId
  );
  const relevantRefreshEvents = input.refreshEvents.filter(
    (event) => event.kind === 'gamePatch' || event.islandId === input.islandId
  );
  const islands = input.islands?.length ? input.islands : [{ id: input.islandId, label: input.islandId }];
  const epochState = buildEvidenceEpochState(islands as Island[], relevantRefreshEvents);
  const currentIslandEpoch = getCurrentEpochForIsland(epochState, input.islandId);
  const supersededIds = new Set(relevantRatings.map((event) => event.supersedesEventId).filter((id): id is string => Boolean(id)));
  const current = currentExplicitRating(relevantRatings, supersededIds);
  const currentExplicitEpoch = explicitRatingEpoch(current);
  const explicitFreshness = compareEvidenceEpoch(currentExplicitEpoch, currentIslandEpoch);
  const inferred = chooseCurrentInferredEvidence(relevantInferred.filter((entry) => compareEvidenceEpoch(entry.epoch, currentIslandEpoch) !== 'prior-world-context' && compareEvidenceEpoch(entry.epoch, currentIslandEpoch) !== 'prior-island-context'));
  const inferredFreshness = compareEvidenceEpoch(inferred?.epoch, currentIslandEpoch);
  const explicitState = explicitStateForEvent(current, explicitFreshness);
  const inferredState = inferredStateForEvent(inferred, inferredFreshness);
  const explicitHistoricalEvents = relevantRatings.filter((event) => event.id !== current?.id || compareEvidenceEpoch(explicitRatingEpoch(event), currentIslandEpoch) !== 'current-context');
  const inferredHistoricalEvents = relevantInferred.filter((entry) => entry.id !== inferred?.id && compareEvidenceEpoch(entry.epoch, currentIslandEpoch) !== 'current-context');

  return {
    userId: input.userId,
    islandId: input.islandId,
    explicitStated: {
      category: 'explicit-stated-rating-evidence',
      state: explicitState,
      current,
      currentEpoch: currentExplicitEpoch ?? null,
      currentIslandEpoch,
      freshness: explicitFreshness,
      historical: explicitHistoricalEvents,
      superseded: relevantRatings.filter((event) => supersededIds.has(event.id)),
      note:
        explicitState === 'canonical'
          ? current
            ? explicitFreshness === 'current-context'
              ? 'Latest explicit stated rating belongs to the current evidence epoch.'
              : 'Latest explicit stated rating is preserved as prior-context evidence; current-context re-rating is not yet observed.'
            : 'No explicit stated rating evidence is available for this pair.'
          : explicitState === 'compatibility'
            ? 'Latest explicit stated rating lacks epoch context and is shown as compatibility evidence.'
            : 'No explicit stated rating evidence is available for this pair.'
    },
    inferredRevealed: {
      category: 'inferred-revealed-preference-evidence',
      state: inferredState,
      current: inferred,
      currentEpoch: inferred?.epoch ?? null,
      currentIslandEpoch,
      freshness: inferredFreshness,
      records: relevantInferred.slice().sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id)),
      historical: inferredHistoricalEvents
        .sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id)),
      note: inferred
        ? inferredFreshness === 'context-unknown'
          ? 'Current inferred revealed-preference evidence lacks epoch context and remains separate from explicit rating state.'
          : 'Current inferred revealed-preference evidence is classified by epoch and remains separate from explicit rating state.'
        : 'No inferred revealed-preference evidence is available for this pair.'
    },
    syntheticObservedBehavior: {
      category: 'synthetic-observed-behavior',
      state: relevantBehavior.length > 0 ? 'compatibility' : 'degraded',
      records: relevantBehavior.slice().sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id)),
      note:
        relevantBehavior.length > 0
          ? 'Synthetic observed behavior is generated from explicit rating events and is not raw telemetry.'
          : 'No synthetic observed behavior is available for this pair.'
    },
    refreshContext: {
      category: 'refresh-revision-context',
      state: 'canonical',
      activeGameRulesVersionId: `game-rules-epoch-${currentIslandEpoch.world}`,
      activeIslandVersionId: `island:${input.islandId}:epoch-${currentIslandEpoch.world}.${currentIslandEpoch.island}`,
      refreshEvents: relevantRefreshEvents.slice().sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id)),
      note: 'Refresh and revision context controls current evidence eligibility without deleting history.'
    },
    diagnostics: diagnosticForPair({
      userId: input.userId,
      islandId: input.islandId,
      explicitRating: current?.rating ?? null,
      inferredEvidence: inferred
    })
  };
}
