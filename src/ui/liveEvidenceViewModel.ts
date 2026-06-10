import type { ObservedBehaviorEvent } from '../model/observedBehavior.js';
import type { RatingEvent, RatingRefreshEvent } from '../model/simulation.js';
import type { InferredRatingEvidenceRecord, IslandId, Rating, UserId } from '../model/types.js';
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
    historical: RatingEvent[];
    superseded: RatingEvent[];
    note: string;
  };
  inferredRevealed: {
    category: 'inferred-revealed-preference-evidence';
    state: LiveEvidenceState;
    current: InferredRatingEvidenceRecord | null;
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

function globalVersionIdForTurn(turn: number): string {
  return `game-rules-v${turn}`;
}

function islandVersionIdForTurn(turn: number, islandId: IslandId): string {
  return `island:${islandId}:v${turn}`;
}

function latestRelevantRefreshTurnForPair(
  islandId: IslandId,
  refreshEvents: readonly RatingRefreshEvent[]
): number {
  let latestRelevantTurn = -1;

  for (const event of refreshEvents.slice().sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id))) {
    if (event.kind === 'gamePatch') {
      latestRelevantTurn = Math.max(latestRelevantTurn, event.turn);
      continue;
    }

    if (event.kind === 'islandUpdate' && event.islandId === islandId) {
      latestRelevantTurn = Math.max(latestRelevantTurn, event.turn);
    }
  }

  return latestRelevantTurn;
}

function isCurrentExplicitEvent(
  event: RatingEvent,
  latestRelevantTurn: number
): boolean {
  return event.turn >= latestRelevantTurn;
}

function isCurrentInferredEvent(
  event: InferredRatingEvidenceRecord,
  latestRelevantTurn: number
): boolean {
  return event.turn >= latestRelevantTurn;
}

function compareLatestRatingEvent(left: RatingEvent, right: RatingEvent): number {
  if (left.turn !== right.turn) {
    return right.turn - left.turn;
  }

  return left.id.localeCompare(right.id);
}

function currentExplicitRating(
  ratingEvents: readonly RatingEvent[],
  supersededIds: ReadonlySet<string>,
  latestRelevantTurn: number
): RatingEvent | null {
  return (
    ratingEvents
      .filter((event) => !supersededIds.has(event.id) && isCurrentExplicitEvent(event, latestRelevantTurn))
      .sort(compareLatestRatingEvent)[0] ?? null
  );
}

function explicitStateForEvent(event: RatingEvent | null): LiveEvidenceState {
  if (!event) {
    return 'degraded';
  }

  return 'canonical';
}

function inferredStateForEvent(event: InferredRatingEvidenceRecord | null): LiveEvidenceState {
  if (!event) {
    return 'degraded';
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
  const latestRelevantTurn = latestRelevantRefreshTurnForPair(input.islandId, relevantRefreshEvents);
  const supersededIds = new Set(relevantRatings.map((event) => event.supersedesEventId).filter((id): id is string => Boolean(id)));
  const current = currentExplicitRating(relevantRatings, supersededIds, latestRelevantTurn);
  const currentInferredCandidates = relevantInferred.filter((entry) => isCurrentInferredEvent(entry, latestRelevantTurn));
  const inferred = chooseCurrentInferredEvidence(currentInferredCandidates);
  const explicitState = explicitStateForEvent(current);
  const inferredState = inferredStateForEvent(inferred);
  const explicitHistoricalEvents = relevantRatings.filter((event) => !isCurrentExplicitEvent(event, latestRelevantTurn));
  const inferredHistoricalEvents = relevantInferred.filter((entry) => !isCurrentInferredEvent(entry, latestRelevantTurn));

  return {
    userId: input.userId,
    islandId: input.islandId,
    explicitStated: {
      category: 'explicit-stated-rating-evidence',
      state: explicitState,
      current,
      historical: explicitHistoricalEvents,
      superseded: relevantRatings.filter((event) => supersededIds.has(event.id)),
      note:
        explicitState === 'canonical'
          ? current
            ? latestRelevantTurn >= 0
              ? 'Current explicit stated rating is selected from the latest refresh boundary.'
              : 'Current explicit stated rating is selected from the event log.'
            : 'No explicit stated rating evidence is available for this pair.'
          : 'No explicit stated rating evidence is available for this pair.'
    },
    inferredRevealed: {
      category: 'inferred-revealed-preference-evidence',
      state: inferredState,
      current: inferred,
      records: relevantInferred.slice().sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id)),
      historical: inferredHistoricalEvents
        .sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id)),
      note: inferred
        ? latestRelevantTurn >= 0
          ? 'Current inferred revealed-preference evidence is selected from the latest refresh boundary and remains separate from explicit rating state.'
          : 'Current inferred revealed-preference evidence is selected from the event log and remains separate from explicit rating state.'
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
      activeGameRulesVersionId: globalVersionIdForTurn(latestRelevantTurn >= 0 ? latestRelevantTurn : 0),
      activeIslandVersionId: islandVersionIdForTurn(latestRelevantTurn >= 0 ? latestRelevantTurn : 0, input.islandId),
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
