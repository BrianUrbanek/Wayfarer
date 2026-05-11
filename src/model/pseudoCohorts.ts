import { evidenceFromOverlap, pearsonCorrelation } from './similarity.js';
import { ratingsToVector } from './vectors.js';
import type { InferenceResult } from './inference.js';
import type {
  Island,
  TagId,
  User,
  UserId
} from './types.js';

export type PseudoCohortReportType = 'CONSISTENT_CANDIDATE' | 'INCONSISTENT_TAG_RISK';

export type PseudoCohortAnalystPriority = 'low' | 'medium' | 'high' | 'critical';

export interface PseudoCohortReport {
  key: string;
  tags: TagId[];
  userCount: number;
  internalConsistency: number;
  consistencyEvidence: number;
  averageKnownCohortFit: number;
  averageEffectiveSignal: number;
  reportType: PseudoCohortReportType;
  analystPriority: PseudoCohortAnalystPriority;
  users: UserId[];
}

export interface PseudoCohortAnalysis {
  allReports: PseudoCohortReport[];
  topConsistentPseudoCohorts: PseudoCohortReport[];
  topInconsistentPseudoCohorts: PseudoCohortReport[];
}

export interface PseudoCohortAnalysisOptions {
  minGroupSize?: number;
  minPairwiseOverlap?: number;
  consistentThreshold?: number;
  maxConsistentReports?: number;
  maxInconsistentReports?: number;
}

export type InferenceLookup = ReadonlyMap<UserId, InferenceResult> | Record<UserId, InferenceResult>;

const DEFAULT_OPTIONS: Required<
  Pick<
    PseudoCohortAnalysisOptions,
    'minGroupSize' | 'minPairwiseOverlap' | 'consistentThreshold' | 'maxConsistentReports' | 'maxInconsistentReports'
  >
> = {
  minGroupSize: 3,
  minPairwiseOverlap: 3,
  consistentThreshold: 0.45,
  maxConsistentReports: 5,
  maxInconsistentReports: 5
};

function uniqueSortedTags(tags: readonly TagId[]): TagId[] {
  return Array.from(new Set(tags)).sort();
}

export function tagCombinationKey(tags: readonly TagId[]): string {
  return uniqueSortedTags(tags).join('|');
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function isInferenceLookupMap(
  lookup: InferenceLookup
): lookup is ReadonlyMap<UserId, InferenceResult> {
  return typeof (lookup as ReadonlyMap<UserId, InferenceResult>).get === 'function';
}

function getInference(lookup: InferenceLookup, userId: UserId): InferenceResult | undefined {
  return isInferenceLookupMap(lookup) ? lookup.get(userId) : lookup[userId];
}

function buildIslandAxis(users: readonly User[]): Island[] {
  const islandIds = new Set<string>();

  for (const user of users) {
    for (const islandId of Object.keys(user.ratings)) {
      islandIds.add(islandId);
    }
  }

  return Array.from(islandIds)
    .sort()
    .map((id) => ({ id, label: id }));
}

function computeInternalConsistency(
  users: readonly User[],
  minPairwiseOverlap: number
): { consistency: number; evidence: number } {
  if (users.length < 2) {
    return { consistency: 0, evidence: 0 };
  }

  const ratingAxis = buildIslandAxis(users);
  if (ratingAxis.length === 0) {
    return { consistency: 0, evidence: 0 };
  }

  const vectors = users.map((user) => ratingsToVector(user.ratings, ratingAxis));

  let weightedCorrelation = 0;
  let evidenceSum = 0;
  let validPairCount = 0;

  for (let leftIndex = 0; leftIndex < vectors.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < vectors.length; rightIndex += 1) {
      const pair = pearsonCorrelation(vectors[leftIndex], vectors[rightIndex], minPairwiseOverlap);
      if (pair.evidence <= 0) {
        continue;
      }

      validPairCount += 1;
      weightedCorrelation += pair.value * pair.evidence;
      evidenceSum += pair.evidence;
    }
  }

  if (validPairCount === 0 || evidenceSum <= 0) {
    return { consistency: 0, evidence: 0 };
  }

  const consistency = weightedCorrelation / evidenceSum;
  const pairCoverage = evidenceFromOverlap(validPairCount, Math.max(1, users.length));
  const averagePairEvidence = evidenceSum / validPairCount;
  const evidence = clamp01(pairCoverage * averagePairEvidence);

  return {
    consistency,
    evidence
  };
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageKnownCohortFit(
  users: readonly User[],
  lookup: InferenceLookup
): number {
  return average(
    users.map((user) => {
      const inference = getInference(lookup, user.id);
      if (!inference) {
        return 0;
      }

      return Math.max(inference.declaredTop.score, inference.behaviorTop.score);
    })
  );
}

function averageEffectiveSignal(
  users: readonly User[],
  lookup: InferenceLookup
): number {
  return average(
    users.map((user) => {
      const inference = getInference(lookup, user.id);
      return inference ? inference.effectiveSignal : 0;
    })
  );
}

function priorityFromScore(score: number): PseudoCohortAnalystPriority {
  if (score >= 0.45) {
    return 'critical';
  }

  if (score >= 0.18) {
    return 'high';
  }

  if (score >= 0.08) {
    return 'medium';
  }

  return 'low';
}

function buildReport(
  users: readonly User[],
  lookup: InferenceLookup,
  options: Required<Pick<PseudoCohortAnalysisOptions, 'minPairwiseOverlap' | 'consistentThreshold'>>
): PseudoCohortReport | null {
  if (users.length === 0) {
    return null;
  }

  const tags = uniqueSortedTags(users[0].declaredTags);
  const key = tagCombinationKey(tags);
  const userIds = users.map((user) => user.id);
  const internal = computeInternalConsistency(users, options.minPairwiseOverlap);
  const knownCohortFit = clamp01(averageKnownCohortFit(users, lookup));
  const effectiveSignal = clamp01(averageEffectiveSignal(users, lookup));
  const consistencyScore = clamp01(internal.consistency);
  const evidenceScore = clamp01(internal.evidence);
  const consistentCandidateScore =
    consistencyScore * evidenceScore * (1 - knownCohortFit) * (1 - effectiveSignal * 0.5);
  const inconsistentRiskScore = (1 - consistencyScore) * evidenceScore * (1 - knownCohortFit * 0.5);
  const reportType: PseudoCohortReportType =
    consistencyScore >= options.consistentThreshold && evidenceScore > 0
      ? 'CONSISTENT_CANDIDATE'
      : 'INCONSISTENT_TAG_RISK';
  const analystPriority = priorityFromScore(
    reportType === 'CONSISTENT_CANDIDATE' ? consistentCandidateScore : inconsistentRiskScore
  );

  return {
    key,
    tags,
    userCount: users.length,
    internalConsistency: internal.consistency,
    consistencyEvidence: internal.evidence,
    averageKnownCohortFit: knownCohortFit,
    averageEffectiveSignal: effectiveSignal,
    reportType,
    analystPriority,
    users: userIds
  };
}

function analysisScore(report: PseudoCohortReport): number {
  const consistencyScore = clamp01(report.internalConsistency);
  const evidenceScore = clamp01(report.consistencyEvidence);
  const knownCohortPenalty = 1 - clamp01(report.averageKnownCohortFit);
  const signalPenalty = 1 - clamp01(report.averageEffectiveSignal);

  if (report.reportType === 'CONSISTENT_CANDIDATE') {
    return consistencyScore * evidenceScore * knownCohortPenalty * (1 - report.averageEffectiveSignal * 0.5);
  }

  return (1 - consistencyScore) * evidenceScore * (knownCohortPenalty * 0.5 + signalPenalty * 0.5);
}

function sortReportsDescending(left: PseudoCohortReport, right: PseudoCohortReport): number {
  const scoreDifference = analysisScore(right) - analysisScore(left);
  if (scoreDifference !== 0) {
    return scoreDifference;
  }

  if (right.userCount !== left.userCount) {
    return right.userCount - left.userCount;
  }

  return left.key.localeCompare(right.key);
}

export function analyzePseudoCohorts(
  users: readonly User[],
  lookup: InferenceLookup,
  options: PseudoCohortAnalysisOptions = {}
): PseudoCohortAnalysis {
  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  const groupedUsers = new Map<string, User[]>();

  for (const user of users) {
    const key = tagCombinationKey(user.declaredTags);
    const group = groupedUsers.get(key);

    if (group) {
      group.push(user);
    } else {
      groupedUsers.set(key, [user]);
    }
  }

  const reports = Array.from(groupedUsers.values())
    .filter((group) => group.length >= mergedOptions.minGroupSize)
    .map((group) =>
      buildReport(group, lookup, {
        minPairwiseOverlap: mergedOptions.minPairwiseOverlap,
        consistentThreshold: mergedOptions.consistentThreshold
      })
    )
    .filter((report): report is PseudoCohortReport => report !== null);

  const topConsistentPseudoCohorts = reports
    .filter((report) => report.reportType === 'CONSISTENT_CANDIDATE')
    .sort(sortReportsDescending)
    .slice(0, mergedOptions.maxConsistentReports);

  const topInconsistentPseudoCohorts = reports
    .filter((report) => report.reportType === 'INCONSISTENT_TAG_RISK')
    .sort(sortReportsDescending)
    .slice(0, mergedOptions.maxInconsistentReports);

  return {
    allReports: reports.sort(sortReportsDescending),
    topConsistentPseudoCohorts,
    topInconsistentPseudoCohorts
  };
}
