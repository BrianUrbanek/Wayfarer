import type {
  IslandTasteModel,
  ModelId,
  PlayerPreferenceModel,
  ProjectionDirtyRecord,
  RatingEvidenceProjection,
  RatingLedgerEntry
} from './types.js';
import { cloneNumberRecord } from './math.js';
import { supersedeEvidenceProjection } from './evidenceProjection.js';

export interface RatingLedgerStore {
  appendRatingEntry(entry: RatingLedgerEntry): void;
  getRatingHistoryForPlayer(playerId: ModelId): RatingLedgerEntry[];
  getRatingHistoryForIsland(islandId: ModelId): RatingLedgerEntry[];
  getActiveRating(playerId: ModelId, islandId: ModelId): RatingLedgerEntry | null;
  listEntries(): RatingLedgerEntry[];
}

export interface RatingEvidenceProjectionStore {
  save(projection: RatingEvidenceProjection): void;
  markSuperseded(ledgerEntryId: string): void;
  getByLedgerEntryId(ledgerEntryId: string): RatingEvidenceProjection | null;
  getActiveForIsland(islandId: ModelId, ledger: RatingLedgerStore): RatingEvidenceProjection[];
  list(): RatingEvidenceProjection[];
}

export interface PlayerPreferenceStore {
  get(playerId: ModelId): PlayerPreferenceModel | null;
  save(player: PlayerPreferenceModel): void;
}

export interface PlayerSignalStore {
  get(playerId: ModelId): PlayerPreferenceModel['signalModel'] | null;
  save(playerId: ModelId, signalModel: PlayerPreferenceModel['signalModel']): void;
}

export interface IslandProjectionStore {
  get(islandId: ModelId): IslandTasteModel | null;
  save(island: IslandTasteModel): void;
}

export interface ProjectionJobStore {
  markIslandDirty(islandId: ModelId, reason: string, causedByEntryId?: string, markedTurn?: number): void;
  markPlayerDirty(playerId: ModelId, reason: string, causedByEntryId?: string, markedTurn?: number): void;
  list(): ProjectionDirtyRecord[];
}

export interface ModelingStores {
  ratingLedger: RatingLedgerStore;
  evidenceProjections: RatingEvidenceProjectionStore;
  playerPreferences: PlayerPreferenceStore;
  playerSignals: PlayerSignalStore;
  islandProjections: IslandProjectionStore;
  dirtyProjections: ProjectionJobStore;
}

function cloneSignalModel(signalModel: PlayerPreferenceModel['signalModel']): PlayerPreferenceModel['signalModel'] {
  return {
    ...signalModel,
    laneSignalByTag: cloneNumberRecord(signalModel.laneSignalByTag),
    signalUsefulnessByTag: cloneNumberRecord(signalModel.signalUsefulnessByTag),
    signalAlignmentByTag: cloneNumberRecord(signalModel.signalAlignmentByTag),
    signalRDByTag: cloneNumberRecord(signalModel.signalRDByTag),
    signalVolatilityByTag: cloneNumberRecord(signalModel.signalVolatilityByTag),
    ...(signalModel.seedProxyByTag ? {
      seedProxyByTag: Object.fromEntries(Object.entries(signalModel.seedProxyByTag).map(([tag, entries]) => [tag, entries.map((entry) => ({ ...entry }))]))
    } : {})
  };
}

function clonePlayer(player: PlayerPreferenceModel): PlayerPreferenceModel {
  return {
    ...player,
    declaredAffinityByTag: cloneNumberRecord(player.declaredAffinityByTag),
    demonstratedAffinityByTag: cloneNumberRecord(player.demonstratedAffinityByTag),
    activeRoutingAffinityByTag: cloneNumberRecord(player.activeRoutingAffinityByTag),
    preferenceRDByTag: cloneNumberRecord(player.preferenceRDByTag),
    signalModel: cloneSignalModel(player.signalModel)
  };
}

function cloneIsland(island: IslandTasteModel): IslandTasteModel {
  return {
    ...island,
    descriptiveTagProfile: cloneNumberRecord(island.descriptiveTagProfile),
    audienceFitByTag: cloneNumberRecord(island.audienceFitByTag),
    audienceFitRDByTag: cloneNumberRecord(island.audienceFitRDByTag),
    audienceFitVolatilityByTag: cloneNumberRecord(island.audienceFitVolatilityByTag),
    rawObservations: { ...island.rawObservations }
  };
}

export function createInMemoryModelingStores(args: {
  players: readonly PlayerPreferenceModel[];
  islands: readonly IslandTasteModel[];
  ratingLedger?: readonly RatingLedgerEntry[];
  evidenceProjections?: readonly RatingEvidenceProjection[];
  dirtyProjections?: readonly ProjectionDirtyRecord[];
}): ModelingStores {
  const players = new Map(args.players.map((player) => [player.id, clonePlayer(player)]));
  const islands = new Map(args.islands.map((island) => [island.id, cloneIsland(island)]));
  const ledgerEntries = new Map((args.ratingLedger ?? []).map((entry) => [entry.entryId, { ...entry }]));
  const projections = new Map((args.evidenceProjections ?? []).map((projection) => [projection.ledgerEntryId, {
    ...projection,
    proxyForSeedIds: projection.proxyForSeedIds.slice(),
    proxyStrengthBySeed: cloneNumberRecord(projection.proxyStrengthBySeed)
  }]));
  const dirtyRecords: ProjectionDirtyRecord[] = (args.dirtyProjections ?? []).map((record) => ({ ...record }));

  const ratingLedger: RatingLedgerStore = {
    appendRatingEntry(entry) {
      ledgerEntries.set(entry.entryId, { ...entry });
    },
    getRatingHistoryForPlayer(playerId) {
      return Array.from(ledgerEntries.values()).filter((entry) => entry.playerId === playerId).map((entry) => ({ ...entry }));
    },
    getRatingHistoryForIsland(islandId) {
      return Array.from(ledgerEntries.values()).filter((entry) => entry.islandId === islandId).map((entry) => ({ ...entry }));
    },
    getActiveRating(playerId, islandId) {
      const entries = Array.from(ledgerEntries.values()).filter((entry) => entry.playerId === playerId && entry.islandId === islandId);
      const superseded = new Set(entries.map((entry) => entry.supersedesEntryId).filter((entryId): entryId is string => Boolean(entryId)));
      const active = entries.filter((entry) => !superseded.has(entry.entryId)).sort((left, right) => right.turn - left.turn)[0];
      return active ? { ...active } : null;
    },
    listEntries() {
      return Array.from(ledgerEntries.values()).map((entry) => ({ ...entry }));
    }
  };

  const evidenceProjections: RatingEvidenceProjectionStore = {
    save(projection) {
      projections.set(projection.ledgerEntryId, {
        ...projection,
        proxyForSeedIds: projection.proxyForSeedIds.slice(),
        proxyStrengthBySeed: cloneNumberRecord(projection.proxyStrengthBySeed)
      });
    },
    markSuperseded(ledgerEntryId) {
      const existing = projections.get(ledgerEntryId);
      if (existing) {
        projections.set(ledgerEntryId, supersedeEvidenceProjection(existing));
      }
    },
    getByLedgerEntryId(ledgerEntryId) {
      const projection = projections.get(ledgerEntryId);
      return projection ? { ...projection, proxyForSeedIds: projection.proxyForSeedIds.slice(), proxyStrengthBySeed: cloneNumberRecord(projection.proxyStrengthBySeed) } : null;
    },
    getActiveForIsland(islandId, ledger) {
      const entryIds = new Set(ledger.getRatingHistoryForIsland(islandId).map((entry) => entry.entryId));
      return Array.from(projections.values())
        .filter((projection) => entryIds.has(projection.ledgerEntryId) && projection.contributesToIslandEstimate)
        .map((projection) => ({ ...projection, proxyForSeedIds: projection.proxyForSeedIds.slice(), proxyStrengthBySeed: cloneNumberRecord(projection.proxyStrengthBySeed) }));
    },
    list() {
      return Array.from(projections.values()).map((projection) => ({ ...projection, proxyForSeedIds: projection.proxyForSeedIds.slice(), proxyStrengthBySeed: cloneNumberRecord(projection.proxyStrengthBySeed) }));
    }
  };

  return {
    ratingLedger,
    evidenceProjections,
    playerPreferences: {
      get(playerId) {
        const player = players.get(playerId);
        return player ? clonePlayer(player) : null;
      },
      save(player) {
        players.set(player.id, clonePlayer(player));
      }
    },
    playerSignals: {
      get(playerId) {
        const player = players.get(playerId);
        return player ? cloneSignalModel(player.signalModel) : null;
      },
      save(playerId, signalModel) {
        const player = players.get(playerId);
        if (player) {
          players.set(playerId, { ...player, signalModel: cloneSignalModel(signalModel) });
        }
      }
    },
    islandProjections: {
      get(islandId) {
        const island = islands.get(islandId);
        return island ? cloneIsland(island) : null;
      },
      save(island) {
        islands.set(island.id, cloneIsland(island));
      }
    },
    dirtyProjections: {
      markIslandDirty(islandId, reason, causedByEntryId, markedTurn) {
        dirtyRecords.push({
          targetType: 'island',
          targetId: islandId,
          reason,
          ...(causedByEntryId ? { causedByEntryId } : {}),
          ...(markedTurn !== undefined ? { markedTurn, processingStatus: 'pending' as const } : {})
        });
      },
      markPlayerDirty(playerId, reason, causedByEntryId, markedTurn) {
        dirtyRecords.push({
          targetType: 'player',
          targetId: playerId,
          reason,
          ...(causedByEntryId ? { causedByEntryId } : {}),
          ...(markedTurn !== undefined ? { markedTurn, processingStatus: 'pending' as const } : {})
        });
      },
      list() {
        return dirtyRecords.map((record) => ({ ...record }));
      }
    }
  };
}
