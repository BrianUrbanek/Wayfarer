import type {
  RatingEvidence,
  RatingEvidenceAuthorityBasis,
  RatingEvidenceProjection,
  RatingEvidenceSourceClass,
  RatingLedgerEntry
} from './types.js';
import { round } from './math.js';

const MODEL_VERSION = 'modeling-core-v11a-projection';

function sourceClassForEntry(entry: RatingLedgerEntry, evidence: RatingEvidence): RatingEvidenceSourceClass {
  if (entry.source === 'guided') {
    return 'guidedDiagnostic';
  }
  if (evidence.sourceAuthority > 1.05) {
    return 'cohortSeed';
  }
  if (evidence.trustEstimate >= 0.72 || evidence.laneSignalUsefulness >= 0.72) {
    return 'highSignalPlayer';
  }
  return 'ordinaryPlayer';
}

function authorityBasisForSource(sourceClass: RatingEvidenceSourceClass): RatingEvidenceAuthorityBasis {
  switch (sourceClass) {
    case 'cohortSeed':
      return 'directSeed';
    case 'seedProxy':
      return 'learnedSimilarityToSeed';
    case 'guidedDiagnostic':
      return 'diagnosticContext';
    case 'highSignalPlayer':
      return 'learnedPredictiveUsefulness';
    case 'ordinaryPlayer':
      return 'ordinaryRating';
  }
}

export function createRatingEvidenceProjection(
  entry: RatingLedgerEntry,
  evidence: RatingEvidence,
  supersededByPlayer: boolean,
  projectedTurn: number = entry.turn,
  readModelStateTurn: number = Math.max(0, projectedTurn - 1)
): RatingEvidenceProjection {
  const sourceClass = sourceClassForEntry(entry, evidence);
  const contributesToIslandEstimate = evidence.trainingEligible && !supersededByPlayer;
  return {
    projectionId: `${entry.entryId}:projection`,
    ledgerEntryId: entry.entryId,
    activeForCurrentIslandVersion: !supersededByPlayer,
    versionCompatibility: 1,
    temporalDecayMultiplier: 1,
    supersededByPlayer,
    contributesToIslandEstimate,
    contributesToPlayerSignalLearning: evidence.trainingEligible && !supersededByPlayer,
    sourceClass,
    authorityBasis: authorityBasisForSource(sourceClass),
    proxyForSeedIds: [],
    proxyStrengthBySeed: {},
    signalStrength: round(evidence.signalStrength),
    polarity: evidence.trainingEligible ? evidence.assignedRating : 0,
    trainingEligible: evidence.trainingEligible,
    eventTurn: entry.turn,
    readModelStateTurn,
    projectedTurn,
    calculatedAtTurn: projectedTurn,
    modelVersion: MODEL_VERSION
  };
}

export function supersedeEvidenceProjection(projection: RatingEvidenceProjection): RatingEvidenceProjection {
  return {
    ...projection,
    activeForCurrentIslandVersion: false,
    supersededByPlayer: true,
    contributesToIslandEstimate: false,
    contributesToPlayerSignalLearning: false
  };
}
