export type ConfidenceBand = 'none' | 'low' | 'mixed' | 'medium' | 'high';

export type ConfidenceLevelState = 'none' | 'sparse' | 'moderate' | 'strong';

export interface ConfidenceCompositeInput {
  ratingDeviation: number;
  volatility: number;
  evidenceCount: number;
  evidenceSupport?: number;
}

export interface ConfidenceCompositeSummary {
  score: number;
  band: ConfidenceBand;
  uncertaintyState: ConfidenceLevelState;
  volatilityState: ConfidenceLevelState;
  evidenceState: ConfidenceLevelState;
  label: string;
  explanation: string;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function stateFromScore(score: number): ConfidenceLevelState {
  if (score <= 0) {
    return 'none';
  }

  if (score < 0.35) {
    return 'sparse';
  }

  if (score < 0.7) {
    return 'moderate';
  }

  return 'strong';
}

function bandFromScore(score: number): ConfidenceBand {
  if (score <= 0) {
    return 'none';
  }

  if (score < 0.35) {
    return 'low';
  }

  if (score < 0.5) {
    return 'mixed';
  }

  if (score < 0.75) {
    return 'medium';
  }

  return 'high';
}

export function buildConfidenceCompositeSummary(input: ConfidenceCompositeInput): ConfidenceCompositeSummary {
  const evidenceCount = Math.max(0, Math.floor(Number.isFinite(input.evidenceCount) ? input.evidenceCount : 0));
  if (evidenceCount === 0) {
    return {
      score: 0,
      band: 'none',
      uncertaintyState: 'none',
      volatilityState: 'none',
      evidenceState: 'none',
      label: 'No confidence',
      explanation: 'No evidence is present, so the UX composite stays at none even if the read is otherwise stable.'
    };
  }

  const ratingDeviation = clamp01(input.ratingDeviation);
  const volatility = clamp01(input.volatility);
  const evidenceSupport = clamp01(
    typeof input.evidenceSupport === 'number'
      ? input.evidenceSupport
      : evidenceCount / (evidenceCount + 3)
  );

  const uncertaintyScore = ratingDeviation;
  const stabilityScore = volatility;
  const rawScore = (evidenceSupport * 0.45) + (uncertaintyScore * 0.35) + (stabilityScore * 0.2);

  let score = rawScore;
  let band = bandFromScore(score);

  if (ratingDeviation >= 0.75) {
    score = Math.min(score, 0.4);
    band = 'low';
  }

  if (volatility >= 0.7) {
    score = Math.min(score, 0.6);
    band = evidenceCount > 0 ? 'mixed' : 'low';
  }

  score = clamp01(score);

  return {
    score,
    band,
    uncertaintyState: stateFromScore(uncertaintyScore),
    volatilityState: stateFromScore(stabilityScore),
    evidenceState: evidenceCount >= 6 ? 'strong' : evidenceCount >= 3 ? 'moderate' : 'sparse',
    label:
      band === 'high'
        ? 'High confidence'
        : band === 'medium'
          ? 'Medium confidence'
          : band === 'mixed'
            ? 'Mixed confidence'
            : band === 'low'
              ? 'Low confidence'
              : 'No confidence',
    explanation:
      `Confidence is a UX composite of evidence support (${Math.round(evidenceSupport * 100)}%), ` +
      `uncertainty (${Math.round(uncertaintyScore * 100)}%), and stability (${Math.round(stabilityScore * 100)}%).`
  };
}
