import type { IslandAffinityReport } from '../model/affinity.js';
import type { InferenceAnalysis } from '../model/inference.js';
import type { RaterSignalProfile } from '../model/raterSignal.js';
import type { IslandId, User } from '../model/types.js';
import type { ActiveRunModelEvidence } from './modelingLab/activeRunModelEvidence.js';

export type LiveEvidenceState = 'canonical' | 'compatibility' | 'degraded';

export interface LiveUserEvidenceRead {
  state: LiveEvidenceState;
  headline: string;
  sourceAuthority: string;
  provenance: string;
  compatibilityNote: string;
  laneSignalSummary: string;
  rdSummary: string;
  volatilitySummary: string;
}

export interface LiveIslandEvidenceRead {
  state: LiveEvidenceState;
  headline: string;
  sourceAuthority: string;
  provenance: string;
  compatibilityNote: string;
  affinitySummary: string;
  rdSummary: string;
  volatilitySummary: string;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function stateLabel(state: LiveEvidenceState): string {
  switch (state) {
    case 'canonical':
      return 'canonical';
    case 'compatibility':
      return 'compatibility/proxy';
    case 'degraded':
      return 'degraded';
  }
}

function hasCanonicalTrace(activeRunEvidence: ActiveRunModelEvidence | null | undefined): boolean {
  return activeRunEvidence?.kind === 'trace';
}

export function buildLiveUserEvidenceRead(input: {
  user: User | null;
  inference: InferenceAnalysis | null;
  signalProfile: RaterSignalProfile | null;
  activeRunEvidence?: ActiveRunModelEvidence | null;
}): LiveUserEvidenceRead {
  const canonicalTrace = hasCanonicalTrace(input.activeRunEvidence);

  if (canonicalTrace) {
    return {
      state: 'canonical',
      headline: 'Modeling-core trace attached for this run',
      sourceAuthority: 'Canonical modeling-core data is available in Modeling Lab, but not projected into this selected-user readout.',
      provenance: 'Use the attached trace for source-class, authority-basis, and projection detail.',
      compatibilityNote: 'This selected-user surface remains a live-app readout, not a trace viewer.',
      laneSignalSummary: input.signalProfile ? `Legacy cohort-similarity proxy remains available at ${formatPercent(input.signalProfile.overallSignal)}` : 'No live signal profile available.',
      rdSummary: 'RD is not exposed by the live selected-user path yet.',
      volatilitySummary: 'Volatility is not exposed by the live selected-user path yet.'
    };
  }

  return {
    state: input.signalProfile ? 'compatibility' : 'degraded',
    headline: input.signalProfile ? 'Compatibility proxy only' : 'No live evidence projection available',
    sourceAuthority: input.signalProfile
      ? `Legacy cohort-similarity proxy remains in use for ${input.user?.label ?? 'this user'}; it is not source authority.`
      : 'No signal profile exists for this user in the current live state.',
    provenance: input.inference
      ? 'Visible ratings and inference are available, but the live app cannot yet surface canonical source-class or projection provenance here.'
      : 'No inference payload is available for this user.',
    compatibilityNote: 'This readout is explicitly a compatibility/degraded bridge, not canonical modeling-core evidence.',
    laneSignalSummary: input.signalProfile ? `Legacy cohort weights exist for ${Object.values(input.signalProfile.cohortWeights).filter((weight: number) => weight > 0).length} cohorts.` : 'No cohort weights available.',
    rdSummary: input.inference ? `Observed rating evidence: ${input.inference.ratingEvidence.toFixed(3)}` : 'No rating evidence available.',
    volatilitySummary: input.inference ? `Behavior specificity: ${input.inference.behaviorSpecificity.toFixed(3)}` : 'No volatility proxy available.'
  };
}

export function buildLiveIslandEvidenceRead(input: {
  islandId: IslandId | null;
  affinityReport: IslandAffinityReport | null;
  activeRunEvidence?: ActiveRunModelEvidence | null;
}): LiveIslandEvidenceRead {
  const canonicalTrace = hasCanonicalTrace(input.activeRunEvidence);

  if (canonicalTrace) {
    return {
      state: 'canonical',
      headline: 'Modeling-core trace attached for this run',
      sourceAuthority: 'Canonical evidence exists in Modeling Lab, but the selected-island view remains a live-app projection surface.',
      provenance: 'Use the trace viewer for source class, authority basis, and supersession detail.',
      compatibilityNote: 'This panel is not a modeling-core trace viewer.',
      affinitySummary: input.affinityReport ? `Legacy affinity report still computes ${input.affinityReport.estimates.length} cohort estimates.` : 'No affinity report available.',
      rdSummary: input.affinityReport ? `Top estimate confidence: ${input.affinityReport.topPositive?.confidence.toFixed(3) ?? 'n/a'}` : 'No RD proxy available.',
      volatilitySummary: input.affinityReport ? `Top estimate volatility: ${input.affinityReport.topPositive?.volatility?.toFixed(3) ?? 'n/a'}` : 'No volatility proxy available.'
    };
  }

  return {
    state: input.affinityReport ? 'compatibility' : 'degraded',
    headline: input.affinityReport ? 'Compatibility proxy only' : 'No live evidence projection available',
    sourceAuthority: input.affinityReport
      ? `Legacy affinity snapshots remain the active live-app read for ${input.islandId ?? 'this island'}; they are not modeling-core source authority.`
      : 'No affinity report exists for this island in the current live state.',
    provenance: input.affinityReport
      ? 'Ratings and observed behavior are visible, but projection provenance is not canonical here.'
      : 'No island affinity evidence is available.',
    compatibilityNote: 'This readout is explicitly a compatibility/degraded bridge, not canonical modeling-core evidence.',
    affinitySummary: input.affinityReport ? `Visible affinity estimates: ${input.affinityReport.estimates.length}` : 'No affinity estimates available.',
    rdSummary: input.affinityReport ? `Top confidence: ${input.affinityReport.topPositive?.confidence.toFixed(3) ?? 'n/a'}` : 'No RD proxy available.',
    volatilitySummary: input.affinityReport ? `Top volatility: ${input.affinityReport.topPositive?.volatility?.toFixed(3) ?? 'n/a'}` : 'No volatility proxy available.'
  };
}

export function liveEvidenceBadgeLabel(state: LiveEvidenceState): string {
  return stateLabel(state);
}
