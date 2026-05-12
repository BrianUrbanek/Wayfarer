import { useEffect, useMemo, useState } from 'react';
import { Badge } from './ui/components/Badge';
import { Drawer } from './ui/components/Drawer';
import { EmptyState } from './ui/components/EmptyState';
import { MetricCard } from './ui/components/MetricCard';
import { Modal } from './ui/components/Modal';
import { Panel } from './ui/components/Panel';
import { ProgressBar } from './ui/components/ProgressBar';
import { ReportTable, type ReportTableColumn } from './ui/components/ReportTable';
import { SelectionModal, type SelectionOption } from './ui/components/SelectionModal';
import { DistributionList } from './ui/components/DistributionList';
import {
  DASHBOARD_ORDERINGS,
  DASHBOARD_ORDERING_LABELS,
  getUseCaseStory,
  USE_CASE_STORIES,
  type DashboardOrderingPreset,
  type DashboardPanelGroupKey,
  type GuidanceMode,
  type UseCaseStoryId
} from './ui/dashboardGuidance';
import { DEFAULT_TAGS } from './data/defaultTags';
import { createDefaultCohorts } from './data/defaultCohorts';
import { generateColumbusDataset } from './generator/columbusGenerator';
import type { CohortAffinityEstimate } from './model/affinity';
import type { PseudoCohortReport } from './model/pseudoCohorts';
import { archetypeLabel, type ReviewerArchetypeReport } from './model/reviewerArchetypes';
import { recommendIslandsForUser, type IslandRecommendation } from './model/recommendations';
import {
  advanceActiveTurn,
  advancePassiveTurn,
  createInitialSimulationState,
  type SimulationState
} from './model/simulation';
import type { CohortAnchor, Island, User } from './model/types';

const INITIAL_CONFIG = {
  seed: 48291,
  numUsers: 48,
  numIslands: 18
};

type SelectionModalKind = 'user' | 'island' | 'cohort' | 'pseudo' | null;

type DrawerState =
  | { type: 'user'; id: string }
  | { type: 'island'; id: string }
  | { type: 'pseudo'; key: string }
  | { type: 'reviewer'; userId: string }
  | { type: 'recommendation'; userId: string; islandId: string }
  | { type: 'affinity'; islandId: string; cohortId: string }
  | null;

type TurnMode = 'passive' | 'active';

function buildDataset(seed: number, numUsers: number, numIslands: number) {
  return generateColumbusDataset({
    seed,
    numUsers,
    numIslands,
    cohorts: createDefaultCohorts(),
    allTags: DEFAULT_TAGS,
    tagAlignmentDistribution: { kind: 'uniform', min: 2, max: 10 },
    ratingAlignmentDistribution: { kind: 'uniform', min: 2, max: 10 }
  });
}

function labelForCohortFactory(cohorts: CohortAnchor[]) {
  const labels = new Map(cohorts.map((cohort) => [cohort.id, cohort.label]));

  return (cohortId: string | null) => {
    if (cohortId === null) {
      return 'none';
    }

    return labels.get(cohortId) ?? cohortId;
  };
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDecimal(value: number, digits = 3): string {
  return value.toFixed(digits);
}

function formatSignedDecimal(value: number, digits = 3): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

function formatRating(value: string | number | null): string {
  if (value === null || value === undefined) {
    return 'Unrated';
  }

  return String(value);
}

function diagnosisTone(type: string): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  switch (type) {
    case 'HIGH_SIGNAL':
      return 'success';
    case 'MISMATCH_RETAG':
      return 'warning';
    case 'INVERSE_PROFILE':
      return 'danger';
    case 'UNKNOWN_OR_NOISY':
      return 'neutral';
    case 'LOW_SIGNAL':
      return 'warning';
    default:
      return 'neutral';
  }
}

function comparisonLabel(user: User | null, selectedCohort: CohortAnchor | null, cohortLabel: (id: string | null) => string) {
  if (selectedCohort) {
    return selectedCohort.label;
  }

  if (user) {
    return cohortLabel(user.hiddenSeedCohortId ?? null);
  }

  return 'none';
}

function countNonNullRatings(user: User): number {
  return Object.values(user.ratings).filter((value) => value !== null).length;
}

function compareByNumeric(left: number, right: number): number {
  return right - left;
}

function computeExactMatchRate(user: User, cohort: CohortAnchor, islandIds: string[]) {
  let matches = 0;
  let rated = 0;

  for (const islandId of islandIds) {
    const userRating = user.ratings[islandId] ?? null;
    const cohortRating = cohort.ratings[islandId] ?? null;

    if (userRating === null || cohortRating === null) {
      continue;
    }

    rated += 1;
    if (userRating === cohortRating) {
      matches += 1;
    }
  }

  return {
    matches,
    rated,
    rate: rated > 0 ? matches / rated : 0
  };
}

function buildPopulationSummary(datasetUserCount: number, totalUsers: number, inferenceTypes: Map<string, string>, pseudoReports: number) {
  let highSignal = 0;
  let retagCandidates = 0;
  let inverseProfiles = 0;
  let noisyUsers = 0;

  inferenceTypes.forEach((type) => {
    if (type === 'HIGH_SIGNAL') {
      highSignal += 1;
    } else if (type === 'MISMATCH_RETAG') {
      retagCandidates += 1;
    } else if (type === 'INVERSE_PROFILE') {
      inverseProfiles += 1;
    } else if (type === 'UNKNOWN_OR_NOISY' || type === 'AMBIGUOUS' || type === 'LOW_SIGNAL') {
      noisyUsers += 1;
    }
  });

  return {
    totalUsers,
    generatedUsers: datasetUserCount,
    highSignal,
    retagCandidates,
    inverseProfiles,
    noisyUsers,
    pseudoReports
  };
}

function pseudoPriorityTone(priority: PseudoCohortReport['analystPriority']) {
  switch (priority) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'warning';
    case 'medium':
      return 'accent';
    default:
      return 'neutral';
  }
}

function reviewerRecoveryTone(status: string) {
  switch (status) {
    case 'MATCH':
      return 'success';
    case 'PARTIAL':
      return 'accent';
    case 'MISS':
      return 'danger';
    case 'UNCERTAIN':
      return 'warning';
    default:
      return 'neutral';
  }
}

export default function App() {
  const [seed, setSeed] = useState(INITIAL_CONFIG.seed);
  const [numUsers, setNumUsers] = useState(INITIAL_CONFIG.numUsers);
  const [numIslands, setNumIslands] = useState(INITIAL_CONFIG.numIslands);
  const [initialRatingsPerUser, setInitialRatingsPerUser] = useState(4);
  const [activeUsersPerTurn, setActiveUsersPerTurn] = useState(6);
  const [maxRatingsPerActiveUser, setMaxRatingsPerActiveUser] = useState(3);
  const [turnMode, setTurnMode] = useState<TurnMode>('passive');
  const [explorationWeight, setExplorationWeight] = useState(0.55);
  const [minPredictedFitFloor, setMinPredictedFitFloor] = useState(0.2);
  const [routedIslandsPerActiveUser, setRoutedIslandsPerActiveUser] = useState(2);
  const [turnBatchCount, setTurnBatchCount] = useState(5);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedIslandId, setSelectedIslandId] = useState<string>('');
  const [comparisonCohortId, setComparisonCohortId] = useState<string>('auto');
  const [showDebug, setShowDebug] = useState(true);
  const [showAbout, setShowAbout] = useState(false);
  const [guidanceMode, setGuidanceMode] = useState<GuidanceMode>('novice');
  const [guidanceOpen, setGuidanceOpen] = useState(true);
  const [dashboardOrdering, setDashboardOrdering] = useState<DashboardOrderingPreset>('overview-first');
  const [useCaseId, setUseCaseId] = useState<UseCaseStoryId>('first-time-walkthrough');
  const [modalKind, setModalKind] = useState<SelectionModalKind>(null);
  const [drawerState, setDrawerState] = useState<DrawerState>(null);

  const latentDataset = useMemo(() => buildDataset(seed, numUsers, numIslands), [seed, numUsers, numIslands]);

  const initialSimulationState = useMemo(
    () =>
      createInitialSimulationState({
        seed,
        allTags: latentDataset.allTags,
        latentUsers: latentDataset.users,
        cohorts: latentDataset.cohorts,
        islands: latentDataset.islands,
        initialRatingsPerUser
      }),
    [initialRatingsPerUser, latentDataset, seed]
  );

  const [simulationState, setSimulationState] = useState<SimulationState>(initialSimulationState);

  useEffect(() => {
    setSimulationState(initialSimulationState);
  }, [initialSimulationState]);

  useEffect(() => {
    setGuidanceOpen(guidanceMode === 'novice');
  }, [guidanceMode]);

  const dataset = simulationState;
  const labelForCohort = useMemo(() => labelForCohortFactory(dataset.cohorts), [dataset.cohorts]);

  useEffect(() => {
    if (!dataset.users.length) {
      setSelectedUserId('');
      return;
    }

    if (!dataset.users.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(dataset.users[0].id);
    }
  }, [dataset.users, selectedUserId]);

  useEffect(() => {
    if (!dataset.islands.length) {
      setSelectedIslandId('');
      return;
    }

    if (!dataset.islands.some((island) => island.id === selectedIslandId)) {
      setSelectedIslandId(dataset.islands[0].id);
    }
  }, [dataset.islands, selectedIslandId]);

  const selectedUser = useMemo(() => {
    return dataset.users.find((user) => user.id === selectedUserId) ?? dataset.users[0] ?? null;
  }, [dataset.users, selectedUserId]);

  const selectedIsland = useMemo(() => {
    return dataset.islands.find((island) => island.id === selectedIslandId) ?? dataset.islands[0] ?? null;
  }, [dataset.islands, selectedIslandId]);

  const selectedInference = selectedUser ? dataset.inferenceByUserId.get(selectedUser.id) : undefined;

  const selectedComparisonCohort = useMemo(() => {
    if (comparisonCohortId !== 'auto') {
      return dataset.cohorts.find((cohort) => cohort.id === comparisonCohortId) ?? null;
    }

    return (
      dataset.cohorts.find((cohort) => cohort.id === selectedInference?.behaviorTop.cohortId) ??
      dataset.cohorts.find((cohort) => cohort.id === selectedInference?.declaredTop.cohortId) ??
      dataset.cohorts[0] ??
      null
    );
  }, [comparisonCohortId, dataset.cohorts, selectedInference]);

  const selectedComparisonLabel = comparisonLabel(selectedUser, selectedComparisonCohort, labelForCohort);
  const selectedRaterSignalProfile = selectedUser ? dataset.raterSignalProfiles.get(selectedUser.id) ?? null : null;
  const selectedIslandAffinityReport = selectedIsland ? dataset.islandAffinityReports.get(selectedIsland.id) ?? null : null;
  const selectedIslandRatingCount = selectedIslandAffinityReport?.estimates[0]?.rawCount ?? 0;
  const selectedIslandEffectiveWeight =
    selectedIslandAffinityReport?.topPositive?.effectiveWeight ??
    selectedIslandAffinityReport?.topNegative?.effectiveWeight ??
    selectedIslandAffinityReport?.estimates[0]?.effectiveWeight ??
    0;
  const selectedIslandPositiveAffinity = selectedIslandAffinityReport?.topPositive?.affinity ?? 0;
  const selectedIslandNegativeAffinity = selectedIslandAffinityReport?.topNegative?.affinity ?? 0;

  const inferenceTypes = useMemo(() => {
    return new Map(
      dataset.users.map((user) => [user.id, dataset.inferenceByUserId.get(user.id)?.diagnosis.type ?? 'AMBIGUOUS'])
    );
  }, [dataset.inferenceByUserId, dataset.users]);

  const populationSummary = useMemo(
    () =>
      buildPopulationSummary(
        dataset.users.length,
        dataset.users.length,
        inferenceTypes,
        dataset.pseudoCohortAnalysis.allReports.length
      ),
    [dataset.users.length, inferenceTypes, dataset.pseudoCohortAnalysis.allReports.length]
  );

  const selectedInferenceDiagnostics = selectedInference?.diagnosis;
  const routingOptions = useMemo(
    () => ({
      explorationWeight,
      minPredictedFitFloor,
      topLimit: Math.max(8, routedIslandsPerActiveUser * 2)
    }),
    [explorationWeight, minPredictedFitFloor, routedIslandsPerActiveUser]
  );

  const selectedUserRecommendations = useMemo(() => {
    if (!selectedUser) {
      return [] as IslandRecommendation[];
    }

    return recommendIslandsForUser(
      selectedUser,
      dataset.islandAffinityReports,
      dataset.raterSignalProfiles,
      dataset.islands,
      routingOptions
    ).recommendations;
  }, [dataset.islandAffinityReports, dataset.islands, dataset.raterSignalProfiles, routingOptions, selectedUser]);

  const selectedRecommendationDetail =
    drawerState?.type === 'recommendation' && selectedUser
      ? selectedUserRecommendations.find((recommendation) => recommendation.islandId === drawerState.islandId) ?? null
      : null;

  const currentTurnSummary = dataset.turnHistory[dataset.turnHistory.length - 1] ?? null;
  const reviewerArchetypeAnalysis = dataset.reviewerArchetypeAnalysis;
  const selectedUserRatings = selectedUser ? countNonNullRatings(selectedUser) : 0;
  const selectedUserTopCohorts = selectedInference
    ? [
        {
          label: 'Declared',
          match: selectedInference.declaredTop
        },
        {
          label: 'Behavior',
          match: selectedInference.behaviorTop
        },
        {
          label: 'Inverse',
          match: selectedInference.inverseTop
        }
      ]
    : [];

  const signalRows = useMemo(() => {
    if (!selectedRaterSignalProfile) {
      return [];
    }

    return dataset.cohorts
      .map((cohort) => ({
        cohort,
        weight: selectedRaterSignalProfile.cohortWeights[cohort.id] ?? 0,
        evidence: selectedRaterSignalProfile.cohortEvidence[cohort.id] ?? 0,
        similarity: selectedRaterSignalProfile.cohortSimilarities[cohort.id] ?? {
          value: 0,
          evidence: 0,
          overlapCount: 0
        }
      }))
      .sort((left, right) => compareByNumeric(left.weight, right.weight));
  }, [dataset.cohorts, selectedRaterSignalProfile]);

  const affinityRows = useMemo(() => {
    if (!selectedIslandAffinityReport) {
      return [];
    }

    return selectedIslandAffinityReport.estimates
      .map((estimate) => ({
        cohort: dataset.cohorts.find((entry) => entry.id === estimate.cohortId) ?? null,
        estimate
      }))
      .filter((row): row is { cohort: CohortAnchor; estimate: CohortAffinityEstimate } => row.cohort !== null)
      .sort((left, right) => compareByNumeric(left.estimate.affinity, right.estimate.affinity));
  }, [dataset.cohorts, selectedIslandAffinityReport]);

  const selectedAffinityDetail =
    drawerState?.type === 'affinity'
      ? dataset.islandAffinityReports.get(drawerState.islandId)?.estimates.find((estimate) => estimate.cohortId === drawerState.cohortId) ??
        null
      : null;

  const selectedIslandRows = useMemo(() => {
    return dataset.cohorts.map((cohort) => ({
      cohort,
      rating: selectedIsland ? cohort.ratings[selectedIsland.id] ?? null : null
    }));
  }, [dataset.cohorts, selectedIsland]);

  const selectedComparisonUserRating = selectedUser && selectedIsland
    ? selectedUser.ratings[selectedIsland.id] ?? null
    : null;

  const selectedComparisonCohortRating = selectedComparisonCohort && selectedIsland
    ? selectedComparisonCohort.ratings[selectedIsland.id] ?? null
    : null;

  const exactMatchRate =
    selectedUser && selectedComparisonCohort
      ? computeExactMatchRate(
          selectedUser,
          selectedComparisonCohort,
          dataset.islands.map((island) => island.id)
        )
      : null;

  const behaviorIsNonInformative =
    selectedInference !== undefined &&
    selectedInference.behaviorMatchStrength < 0.35 &&
    selectedInference.behaviorSpecificity < 0.06;

  const selectedStory = useMemo(() => getUseCaseStory(useCaseId), [useCaseId]);
  const orderedDashboardSections = useMemo(() => DASHBOARD_ORDERINGS[dashboardOrdering], [dashboardOrdering]);
  const visibleDashboardSections = orderedDashboardSections;
  const appStatus = `Turn ${dataset.currentTurn} · ${turnMode === 'active' ? 'Active discovery' : 'Passive random'} · ${dataset.users.length} users · ${dataset.islands.length} islands`;

  const selectedUserOptions = useMemo<SelectionOption[]>(() => {
    return dataset.users.map((user) => {
      const inference = dataset.inferenceByUserId.get(user.id);
      const tags = user.declaredTags.slice(0, 3).join(' · ');

      return {
        id: user.id,
        label: user.label,
        description: tags,
        badge: inference?.diagnosis.type ?? 'unknown'
      };
    });
  }, [dataset.inferenceByUserId, dataset.users]);

  const selectedIslandOptions = useMemo<SelectionOption[]>(() => {
    return dataset.islands.map((island) => {
      return {
        id: island.id,
        label: island.label,
        description: `Rated by ${dataset.cohorts.length} seeded anchors`,
        badge: island.hiddenClass ?? 'island'
      };
    });
  }, [dataset.cohorts.length, dataset.islands]);

  const comparisonCohortOptions = useMemo<SelectionOption[]>(() => {
    return [
      {
        id: 'auto',
        label: 'Behavior top (auto)',
        description: "Use the current user's strongest behavioral match."
      },
      ...dataset.cohorts.map((cohort) => ({
        id: cohort.id,
        label: cohort.label,
        description: cohort.tags.join(' · '),
        badge: cohort.source
      }))
    ];
  }, [dataset.cohorts]);

  const pseudoReportOptions = useMemo<SelectionOption[]>(() => {
    return dataset.pseudoCohortAnalysis.allReports.map((report) => ({
      id: report.key,
      label: report.tags.join(' | '),
      description: `${report.userCount} users · ${report.reportType}`,
      badge: report.analystPriority
    }));
  }, [dataset.pseudoCohortAnalysis.allReports]);

  const reviewerReportRows = reviewerArchetypeAnalysis.allReports;
  const reviewerCohortRows = useMemo(
    () =>
      reviewerArchetypeAnalysis.highSignalByCohort.map((entry) => ({
        cohort: dataset.cohorts.find((cohort) => cohort.id === entry.cohortId) ?? null,
        users: entry.users,
        topUser: entry.users[0] ?? null
      })),
    [dataset.cohorts, reviewerArchetypeAnalysis.highSignalByCohort]
  );

  const reportColumns: ReportTableColumn<PseudoCohortReport>[] = [
    {
      key: 'tags',
      label: 'Tag combo',
      render: (report) => report.tags.join(' | ')
    },
    {
      key: 'users',
      label: 'Users',
      render: (report) => report.userCount,
      align: 'right'
    },
    {
      key: 'consistency',
      label: 'Consistency',
      render: (report) => <ProgressBar value={Math.max(0, report.internalConsistency)} />
    },
    {
      key: 'fit',
      label: 'Known fit',
      render: (report) => formatPercent(report.averageKnownCohortFit),
      align: 'right'
    },
    {
      key: 'signal',
      label: 'Effective signal',
      render: (report) => formatPercent(report.averageEffectiveSignal),
      align: 'right'
    },
    {
      key: 'priority',
      label: 'Priority',
      render: (report) => <Badge tone={pseudoPriorityTone(report.analystPriority)}>{report.analystPriority}</Badge>,
      align: 'center'
    }
  ];

  const signalColumns: ReportTableColumn<{
    cohort: CohortAnchor;
    weight: number;
    evidence: number;
    similarity: {
      value: number;
      evidence: number;
      overlapCount: number;
    };
  }>[] = [
    {
      key: 'cohort',
      label: 'Cohort',
      render: (row) => (
        <div className="table-cell-stack">
          <strong>{row.cohort.label}</strong>
          <span className="muted">{row.cohort.tags.join(' | ')}</span>
        </div>
      )
    },
    {
      key: 'weight',
      label: 'Signal',
      render: (row) => <ProgressBar value={row.weight} label={formatSignedDecimal(row.weight)} tone="accent" />
    },
    {
      key: 'evidence',
      label: 'Evidence',
      render: (row) => formatPercent(row.evidence),
      align: 'right'
    },
    {
      key: 'similarity',
      label: 'Similarity',
      render: (row) => formatSignedDecimal(row.similarity.value),
      align: 'right'
    },
    {
      key: 'overlap',
      label: 'Overlap',
      render: (row) => row.similarity.overlapCount,
      align: 'right'
    }
  ];

  const affinityColumns: ReportTableColumn<{
    cohort: CohortAnchor;
    estimate: CohortAffinityEstimate;
  }>[] = [
    {
      key: 'cohort',
      label: 'Cohort',
      render: (row) => (
        <div className="table-cell-stack">
          <strong>{row.cohort.label}</strong>
          <span className="muted">{row.cohort.tags.join(' | ')}</span>
        </div>
      )
    },
    {
      key: 'affinity',
      label: 'Affinity',
      render: (row) => <ProgressBar value={(row.estimate.affinity + 1) / 2} label={formatSignedDecimal(row.estimate.affinity)} tone={row.estimate.affinity >= 0 ? 'success' : 'danger'} />
    },
    {
      key: 'confidence',
      label: 'Confidence',
      render: (row) => formatPercent(row.estimate.confidence),
      align: 'right'
    },
    {
      key: 'evidence',
      label: 'Evidence',
      render: (row) => formatDecimal(row.estimate.effectiveWeight),
      align: 'right'
    },
    {
      key: 'ratings',
      label: 'Ratings',
      render: (row) => row.estimate.rawCount,
      align: 'right'
    }
  ];

  const reviewerReportColumns: ReportTableColumn<ReviewerArchetypeReport>[] = [
    {
      key: 'user',
      label: 'User',
      render: (row) => (
        <div className="table-cell-stack">
          <strong>{row.label}</strong>
          <span className="muted">{row.userId}</span>
        </div>
      )
    },
    {
      key: 'hidden',
      label: 'Hidden archetype',
      render: (row) => (
        <div className="table-cell-stack">
          <Badge tone="neutral">{archetypeLabel(row.hiddenReviewerArchetype)}</Badge>
          <span className="muted">Debug checksum: {row.hiddenReviewerChecksum}</span>
        </div>
      )
    },
    {
      key: 'diagnosis',
      label: 'Inferred behavior',
      render: (row) => (
        <div className="table-cell-stack">
          <Badge tone={diagnosisTone(row.inferredDiagnosisType)}>{row.inferredDiagnosisType}</Badge>
          <span className="muted">{row.inferredCohortId ? labelForCohort(row.inferredCohortId) : 'none'}</span>
        </div>
      )
    },
    {
      key: 'recovery',
      label: 'Recovery',
      render: (row) => <Badge tone={reviewerRecoveryTone(row.recoveryStatus)}>{row.recoveryStatus}</Badge>,
      align: 'center'
    },
    {
      key: 'knownFit',
      label: 'Known fit',
      render: (row) => formatPercent(row.knownCohortFit),
      align: 'right'
    },
    {
      key: 'signalEvidence',
      label: 'Evidence',
      render: (row) => formatPercent(row.signalEvidence),
      align: 'right'
    },
    {
      key: 'effectiveSignal',
      label: 'Usable signal',
      render: (row) => formatDecimal(row.effectiveSignal),
      align: 'right'
    },
    {
      key: 'flags',
      label: 'Flags',
      render: (row) => row.analystFlags.slice(0, 3).join(' · ')
    }
  ];

  const reviewerCohortColumns: ReportTableColumn<{
    cohort: CohortAnchor | null;
    users: ReviewerArchetypeReport[];
    topUser: ReviewerArchetypeReport | null;
  }>[] = [
    {
      key: 'cohort',
      label: 'Cohort',
      render: (row) => row.cohort?.label ?? 'none'
    },
    {
      key: 'topUser',
      label: 'Top user',
      render: (row) => row.topUser?.label ?? 'none'
    },
    {
      key: 'count',
      label: 'Users',
      render: (row) => row.users.length,
      align: 'right'
    },
    {
      key: 'signal',
      label: 'Top signal',
      render: (row) => formatDecimal(row.topUser?.effectiveSignal ?? 0),
      align: 'right'
    },
    {
      key: 'status',
      label: 'Recovery',
      render: (row) => <Badge tone={reviewerRecoveryTone(row.topUser?.recoveryStatus ?? 'UNCERTAIN')}>{row.topUser?.recoveryStatus ?? 'UNCERTAIN'}</Badge>,
      align: 'center'
    }
  ];

  const recommendationColumns: ReportTableColumn<IslandRecommendation>[] = [
    {
      key: 'island',
      label: 'Island',
      render: (row) => (
        <div className="table-cell-stack">
          <strong>{dataset.islands.find((island) => island.id === row.islandId)?.label ?? row.islandId}</strong>
          <span className="muted">{row.explanation}</span>
        </div>
      )
    },
    {
      key: 'kind',
      label: 'Kind',
      render: (row) => <Badge tone={row.recommendationKind === 'SAFE_FIT' ? 'success' : 'warning'}>{row.recommendationKind === 'SAFE_FIT' ? 'Safe fit' : 'Discovery probe'}</Badge>,
      align: 'center'
    },
    {
      key: 'fit',
      label: 'Predicted fit',
      render: (row) => <ProgressBar value={(row.predictedFit + 1) / 2} label={formatSignedDecimal(row.predictedFit)} tone={row.predictedFit >= 0 ? 'success' : 'danger'} />
    },
    {
      key: 'support',
      label: 'Support',
      render: (row) => formatPercent(row.affinitySupport),
      align: 'right'
    },
    {
      key: 'discovery',
      label: 'Discovery',
      render: (row) => formatPercent(row.discoveryValue),
      align: 'right'
    },
    {
      key: 'score',
      label: 'Score',
      render: (row) => formatDecimal(row.recommendationScore),
      align: 'right'
    }
  ];

  const selectedReviewerReport = drawerState?.type === 'reviewer'
    ? reviewerReportRows.find((report) => report.userId === drawerState.userId) ?? null
    : null;

  const selectedUserReviewerReport = selectedUser
    ? reviewerReportRows.find((report) => report.userId === selectedUser.id) ?? null
    : null;

  const reviewerArchetypeSummary = (
    <div className="stack">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Reviewer archetype recovery</p>
          <h3>Hidden generator checksums vs inferred behavior</h3>
        </div>
        <p className="muted">
          Debug-only labels are used to evaluate whether the visible model recovers the intended synthetic pattern
          when the evidence is there, and stays unsure when it is not.
        </p>
      </div>

      <div className="metric-grid metric-grid--compact">
        <MetricCard label="Generated archetypes" value={reviewerArchetypeAnalysis.recoverySummary.totalUsers} tone="accent" />
        <MetricCard label="Matches" value={reviewerArchetypeAnalysis.recoverySummary.matchCount} tone="success" />
        <MetricCard label="Partial" value={reviewerArchetypeAnalysis.recoverySummary.partialCount} tone="accent" />
        <MetricCard label="Misses" value={reviewerArchetypeAnalysis.recoverySummary.missCount} tone="danger" />
        <MetricCard label="Uncertain" value={reviewerArchetypeAnalysis.recoverySummary.uncertainCount} tone="warning" />
        <MetricCard label="Candidate review" value={reviewerArchetypeAnalysis.recoverySummary.candidateSeedCount} tone="accent" />
        <MetricCard label="False positives" value={reviewerArchetypeAnalysis.recoverySummary.falsePositiveCount} tone="danger" />
        <MetricCard label="False negatives" value={reviewerArchetypeAnalysis.recoverySummary.falseNegativeCount} tone="warning" />
      </div>

      <div className="report-section">
        <div className="report-section__column">
          <div className="section-heading">
            <h3>High Signal by Cohort</h3>
            <p>Top signal users grouped by their strongest cohort fit.</p>
          </div>
          <ReportTable
            columns={reviewerCohortColumns}
            rows={reviewerCohortRows.filter((row): row is { cohort: CohortAnchor; users: ReviewerArchetypeReport[]; topUser: ReviewerArchetypeReport } => row.cohort !== null && row.topUser !== null)}
            getRowKey={(row) => row.cohort.id}
            onRowClick={(row) => setDrawerState({ type: 'reviewer', userId: row.topUser.userId })}
            emptyTitle="No high-signal users"
            emptyDescription="Take more turns so the visible model can accumulate cohort-local signal."
          />
        </div>

        <div className="report-section__column">
          <div className="section-heading">
            <h3>Candidate New Seed Users / Unexplained High-Signal Users</h3>
            <p>High-value reviewers that do not fit known cohorts cleanly and should stay analyst-review only.</p>
          </div>
          <ReportTable
            columns={reviewerReportColumns}
            rows={reviewerArchetypeAnalysis.candidateSeedUsers}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => setDrawerState({ type: 'reviewer', userId: row.userId })}
            emptyTitle="No analyst candidates"
            emptyDescription="This panel fills when the system finds strong signal but weak known-cohort fit."
          />

          <div className="section-heading">
            <h3>High Signal, Weak Known Fit</h3>
            <p>Users the model trusts, but only loosely explains with current cohort labels.</p>
          </div>
          <ReportTable
            columns={reviewerReportColumns}
            rows={reviewerArchetypeAnalysis.weakFitHighSignalUsers}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => setDrawerState({ type: 'reviewer', userId: row.userId })}
            emptyTitle="No weak-fit high-signal users"
            emptyDescription="This list fills when a user has strong signal but poor known-cohort fit."
          />
        </div>
      </div>

      <div className="report-section">
        <div className="report-section__column">
          <div className="section-heading">
            <h3>Early Scouts</h3>
            <p>Users whose active routing bias lands early in the turn history.</p>
          </div>
          <ReportTable
            columns={reviewerReportColumns}
            rows={reviewerArchetypeAnalysis.earlyScouts}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => setDrawerState({ type: 'reviewer', userId: row.userId })}
            emptyTitle="No early scouts"
            emptyDescription="Active turn timing has not yet produced any early-scout patterns."
          />
        </div>

        <div className="report-section__column">
          <div className="section-heading">
            <h3>Popularity Chasers and Noise</h3>
            <p>Broad-hit followers, noisy users, and low-evidence mismatches.</p>
          </div>
          <ReportTable
            columns={reviewerReportColumns}
            rows={[
              ...reviewerArchetypeAnalysis.popularityChasers,
              ...reviewerArchetypeAnalysis.noisyUsers
            ]}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => setDrawerState({ type: 'reviewer', userId: row.userId })}
            emptyTitle="No popularity chasers or noisy users"
            emptyDescription="The current sample has not produced any obvious broad-hit followers or random noise."
          />
        </div>
      </div>

      <div className="report-section">
        <div className="report-section__column">
          <div className="section-heading">
            <h3>False Positives</h3>
            <p>Hidden noise or detached predictors that the model may be reading as meaningful signal.</p>
          </div>
          <ReportTable
            columns={reviewerReportColumns}
            rows={reviewerArchetypeAnalysis.falsePositives}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => setDrawerState({ type: 'reviewer', userId: row.userId })}
            emptyTitle="No false positives"
            emptyDescription="The visible model has not over-classified any noisy or detached users yet."
          />
        </div>

        <div className="report-section__column">
          <div className="section-heading">
            <h3>False Negatives</h3>
            <p>Hidden clean matches, mislabeled users, or inverse raters the model failed to recover.</p>
          </div>
          <ReportTable
            columns={reviewerReportColumns}
            rows={reviewerArchetypeAnalysis.falseNegatives}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => setDrawerState({ type: 'reviewer', userId: row.userId })}
            emptyTitle="No false negatives"
            emptyDescription="The current synthetic sample has not produced any misses worth flagging."
          />
        </div>
      </div>
    </div>
  );

  const selectedUserSummary = selectedInference ? (
    <div className="stack">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Selected user</p>
          <h3>{selectedUser?.label ?? 'None'}</h3>
        </div>
        <div className="summary-header__actions">
          <button type="button" className="button button--ghost" onClick={() => setDrawerState(selectedUser ? { type: 'user', id: selectedUser.id } : null)}>
            Open detail
          </button>
          <button type="button" className="button button--ghost" onClick={() => setModalKind('user')}>
            Select user
          </button>
        </div>
      </div>

      <div className="badge-row">
        {(selectedUser?.declaredTags ?? []).map((tag) => (
          <Badge key={tag} tone="accent">
            {tag}
          </Badge>
        ))}
      </div>

      <div className="metric-grid">
        <MetricCard
          label="Identity/Behavior Fit"
          value={selectedInference.signalFit.toFixed(3)}
          helper="Do this player's declared tags and observed ratings point toward the same cohort pattern?"
          tone="accent"
        />
        <MetricCard
          label="Rating Evidence"
          value={selectedInference.ratingEvidence.toFixed(3)}
          helper="How much sparse rating data supports this judgment?"
          tone="neutral"
        />
        <MetricCard
          label="Usable Signal"
          value={selectedInference.effectiveSignal.toFixed(3)}
          helper="How much weight the system should currently give this player's ratings."
          tone="success"
        />
      </div>

      <div className="metric-grid metric-grid--compact">
        <MetricCard
          label="Behavior match strength"
          value={selectedInference.behaviorMatchStrength.toFixed(3)}
          helper="Strongest raw positive cohort fit before the distribution is normalized."
        />
        <MetricCard
          label="Behavior specificity"
          value={selectedInference.behaviorSpecificity.toFixed(3)}
          helper="How much the behavior distribution prefers one cohort over the runner-up."
        />
      </div>

      <div className="summary-top-cohorts">
        {selectedUserTopCohorts.map(({ label, match }) => (
          <MetricCard
            key={label}
            label={`${label} top cohort`}
            value={labelForCohort(match.cohortId)}
            helper={`${formatPercent(match.score)} match`}
            tone="neutral"
          />
        ))}
      </div>

      <section className="detail-block">
        <div className="section-heading">
          <h4>Rater signal profile</h4>
          <p>Cohort-local signal only. No tag-level trust weights are calculated here.</p>
        </div>
        <div className="metric-grid metric-grid--compact">
          <MetricCard
            label="Overall signal"
            value={formatDecimal(selectedRaterSignalProfile?.overallSignal ?? 0)}
            helper="Strongest cohort-local signal score."
            tone="accent"
          />
          <MetricCard
            label="Signal evidence"
            value={formatPercent(selectedRaterSignalProfile?.signalEvidence ?? 0)}
            helper="Evidence supporting the strongest positive cohort signal."
          />
          <MetricCard
            label="Top cohort"
            value={labelForCohort(selectedRaterSignalProfile?.topCohortId ?? null)}
            helper="The cohort with the strongest visible behavioral signal."
            tone="success"
          />
        </div>
        <ReportTable
          columns={signalColumns}
          rows={signalRows}
          getRowKey={(row) => row.cohort.id}
          emptyTitle="No signal profile"
          emptyDescription="This user has not yet accumulated enough overlap to form cohort-local signal."
        />
      </section>

      <div className="summary-inline">
        <Badge tone={diagnosisTone(selectedInferenceDiagnostics?.type ?? 'AMBIGUOUS')}>
          {selectedInferenceDiagnostics?.type ?? 'AMBIGUOUS'}
        </Badge>
        <span className="muted">{selectedInferenceDiagnostics?.message}</span>
      </div>
    </div>
  ) : null;

  const discoveryRoutingSummary = selectedUser ? (
    <div className="stack">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Discovery routing</p>
          <h3>Recommended unrated islands</h3>
        </div>
        <div className="summary-header__actions">
          <button
            type="button"
            className="button button--ghost"
            onClick={() =>
              setDrawerState(
                selectedUserRecommendations[0]
                  ? {
                      type: 'recommendation',
                      userId: selectedUser.id,
                      islandId: selectedUserRecommendations[0].islandId
                    }
                  : null
              )
            }
          >
            Open top recommendation
          </button>
          <button type="button" className="button button--ghost" onClick={() => setModalKind('user')}>
            Select user
          </button>
        </div>
      </div>

      <div className="metric-grid metric-grid--compact">
        <MetricCard
          label="Turn mode"
          value={turnMode === 'active' ? 'Active discovery' : 'Passive random'}
          helper="Recommendations only route unrated islands, then the next turn updates the event log."
          tone={turnMode === 'active' ? 'accent' : 'neutral'}
        />
        <MetricCard
          label="Exploration weight"
          value={formatDecimal(explorationWeight, 2)}
          helper="How much discovery value can influence the final route score."
        />
        <MetricCard
          label="Fit floor"
          value={formatDecimal(minPredictedFitFloor, 2)}
          helper="Minimum predicted fit required before an island can be routed."
        />
        <MetricCard
          label="Route count"
          value={routedIslandsPerActiveUser}
          helper="How many unrated islands each active user can receive per active turn."
        />
      </div>

      <ReportTable
        columns={recommendationColumns}
        rows={selectedUserRecommendations}
        getRowKey={(row) => row.islandId}
        onRowClick={(row) => setDrawerState({ type: 'recommendation', userId: selectedUser.id, islandId: row.islandId })}
        emptyTitle="No unrated recommendations"
        emptyDescription="The current user has no unrated islands that clear the predicted-fit floor."
      />
    </div>
  ) : (
    <EmptyState title="Select a user" description="Discovery routing appears once a user is selected." />
  );

  const selectedIslandSummary = selectedIsland ? (
    <div className="stack">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Selected island</p>
          <h3>{selectedIsland.label}</h3>
        </div>
        <div className="summary-header__actions">
          <button type="button" className="button button--ghost" onClick={() => setDrawerState({ type: 'island', id: selectedIsland.id })}>
            Open detail
          </button>
          <button type="button" className="button button--ghost" onClick={() => setModalKind('island')}>
            Select island
          </button>
        </div>
      </div>

      <div className="metric-grid metric-grid--compact">
        <MetricCard label="User rating" value={formatRating(selectedComparisonUserRating)} helper="Visible rating from the selected user." />
        <MetricCard
          label="Comparison cohort"
          value={selectedComparisonLabel}
          helper="The cohort used for island comparison."
        />
        <MetricCard
          label="Cohort rating"
          value={formatRating(selectedComparisonCohortRating)}
          helper="The selected cohort's rating on this island."
        />
        <MetricCard
          label="Exact match rate"
          value={
            exactMatchRate
              ? `${exactMatchRate.matches}/${exactMatchRate.rated} (${formatPercent(exactMatchRate.rate)})`
              : 'Unrated'
          }
          helper="Matches across islands both the user and comparison cohort rated."
        />
      </div>

      <div className="summary-inline">
        <Badge tone="neutral">User rated: {selectedUserRatings}</Badge>
        <Badge tone="accent">Island comparison updates with selection</Badge>
      </div>

      <section className="detail-block">
        <div className="section-heading">
          <h4>Cohort-local island affinity</h4>
          <p>Weighted by rater signal only. Higher-signal raters count more for their strongest cohort.</p>
        </div>
        <div className="metric-grid metric-grid--compact">
          <MetricCard
            label="Top positive affinity"
            value={selectedIslandAffinityReport?.topPositive ? labelForCohort(selectedIslandAffinityReport.topPositive.cohortId) : 'none'}
            helper={
              selectedIslandAffinityReport?.topPositive
                ? `${formatSignedDecimal(selectedIslandPositiveAffinity)} affinity`
                : 'No positive cohort estimate yet.'
            }
            tone="success"
          />
          <MetricCard
            label="Top negative affinity"
            value={selectedIslandAffinityReport?.topNegative ? labelForCohort(selectedIslandAffinityReport.topNegative.cohortId) : 'none'}
            helper={
              selectedIslandAffinityReport?.topNegative
                ? `${formatSignedDecimal(selectedIslandNegativeAffinity)} affinity`
                : 'No negative cohort estimate yet.'
            }
            tone="danger"
          />
          <MetricCard
            label="Affinity evidence"
            value={formatDecimal(selectedIslandEffectiveWeight)}
            helper="Effective rater signal contributing to the island's top estimate."
          />
          <MetricCard
            label="Weighted ratings"
            value={selectedIslandRatingCount}
            helper="Sparse events contributing to island/cohort affinity reports."
          />
        </div>
        <ReportTable
          columns={affinityColumns}
          rows={affinityRows}
          getRowKey={(row) => row.cohort.id}
          onRowClick={(row) => setDrawerState({ type: 'affinity', islandId: selectedIsland.id, cohortId: row.cohort.id })}
          emptyTitle="No island affinity"
          emptyDescription="Select a different island or take more turns to accumulate weighted evidence."
        />
      </section>
    </div>
  ) : null;

  const selectedUserDetail = selectedUser && selectedInference ? (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>Identity</h4>
        <p>{selectedUser.label}</p>
        <div className="badge-row">
          {selectedUser.declaredTags.map((tag) => (
            <Badge key={tag} tone="accent">
              {tag}
            </Badge>
          ))}
        </div>
      </section>
      <section className="detail-block">
        <h4>Ratings</h4>
        <p>{selectedUserRatings} islands rated</p>
      </section>
      <section className="detail-block">
        <h4>Rater signal</h4>
        <p>
          Overall: {formatDecimal(selectedRaterSignalProfile?.overallSignal ?? 0)} · Evidence:{' '}
          {formatPercent(selectedRaterSignalProfile?.signalEvidence ?? 0)}
        </p>
        <p className="muted">Top cohort: {labelForCohort(selectedRaterSignalProfile?.topCohortId ?? null)}</p>
      </section>
      <section className="detail-block">
        <h4>Diagnosis</h4>
        <p>{selectedInference.diagnosis.message}</p>
        <p className="muted">{selectedInference.diagnosis.reasons.join(' | ')}</p>
      </section>
      <section className="detail-block">
        <h4>Reviewer checksum</h4>
        <p>
          Hidden generator archetype:{' '}
          {selectedUser.hiddenReviewerArchetype ? archetypeLabel(selectedUser.hiddenReviewerArchetype) : 'none'}
        </p>
        <p>
          Recovery status:{' '}
          {selectedUserReviewerReport ? (
            <Badge tone={reviewerRecoveryTone(selectedUserReviewerReport.recoveryStatus)}>
              {selectedUserReviewerReport.recoveryStatus}
            </Badge>
          ) : (
            'n/a'
          )}
        </p>
        <p className="muted">
          Analyst flags: {selectedUserReviewerReport?.analystFlags.join(' · ') ?? 'n/a'}
        </p>
        <p className="muted">Hidden labels are debug checksums only. They do not feed the model.</p>
      </section>
      <section className="detail-block">
        <h4>Debug</h4>
        <p>Hidden seed: {selectedUser.hiddenSeedCohortId ? labelForCohort(selectedUser.hiddenSeedCohortId) : 'none'}</p>
        <p>Tag alignment: {selectedUser.hiddenTagAlignment ?? 'n/a'}</p>
        <p>Rating alignment: {selectedUser.hiddenRatingAlignment ?? 'n/a'}</p>
      </section>
    </div>
  ) : null;

  const selectedIslandDetail = selectedIsland ? (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>Island</h4>
        <p>{selectedIsland.label}</p>
        <p className="muted">Comparison cohort: {selectedComparisonLabel}</p>
      </section>
      <section className="detail-block">
        <h4>Visible ratings</h4>
        <p>User: {formatRating(selectedComparisonUserRating)}</p>
        <p>Cohort: {formatRating(selectedComparisonCohortRating)}</p>
      </section>
      <section className="detail-block">
        <h4>Cohort affinity</h4>
        <ReportTable
          columns={affinityColumns}
          rows={affinityRows}
          getRowKey={(row) => row.cohort.id}
          onRowClick={(row) => setDrawerState({ type: 'affinity', islandId: selectedIsland.id, cohortId: row.cohort.id })}
          emptyTitle="No island affinity"
          emptyDescription="No weighted affinity exists for this island yet."
        />
      </section>
      <section className="detail-block">
        <h4>Seeded cohort ratings</h4>
        <div className="detail-mini-table">
          {selectedIslandRows.map(({ cohort, rating }) => (
            <div key={cohort.id} className="detail-mini-table__row">
              <span>{cohort.label}</span>
              <Badge tone={rating === 1 ? 'success' : rating === -1 ? 'danger' : 'warning'}>
                {formatRating(rating)}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  ) : null;

  const selectedPseudoDetail = drawerState?.type === 'pseudo'
    ? dataset.pseudoCohortAnalysis.allReports.find((report) => report.key === drawerState.key) ?? null
    : null;

  const selectedRecommendation = selectedRecommendationDetail;
  const recommendationDrawerContent = selectedRecommendation ? (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>{dataset.islands.find((island) => island.id === selectedRecommendation.islandId)?.label ?? selectedRecommendation.islandId}</h4>
        <p className="muted">{selectedRecommendation.recommendationKind === 'SAFE_FIT' ? 'Safe fit' : 'Discovery probe'}</p>
        <p>{selectedRecommendation.explanation}</p>
      </section>
      <section className="detail-block">
        <h4>Recommendation metrics</h4>
        <p>Predicted fit: {formatSignedDecimal(selectedRecommendation.predictedFit)}</p>
        <p>Affinity support: {formatPercent(selectedRecommendation.affinitySupport)}</p>
        <p>Discovery value: {formatPercent(selectedRecommendation.discoveryValue)}</p>
        <p>Final score: {formatDecimal(selectedRecommendation.recommendationScore)}</p>
      </section>
      <section className="detail-block">
        <h4>Top cohort affinities</h4>
        <div className="detail-mini-table">
          {selectedRecommendation.topCohorts.map((entry) => (
            <div key={entry.cohortId} className="detail-mini-table__row">
              <span>{labelForCohort(entry.cohortId)}</span>
              <span className="muted">
                {formatSignedDecimal(entry.affinity)} · confidence {formatPercent(entry.confidence)} · evidence {formatDecimal(entry.effectiveWeight)}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="detail-block">
        <h4>Routing note</h4>
        <p>
          This recommendation is based on the user&apos;s current sparse ratings and the island&apos;s cohort-local affinity
          report before the next turn. The same routing path can feed either passive or active discovery turns.
        </p>
      </section>
    </div>
  ) : null;

  const pseudoDrawerContent = selectedPseudoDetail ? (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>{selectedPseudoDetail.tags.join(' | ')}</h4>
        <p className="muted">{selectedPseudoDetail.reportType}</p>
      </section>
      <section className="detail-block">
        <h4>Metrics</h4>
        <p>Users: {selectedPseudoDetail.userCount}</p>
        <p>Internal consistency: {selectedPseudoDetail.internalConsistency.toFixed(3)}</p>
        <p>Consistency evidence: {selectedPseudoDetail.consistencyEvidence.toFixed(3)}</p>
        <p>Known fit: {selectedPseudoDetail.averageKnownCohortFit.toFixed(3)}</p>
        <p>Usable Signal: {selectedPseudoDetail.averageEffectiveSignal.toFixed(3)}</p>
        <p>Priority: {selectedPseudoDetail.analystPriority}</p>
      </section>
      <section className="detail-block">
        <h4>Users</h4>
        <p className="muted">{selectedPseudoDetail.users.join(', ')}</p>
      </section>
    </div>
  ) : null;

  const selectedAffinityReport = drawerState?.type === 'affinity'
    ? dataset.islandAffinityReports.get(drawerState.islandId) ?? null
    : null;

  const selectedAffinityCohort = drawerState?.type === 'affinity'
    ? dataset.cohorts.find((cohort) => cohort.id === drawerState.cohortId) ?? null
    : null;

  const affinityDrawerContent = selectedAffinityDetail && selectedAffinityReport && selectedAffinityCohort ? (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>{selectedAffinityCohort.label}</h4>
        <p className="muted">{selectedAffinityCohort.tags.join(' | ')}</p>
      </section>
      <section className="detail-block">
        <h4>Affinity summary</h4>
        <p>Observed mean: {formatSignedDecimal(selectedAffinityDetail.observedMean)}</p>
        <p>Affinity: {formatSignedDecimal(selectedAffinityDetail.affinity)}</p>
        <p>Confidence: {formatPercent(selectedAffinityDetail.confidence)}</p>
        <p>Effective weight: {formatDecimal(selectedAffinityDetail.effectiveWeight)}</p>
        <p>Disagreement: {formatPercent(selectedAffinityDetail.disagreement)}</p>
      </section>
      <section className="detail-block">
        <h4>Ratings on this island</h4>
        <p>Raw count: {selectedAffinityDetail.rawCount}</p>
        <p>Positive: {selectedAffinityDetail.positiveCount}</p>
        <p>Neutral: {selectedAffinityDetail.neutralCount}</p>
        <p>Negative: {selectedAffinityDetail.negativeCount}</p>
      </section>
      <section className="detail-block">
        <h4>Rater contributions</h4>
        <div className="detail-mini-table">
          {selectedAffinityDetail.contributions.length > 0 ? (
            selectedAffinityDetail.contributions.map((contribution) => (
              <div key={`${contribution.userId}-${contribution.rating}-${contribution.raterSignal}`} className="detail-mini-table__row">
                <span>{contribution.userId}</span>
                <Badge tone={contribution.rating === 1 ? 'success' : contribution.rating === -1 ? 'danger' : 'warning'}>
                  {formatRating(contribution.rating)}
                </Badge>
                <span className="muted">{formatDecimal(contribution.raterSignal)}</span>
                <strong>{formatSignedDecimal(contribution.weightedContribution)}</strong>
              </div>
            ))
          ) : (
            <p className="muted">No weighted contributions yet.</p>
          )}
        </div>
      </section>
    </div>
  ) : null;

  const reviewerDrawerContent = selectedReviewerReport ? (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>{selectedReviewerReport.label}</h4>
        <p className="muted">{selectedReviewerReport.userId}</p>
      </section>
      <section className="detail-block">
        <h4>Hidden generator checksum</h4>
        <p>Hidden archetype: {archetypeLabel(selectedReviewerReport.hiddenReviewerArchetype)}</p>
        <p>Checksum: {selectedReviewerReport.hiddenReviewerChecksum}</p>
        <p className="muted">Debug checksum only. Not a model input.</p>
      </section>
      <section className="detail-block">
        <h4>Inferred behavior</h4>
        <p>Diagnosis: <Badge tone={diagnosisTone(selectedReviewerReport.inferredDiagnosisType)}>{selectedReviewerReport.inferredDiagnosisType}</Badge></p>
        <p>Inferred cohort: {selectedReviewerReport.inferredCohortId ? labelForCohort(selectedReviewerReport.inferredCohortId) : 'none'}</p>
        <p>Recovery status: <Badge tone={reviewerRecoveryTone(selectedReviewerReport.recoveryStatus)}>{selectedReviewerReport.recoveryStatus}</Badge></p>
      </section>
      <section className="detail-block">
        <h4>Evidence</h4>
        <p>Declared fit: {formatPercent(selectedReviewerReport.declaredFit)}</p>
        <p>Behavior fit: {formatPercent(selectedReviewerReport.behaviorFit)}</p>
        <p>Known fit: {formatPercent(selectedReviewerReport.knownCohortFit)}</p>
        <p>Signal evidence: {formatPercent(selectedReviewerReport.signalEvidence)}</p>
        <p>Usable signal: {formatDecimal(selectedReviewerReport.effectiveSignal)}</p>
      </section>
      <section className="detail-block">
        <h4>Analyst flags</h4>
        <div className="badge-row">
          {selectedReviewerReport.analystFlags.length > 0 ? (
            selectedReviewerReport.analystFlags.map((flag) => (
              <Badge key={flag} tone="neutral">
                {flag}
              </Badge>
            ))
          ) : (
            <span className="muted">No flags yet.</span>
          )}
        </div>
        <p className="muted">Review candidate: {selectedReviewerReport.reviewCandidate ? 'yes' : 'no'}</p>
      </section>
    </div>
  ) : null;

  const modelExplanation = selectedInference ? (
    <div className="stack">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Model explanation</p>
          <h3>Why the model scored this user the way it did</h3>
        </div>
      </div>

      <DistributionList
        title="Declared distribution"
        entries={selectedInference.declaredDistribution}
        labelForCohort={labelForCohort}
      />

      <DistributionList
        title="Behavior distribution"
        entries={selectedInference.behaviorDistribution}
        labelForCohort={labelForCohort}
      />

      {behaviorIsNonInformative ? (
        <div className="notice notice--warning">
          <strong>Behavior distribution is non-informative.</strong>
          <p>
            The normalized cohort bars are falling back to a spread shape, so read this as a
            placeholder until raw behavior strength and specificity rise.
          </p>
        </div>
      ) : null}

      <DistributionList
        title="Inverse behavior distribution"
        entries={selectedInference.inverseBehaviorDistribution}
        labelForCohort={labelForCohort}
      />

      <section className="diagnosis-card">
        <h4>Diagnosis reasons</h4>
        <ul className="diagnosis-list">
          {selectedInference.diagnosis.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <div className="summary-inline">
          <span className="muted">
            Suggested cohort:{' '}
            {selectedInference.diagnosis.suggestedCohortId
              ? labelForCohort(selectedInference.diagnosis.suggestedCohortId)
              : 'none'}
          </span>
          <span className="muted">
            Suggested tags:{' '}
            {selectedInference.diagnosis.suggestedTags?.length
              ? selectedInference.diagnosis.suggestedTags.join(', ')
              : 'none'}
          </span>
        </div>
      </section>
    </div>
  ) : (
    <EmptyState title="No user selected" description="Choose a user to inspect declared and behavioral fit." />
  );

  const islandComparison = selectedUser && selectedComparisonCohort ? (
    <ReportTable
      columns={[
        {
          key: 'island',
          label: 'Island',
          render: (row: { island: Island; userRating: string; cohortRating: string; match: string }) => row.island.label
        },
        {
          key: 'user',
          label: 'User',
          render: (row) => row.userRating,
          align: 'center'
        },
        {
          key: 'cohort',
          label: 'Cohort',
          render: (row) => row.cohortRating,
          align: 'center'
        },
        {
          key: 'match',
          label: 'Match',
          render: (row) => row.match,
          align: 'center'
        }
      ]}
      rows={dataset.islands.map((island) => {
        const userRating = selectedUser.ratings[island.id] ?? null;
        const cohortRating = selectedComparisonCohort.ratings[island.id] ?? null;
        const match =
          userRating === null && cohortRating === null
            ? 'Both unrated'
            : userRating === null
              ? 'User unrated'
              : cohortRating === null
                ? 'Cohort unrated'
            : userRating === cohortRating
              ? 'Match'
              : 'Mismatch';

        return {
          island,
          userRating: formatRating(userRating),
          cohortRating: formatRating(cohortRating),
          match
        };
      })}
      getRowKey={(row) => row.island.id}
      onRowClick={(row) => setDrawerState({ type: 'island', id: row.island.id })}
      emptyTitle="No islands"
      emptyDescription="Increase the island count to compare ratings."
    />
  ) : (
    <EmptyState title="Select a user" description="Island comparison appears once a user is selected." />
  );

  const pseudoConsistentColumns = reportColumns;
  const pseudoInconsistentColumns = reportColumns;

  const pseudoConsistentRows = dataset.pseudoCohortAnalysis.topConsistentPseudoCohorts;
  const pseudoInconsistentRows = dataset.pseudoCohortAnalysis.topInconsistentPseudoCohorts;

  const openSelectionButton = (kind: Exclude<SelectionModalKind, null>, label: string) => (
    <button type="button" className="button" onClick={() => setModalKind(kind)}>
      {label}
    </button>
  );

  const randomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 1_000_000_000));
  };

  const advanceCurrentTurn = (state: SimulationState) => {
    if (turnMode === 'active') {
      return advanceActiveTurn(state, {
        activeUsersPerTurn,
        routedIslandsPerActiveUser,
        explorationWeight,
        minPredictedFitFloor
      });
    }

    return advancePassiveTurn(state, {
      activeUsersPerTurn,
      maxRatingsPerActiveUser
    });
  };

  const dashboardSections: Record<DashboardPanelGroupKey, { title: string; panels: JSX.Element[] }> = {
    overview: {
      title: 'Overview',
      panels: [
        <Panel key="turn-summary" title="Turn Summary" className="panel--full">
          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Current turn" value={dataset.currentTurn} tone="accent" />
            <MetricCard
              label="Mode"
              value={currentTurnSummary?.mode === 'active' ? 'Active discovery' : 'Passive random'}
              helper="How the most recent turn created rating events."
            />
            <MetricCard label="Rating events" value={dataset.ratingEvents.length} />
            <MetricCard label="Ratings this turn" value={currentTurnSummary?.ratingsCreated ?? 0} />
            <MetricCard label="Active users this turn" value={currentTurnSummary?.activeUserIds.length ?? 0} />
            <MetricCard label="New islands rated" value={currentTurnSummary?.newlyRatedIslandIds.length ?? 0} />
            <MetricCard label="Safe fits routed" value={currentTurnSummary?.recommendationKinds.SAFE_FIT ?? 0} />
            <MetricCard
              label="Discovery probes"
              value={currentTurnSummary?.recommendationKinds.DISCOVERY_PROBE ?? 0}
            />
          </div>
          <div className="summary-inline">
            {(dataset.turnHistory.slice(-3) ?? []).map((turn) => (
              <Badge key={turn.turn} tone="neutral">
                Turn {turn.turn}: {turn.mode === 'active' ? 'active' : 'passive'} · {turn.ratingsCreated} ratings
              </Badge>
            ))}
          </div>
        </Panel>,
        <Panel key="population-summary" title="Population Summary" className="panel--full">
          <div className="metric-grid">
            <MetricCard label="Total users" value={populationSummary.totalUsers} tone="accent" />
            <MetricCard label="Seeded anchors" value={dataset.cohorts.length} />
            <MetricCard label="Generated users" value={populationSummary.generatedUsers} />
            <MetricCard label="Visible users" value={dataset.users.length} />
            <MetricCard label="Islands" value={dataset.islands.length} />
            <MetricCard label="Rating events" value={dataset.ratingEvents.length} />
            <MetricCard label="Current turn" value={dataset.currentTurn} tone="accent" />
            <MetricCard label="High signal users" value={populationSummary.highSignal} tone="success" />
            <MetricCard label="Retag candidates" value={populationSummary.retagCandidates} tone="warning" />
            <MetricCard label="Inverse profiles" value={populationSummary.inverseProfiles} tone="danger" />
            <MetricCard label="Unknown / noisy" value={populationSummary.noisyUsers} />
            <MetricCard label="Pseudo-cohort reports" value={populationSummary.pseudoReports} />
          </div>
          <div className="summary-inline">
            <ProgressBar
              value={populationSummary.totalUsers ? populationSummary.highSignal / populationSummary.totalUsers : 0}
              label="High-signal share"
              tone="success"
            />
          </div>
        </Panel>
      ]
    },
    recovery: {
      title: 'Recovery',
      panels: [
        <Panel key="reviewer-archetype" title="Reviewer Archetype Recovery" className="panel--wide">
          {reviewerArchetypeSummary}
        </Panel>,
        <Panel key="selected-user" title="Selected User Summary">
          {selectedUser && selectedInference ? selectedUserSummary : <EmptyState title="No user selected" description="Open the user picker to inspect an individual user." />}
        </Panel>
      ]
    },
    routing: {
      title: 'Routing',
      panels: [
        <Panel key="discovery-routing" title="Discovery Routing" className="panel--wide">
          {discoveryRoutingSummary}
        </Panel>,
        <Panel key="selected-island" title="Selected Island Summary">
          {selectedIsland ? selectedIslandSummary : <EmptyState title="No island selected" description="Open the island picker to inspect an island." />}
        </Panel>,
        <Panel key="model-explanation" title="Model Explanation" className="panel--wide">
          {modelExplanation}
        </Panel>,
        <Panel key="island-comparison" title="Island Comparison" className="panel--wide">
          {islandComparison}
        </Panel>,
        <Panel key="pseudo-cohorts" title="Pseudo-Cohort Reports" className="panel--wide">
          <div className="section-toolbar">
            <button type="button" className="button button--ghost" onClick={() => setModalKind('pseudo')}>
              Select report row
            </button>
          </div>
          <div className="report-section">
            <div className="report-section__column">
              <div className="section-heading">
                <h3>Top Consistent Pseudo-Cohorts</h3>
                <p>High agreement, meaningful evidence, and low known-cohort fit.</p>
              </div>
              <ReportTable
                columns={pseudoConsistentColumns}
                rows={pseudoConsistentRows}
                getRowKey={(row) => row.key}
                onRowClick={(row) => setDrawerState({ type: 'pseudo', key: row.key })}
                emptyTitle="No consistent pseudo-cohorts"
                emptyDescription="Increase user count or vary the generator seed."
              />
            </div>

            <div className="report-section__column">
              <div className="section-heading">
                <h3>Top Inconsistent Pseudo-Cohorts</h3>
                <p>Tag combinations whose members do not rate coherently.</p>
              </div>
              <ReportTable
                columns={pseudoInconsistentColumns}
                rows={pseudoInconsistentRows}
                getRowKey={(row) => row.key}
                onRowClick={(row) => setDrawerState({ type: 'pseudo', key: row.key })}
                emptyTitle="No inconsistent pseudo-cohorts"
                emptyDescription="Increase user count or vary the generator seed."
              />
            </div>
          </div>
        </Panel>
      ]
    },
    debug: {
      title: 'Debug',
      panels: showDebug
        ? [
            <Panel key="debug-data" title="Debug Data" className="panel--wide">
              {selectedUser && selectedInference ? (
                <div className="debug-grid">
                  <MetricCard
                    label="Hidden seed"
                    value={selectedUser.hiddenSeedCohortId ? labelForCohort(selectedUser.hiddenSeedCohortId) : 'none'}
                    helper="Debug and validation only."
                  />
                  <MetricCard
                    label="Hidden generator archetype"
                    value={selectedUser.hiddenReviewerArchetype ? archetypeLabel(selectedUser.hiddenReviewerArchetype) : 'none'}
                    helper="Debug and validation only."
                  />
                  <MetricCard
                    label="Hidden tag alignment"
                    value={selectedUser.hiddenTagAlignment ?? 'n/a'}
                    helper="Debug and validation only."
                  />
                  <MetricCard
                    label="Hidden rating alignment"
                    value={selectedUser.hiddenRatingAlignment ?? 'n/a'}
                    helper="Debug and validation only."
                  />
                  <MetricCard
                    label="Hidden vs inferred"
                    value={
                      selectedUser.hiddenSeedCohortId === selectedInference.behaviorTop.cohortId
                        ? 'Recovered hidden seed'
                        : 'Different visible fit'
                    }
                    helper="Hidden data is not a model input."
                  />
                  <MetricCard
                    label="Recovery status"
                    value={selectedUserReviewerReport?.recoveryStatus ?? 'n/a'}
                    helper="Debug checksum status for the selected user."
                  />
                </div>
              ) : (
                <EmptyState title="No debug data" description="Select a user to inspect hidden generation fields." />
              )}
            </Panel>
          ]
        : []
    }
  };

  return (
    <main className="app-shell analyst-console">
      <header className="hero">
        <div className="hero__eyebrow-row">
          <p className="eyebrow">Wayfarer analyst console</p>
          <span className="hero__pill">Columbus debug engine</span>
          <span className="hero__pill hero__pill--status">{appStatus}</span>
        </div>
        <div className="hero__title-row">
          <h1>Wayfarer</h1>
          <button type="button" className="button button--ghost hero__about-button" onClick={() => setShowAbout(true)}>
            About
          </button>
        </div>
        <p className="subtitle">
          Analyst-first dashboard for inspecting synthetic cohorts, user signal, island fit, and pseudo-cohort reports
          at scale.
        </p>
      </header>

      <section className="topbar" aria-label="Dashboard guidance">
        <div className="topbar__left">
          <div className="topbar__mode" role="group" aria-label="Guidance mode">
            <button
              type="button"
              className={`segmented-button${guidanceMode === 'novice' ? ' segmented-button--active' : ''}`}
              aria-pressed={guidanceMode === 'novice'}
              onClick={() => setGuidanceMode('novice')}
            >
              Novice
            </button>
            <button
              type="button"
              className={`segmented-button${guidanceMode === 'expert' ? ' segmented-button--active' : ''}`}
              aria-pressed={guidanceMode === 'expert'}
              onClick={() => setGuidanceMode('expert')}
            >
              Expert
            </button>
          </div>
          <label className="control control--inline">
            <span>Dashboard ordering</span>
            <select value={dashboardOrdering} onChange={(event) => setDashboardOrdering(event.target.value as DashboardOrderingPreset)}>
              {Object.entries(DASHBOARD_ORDERING_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="control control--inline control--wide">
            <span>Use Case / Story</span>
            <select value={useCaseId} onChange={(event) => setUseCaseId(event.target.value as UseCaseStoryId)}>
              {USE_CASE_STORIES.map((story) => (
                <option key={story.id} value={story.id}>
                  {story.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="topbar__right">
          <Badge tone="accent">Story: {selectedStory.title}</Badge>
          <Badge tone="neutral">Mode: {guidanceMode}</Badge>
          <Badge tone="neutral">Ordering: {DASHBOARD_ORDERING_LABELS[dashboardOrdering]}</Badge>
        </div>
      </section>

      <section className="intro-grid" aria-label="Controls and instructions">
        <Panel title="Control panel">
          <div className="control-strip__fields">
            <label className="control">
              <span>Seed</span>
              <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} min={0} step={1} />
            </label>
            <label className="control">
              <span>Users</span>
              <input
                type="number"
                value={numUsers}
                onChange={(event) => setNumUsers(Number(event.target.value))}
                min={1}
                max={400}
                step={1}
              />
            </label>
            <label className="control">
              <span>Islands</span>
              <input
                type="number"
                value={numIslands}
                onChange={(event) => setNumIslands(Number(event.target.value))}
                min={4}
                max={96}
                step={1}
              />
            </label>
            <label className="control">
              <span>Initial ratings</span>
              <input
                type="number"
                value={initialRatingsPerUser}
                onChange={(event) => setInitialRatingsPerUser(Number(event.target.value))}
                min={1}
                max={12}
                step={1}
              />
            </label>
            <label className="control">
              <span>Turn mode</span>
              <select value={turnMode} onChange={(event) => setTurnMode(event.target.value as TurnMode)}>
                <option value="passive">Passive / random</option>
                <option value="active">Active discovery</option>
              </select>
            </label>
            <label className="control">
              <span>Exploration weight</span>
              <input
                type="number"
                value={explorationWeight}
                onChange={(event) => setExplorationWeight(Number(event.target.value))}
                min={0}
                max={2}
                step={0.05}
              />
            </label>
            <label className="control">
              <span>Fit floor</span>
              <input
                type="number"
                value={minPredictedFitFloor}
                onChange={(event) => setMinPredictedFitFloor(Number(event.target.value))}
                min={-1}
                max={1}
                step={0.05}
              />
            </label>
            <label className="control">
              <span>Routed / active user</span>
              <input
                type="number"
                value={routedIslandsPerActiveUser}
                onChange={(event) => setRoutedIslandsPerActiveUser(Number(event.target.value))}
                min={1}
                max={8}
                step={1}
              />
            </label>
            <label className="control">
              <span>Active users / turn</span>
              <input
                type="number"
                value={activeUsersPerTurn}
                onChange={(event) => setActiveUsersPerTurn(Number(event.target.value))}
                min={1}
                max={96}
                step={1}
              />
            </label>
            <label className="control">
              <span>Passive ratings / user</span>
              <input
                type="number"
                value={maxRatingsPerActiveUser}
                onChange={(event) => setMaxRatingsPerActiveUser(Number(event.target.value))}
                min={1}
                max={8}
                step={1}
              />
            </label>
            <label className="control">
              <span>Turn batch</span>
              <input
                type="number"
                value={turnBatchCount}
                onChange={(event) => setTurnBatchCount(Number(event.target.value))}
                min={1}
                max={20}
                step={1}
              />
            </label>
          </div>
          <div className="control-strip__actions">
            <button type="button" className="button" onClick={randomizeSeed}>
              Regenerate dataset
            </button>
            <button type="button" className="button" onClick={() => setSimulationState((state) => advanceCurrentTurn(state))}>
              Take 1 Turn
            </button>
            <button
              type="button"
              className="button"
              onClick={() =>
                setSimulationState((state) => {
                  let next = state;

                  for (let index = 0; index < turnBatchCount; index += 1) {
                    next = advanceCurrentTurn(next);
                  }

                  return next;
                })
              }
            >
              Take X Turns
            </button>
            <button type="button" className="button button--ghost" onClick={() => setSimulationState(initialSimulationState)}>
              Reset Simulation
            </button>
            <button type="button" className="button button--ghost" onClick={() => setShowDebug((value) => !value)}>
              {showDebug ? 'Hide debug' : 'Show debug'}
            </button>
            {openSelectionButton('user', 'Select user')}
            {openSelectionButton('island', 'Select island')}
            {openSelectionButton('cohort', 'Select cohort')}
          </div>
        </Panel>

        <Panel title="Instruction panel">
          <div className="summary-header">
            <div>
              <p className="eyebrow">Use case</p>
              <h3>{selectedStory.title}</h3>
            </div>
            <div className="summary-header__actions">
              <Badge tone="accent">Recommended: {DASHBOARD_ORDERING_LABELS[selectedStory.recommendedOrdering]}</Badge>
              <button type="button" className="button button--ghost" onClick={() => setGuidanceOpen((value) => !value)}>
                {guidanceOpen ? 'Collapse guidance' : 'Expand guidance'}
              </button>
            </div>
          </div>
          <p className="muted">{selectedStory.goal}</p>
          {guidanceOpen ? (
            <div className="instruction-grid">
              <section className="detail-block">
                <h4>Steps</h4>
                <ol className="instruction-list">
                  {selectedStory.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>
              <section className="detail-block">
                <h4>Expected result</h4>
                <p>{selectedStory.expectedResult}</p>
              </section>
              <section className="detail-block">
                <h4>Failure signs</h4>
                <ul className="diagnosis-list">
                  {selectedStory.failureSigns.map((failureSign) => (
                    <li key={failureSign}>{failureSign}</li>
                  ))}
                </ul>
              </section>
            </div>
          ) : (
            <div className="notice">
              <strong>Guidance collapsed.</strong>
              <p>
                This panel is here to tell a new reader what to prove next. Expand it if the current story is unclear.
              </p>
            </div>
          )}
        </Panel>
      </section>

      <section className="dashboard-shell" aria-label="Analyst dashboard">
        {visibleDashboardSections.map((sectionKey) => {
          if (sectionKey === 'debug' && !showDebug) {
            return null;
          }

          const section = dashboardSections[sectionKey];

          return (
            <section key={sectionKey} className={`dashboard-section dashboard-section--${sectionKey}`}>
              <div className="section-heading dashboard-section__heading">
                <p className="eyebrow">{section.title}</p>
                <p className="muted">
                  {sectionKey === 'overview'
                    ? 'Summary and current state'
                    : sectionKey === 'recovery'
                      ? 'Checks on seeded anchors, signal, and recovery'
                      : sectionKey === 'routing'
                        ? 'Recommendations, island comparison, and pseudo-cohorts'
                        : 'Checksums, hidden metadata, and debug-only fields'}
                </p>
              </div>
              <div className="dashboard-section__panels">{section.panels}</div>
            </section>
          );
        })}
      </section>

      <Modal open={showAbout} title="About / Prior Art" placement="top" onClose={() => setShowAbout(false)}>
        <div className="stack about-copy">
          <p>Wayfarer is adjacent to known work in trust-aware recommender systems.</p>
          <p>
            For example, Massa and Avesani&apos;s trust-aware collaborative filtering explored using propagated
            trust to improve recommender coverage while preserving prediction quality, especially when ordinary
            similarity matching becomes sparse. TrustSVD later incorporated explicit and implicit trust influence
            into a matrix-factorization recommender to address sparsity and cold-start problems.
          </p>
          <p>
            Those systems are useful landmarks. They suggest that trust and rating behavior can help recommender
            systems when ordinary rating coverage is thin.
          </p>
          <p>Wayfarer explores a different product-shaped version of that idea.</p>
          <p>
            Instead of using explicit social trust links or global user reputation, Wayfarer starts with trusted
            cohort anchors: seed reviewers chosen because they represent meaningful taste groups in a UGC
            ecosystem. Ordinary users earn cohort-local signal by rating known islands similarly to those anchors.
            Their later ratings then extend the effective reach of those anchors into sparse, under-reviewed
            content.
          </p>
          <p>
            So the propagated unit is not &ldquo;Alice trusts Bob&rdquo; or &ldquo;Bob is globally reputable.&rdquo;
            It is narrower:
          </p>
          <p className="about-copy__quote">Bob appears to be a reliable signal source for this cohort&apos;s taste.</p>
          <p>
            That makes Wayfarer an exploration of cohort-local trust propagation for UGC discovery, not a claim to
            have invented trust-aware recommendation from scratch.
          </p>
        </div>
      </Modal>

      <SelectionModal
        open={modalKind === 'user'}
        title="Select User"
        searchPlaceholder="Search users"
        options={selectedUserOptions}
        selectedId={selectedUserId}
        onSelect={(id) => {
          setSelectedUserId(id);
          setModalKind(null);
        }}
        onClose={() => setModalKind(null)}
      />

      <SelectionModal
        open={modalKind === 'island'}
        title="Select Island"
        searchPlaceholder="Search islands"
        options={selectedIslandOptions}
        selectedId={selectedIslandId}
        onSelect={(id) => {
          setSelectedIslandId(id);
          setModalKind(null);
        }}
        onClose={() => setModalKind(null)}
      />

      <SelectionModal
        open={modalKind === 'cohort'}
        title="Select Comparison Cohort"
        searchPlaceholder="Search cohorts"
        options={comparisonCohortOptions}
        selectedId={comparisonCohortId}
        onSelect={(id) => {
          setComparisonCohortId(id);
          setModalKind(null);
        }}
        onClose={() => setModalKind(null)}
      />

      <SelectionModal
        open={modalKind === 'pseudo'}
        title="Select Pseudo-Cohort Report"
        searchPlaceholder="Search report rows"
        options={pseudoReportOptions}
        selectedId={drawerState?.type === 'pseudo' ? drawerState.key : null}
        onSelect={(id) => {
          setDrawerState({ type: 'pseudo', key: id });
          setModalKind(null);
        }}
        onClose={() => setModalKind(null)}
      />

      <Drawer
        open={drawerState?.type === 'user'}
        title={drawerState?.type === 'user' ? `User detail: ${selectedUser?.label ?? drawerState.id}` : 'User detail'}
        onClose={() => setDrawerState(null)}
      >
        {selectedUserDetail}
      </Drawer>

      <Drawer
        open={drawerState?.type === 'island'}
        title={drawerState?.type === 'island' ? `Island detail: ${selectedIsland?.label ?? drawerState.id}` : 'Island detail'}
        onClose={() => setDrawerState(null)}
      >
        {selectedIslandDetail}
      </Drawer>

      <Drawer
        open={drawerState?.type === 'pseudo'}
        title={drawerState?.type === 'pseudo' ? 'Pseudo-cohort detail' : 'Pseudo-cohort detail'}
        onClose={() => setDrawerState(null)}
      >
        {pseudoDrawerContent}
      </Drawer>

      <Drawer
        open={drawerState?.type === 'recommendation'}
        title={
          drawerState?.type === 'recommendation'
            ? `Recommendation detail: ${
                dataset.islands.find((island) => island.id === drawerState.islandId)?.label ?? drawerState.islandId
              }`
            : 'Recommendation detail'
        }
        onClose={() => setDrawerState(null)}
      >
        {recommendationDrawerContent}
      </Drawer>

      <Drawer
        open={drawerState?.type === 'affinity'}
        title={
          drawerState?.type === 'affinity'
            ? `Affinity detail: ${dataset.islands.find((island) => island.id === drawerState.islandId)?.label ?? drawerState.islandId} / ${
                selectedAffinityCohort?.label ?? drawerState.cohortId
              }`
            : 'Affinity detail'
        }
        onClose={() => setDrawerState(null)}
      >
        {affinityDrawerContent}
      </Drawer>

      <Drawer
        open={drawerState?.type === 'reviewer'}
        title={drawerState?.type === 'reviewer' ? `Reviewer checksum: ${selectedReviewerReport?.label ?? drawerState.userId}` : 'Reviewer checksum'}
        onClose={() => setDrawerState(null)}
      >
        {reviewerDrawerContent}
      </Drawer>
    </main>
  );
}

