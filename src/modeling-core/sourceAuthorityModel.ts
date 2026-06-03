import type {
  ModelId,
  ModelingCoreState,
  PlayerPreferenceModel,
  RatingEvidenceProjection,
  RatingLedgerEntry,
  SeedProxyRelationship,
  SourceAuthorityTrace,
  TagId
} from './types.js';
import { clamp, round } from './math.js';

const MIN_PROXY_MATCHES = 15;

function activeTrainingEntriesForPlayer(state: ModelingCoreState, playerId: ModelId): RatingLedgerEntry[] {
  const superseded = new Set(state.ratingLedger.map((entry) => entry.supersedesEntryId).filter((entryId): entryId is string => Boolean(entryId)));
  const activeProjectionIds = new Set(
    state.evidenceProjections
      .filter((projection) => projection.trainingEligible && projection.contributesToPlayerSignalLearning && !projection.supersededByPlayer)
      .map((projection) => projection.ledgerEntryId)
  );

  return state.ratingLedger
    .filter((entry) => entry.playerId === playerId && !superseded.has(entry.entryId) && activeProjectionIds.has(entry.entryId) && entry.rating !== 0)
    .sort((left, right) => left.turn - right.turn || left.entryId.localeCompare(right.entryId));
}

function seedPlayers(state: ModelingCoreState, playerId: ModelId): PlayerPreferenceModel[] {
  return state.players.filter((player) => player.id !== playerId && player.signalModel.sourceAuthority > 1.05);
}

function relationshipKey(seedPlayerId: ModelId, tag: TagId): string {
  return `${seedPlayerId}::${tag}`;
}

function existingRelationshipKeys(player: PlayerPreferenceModel): Set<string> {
  const relationships = player.signalModel.seedProxyByTag ?? {};
  return new Set(Object.entries(relationships).flatMap(([tag, entries]) => entries.map((entry) => relationshipKey(entry.seedPlayerId, tag))));
}

function primaryTagForOverlap(playerEntry: RatingLedgerEntry, seedEntry: RatingLedgerEntry, allTags: readonly TagId[]): TagId {
  return playerEntry.focusTag ?? seedEntry.focusTag ?? allTags[0] ?? 'unknown';
}

export function evaluateSeedProxyRelationships(
  state: ModelingCoreState,
  player: PlayerPreferenceModel,
  currentTurn: number
): { relationships: SeedProxyRelationship[]; trace: SourceAuthorityTrace[] } {
  const playerEntries = activeTrainingEntriesForPlayer(state, player.id);
  const knownRelationships = existingRelationshipKeys(player);
  const newRelationships: SeedProxyRelationship[] = [];
  const traces: SourceAuthorityTrace[] = [];

  for (const seed of seedPlayers(state, player.id)) {
    const seedEntries = activeTrainingEntriesForPlayer(state, seed.id);
    const seedByIsland = new Map(seedEntries.map((entry) => [entry.islandId, entry]));
    const byTag = new Map<TagId, { overlap: number; matches: number; contradictions: number }>();

    for (const playerEntry of playerEntries) {
      const seedEntry = seedByIsland.get(playerEntry.islandId);
      if (!seedEntry) {
        continue;
      }
      const tag = primaryTagForOverlap(playerEntry, seedEntry, state.allTags);
      const current = byTag.get(tag) ?? { overlap: 0, matches: 0, contradictions: 0 };
      current.overlap += 1;
      if (playerEntry.rating === seedEntry.rating) {
        current.matches += 1;
      } else {
        current.contradictions += 1;
      }
      byTag.set(tag, current);
    }

    for (const [tag, summary] of byTag) {
      const similarity = summary.overlap === 0 ? 0 : summary.matches / summary.overlap;
      const qualifies = summary.matches >= MIN_PROXY_MATCHES && summary.contradictions === 0 && similarity >= 0.95;
      if (!qualifies || knownRelationships.has(relationshipKey(seed.id, tag))) {
        continue;
      }

      const proxyStrength = round(clamp(0.5 + similarity * 0.45 + Math.min(summary.matches, 30) / 30 * 0.05, 0, 1));
      const proxyRD = round(clamp(1 / (summary.matches + 2), 0.03, 0.35));
      const relationship: SeedProxyRelationship = {
        seedPlayerId: seed.id,
        tag,
        similarity: round(similarity),
        matchedRatings: summary.matches,
        overlappingRatings: summary.overlap,
        contradictions: summary.contradictions,
        proxyStrength,
        proxyRD,
        establishedTurn: currentTurn
      };
      newRelationships.push(relationship);
      traces.push({
        playerId: player.id,
        sourceClass: 'seedProxy',
        authorityBasis: 'learnedSimilarityToSeed',
        seedPlayerId: seed.id,
        tag,
        overlapCount: summary.overlap,
        matchedRatings: summary.matches,
        contradictions: summary.contradictions,
        similarity: round(similarity),
        proxyStrength,
        proxyRD,
        establishedTurn: currentTurn,
        explanation: `${player.id} became a silent ${seed.id} proxy for ${tag} after ${summary.matches}/${summary.overlap} matching seed-overlap ratings with no contradictions.`
      });
    }
  }

  return { relationships: newRelationships, trace: traces };
}

export function attachSeedProxyRelationships(player: PlayerPreferenceModel, relationships: readonly SeedProxyRelationship[]): PlayerPreferenceModel {
  if (relationships.length === 0) {
    return player;
  }

  const seedProxyByTag: Record<TagId, SeedProxyRelationship[]> = Object.fromEntries(
    Object.entries(player.signalModel.seedProxyByTag ?? {}).map(([tag, entries]) => [tag, entries.map((entry) => ({ ...entry }))])
  );

  for (const relationship of relationships) {
    const entries = seedProxyByTag[relationship.tag] ?? [];
    if (!entries.some((entry) => entry.seedPlayerId === relationship.seedPlayerId)) {
      entries.push({ ...relationship });
    }
    seedProxyByTag[relationship.tag] = entries;
  }

  return {
    ...player,
    signalModel: {
      ...player.signalModel,
      seedProxyByTag
    }
  };
}

export function applySeedProxyToProjection(
  projection: RatingEvidenceProjection,
  relationship: SeedProxyRelationship,
  calculatedAtTurn: number
): RatingEvidenceProjection {
  const proxyForSeedIds = Array.from(new Set([...projection.proxyForSeedIds, relationship.seedPlayerId]));
  return {
    ...projection,
    sourceClass: 'seedProxy',
    authorityBasis: 'learnedSimilarityToSeed',
    proxyForSeedIds,
    proxyStrengthBySeed: {
      ...projection.proxyStrengthBySeed,
      [relationship.seedPlayerId]: relationship.proxyStrength
    },
    signalStrength: round(clamp(Math.max(projection.signalStrength, relationship.proxyStrength * 0.72), 0, 1)),
    readModelStateTurn: Math.max(0, calculatedAtTurn - 1),
    projectedTurn: calculatedAtTurn,
    calculatedAtTurn,
    modelVersion: 'modeling-core-v11c-seed-proxy'
  };
}
