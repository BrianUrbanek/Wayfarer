import type { CohortAnchor, CohortId, SimilarityResult, User, UserId } from './types.js';
import type { InferenceResult } from './inference.js';

export interface RaterSignalProfile {
  userId: UserId;
  overallSignal: number;
  signalEvidence: number;
  cohortWeights: Record<CohortId, number>;
  cohortEvidence: Record<CohortId, number>;
  cohortSimilarities: Record<CohortId, SimilarityResult>;
  topCohortId: CohortId | null;
}

export interface RaterSignalAnalysis {
  allProfiles: RaterSignalProfile[];
  byUserId: ReadonlyMap<UserId, RaterSignalProfile>;
}

export interface RaterTrustProfile {
  userId: UserId;
  overallTrust: number;
  trustEvidence: number;
  cohortTrustWeights: Record<CohortId, number>;
  cohortEvidence: Record<CohortId, number>;
  cohortSimilarities: Record<CohortId, SimilarityResult>;
  topTrustedCohortId: CohortId | null;
}

export interface RaterTrustAnalysis {
  allProfiles: RaterTrustProfile[];
  byUserId: ReadonlyMap<UserId, RaterTrustProfile>;
}

function blankCohortNumberRecord(cohorts: readonly CohortAnchor[], value = 0): Record<CohortId, number> {
  return Object.fromEntries(cohorts.map((cohort) => [cohort.id, value])) as Record<CohortId, number>;
}

function blankCohortSimilarityRecord(
  cohorts: readonly CohortAnchor[]
): Record<CohortId, SimilarityResult> {
  return Object.fromEntries(
    cohorts.map((cohort) => [
      cohort.id,
      {
        value: 0,
        evidence: 0,
        overlapCount: 0
      }
    ])
  ) as Record<CohortId, SimilarityResult>;
}

/**
 * Compatibility signal profile used across existing consumers.
 *
 * Note: These values are currently a proto-trust proxy derived from
 * cohort-local behavioral similarity and overlap evidence.
 */
export function buildRaterSignalProfiles(
  users: readonly User[],
  inferenceByUserId: ReadonlyMap<UserId, InferenceResult>,
  cohorts: readonly CohortAnchor[]
): RaterSignalAnalysis {
  const profiles = users.map<RaterSignalProfile>((user) => {
    const inference = inferenceByUserId.get(user.id);
    const cohortWeights = blankCohortNumberRecord(cohorts);
    const cohortEvidence = blankCohortNumberRecord(cohorts);
    const cohortSimilarities = blankCohortSimilarityRecord(cohorts);

    let topCohortId: CohortId | null = null;
    let topWeight = 0;
    let topEvidence = 0;

    for (const entry of inference?.behavioralSimilarities ?? []) {
      cohortWeights[entry.cohortId] = entry.score;
      cohortEvidence[entry.cohortId] = entry.similarity.evidence;
      cohortSimilarities[entry.cohortId] = entry.similarity;

      if (entry.score > topWeight) {
        topWeight = entry.score;
        topCohortId = entry.cohortId;
        topEvidence = entry.similarity.evidence;
      }
    }

    return {
      userId: user.id,
      overallSignal: topWeight,
      signalEvidence: topWeight > 0 ? topEvidence : 0,
      cohortWeights,
      cohortEvidence,
      cohortSimilarities,
      topCohortId
    };
  });

  return {
    allProfiles: profiles,
    byUserId: new Map(profiles.map((profile) => [profile.userId, profile]))
  };
}

/**
 * Trust-facing adapter for issue #43.
 *
 * Numeric behavior is intentionally 1:1 with buildRaterSignalProfiles so
 * downstream routing/affinity/recommendation outputs remain stable.
 */
export function buildRaterTrustProfiles(
  users: readonly User[],
  inferenceByUserId: ReadonlyMap<UserId, InferenceResult>,
  cohorts: readonly CohortAnchor[]
): RaterTrustAnalysis {
  const signalAnalysis = buildRaterSignalProfiles(users, inferenceByUserId, cohorts);
  const trustProfiles = signalAnalysis.allProfiles.map<RaterTrustProfile>((profile) => ({
    userId: profile.userId,
    overallTrust: profile.overallSignal,
    trustEvidence: profile.signalEvidence,
    cohortTrustWeights: { ...profile.cohortWeights },
    cohortEvidence: { ...profile.cohortEvidence },
    cohortSimilarities: { ...profile.cohortSimilarities },
    topTrustedCohortId: profile.topCohortId
  }));

  return {
    allProfiles: trustProfiles,
    byUserId: new Map(trustProfiles.map((profile) => [profile.userId, profile]))
  };
}
