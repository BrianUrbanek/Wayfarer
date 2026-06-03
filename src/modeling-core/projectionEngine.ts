import type {
  RatingEvidence,
  RatingEvidenceProjection,
  RatingEvent,
  RatingLedgerEntry,
  RetroactiveProjectionTrace,
  SeedProxyRelationship
} from './types.js';
import { createRatingEvidenceProjection } from './evidenceProjection.js';
import type { ModelingStores } from './modelingStores.js';
import { createRatingLedgerEntry } from './ratingLedger.js';
import { applySeedProxyToProjection } from './sourceAuthorityModel.js';

export interface ProjectedRatingEvent {
  ledgerEntry: RatingLedgerEntry;
  evidenceProjection: RatingEvidenceProjection;
  activeRatingLedgerEntryIdsForIsland: string[];
}

export function recordProjectedRatingEvent(stores: ModelingStores, event: RatingEvent, evidence: RatingEvidence): ProjectedRatingEvent {
  const ledgerEntry = createRatingLedgerEntry(event);
  stores.ratingLedger.appendRatingEntry(ledgerEntry);

  if (ledgerEntry.supersedesEntryId) {
    stores.evidenceProjections.markSuperseded(ledgerEntry.supersedesEntryId);
    stores.dirtyProjections.markIslandDirty(ledgerEntry.islandId, 'ratingSupersededByPlayer', ledgerEntry.entryId, event.turn);
    stores.dirtyProjections.markPlayerDirty(ledgerEntry.playerId, 'ratingSupersededByPlayer', ledgerEntry.entryId, event.turn);
  }

  const evidenceProjection = createRatingEvidenceProjection(ledgerEntry, evidence, false);
  stores.evidenceProjections.save(evidenceProjection);

  if (evidenceProjection.contributesToIslandEstimate) {
    stores.dirtyProjections.markIslandDirty(ledgerEntry.islandId, 'ratingEvidenceProjected', ledgerEntry.entryId, event.turn);
  }
  if (evidenceProjection.contributesToPlayerSignalLearning) {
    stores.dirtyProjections.markPlayerDirty(ledgerEntry.playerId, 'ratingEvidenceProjected', ledgerEntry.entryId, event.turn);
  }

  return {
    ledgerEntry,
    evidenceProjection,
    activeRatingLedgerEntryIdsForIsland: stores.evidenceProjections
      .getActiveForIsland(ledgerEntry.islandId, stores.ratingLedger)
      .map((projection) => projection.ledgerEntryId)
  };
}

function relationshipAppliesToEntry(entry: RatingLedgerEntry, relationship: SeedProxyRelationship): boolean {
  return !entry.focusTag || entry.focusTag === relationship.tag;
}

export function reprojectPlayerHistoryForSeedProxies(
  stores: ModelingStores,
  playerId: string,
  relationships: readonly SeedProxyRelationship[],
  calculatedAtTurn: number,
  reason: 'seedProxyEstablished' | 'seedProxyActive'
): RetroactiveProjectionTrace[] {
  if (relationships.length === 0) {
    return [];
  }

  const traces: RetroactiveProjectionTrace[] = [];
  const entries = stores.ratingLedger.getRatingHistoryForPlayer(playerId);

  for (const entry of entries) {
    const projection = stores.evidenceProjections.getByLedgerEntryId(entry.entryId);
    if (!projection || !projection.contributesToIslandEstimate || projection.supersededByPlayer || !projection.trainingEligible) {
      continue;
    }

    let nextProjection = projection;
    for (const relationship of relationships) {
      if (!relationshipAppliesToEntry(entry, relationship)) {
        continue;
      }
      if (nextProjection.proxyForSeedIds.includes(relationship.seedPlayerId)) {
        continue;
      }
      nextProjection = applySeedProxyToProjection(nextProjection, relationship, calculatedAtTurn);
    }

    if (nextProjection === projection) {
      continue;
    }

    stores.evidenceProjections.save(nextProjection);
    stores.dirtyProjections.markIslandDirty(entry.islandId, 'seedProxyReprojected', entry.entryId, calculatedAtTurn);
    traces.push({
      ledgerEntryId: entry.entryId,
      islandId: entry.islandId,
      sourceClassBefore: projection.sourceClass,
      sourceClassAfter: nextProjection.sourceClass,
      signalStrengthBefore: projection.signalStrength,
      signalStrengthAfter: nextProjection.signalStrength,
      proxyForSeedIds: nextProjection.proxyForSeedIds.slice(),
      calculatedAtTurn,
      reason
    });
  }

  if (traces.length > 0) {
    stores.dirtyProjections.markPlayerDirty(playerId, 'seedProxyEstablished', traces[0]?.ledgerEntryId, calculatedAtTurn);
  }

  return traces;
}
