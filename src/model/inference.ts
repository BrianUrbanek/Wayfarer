import { cosineSimilarity, pearsonCorrelation } from './similarity.js';
import type {
  CohortAnchor,
  CohortId,
  CohortMatch,
  Island,
  SimilarityResult,
  TagId,
  User
} from './types.js';
import { ratingsToVector, tagsToVector } from './vectors.js';
import { DEFAULT_THRESHOLDS, diagnoseInference, type DiagnosisThresholds } from './diagnostics.js';

export interface CohortSimilarity {
  cohortId: CohortId;
  similarity: SimilarityResult;
  score: number;
}

export interface SignalSummary {
  signalFit: number;
  signalEvidence: number;
  ratingEvidence: number;
  effectiveSignal: number;
}

export interface InferenceResult extends SignalSummary {
  behaviorMatchStrength: number;
  behaviorSpecificity: number;
  declaredSimilarities: CohortSimilarity[];
  behavioralSimilarities: CohortSimilarity[];
  inverseBehavioralSimilarities: CohortSimilarity[];
  declaredDistribution: CohortMatch[];
  behaviorDistribution: CohortMatch[];
  inverseBehaviorDistribution: CohortMatch[];
  declaredTop: CohortMatch;
  behaviorTop: CohortMatch;
  inverseTop: CohortMatch;
}

export type InferenceAnalysis = InferenceResult & {
  diagnosis: ReturnType<typeof diagnoseInference>;
};

function scoreDeclaredSimilarity(
  user: User,
  cohort: CohortAnchor,
  allTags: readonly TagId[]
): SimilarityResult {
  const userVector = tagsToVector(user.declaredTags, allTags);
  const cohortVector = tagsToVector(cohort.tags, allTags);
  const value = cosineSimilarity(userVector, cohortVector);

  return {
    value,
    evidence: user.declaredTags.length > 0 ? 1 : 0,
    overlapCount: user.declaredTags.length
  };
}

function scoreBehaviorSimilarity(
  user: User,
  cohort: CohortAnchor,
  allIslands: readonly Island[]
): SimilarityResult {
  const userVector = ratingsToVector(user.ratings, allIslands);
  const cohortVector = ratingsToVector(cohort.ratings, allIslands);
  return pearsonCorrelation(userVector, cohortVector);
}

function behaviorSpecificityFromDistribution(distribution: CohortMatch[]): number {
  if (distribution.length < 2) {
    return distribution[0]?.score ?? 0;
  }

  const sortedScores = distribution
    .map((entry) => entry.score)
    .sort((left, right) => right - left);

  return Math.max(0, sortedScores[0] - sortedScores[1]);
}

export function positiveBehaviorScore(similarity: SimilarityResult): number {
  return Math.max(0, similarity.value) * similarity.evidence;
}

export function inverseBehaviorScore(similarity: SimilarityResult): number {
  return Math.max(0, -similarity.value) * similarity.evidence;
}

export function computeDeclaredSimilarities(
  user: User,
  cohorts: readonly CohortAnchor[],
  allTags: readonly TagId[]
): CohortSimilarity[] {
  return cohorts.map((cohort) => {
    const similarity = scoreDeclaredSimilarity(user, cohort, allTags);
    return {
      cohortId: cohort.id,
      similarity,
      score: positiveBehaviorScore(similarity)
    };
  });
}

export function computeBehavioralSimilarities(
  user: User,
  cohorts: readonly CohortAnchor[],
  allIslands: readonly Island[]
): CohortSimilarity[] {
  return cohorts.map((cohort) => {
    const similarity = scoreBehaviorSimilarity(user, cohort, allIslands);
    return {
      cohortId: cohort.id,
      similarity,
      score: positiveBehaviorScore(similarity)
    };
  });
}

export function computeInverseBehavioralSimilarities(
  behavioralSimilarities: CohortSimilarity[]
): CohortSimilarity[] {
  return behavioralSimilarities.map((entry) => ({
    cohortId: entry.cohortId,
    similarity: {
      ...entry.similarity,
      value: -entry.similarity.value
    },
    score: inverseBehaviorScore(entry.similarity)
  }));
}

function normalizeScores(entries: CohortSimilarity[]): CohortMatch[] {
  if (entries.length === 0) {
    return [];
  }

  const total = entries.reduce((sum, entry) => sum + entry.score, 0);

  if (total <= 0) {
    const weight = 1 / entries.length;
    return entries.map((entry) => ({
      cohortId: entry.cohortId,
      score: weight
    }));
  }

  return entries.map((entry) => ({
    cohortId: entry.cohortId,
    score: entry.score / total
  }));
}

export function computeDeclaredDistribution(declaredSimilarities: CohortSimilarity[]): CohortMatch[] {
  return normalizeScores(declaredSimilarities);
}

export function computeBehaviorDistribution(behavioralSimilarities: CohortSimilarity[]): CohortMatch[] {
  return normalizeScores(behavioralSimilarities);
}

export function computeInverseBehaviorDistribution(
  inverseBehavioralSimilarities: CohortSimilarity[]
): CohortMatch[] {
  return normalizeScores(inverseBehavioralSimilarities);
}

export function topCohortMatch(distribution: CohortMatch[]): CohortMatch {
  if (distribution.length === 0) {
    return { cohortId: null, score: 0 };
  }

  return distribution.reduce((best, current) => (current.score > best.score ? current : best));
}

export function computeEffectiveSignal(
  declaredDistribution: CohortMatch[],
  behaviorDistribution: CohortMatch[],
  options: {
    declaredEvidence: number;
    behavioralEvidence: number;
  }
): SignalSummary {
  const declaredScores = declaredDistribution.map((entry) => entry.score);
  const behaviorScores = behaviorDistribution.map((entry) => entry.score);
  const signalFit = cosineSimilarity(declaredScores, behaviorScores);
  const signalEvidence = Math.max(options.declaredEvidence, options.behavioralEvidence);
  const ratingEvidence = options.behavioralEvidence;
  const effectiveSignal = signalFit * signalEvidence;

  return {
    signalFit,
    signalEvidence,
    ratingEvidence,
    effectiveSignal
  };
}

export function computeInference(
  user: User,
  cohorts: readonly CohortAnchor[],
  allTags: readonly TagId[],
  allIslands: readonly Island[],
  thresholds: DiagnosisThresholds = DEFAULT_THRESHOLDS
): InferenceAnalysis {
  const declaredSimilarities = computeDeclaredSimilarities(user, cohorts, allTags);
  const behavioralSimilarities = computeBehavioralSimilarities(user, cohorts, allIslands);
  const inverseBehavioralSimilarities = computeInverseBehavioralSimilarities(behavioralSimilarities);

  const declaredDistribution = computeDeclaredDistribution(declaredSimilarities);
  const behaviorDistribution = computeBehaviorDistribution(behavioralSimilarities);
  const inverseBehaviorDistribution = computeInverseBehaviorDistribution(
    inverseBehavioralSimilarities
  );

  const declaredTop = topCohortMatch(declaredDistribution);
  const behaviorTop = topCohortMatch(behaviorDistribution);
  const inverseTop = topCohortMatch(inverseBehaviorDistribution);
  const behaviorMatchStrength = behavioralSimilarities.reduce(
    (best, entry) => Math.max(best, Math.max(0, entry.similarity.value)),
    0
  );
  const behaviorSpecificity = behaviorSpecificityFromDistribution(behaviorDistribution);

  const declaredEvidence = user.declaredTags.length > 0 ? 1 : 0;
  const behavioralEvidence = behavioralSimilarities.length
    ? behavioralSimilarities.reduce((sum, entry) => sum + entry.similarity.evidence, 0) /
      behavioralSimilarities.length
    : 0;
  const signal = computeEffectiveSignal(declaredDistribution, behaviorDistribution, {
    declaredEvidence,
    behavioralEvidence
  });

  const baseResult: InferenceResult = {
    declaredSimilarities,
    behavioralSimilarities,
    inverseBehavioralSimilarities,
    declaredDistribution,
    behaviorDistribution,
    inverseBehaviorDistribution,
    declaredTop,
    behaviorTop,
    inverseTop,
    behaviorMatchStrength,
    behaviorSpecificity,
    ...signal
  };

  const diagnosis = diagnoseInference(
    {
      declaredDistribution,
      behaviorDistribution,
      inverseBehaviorDistribution,
      declaredTop,
      behaviorTop,
      inverseTop,
      behaviorMatchStrength,
      behaviorSpecificity,
      effectiveSignal: signal.effectiveSignal,
      cohorts
    },
    thresholds
  );

  return {
    ...baseResult,
    diagnosis
  };
}
