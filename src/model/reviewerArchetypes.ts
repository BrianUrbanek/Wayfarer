import type {
  CohortAnchor,
  CohortId,
  DiagnosisType,
  Island,
  IslandClass,
  Rating,
  ReviewerArchetype,
  User,
  UserId
} from './types.js';
import type { InferenceAnalysis } from './inference.js';
import type { RaterSignalProfile } from './raterSignal.js';

export type ReviewerRecoveryStatus = 'MATCH' | 'PARTIAL' | 'MISS' | 'UNCERTAIN';

export interface ReviewerArchetypeReport {
  userId: UserId;
  label: string;
  hiddenReviewerArchetype: ReviewerArchetype;
  hiddenReviewerChecksum: string;
  hiddenSeedCohortId: CohortId | null;
  hiddenDeclaredCohortId: CohortId | null;
  hiddenBehaviorCohortId: CohortId | null;
  inferredDiagnosisType: DiagnosisType;
  inferredCohortId: CohortId | null;
  declaredFit: number;
  behaviorFit: number;
  knownCohortFit: number;
  overallSignal: number;
  signalEvidence: number;
  effectiveSignal: number;
  broadHitScore: number;
  nicheScore: number;
  dudScore: number;
  undecidedScore: number;
  guidedTurnBias: number;
  recoveryStatus: ReviewerRecoveryStatus;
  analystFlags: string[];
  reviewCandidate: boolean;
}

export interface ReviewerArchetypeCohortSummary {
  cohortId: CohortId;
  users: ReviewerArchetypeReport[];
}

export interface ReviewerArchetypeRecoverySummary {
  totalUsers: number;
  totalByArchetype: Record<ReviewerArchetype, number>;
  totalByStatus: Record<ReviewerRecoveryStatus, number>;
  matchCount: number;
  partialCount: number;
  missCount: number;
  uncertainCount: number;
  candidateSeedCount: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
}

export interface ReviewerArchetypeAnalysis {
  allReports: ReviewerArchetypeReport[];
  recoverySummary: ReviewerArchetypeRecoverySummary;
  highSignalByCohort: ReviewerArchetypeCohortSummary[];
  weakFitHighSignalUsers: ReviewerArchetypeReport[];
  candidateSeedUsers: ReviewerArchetypeReport[];
  earlyScouts: ReviewerArchetypeReport[];
  popularityChasers: ReviewerArchetypeReport[];
  noisyUsers: ReviewerArchetypeReport[];
  falsePositives: ReviewerArchetypeReport[];
  falseNegatives: ReviewerArchetypeReport[];
}

export interface ReviewerArchetypeAnalysisOptions {
  minSignalEvidence?: number;
  minKnownCohortFit?: number;
  candidateSeedFitFloor?: number;
  highSignalThreshold?: number;
  classSignalThreshold?: number;
  turnBiasThreshold?: number;
}

export interface ReviewerRatingEventLike {
  userId: UserId;
  turn: number;
  source: string;
}

const DEFAULT_OPTIONS: Required<ReviewerArchetypeAnalysisOptions> = {
  minSignalEvidence: 0.15,
  minKnownCohortFit: 0.35,
  candidateSeedFitFloor: 0.3,
  highSignalThreshold: 0.35,
  classSignalThreshold: 0.25,
  turnBiasThreshold: 0.55
};

const ARCHETYPE_NAMES: Record<ReviewerArchetype, string> = {
  CLEAN_COHORT_MATCH: 'Clean Cohort Match',
  MISLABELED_USER: 'Mislabeled User',
  INVERSE_RATER: 'Inverse Rater',
  RANDOM_NOISY_USER: 'Random / Noisy User',
  TINA_LIKE_DETACHED_PREDICTOR: 'Unexplained High-Signal User',
  EARLY_SCOUT: 'Early Scout',
  LATE_CONSENSUS_FOLLOWER: 'Late Consensus Follower',
  POPULARITY_CHASER: 'Popularity Chaser',
  NICHE_SPECIALIST: 'Niche Specialist'
};

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getRatingsForClass(user: User, islands: readonly Island[], targetClasses: readonly IslandClass[]): Rating[] {
  return islands
    .filter((island) => island.hiddenClass && targetClasses.includes(island.hiddenClass))
    .map((island) => user.ratings[island.id])
    .filter((rating): rating is Rating => rating !== null);
}

function averageRatingForClass(user: User, islands: readonly Island[], targetClasses: readonly IslandClass[]): number {
  return average(getRatingsForClass(user, islands, targetClasses));
}

function guidedTurnBias(events: readonly ReviewerRatingEventLike[], userId: UserId): number {
  const userEvents = events.filter((event) => event.userId === userId);
  if (userEvents.length === 0) {
    return 0;
  }

  const activeTurns = userEvents.filter((event) => event.source === 'guided').map((event) => event.turn);
  if (activeTurns.length === 0) {
    return 0;
  }

  const latestTurn = Math.max(...events.map((event) => event.turn), 1);
  return Math.min(1, Math.max(0, average(activeTurns) / latestTurn));
}

function matchStatusFromHiddenPattern(
  archetype: ReviewerArchetype,
  diagnosisType: DiagnosisType,
  evidence: number,
  knownCohortFit: number,
  flags: readonly string[]
): ReviewerRecoveryStatus {
  if (evidence < DEFAULT_OPTIONS.minSignalEvidence) {
    return 'UNCERTAIN';
  }

  switch (archetype) {
    case 'CLEAN_COHORT_MATCH':
      return diagnosisType === 'HIGH_SIGNAL' && knownCohortFit >= 0.45 ? 'MATCH' : 'MISS';
    case 'MISLABELED_USER':
      return diagnosisType === 'MISMATCH_RETAG' && knownCohortFit >= 0.35 ? 'MATCH' : 'MISS';
    case 'INVERSE_RATER':
      return diagnosisType === 'INVERSE_PROFILE' ? 'MATCH' : 'MISS';
    case 'RANDOM_NOISY_USER':
      return diagnosisType === 'UNKNOWN_OR_NOISY' || diagnosisType === 'AMBIGUOUS' ? 'MATCH' : 'MISS';
    case 'TINA_LIKE_DETACHED_PREDICTOR':
      return evidence >= DEFAULT_OPTIONS.minSignalEvidence ? 'PARTIAL' : 'UNCERTAIN';
    case 'EARLY_SCOUT':
      return flags.includes('early-scout') && diagnosisType === 'HIGH_SIGNAL' ? 'MATCH' : 'PARTIAL';
    case 'LATE_CONSENSUS_FOLLOWER':
      return flags.includes('late-consensus') && diagnosisType === 'HIGH_SIGNAL' ? 'MATCH' : 'PARTIAL';
    case 'POPULARITY_CHASER':
      return flags.includes('popularity-chaser') && diagnosisType === 'HIGH_SIGNAL' ? 'MATCH' : 'PARTIAL';
    case 'NICHE_SPECIALIST':
      return flags.includes('niche-specialist') && diagnosisType === 'HIGH_SIGNAL' ? 'MATCH' : 'PARTIAL';
    default:
      return 'UNCERTAIN';
  }
}

function buildAnalystFlags(
  report: Omit<
    ReviewerArchetypeReport,
    'analystFlags' | 'reviewCandidate' | 'recoveryStatus'
  >,
  optionThresholds: Required<ReviewerArchetypeAnalysisOptions>
): string[] {
  const flags: string[] = [];

  if (report.effectiveSignal >= optionThresholds.highSignalThreshold) {
    flags.push('high-signal');
  }

  if (report.knownCohortFit <= optionThresholds.minKnownCohortFit) {
    flags.push('weak-known-fit');
  }

  if (report.declaredFit <= optionThresholds.minKnownCohortFit) {
    flags.push('weak-declared-fit');
  }

  if (report.broadHitScore >= optionThresholds.classSignalThreshold) {
    flags.push('broad-hit');
  }

  if (report.nicheScore >= optionThresholds.classSignalThreshold) {
    flags.push('niche-specialist');
  }

  if (report.dudScore <= -optionThresholds.classSignalThreshold) {
    flags.push('broad-dud-avoidance');
  }

  if (report.undecidedScore >= optionThresholds.classSignalThreshold) {
    flags.push('late-consensus');
  }

  if (report.broadHitScore >= optionThresholds.classSignalThreshold && report.nicheScore >= optionThresholds.classSignalThreshold) {
    flags.push('candidate-seed');
  }

  if (report.guidedTurnBias >= optionThresholds.turnBiasThreshold) {
    flags.push('guided-router');
  }

  switch (report.hiddenReviewerArchetype) {
    case 'EARLY_SCOUT':
      if (report.guidedTurnBias <= 0.35) {
        flags.push('early-scout');
      }
      break;
    case 'LATE_CONSENSUS_FOLLOWER':
      if (report.guidedTurnBias >= 0.65) {
        flags.push('late-consensus');
      }
      break;
    case 'POPULARITY_CHASER':
      flags.push('popularity-chaser');
      break;
    case 'NICHE_SPECIALIST':
      flags.push('niche-specialist');
      break;
    case 'TINA_LIKE_DETACHED_PREDICTOR':
      flags.push('detached-predictor');
      break;
    default:
      break;
  }

  return Array.from(new Set(flags));
}

function buildRecoverySummary(reports: readonly ReviewerArchetypeReport[]): ReviewerArchetypeRecoverySummary {
  const totalByArchetype: Record<ReviewerArchetype, number> = {
    CLEAN_COHORT_MATCH: 0,
    MISLABELED_USER: 0,
    INVERSE_RATER: 0,
    RANDOM_NOISY_USER: 0,
    TINA_LIKE_DETACHED_PREDICTOR: 0,
    EARLY_SCOUT: 0,
    LATE_CONSENSUS_FOLLOWER: 0,
    POPULARITY_CHASER: 0,
    NICHE_SPECIALIST: 0
  };

  const totalByStatus: Record<ReviewerRecoveryStatus, number> = {
    MATCH: 0,
    PARTIAL: 0,
    MISS: 0,
    UNCERTAIN: 0
  };

  let candidateSeedCount = 0;
  let falsePositiveCount = 0;
  let falseNegativeCount = 0;

  for (const report of reports) {
    totalByArchetype[report.hiddenReviewerArchetype] += 1;
    totalByStatus[report.recoveryStatus] += 1;

    if (report.reviewCandidate) {
      candidateSeedCount += 1;
    }

    if (
      (report.hiddenReviewerArchetype === 'RANDOM_NOISY_USER' || report.hiddenReviewerArchetype === 'TINA_LIKE_DETACHED_PREDICTOR') &&
      report.recoveryStatus === 'MATCH'
    ) {
      falsePositiveCount += 1;
    }

    if (
      (report.hiddenReviewerArchetype === 'CLEAN_COHORT_MATCH' ||
        report.hiddenReviewerArchetype === 'MISLABELED_USER' ||
        report.hiddenReviewerArchetype === 'INVERSE_RATER') &&
      report.recoveryStatus !== 'MATCH'
    ) {
      falseNegativeCount += 1;
    }
  }

  return {
    totalUsers: reports.length,
    totalByArchetype,
    totalByStatus,
    matchCount: totalByStatus.MATCH,
    partialCount: totalByStatus.PARTIAL,
    missCount: totalByStatus.MISS,
    uncertainCount: totalByStatus.UNCERTAIN,
    candidateSeedCount,
    falsePositiveCount,
    falseNegativeCount
  };
}

function topByScore<T>(items: readonly T[], score: (item: T) => number, limit: number): T[] {
  return items
    .slice()
    .sort((left, right) => score(right) - score(left))
    .slice(0, limit);
}

export function archetypeLabel(archetype: ReviewerArchetype): string {
  return ARCHETYPE_NAMES[archetype];
}

export function analyzeReviewerArchetypes(
  users: readonly User[],
  inferenceByUserId: ReadonlyMap<UserId, InferenceAnalysis>,
  signalProfiles: ReadonlyMap<UserId, RaterSignalProfile>,
  cohorts: readonly CohortAnchor[],
  islands: readonly Island[],
  ratingEvents: readonly ReviewerRatingEventLike[] = [],
  options: ReviewerArchetypeAnalysisOptions = {}
): ReviewerArchetypeAnalysis {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const reports = users.map<ReviewerArchetypeReport>((user) => {
    const inference = inferenceByUserId.get(user.id);
    const signalProfile = signalProfiles.get(user.id);

    const declaredFit = inference?.declaredTop.score ?? 0;
    const behaviorFit = inference?.behaviorTop.score ?? 0;
    const knownCohortFit = Math.max(declaredFit, behaviorFit);
    const broadHitScore = averageRatingForClass(user, islands, ['BROAD_HIT']);
    const nicheScore = averageRatingForClass(user, islands, ['NICHE_COHORT']);
    const dudScore = averageRatingForClass(user, islands, ['BROAD_DUD']);
    const undecidedScore = averageRatingForClass(user, islands, ['UNDECIDED']);
    const guidedTurnBiasValue = guidedTurnBias(ratingEvents, user.id);
    const reportBase = {
      userId: user.id,
      label: user.label,
      hiddenReviewerArchetype: user.hiddenReviewerArchetype ?? 'RANDOM_NOISY_USER',
      hiddenReviewerChecksum: user.hiddenReviewerChecksum ?? '',
      hiddenSeedCohortId: user.hiddenSeedCohortId ?? null,
      hiddenDeclaredCohortId: user.hiddenDeclaredCohortId ?? null,
      hiddenBehaviorCohortId: user.hiddenBehaviorCohortId ?? null,
      inferredDiagnosisType: inference?.diagnosis.type ?? 'AMBIGUOUS',
      inferredCohortId: inference?.behaviorTop.cohortId ?? inference?.declaredTop.cohortId ?? null,
      declaredFit,
      behaviorFit,
      knownCohortFit,
      overallSignal: signalProfile?.overallSignal ?? 0,
      signalEvidence: signalProfile?.signalEvidence ?? 0,
      effectiveSignal: inference?.effectiveSignal ?? 0,
      broadHitScore,
      nicheScore,
      dudScore,
      undecidedScore,
      guidedTurnBias: guidedTurnBiasValue
    };

    const analystFlags = buildAnalystFlags(reportBase, mergedOptions);
    const reviewCandidate =
      analystFlags.includes('candidate-seed') ||
      (reportBase.effectiveSignal >= mergedOptions.highSignalThreshold && reportBase.knownCohortFit <= mergedOptions.minKnownCohortFit) ||
      (reportBase.hiddenReviewerArchetype === 'TINA_LIKE_DETACHED_PREDICTOR' && reportBase.signalEvidence >= mergedOptions.minSignalEvidence);
    const recoveryEvidence = reportBase.signalEvidence;
    const recoveryStatus = matchStatusFromHiddenPattern(
      reportBase.hiddenReviewerArchetype,
      reportBase.inferredDiagnosisType,
      recoveryEvidence,
      reportBase.knownCohortFit,
      analystFlags
    );

    return {
      ...reportBase,
      recoveryStatus,
      analystFlags,
      reviewCandidate
    };
  });

  const highSignalByCohort = cohorts.map<ReviewerArchetypeCohortSummary>((cohort) => ({
    cohortId: cohort.id,
    users: topByScore(
      reports.filter((report) => (signalProfiles.get(report.userId)?.cohortWeights[cohort.id] ?? 0) > 0),
      (report) => signalProfiles.get(report.userId)?.cohortWeights[cohort.id] ?? 0,
      5
    )
  }));

  const weakFitHighSignalUsers = reports.filter(
    (report) => report.effectiveSignal >= mergedOptions.highSignalThreshold && report.knownCohortFit <= mergedOptions.minKnownCohortFit
  );
  const candidateSeedUsers = reports.filter((report) => report.reviewCandidate);
  const earlyScouts = reports.filter((report) => report.analystFlags.includes('early-scout'));
  const popularityChasers = reports.filter((report) => report.analystFlags.includes('popularity-chaser'));
  const noisyUsers = reports.filter(
    (report) =>
      report.hiddenReviewerArchetype === 'RANDOM_NOISY_USER' ||
      (report.inferredDiagnosisType === 'UNKNOWN_OR_NOISY' && report.signalEvidence <= mergedOptions.minSignalEvidence)
  );
  const falsePositives = reports.filter(
    (report) =>
      (report.hiddenReviewerArchetype === 'RANDOM_NOISY_USER' || report.hiddenReviewerArchetype === 'TINA_LIKE_DETACHED_PREDICTOR') &&
      report.recoveryStatus === 'MATCH'
  );
  const falseNegatives = reports.filter(
    (report) =>
      (report.hiddenReviewerArchetype === 'CLEAN_COHORT_MATCH' ||
        report.hiddenReviewerArchetype === 'MISLABELED_USER' ||
        report.hiddenReviewerArchetype === 'INVERSE_RATER') &&
      report.recoveryStatus !== 'MATCH'
  );

  return {
    allReports: reports,
    recoverySummary: buildRecoverySummary(reports),
    highSignalByCohort,
    weakFitHighSignalUsers,
    candidateSeedUsers,
    earlyScouts,
    popularityChasers,
    noisyUsers,
    falsePositives,
    falseNegatives
  };
}
