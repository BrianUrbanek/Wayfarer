import type { EvidenceEpoch, Island, IslandId } from './types.js';
import type { RatingRefreshEvent } from './simulation.js';

export type EvidenceFreshness =
  | 'current-context'
  | 'prior-island-context'
  | 'prior-world-context'
  | 'context-unknown';

export interface EvidenceEpochState {
  currentWorldEpoch: number;
  islandEpochById: Record<IslandId, number>;
}

export function createInitialEpoch(): EvidenceEpoch {
  return { world: 0, island: 0 };
}

export function createInitialEvidenceEpoch(islands: readonly Island[]): EvidenceEpochState {
  return {
    currentWorldEpoch: 0,
    islandEpochById: Object.fromEntries(islands.map((island) => [island.id, 0])) as Record<IslandId, number>
  };
}

export function getCurrentEpochForIsland(state: EvidenceEpochState, islandId: IslandId): EvidenceEpoch {
  return {
    world: state.currentWorldEpoch,
    island: state.islandEpochById[islandId] ?? 0
  };
}

export function sameEvidenceEpoch(left: EvidenceEpoch, right: EvidenceEpoch): boolean {
  return left.world === right.world && left.island === right.island;
}

export function compareEvidenceEpoch(
  ratingEpoch: EvidenceEpoch | undefined,
  currentEpoch: EvidenceEpoch
): EvidenceFreshness {
  if (!ratingEpoch) {
    return 'context-unknown';
  }

  if (ratingEpoch.world === currentEpoch.world && ratingEpoch.island === currentEpoch.island) {
    return 'current-context';
  }

  if (ratingEpoch.world === currentEpoch.world) {
    return 'prior-island-context';
  }

  return 'prior-world-context';
}

export function advanceEpochForRefreshEvent(
  state: EvidenceEpochState,
  refreshEvent: RatingRefreshEvent
): EvidenceEpochState {
  if (refreshEvent.kind === 'gamePatch') {
    return {
      currentWorldEpoch: state.currentWorldEpoch + 1,
      islandEpochById: Object.fromEntries(Object.keys(state.islandEpochById).map((islandId) => [islandId, 0])) as Record<IslandId, number>
    };
  }

  if (!refreshEvent.islandId) {
    return {
      currentWorldEpoch: state.currentWorldEpoch,
      islandEpochById: { ...state.islandEpochById }
    };
  }

  return {
    currentWorldEpoch: state.currentWorldEpoch,
    islandEpochById: {
      ...state.islandEpochById,
      [refreshEvent.islandId]: (state.islandEpochById[refreshEvent.islandId] ?? 0) + 1
    }
  };
}

export function buildEvidenceEpochState(
  islands: readonly Island[],
  refreshEvents: readonly RatingRefreshEvent[] = []
): EvidenceEpochState {
  let state = createInitialEvidenceEpoch(islands);

  for (const event of refreshEvents.slice().sort((left, right) => left.turn - right.turn || left.id.localeCompare(right.id))) {
    state = advanceEpochForRefreshEvent(state, event);
  }

  return state;
}
