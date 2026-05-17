import { useEffect, useMemo, useState } from 'react';
import { Badge } from './ui/components/Badge';
import { Drawer } from './ui/components/Drawer';
import { EmptyState } from './ui/components/EmptyState';
import { MetricCard } from './ui/components/MetricCard';
import { Modal } from './ui/components/Modal';
import { Panel } from './ui/components/Panel';
import { ProgressBar } from './ui/components/ProgressBar';
import { ReportTable, type ReportTableColumn } from './ui/components/ReportTable';
import { InfoTip } from './ui/components/InfoTip';
import { SelectionModal, type SelectionOption } from './ui/components/SelectionModal';
import { CollapsiblePanel } from './ui/components/CollapsiblePanel';
import { SystemHealthPanel } from './ui/components/SystemHealthPanel';
import { Tray } from './ui/components/Tray';
import { DistributionList } from './ui/components/DistributionList';
import { DistributionDonut } from './ui/components/DistributionDonut';
import { DistributionLegend } from './ui/components/DistributionLegend';
import { DivergingAffinityBars } from './ui/components/DivergingAffinityBars';
import { aggregateBatchTotals, type RecentActionState } from './ui/recentActionSummary';
import { buildSystemHealthSummary } from './ui/systemHealth';
import {
  collapseDistributionSlices,
  computeDeclaredTagOverlap,
  shouldPromoteInverseSignal,
  summarizeBehaviorRead
} from './ui/summaryVisuals';
import { useRef } from 'react';
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
import {
  DEFAULT_TURN_POLICY,
  describeRoutingRiskProfile,
  getTurnModeVisibility,
  PARTICIPATION_MODEL_LABELS,
  RATING_COUNT_MODEL_LABELS,
  ROUTING_RISK_PROFILE_LABELS,
  resolveRoutingRiskProfileValues,
  TURN_MODE_LABELS,
  type ParticipationModel,
  type RatingCountModel,
  type RoutingRiskProfile,
  type TurnMode
} from './model/turnPolicy';
import { DEFAULT_TAGS } from './data/defaultTags';
import { createDefaultCohorts } from './data/defaultCohorts';
import { generateColumbusDataset } from './generator/columbusGenerator';
import type { CohortAffinityEstimate } from './model/affinity';
import type { PseudoCohortReport } from './model/pseudoCohorts';
import { archetypeLabel, type ReviewerArchetypeReport } from './model/reviewerArchetypes';
import { recommendIslandsForUser, type IslandRecommendation } from './model/recommendations';
import {
  advancePolicyTurn,
  createInitialSimulationState,
  hydrateSimulationState,
  type SimulationState
} from './model/simulation';
import {
  exportSavedWayfarerScenario,
  parseSavedWayfarerScenario,
  type SavedScenarioGeneratorConfig,
  type SavedWayfarerScenarioV1
} from './model/scenarioPersistence';
import {
  applyScenarioPreset,
  getScenarioPreset,
  getScenarioPresetMetadata,
  listScenarioPresets,
  resolveScenarioPresetFromControls,
  type ScenarioPresetMetadata,
  type ScenarioPresetId,
  type ScenarioPreset,
  type ScenarioPresetControls
} from './model/scenarioPresets';
import type { CohortAnchor, Island, User } from './model/types';

const INITIAL_SCENARIO_PRESET: ScenarioPreset = getScenarioPreset('small-smoke-test');
const SCENARIO_PRESET_OPTIONS = listScenarioPresets();

function scenarioPresetMetadataFromPreset(preset: ScenarioPreset): ScenarioPresetMetadata {
  return getScenarioPresetMetadata(preset.id);
}

type SelectionModalKind = 'user' | 'island' | 'cohort' | 'pseudo' | null;

type PinnedDrilldownKind = 'user' | 'island' | 'cohort' | null;

type ScenarioExecutionSeedMode = 'random' | 'fixed';

type DrawerState =
  | { type: 'user'; id: string }
  | { type: 'island'; id: string }
  | { type: 'pseudo'; key: string }
  | { type: 'reviewer'; userId: string }
  | { type: 'reviewer-recovery' }
  | { type: 'recommendation'; userId: string; islandId: string }
  | { type: 'affinity'; islandId: string; cohortId: string }
  | null;

function buildDataset(config: {
  seed: number;
  numUsers: number;
  numIslands: number;
  tagAlignmentDistribution: SavedScenarioGeneratorConfig['tagAlignmentDistribution'];
  ratingAlignmentDistribution: SavedScenarioGeneratorConfig['ratingAlignmentDistribution'];
  islandClassWeights?: SavedScenarioGeneratorConfig['islandClassWeights'];
}) {
  return generateColumbusDataset({
    seed: config.seed,
    numUsers: config.numUsers,
    numIslands: config.numIslands,
    cohorts: createDefaultCohorts(),
    allTags: DEFAULT_TAGS,
    tagAlignmentDistribution: config.tagAlignmentDistribution,
    ratingAlignmentDistribution: config.ratingAlignmentDistribution,
    islandClassWeights: config.islandClassWeights
  });
}

function buildSimulationStateFromControls(controls: ScenarioPresetControls) {
  const latentDataset = buildDataset({
    seed: controls.seed,
    numUsers: controls.numUsers,
    numIslands: controls.numIslands,
    tagAlignmentDistribution: controls.tagAlignmentDistribution,
    ratingAlignmentDistribution: controls.ratingAlignmentDistribution,
    islandClassWeights: controls.islandClassWeights
  });

  return createInitialSimulationState({
    seed: controls.seed,
    allTags: latentDataset.allTags,
    latentUsers: latentDataset.users,
    cohorts: latentDataset.cohorts,
    islands: latentDataset.islands,
    initialRatingsPerUser: controls.bootstrapRatingsPerUser
  });
}

function labelForCohortFactory(cohorts: CohortAnchor[]) {
  const labels = new Map(cohorts.map((cohort) => [cohort.id, cohort.label]));
  const analystLabels = new Map(cohorts.map((cohort) => [cohort.id, cohort.analystName ?? cohort.label]));

  return {
    analyst: (cohortId: string | null) => {
      if (cohortId === null) {
        return 'none';
      }
      return analystLabels.get(cohortId) ?? labels.get(cohortId) ?? cohortId;
    },
    technical: (cohortId: string | null) => {
      if (cohortId === null) {
        return 'none';
      }
      return labels.get(cohortId) ?? cohortId;
    },
    full: (cohortId: string | null) => {
      if (cohortId === null) {
        return 'none';
      }
      const analyst = analystLabels.get(cohortId) ?? cohortId;
      const technical = labels.get(cohortId) ?? cohortId;
      return analyst === technical ? technical : `${analyst} — ${technical}`;
    }
  };
}

function buildDeclaredObservedRelationshipText(inference: {
  declaredTop: { cohortId: string | null };
  behaviorTop: { cohortId: string | null };
}) {
  const declaredId = inference.declaredTop.cohortId;
  const behaviorId = inference.behaviorTop.cohortId;

  if (declaredId && behaviorId && declaredId === behaviorId) {
    return 'Declared tags and observed behavior currently point to the same top cohort.';
  }
  if (declaredId && behaviorId && declaredId !== behaviorId) {
    return 'Declared tags and observed behavior currently point to different top cohorts.';
  }
  if (!declaredId && behaviorId) {
    return 'Observed behavior has a top cohort fit, but declared tags do not establish a clear top cohort yet.';
  }
  if (declaredId && !behaviorId) {
    return 'Declared tags suggest a top cohort, but observed behavior is still too sparse for a clear top cohort.';
  }
  return 'Declared and observed cohort fits are both ambiguous; gather more ratings before over-interpreting this profile.';
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

interface AppProps {
  initialGuidanceMode?: GuidanceMode;
}

export default function App({ initialGuidanceMode = 'novice' }: AppProps = {}) {
  const [scenarioPresetSource, setScenarioPresetSource] = useState<ScenarioPresetMetadata | null>(
    scenarioPresetMetadataFromPreset(INITIAL_SCENARIO_PRESET)
  );
  const [seed, setSeed] = useState(INITIAL_SCENARIO_PRESET.generatorConfig.seed);
  const [numUsers, setNumUsers] = useState(INITIAL_SCENARIO_PRESET.generatorConfig.numUsers);
  const [numIslands, setNumIslands] = useState(INITIAL_SCENARIO_PRESET.generatorConfig.numIslands);
  const [bootstrapRatingsPerUser, setBootstrapRatingsPerUser] = useState(
    INITIAL_SCENARIO_PRESET.generatorConfig.bootstrapRatingsPerUser
  );
  const [tagAlignmentDistribution, setTagAlignmentDistribution] = useState(
    INITIAL_SCENARIO_PRESET.generatorConfig.tagAlignmentDistribution
  );
  const [ratingAlignmentDistribution, setRatingAlignmentDistribution] = useState(
    INITIAL_SCENARIO_PRESET.generatorConfig.ratingAlignmentDistribution
  );
  const [turnMode, setTurnMode] = useState<TurnMode>(DEFAULT_TURN_POLICY.turnMode);
  const [participationModel, setParticipationModel] = useState<ParticipationModel>(DEFAULT_TURN_POLICY.participationModel);
  const [participatingUsersPerTurn, setParticipatingUsersPerTurn] = useState(DEFAULT_TURN_POLICY.participatingUsersPerTurn);
  const [participationChance, setParticipationChance] = useState(DEFAULT_TURN_POLICY.participationChance);
  const [organicRatingCountModel, setOrganicRatingCountModel] = useState<RatingCountModel>(DEFAULT_TURN_POLICY.organicRatingCountModel);
  const [organicRatingsPerUser, setOrganicRatingsPerUser] = useState(DEFAULT_TURN_POLICY.organicRatingsPerUser);
  const [organicRatingDice, setOrganicRatingDice] = useState(DEFAULT_TURN_POLICY.organicRatingDice);
  const [guidedRatingCountModel, setGuidedRatingCountModel] = useState<RatingCountModel>(DEFAULT_TURN_POLICY.guidedRatingCountModel);
  const [guidedRecommendationsPerUser, setGuidedRecommendationsPerUser] = useState(DEFAULT_TURN_POLICY.guidedRecommendationsPerUser);
  const [guidedRecommendationDice, setGuidedRecommendationDice] = useState(DEFAULT_TURN_POLICY.guidedRecommendationDice);
  const [routingRiskProfile, setRoutingRiskProfile] = useState<RoutingRiskProfile>(DEFAULT_TURN_POLICY.routingRiskProfile);
  const [customExplorationWeight, setCustomExplorationWeight] = useState(DEFAULT_TURN_POLICY.customRoutingValues.explorationWeight);
  const [customMinimumPredictedFit, setCustomMinimumPredictedFit] = useState(DEFAULT_TURN_POLICY.customRoutingValues.minimumPredictedFit);
  const [turnsToRun, setTurnsToRun] = useState(5);
  const [executionSeedMode, setExecutionSeedMode] = useState<ScenarioExecutionSeedMode>('random');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedIslandId, setSelectedIslandId] = useState<string>('');
  const [comparisonCohortId, setComparisonCohortId] = useState<string>('auto');
  const showDebugInitial = initialGuidanceMode !== 'novice';
  const [showDebug, setShowDebug] = useState(showDebugInitial);
  const [showAbout, setShowAbout] = useState(false);
  const [guidanceMode, setGuidanceMode] = useState<GuidanceMode>(initialGuidanceMode);
  const [guidanceOpen, setGuidanceOpen] = useState(initialGuidanceMode === 'novice');
  const [dashboardOrdering, setDashboardOrdering] = useState<DashboardOrderingPreset>('overview-first');
  const [useCaseId, setUseCaseId] = useState<UseCaseStoryId>('first-time-walkthrough');
  const [modalKind, setModalKind] = useState<SelectionModalKind>(null);
  const [pinnedDrilldownKind, setPinnedDrilldownKind] = useState<PinnedDrilldownKind>(null);
  const [pinnedTrayCollapsed, setPinnedTrayCollapsed] = useState(initialGuidanceMode !== 'novice');
  const [controlsCollapsed, setControlsCollapsed] = useState(false);
  const [dynamicSettingsCollapsed, setDynamicSettingsCollapsed] = useState(initialGuidanceMode === 'novice');
  const [drilldownTargetsCollapsed, setDrilldownTargetsCollapsed] = useState(initialGuidanceMode === 'novice');
  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [importedScenario, setImportedScenario] = useState<SavedWayfarerScenarioV1 | null>(null);
  const [scenarioMessage, setScenarioMessage] = useState<string>('');
  const [scenarioError, setScenarioError] = useState<string>('');
  const [executionProgress, setExecutionProgress] = useState<number>(0);
  const [executionStatus, setExecutionStatus] = useState<string>('');
  const [isExecutingScenario, setIsExecutingScenario] = useState(false);
  const [recentAction, setRecentAction] = useState<RecentActionState | null>(null);
  const [showConfidenceSeries, setShowConfidenceSeries] = useState({
    player: true,
    island: true,
    cohort: false,
    tag: false
  });
  const [primaryWorkflowCollapsed, setPrimaryWorkflowCollapsed] = useState(false);
  const [primaryDetailsCollapsed, setPrimaryDetailsCollapsed] = useState(false);
  const [overviewCollapsed, setOverviewCollapsed] = useState(false);
  const [recoveryCollapsed, setRecoveryCollapsed] = useState(false);
  const [routingCollapsed, setRoutingCollapsed] = useState(false);
  const [debugCollapsed, setDebugCollapsed] = useState(false);
  const scenarioFileInputRef = useRef<HTMLInputElement | null>(null);
  const scenarioExecutionTokenRef = useRef(0);
  const isNoviceMode = guidanceMode === 'novice';

  const latentDataset = useMemo(
    () =>
      buildDataset({
        seed,
        numUsers,
        numIslands,
        tagAlignmentDistribution,
        ratingAlignmentDistribution
      }),
    [numIslands, numUsers, ratingAlignmentDistribution, seed, tagAlignmentDistribution]
  );

  const initialSimulationState = useMemo(
    () =>
      createInitialSimulationState({
        seed,
        allTags: latentDataset.allTags,
        latentUsers: latentDataset.users,
        cohorts: latentDataset.cohorts,
        islands: latentDataset.islands,
        initialRatingsPerUser: bootstrapRatingsPerUser
      }),
    [bootstrapRatingsPerUser, latentDataset, seed]
  );

  const [simulationState, setSimulationState] = useState<SimulationState>(initialSimulationState);

  useEffect(() => {
    if (guidanceMode === 'novice') {
      setGuidanceOpen(true);
      setDynamicSettingsCollapsed(true);
      setDrilldownTargetsCollapsed(true);
      setPinnedTrayCollapsed(false);
      setShowDebug(false);
      return;
    }

    setGuidanceOpen(false);
    setDynamicSettingsCollapsed(false);
    setDrilldownTargetsCollapsed(false);
    setPinnedTrayCollapsed(true);
    setShowDebug(true);
  }, [guidanceMode]);

  useEffect(() => {
    if (pinnedDrilldownKind !== null) {
      setPinnedTrayCollapsed(false);
    }
  }, [pinnedDrilldownKind]);

  const dataset = simulationState;
  const cohortLabels = useMemo(() => labelForCohortFactory(dataset.cohorts), [dataset.cohorts]);

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

  const selectedComparisonLabel = comparisonLabel(selectedUser, selectedComparisonCohort, cohortLabels.full);
  const selectedRaterSignalProfile = selectedUser ? dataset.raterSignalProfiles.get(selectedUser.id) ?? null : null;
  const selectedIslandAffinityReport = selectedIsland ? dataset.islandAffinityReports.get(selectedIsland.id) ?? null : null;
  const selectedIslandRatingCount = selectedIslandAffinityReport?.estimates[0]?.rawCount ?? 0;
  const selectedIslandEffectiveWeight =
    selectedIslandAffinityReport?.topPositive?.effectiveWeight ??
    selectedIslandAffinityReport?.topNegative?.effectiveWeight ??
    selectedIslandAffinityReport?.estimates[0]?.effectiveWeight ??
    0;

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
  const systemHealthSummary = useMemo(() => buildSystemHealthSummary(dataset), [dataset]);

  const selectedInferenceDiagnostics = selectedInference?.diagnosis;
  const effectiveRoutingValues = useMemo(
    () =>
      resolveRoutingRiskProfileValues(routingRiskProfile, {
        explorationWeight: customExplorationWeight,
        minimumPredictedFit: customMinimumPredictedFit
      }),
    [customExplorationWeight, customMinimumPredictedFit, routingRiskProfile]
  );
  const turnModeVisibility = useMemo(() => getTurnModeVisibility(turnMode), [turnMode]);
  const routingOptions = useMemo(
    () => ({
      explorationWeight: effectiveRoutingValues.explorationWeight,
      minPredictedFitFloor: effectiveRoutingValues.minimumPredictedFit,
      topLimit: Math.max(8, guidedRecommendationsPerUser * 2)
    }),
    [effectiveRoutingValues.explorationWeight, effectiveRoutingValues.minimumPredictedFit, guidedRecommendationsPerUser]
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
  const visibleTurnModeLabel = TURN_MODE_LABELS[turnMode];
  const selectedDeclaredCohort =
    selectedInference?.declaredTop.cohortId ? dataset.cohorts.find((cohort) => cohort.id === selectedInference.declaredTop.cohortId) ?? null : null;
  const declaredTagOverlap = selectedUser && selectedDeclaredCohort ? computeDeclaredTagOverlap(selectedUser.declaredTags, selectedDeclaredCohort) : null;
  const declaredDistributionSlices = selectedInference ? collapseDistributionSlices(selectedInference.declaredDistribution, cohortLabels.full, 4) : [];
  const behaviorDistributionSlices = selectedInference ? collapseDistributionSlices(selectedInference.behaviorDistribution, cohortLabels.full, 4) : [];
  const behaviorReadSummary = selectedInference ? summarizeBehaviorRead(selectedInference.behaviorDistribution, selectedInference.behaviorSpecificity) : null;
  const hasBehaviorEvidence = selectedInference ? selectedInference.ratingEvidence >= 0.08 && selectedInference.behaviorMatchStrength >= 0.2 : false;
  const showInverseDiagnostic = selectedInference
    ? shouldPromoteInverseSignal(selectedInference.inverseTop.score, selectedInference.behaviorSpecificity)
    : false;

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
  const runContextNote = isNoviceMode
    ? 'Novice keeps the instructional rails open while expert exposes the resolved controls. Current run badges live in Primary Workflow.'
    : 'Expert keeps the same run-context choices visible and exposes the resolved controls. Current run badges live in Primary Workflow.';

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
          <strong>{cohortLabels.full(row.cohort.id)}</strong>
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
          <strong>{cohortLabels.full(row.cohort.id)}</strong>
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
          <span className="muted">{row.inferredCohortId ? cohortLabels.full(row.inferredCohortId) : 'none'}</span>
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

  const reviewerArchetypeRecoveryDetail = (
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
            <p>Users whose guided routing bias lands early in the turn history.</p>
          </div>
          <ReportTable
            columns={reviewerReportColumns}
            rows={reviewerArchetypeAnalysis.earlyScouts}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => setDrawerState({ type: 'reviewer', userId: row.userId })}
            emptyTitle="No early scouts"
            emptyDescription="Guided turn timing has not yet produced any early-scout patterns."
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

  const reviewerArchetypeSummary = (
    <div className="stack">
      <div className="summary-header">
        <div>
          <p className="eyebrow">Reviewer archetype recovery</p>
          <h3>Hidden generator checksums vs inferred behavior</h3>
        </div>
        <div className="summary-header__actions">
          <button type="button" className="button button--ghost" onClick={() => setDrawerState({ type: 'reviewer-recovery' })}>
            Open full recovery table
          </button>
        </div>
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
            <h3>Candidate New Seed Users</h3>
            <p>Top unexplained high-signal users that deserve closer review.</p>
          </div>
          <div className="recovery-preview-list">
            {reviewerArchetypeAnalysis.candidateSeedUsers.slice(0, 3).map((row) => (
              <button
                key={row.userId}
                type="button"
                className="recovery-preview-row"
                onClick={() => setDrawerState({ type: 'reviewer', userId: row.userId })}
              >
                <div className="recovery-preview-row__main">
                  <div className="recovery-preview-row__title">
                    <strong>{row.label}</strong>
                    <Badge tone={reviewerRecoveryTone(row.recoveryStatus)}>{row.recoveryStatus}</Badge>
                  </div>
                  <span className="muted">
                    {archetypeLabel(row.hiddenReviewerArchetype)} · {row.inferredDiagnosisType}
                  </span>
                </div>
                <div className="recovery-preview-row__meta">
                  <span className="muted">
                    Cohort: {row.inferredCohortId ? cohortLabels.full(row.inferredCohortId) : 'none'}
                  </span>
                  <span className="muted">Signal {formatDecimal(row.effectiveSignal)}</span>
                  {row.analystFlags.length > 0 ? <span className="muted">{row.analystFlags.slice(0, 2).join(' · ')}</span> : null}
                  <span className="recovery-preview-row__action">Open detail</span>
                </div>
              </button>
            ))}
            {reviewerArchetypeAnalysis.candidateSeedUsers.length === 0 ? (
              <EmptyState
                title="No analyst candidates"
                description="This preview fills when the system finds strong signal but weak known-cohort fit."
              />
            ) : null}
          </div>
        </div>

        <div className="report-section__column">
          <div className="section-heading">
            <h3>Early Scouts</h3>
            <p>Top users whose guided routing bias lands early in the turn history.</p>
          </div>
          <div className="recovery-preview-list">
            {reviewerArchetypeAnalysis.earlyScouts.slice(0, 3).map((row) => (
              <button
                key={row.userId}
                type="button"
                className="recovery-preview-row"
                onClick={() => setDrawerState({ type: 'reviewer', userId: row.userId })}
              >
                <div className="recovery-preview-row__main">
                  <div className="recovery-preview-row__title">
                    <strong>{row.label}</strong>
                    <Badge tone={reviewerRecoveryTone(row.recoveryStatus)}>{row.recoveryStatus}</Badge>
                  </div>
                  <span className="muted">
                    {archetypeLabel(row.hiddenReviewerArchetype)} · guided turn bias {formatDecimal(row.guidedTurnBias, 2)}
                  </span>
                </div>
                <div className="recovery-preview-row__meta">
                  <span className="muted">
                    Cohort: {row.inferredCohortId ? cohortLabels.full(row.inferredCohortId) : 'none'}
                  </span>
                  <span className="muted">Signal {formatDecimal(row.effectiveSignal)}</span>
                  {row.analystFlags.length > 0 ? <span className="muted">{row.analystFlags.slice(0, 2).join(' · ')}</span> : null}
                  <span className="recovery-preview-row__action">Open detail</span>
                </div>
              </button>
            ))}
            {reviewerArchetypeAnalysis.earlyScouts.length === 0 ? (
              <EmptyState title="No early scouts" description="Guided turn timing has not yet produced any early-scout patterns." />
            ) : null}
          </div>
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
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              if (selectedUser) {
                setPinnedDrilldownKind('user');
              }
            }}
          >
            Pin current user
          </button>
          <button type="button" className="button button--ghost" onClick={() => setModalKind('user')}>
            Choose user
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
          label="Declared vs observed fit"
          value={selectedInference.signalFit.toFixed(3)}
          helper="How closely declared tags and observed ratings align at the cohort level."
          tone="accent"
        />
        <MetricCard
          label="Rating Evidence"
          value={selectedInference.ratingEvidence.toFixed(3)}
          helper="How much sparse rating data supports this judgment?"
          tone="neutral"
        />
        <MetricCard
          label="Recommendation signal weight"
          value={selectedInference.effectiveSignal.toFixed(3)}
          helper="How strongly this player's ratings should influence routing decisions right now."
          tone="success"
        />
      </div>

      <p className="muted">{buildDeclaredObservedRelationshipText(selectedInference)}</p>

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
        <MetricCard
          label="Target agreement"
          value={
            selectedInference.targetAlignment.ratedCount > 0
              ? `${selectedInference.targetAlignment.agreementCount}/${selectedInference.targetAlignment.ratedCount}`
              : 'No evidence'
          }
          helper={
            selectedInference.targetAlignment.cohortId
              ? `${Math.round(selectedInference.targetAlignment.agreementRate * 100)}% agreement with ${cohortLabels.full(selectedInference.targetAlignment.cohortId)} reference ratings.`
              : 'No reference cohort available for direct target agreement yet.'
          }
          tone={selectedInference.targetAlignment.agreementRate >= 0.7 ? 'success' : selectedInference.targetAlignment.ratedCount > 0 ? 'warning' : 'neutral'}
        />
        <MetricCard
          label="Cohort separability"
          value={selectedInference.cohortSeparability.label}
          helper={selectedInference.cohortSeparability.message}
          tone={
            selectedInference.cohortSeparability.label === 'high'
              ? 'success'
              : selectedInference.cohortSeparability.label === 'moderate'
                ? 'warning'
                : 'neutral'
          }
        />
      </div>

      <p className="muted">
        {selectedInference.targetAlignment.ratedCount === 0
          ? 'Insufficient target-alignment evidence.'
          : selectedInference.targetAlignment.agreementRate >= 0.7 && selectedInference.cohortSeparability.label === 'low'
            ? 'Reliable reviewer, low cohort separation so far.'
            : selectedInference.targetAlignment.agreementRate >= 0.7
              ? 'Reliable reviewer with useful cohort separation.'
              : 'Target agreement is still developing; take more turns to stabilize signal.'}
      </p>

      <div className="summary-distribution-grid">
        <section className="distribution-card">
          <h4>Declared Tag Distribution</h4>
          <p className="muted">Top cohort: {cohortLabels.full(selectedInference.declaredTop.cohortId)}</p>
          <p className="muted">
            {declaredTagOverlap && declaredTagOverlap.total > 0
              ? declaredTagOverlap.isExact
                ? `Exact tag fit · ${declaredTagOverlap.overlap}/${declaredTagOverlap.total} tags`
                : `${declaredTagOverlap.overlap}/${declaredTagOverlap.total} declared tags`
              : 'Declared tag fit unavailable'}
          </p>
          <div className="distribution-card__body">
            <DistributionDonut slices={declaredDistributionSlices} />
            <DistributionLegend slices={declaredDistributionSlices} formatPercent={formatPercent} />
          </div>
        </section>
        <section className="distribution-card">
          <h4>Observed Behavior Distribution</h4>
          {hasBehaviorEvidence ? (
            <>
              <p className="muted">
                {behaviorReadSummary?.headline === 'Top cohort'
                  ? `Top cohort: ${cohortLabels.full(selectedInference.behaviorTop.cohortId)}`
                  : behaviorReadSummary?.headline === 'Tentative leader'
                    ? `Tentative leader: ${cohortLabels.full(selectedInference.behaviorTop.cohortId)}`
                    : behaviorReadSummary?.headline ?? 'No clear leading cohort'}
              </p>
              <p className="muted">{behaviorReadSummary?.message ?? 'Behavior read unavailable'}</p>
              <div className="distribution-card__body">
                <DistributionDonut slices={behaviorDistributionSlices} />
                <DistributionLegend slices={behaviorDistributionSlices} formatPercent={formatPercent} />
              </div>
            </>
          ) : (
            <div className="notice notice--subtle">
              <p><strong>Not enough rating data yet.</strong></p>
              <p>Take a turn to generate observed behavior evidence.</p>
            </div>
          )}
        </section>
      </div>
      <div className="notice notice--subtle">
        {showInverseDiagnostic ? (
          <p>
            Inverse evidence: {cohortLabels.full(selectedInference.inverseTop.cohortId)} at{' '}
            {formatPercent(selectedInference.inverseTop.score)} anti-match signal.
          </p>
        ) : (
          <p>No strong inverse signal.</p>
        )}
      </div>

      <section className="detail-block">
        <div className="section-heading">
          <h4>Rater signal profile</h4>
          <p>Cohort-local signal only. No tag-level trust weights are calculated here.</p>
        </div>
        <div className="metric-grid metric-grid--compact">
          <MetricCard
            label="Top behavioral signal"
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
            value={cohortLabels.full(selectedRaterSignalProfile?.topCohortId ?? null)}
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
            Open top route
          </button>
          <button type="button" className="button button--ghost" onClick={() => setModalKind('user')}>
            Choose user
          </button>
        </div>
      </div>

      <div className="metric-grid metric-grid--compact">
        <MetricCard
          label="Routing mode"
          value={visibleTurnModeLabel}
          helper="Recommendations only route unrated islands, then the next turn updates the event log."
          tone={turnMode === 'guided' ? 'accent' : 'neutral'}
        />
        <MetricCard
          label="Routing profile"
          value={ROUTING_RISK_PROFILE_LABELS[routingRiskProfile]}
          helper={describeRoutingRiskProfile(routingRiskProfile, DEFAULT_TURN_POLICY.customRoutingValues)}
        />
        <MetricCard
          label="Exploration weight"
          value={formatDecimal(effectiveRoutingValues.explorationWeight, 2)}
          helper="How much discovery value can influence the final route score."
        />
        <MetricCard
          label="Minimum predicted fit"
          value={formatDecimal(effectiveRoutingValues.minimumPredictedFit, 2)}
          helper="Safety gate for guided routing."
        />
        <MetricCard
          label="Guided recommendations / user"
          value={guidedRecommendationsPerUser}
          helper="How many unrated islands each participating user can receive per guided turn."
        />
      </div>

      <ReportTable
        columns={recommendationColumns}
        rows={selectedUserRecommendations}
        getRowKey={(row) => row.islandId}
        onRowClick={(row) => setDrawerState({ type: 'recommendation', userId: selectedUser.id, islandId: row.islandId })}
        emptyTitle="No unrated recommendations"
        emptyDescription="The current user has no unrated islands that clear the minimum predicted fit."
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
            Open island detail
          </button>
          <button type="button" className="button button--ghost" onClick={() => setModalKind('island')}>
            Choose island
          </button>
        </div>
      </div>

      <div className="metric-grid metric-grid--compact">
        <MetricCard label="User rating" value={formatRating(selectedComparisonUserRating)} helper="Visible rating from the selected user." />
        <MetricCard
          label="Comparison cohort"
          value={selectedComparisonLabel}
          helper="Analyst-facing cohort identity used for this side-by-side island comparison."
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
        <section className="distribution-card">
          <h4>Directional audience affinity</h4>
          <p className="muted">Directional audience fit only, not a recommendation guarantee or moderation verdict.</p>
          <DivergingAffinityBars
            rows={affinityRows.map((row) => ({
              label: cohortLabels.full(row.cohort.id),
              affinity: row.estimate.affinity,
              confidence: row.estimate.confidence,
              evidence: row.estimate.effectiveWeight
            }))}
            formatSigned={formatSignedDecimal}
            formatPercent={formatPercent}
            formatDecimal={formatDecimal}
          />
        </section>
        <div className="metric-grid metric-grid--compact">
          <MetricCard
            label="Affinity evidence"
            value={formatDecimal(selectedIslandEffectiveWeight)}
            helper="Effective rater signal backing this estimate. Low evidence means treat affinity direction as tentative."
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
        <p className="muted">Top cohort: {cohortLabels.full(selectedRaterSignalProfile?.topCohortId ?? null)}</p>
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
        <p>Hidden seed: {selectedUser.hiddenSeedCohortId ? cohortLabels.full(selectedUser.hiddenSeedCohortId) : 'none'}</p>
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

  const selectedCohortDetail = selectedComparisonCohort ? (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>Cohort</h4>
        <p>{selectedComparisonCohort.label}</p>
        <p className="muted">Comparison label: {selectedComparisonLabel}</p>
      </section>
      <section className="detail-block">
        <h4>Visible tags</h4>
        <div className="badge-row">
          {selectedComparisonCohort.tags.map((tag) => (
            <Badge key={tag} tone="accent">
              {tag}
            </Badge>
          ))}
        </div>
      </section>
      <section className="detail-block">
        <h4>Source</h4>
        <p>{selectedComparisonCohort.source === 'meta_moderator' ? 'Trusted seed cohort anchor' : 'Analyst-defined cohort'}</p>
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
              <span>{cohortLabels.full(entry.cohortId)}</span>
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
          report before the next turn. The same routing path can feed either organic exploration or guided discovery turns.
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
        <p>Inferred cohort: {selectedReviewerReport.inferredCohortId ? cohortLabels.full(selectedReviewerReport.inferredCohortId) : 'none'}</p>
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
        labelForCohort={cohortLabels.full}
      />

      <DistributionList
        title="Behavior distribution"
        entries={selectedInference.behaviorDistribution}
        labelForCohort={cohortLabels.full}
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
        labelForCohort={cohortLabels.full}
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
              ? cohortLabels.full(selectedInference.diagnosis.suggestedCohortId)
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

  const openSelectionButton = (
    kind: Exclude<SelectionModalKind, null>,
    label: string,
    className = 'button button--ghost',
    disabled = isExecutingScenario
  ) => (
    <button type="button" className={className} onClick={() => setModalKind(kind)} disabled={disabled}>
      {label}
    </button>
  );

  const labeledControl = (label: string, help: string) => (
    <span className="control__label-row">
      <span>{label}</span>
      <InfoTip label={`${label} help`} text={help} />
    </span>
  );

  const applyScenarioPresetSelection = (presetId: ScenarioPresetId) => {
    const preset = getScenarioPreset(presetId);
    const controls = applyScenarioPreset(preset);

    setImportedScenario(null);
    setScenarioError('');
    setScenarioMessage('');
    setExecutionStatus('');
    setExecutionProgress(0);
    setIsExecutingScenario(false);
    setScenarioPresetSource(getScenarioPresetMetadata(preset.id));
    setSeed(controls.seed);
    setNumUsers(controls.numUsers);
    setNumIslands(controls.numIslands);
    setBootstrapRatingsPerUser(controls.bootstrapRatingsPerUser);
    setTagAlignmentDistribution(controls.tagAlignmentDistribution);
    setRatingAlignmentDistribution(controls.ratingAlignmentDistribution);
    setTurnMode(controls.turnPolicy.turnMode);
    setParticipationModel(controls.turnPolicy.participationModel);
    setParticipatingUsersPerTurn(controls.turnPolicy.participatingUsersPerTurn);
    setParticipationChance(controls.turnPolicy.participationChance);
    setOrganicRatingCountModel(controls.turnPolicy.organicRatingCountModel);
    setOrganicRatingsPerUser(controls.turnPolicy.organicRatingsPerUser);
    setOrganicRatingDice(controls.turnPolicy.organicRatingDice);
    setGuidedRatingCountModel(controls.turnPolicy.guidedRatingCountModel);
    setGuidedRecommendationsPerUser(controls.turnPolicy.guidedRecommendationsPerUser);
    setGuidedRecommendationDice(controls.turnPolicy.guidedRecommendationDice);
    setRoutingRiskProfile(controls.turnPolicy.routingRiskProfile);
    setCustomExplorationWeight(controls.turnPolicy.customExplorationWeight);
    setCustomMinimumPredictedFit(controls.turnPolicy.customMinimumPredictedFit);
    setTurnsToRun(controls.turnsToRun);
  };

  const exportCurrentSimulationJson = () => {
    const scenarioPreset = scenarioPresetSource ?? activeScenarioPresetMetadata ?? null;
    const savedScenario = exportSavedWayfarerScenario({
      label: `Wayfarer turn ${simulationState.currentTurn}`,
      createdAt: new Date().toISOString(),
      scenarioPreset,
      generatorConfig: {
        seed,
        numUsers,
        numIslands,
        bootstrapRatingsPerUser,
        tagAlignmentDistribution,
        ratingAlignmentDistribution
      },
      turnPolicy: currentTurnPolicy,
      turnsToRun,
      simulationState
  });
    const blob = new Blob([`${JSON.stringify(savedScenario, null, 2)}\n`], { type: 'application/json' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const fileName = `wayfarer-turn-${String(simulationState.currentTurn).padStart(3, '0')}.json`;

    link.href = objectUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(objectUrl);
    setScenarioError('');
    setScenarioMessage(`Exported ${fileName}`);
    setRecentAction({
      kind: 'scenario-exported',
      scenarioLabel: currentScenarioLabel,
      turnModeLabel: TURN_MODE_LABELS[turnMode],
      previousTurn: simulationState.currentTurn,
      currentTurn: simulationState.currentTurn,
      latestTurnSummary: simulationState.turnHistory[simulationState.turnHistory.length - 1] ?? null,
      exportFileName: fileName
    });
  };

  const importScenarioFromFile = async (file: File) => {
    const result = parseSavedWayfarerScenario(await file.text());

    if (!result.ok) {
      setScenarioError(result.error);
      setScenarioMessage('');
      return;
    }

    const { scenario, restoredState } = result;
    const importedPresetMatch = resolveScenarioPresetFromControls({
      seed: scenario.generatorConfig.seed,
      numUsers: scenario.generatorConfig.numUsers,
      numIslands: scenario.generatorConfig.numIslands,
      bootstrapRatingsPerUser: scenario.generatorConfig.bootstrapRatingsPerUser,
      tagAlignmentDistribution: scenario.generatorConfig.tagAlignmentDistribution,
      ratingAlignmentDistribution: scenario.generatorConfig.ratingAlignmentDistribution,
      islandClassWeights: scenario.generatorConfig.islandClassWeights,
      turnPolicy: scenario.turnPolicy,
      turnsToRun: scenario.turnsToRun
    });
    setImportedScenario(scenario);
    setExecutionStatus('');
    setExecutionProgress(0);
    setIsExecutingScenario(false);
    setScenarioPresetSource(scenario.scenarioPreset ?? (importedPresetMatch ? scenarioPresetMetadataFromPreset(importedPresetMatch) : null));
    setSeed(scenario.generatorConfig.seed);
    setNumUsers(scenario.generatorConfig.numUsers);
    setNumIslands(scenario.generatorConfig.numIslands);
    setBootstrapRatingsPerUser(scenario.generatorConfig.bootstrapRatingsPerUser);
    setTagAlignmentDistribution(scenario.generatorConfig.tagAlignmentDistribution);
    setRatingAlignmentDistribution(scenario.generatorConfig.ratingAlignmentDistribution);
    setTurnMode(scenario.turnPolicy.turnMode);
    setParticipationModel(scenario.turnPolicy.participationModel);
    setParticipatingUsersPerTurn(scenario.turnPolicy.participatingUsersPerTurn);
    setParticipationChance(scenario.turnPolicy.participationChance);
    setOrganicRatingCountModel(scenario.turnPolicy.organicRatingCountModel);
    setOrganicRatingsPerUser(scenario.turnPolicy.organicRatingsPerUser);
    setOrganicRatingDice(scenario.turnPolicy.organicRatingDice);
    setGuidedRatingCountModel(scenario.turnPolicy.guidedRatingCountModel);
    setGuidedRecommendationsPerUser(scenario.turnPolicy.guidedRecommendationsPerUser);
    setGuidedRecommendationDice(scenario.turnPolicy.guidedRecommendationDice);
    setRoutingRiskProfile(scenario.turnPolicy.routingRiskProfile);
    setCustomExplorationWeight(scenario.turnPolicy.customExplorationWeight);
    setCustomMinimumPredictedFit(scenario.turnPolicy.customMinimumPredictedFit);
    setTurnsToRun(scenario.turnsToRun);
    setSimulationState(restoredState);
    setScenarioError('');
    setScenarioMessage(
      scenario.scenarioPreset
        ? `Imported ${scenario.label} from ${scenario.scenarioPreset.label}`
        : `Imported ${scenario.label}`
    );
    setRecentAction({
      kind: 'scenario-imported',
      scenarioLabel: scenario.scenarioPreset?.label ?? importedPresetMatch?.label ?? 'Custom / imported',
      turnModeLabel: TURN_MODE_LABELS[scenario.turnPolicy.turnMode],
      previousTurn: restoredState.currentTurn,
      currentTurn: restoredState.currentTurn,
      latestTurnSummary: restoredState.turnHistory[restoredState.turnHistory.length - 1] ?? null
    });
  };

  const handleScenarioFileChange = async (event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    await importScenarioFromFile(file);
  };

  const openScenarioFilePicker = () => {
    scenarioFileInputRef.current?.click();
  };

  const executeScenario = async () => {
    if (isExecutingScenario) {
      return;
    }

    const nextSeed = executionSeedMode === 'random' ? Math.floor(Math.random() * 1_000_000_000) : seed;
    const selectedScenarioPresetSource = scenarioPresetSource ?? activeScenarioPresetMetadata ?? null;
    const resolvedControls: ScenarioPresetControls = {
      ...currentScenarioControls,
      seed: nextSeed
    };
    const executionLabel = selectedScenarioPresetSource?.label ?? 'Custom / imported';
    const executionToken = scenarioExecutionTokenRef.current + 1;
    scenarioExecutionTokenRef.current = executionToken;

    setImportedScenario(null);
    setScenarioError('');
    setScenarioMessage('');
    setExecutionStatus('Generating fresh scenario from the selected setup.');
    setExecutionProgress(0.08);
    setIsExecutingScenario(true);

    setSeed(nextSeed);
    setScenarioPresetSource(selectedScenarioPresetSource);

    try {
      setExecutionStatus('Building the dataset and bootstrap state.');

      const initialState = buildSimulationStateFromControls(resolvedControls);
      setSimulationState(initialState);
      setExecutionProgress(0.25);
      await new Promise((resolve) => setTimeout(resolve, 32));

      let nextState = initialState;

      for (let index = 0; index < turnsToRun; index += 1) {
        if (scenarioExecutionTokenRef.current !== executionToken) {
          return;
        }

        setExecutionStatus(`Advancing turn ${index + 1} of ${turnsToRun}.`);
        nextState = advanceCurrentTurn(nextState);
        setSimulationState(nextState);
        setExecutionProgress(0.25 + ((index + 1) / Math.max(turnsToRun, 1)) * 0.7);
        await new Promise((resolve) => setTimeout(resolve, 32));
      }

      if (scenarioExecutionTokenRef.current !== executionToken) {
        return;
      }

      setSimulationState(nextState);
      setScenarioMessage(`Executed ${executionLabel} with seed ${nextSeed} for ${turnsToRun} turns.`);
      setExecutionStatus('Scenario execution complete.');
      setExecutionProgress(1);
      setRecentAction({
        kind: 'scenario-executed',
        scenarioLabel: executionLabel,
        turnModeLabel: TURN_MODE_LABELS[resolvedControls.turnPolicy.turnMode],
        previousTurn: 0,
        currentTurn: nextState.currentTurn,
        latestTurnSummary: nextState.turnHistory[nextState.turnHistory.length - 1] ?? null,
        batchSize: turnsToRun
      });
    } finally {
      if (scenarioExecutionTokenRef.current === executionToken) {
        setIsExecutingScenario(false);
      }
    }
  };

  const takeSingleTurn = () => {
    setSimulationState((state) => {
      const nextState = advanceCurrentTurn(state);
      setRecentAction({
        kind: 'turn-advanced',
        scenarioLabel: currentScenarioLabel,
        turnModeLabel: TURN_MODE_LABELS[turnMode],
        previousTurn: state.currentTurn,
        currentTurn: nextState.currentTurn,
        latestTurnSummary: nextState.turnHistory[nextState.turnHistory.length - 1] ?? null
      });
      return nextState;
    });
  };

  const takeBatchTurns = () => {
    setSimulationState((state) => {
      let next = state;

      for (let index = 0; index < turnsToRun; index += 1) {
        next = advanceCurrentTurn(next);
      }

      setRecentAction({
        kind: 'batch-turns-advanced',
        scenarioLabel: currentScenarioLabel,
        turnModeLabel: TURN_MODE_LABELS[turnMode],
        previousTurn: state.currentTurn,
        currentTurn: next.currentTurn,
        latestTurnSummary: next.turnHistory[next.turnHistory.length - 1] ?? null,
        batchSize: turnsToRun
      });

      return next;
    });
  };

  const resetSimulation = () => {
    setImportedScenario(null);
    setScenarioMessage('');
    setScenarioError('');
    setExecutionStatus('');
    setExecutionProgress(0);
    setIsExecutingScenario(false);
    resetControlPolicy();
    const defaultBootstrap = buildDataset({
      seed: INITIAL_SCENARIO_PRESET.generatorConfig.seed,
      numUsers: INITIAL_SCENARIO_PRESET.generatorConfig.numUsers,
      numIslands: INITIAL_SCENARIO_PRESET.generatorConfig.numIslands,
      tagAlignmentDistribution: INITIAL_SCENARIO_PRESET.generatorConfig.tagAlignmentDistribution,
      ratingAlignmentDistribution: INITIAL_SCENARIO_PRESET.generatorConfig.ratingAlignmentDistribution
    });
    setSimulationState(
      createInitialSimulationState({
        seed: INITIAL_SCENARIO_PRESET.generatorConfig.seed,
        allTags: defaultBootstrap.allTags,
        latentUsers: defaultBootstrap.users,
        cohorts: defaultBootstrap.cohorts,
        islands: defaultBootstrap.islands,
        initialRatingsPerUser: INITIAL_SCENARIO_PRESET.generatorConfig.bootstrapRatingsPerUser
      })
    );
    setRecentAction({
      kind: 'simulation-reset',
      scenarioLabel: INITIAL_SCENARIO_PRESET.label,
      turnModeLabel: TURN_MODE_LABELS[INITIAL_SCENARIO_PRESET.turnPolicy.turnMode],
      previousTurn: simulationState.currentTurn,
      currentTurn: 0,
      latestTurnSummary: null
    });
  };

  const resetControlPolicy = () => {
    applyScenarioPresetSelection(INITIAL_SCENARIO_PRESET.id);
  };

  const currentTurnPolicy = useMemo(
    () => ({
      turnMode,
      participationModel,
      participatingUsersPerTurn,
      participationChance,
      organicRatingCountModel,
      organicRatingsPerUser,
      organicRatingDice,
      guidedRatingCountModel,
      guidedRecommendationsPerUser,
      guidedRecommendationDice,
      routingRiskProfile,
      customExplorationWeight,
      customMinimumPredictedFit
    }),
    [
      customExplorationWeight,
      customMinimumPredictedFit,
      guidedRatingCountModel,
      guidedRecommendationDice,
      guidedRecommendationsPerUser,
      organicRatingCountModel,
      organicRatingDice,
      organicRatingsPerUser,
      participationChance,
      participationModel,
      participatingUsersPerTurn,
      routingRiskProfile,
      turnMode
    ]
  );

  const currentScenarioControls = useMemo<ScenarioPresetControls>(
    () => ({
      seed,
      numUsers,
      numIslands,
      bootstrapRatingsPerUser,
      tagAlignmentDistribution,
      ratingAlignmentDistribution,
      turnPolicy: currentTurnPolicy,
      turnsToRun
    }),
    [
      bootstrapRatingsPerUser,
      currentTurnPolicy,
      numIslands,
      numUsers,
      ratingAlignmentDistribution,
      seed,
      tagAlignmentDistribution,
      turnsToRun
    ]
  );

  useEffect(() => {
    if (importedScenario) {
      const importedControls = {
        seed: importedScenario.generatorConfig.seed,
        numUsers: importedScenario.generatorConfig.numUsers,
        numIslands: importedScenario.generatorConfig.numIslands,
        bootstrapRatingsPerUser: importedScenario.generatorConfig.bootstrapRatingsPerUser,
        tagAlignmentDistribution: importedScenario.generatorConfig.tagAlignmentDistribution,
        ratingAlignmentDistribution: importedScenario.generatorConfig.ratingAlignmentDistribution,
        turnPolicy: importedScenario.turnPolicy,
        turnsToRun: importedScenario.turnsToRun
      };
      const importedMatchesCurrent =
        importedControls.seed === currentScenarioControls.seed &&
        importedControls.numUsers === currentScenarioControls.numUsers &&
        importedControls.numIslands === currentScenarioControls.numIslands &&
        importedControls.bootstrapRatingsPerUser === currentScenarioControls.bootstrapRatingsPerUser &&
        JSON.stringify(importedControls.tagAlignmentDistribution) === JSON.stringify(currentScenarioControls.tagAlignmentDistribution) &&
        JSON.stringify(importedControls.ratingAlignmentDistribution) === JSON.stringify(currentScenarioControls.ratingAlignmentDistribution) &&
        importedControls.turnPolicy.turnMode === currentScenarioControls.turnPolicy.turnMode &&
        importedControls.turnPolicy.participationModel === currentScenarioControls.turnPolicy.participationModel &&
        importedControls.turnPolicy.participatingUsersPerTurn === currentScenarioControls.turnPolicy.participatingUsersPerTurn &&
        importedControls.turnPolicy.participationChance === currentScenarioControls.turnPolicy.participationChance &&
        importedControls.turnPolicy.organicRatingCountModel === currentScenarioControls.turnPolicy.organicRatingCountModel &&
        importedControls.turnPolicy.organicRatingsPerUser === currentScenarioControls.turnPolicy.organicRatingsPerUser &&
        importedControls.turnPolicy.organicRatingDice === currentScenarioControls.turnPolicy.organicRatingDice &&
        importedControls.turnPolicy.guidedRatingCountModel === currentScenarioControls.turnPolicy.guidedRatingCountModel &&
        importedControls.turnPolicy.guidedRecommendationsPerUser === currentScenarioControls.turnPolicy.guidedRecommendationsPerUser &&
        importedControls.turnPolicy.guidedRecommendationDice === currentScenarioControls.turnPolicy.guidedRecommendationDice &&
        importedControls.turnPolicy.routingRiskProfile === currentScenarioControls.turnPolicy.routingRiskProfile &&
        importedControls.turnPolicy.customExplorationWeight === currentScenarioControls.turnPolicy.customExplorationWeight &&
        importedControls.turnPolicy.customMinimumPredictedFit === currentScenarioControls.turnPolicy.customMinimumPredictedFit &&
        importedControls.turnsToRun === currentScenarioControls.turnsToRun;

      if (!importedMatchesCurrent) {
        setImportedScenario(null);
        setScenarioMessage('');
        setScenarioError('');
        setSimulationState(initialSimulationState);
        return;
      }

      setSimulationState(hydrateSimulationState(importedScenario.simulationState));
      return;
    }

    setSimulationState(initialSimulationState);
  }, [currentScenarioControls, importedScenario, initialSimulationState]);

  const activeScenarioPreset = useMemo(
    () => resolveScenarioPresetFromControls(currentScenarioControls),
    [currentScenarioControls]
  );
  const activeScenarioPresetMetadata = activeScenarioPreset ? scenarioPresetMetadataFromPreset(activeScenarioPreset) : null;
  const scenarioPresetDisplay =
    activeScenarioPreset ?? (scenarioPresetSource ? (getScenarioPreset(scenarioPresetSource.id as ScenarioPresetId) ?? null) : null);
  const scenarioPresetSourceNote =
    scenarioPresetSource && (!activeScenarioPresetMetadata || scenarioPresetSource.id !== activeScenarioPresetMetadata.id)
      ? scenarioPresetSource
      : null;
  const currentScenarioLabel = scenarioPresetDisplay?.label ?? scenarioPresetSource?.label ?? 'Custom / imported';

  const advanceCurrentTurn = (state: SimulationState) => {
    return advancePolicyTurn(state, currentTurnPolicy);
  };

  const stageTopRecommendation = selectedUserRecommendations[0] ?? null;
  const participationDisplay =
    participationModel === 'fixed-count'
      ? `${participatingUsersPerTurn} users`
      : `${Math.round(participationChance * 100)}% chance`;
  const routingSurfaceLabel = stageTopRecommendation
    ? dataset.islands.find((island) => island.id === stageTopRecommendation.islandId)?.label ?? stageTopRecommendation.islandId
    : 'No routed island';

  const dashboardSections: Record<DashboardPanelGroupKey, { title: string; panels: JSX.Element[] }> = {
    overview: {
      title: 'Overview',
      panels: [
        <Panel key="turn-summary" title="Turn Summary" className="panel--full">
          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Current turn" value={dataset.currentTurn} tone="accent" />
            <MetricCard
              label="Mode"
              value={
                currentTurnSummary?.mode === 'guided'
                  ? TURN_MODE_LABELS.guided
                  : currentTurnSummary?.mode === 'mixed'
                    ? TURN_MODE_LABELS.mixed
                    : TURN_MODE_LABELS.organic
              }
              helper="How the most recent turn created rating events."
            />
            <MetricCard label="Rating events" value={dataset.ratingEvents.length} />
            <MetricCard label="Ratings this turn" value={currentTurnSummary?.ratingsCreated ?? 0} />
            <MetricCard label="Organic events this turn" value={currentTurnSummary?.organicRatingsCreated ?? 0} />
            <MetricCard label="Guided events this turn" value={currentTurnSummary?.guidedRatingsCreated ?? 0} />
            <MetricCard
              label="Participating users this turn"
              value={currentTurnSummary?.participatingUserIds.length ?? 0}
            />
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
                Turn {turn.turn}:{' '}
                {turn.mode === 'guided'
                  ? TURN_MODE_LABELS.guided
                  : turn.mode === 'mixed'
                    ? TURN_MODE_LABELS.mixed
                    : TURN_MODE_LABELS.organic} ·{' '}
                {turn.ratingsCreated} ratings
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
            <MetricCard label="High signal users" value={populationSummary.highSignal} />
            <MetricCard label="Retag candidates" value={populationSummary.retagCandidates} tone="warning" />
            <MetricCard label="Inverse profiles" value={populationSummary.inverseProfiles} tone="danger" />
            <MetricCard label="Unknown / noisy" value={populationSummary.noisyUsers} />
            <MetricCard label="Pseudo-cohort reports" value={populationSummary.pseudoReports} />
          </div>
        </Panel>,
        <SystemHealthPanel
          key="system-health"
          summary={systemHealthSummary}
          showConfidenceSeries={showConfidenceSeries}
          onToggleSeries={(key) => setShowConfidenceSeries((current) => ({ ...current, [key]: !current[key] }))}
        />
      ]
    },
    recovery: {
      title: 'Recovery',
      panels: [
        <Panel key="selected-user" title="Selected User Summary" className="panel--wide">
          {selectedUser && selectedInference ? selectedUserSummary : <EmptyState title="No user selected" description="Open the user picker to inspect an individual user." />}
        </Panel>,
        <Panel key="reviewer-archetype" title="Reviewer Archetype Recovery" className="panel--wide">
          {reviewerArchetypeSummary}
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
        ...(isNoviceMode
          ? []
          : [
              <Panel key="model-explanation" title="Model Explanation" className="panel--wide">
                {modelExplanation}
              </Panel>,
              <Panel key="island-comparison" title="Island Comparison" className="panel--wide">
                {islandComparison}
              </Panel>,
              <Panel key="pseudo-cohorts" title="Pseudo-Cohort Reports" className="panel--wide">
                <div className="section-toolbar">
                  <button type="button" className="button button--ghost" onClick={() => setModalKind('pseudo')}>
                    Choose report row
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
            ])
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
                    value={selectedUser.hiddenSeedCohortId ? cohortLabels.full(selectedUser.hiddenSeedCohortId) : 'none'}
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

  const showInstructionTray = guidanceMode === 'novice';

  const pinnedDrilldownContent =
    pinnedDrilldownKind === 'user'
      ? selectedUserDetail
      : pinnedDrilldownKind === 'island'
        ? selectedIslandDetail
        : pinnedDrilldownKind === 'cohort'
          ? selectedCohortDetail
          : null;

  const pinnedDrilldownTitle =
    pinnedDrilldownKind === 'user'
      ? `Pinned user: ${selectedUser?.label ?? 'none'}`
      : pinnedDrilldownKind === 'island'
        ? `Pinned island: ${selectedIsland?.label ?? 'none'}`
      : pinnedDrilldownKind === 'cohort'
        ? `Pinned cohort: ${selectedComparisonLabel}`
        : 'Pinned reference';

  const railTop = '140px';
  const railHeight = 'calc(100vh - 158px)';
  const pinnedTraySpace = pinnedTrayCollapsed ? 92 : 456;
  const instructionTraySpace = showInstructionTray ? (guidanceOpen ? 456 : 92) : 0;

  return (
    <main
      className="app-shell analyst-console"
      style={{
        ['--left-tray-space' as string]: `${instructionTraySpace}px`,
        ['--right-tray-space' as string]: `${pinnedTraySpace}px`
      }}
    >
      <header className="hero">
        <div className="hero__eyebrow-row">
          <p className="eyebrow">Wayfarer analyst console</p>
          <span className="hero__pill">Columbus debug engine</span>
        </div>
        <div className="hero__title-row">
          <h1>Wayfarer</h1>
          <button type="button" className="button button--ghost hero__about-button" onClick={() => setShowAbout(true)}>
            Open About
          </button>
        </div>
        <p className="subtitle">
          Browser-based analyst console for cohort recovery, guided routing, and island-fit evidence on a widescreen
          desktop canvas.
        </p>
      </header>

      <section className="topbar" aria-label="Run context">
        <div className="topbar__header">
          <p className="eyebrow">Run Context</p>
          <p className="topbar__mode-note">{runContextNote}</p>
        </div>
        <div className="topbar__controls">
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
            <span>Read path</span>
            <select value={dashboardOrdering} onChange={(event) => setDashboardOrdering(event.target.value as DashboardOrderingPreset)}>
              {Object.entries(DASHBOARD_ORDERING_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="control control--inline control--wide">
            <span>Demo narrative</span>
            <select value={useCaseId} onChange={(event) => setUseCaseId(event.target.value as UseCaseStoryId)}>
              {USE_CASE_STORIES.map((story) => (
                <option key={story.id} value={story.id}>
                  {story.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="top-stack" aria-label="Controls and drilldown">
        <CollapsiblePanel
          title="Scenario setup"
          collapsed={controlsCollapsed}
          onToggle={() => setControlsCollapsed((value) => !value)}
          description="Named scenario presets and stable settings for the simulation world."
        >
          <div className="stack">
            <div className="control-strip__preset">
              <div className="control-strip__preset-main">
                <label className="control control--preset">
                  <span className="control__label-row">
                    <span>Scenario preset</span>
                    <InfoTip
                      label="Scenario preset help"
                      text="These scenarios are defined in src/data/scenario-catalog.json. Edit that JSON to change the named presets."
                    />
                  </span>
                  <select
                    value={scenarioPresetSource?.id ?? activeScenarioPreset?.id ?? 'custom'}
                    onChange={(event) => {
                      const nextPresetId = event.target.value as ScenarioPresetId | 'custom';
                      if (nextPresetId !== 'custom') {
                        applyScenarioPresetSelection(nextPresetId);
                      }
                    }}
                  >
                    <option value="custom" disabled>
                      Custom / imported
                    </option>
                    {SCENARIO_PRESET_OPTIONS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="control-strip__preset-frame">
                  <div className="control-strip__preset-frame-header">
                    <span className="control__label-row">
                      <span>Preset details</span>
                    </span>
                  </div>
                  <div className="control-strip__preset-copy">
                    <p>{scenarioPresetDisplay?.goodFor ?? 'Custom / imported scenario with no named preset match.'}</p>
                    <p className="muted">
                      {scenarioPresetDisplay?.description ??
                        'This scenario has been edited away from a named preset, or it was imported as a custom case.'}
                    </p>
                    {scenarioPresetSourceNote ? <p className="muted">Based on: {scenarioPresetSourceNote.label}</p> : null}
                  </div>
                </div>
              </div>
            </div>
            {!isNoviceMode ? (
              <>
                <div className="control-strip__fields">
                  <label className="control">
                    {labeledControl(
                      'Seed',
                      'Controls the reproducible random number stream for the generated world and turns.'
                    )}
                    <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value))} min={0} step={1} />
                  </label>
                  <label className="control">
                    {labeledControl('Users', 'How many synthetic users the generator creates.')}
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
                    {labeledControl('Islands', 'How many synthetic islands exist in the generated world.')}
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
                    {labeledControl(
                      'Bootstrap Ratings / User',
                      'Initial sparse rating events created at Turn 0. These are evidence, not signal.'
                    )}
                    <input
                      type="number"
                      value={bootstrapRatingsPerUser}
                      onChange={(event) => setBootstrapRatingsPerUser(Number(event.target.value))}
                      min={1}
                      max={12}
                      step={1}
                    />
                  </label>
                  <label className="control">
                    {labeledControl('Tag Alignment', 'Distribution used when generating hidden tag alignment for users.')}
                    <select
                      value={JSON.stringify(tagAlignmentDistribution)}
                      onChange={(event) => setTagAlignmentDistribution(JSON.parse(event.target.value) as typeof tagAlignmentDistribution)}
                    >
                      <option value={JSON.stringify({ kind: 'uniform', min: 2, max: 10 })}>Uniform 2-10</option>
                      <option value={JSON.stringify({ kind: 'uniform', min: 6, max: 10 })}>Uniform 6-10</option>
                      <option value={JSON.stringify({ kind: 'uniform', min: 8, max: 10 })}>Uniform 8-10</option>
                      <option value={JSON.stringify({ kind: 'uniform', min: 0, max: 5 })}>Uniform 0-5</option>
                    </select>
                  </label>
                  <label className="control">
                    {labeledControl('Rating Alignment', 'Distribution used when generating hidden rating alignment for users.')}
                    <select
                      value={JSON.stringify(ratingAlignmentDistribution)}
                      onChange={(event) => setRatingAlignmentDistribution(JSON.parse(event.target.value) as typeof ratingAlignmentDistribution)}
                    >
                      <option value={JSON.stringify({ kind: 'uniform', min: 2, max: 10 })}>Uniform 2-10</option>
                      <option value={JSON.stringify({ kind: 'uniform', min: 6, max: 10 })}>Uniform 6-10</option>
                      <option value={JSON.stringify({ kind: 'uniform', min: 8, max: 10 })}>Uniform 8-10</option>
                      <option value={JSON.stringify({ kind: 'uniform', min: 0, max: 5 })}>Uniform 0-5</option>
                    </select>
                  </label>
                  <label className="control">
                    {labeledControl('Turn Mode', 'Choose Organic Exploration, Guided Discovery, or Mixed. This stays visible in setup.')}
                    <select value={turnMode} onChange={(event) => setTurnMode(event.target.value as TurnMode)}>
                      {Object.entries(TURN_MODE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="control">
                    {labeledControl(
                      'Participation Model',
                      'Choose whether the turn uses a fixed number of participating users or a chance-per-user rule.'
                    )}
                    <select value={participationModel} onChange={(event) => setParticipationModel(event.target.value as ParticipationModel)}>
                      {Object.entries(PARTICIPATION_MODEL_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="control">
                    {labeledControl('Turns to Run', 'How many turns are advanced when you click Take X Turns.')}
                    <input
                      type="number"
                      value={turnsToRun}
                      onChange={(event) => setTurnsToRun(Number(event.target.value))}
                      min={1}
                      max={20}
                      step={1}
                    />
                  </label>
                  <label className="control">
                    {labeledControl(
                      'Seed on execute',
                      'Choose whether Execute Scenario uses a fresh random seed or the current seed value.'
                    )}
                    <select
                      value={executionSeedMode}
                      onChange={(event) => setExecutionSeedMode(event.target.value as ScenarioExecutionSeedMode)}
                    >
                      <option value="random">Fresh random seed</option>
                      <option value="fixed">Current seed</option>
                    </select>
                  </label>
                </div>
              </>
            ) : null}
          </div>
          <div className="control-strip__actions">
            <div className="control-strip__execute">
              <button
                type="button"
                className="button button--primary"
                onClick={executeScenario}
                disabled={isExecutingScenario}
              >
                Execute Scenario
              </button>
              <p className="muted">
                Generate a fresh dataset from the selected setup, then run {turnsToRun} turns to the next inspection
                state.
              </p>
              {isExecutingScenario ? (
                <ProgressBar value={executionProgress} label={executionStatus || 'Executing scenario'} tone="accent" />
              ) : null}
            </div>
            <div className="control-strip__subframe">
              <div className="control-strip__subframe-heading">
                <span className="control__label-row">
                  <span className="eyebrow">Simulation JSON</span>
                  <InfoTip
                    label="Simulation JSON help"
                    text="Save or reload the current resolved scenario and simulation state."
                  />
                </span>
              </div>
              <div className="control-strip__action-group control-strip__action-group--compact">
                <button type="button" className="button button--ghost" onClick={exportCurrentSimulationJson} disabled={isExecutingScenario}>
                  Export
                </button>
                <button type="button" className="button button--ghost" onClick={openScenarioFilePicker} disabled={isExecutingScenario}>
                  Import
                </button>
              </div>
            </div>
            <div className="control-strip__action-group control-strip__action-group--secondary">
              <button type="button" className="button button--quiet" onClick={resetSimulation} disabled={isExecutingScenario}>
                Reset Simulation
              </button>
              <button type="button" className="button button--ghost" onClick={() => setShowDebug((value) => !value)} disabled={isExecutingScenario}>
                {showDebug ? 'Hide debug' : 'Show debug'}
              </button>
            </div>
          </div>
          <input
            ref={scenarioFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleScenarioFileChange}
            style={{ display: 'none' }}
          />
          {(scenarioMessage || scenarioError) && (
            <div className="control-strip__notes">
              {scenarioMessage ? <p className="muted">{scenarioMessage}</p> : null}
              {scenarioError ? <p className="text-danger">{scenarioError}</p> : null}
            </div>
          )}
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Turn behavior / Dynamic settings"
          collapsed={dynamicSettingsCollapsed}
          onToggle={() => setDynamicSettingsCollapsed((value) => !value)}
          description="Only the controls that matter for the selected turn policy are shown here."
        >
          <div className="policy-stack">
            <section className="policy-subgroup">
              <div className="section-heading">
                <h3>Rating count policy</h3>
              </div>
              <div className="control-strip__fields control-strip__fields--dynamic">
                <label className="control">
                  <select
                    aria-label="Rating count model"
                    value={organicRatingCountModel}
                    onChange={(event) => {
                      const nextValue = event.target.value as RatingCountModel;
                      setOrganicRatingCountModel(nextValue);
                      setGuidedRatingCountModel(nextValue);
                    }}
                  >
                    {Object.entries(RATING_COUNT_MODEL_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="policy-subgroup">
              <div className="section-heading">
                <h3>Participation settings</h3>
              </div>
              <div className="control-strip__fields control-strip__fields--dynamic">
                {participationModel === 'fixed-count' ? (
                  <label className="control">
                    {labeledControl('Participating Users / Turn', 'Exactly this many users are selected to act when the turn advances.')}
                    <input
                      type="number"
                      value={participatingUsersPerTurn}
                      onChange={(event) => setParticipatingUsersPerTurn(Number(event.target.value))}
                      min={1}
                      max={96}
                      step={1}
                    />
                  </label>
                ) : (
                  <label className="control">
                    {labeledControl('Participation Chance', 'Each user independently has this chance to act during the turn.')}
                    <input
                      type="number"
                      value={participationChance}
                      onChange={(event) => setParticipationChance(Number(event.target.value))}
                      min={0}
                      max={1}
                      step={0.01}
                    />
                  </label>
                )}
              </div>
            </section>

            {turnModeVisibility.showOrganic ? (
              <section className="policy-subgroup">
                <div className="section-heading">
                  <h3>Organic Exploration</h3>
                </div>
                <div className="control-strip__fields control-strip__fields--dynamic">
                  {organicRatingCountModel === 'fixed-count' ? (
                    <label className="control">
                      {labeledControl('Organic Ratings / User', 'How many unrated islands each participating user rates during organic exploration.')}
                      <input
                        type="number"
                        value={organicRatingsPerUser}
                        onChange={(event) => setOrganicRatingsPerUser(Number(event.target.value))}
                        min={0}
                        max={8}
                        step={1}
                      />
                    </label>
                  ) : (
                    <label className="control">
                      {labeledControl('Organic Rating Dice', 'The dice roll used to decide how many unrated islands each participating user rates.')}
                      <select value={organicRatingDice} onChange={(event) => setOrganicRatingDice(event.target.value as typeof organicRatingDice)}>
                        {['1d2', '1d3', '1d4', '1d6', '2d3', '2d6', '3d6'].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              </section>
            ) : null}

            {turnModeVisibility.showGuided ? (
              <section className="policy-subgroup">
                <div className="section-heading">
                  <h3>Guided Discovery</h3>
                </div>
                <div className="control-strip__fields control-strip__fields--dynamic">
                  {guidedRatingCountModel === 'fixed-count' ? (
                    <label className="control">
                      {labeledControl(
                        'Guided Recommendations / User',
                        'How many routed islands each participating user receives during guided discovery.'
                      )}
                      <input
                        type="number"
                        value={guidedRecommendationsPerUser}
                        onChange={(event) => setGuidedRecommendationsPerUser(Number(event.target.value))}
                        min={0}
                        max={8}
                        step={1}
                      />
                    </label>
                  ) : (
                    <label className="control">
                      {labeledControl('Guided Recommendation Dice', 'The dice roll used to decide how many routed islands each participating user receives.')}
                      <select value={guidedRecommendationDice} onChange={(event) => setGuidedRecommendationDice(event.target.value as typeof guidedRecommendationDice)}>
                        {['1d2', '1d3', '1d4', '1d6', '2d3', '2d6', '3d6'].map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <div className="control-strip__fields control-strip__fields--dynamic">
                  <section className="policy-subgroup policy-subgroup--compact">
                    <div className="section-heading">
                      <h3>Routing risk profile</h3>
                    </div>
                    <label className="control">
                      <select
                        aria-label="Routing risk profile"
                        value={routingRiskProfile}
                        onChange={(event) => setRoutingRiskProfile(event.target.value as RoutingRiskProfile)}
                      >
                        {Object.entries(ROUTING_RISK_PROFILE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </section>
                  {routingRiskProfile === 'custom' ? (
                    <>
                      <label className="control">
                        {labeledControl(
                          'Minimum Predicted Fit',
                          'Safety gate for guided routing. Islands below this fit are not recommended.'
                        )}
                        <input
                          type="number"
                          value={customMinimumPredictedFit}
                          onChange={(event) => setCustomMinimumPredictedFit(Number(event.target.value))}
                          min={-1}
                          max={1}
                          step={0.05}
                        />
                      </label>
                      <label className="control">
                        {labeledControl(
                          'Exploration Weight',
                          'How much discovery value matters after a candidate clears the predicted-fit gate.'
                        )}
                        <input
                          type="number"
                          value={customExplorationWeight}
                          onChange={(event) => setCustomExplorationWeight(Number(event.target.value))}
                          min={0}
                          max={2}
                          step={0.05}
                        />
                      </label>
                    </>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          title="Drilldown targets"
          collapsed={drilldownTargetsCollapsed}
          onToggle={() => setDrilldownTargetsCollapsed((value) => !value)}
          description="Pin a user, island, or cohort for quick reference."
        >
          <div className="section-toolbar section-toolbar--stacked">
            <p className="muted">
              Pin a user, island, or cohort here for quick reference while you inspect the reports below.
            </p>
            <div className="section-toolbar__buttons">
              {openSelectionButton('user', 'Choose user')}
              {openSelectionButton('island', 'Choose island')}
              {openSelectionButton('cohort', 'Choose cohort')}
            </div>
          </div>
        </CollapsiblePanel>
      </section>

      <section className="panel stage-panel stage-panel__sticky" aria-label="Primary workflow">
        <div className="stage-panel__lead">
          <div>
            <p className="eyebrow">Primary workflow</p>
            <h2>Inspect the current state, then advance one turn.</h2>
            <p className="muted">Keep the portfolio demo centered on one analyst target, one routed surface, and one turn-step at a time.</p>
          </div>
          <button
            type="button"
            className="icon-button collapsible-panel__toggle"
            onClick={() => setPrimaryWorkflowCollapsed((value) => !value)}
            aria-label={primaryWorkflowCollapsed ? 'Expand Primary workflow' : 'Collapse Primary workflow'}
          >
            <span className="collapsible-panel__toggle-icon" aria-hidden="true">
              {primaryWorkflowCollapsed ? 'v' : '^'}
            </span>
          </button>
        </div>
        {!primaryWorkflowCollapsed ? (
          <>
            <div className="stage-panel__badges">
              <Badge tone="accent">Turn {dataset.currentTurn}</Badge>
              <Badge tone="neutral">Scenario: {currentScenarioLabel}</Badge>
              <Badge tone="neutral">Mode: {TURN_MODE_LABELS[turnMode]}</Badge>
              <Badge tone="neutral">Participation: {PARTICIPATION_MODEL_LABELS[participationModel]}</Badge>
              <Badge tone="neutral">Rating counts: {RATING_COUNT_MODEL_LABELS[organicRatingCountModel]}</Badge>
              <Badge tone="neutral">Routing: {ROUTING_RISK_PROFILE_LABELS[routingRiskProfile]}</Badge>
            </div>
            <div className="stage-panel__actions">
              <div className="stage-panel__action-group">
                <button type="button" className="button button--primary" onClick={takeSingleTurn} disabled={isExecutingScenario}>
                  Take 1 Turn
                </button>
                <button type="button" className="button" onClick={takeBatchTurns} disabled={isExecutingScenario}>
                  Take {turnsToRun} Turns
                </button>
              </div>
              <div className="stage-panel__action-group">
                {openSelectionButton('user', 'Choose user', 'button button--ghost', isExecutingScenario)}
                {openSelectionButton('island', 'Choose island', 'button button--ghost', isExecutingScenario)}
                <button type="button" className="button button--ghost" onClick={() => setShowAbout(true)} disabled={isExecutingScenario}>
                  Open About
                </button>
              </div>
            </div>
          </>
        ) : null}
      </section>

      <section className="panel stage-panel stage-panel--details" aria-label="Primary workflow details">
        <div className="section-heading section-heading--collapse-row">
          <h3>Primary workflow details</h3>
          <button
            type="button"
            className="icon-button collapsible-panel__toggle"
            onClick={() => setPrimaryDetailsCollapsed((value) => !value)}
            aria-label={primaryDetailsCollapsed ? 'Expand Primary workflow details' : 'Collapse Primary workflow details'}
          >
            <span className="collapsible-panel__toggle-icon" aria-hidden="true">
              {primaryDetailsCollapsed ? 'v' : '^'}
            </span>
          </button>
        </div>
        {!primaryDetailsCollapsed ? (
          <>
        <div className="stage-panel__metrics">
          <MetricCard label="Selected user" value={selectedUser?.label ?? 'None'} helper="Current analyst subject." tone="accent" />
          <MetricCard label="Focus island" value={selectedIsland?.label ?? 'None'} helper="Current island comparison target." />
          <MetricCard
            label="Top routed island"
            value={routingSurfaceLabel}
            helper="Highest available guided route for the current user."
            tone="success"
          />
          <MetricCard
            label="Participating users / turn"
            value={participationDisplay}
            helper="Turn policy cap or chance applied before stream filtering."
          />
        </div>
        <div className="recent-action">
          <div className="section-heading">
            <h3>Recent action summary</h3>
            <p className="muted">What changed after the latest workflow action.</p>
          </div>
          {recentAction ? (
            (() => {
              const latest = recentAction.latestTurnSummary;
              const batchTurns =
                recentAction.kind === 'batch-turns-advanced' && recentAction.batchSize
                  ? dataset.turnHistory.slice(-recentAction.batchSize)
                  : [];
              const batchTotals = batchTurns.length > 0 ? aggregateBatchTotals(batchTurns) : null;
              const noEvents = latest ? latest.ratingsCreated === 0 : true;
              return (
                <div className="recent-action__content">
                  <p className="recent-action__title">
                    {recentAction.kind === 'scenario-executed'
                      ? 'Scenario executed'
                      : recentAction.kind === 'turn-advanced'
                        ? 'One turn advanced'
                        : recentAction.kind === 'batch-turns-advanced'
                          ? `Batch advanced (${recentAction.batchSize ?? 0} turns)`
                          : recentAction.kind === 'simulation-reset'
                            ? 'Simulation reset'
                            : recentAction.kind === 'scenario-imported'
                              ? 'Scenario imported'
                              : 'Scenario exported'}
                  </p>
                  <p className="muted">
                    Turn {recentAction.previousTurn} to {recentAction.currentTurn} • Scenario: {recentAction.scenarioLabel} • Mode: {recentAction.turnModeLabel}
                  </p>
                  {batchTotals ? (
                    <div className="recent-action__metrics">
                      <MetricCard label="Batch ratings" value={batchTotals.ratingsCreated} />
                      <MetricCard label="Batch organic" value={batchTotals.organicRatingsCreated} />
                      <MetricCard label="Batch guided" value={batchTotals.guidedRatingsCreated} />
                      <MetricCard label="Batch participants" value={batchTotals.participatingUsers} />
                    </div>
                  ) : null}
                  {latest ? (
                    <div className="recent-action__metrics">
                      <MetricCard label={batchTotals ? 'Latest-turn ratings' : 'Ratings created'} value={latest.ratingsCreated} />
                      <MetricCard label="Organic / guided" value={`${latest.organicRatingsCreated}/${latest.guidedRatingsCreated}`} />
                      <MetricCard label="Newly rated islands" value={latest.newlyRatedIslandIds.length} />
                      <MetricCard label="Routed safe / probe" value={`${latest.recommendationKinds.SAFE_FIT}/${latest.recommendationKinds.DISCOVERY_PROBE}`} />
                    </div>
                  ) : null}
                  {recentAction.exportFileName ? <p className="muted">Exported file: {recentAction.exportFileName}</p> : null}
                  {noEvents ? (
                    <div className="notice notice--warning">
                      <strong>No rating events were created.</strong>
                      <p>Inspect turn controls and recommendation thresholds if this was unexpected.</p>
                    </div>
                  ) : null}
                </div>
              );
            })()
          ) : (
            <EmptyState title="No recent action yet" description="Execute a scenario or advance turns to view compact deltas." />
          )}
        </div>
        </>
        ) : null}
      </section>

      <section className="inspection-shell" aria-label="Inspection / dashboard panels">
        <div className="section-heading inspection-shell__heading">
          <p className="eyebrow">Inspection / dashboard panels</p>
          <p className="muted">
            Summary panels, recovery checks, routing detail, and debug views live here once setup and the current turn are clear.
          </p>
        </div>
        <section className={`dashboard-shell dashboard-shell--${guidanceMode}`} aria-label="Analyst dashboard">
          {visibleDashboardSections.map((sectionKey) => {
            if (sectionKey === 'debug' && !showDebug) {
              return null;
            }

            const section = dashboardSections[sectionKey];

            return (
              <section key={sectionKey} className={`dashboard-section dashboard-section--${sectionKey}`}>
                <div className="section-heading dashboard-section__heading">
                  <p className="eyebrow">{section.title}</p>
                  <button
                    type="button"
                    className="icon-button collapsible-panel__toggle"
                    onClick={() => {
                      if (sectionKey === 'overview') setOverviewCollapsed((value) => !value);
                      if (sectionKey === 'recovery') setRecoveryCollapsed((value) => !value);
                      if (sectionKey === 'routing') setRoutingCollapsed((value) => !value);
                      if (sectionKey === 'debug') setDebugCollapsed((value) => !value);
                    }}
                    aria-label={
                      (sectionKey === 'overview' && overviewCollapsed) ||
                      (sectionKey === 'recovery' && recoveryCollapsed) ||
                      (sectionKey === 'routing' && routingCollapsed) ||
                      (sectionKey === 'debug' && debugCollapsed)
                        ? `Expand ${section.title}`
                        : `Collapse ${section.title}`
                    }
                  >
                    <span className="collapsible-panel__toggle-icon" aria-hidden="true">
                      {(sectionKey === 'overview' && overviewCollapsed) ||
                      (sectionKey === 'recovery' && recoveryCollapsed) ||
                      (sectionKey === 'routing' && routingCollapsed) ||
                      (sectionKey === 'debug' && debugCollapsed)
                        ? 'v'
                        : '^'}
                    </span>
                  </button>
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
                {!((sectionKey === 'overview' && overviewCollapsed) || (sectionKey === 'recovery' && recoveryCollapsed) || (sectionKey === 'routing' && routingCollapsed) || (sectionKey === 'debug' && debugCollapsed)) ? (
                  <div className="dashboard-section__panels">{section.panels}</div>
                ) : null}
              </section>
            );
          })}
        </section>
      </section>

      {showInstructionTray ? (
        <Tray
          collapsed={!guidanceOpen}
          title={isNoviceMode ? 'Guided task journey' : 'Curator notes'}
          className="tray--instruction tray--left"
          style={{
            top: railTop,
            left: '18px',
            right: 'auto',
            height: railHeight
          }}
          toggleCollapsedLabel={isNoviceMode ? 'Open guided journey' : 'Open curator notes'}
          toggleExpandedLabel={isNoviceMode ? 'Collapse guided journey' : 'Collapse curator notes'}
          onToggle={() => setGuidanceOpen((value) => !value)}
        >
          <div className="summary-header">
            <div>
              <p className="eyebrow">Demo narrative</p>
              <h3>{selectedStory.title}</h3>
            </div>
            <div className="summary-header__actions">
              <Badge tone="accent">Recommended: {DASHBOARD_ORDERING_LABELS[selectedStory.recommendedOrdering]}</Badge>
              {selectedStory.primaryPanels?.map((panelKey) => (
                <Badge key={panelKey} tone="neutral">
                  {panelKey}
                </Badge>
              ))}
            </div>
          </div>
          <div className="instruction-grid">
            <section className="detail-block">
              <h4>System use case</h4>
              <p className="detail-block__title">{selectedStory.systemUseCase.title}</p>
              <p>{selectedStory.systemUseCase.description}</p>
              <p className="muted">{selectedStory.systemUseCase.detail}</p>
            </section>
            <section className="detail-block">
              <h4>Player journey</h4>
              <p className="detail-block__title">{selectedStory.playerJourney.title}</p>
              <p>{selectedStory.playerJourney.description}</p>
              <p className="muted">{selectedStory.playerJourney.detail}</p>
            </section>
            <details className="detail-block detail-block--foldout" open={!isNoviceMode}>
              <summary className="detail-block__summary">
                <span>Proof points</span>
                <span className="muted">Shared steps, expected results, and failure signs.</span>
              </summary>
              <div className="detail-block__foldout-grid">
                <section className="detail-block detail-block--foldout-section">
                  <h4>Shared steps</h4>
                  <ol className="instruction-list">
                    {selectedStory.sharedSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </section>
                <section className="detail-block detail-block--foldout-section">
                  <h4>Expected system result</h4>
                  <p>{selectedStory.expectedSystemResult}</p>
                </section>
                <section className="detail-block detail-block--foldout-section">
                  <h4>Expected player result</h4>
                  <p>{selectedStory.expectedPlayerResult}</p>
                </section>
                <section className="detail-block detail-block--foldout-section">
                  <h4>Failure signs</h4>
                  <ul className="diagnosis-list">
                    {selectedStory.failureSigns.map((failureSign) => (
                      <li key={failureSign}>{failureSign}</li>
                    ))}
                  </ul>
                </section>
              </div>
            </details>
          </div>
        </Tray>
      ) : null}

      <Tray
        collapsed={pinnedTrayCollapsed}
        title={pinnedDrilldownTitle}
        className="tray--pinned"
        style={{
          top: railTop,
          right: '18px',
          left: 'auto',
          height: railHeight
        }}
        toggleCollapsedLabel="Open pinned drilldown"
        toggleExpandedLabel="Collapse pinned drilldown"
        onToggle={() => setPinnedTrayCollapsed((value) => !value)}
        onSecondaryAction={() => {
          setPinnedDrilldownKind(null);
          setPinnedTrayCollapsed(true);
        }}
        secondaryActionLabel="Clear pinned drilldown"
      >
        {pinnedDrilldownContent ? (
          pinnedDrilldownContent
        ) : (
          <EmptyState
            title="Nothing pinned yet"
            description="Pin a user, island, or cohort from Drilldown targets to anchor this space."
          />
        )}
      </Tray>

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
          setPinnedDrilldownKind('user');
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
          setPinnedDrilldownKind('island');
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
          setPinnedDrilldownKind('cohort');
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

      <Drawer
        open={drawerState?.type === 'reviewer-recovery'}
        title="Reviewer archetype recovery"
        onClose={() => setDrawerState(null)}
      >
        {reviewerArchetypeRecoveryDetail}
      </Drawer>
    </main>
  );
}




