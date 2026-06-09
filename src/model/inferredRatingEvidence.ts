import type { InferredRatingEvidenceRecord, IslandId, Rating, UserId } from './types.js';

export type InferredPreferencePolarity = 'positive' | 'negative' | 'neutral';
export type InferredRatingEvidence = InferredRatingEvidenceRecord;

export type StatedRevealedDiagnosticState =
  | 'aligned-positive'
  | 'aligned-negative'
  | 'stated-positive-revealed-negative'
  | 'stated-negative-revealed-positive'
  | 'insufficient-evidence';

export interface StatedRevealedPreferenceDiagnostic {
  readonly userId: UserId;
  readonly islandId: IslandId;
  readonly explicitRating: Rating | null;
  readonly inferredRating: Rating | null;
  readonly explicitPolarity: InferredPreferencePolarity | 'neutral' | 'none';
  readonly inferredPolarity: InferredPreferencePolarity | 'neutral' | 'none';
  readonly state: StatedRevealedDiagnosticState;
  readonly explanation: string;
  readonly provenance: string;
  readonly sourceSystem?: string;
  readonly sourceVersion?: string;
  readonly confidence?: number;
}

function polarityFromRating(rating: Rating | null): InferredPreferencePolarity | 'neutral' | 'none' {
  if (rating === null) {
    return 'none';
  }
  if (rating > 0) {
    return 'positive';
  }
  if (rating < 0) {
    return 'negative';
  }
  return 'neutral';
}

export function buildStatedRevealedPreferenceDiagnostic(input: {
  userId: UserId;
  islandId: IslandId;
  explicitRating: Rating | null;
  inferredEvidence?: InferredRatingEvidence | null;
}): StatedRevealedPreferenceDiagnostic {
  const explicitPolarity = polarityFromRating(input.explicitRating);
  const inferredRating = input.inferredEvidence?.rating ?? null;
  const inferredPolarity = polarityFromRating(inferredRating);

  if (!input.inferredEvidence || explicitPolarity === 'none' || inferredPolarity === 'none') {
    return {
      userId: input.userId,
      islandId: input.islandId,
      explicitRating: input.explicitRating,
      inferredRating,
      explicitPolarity,
      inferredPolarity,
      state: 'insufficient-evidence',
      explanation: 'Need both explicit and inferred evidence to diagnose stated-vs-revealed alignment.',
      provenance: input.inferredEvidence?.provenance ?? 'No inferred evidence record is attached.'
    };
  }

  if (explicitPolarity === 'positive' && inferredPolarity === 'positive') {
    return {
      userId: input.userId,
      islandId: input.islandId,
      explicitRating: input.explicitRating,
      inferredRating,
      explicitPolarity,
      inferredPolarity,
      state: 'aligned-positive',
      explanation: 'Stated positive and revealed positive are aligned.',
      provenance: input.inferredEvidence.provenance,
      sourceSystem: input.inferredEvidence.sourceSystem,
      sourceVersion: input.inferredEvidence.sourceVersion,
      confidence: input.inferredEvidence.confidence
    };
  }

  if (explicitPolarity === 'negative' && inferredPolarity === 'negative') {
    return {
      userId: input.userId,
      islandId: input.islandId,
      explicitRating: input.explicitRating,
      inferredRating,
      explicitPolarity,
      inferredPolarity,
      state: 'aligned-negative',
      explanation: 'Stated negative and revealed negative are aligned.',
      provenance: input.inferredEvidence.provenance,
      sourceSystem: input.inferredEvidence.sourceSystem,
      sourceVersion: input.inferredEvidence.sourceVersion,
      confidence: input.inferredEvidence.confidence
    };
  }

  if (explicitPolarity === 'positive' && inferredPolarity === 'negative') {
    return {
      userId: input.userId,
      islandId: input.islandId,
      explicitRating: input.explicitRating,
      inferredRating,
      explicitPolarity,
      inferredPolarity,
      state: 'stated-positive-revealed-negative',
      explanation: 'The player said like but the inferred evidence points away from the island.',
      provenance: input.inferredEvidence.provenance,
      sourceSystem: input.inferredEvidence.sourceSystem,
      sourceVersion: input.inferredEvidence.sourceVersion,
      confidence: input.inferredEvidence.confidence
    };
  }

  if (explicitPolarity === 'negative' && inferredPolarity === 'positive') {
    return {
      userId: input.userId,
      islandId: input.islandId,
      explicitRating: input.explicitRating,
      inferredRating,
      explicitPolarity,
      inferredPolarity,
      state: 'stated-negative-revealed-positive',
      explanation: 'The player said dislike, but the inferred evidence suggests instrumental or revealed engagement.',
      provenance: input.inferredEvidence.provenance,
      sourceSystem: input.inferredEvidence.sourceSystem,
      sourceVersion: input.inferredEvidence.sourceVersion,
      confidence: input.inferredEvidence.confidence
    };
  }

  return {
    userId: input.userId,
    islandId: input.islandId,
    explicitRating: input.explicitRating,
    inferredRating,
    explicitPolarity,
    inferredPolarity,
    state: 'insufficient-evidence',
    explanation: 'No decisive stated-vs-revealed contrast is available.',
    provenance: input.inferredEvidence.provenance,
    sourceSystem: input.inferredEvidence.sourceSystem,
    sourceVersion: input.inferredEvidence.sourceVersion,
    confidence: input.inferredEvidence.confidence
  };
}

export function chooseCurrentInferredEvidence(
  inferredEvidence: readonly InferredRatingEvidence[]
): InferredRatingEvidence | null {
  if (inferredEvidence.length === 0) {
    return null;
  }

  return [...inferredEvidence].sort((left, right) => {
    if (left.turn !== right.turn) {
      return right.turn - left.turn;
    }

    if (left.confidence !== right.confidence) {
      return right.confidence - left.confidence;
    }

    return left.id.localeCompare(right.id);
  })[0] ?? null;
}
