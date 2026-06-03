import type {
  ExpectedSeedRelation,
  HiddenTruthChecksum,
  InferredActorAuthoritySummary,
  ModelingCoreState,
  PlayerPreferenceModel,
  RatingLedgerEntry,
  ScenarioAuthorityValidationSummary,
  TagId
} from './types.js';
import { round } from './math.js';

function activeTrainingEntriesForPlayer(state: ModelingCoreState, playerId: string): RatingLedgerEntry[] {
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

function seedPlayers(state: ModelingCoreState): PlayerPreferenceModel[] {
  return state.players.filter((player) => player.signalModel.sourceAuthority > 1.05);
}

function relationPriority(relation: ExpectedSeedRelation): number {
  switch (relation) {
    case 'seedProxy':
      return 5;
    case 'inverseSignal':
      return 4;
    case 'ordinarySimilar':
      return 3;
    case 'unrelated':
      return 2;
    case 'seed':
      return 1;
  }
}

function classifyVisibleRelationship(
  player: PlayerPreferenceModel,
  seed: PlayerPreferenceModel,
  tag: TagId,
  overlapCount: number,
  matchedRatings: number,
  inverseMatches: number
): { relation: ExpectedSeedRelation; proxyStrength?: number; explanation: string } {
  const existingProxy = player.signalModel.seedProxyByTag?.[tag]?.find((entry) => entry.seedPlayerId === seed.id);
  if (existingProxy) {
    return {
      relation: 'seedProxy',
      proxyStrength: existingProxy.proxyStrength,
      explanation: `${player.label} has an explicit visible seedProxy relationship to ${seed.label} in ${tag}.`
    };
  }

  if (overlapCount >= 5 && inverseMatches / overlapCount >= 0.9) {
    return {
      relation: 'inverseSignal',
      explanation: `${player.label} is visibly inverse-correlated with ${seed.label}: ${inverseMatches}/${overlapCount} overlap ratings disagree in ${tag}.`
    };
  }

  if (overlapCount >= 5 && matchedRatings / overlapCount >= 0.65) {
    return {
      relation: 'ordinarySimilar',
      explanation: `${player.label} is visibly similar to ${seed.label}, but not promoted to seedProxy in ${tag}.`
    };
  }

  return {
    relation: 'unrelated',
    explanation: `${player.label} has no visible seed-proxy, inverse-signal, or strong ordinary-similarity relationship to ${seed.label} in ${tag}.`
  };
}

export function inferAuthoritySummaryFromVisibleState(state: ModelingCoreState): InferredActorAuthoritySummary[] {
  const summaries: InferredActorAuthoritySummary[] = [];
  const seeds = seedPlayers(state);

  for (const player of state.players) {
    if (player.signalModel.sourceAuthority > 1.05) {
      summaries.push({
        actorId: player.id,
        label: player.label,
        inferredRelationToSeed: 'seed',
        overlapCount: 0,
        matchedRatings: 0,
        contradictions: 0,
        inverseMatches: 0,
        similarity: 1,
        source: 'visibleLedgerAndProjectionStateOnly',
        explanation: `${player.label} is visible to the model as a trust-root seed.`
      });
      continue;
    }

    const playerEntries = activeTrainingEntriesForPlayer(state, player.id);
    const candidateSummaries: InferredActorAuthoritySummary[] = [];

    for (const seed of seeds) {
      const seedEntries = activeTrainingEntriesForPlayer(state, seed.id);
      const seedByIsland = new Map(seedEntries.map((entry) => [entry.islandId, entry]));
      const byTag = new Map<TagId, { overlap: number; matches: number; contradictions: number; inverseMatches: number }>();

      for (const playerEntry of playerEntries) {
        const seedEntry = seedByIsland.get(playerEntry.islandId);
        if (!seedEntry) {
          continue;
        }
        const tag = playerEntry.focusTag ?? seedEntry.focusTag ?? state.allTags[0] ?? 'unknown';
        const current = byTag.get(tag) ?? { overlap: 0, matches: 0, contradictions: 0, inverseMatches: 0 };
        current.overlap += 1;
        if (playerEntry.rating === seedEntry.rating) {
          current.matches += 1;
        } else {
          current.contradictions += 1;
          if (playerEntry.rating === -seedEntry.rating) {
            current.inverseMatches += 1;
          }
        }
        byTag.set(tag, current);
      }

      for (const [tag, counts] of byTag) {
        const similarity = counts.overlap === 0 ? 0 : counts.matches / counts.overlap;
        const classification = classifyVisibleRelationship(
          player,
          seed,
          tag,
          counts.overlap,
          counts.matches,
          counts.inverseMatches
        );
        candidateSummaries.push({
          actorId: player.id,
          label: player.label,
          seedPlayerId: seed.id,
          inferredRelationToSeed: classification.relation,
          tag,
          overlapCount: counts.overlap,
          matchedRatings: counts.matches,
          contradictions: counts.contradictions,
          inverseMatches: counts.inverseMatches,
          similarity: round(similarity),
          ...(classification.proxyStrength !== undefined ? { proxyStrength: classification.proxyStrength } : {}),
          source: 'visibleLedgerAndProjectionStateOnly',
          explanation: classification.explanation
        });
      }
    }

    if (candidateSummaries.length === 0) {
      summaries.push({
        actorId: player.id,
        label: player.label,
        inferredRelationToSeed: 'unrelated',
        overlapCount: 0,
        matchedRatings: 0,
        contradictions: 0,
        inverseMatches: 0,
        similarity: 0,
        source: 'visibleLedgerAndProjectionStateOnly',
        explanation: `${player.label} has no visible overlap with any seed.`
      });
      continue;
    }

    candidateSummaries.sort((left, right) => relationPriority(right.inferredRelationToSeed) - relationPriority(left.inferredRelationToSeed) || right.overlapCount - left.overlapCount);
    summaries.push(candidateSummaries[0]!);
  }

  return summaries;
}

export function validateAuthoritySummaryAgainstChecksum(
  checksum: HiddenTruthChecksum | undefined,
  summaries: readonly InferredActorAuthoritySummary[]
): ScenarioAuthorityValidationSummary | undefined {
  if (!checksum) {
    return undefined;
  }

  const byActorId = new Map(summaries.map((summary) => [summary.actorId, summary]));
  const comparisons = Object.values(checksum.actors).map((expected) => {
    const inferred = byActorId.get(expected.actorId);
    const inferredRelation = inferred?.inferredRelationToSeed ?? 'unrelated';
    const passed = inferredRelation === expected.expectedRelationToSeed;
    return {
      actorId: expected.actorId,
      expectedRelationToSeed: expected.expectedRelationToSeed,
      inferredRelationToSeed: inferredRelation,
      passed,
      explanation: passed
        ? `Visible model inference matched hidden checksum for ${expected.label}: ${expected.expectedRelationToSeed}.`
        : `Visible model inference for ${expected.label} was ${inferredRelation}, but hidden checksum expected ${expected.expectedRelationToSeed}.`
    };
  });

  return {
    hiddenTruthUsedFor: ['eventGeneration', 'endOfRunValidation'],
    hiddenTruthNotUsedFor: ['sourceAuthorityInference', 'evidenceProjection', 'recommendationRouting'],
    comparisons,
    passed: comparisons.every((entry) => entry.passed)
  };
}
