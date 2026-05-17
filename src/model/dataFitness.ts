import type { TurnMode } from './turnPolicy.js';

export type DataFitnessWarningKind =
  | 'sparse-evidence'
  | 'no-useful-signal'
  | 'routing-unavailable'
  | 'zero-event'
  | 'exhausted';

export interface DataFitnessWarning {
  kind: DataFitnessWarningKind;
  severity: 'info' | 'caution' | 'warning';
  title: string;
  message: string;
  suggestedAction?: string;
}

export interface DataFitnessSummary {
  status: 'ready' | 'caution' | 'not-ready';
  label: 'Ready' | 'Ready with cautions' | 'Not ready';
  warnings: DataFitnessWarning[];
  topWarnings: DataFitnessWarning[];
  extraWarningCount: number;
  leadMessage: string;
}

export interface DataFitnessInput {
  totalUsers: number;
  totalIslands: number;
  ratingEventCount: number;
  averageRatingsPerUser: number;
  usersWithUsableSignal: number;
  averageSignalEvidence: number;
  lastTurnRatingsCreated: number;
  turnMode: TurnMode;
  eligibleRecommendationUsers: number;
  ratedPairCoverage: number;
}

export function buildDataFitnessSummary(input: DataFitnessInput): DataFitnessSummary {
  const warnings: DataFitnessWarning[] = [];

  if (input.ratingEventCount === 0 || input.averageRatingsPerUser < 1) {
    warnings.push({
      kind: 'sparse-evidence',
      severity: 'warning',
      title: 'Sparse evidence',
      message: 'Most users still have too little rating data for stable interpretation.',
      suggestedAction: 'Advance turns before reading summary surfaces as stable.'
    });
  } else if (input.averageRatingsPerUser < 2 || input.averageSignalEvidence < 0.2) {
    warnings.push({
      kind: 'sparse-evidence',
      severity: 'caution',
      title: 'Sparse evidence',
      message: 'Evidence is building, but many reads are still early.',
      suggestedAction: 'Advance more turns for stronger confidence.'
    });
  }

  if (input.usersWithUsableSignal === 0) {
    warnings.push({
      kind: 'no-useful-signal',
      severity: 'warning',
      title: 'No useful reviewer signal yet',
      message: 'Current ratings have not resolved reliable reviewers yet.',
      suggestedAction: 'Advance turns and revisit rater signal once evidence increases.'
    });
  } else if (input.usersWithUsableSignal / Math.max(1, input.totalUsers) < 0.2) {
    warnings.push({
      kind: 'no-useful-signal',
      severity: 'caution',
      title: 'Limited useful reviewer signal',
      message: 'Only a small share of users currently have meaningful usable signal.',
      suggestedAction: 'Use caution when interpreting cohort-level patterns.'
    });
  }

  if ((input.turnMode === 'guided' || input.turnMode === 'mixed') && input.eligibleRecommendationUsers === 0) {
    warnings.push({
      kind: 'routing-unavailable',
      severity: 'caution',
      title: 'Guided routing unavailable',
      message: 'Guided routing has no eligible recommendation users right now.',
      suggestedAction: 'Advance organic evidence or inspect routing floors.'
    });
  }

  if (input.lastTurnRatingsCreated === 0) {
    warnings.push({
      kind: 'zero-event',
      severity: 'warning',
      title: 'Recent turn produced no new rating events',
      message: 'No new events were created in the latest turn.',
      suggestedAction: 'Inspect exhaustion and routing thresholds before interpreting deltas.'
    });
  }

  if (input.ratedPairCoverage > 0.9) {
    warnings.push({
      kind: 'exhausted',
      severity: 'caution',
      title: 'Scenario nearing exhaustion',
      message: 'Most user/island pairs are already rated, so new signal may plateau.',
      suggestedAction: 'Reset or reconfigure scenario when exploration stalls.'
    });
  }

  const hasWarningBlocker = warnings.some((warning) => warning.severity === 'warning');
  const status: DataFitnessSummary['status'] = hasWarningBlocker ? 'not-ready' : warnings.length > 0 ? 'caution' : 'ready';
  const label: DataFitnessSummary['label'] =
    status === 'not-ready' ? 'Not ready' : status === 'caution' ? 'Ready with cautions' : 'Ready';
  const topWarnings = warnings.slice(0, 3);
  const extraWarningCount = Math.max(0, warnings.length - topWarnings.length);
  const leadMessage =
    topWarnings[0]?.title
    ?? 'Data fitness: ready enough for inspection.';

  return {
    status,
    label,
    warnings,
    topWarnings,
    extraWarningCount,
    leadMessage
  };
}
