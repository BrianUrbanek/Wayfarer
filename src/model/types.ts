export type TagId = string;
export type UserId = string;
export type IslandId = string;
export type CohortId = string;

export type ReviewerArchetype =
  | 'CLEAN_COHORT_MATCH'
  | 'MISLABELED_USER'
  | 'INVERSE_RATER'
  | 'RANDOM_NOISY_USER'
  | 'TINA_LIKE_DETACHED_PREDICTOR'
  | 'EARLY_SCOUT'
  | 'LATE_CONSENSUS_FOLLOWER'
  | 'POPULARITY_CHASER'
  | 'NICHE_SPECIALIST';

export type Rating = -1 | 0 | 1;
export type MaybeRating = Rating | null;

export type IslandClass =
  | 'BROAD_HIT'
  | 'BROAD_DUD'
  | 'NICHE_COHORT'
  | 'POLARIZED_PAIR'
  | 'UNDECIDED';

export interface Island {
  id: IslandId;
  label: string;
  hiddenAppealPattern?: Record<CohortId, Rating>;
  hiddenClass?: IslandClass;
}

export interface CohortAnchor {
  id: CohortId;
  label: string;
  analystName?: string;
  tags: TagId[];
  ratings: Record<IslandId, MaybeRating>;
  source: 'meta_moderator' | 'analyst_defined';
}

export interface User {
  id: UserId;
  label: string;
  declaredTags: TagId[];
  ratings: Record<IslandId, MaybeRating>;
  hiddenSeedCohortId?: CohortId;
  hiddenDeclaredCohortId?: CohortId;
  hiddenBehaviorCohortId?: CohortId;
  hiddenTagAlignment?: number;
  hiddenRatingAlignment?: number;
  hiddenReviewerArchetype?: ReviewerArchetype;
  hiddenReviewerChecksum?: string;
}

export interface SimilarityResult {
  value: number;
  evidence: number;
  overlapCount: number;
}

export interface CohortMatch {
  cohortId: CohortId | null;
  score: number;
}

export type DiagnosisType =
  | 'HIGH_SIGNAL'
  | 'MISMATCH_RETAG'
  | 'INVERSE_PROFILE'
  | 'UNKNOWN_OR_NOISY'
  | 'LOW_SIGNAL'
  | 'AMBIGUOUS'
  | 'UNEXPLAINED_PREDICTIVE';

export interface Diagnosis {
  type: DiagnosisType;
  message: string;
  suggestedCohortId?: CohortId;
  suggestedTags?: TagId[];
  analystPriority: 'none' | 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
}
