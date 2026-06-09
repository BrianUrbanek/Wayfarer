import type { InferredRatingEvidence, StatedRevealedPreferenceDiagnostic } from '../model/inferredRatingEvidence.js';
import { buildStatedRevealedPreferenceDiagnostic, chooseCurrentInferredEvidence } from '../model/inferredRatingEvidence.js';
import type { Rating } from '../model/types.js';

export function buildStatedRevealedPreferenceDiagnosticForPair(input: {
  userId: string;
  islandId: string;
  explicitRating: Rating | null;
  inferredEvidence: readonly InferredRatingEvidence[];
}): StatedRevealedPreferenceDiagnostic | null {
  const inferredEvidence = chooseCurrentInferredEvidence(
    input.inferredEvidence.filter((entry) => entry.userId === input.userId && entry.islandId === input.islandId)
  );
  if (!inferredEvidence && input.explicitRating === null) {
    return null;
  }

  return buildStatedRevealedPreferenceDiagnostic({
    userId: input.userId,
    islandId: input.islandId,
    explicitRating: input.explicitRating,
    inferredEvidence
  });
}
