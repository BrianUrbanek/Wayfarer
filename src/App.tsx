import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Badge } from './ui/components/Badge';
import { Drawer } from './ui/components/Drawer';
import { EmptyState } from './ui/components/EmptyState';
import { MetricCard } from './ui/components/MetricCard';
import { Modal } from './ui/components/Modal';
import { Panel } from './ui/components/Panel';
import { ProgressBar } from './ui/components/ProgressBar';
import { ReportTable, type ReportTableColumn } from './ui/components/ReportTable';
import { InfoTip } from './ui/components/InfoTip';
import { FormulaTip } from './ui/components/FormulaTip';
import { SelectionModal, type SelectionOption } from './ui/components/SelectionModal';
import { CollapsiblePanel } from './ui/components/CollapsiblePanel';
import { ModulePanelHeader } from './ui/components/ModulePanelHeader';
import { SystemHealthPanel } from './ui/components/SystemHealthPanel';
import { Tray } from './ui/components/Tray';
import { AboutGlossaryLauncher } from './ui/components/AboutGlossaryLauncher';
import { PrimaryWorkflowPanel } from './ui/PrimaryWorkflowPanel';
import { DiscoveryRoutingPanel } from './ui/routing/DiscoveryRoutingPanel';
import { SelectedIslandPanel } from './ui/routing/SelectedIslandPanel';
import { SelectedIslandTruthComparison } from './ui/routing/SelectedIslandTruthComparison';
import { SelectedIslandEvidenceSummary } from './ui/routing/SelectedIslandEvidenceSummary';
import { DiscoveryRoutingSummary } from './ui/routing/DiscoveryRoutingSummary';
import { HiddenCohortRecoveryPanel } from './ui/recovery/HiddenCohortRecoveryPanel';
import { DistributionList } from './ui/components/DistributionList';
import { DistributionDonut } from './ui/components/DistributionDonut';
import { DistributionLegend } from './ui/components/DistributionLegend';
import { DivergingAffinityBars } from './ui/components/DivergingAffinityBars';
import { buildSystemHealthSummary } from './ui/systemHealth';
import {
  collapseDistributionSlices,
  computeDeclaredTagOverlap,
  shouldPromoteInverseSignal,
  summarizeBehaviorRead
} from './ui/summaryVisuals';
import { buildPrimarySignalSummary } from './ui/userSignalDiagnosis';
import { useRef } from 'react';
import { getGuidedPath, GUIDED_PATHS, type DashboardPanelGroupKey, type GuidanceMode, type GuidedPathId } from './ui/dashboardGuidance';
import {
  DEFAULT_TURN_POLICY,
  getTurnModeVisibility,
  RATING_COUNT_MODEL_LABELS,
  ROUTING_RISK_PROFILE_LABELS,
  resolveRoutingRiskProfileValues,
  TURN_MODE_LABELS,
  type ParticipationModel,
  type RatingCountModel,
  type RoutingRiskProfile,
  type TurnMode
} from './model/turnPolicy';
import { buildConfidenceGrowthRows } from './model/confidenceGrowth';
import { buildSystemMovementAnalysis } from './model/systemMovement';
import { buildGoldenDemoReport, renderGoldenDemoReportMarkdown } from './analysis/goldenDemoReport';
import { buildDiscoverySignalAnalysis } from './model/discoverySignal';
import { buildObservedBehaviorAnalysis, buildObservedBehaviorRowsForIsland } from './model/observedBehavior';
import { buildIslandTruthComparison } from './model/islandTruthComparison';
import { buildHiddenCohortRecoveryReport } from './model/hiddenCohortRecovery';
import { buildTurnRecapReport } from './model/turnRecap';
import { ConfidenceGrowthPanel } from './ui/components/ConfidenceGrowthPanel';
import { SystemMovementPanel } from './ui/components/SystemMovementPanel';
import { TurnRecapPanel } from './ui/overview/TurnRecapPanel';
import { SelectedUserSummary } from './ui/selectedUser/SelectedUserSummary';
import { InspectionShell } from './ui/InspectionShell';
import { type RecentActionState } from './ui/recentActionSummary';
import { GuidedPathTray } from './ui/guidedPath/GuidedPathTray';
import { useGuidedPathController } from './ui/guidedPath/useGuidedPathController';
import { useGuidedTargetRegistry } from './ui/guidedPath/useGuidedTargetRegistry';
import { DEFAULT_TAGS } from './data/defaultTags';
import { createDefaultCohorts } from './data/defaultCohorts';
import { generateColumbusDataset } from './generator/columbusGenerator';
import type { CohortAffinityEstimate } from './model/affinity';
import { buildUserDeprioritizationAnalysis } from './model/deprioritization';
import { deriveRatingEventWeightsForIsland } from './model/ratingEventWeight';
import { buildIslandEvidenceConstellation, buildIslandRatingTimelineRows } from './model/islandEvidenceVisualization';
import type { PseudoCohortReport } from './model/pseudoCohorts';
import { archetypeLabel } from './model/reviewerArchetypes';
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
import { derivePresentationState, type RunPresentationSource } from './ui/presentationState';
import type { CohortAnchor, Island, User } from './model/types';

const ReviewerArchetypeRecoveryModal = lazy(async () => {
  const module = await import('./ui/reviewerRecovery/ReviewerArchetypeRecoveryModal');
  return { default: module.ReviewerArchetypeRecoveryModal };
});

const INITIAL_SCENARIO_PRESET: ScenarioPreset = getScenarioPreset('golden-demo');
const SCENARIO_PRESET_OPTIONS = listScenarioPresets();

function scenarioPresetMetadataFromPreset(preset: ScenarioPreset): ScenarioPresetMetadata {
  return getScenarioPresetMetadata(preset.id);
}

type SelectionModalKind = 'user' | 'island' | 'cohort' | 'pseudo' | null;

type PinnedDrilldownKind = 'user' | 'island' | 'cohort' | null;

type ScenarioExecutionSeedMode = 'random' | 'fixed';
interface TurnTimingRow {
  turn: number;
  durationMs: number;
  ratingsCreated: number;
  mode: 'organic' | 'guided' | 'mixed';
}

type DrawerState =
  | { type: 'user'; id: string }
  | { type: 'island'; id: string }
  | { type: 'pseudo'; key: string }
  | { type: 'reviewer'; userId: string }
  | { type: 'reviewer-recovery' }
  | { type: 'golden-demo-report' }
  | { type: 'recommendation'; userId: string; islandId: string }
  | { type: 'affinity'; islandId: string; cohortId: string }
  | null;

function buildDataset(config: {
  seed: number;
  numUsers: number;
  numIslands: number;
  tagAlignmentDistribution: SavedScenarioGeneratorConfig['tagAlignmentDistribution'];
  ratingAlignmentDistribution: SavedScenarioGeneratorConfig['ratingAlignmentDistribution'];
  islandClassWeights ? : SavedScenarioGeneratorConfig['islandClassWeights'];
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
    hiddenTasteCohorts: latentDataset.hiddenTasteCohorts,
    initialRatingsPerUser: controls.bootstrapRatingsPerUser
  });
}

function labelForCohortFactory(cohorts: CohortAnchor[]) {
  const labels = new Map(cohorts.map((cohort) => [cohort.id, cohort.label]));
  const analystLabels = new Map(cohorts.map((cohort) => [cohort.id, cohort.analystName  ??  cohort.label]));

  return {
    analyst: (cohortId: string | null) => {
      if (cohortId === null) {
        return 'none';
      }
      return analystLabels.get(cohortId)  ??  labels.get(cohortId)  ??  cohortId;
    },
    technical: (cohortId: string | null) => {
      if (cohortId === null) {
        return 'none';
      }
      return labels.get(cohortId)  ??  cohortId;
    },
    full: (cohortId: string | null) => {
      if (cohortId === null) {
        return 'none';
      }
      const analyst = analystLabels.get(cohortId)  ??  cohortId;
      const technical = labels.get(cohortId)  ??  cohortId;
      return analyst === technical  ?  technical : `${analyst}  ·  ${technical}`;
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
  const prefix = value > 0  ?  '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

function formatRating(value: string | number | null): string {
  if (value === null || value === undefined) {
    return 'Unrated';
  }

  return String(value);
}

function summarizeWeightedVector(vector: Record<string, number> | undefined | null, limit = 4): string {
  if (!vector) {
    return 'n/a';
  }

  return Object.entries(vector)
    .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]) || right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([key, value]) => `${key} ${formatSignedDecimal(value, 2)}`)
    .join(' | ');
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

function renderPrimarySignalTitle(
  summary: ReturnType<typeof buildPrimarySignalSummary> | null,
  labelForCohort: (cohortId: string | null) => string
): string {
  if (!summary) return 'AMBIGUOUS';
  if (summary.titleKey === 'positive') {
    return `Primary behavior read: positive ${labelForCohort(summary.primaryCohortId  ??  null)} audience fit`;
  }
  if (summary.titleKey === 'inverse') {
    return `Primary behavior read: anti-match against ${labelForCohort(summary.inverseCohortId  ??  null)}`;
  }
  if (summary.titleKey === 'mismatch') return 'Primary behavior read: declared/observed mismatch';
  if (summary.titleKey === 'diffuse') return 'Primary behavior read: diffuse behavior';
  if (summary.titleKey === 'insufficient') return 'Insufficient behavior evidence';
  return 'Primary behavior read: weak explanatory value';
}

function comparisonLabel(user: User | null, selectedCohort: CohortAnchor | null, cohortLabel: (id: string | null) => string) {
  if (selectedCohort) {
    return selectedCohort.label;
  }

  if (user) {
    return cohortLabel(user.hiddenSeedCohortId  ??  null);
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
    const userRating = user.ratings[islandId]  ??  null;
    const cohortRating = cohort.ratings[islandId]  ??  null;

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
    rate: rated > 0  ?  matches / rated : 0
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
  initialGuidanceMode ? : GuidanceMode;
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
  const [turnMode, setTurnMode] = useState<TurnMode>(INITIAL_SCENARIO_PRESET.turnPolicy.turnMode);
  const [participationModel, setParticipationModel] = useState<ParticipationModel>(INITIAL_SCENARIO_PRESET.turnPolicy.participationModel);
  const [participatingUsersPerTurn, setParticipatingUsersPerTurn] = useState(INITIAL_SCENARIO_PRESET.turnPolicy.participatingUsersPerTurn);
  const [participationChance, setParticipationChance] = useState(INITIAL_SCENARIO_PRESET.turnPolicy.participationChance);
  const [organicRatingCountModel, setOrganicRatingCountModel] = useState<RatingCountModel>(INITIAL_SCENARIO_PRESET.turnPolicy.organicRatingCountModel);
  const [organicRatingsPerUser, setOrganicRatingsPerUser] = useState(INITIAL_SCENARIO_PRESET.turnPolicy.organicRatingsPerUser);
  const [organicRatingDice, setOrganicRatingDice] = useState(INITIAL_SCENARIO_PRESET.turnPolicy.organicRatingDice);
  const [guidedRatingCountModel, setGuidedRatingCountModel] = useState<RatingCountModel>(INITIAL_SCENARIO_PRESET.turnPolicy.guidedRatingCountModel);
  const [guidedRecommendationsPerUser, setGuidedRecommendationsPerUser] = useState(INITIAL_SCENARIO_PRESET.turnPolicy.guidedRecommendationsPerUser);
  const [guidedRecommendationDice, setGuidedRecommendationDice] = useState(INITIAL_SCENARIO_PRESET.turnPolicy.guidedRecommendationDice);
  const [routingRiskProfile, setRoutingRiskProfile] = useState<RoutingRiskProfile>(INITIAL_SCENARIO_PRESET.turnPolicy.routingRiskProfile);
  const [customExplorationWeight, setCustomExplorationWeight] = useState(DEFAULT_TURN_POLICY.customRoutingValues.explorationWeight);
  const [customMinimumPredictedFit, setCustomMinimumPredictedFit] = useState(DEFAULT_TURN_POLICY.customRoutingValues.minimumPredictedFit);
  const [turnsToRun, setTurnsToRun] = useState(INITIAL_SCENARIO_PRESET.turnsToRun);
  const [executionSeedMode, setExecutionSeedMode] = useState<ScenarioExecutionSeedMode>('random');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedIslandId, setSelectedIslandId] = useState<string>('');
  const [comparisonCohortId, setComparisonCohortId] = useState<string>('auto');
  const showDebugInitial = initialGuidanceMode !== 'novice';
  const [showDebug, setShowDebug] = useState(showDebugInitial);
  const [showTimingLog, setShowTimingLog] = useState(false);
  const [turnTimingLog, setTurnTimingLog] = useState<TurnTimingRow[]>([]);
  const [guidanceMode, setGuidanceMode] = useState<GuidanceMode>(initialGuidanceMode);
  const [guidanceOpen, setGuidanceOpen] = useState(initialGuidanceMode === 'novice');
  const [guidedPathId, setGuidedPathId] = useState<GuidedPathId>(
    initialGuidanceMode === 'novice'  ?  'run-start' : 'analyst-workflow'
  );
  const [runPresentationSource, setRunPresentationSource] = useState<RunPresentationSource>('cold-load');
  const [modalKind, setModalKind] = useState<SelectionModalKind>(null);
  const [pinnedDrilldownKind, setPinnedDrilldownKind] = useState<PinnedDrilldownKind>(null);
  const [pinnedTrayCollapsed, setPinnedTrayCollapsed] = useState(initialGuidanceMode !== 'novice');
  const [dynamicSettingsCollapsed, setDynamicSettingsCollapsed] = useState(initialGuidanceMode === 'novice');
  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [importedScenario, setImportedScenario] = useState<SavedWayfarerScenarioV1 | null>(null);
  const [scenarioMessage, setScenarioMessage] = useState<string>('');
  const [scenarioError, setScenarioError] = useState<string>('');
  const [executionProgress, setExecutionProgress] = useState<number>(0);
  const [executionStatus, setExecutionStatus] = useState<string>('');
  const [isExecutingScenario, setIsExecutingScenario] = useState(false);
  const [, setRecentAction] = useState<RecentActionState | null>(null);
  const [showConfidenceSeries, setShowConfidenceSeries] = useState({
    player: true,
    island: true,
    cohort: false,
    tag: false
  });
  const [primaryWorkflowCollapsed, setPrimaryWorkflowCollapsed] = useState(false);
  const [turnSummaryCollapsed, setTurnSummaryCollapsed] = useState(false);
  const turnSummaryTargetRef = useRef<HTMLElement>(null);
  const turnRecapTargetRef = useRef<HTMLDivElement>(null);
  const primaryWorkflowTargetRef = useRef<HTMLElement>(null);
  const executeScenarioTargetRef = useRef<HTMLButtonElement>(null);
  const demoReportTargetRef = useRef<HTMLButtonElement>(null);
  const selectedUserSummaryTargetRef = useRef<HTMLElement>(null);
  const hiddenCohortRecoveryTargetRef = useRef<HTMLDivElement>(null);
  const selectedIslandTargetRef = useRef<HTMLElement>(null);
  const selectedIslandTruthTargetRef = useRef<HTMLDivElement>(null);
  const discoveryRoutingTargetRef = useRef<HTMLElement>(null);
  const [pinnedDetailCollapsed, setPinnedDetailCollapsed] = useState(false);
  const [discoveryRoutingCollapsed, setDiscoveryRoutingCollapsed] = useState(true);
  const [selectedIslandCollapsed, setSelectedIslandCollapsed] = useState(false);
  const [debugCollapsed, setDebugCollapsed] = useState(true);
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
    return dataset.users.find((user) => user.id === selectedUserId)  ??  dataset.users[0]  ??  null;
  }, [dataset.users, selectedUserId]);

  const selectedIsland = useMemo(() => {
    return dataset.islands.find((island) => island.id === selectedIslandId)  ??  dataset.islands[0]  ??  null;
  }, [dataset.islands, selectedIslandId]);

  const selectedInference = selectedUser  ?  dataset.inferenceByUserId.get(selectedUser.id) : undefined;

  const selectedComparisonCohort = useMemo(() => {
    if (comparisonCohortId !== 'auto') {
      return dataset.cohorts.find((cohort) => cohort.id === comparisonCohortId)  ??  null;
    }

    return (
      dataset.cohorts.find((cohort) => cohort.id === selectedInference ?.behaviorTop.cohortId)  ?? 
      dataset.cohorts.find((cohort) => cohort.id === selectedInference ?.declaredTop.cohortId)  ?? 
      dataset.cohorts[0]  ?? 
      null
    );
  }, [comparisonCohortId, dataset.cohorts, selectedInference]);

  const selectedComparisonLabel = comparisonLabel(selectedUser, selectedComparisonCohort, cohortLabels.full);
  const selectedRaterSignalProfile = selectedUser  ?  dataset.raterSignalProfiles.get(selectedUser.id)  ??  null : null;
  const selectedIslandAffinityReport = selectedIsland  ?  dataset.islandAffinityReports.get(selectedIsland.id)  ??  null : null;
  const cohortLabelById = useMemo(
    () => new Map(dataset.cohorts.map((cohort) => [cohort.id, cohortLabels.full(cohort.id)])),
    [dataset.cohorts, cohortLabels]
  );
  const selectedIslandTruthComparison = useMemo(() => {
    if (!selectedIsland) {
      return null;
    }

    return buildIslandTruthComparison({
      island: selectedIsland,
      affinityReport: selectedIslandAffinityReport,
      hiddenTasteCohorts: dataset.hiddenTasteCohorts,
      cohortLabelById
    });
  }, [cohortLabelById, dataset.hiddenTasteCohorts, selectedIsland, selectedIslandAffinityReport]);
  const hiddenCohortRecoveryReport = useMemo(
    () =>
      buildHiddenCohortRecoveryReport({
        hiddenTasteCohorts: dataset.hiddenTasteCohorts,
        users: dataset.users,
        islands: dataset.islands,
        ratingEvents: dataset.ratingEvents,
        observedBehaviorEvents: dataset.observedBehaviorEvents,
        islandAffinityReports: dataset.islandAffinityReports,
        cohortLabelById
      }),
    [
      cohortLabelById,
      dataset.hiddenTasteCohorts,
      dataset.islandAffinityReports,
      dataset.islands,
      dataset.observedBehaviorEvents,
      dataset.ratingEvents,
      dataset.users
    ]
  );
  const selectedIslandRatingCount = selectedIslandAffinityReport ?.estimates[0] ?.rawCount  ??  0;
  const selectedIslandEffectiveWeight =
    selectedIslandAffinityReport ?.topPositive ?.effectiveWeight  ?? 
    selectedIslandAffinityReport ?.topNegative ?.effectiveWeight  ?? 
    selectedIslandAffinityReport ?.estimates[0] ?.effectiveWeight  ?? 
    0;

  const inferenceTypes = useMemo(() => {
    return new Map(
      dataset.users.map((user) => [user.id, dataset.inferenceByUserId.get(user.id) ?.diagnosis.type  ??  'AMBIGUOUS'])
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
  const confidenceGrowthRows = useMemo(() => buildConfidenceGrowthRows(dataset), [dataset]);
  const systemMovementAnalysis = useMemo(() => buildSystemMovementAnalysis(dataset), [dataset]);
  const discoverySignalAnalysis = useMemo(() => buildDiscoverySignalAnalysis(dataset), [dataset]);
  const islandLabelById = useMemo(() => new Map(dataset.islands.map((island) => [island.id, island.label] as const)), [dataset.islands]);
  const cohortDisplayLabelById = useMemo(
    () => new Map(dataset.cohorts.map((cohort) => [cohort.id, cohort.label] as const)),
    [dataset.cohorts]
  );
  const selectedDiscoverySignalProfile = selectedUser  ?  discoverySignalAnalysis.byUserId.get(selectedUser.id)  ??  null : null;

  const selectedInferenceDiagnostics = selectedInference ?.diagnosis;
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

  const selectedUserDeprioritization = useMemo(() => {
    if (!selectedUser) {
      return [];
    }

    return buildUserDeprioritizationAnalysis(
      selectedUser,
      dataset.islandAffinityReports,
      selectedRaterSignalProfile  ??  undefined,
      dataset.islands,
      { topLimit: routingOptions.topLimit }
    ).rows;
  }, [dataset.islandAffinityReports, dataset.islands, routingOptions.topLimit, selectedRaterSignalProfile, selectedUser]);

  const observedBehaviorAnalysis = useMemo(() => buildObservedBehaviorAnalysis(dataset.observedBehaviorEvents), [dataset.observedBehaviorEvents]);

  const selectedRecommendationDetail =
    drawerState ?.type === 'recommendation' && selectedUser
       ?  selectedUserRecommendations.find((recommendation) => recommendation.islandId === drawerState.islandId)  ??  null
      : null;

  const currentTurnSummary = dataset.turnHistory[dataset.turnHistory.length - 1]  ??  null;
  const reviewerArchetypeAnalysis = dataset.reviewerArchetypeAnalysis;
  const selectedUserRatings = selectedUser  ?  countNonNullRatings(selectedUser) : 0;
  const visibleTurnModeLabel = TURN_MODE_LABELS[turnMode];
  const selectedDeclaredCohort =
    selectedInference ?.declaredTop.cohortId  ?  dataset.cohorts.find((cohort) => cohort.id === selectedInference.declaredTop.cohortId)  ??  null : null;
  const turnRecapReport = useMemo(
    () =>
      buildTurnRecapReport({
        turnHistory: dataset.turnHistory,
        islandCohortRatingSnapshots: dataset.islandCohortRatingSnapshots,
        islands: dataset.islands,
        cohorts: dataset.cohorts,
        islandLabelById,
        cohortLabelById: cohortDisplayLabelById
      }),
    [cohortDisplayLabelById, dataset.cohorts, dataset.islandCohortRatingSnapshots, dataset.islands, dataset.turnHistory, islandLabelById]
  );
  const declaredTagOverlap = selectedUser && selectedDeclaredCohort  ?  computeDeclaredTagOverlap(selectedUser.declaredTags, selectedDeclaredCohort) : null;
  const declaredDistributionSlices = selectedInference  ?  collapseDistributionSlices(selectedInference.declaredDistribution, cohortLabels.full, 4) : [];
  const behaviorDistributionSlices = selectedInference  ?  collapseDistributionSlices(selectedInference.behaviorDistribution, cohortLabels.full, 4) : [];
  const behaviorReadSummary = selectedInference  ?  summarizeBehaviorRead(selectedInference.behaviorDistribution, selectedInference.behaviorSpecificity) : null;
  const declaredObservedRelationshipText = selectedInference  ?  buildDeclaredObservedRelationshipText(selectedInference) : '';
  const showInverseDiagnostic = selectedInference
     ?  shouldPromoteInverseSignal(selectedInference.inverseTop.score, selectedInference.behaviorSpecificity)
    : false;
  const selectedPrimarySignal = selectedInference  ?  buildPrimarySignalSummary(selectedInference) : null;

  const signalRows = useMemo(() => {
    if (!selectedRaterSignalProfile) {
      return [];
    }

    return dataset.cohorts
      .map((cohort) => ({
        cohort,
        weight: selectedRaterSignalProfile.cohortWeights[cohort.id]  ??  0,
        evidence: selectedRaterSignalProfile.cohortEvidence[cohort.id]  ??  0,
        similarity: selectedRaterSignalProfile.cohortSimilarities[cohort.id]  ??  {
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
        cohort: dataset.cohorts.find((entry) => entry.id === estimate.cohortId)  ??  null,
        estimate
      }))
      .filter((row): row is { cohort: CohortAnchor; estimate: CohortAffinityEstimate } => row.cohort !== null)
      .sort((left, right) => compareByNumeric(left.estimate.affinity, right.estimate.affinity));
  }, [dataset.cohorts, selectedIslandAffinityReport]);


  const confidenceRadarData = useMemo(() => {
    if (!selectedIslandAffinityReport) {
      return [];
    }

    return selectedIslandAffinityReport.estimates.map((estimate) => ({
      cohortId: estimate.cohortId,
      confidence: estimate.confidence,
      label: cohortLabels.full(estimate.cohortId)
    }));
  }, [cohortLabels, selectedIslandAffinityReport]);

  const selectedIslandEventWeightRows = useMemo(() => {
    if (!selectedIsland) {
      return [];
    }

    return deriveRatingEventWeightsForIsland(selectedIsland.id, dataset.ratingEvents, selectedIslandAffinityReport  ??  undefined);
  }, [dataset.ratingEvents, selectedIsland, selectedIslandAffinityReport]);

  const selectedIslandTimelineRows = useMemo(() => {
    if (!selectedIsland) return [];
    return buildIslandRatingTimelineRows(selectedIsland.id, dataset.islandCohortRatingSnapshots);
  }, [dataset.islandCohortRatingSnapshots, selectedIsland]);

  const selectedIslandCohortLabelById = useMemo(
    () => new Map(dataset.cohorts.map((cohort) => [cohort.id, cohortLabels.full(cohort.id)])),
    [cohortLabels, dataset.cohorts]
  );

  const selectedIslandConstellation = useMemo(() => {
    if (!selectedIsland) {
      return { points: [], spokes: [], usesRatingEventWeightRows: false };
    }
    return buildIslandEvidenceConstellation({
      islandId: selectedIsland.id,
      events: dataset.ratingEvents,
      ratingEventWeightRows: selectedIslandEventWeightRows,
      cohortLabelById: selectedIslandCohortLabelById
    });
  }, [dataset.ratingEvents, selectedIsland, selectedIslandEventWeightRows, selectedIslandCohortLabelById]);

  const selectedIslandObservedBehaviorRows = useMemo(() => {
    if (!selectedIsland) {
      return [];
    }

    return buildObservedBehaviorRowsForIsland(selectedIsland.id, dataset.observedBehaviorEvents);
  }, [dataset.observedBehaviorEvents, selectedIsland]);

  const selectedIslandObservedBehaviorSummary = useMemo(() => {
    if (!selectedIsland) {
      return null;
    }

    return observedBehaviorAnalysis.byIslandId.get(selectedIsland.id)  ??  null;
  }, [observedBehaviorAnalysis.byIslandId, selectedIsland]);

  const selectedAffinityDetail =
    drawerState ?.type === 'affinity'
       ?  dataset.islandAffinityReports.get(drawerState.islandId) ?.estimates.find((estimate) => estimate.cohortId === drawerState.cohortId)  ?? 
        null
      : null;

  const selectedIslandRows = useMemo(() => {
    return dataset.cohorts.map((cohort) => ({
      cohort,
      rating: selectedIsland  ?  cohort.ratings[selectedIsland.id]  ??  null : null
    }));
  }, [dataset.cohorts, selectedIsland]);

  const selectedComparisonUserRating = selectedUser && selectedIsland
     ?  selectedUser.ratings[selectedIsland.id]  ??  null
    : null;

  const selectedComparisonCohortRating = selectedComparisonCohort && selectedIsland
     ?  selectedComparisonCohort.ratings[selectedIsland.id]  ??  null
    : null;

  const exactMatchRate =
    selectedUser && selectedComparisonCohort
       ?  computeExactMatchRate(
          selectedUser,
          selectedComparisonCohort,
          dataset.islands.map((island) => island.id)
        )
      : null;

  const behaviorIsNonInformative =
    selectedInference !== undefined &&
    selectedInference.behaviorMatchStrength < 0.35 &&
    selectedInference.behaviorSpecificity < 0.06;

  const visibleDashboardSections: DashboardPanelGroupKey[] = ['overview', 'recovery', 'routing', 'debug'];
  const runContextNote = isNoviceMode
     ?  'Novice keeps the instructional rails open while expert exposes the resolved controls. Current run badges live in Primary Workflow.'
    : 'Expert keeps the same run-context choices visible and exposes the resolved controls. Current run badges live in Primary Workflow.';

  const selectedUserOptions = useMemo<SelectionOption[]>(() => {
    return dataset.users.map((user) => {
      const inference = dataset.inferenceByUserId.get(user.id);
      const tags = user.declaredTags.slice(0, 3).join('  ·  ');

      return {
        id: user.id,
        label: user.label,
        description: tags,
        badge: inference ?.diagnosis.type  ??  'unknown'
      };
    });
  }, [dataset.inferenceByUserId, dataset.users]);

  const selectedIslandOptions = useMemo<SelectionOption[]>(() => {
    return dataset.islands.map((island) => {
      return {
        id: island.id,
        label: island.label,
        description: `Rated by ${dataset.cohorts.length} seeded anchors`,
        badge: island.hiddenClass  ??  'island'
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
        description: cohort.tags.join('  ·  '),
        badge: cohort.source
      }))
    ];
  }, [dataset.cohorts]);

  const pseudoReportOptions = useMemo<SelectionOption[]>(() => {
    return dataset.pseudoCohortAnalysis.allReports.map((report) => ({
      id: report.key,
      label: report.tags.join(' | '),
      description: `${report.userCount} users  ·  ${report.reportType}`,
      badge: report.analystPriority
    }));
  }, [dataset.pseudoCohortAnalysis.allReports]);

  const reviewerReportRows = reviewerArchetypeAnalysis.allReports;
  const reviewerCohortRows = useMemo(
    () =>
      reviewerArchetypeAnalysis.highSignalByCohort.map((entry) => ({
        cohort: dataset.cohorts.find((cohort) => cohort.id === entry.cohortId)  ??  null,
        users: entry.users,
        topUser: entry.users[0]  ??  null
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
      label: 'Trust proxy',
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
      render: (row) => <ProgressBar value={(row.estimate.affinity + 1) / 2} label={formatSignedDecimal(row.estimate.affinity)} tone={row.estimate.affinity >= 0  ?  'success' : 'danger'} />
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


  const selectedReviewerReport = drawerState ?.type === 'reviewer'
     ?  reviewerReportRows.find((report) => report.userId === drawerState.userId)  ??  null
    : null;

  const selectedUserReviewerReport = selectedUser
     ?  reviewerReportRows.find((report) => report.userId === selectedUser.id)  ??  null
    : null;

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

      <div className="metric-grid metric-grid--compact selected-island__summary-grid">
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
                    {archetypeLabel(row.hiddenReviewerArchetype)}  ·  {row.inferredDiagnosisType}
                  </span>
                </div>
                <div className="recovery-preview-row__meta">
                  <span className="muted">
                    Cohort: {row.inferredCohortId  ?  cohortLabels.full(row.inferredCohortId) : 'none'}
                  </span>
                  <span className="muted">Signal {formatDecimal(row.effectiveSignal)}</span>
                  {row.analystFlags.length > 0  ?  <span className="muted">{row.analystFlags.slice(0, 2).join('  ·  ')}</span> : null}
                  <span className="recovery-preview-row__action">Open detail</span>
                </div>
              </button>
            ))}
            {reviewerArchetypeAnalysis.candidateSeedUsers.length === 0  ?  (
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
                    {archetypeLabel(row.hiddenReviewerArchetype)}  ·  guided turn bias {formatDecimal(row.guidedTurnBias, 2)}
                  </span>
                </div>
                <div className="recovery-preview-row__meta">
                  <span className="muted">
                    Cohort: {row.inferredCohortId  ?  cohortLabels.full(row.inferredCohortId) : 'none'}
                  </span>
                  <span className="muted">Signal {formatDecimal(row.effectiveSignal)}</span>
                  {row.analystFlags.length > 0  ?  <span className="muted">{row.analystFlags.slice(0, 2).join('  ·  ')}</span> : null}
                  <span className="recovery-preview-row__action">Open detail</span>
                </div>
              </button>
            ))}
            {reviewerArchetypeAnalysis.earlyScouts.length === 0  ?  (
              <EmptyState title="No early scouts" description="Guided turn timing has not yet produced any early-scout patterns." />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  const declaredOverlapText = declaredTagOverlap
     ?  declaredTagOverlap.isExact
       ?  `Exact tag fit  ·  ${declaredTagOverlap.overlap}/${declaredTagOverlap.total} tags`
      : `${declaredTagOverlap.overlap}/${declaredTagOverlap.total} declared tags`
    : 'No declared-tag overlap available.';
  const inverseNotice = showInverseDiagnostic
     ?  `Anti-match signal: ${cohortLabels.full(selectedInference ?.inverseTop.cohortId  ??  null)}  ·  inverse evidence ${formatPercent(selectedInference ?.inverseTop.score  ??  0)}`
    : 'No strong inverse signal';
  const declaredDistributionCard = (
    <div className="stack">
      <DistributionDonut slices={declaredDistributionSlices} />
      <DistributionLegend slices={declaredDistributionSlices} formatPercent={formatPercent} />
    </div>
  );
  const behaviorDistributionCard = (
    <div className="stack">
      <DistributionDonut slices={behaviorDistributionSlices} />
      <DistributionLegend slices={behaviorDistributionSlices} formatPercent={formatPercent} />
    </div>
  );

  const selectedUserSummary = selectedInference  ?  (
    <SelectedUserSummary
      selectedUserLabel={selectedUser ?.label  ??  'None'}
      declaredTags={selectedUser ?.declaredTags  ??  []}
      selectedInference={selectedInference}
      selectedPrimarySignal={selectedPrimarySignal}
      selectedInferenceDiagnosticsMessage={selectedInferenceDiagnostics ?.message}
      selectedInferenceDiagnosticsType={selectedInferenceDiagnostics ?.type}
      selectedRaterSignalProfile={selectedRaterSignalProfile}
      selectedDiscoverySignalProfile={selectedDiscoverySignalProfile}
      declaredOverlapText={declaredOverlapText}
      declaredObservedRelationshipText={declaredObservedRelationshipText}
      behaviorReadText={behaviorReadSummary ?.message  ??  'Not enough rating data yet.'}
      inverseNotice={inverseNotice}
      cohortLabel={(cohortId) => cohortLabels.full(cohortId  ??  null)}
      openUserPicker={() => setModalKind('user')}
      pinCurrentUser={() => {
        if (selectedUser) {
          setPinnedDrilldownKind('user');
        }
      }}
      renderPrimarySignalTitle={(signal) => renderPrimarySignalTitle(signal, cohortLabels.full)}
      signalRows={signalRows}
      signalColumns={signalColumns}
      declaredDistributionChart={declaredDistributionCard}
      behaviorDistributionChart={behaviorDistributionCard}
    />
  ) : null;
  const discoveryRoutingSummary = selectedUser  ?  (
    <DiscoveryRoutingSummary
      selectedUserLabel={selectedUser.label}
      routingModeLabel={visibleTurnModeLabel}
      routingProfileLabel={ROUTING_RISK_PROFILE_LABELS[routingRiskProfile]}
      explorationWeight={effectiveRoutingValues.explorationWeight}
      minimumPredictedFit={effectiveRoutingValues.minimumPredictedFit}
      guidedRecommendationsPerUser={guidedRecommendationsPerUser}
      recommendations={selectedUserRecommendations}
      deprioritizationRows={selectedUserDeprioritization}
      islandLabelForId={(islandId) => dataset.islands.find((island) => island.id === islandId) ?.label  ??  islandId}
      onInspectRecommendation={(row) => setDrawerState({ type: 'recommendation', userId: selectedUser.id, islandId: row.islandId })}
    />
  ) : (
    <EmptyState title="Select a user" description="Discovery routing appears once a user is selected." />
  );

  const selectedIslandSummary = selectedIsland  ?  (
    <div className="stack">

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
               ?  `${exactMatchRate.matches}/${exactMatchRate.rated} (${formatPercent(exactMatchRate.rate)})`
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
          <h4>Cohort-local island affinity <FormulaTip label="Island affinity" formula="weighted contribution = user rating  ·  cohort-local rater signal; observed mean = weighted sum / effective weight; affinity = shrunk observed mean" inputs="effective weight is summed positive cohort-local rater signal for that island." interpretation="Positive and negative sides show directional audience fit only; not a recommendation guarantee or moderation verdict." /></h4>
          <p>Weighted by rater signal only. Higher-signal raters count more for their strongest cohort.</p>
        </div>
        <section className="distribution-card">
          <h4>Directional audience affinity <FormulaTip label="Directional audience affinity" formula="affinity is centered around zero from weighted ratings per cohort" inputs="positive affinity extends right; negative affinity extends left; values are shrinkage-adjusted." interpretation="Direction indicates audience fit polarity, not certainty by itself." /></h4>
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
      <SelectedIslandEvidenceSummary
        confidenceRadarData={confidenceRadarData}
        ratingEventWeightRows={selectedIslandEventWeightRows}
        observedBehaviorRows={selectedIslandObservedBehaviorRows}
        observedBehaviorSummary={selectedIslandObservedBehaviorSummary}
        timelineRows={selectedIslandTimelineRows}
        constellation={selectedIslandConstellation}
        cohortLabelById={selectedIslandCohortLabelById}
        islandLabel={selectedIsland.label}
      />
    </div>
  ) : null;

  const selectedUserDetail = selectedUser && selectedInference  ?  (
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
          Overall: {formatDecimal(selectedRaterSignalProfile ?.overallSignal  ??  0)} | Evidence:{' '}
          {formatPercent(selectedRaterSignalProfile ?.signalEvidence  ??  0)}
        </p>
        <p className="muted">Top cohort: {cohortLabels.full(selectedRaterSignalProfile ?.topCohortId  ??  null)}</p>
      </section>
      <section className="detail-block">
        <h4>Hidden taste truth</h4>
        <p>Hidden taste cohort: {selectedUser.hiddenTasteCohortId  ?  cohortLabels.full(selectedUser.hiddenTasteCohortId) : 'none'}</p>
        <p>Hidden taste kind: {selectedUser.hiddenTasteCohortKind  ??  'n/a'}</p>
        <p className="muted">Hidden preference vector: {summarizeWeightedVector(selectedUser.hiddenTastePreferenceVector)}</p>
      </section>
      <section className="detail-block">
        <h4>Diagnosis</h4>
        <p>{renderPrimarySignalTitle(selectedPrimarySignal, cohortLabels.full)  ??  selectedInference.diagnosis.message}</p>
        <p className="muted">{selectedPrimarySignal ?.message  ??  selectedInference.diagnosis.message}</p>
      </section>
      <section className="detail-block">
        <h4>Reviewer checksum</h4>
        <p>
          Hidden generator archetype:{' '}
          {selectedUser.hiddenReviewerArchetype  ?  archetypeLabel(selectedUser.hiddenReviewerArchetype) : 'none'}
        </p>
        <p>
          Recovery status:{' '}
          {selectedUserReviewerReport  ?  (
            <Badge tone={reviewerRecoveryTone(selectedUserReviewerReport.recoveryStatus)}>
              {selectedUserReviewerReport.recoveryStatus}
            </Badge>
          ) : (
            'n/a'
          )}
        </p>
        <p className="muted">
          Analyst flags: {selectedUserReviewerReport ?.analystFlags.join('  ·  ')  ??  'n/a'}
        </p>
        <p className="muted">Hidden labels are debug checksums only. They do not feed the model.</p>
      </section>
      <section className="detail-block">
        <h4>Debug</h4>
        <p>Hidden seed: {selectedUser.hiddenSeedCohortId  ?  cohortLabels.full(selectedUser.hiddenSeedCohortId) : 'none'}</p>
        <p>Hidden behavior profile: {selectedUser.hiddenBehaviorProfile  ??  'n/a'}</p>
        <p>Tag alignment: {selectedUser.hiddenTagAlignment  ??  'n/a'}</p>
        <p>Rating alignment: {selectedUser.hiddenRatingAlignment  ??  'n/a'}</p>
      </section>
    </div>
  ) : null;

  const selectedIslandDetail = selectedIsland  ?  (
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
      {selectedIslandTruthComparison  ?  <SelectedIslandTruthComparison report={selectedIslandTruthComparison} panelRef={selectedIslandTruthTargetRef} /> : null}
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
              <Badge tone={rating === 1  ?  'success' : rating === -1  ?  'danger' : 'warning'}>
                {formatRating(rating)}
              </Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  ) : null;

  const selectedCohortDetail = selectedComparisonCohort  ?  (
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
        <p>{selectedComparisonCohort.source === 'meta_moderator'  ?  'Trusted seed cohort anchor' : 'Analyst-defined cohort'}</p>
      </section>
    </div>
  ) : null;

  const selectedPseudoDetail = drawerState ?.type === 'pseudo'
     ?  dataset.pseudoCohortAnalysis.allReports.find((report) => report.key === drawerState.key)  ??  null
    : null;

  const selectedRecommendation = selectedRecommendationDetail;
  const recommendationDrawerContent = selectedRecommendation  ?  (
    <div className="detail-stack">
      <section className="detail-block">
        <h4>{dataset.islands.find((island) => island.id === selectedRecommendation.islandId) ?.label  ??  selectedRecommendation.islandId}</h4>
        <p className="muted">{selectedRecommendation.recommendationKind === 'SAFE_FIT'  ?  'Safe fit' : 'Discovery probe'}</p>
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
                {formatSignedDecimal(entry.affinity)}  ·  confidence {formatPercent(entry.confidence)}  ·  evidence {formatDecimal(entry.effectiveWeight)}
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

  const pseudoDrawerContent = selectedPseudoDetail  ?  (
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

  const selectedAffinityReport = drawerState ?.type === 'affinity'
     ?  dataset.islandAffinityReports.get(drawerState.islandId)  ??  null
    : null;

  const selectedAffinityCohort = drawerState ?.type === 'affinity'
     ?  dataset.cohorts.find((cohort) => cohort.id === drawerState.cohortId)  ??  null
    : null;

  const affinityDrawerContent = selectedAffinityDetail && selectedAffinityReport && selectedAffinityCohort  ?  (
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
          {selectedAffinityDetail.contributions.length > 0  ?  (
            selectedAffinityDetail.contributions.map((contribution) => (
              <div key={`${contribution.userId}-${contribution.rating}-${contribution.raterSignal}`} className="detail-mini-table__row">
                <span>{contribution.userId}</span>
                <Badge tone={contribution.rating === 1  ?  'success' : contribution.rating === -1  ?  'danger' : 'warning'}>
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

  const reviewerDrawerContent = selectedReviewerReport  ?  (
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
        <p>Inferred cohort: {selectedReviewerReport.inferredCohortId  ?  cohortLabels.full(selectedReviewerReport.inferredCohortId) : 'none'}</p>
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
          {selectedReviewerReport.analystFlags.length > 0  ?  (
            selectedReviewerReport.analystFlags.map((flag) => (
              <Badge key={flag} tone="neutral">
                {flag}
              </Badge>
            ))
          ) : (
            <span className="muted">No flags yet.</span>
          )}
        </div>
        <p className="muted">Review candidate: {selectedReviewerReport.reviewCandidate  ?  'yes' : 'no'}</p>
      </section>
    </div>
  ) : null;

  const modelExplanation = selectedInference  ?  (
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

      {behaviorIsNonInformative  ?  (
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
               ?  cohortLabels.full(selectedInference.diagnosis.suggestedCohortId)
              : 'none'}
          </span>
          <span className="muted">
            Suggested tags:{' '}
            {selectedInference.diagnosis.suggestedTags ?.length
               ?  selectedInference.diagnosis.suggestedTags.join(', ')
              : 'none'}
          </span>
        </div>
      </section>
    </div>
  ) : (
    <EmptyState title="No user selected" description="Choose a user to inspect declared and behavioral fit." />
  );

  const islandComparison = selectedUser && selectedComparisonCohort  ?  (
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
        const userRating = selectedUser.ratings[island.id]  ??  null;
        const cohortRating = selectedComparisonCohort.ratings[island.id]  ??  null;
        const match =
          userRating === null && cohortRating === null
             ?  'Both unrated'
            : userRating === null
               ?  'User unrated'
              : cohortRating === null
                 ?  'Cohort unrated'
            : userRating === cohortRating
               ?  'Match'
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
    disabled = standardScenarioControlsDisabled
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
    setRunPresentationSource('cold-load');
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
    const scenarioPreset = scenarioPresetSource  ??  activeScenarioPresetMetadata  ??  null;
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
      latestTurnSummary: simulationState.turnHistory[simulationState.turnHistory.length - 1]  ??  null,
      exportFileName: fileName
    });
  };

  const openGoldenDemoReport = () => {
    if (!goldenDemoReport) {
      return;
    }

    setDrawerState({ type: 'golden-demo-report' });
    setScenarioError('');
    setScenarioMessage('Opened Golden Demo report preview');
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
    setRunPresentationSource('imported');
    setScenarioPresetSource(scenario.scenarioPreset  ??  (importedPresetMatch  ?  scenarioPresetMetadataFromPreset(importedPresetMatch) : null));
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
         ?  `Imported ${scenario.label} from ${scenario.scenarioPreset.label}`
        : `Imported ${scenario.label}`
    );
    setRecentAction({
      kind: 'scenario-imported',
      scenarioLabel: scenario.scenarioPreset ?.label  ??  importedPresetMatch ?.label  ??  'Custom / imported',
      turnModeLabel: TURN_MODE_LABELS[scenario.turnPolicy.turnMode],
      previousTurn: restoredState.currentTurn,
      currentTurn: restoredState.currentTurn,
      latestTurnSummary: restoredState.turnHistory[restoredState.turnHistory.length - 1]  ??  null
    });
  };

  const handleScenarioFileChange = async (event: { target: HTMLInputElement; currentTarget: HTMLInputElement }) => {
    const file = event.target.files ?.[0];
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    await importScenarioFromFile(file);
  };

  const openScenarioFilePicker = () => {
    scenarioFileInputRef.current ?.click();
  };

  const executeScenario = async () => {
    if (isExecutingScenario) {
      return;
    }

    const nextSeed = executionSeedMode === 'random'  ?  Math.floor(Math.random() * 1_000_000_000) : seed;
    const selectedScenarioPresetSource = scenarioPresetSource  ??  activeScenarioPresetMetadata  ??  null;
    const resolvedControls: ScenarioPresetControls = {
      ...currentScenarioControls,
      seed: nextSeed
    };
    const executionLabel = selectedScenarioPresetSource ?.label  ??  'Custom / imported';
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
      setTurnTimingLog([]);
      setExecutionProgress(0.25);
      await new Promise((resolve) => setTimeout(resolve, 32));

      let nextState = initialState;

      for (let index = 0; index < turnsToRun; index += 1) {
        if (scenarioExecutionTokenRef.current !== executionToken) {
          return;
        }

        const startTime = performance.now();
        setExecutionStatus(`Advancing turn ${index + 1} of ${turnsToRun}.`);
        nextState = advanceCurrentTurn(nextState);
        const endTime = performance.now();
        const latestTurn = nextState.turnHistory[nextState.turnHistory.length - 1];
        if (latestTurn) {
          setTurnTimingLog((rows) =>
            rows.concat({
              turn: latestTurn.turn,
              durationMs: endTime - startTime,
              ratingsCreated: latestTurn.ratingsCreated,
              mode: latestTurn.mode
            })
          );
        }
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
      setRunPresentationSource(nextState.currentTurn > 0  ?  'executed' : 'cold-load');
      setRecentAction({
        kind: 'scenario-executed',
        scenarioLabel: executionLabel,
        turnModeLabel: TURN_MODE_LABELS[resolvedControls.turnPolicy.turnMode],
        previousTurn: 0,
        currentTurn: nextState.currentTurn,
        latestTurnSummary: nextState.turnHistory[nextState.turnHistory.length - 1]  ??  null,
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
      const startTime = performance.now();
      const nextState = advanceCurrentTurn(state);
      const endTime = performance.now();
      const latestTurn = nextState.turnHistory[nextState.turnHistory.length - 1];
      if (latestTurn) {
        setTurnTimingLog((rows) =>
          rows.concat({
            turn: latestTurn.turn,
            durationMs: endTime - startTime,
            ratingsCreated: latestTurn.ratingsCreated,
            mode: latestTurn.mode
          })
        );
      }
      setRecentAction({
        kind: 'turn-advanced',
        scenarioLabel: currentScenarioLabel,
        turnModeLabel: TURN_MODE_LABELS[turnMode],
        previousTurn: state.currentTurn,
        currentTurn: nextState.currentTurn,
        latestTurnSummary: nextState.turnHistory[nextState.turnHistory.length - 1]  ??  null
      });
      if (nextState.currentTurn > 0) {
        setRunPresentationSource('executed');
      }
      return nextState;
    });
  };

  const takeBatchTurns = () => {
    setSimulationState((state) => {
      let next = state;

      for (let index = 0; index < turnsToRun; index += 1) {
        const startTime = performance.now();
        next = advanceCurrentTurn(next);
        const endTime = performance.now();
        const latestTurn = next.turnHistory[next.turnHistory.length - 1];
        if (latestTurn) {
          setTurnTimingLog((rows) =>
            rows.concat({
              turn: latestTurn.turn,
              durationMs: endTime - startTime,
              ratingsCreated: latestTurn.ratingsCreated,
              mode: latestTurn.mode
            })
          );
        }
      }

      setRecentAction({
        kind: 'batch-turns-advanced',
        scenarioLabel: currentScenarioLabel,
        turnModeLabel: TURN_MODE_LABELS[turnMode],
        previousTurn: state.currentTurn,
        currentTurn: next.currentTurn,
        latestTurnSummary: next.turnHistory[next.turnHistory.length - 1]  ??  null,
        batchSize: turnsToRun
      });
      if (next.currentTurn > 0) {
        setRunPresentationSource('executed');
      }

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
    setTurnTimingLog([]);
    resetControlPolicy();
    setRunPresentationSource('cold-load');
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

    if (runPresentationSource === 'cold-load' && !isExecutingScenario) {
      setSimulationState(initialSimulationState);
    }
  }, [currentScenarioControls, importedScenario, initialSimulationState, isExecutingScenario, runPresentationSource]);

  const presentationState = useMemo(
    () =>
      derivePresentationState({
        guidanceMode,
        runSource: runPresentationSource,
        simulationState
      }),
    [guidanceMode, runPresentationSource, simulationState]
  );
  const isMeaningfulRunLoaded = presentationState.runState === 'meaningful-run';
  const showAnalysisDashboard = presentationState.guidanceMode === 'expert' || isMeaningfulRunLoaded;

  const activeScenarioPreset = useMemo(
    () => resolveScenarioPresetFromControls(currentScenarioControls),
    [currentScenarioControls]
  );
  const isGoldenDemoPath = scenarioPresetSource ?.id === 'golden-demo' || activeScenarioPreset ?.id === 'golden-demo';
  const hasGoldenDemoReportAccess = isGoldenDemoPath && isMeaningfulRunLoaded;
  const goldenDemoReport = useMemo(
    () =>
      hasGoldenDemoReportAccess
         ?  buildGoldenDemoReport({
            state: simulationState,
            scenario: activeScenarioPreset  ??  INITIAL_SCENARIO_PRESET
          })
        : null,
    [activeScenarioPreset, hasGoldenDemoReportAccess, simulationState]
  );
  const activeScenarioPresetMetadata = activeScenarioPreset  ?  scenarioPresetMetadataFromPreset(activeScenarioPreset) : null;
  const hasScenarioSelection = Boolean(scenarioPresetSource  ??  activeScenarioPresetMetadata  ??  importedScenario);
  const standardScenarioControlsDisabled = isExecutingScenario || !hasScenarioSelection;
  const scenarioPresetDisplay =
    activeScenarioPreset  ??  (scenarioPresetSource  ?  (getScenarioPreset(scenarioPresetSource.id as ScenarioPresetId)  ??  null) : null);
  const scenarioPresetSourceNote =
    scenarioPresetSource && (!activeScenarioPresetMetadata || scenarioPresetSource.id !== activeScenarioPresetMetadata.id)
       ?  scenarioPresetSource
      : null;
  const currentScenarioLabel = scenarioPresetDisplay ?.label  ??  scenarioPresetSource ?.label  ??  'Custom / imported';
  const primaryWorkflowHelperCopy = useMemo(() => {
    if (!hasScenarioSelection) {
      return 'Select a scenario or import valid data to enable scenario inspection controls.';
    }

    if (presentationState.runState === 'bootstrap-only') {
      return 'Baseline state loaded. You can inspect setup data or advance turns; the proof path appears after post-bootstrap turn history exists.';
    }

    if (presentationState.runState === 'meaningful-run') {
      return 'Meaningful run loaded. Use the badges and controls below to navigate, advance, or inspect the run.';
    }

    return `${currentScenarioLabel} is selected. You can inspect or advance the generated setup; execute the scenario to unlock the portfolio proof path and demo report.`;
  }, [currentScenarioLabel, hasScenarioSelection, presentationState.runState]);
  const selectedGuidedPath = useMemo(() => getGuidedPath(guidedPathId), [guidedPathId]);
  const guidedPathController = useGuidedPathController(selectedGuidedPath.steps);
  const guidedTargetRegistry = useGuidedTargetRegistry();
  const { activeTargetId: guidedActiveTargetId, registerTarget: registerGuidedTarget, showTarget: showGuidedTarget } = guidedTargetRegistry;

  useEffect(() => {
    const unregisterTurnSummaryTarget = registerGuidedTarget('turn-summary', {
      elementRef: turnSummaryTargetRef,
      expand: () => setTurnSummaryCollapsed(false)
    });

    return unregisterTurnSummaryTarget;
  }, [registerGuidedTarget, turnSummaryTargetRef]);

  useEffect(() => {
    const unregisterPrimaryWorkflowTarget = registerGuidedTarget('primary-workflow', {
      elementRef: primaryWorkflowTargetRef,
      expand: () => setPrimaryWorkflowCollapsed(false)
    });

    return unregisterPrimaryWorkflowTarget;
  }, [registerGuidedTarget, primaryWorkflowTargetRef]);

  useEffect(() => {
    const unregisterExecuteScenarioTarget = registerGuidedTarget('execute-scenario', {
      elementRef: executeScenarioTargetRef,
      expand: () => setPrimaryWorkflowCollapsed(false)
    });

    return unregisterExecuteScenarioTarget;
  }, [registerGuidedTarget, executeScenarioTargetRef]);

  useEffect(() => {
    const unregisterTurnRecapTarget = registerGuidedTarget('turn-recap', {
      elementRef: turnRecapTargetRef
    });

    return unregisterTurnRecapTarget;
  }, [registerGuidedTarget, turnRecapTargetRef]);

  useEffect(() => {
    const unregisterSelectedUserSummaryTarget = registerGuidedTarget('selected-user-summary', {
      elementRef: selectedUserSummaryTargetRef
    });

    return unregisterSelectedUserSummaryTarget;
  }, [registerGuidedTarget, selectedUserSummaryTargetRef]);

  useEffect(() => {
    const unregisterHiddenCohortRecoveryTarget = registerGuidedTarget('hidden-cohort-recovery', {
      elementRef: hiddenCohortRecoveryTargetRef
    });

    return unregisterHiddenCohortRecoveryTarget;
  }, [registerGuidedTarget, hiddenCohortRecoveryTargetRef]);

  useEffect(() => {
    const unregisterSelectedIslandTarget = registerGuidedTarget('selected-island', {
      elementRef: selectedIslandTargetRef,
      expand: () => setSelectedIslandCollapsed(false)
    });

    return unregisterSelectedIslandTarget;
  }, [registerGuidedTarget, selectedIslandTargetRef]);

  useEffect(() => {
    const unregisterSelectedIslandTruthTarget = registerGuidedTarget('selected-island-truth', {
      elementRef: selectedIslandTruthTargetRef,
      expand: () => setSelectedIslandCollapsed(false)
    });

    return unregisterSelectedIslandTruthTarget;
  }, [registerGuidedTarget, selectedIslandTruthTargetRef]);

  useEffect(() => {
    const unregisterDiscoveryRoutingTarget = registerGuidedTarget('discovery-routing', {
      elementRef: discoveryRoutingTargetRef,
      expand: () => setDiscoveryRoutingCollapsed(false)
    });

    return unregisterDiscoveryRoutingTarget;
  }, [registerGuidedTarget, discoveryRoutingTargetRef]);

  useEffect(() => {
    const unregisterDemoReportTarget = registerGuidedTarget('demo-report', {
      elementRef: demoReportTargetRef,
      expand: () => {
        setDrawerState({ type: 'golden-demo-report' });
      }
    });

    return unregisterDemoReportTarget;
  }, [registerGuidedTarget, demoReportTargetRef]);

  useEffect(() => {
    if (guidanceMode === 'novice') {
      setGuidanceOpen(true);
      setDynamicSettingsCollapsed(true);
      setPinnedTrayCollapsed(false);
      setShowDebug(false);
      setGuidedPathId(presentationState.runState === 'meaningful-run'  ?  'portfolio-reviewer' : 'run-start');
      return;
    }

    setGuidanceOpen(false);
    setDynamicSettingsCollapsed(false);
    setPinnedTrayCollapsed(true);
    setShowDebug(true);
    setGuidedPathId('analyst-workflow');
  }, [guidanceMode, presentationState.runState]);

  const advanceCurrentTurn = (state: SimulationState) => {
    return advancePolicyTurn(state, currentTurnPolicy);
  };
  const timingTotalMs = useMemo(() => turnTimingLog.reduce((sum, row) => sum + row.durationMs, 0), [turnTimingLog]);
  const timingAverageMs = turnTimingLog.length > 0  ?  timingTotalMs / turnTimingLog.length : 0;
  const slowestTimingRow = useMemo(
    () =>
      turnTimingLog.reduce<TurnTimingRow | null>(
        (slowest, row) => (!slowest || row.durationMs > slowest.durationMs  ?  row : slowest),
        null
      ),
    [turnTimingLog]
  );

  const handleInspectTopRoute = () => {
    setDrawerState(
      selectedUser && selectedUserRecommendations[0]
         ?  {
            type: 'recommendation',
            userId: selectedUser.id,
            islandId: selectedUserRecommendations[0].islandId
          }
        : null
    );
  };
  const handlePinIsland = () => {
    if (!selectedIsland) {
      return;
    }
    setPinnedDrilldownKind('island');
    setPinnedTrayCollapsed(false);
  };

  const dashboardSections: Record<DashboardPanelGroupKey, { title: string; panels: JSX.Element[] }> = {
    overview: {
      title: 'Overview',
      panels: [
        <Panel
          key="turn-summary"
          ref={turnSummaryTargetRef}
          id="turn-summary"
          title="Turn Summary"
          className={`panel--full${guidedActiveTargetId === 'turn-summary' ? ' guided-target--active' : ''}`}
          hideTitle
        >
          <ModulePanelHeader
            title="Turn Summary"
            subtitle="Current state and most recent turn output."
            collapsed={turnSummaryCollapsed}
            onToggleCollapsed={() => setTurnSummaryCollapsed((value) => !value)}
            collapseLabel={turnSummaryCollapsed  ?  'Expand Turn Summary' : 'Collapse Turn Summary'}
          />
          {!turnSummaryCollapsed  ?  <div className="metric-grid metric-grid--compact">
            <MetricCard label="Current turn" value={dataset.currentTurn} tone="accent" />
            <MetricCard
              label="Mode"
              value={
                currentTurnSummary ?.mode === 'guided'
                   ?  TURN_MODE_LABELS.guided
                  : currentTurnSummary ?.mode === 'mixed'
                     ?  TURN_MODE_LABELS.mixed
                    : TURN_MODE_LABELS.organic
              }
              helper="How the most recent turn created rating events."
            />
            <MetricCard label="Rating events" value={dataset.ratingEvents.length} />
            <MetricCard label="Ratings this turn" value={currentTurnSummary ?.ratingsCreated  ??  0} />
            <MetricCard label="Organic events this turn" value={currentTurnSummary ?.organicRatingsCreated  ??  0} />
            <MetricCard label="Guided events this turn" value={currentTurnSummary ?.guidedRatingsCreated  ??  0} />
            <MetricCard
              label="Participating users this turn"
              value={currentTurnSummary ?.participatingUserIds.length  ??  0}
            />
            <MetricCard label="New islands rated" value={currentTurnSummary ?.newlyRatedIslandIds.length  ??  0} />
            <MetricCard label="Safe fits routed" value={currentTurnSummary ?.recommendationKinds.SAFE_FIT  ??  0} />
            <MetricCard
              label="Discovery probes"
              value={currentTurnSummary ?.recommendationKinds.DISCOVERY_PROBE  ??  0}
            />
          </div> : null}
          {!turnSummaryCollapsed  ?  <div className="summary-inline">
            {(dataset.turnHistory.slice(-3)  ??  []).map((turn) => (
              <Badge key={turn.turn} tone="neutral">
                Turn {turn.turn}:{' '}
                {turn.mode === 'guided'
                   ?  TURN_MODE_LABELS.guided
                  : turn.mode === 'mixed'
                     ?  TURN_MODE_LABELS.mixed
                    : TURN_MODE_LABELS.organic}  · {' '}
                {turn.ratingsCreated} ratings
              </Badge>
            ))}
          </div> : null}
        </Panel>,
        <TurnRecapPanel key="turn-recap" panelRef={turnRecapTargetRef} id="turn-recap" report={turnRecapReport} />,
        <SystemMovementPanel key="system-movement" analysis={systemMovementAnalysis} />,
        <Panel key="population-summary" id="population-summary" title="Population Summary" className="panel--full" collapsible defaultCollapsed>
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
          id="system-health"
          summary={systemHealthSummary}
          collapsed={true}
          showConfidenceSeries={showConfidenceSeries}
          onToggleSeries={(key) => setShowConfidenceSeries((current) => ({ ...current, [key]: !current[key] }))}
        />,
        <ConfidenceGrowthPanel key="confidence-growth" rows={confidenceGrowthRows} collapsed />
      ]
    },
      recovery: {
      title: 'Recovery',
      panels: [
        <Panel
          key="selected-user"
          ref={selectedUserSummaryTargetRef}
          id="selected-user-summary"
          title="Selected User Summary"
          className="panel--wide"
          collapsible
        >
          {selectedUser && selectedInference  ?  selectedUserSummary : <EmptyState title="No user selected" description="Open the user picker to inspect an individual user." />}
        </Panel>,
        <HiddenCohortRecoveryPanel key="hidden-cohort-recovery" panelRef={hiddenCohortRecoveryTargetRef} id="hidden-cohort-recovery" report={hiddenCohortRecoveryReport} />,
        <Panel key="reviewer-archetype" id="reviewer-archetype-recovery" title="Reviewer Archetype Recovery" className="panel--wide" collapsible defaultCollapsed>
          {reviewerArchetypeSummary}
        </Panel>
      ]
    },
    routing: {
      title: 'Routing',
      panels: [
        <DiscoveryRoutingPanel
          key="discovery-routing"
          panelRef={discoveryRoutingTargetRef}
          id="discovery-routing"
          collapsed={discoveryRoutingCollapsed}
          onToggleCollapsed={() => setDiscoveryRoutingCollapsed((value) => !value)}
          onInspectTopRoute={handleInspectTopRoute}
          onChooseUser={() => setModalKind('user')}
          hasSelectedUser={Boolean(selectedUser)}
          summary={discoveryRoutingSummary}
        />,
        <SelectedIslandPanel
          key="selected-island"
          panelRef={selectedIslandTargetRef}
          id="selected-island"
          collapsed={selectedIslandCollapsed}
          onToggleCollapsed={() => setSelectedIslandCollapsed((value) => !value)}
          onPinIsland={handlePinIsland}
          onChooseIsland={() => setModalKind('island')}
          islandLabel={selectedIsland ?.label  ??  'No island selected'}
          hasSelectedIsland={Boolean(selectedIsland)}
          summary={selectedIslandSummary}
        />,
        ...(isNoviceMode
           ?  []
          : [
              <Panel key="model-explanation" id="model-explanation" title="Model Explanation" className="panel--wide" collapsible>
                {modelExplanation}
              </Panel>,
              <Panel key="island-comparison" id="island-comparison" title="Island Comparison" className="panel--wide" collapsible>
                {islandComparison}
              </Panel>,
              <Panel key="pseudo-cohorts" id="pseudo-cohort-reports" title="Pseudo-Cohort Reports" className="panel--wide" collapsible>
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
         ?  [
            <Panel key="debug-data" id="debug-data" title="Debug Data" className="panel--wide" collapsible>
              {selectedUser && selectedInference  ?  (
                <div className="debug-grid">
                  <MetricCard
                    label="Hidden seed"
                    value={selectedUser.hiddenSeedCohortId  ?  cohortLabels.full(selectedUser.hiddenSeedCohortId) : 'none'}
                    helper="Debug and validation only."
                  />
                  <MetricCard
                    label="Hidden generator archetype"
                    value={selectedUser.hiddenReviewerArchetype  ?  archetypeLabel(selectedUser.hiddenReviewerArchetype) : 'none'}
                    helper="Debug and validation only."
                  />
                  <MetricCard
                    label="Hidden tag alignment"
                    value={selectedUser.hiddenTagAlignment  ??  'n/a'}
                    helper="Debug and validation only."
                  />
                  <MetricCard
                    label="Hidden behavior profile"
                    value={selectedUser.hiddenBehaviorProfile  ??  'n/a'}
                    helper="Debug and validation only."
                  />
                  <MetricCard
                    label="Hidden taste cohort"
                    value={selectedUser.hiddenTasteCohortId  ?  cohortLabels.full(selectedUser.hiddenTasteCohortId) : 'none'}
                    helper="Debug and validation only."
                  />
                  <MetricCard
                    label="Hidden taste kind"
                    value={selectedUser.hiddenTasteCohortKind  ??  'n/a'}
                    helper="Debug and validation only."
                  />
                  <MetricCard
                    label="Hidden vs inferred"
                    value={
                      selectedUser.hiddenSeedCohortId === selectedInference.behaviorTop.cohortId
                         ?  'Recovered hidden seed'
                        : 'Different visible fit'
                    }
                    helper="Hidden data is not a model input."
                  />
                  <MetricCard
                    label="Recovery status"
                    value={selectedUserReviewerReport ?.recoveryStatus  ??  'n/a'}
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
       ?  selectedUserDetail
      : pinnedDrilldownKind === 'island'
         ?  selectedIslandDetail
        : pinnedDrilldownKind === 'cohort'
           ?  selectedCohortDetail
          : null;

  const pinnedDrilldownTitle =
    pinnedDrilldownKind === 'user'
       ?  `Pinned user: ${selectedUser ?.label  ??  'none'}`
      : pinnedDrilldownKind === 'island'
         ?  `Pinned island: ${selectedIsland ?.label  ??  'none'}`
      : pinnedDrilldownKind === 'cohort'
         ?  `Pinned cohort: ${selectedComparisonLabel}`
        : 'Pinned reference';

  const pinnedTraySpace = pinnedTrayCollapsed  ?  92 : 456;
  const instructionTraySpace = showInstructionTray  ?  (guidanceOpen  ?  456 : 92) : 0;

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
          <AboutGlossaryLauncher />
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
              className={`segmented-button${guidanceMode === 'novice'  ?  ' segmented-button--active' : ''}`}
              aria-pressed={guidanceMode === 'novice'}
              onClick={() => setGuidanceMode('novice')}
            >
              Novice
            </button>
            <button
              type="button"
              className={`segmented-button${guidanceMode === 'expert'  ?  ' segmented-button--active' : ''}`}
              aria-pressed={guidanceMode === 'expert'}
              onClick={() => setGuidanceMode('expert')}
            >
              Expert
            </button>
          </div>
          <label className="control control--inline control--wide">
            <span>Guided path</span>
              <select value={guidedPathId} onChange={(event) => setGuidedPathId(event.target.value as GuidedPathId)}>
              {GUIDED_PATHS.map((path) => (
                <option key={path.id} value={path.id}>
                  {path.title}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <PrimaryWorkflowPanel
        panelRef={primaryWorkflowTargetRef}
        executeScenarioRef={executeScenarioTargetRef}
        demoReportRef={demoReportTargetRef}
        collapsed={primaryWorkflowCollapsed}
        onToggleCollapsed={() => setPrimaryWorkflowCollapsed((value) => !value)}
        runState={presentationState.runState}
        showAnalysisDashboard={showAnalysisDashboard}
        primaryWorkflowHelperCopy={primaryWorkflowHelperCopy}
        scenarioMessage={scenarioMessage}
        scenarioError={scenarioError}
        isExecutingScenario={isExecutingScenario}
        executionProgress={executionProgress}
        executionStatus={executionStatus}
        turnsToRun={turnsToRun}
        datasetCurrentTurn={dataset.currentTurn}
        currentScenarioLabel={currentScenarioLabel}
        turnMode={turnMode}
        participationModel={participationModel}
        organicRatingCountModel={organicRatingCountModel}
        routingRiskProfile={routingRiskProfile}
        scenarioPresetSource={scenarioPresetSource}
        activeScenarioPreset={activeScenarioPreset}
        scenarioPresetDisplay={scenarioPresetDisplay}
        scenarioPresetSourceNote={scenarioPresetSourceNote}
        scenarioPresetOptions={SCENARIO_PRESET_OPTIONS}
        onScenarioPresetChange={(presetId) => {
          if (presetId !== 'custom') {
            applyScenarioPresetSelection(presetId);
          }
        }}
        onExecuteScenario={executeScenario}
        onExportCurrentSimulationJson={exportCurrentSimulationJson}
        onOpenScenarioFilePicker={openScenarioFilePicker}
        onOpenGoldenDemoReport={openGoldenDemoReport}
        onResetSimulation={resetSimulation}
        onToggleDebug={() => setShowDebug((value) => !value)}
        showDebug={showDebug}
        onTakeSingleTurn={takeSingleTurn}
        onTakeBatchTurns={takeBatchTurns}
        onShowTimingLog={() => setShowTimingLog(true)}
        standardScenarioControlsDisabled={standardScenarioControlsDisabled}
        scenarioFileInputRef={scenarioFileInputRef}
        onScenarioFileChange={handleScenarioFileChange}
        showExpertScenarioTuning={!isNoviceMode}
        expertScenarioTuningProps={{
          seed,
          onSeedChange: setSeed,
          numUsers,
          onNumUsersChange: setNumUsers,
          numIslands,
          onNumIslandsChange: setNumIslands,
          bootstrapRatingsPerUser,
          onBootstrapRatingsPerUserChange: setBootstrapRatingsPerUser,
          tagAlignmentDistribution,
          onTagAlignmentDistributionChange: setTagAlignmentDistribution,
          ratingAlignmentDistribution,
          onRatingAlignmentDistributionChange: setRatingAlignmentDistribution,
          turnMode,
          onTurnModeChange: setTurnMode,
          participationModel,
          onParticipationModelChange: setParticipationModel,
          turnsToRun,
          onTurnsToRunChange: setTurnsToRun,
          executionSeedMode,
          onExecutionSeedModeChange: setExecutionSeedMode
        }}
        onChooseUser={() => setModalKind('user')}
        onChooseIsland={() => setModalKind('island')}
        onChooseCohort={() => setModalKind('cohort')}
        canOpenGoldenDemoReport={Boolean(goldenDemoReport)}
      />

      <InspectionShell
        showAnalysisDashboard={showAnalysisDashboard}
        guidanceMode={guidanceMode}
        visibleDashboardSections={visibleDashboardSections}
        dashboardSections={dashboardSections}
        showDebug={showDebug}
        debugCollapsed={debugCollapsed}
        onToggleDebugCollapsed={() => setDebugCollapsed((value) => !value)}
      />

      <section className="top-stack" aria-label="Controls and drilldown">
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
                {participationModel === 'fixed-count'  ?  (
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

            {turnModeVisibility.showOrganic  ?  (
              <section className="policy-subgroup">
                <div className="section-heading">
                  <h3>Organic Exploration</h3>
                </div>
                <div className="control-strip__fields control-strip__fields--dynamic">
                  {organicRatingCountModel === 'fixed-count'  ?  (
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

            {turnModeVisibility.showGuided  ?  (
              <section className="policy-subgroup">
                <div className="section-heading">
                  <h3>Guided Discovery</h3>
                </div>
                <div className="control-strip__fields control-strip__fields--dynamic">
                  {guidedRatingCountModel === 'fixed-count'  ?  (
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
                  {routingRiskProfile === 'custom'  ?  (
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

      </section>

      {showInstructionTray ? (
        <GuidedPathTray
          collapsed={!guidanceOpen}
          onToggleCollapsed={() => setGuidanceOpen((value) => !value)}
          path={selectedGuidedPath}
          controller={guidedPathController}
          onShowTarget={showGuidedTarget}
          title={isNoviceMode ? 'Guided paths' : 'Curator notes'}
        />
      ) : null}

      <Tray
        collapsed={pinnedTrayCollapsed}
        title={pinnedDrilldownTitle}
        side="right"
        className="tray--pinned"
        style={{
          top: '18px',
          right: '18px',
          left: 'auto',
          height: 'calc(100vh - 36px)'
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
        <section className="detail-block">
          <div className="section-heading">
            <h4>Pinned reference controls</h4>
            <p className="muted">Choose the user, island, or cohort to pin in this tray.</p>
          </div>
          <div className="section-toolbar__buttons">
            {openSelectionButton('user', 'Choose user')}
            {openSelectionButton('island', 'Choose island')}
            {openSelectionButton('cohort', 'Choose cohort')}
          </div>
        </section>
        {pinnedDrilldownContent  ?  (
          <section className="detail-block">
            <div className="section-heading section-heading--collapse-row">
              <h4>Pinned details</h4>
              <button
                type="button"
                className="icon-button collapsible-panel__toggle"
                onClick={() => setPinnedDetailCollapsed((value) => !value)}
                aria-label={pinnedDetailCollapsed  ?  'Expand pinned details' : 'Collapse pinned details'}
              >
                <span className="collapsible-panel__toggle-icon" aria-hidden="true">
                  {pinnedDetailCollapsed  ?  'v' : '^'}
                </span>
              </button>
            </div>
            {!pinnedDetailCollapsed  ?  pinnedDrilldownContent : <p className="muted">Pinned drilldown is collapsed.</p>}
          </section>
        ) : (
          <EmptyState
            title="Nothing pinned yet"
            description="Choose a user, island, or cohort to anchor this space."
          />
        )}
      </Tray>

      <Modal open={showTimingLog} title="Turn timing log" onClose={() => setShowTimingLog(false)}>
        {turnTimingLog.length === 0  ?  (
          <EmptyState title="No turn timings recorded yet." description="Advance turns to capture per-turn wall-clock timings." />
        ) : (
          <div className="detail-stack">
            <div className="metric-grid metric-grid--compact">
              <MetricCard label="Total time" value={`${timingTotalMs.toFixed(2)} ms`} />
              <MetricCard label="Average ms/turn" value={`${timingAverageMs.toFixed(2)} ms`} />
              <MetricCard
                label="Slowest turn"
                value={slowestTimingRow  ?  `Turn ${slowestTimingRow.turn} (${slowestTimingRow.durationMs.toFixed(2)} ms)` : 'n/a'}
              />
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th scope="col">Turn</th>
                    <th scope="col" className="report-table__cell--right">Duration</th>
                    <th scope="col" className="report-table__cell--right">Ratings created</th>
                    <th scope="col">Mode</th>
                  </tr>
                </thead>
                <tbody>
                  {turnTimingLog.map((row) => (
                    <tr key={`timing-${row.turn}`}>
                      <td>{row.turn}</td>
                      <td className="report-table__cell--right">{row.durationMs.toFixed(2)} ms</td>
                      <td className="report-table__cell--right">{row.ratingsCreated}</td>
                      <td>{row.mode}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
        selectedId={drawerState ?.type === 'pseudo'  ?  drawerState.key : null}
        onSelect={(id) => {
          setDrawerState({ type: 'pseudo', key: id });
          setModalKind(null);
        }}
        onClose={() => setModalKind(null)}
      />

      <Drawer
        open={drawerState ?.type === 'user'}
        title={drawerState ?.type === 'user'  ?  `User detail: ${selectedUser ?.label  ??  drawerState.id}` : 'User detail'}
        onClose={() => setDrawerState(null)}
      >
        {selectedUserDetail}
      </Drawer>

      <Drawer
        open={drawerState ?.type === 'island'}
        title={drawerState ?.type === 'island'  ?  `Island detail: ${selectedIsland ?.label  ??  drawerState.id}` : 'Island detail'}
        onClose={() => setDrawerState(null)}
      >
        {selectedIslandDetail}
      </Drawer>

      <Drawer
        open={drawerState ?.type === 'pseudo'}
        title={drawerState ?.type === 'pseudo'  ?  'Pseudo-cohort detail' : 'Pseudo-cohort detail'}
        onClose={() => setDrawerState(null)}
      >
        {pseudoDrawerContent}
      </Drawer>

      <Drawer
        open={drawerState ?.type === 'recommendation'}
        title={
          drawerState ?.type === 'recommendation'
             ?  `Recommendation detail: ${
                dataset.islands.find((island) => island.id === drawerState.islandId) ?.label  ??  drawerState.islandId
              }`
            : 'Recommendation detail'
        }
        onClose={() => setDrawerState(null)}
      >
        {recommendationDrawerContent}
      </Drawer>

      <Drawer
        open={drawerState ?.type === 'affinity'}
        title={
          drawerState ?.type === 'affinity'
             ?  `Affinity detail: ${dataset.islands.find((island) => island.id === drawerState.islandId) ?.label  ??  drawerState.islandId} / ${
                selectedAffinityCohort ?.label  ??  drawerState.cohortId
              }`
            : 'Affinity detail'
        }
        onClose={() => setDrawerState(null)}
      >
        {affinityDrawerContent}
      </Drawer>

      <Drawer
        open={drawerState ?.type === 'reviewer'}
        title={drawerState ?.type === 'reviewer'  ?  `Reviewer checksum: ${selectedReviewerReport ?.label  ??  drawerState.userId}` : 'Reviewer checksum'}
        onClose={() => setDrawerState(null)}
      >
        {reviewerDrawerContent}
      </Drawer>

      <Drawer
        open={drawerState ?.type === 'golden-demo-report'}
        title="Current-state Golden Demo report"
        onClose={() => setDrawerState(null)}
      >
        {goldenDemoReport  ?  (
          <div className="detail-stack">
            <section className="detail-block">
              <h4>{goldenDemoReport.title}</h4>
              <p className="muted">
                Current-state Golden Demo report  ·  {goldenDemoReport.scenario.label}  ·  seed {goldenDemoReport.scenario.seed}
              </p>
            </section>
            <section className="detail-block">
              <h4>Report preview</h4>
              <pre className="report-markdown-preview" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                {renderGoldenDemoReportMarkdown(goldenDemoReport)}
              </pre>
            </section>
          </div>
        ) : (
          <EmptyState
            title="Golden Demo only"
            description="Select the Golden Demo preset to generate the presentation-friendly report preview."
          />
        )}
      </Drawer>

      <Suspense fallback={null}>
        <ReviewerArchetypeRecoveryModal
        open={drawerState ?.type === 'reviewer-recovery'}
        onClose={() => setDrawerState(null)}
        analysis={reviewerArchetypeAnalysis}
        cohortRows={reviewerCohortRows}
        cohortLabel={(cohortId) => cohortLabels.full(cohortId  ??  null)}
        reviewerRecoveryTone={reviewerRecoveryTone}
        onOpenReviewer={(userId) => setDrawerState({ type: 'reviewer', userId })}
      />
      </Suspense>
    </main>
  );
}


























