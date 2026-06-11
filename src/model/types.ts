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
export type InferredEvidenceSource = 'black-box-upstream';
export type HiddenBehaviorProfile = 'aligned' | 'positive-drift' | 'negative-drift';
export type HiddenTasteCohortKind = 'seed' | 'unseeded';
export type HiddenTasteTruthClass = 'seed-cohort-match' | 'unseeded-cohort-match' | 'random';
export type IslandUpdateCadenceProfile = 'dormant' | 'slow' | 'steady' | 'active' | 'frenetic';

export interface EvidenceEpoch {
  world: number;
  island: number;
}

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
  hiddenTruthClass?: HiddenTasteTruthClass;
  hiddenTargetTasteCohortId?: CohortId | null;
  hiddenAppealVector?: Record<TagId, number>;
  updateCadenceProfile?: IslandUpdateCadenceProfile;
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
  hiddenTasteCohortId?: CohortId;
  hiddenTasteCohortKind?: HiddenTasteCohortKind;
  hiddenTastePreferenceVector?: Record<TagId, number>;
  hiddenBehaviorCohortId?: CohortId;
  hiddenBehaviorProfile?: HiddenBehaviorProfile;
  hiddenTagAlignment?: number;
  hiddenRatingAlignment?: number;
  hiddenReviewerArchetype?: ReviewerArchetype;
  hiddenReviewerChecksum?: string;
}

export interface HiddenTasteCohort {
  id: CohortId;
  label: string;
  kind: HiddenTasteCohortKind;
  sourceSeedCohortId: CohortId;
  projectedSeedCohortId: CohortId;
  preferenceVector: Record<TagId, number>;
  tagSignature: TagId[];
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

export interface InferredRatingEvidenceRecord {
  id: string;
  turn: number;
  userId: UserId;
  islandId: IslandId;
  rating: Rating;
  source: 'inferred';
  sourceSystem: string;
  sourceVersion: string;
  sourceRunId?: string;
  confidence: number;
  provenance: string;
  sourceCategory?: InferredEvidenceSource;
  epoch?: EvidenceEpoch;
  islandVersionId?: string;
  gameRulesVersionId?: string;
}
