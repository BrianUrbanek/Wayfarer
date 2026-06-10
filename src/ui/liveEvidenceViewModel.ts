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

function activeVersionsForPair(
  islandId: IslandId,
  refreshEvents: readonly RatingRefreshEvent[]
): { gameRulesVersionId: string; islandVersionId: string } {
  let gameRulesVersionId = globalVersionIdForTurn(0);
  let islandVersionId = islandVersionIdForTurn(0, islandId);

  for (const event of refreshEvents.slice().sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id))) {
    if (event.kind === 'gamePatch') {
      gameRulesVersionId = globalVersionIdForTurn(event.turn);
      islandVersionId = islandVersionIdForTurn(event.turn, islandId);
      continue;
    }

    if (event.kind === 'islandUpdate' && event.islandId === islandId) {
      islandVersionId = islandVersionIdForTurn(event.turn, islandId);
    }
  }

  return { gameRulesVersionId, islandVersionId };
}

function isCurrentExplicitEvent(
  event: RatingEvent,
  versions: { gameRulesVersionId: string; islandVersionId: string }
): boolean {
  if (!event.gameRulesVersionId || !event.islandVersionId) {
    return true;
  }

  return event.gameRulesVersionId === versions.gameRulesVersionId && event.islandVersionId === versions.islandVersionId;
}

function isCurrentInferredEvent(
  event: InferredRatingEvidenceRecord,
  versions: { gameRulesVersionId: string; islandVersionId: string }
): boolean {
  if (!event.gameRulesVersionId || !event.islandVersionId) {
    return true;
  }

  return event.gameRulesVersionId === versions.gameRulesVersionId && event.islandVersionId === versions.islandVersionId;
}

function isVersionedInferredEvent(event: InferredRatingEvidenceRecord): boolean {
  return Boolean(event.gameRulesVersionId && event.islandVersionId);
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
  versions: { gameRulesVersionId: string; islandVersionId: string }
): RatingEvent | null {
  return (
    ratingEvents
      .filter((event) => !supersededIds.has(event.id) && isCurrentExplicitEvent(event, versions))
      .sort(compareLatestRatingEvent)[0] ?? null
  );
}

function explicitStateForEvent(event: RatingEvent | null): LiveEvidenceState {
  if (!event) {
    return 'degraded';
  }

  return event.gameRulesVersionId && event.islandVersionId ? 'canonical' : 'compatibility';
}

function inferredStateForEvent(event: InferredRatingEvidenceRecord | null): LiveEvidenceState {
  if (!event) {
    return 'degraded';
  }

  return isVersionedInferredEvent(event) ? 'canonical' : 'compatibility';
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
  const versions = activeVersionsForPair(input.islandId, relevantRefreshEvents);
  const supersededIds = new Set(relevantRatings.map((event) => event.supersedesEventId).filter((id): id is string => Boolean(id)));
  const current = currentExplicitRating(relevantRatings, supersededIds, versions);
  const currentInferredCandidates = relevantInferred.filter((entry) => isCurrentInferredEvent(entry, versions));
  const inferred = chooseCurrentInferredEvidence(currentInferredCandidates);
  const explicitState = explicitStateForEvent(current);
  const inferredState = inferredStateForEvent(inferred);

  return {
    userId: input.userId,
    islandId: input.islandId,
    explicitStated: {
      category: 'explicit-stated-rating-evidence',
      state: explicitState,
      current,
      historical: relevantRatings.filter((event) => event.id !== current?.id),
      superseded: relevantRatings.filter((event) => supersededIds.has(event.id)),
      note:
        explicitState === 'canonical'
          ? 'Current explicit stated rating is version-aware.'
          : explicitState === 'compatibility'
            ? 'Current explicit stated rating is a legacy event without full version context.'
            : 'No explicit stated rating evidence is available for this pair.'
    },
    inferredRevealed: {
      category: 'inferred-revealed-preference-evidence',
      state: inferredState,
      current: inferred,
      records: relevantInferred.slice().sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id)),
      historical: relevantInferred
        .filter((entry) => entry.id !== inferred?.id)
        .sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id)),
      note: inferred
        ? inferredState === 'canonical'
          ? 'Current inferred revealed-preference evidence is version-aware and remains separate from explicit rating state.'
          : 'Current inferred revealed-preference evidence lacks refresh version context and remains a compatibility read.'
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
      activeGameRulesVersionId: versions.gameRulesVersionId,
      activeIslandVersionId: versions.islandVersionId,
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
