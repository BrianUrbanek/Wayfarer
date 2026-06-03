import type { IslandTasteModel, ModelingCoreState, PlayerPreferenceModel } from './types.js';
import { cloneNumberRecord } from './math.js';

function assertFound<T>(value: T | undefined, label: string): T {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
}

export function cloneModelingState(state: ModelingCoreState): ModelingCoreState {
  return {
    allTags: state.allTags.slice(),
    players: state.players.map((player) => ({
      ...player,
      declaredAffinityByTag: cloneNumberRecord(player.declaredAffinityByTag),
      demonstratedAffinityByTag: cloneNumberRecord(player.demonstratedAffinityByTag),
      activeRoutingAffinityByTag: cloneNumberRecord(player.activeRoutingAffinityByTag),
      preferenceRDByTag: cloneNumberRecord(player.preferenceRDByTag),
      signalModel: {
        ...player.signalModel,
        laneSignalByTag: cloneNumberRecord(player.signalModel.laneSignalByTag),
        signalUsefulnessByTag: cloneNumberRecord(player.signalModel.signalUsefulnessByTag),
        signalAlignmentByTag: cloneNumberRecord(player.signalModel.signalAlignmentByTag),
        signalRDByTag: cloneNumberRecord(player.signalModel.signalRDByTag),
        signalVolatilityByTag: cloneNumberRecord(player.signalModel.signalVolatilityByTag),
        ...(player.signalModel.seedProxyByTag ? {
          seedProxyByTag: Object.fromEntries(Object.entries(player.signalModel.seedProxyByTag).map(([tag, entries]) => [tag, entries.map((entry) => ({ ...entry }))]))
        } : {})
      }
    })),
    islands: state.islands.map((island) => ({
      ...island,
      descriptiveTagProfile: cloneNumberRecord(island.descriptiveTagProfile),
      audienceFitByTag: cloneNumberRecord(island.audienceFitByTag),
      audienceFitRDByTag: cloneNumberRecord(island.audienceFitRDByTag),
      audienceFitVolatilityByTag: cloneNumberRecord(island.audienceFitVolatilityByTag),
      rawObservations: { ...island.rawObservations }
    })),
    ratingEvents: state.ratingEvents.map((event) => ({ ...event })),
    ratingLedger: state.ratingLedger.map((entry) => ({ ...entry })),
    evidenceProjections: state.evidenceProjections.map((projection) => ({
      ...projection,
      proxyForSeedIds: projection.proxyForSeedIds.slice(),
      proxyStrengthBySeed: cloneNumberRecord(projection.proxyStrengthBySeed)
    })),
    dirtyProjections: state.dirtyProjections.map((record) => ({ ...record }))
  };
}

export function findPlayer(state: ModelingCoreState, playerId: string): PlayerPreferenceModel {
  return assertFound(state.players.find((player) => player.id === playerId), `player ${playerId}`);
}

export function findIsland(state: ModelingCoreState, islandId: string): IslandTasteModel {
  return assertFound(state.islands.find((island) => island.id === islandId), `island ${islandId}`);
}
