import type { CohortAnchor, CohortMatch } from '../model/types';

export interface DistributionSlice {
  cohortId: string | null;
  label: string;
  score: number;
}

export interface BehaviorReadSummary {
  tone: 'decisive' | 'moderate' | 'diffuse';
  message: string;
}

export function computeDeclaredTagOverlap(declaredTags: string[], cohort: CohortAnchor | null): {
  overlap: number;
  total: number;
  isExact: boolean;
} {
  if (!cohort) {
    return { overlap: 0, total: 0, isExact: false };
  }
  const declared = new Set(declaredTags);
  const cohortTags = new Set(cohort.tags);
  let overlap = 0;
  for (const tag of declared) {
    if (cohortTags.has(tag)) overlap += 1;
  }
  const total = cohortTags.size;
  const isExact = total > 0 && declared.size === cohortTags.size && overlap === total;
  return { overlap, total, isExact };
}

export function collapseDistributionSlices(
  entries: CohortMatch[],
  labelForCohort: (cohortId: string | null) => string,
  maxSlices = 4
): DistributionSlice[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const take = Math.max(1, maxSlices - 1);
  const top = sorted.slice(0, take);
  const remainder = sorted.slice(take);
  const otherScore = remainder.reduce((sum, entry) => sum + entry.score, 0);
  const slices = top.map((entry) => ({
    cohortId: entry.cohortId,
    label: labelForCohort(entry.cohortId),
    score: entry.score
  }));
  if (otherScore > 0.0001) {
    slices.push({ cohortId: null, label: 'Other', score: otherScore });
  }
  return slices;
}

export function summarizeBehaviorRead(distribution: CohortMatch[], specificity: number): BehaviorReadSummary {
  const sorted = [...distribution].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  const runnerUp = sorted[1]?.score ?? 0;
  const gap = Math.max(0, top - runnerUp);
  const gapPoints = Math.round(gap * 100);
  if (specificity < 0.06 || gap < 0.08) {
    return { tone: 'diffuse', message: `Diffuse behavior read - top cohort leads by ${gapPoints} pts` };
  }
  if (specificity < 0.12 || gap < 0.16) {
    return { tone: 'moderate', message: `Moderate behavior lean - top cohort leads by ${gapPoints} pts` };
  }
  return { tone: 'decisive', message: `Decisive behavior lean - top cohort leads by ${gapPoints} pts` };
}

export function shouldPromoteInverseSignal(inverseTopScore: number, behaviorSpecificity: number): boolean {
  return inverseTopScore >= 0.3 && behaviorSpecificity < 0.12;
}
