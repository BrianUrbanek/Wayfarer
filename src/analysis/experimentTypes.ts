import type { AlignmentDistribution } from '../generator/columbusGenerator.js';
import type {
  TurnMode
} from '../model/turnPolicy.js';
import type { AdvancePolicyTurnConfig } from '../model/simulation.js';
import type { RecommendationKind } from '../model/recommendations.js';
import type { IslandClass } from '../model/types.js';

export interface ExperimentPolicyCase {
  readonly slug: TurnMode;
  readonly label: string;
  readonly description: string;
}

export interface ExperimentScenarioGeneratorConfig {
  readonly tagAlignmentDistribution: AlignmentDistribution;
  readonly ratingAlignmentDistribution: AlignmentDistribution;
  readonly islandClassWeights?: Partial<Record<IslandClass, number>>;
}

export interface ExperimentScenarioDefinition {
  readonly slug: string;
  readonly label: string;
  readonly description: string;
  readonly presetAligned: boolean;
  readonly seedList: readonly number[];
  readonly userCount: number;
  readonly islandCount: number;
  readonly bootstrapRatingsPerUser: number;
  readonly turnCount: number;
  readonly generatorConfig: ExperimentScenarioGeneratorConfig;
  readonly turnPolicyTemplate: Omit<AdvancePolicyTurnConfig, 'turnMode'>;
  readonly policyCases: readonly ExperimentPolicyCase[];
}

export interface ExperimentRunConfig {
  readonly scenarioSlug: string;
  readonly scenarioLabel: string;
  readonly policyCase: ExperimentPolicyCase;
  readonly seed: number;
  readonly userCount: number;
  readonly islandCount: number;
  readonly bootstrapRatingsPerUser: number;
  readonly turnCount: number;
  readonly generatorConfig: ExperimentScenarioGeneratorConfig;
  readonly turnPolicyTemplate: Omit<AdvancePolicyTurnConfig, 'turnMode'>;
}

export interface ExperimentTurnMetrics {
  readonly turn: number;
  readonly mode: TurnMode;
  readonly participatingUserCount: number;
  readonly ratingsCreated: number;
  readonly organicRatingsCreated: number;
  readonly guidedRatingsCreated: number;
  readonly newlyRatedIslandCount: number;
  readonly routedIslandCount: number;
  readonly recommendationKindCounts: Record<RecommendationKind, number>;
  readonly durationMs: number;
  readonly meanOverallSignal: number;
  readonly medianOverallSignal: number;
  readonly meanSignalEvidence: number;
  readonly medianSignalEvidence: number;
  readonly meanAffinityConfidence: number;
  readonly medianAffinityConfidence: number;
  readonly meanAffinityEvidence: number;
  readonly medianAffinityEvidence: number;
  readonly underReviewedIslandCount: number;
  readonly underReviewedIslandEvidenceMean: number;
  readonly underReviewedIslandEvidenceMedian: number;
}

export interface ExperimentRunAggregateMetrics {
  readonly totalDurationMs: number;
  readonly meanTurnDurationMs: number;
  readonly medianTurnDurationMs: number;
  readonly ratingEvents: number;
  readonly organicRatingsCreated: number;
  readonly guidedRatingsCreated: number;
  readonly routedIslandCount: number;
  readonly discoveryProbeVolume: number;
  readonly smartGambleVolume: number;
  readonly safeFitVolume: number;
  readonly signalStartMean: number;
  readonly signalEndMean: number;
  readonly signalGrowth: number;
  readonly affinityEvidenceStartMean: number;
  readonly affinityEvidenceEndMean: number;
  readonly affinityEvidenceGrowth: number;
  readonly evidenceEfficiency: number;
  readonly underReviewedCoverage: number;
  readonly timeToUsefulSignalTurn: number | null;
  readonly usefulSignalThreshold: number;
  readonly msPerTurn: number;
  readonly msPerPopulationUnit: number;
}

export interface ExperimentRunMetrics {
  readonly scenarioSlug: string;
  readonly scenarioLabel: string;
  readonly seed: number;
  readonly policyCase: ExperimentPolicyCase;
  readonly turnCount: number;
  readonly turnMetrics: readonly ExperimentTurnMetrics[];
  readonly aggregate: ExperimentRunAggregateMetrics;
  readonly finalMeanOverallSignal: number;
  readonly finalMeanAffinityEvidence: number;
}

export interface ExperimentPolicyAggregateMetrics {
  readonly policyCase: ExperimentPolicyCase;
  readonly runCount: number;
  readonly seedList: readonly number[];
  readonly turnCount: number;
  readonly userCount: number;
  readonly islandCount: number;
  readonly bootstrapRatingsPerUser: number;
  readonly usefulSignalThreshold: number;
  readonly totalDurationMs: number;
  readonly meanRunDurationMs: number;
  readonly medianRunDurationMs: number;
  readonly ratingEvents: number;
  readonly organicRatingsCreated: number;
  readonly guidedRatingsCreated: number;
  readonly routedIslandCount: number;
  readonly discoveryProbeVolume: number;
  readonly smartGambleVolume: number;
  readonly safeFitVolume: number;
  readonly signalStartMean: number;
  readonly signalEndMean: number;
  readonly signalGrowth: number;
  readonly affinityEvidenceStartMean: number;
  readonly affinityEvidenceEndMean: number;
  readonly affinityEvidenceGrowth: number;
  readonly evidenceEfficiency: number;
  readonly underReviewedCoverage: number;
  readonly timeToUsefulSignalTurn: number | null;
  readonly msPerTurn: number;
  readonly msPerPopulationUnit: number;
}

export interface ExperimentPolicyResult {
  readonly policyCase: ExperimentPolicyCase;
  readonly runs: readonly ExperimentRunMetrics[];
  readonly aggregate: ExperimentPolicyAggregateMetrics;
}

export interface ExperimentPolicyComparison {
  readonly baselinePolicySlug: TurnMode;
  readonly guidedMinusOrganic: Record<string, number | null>;
  readonly mixedMinusOrganic: Record<string, number | null>;
}

export interface ExperimentScenarioResult {
  readonly definition: ExperimentScenarioDefinition;
  readonly seedList: readonly number[];
  readonly policyResults: readonly ExperimentPolicyResult[];
  readonly comparison: ExperimentPolicyComparison;
}

export interface ExperimentSuiteResult {
  readonly generatedAt: string;
  readonly outputDirectory: string;
  readonly scenarios: readonly ExperimentScenarioResult[];
}

export interface ExperimentRunnerOptions {
  readonly scenarioDefinitions?: readonly ExperimentScenarioDefinition[];
  readonly scenarioSlugs?: readonly string[];
  readonly seeds?: readonly number[];
  readonly outputDirectory?: string;
  readonly generatedAt?: string;
  readonly now?: () => number;
}

export interface ExperimentWriteResult {
  readonly jsonPath: string;
  readonly markdownPath: string;
}

export interface ExperimentReporterOptions {
  readonly usefulSignalThreshold?: number;
  readonly underReviewedEvidenceThreshold?: number;
}

export const DEFAULT_USEFUL_SIGNAL_THRESHOLD = 0.35;
export const DEFAULT_UNDER_REVIEWED_EVIDENCE_THRESHOLD = 6;

export type ExperimentTurnPolicyModel = Pick<
  AdvancePolicyTurnConfig,
  | 'participationModel'
  | 'participatingUsersPerTurn'
  | 'participationChance'
  | 'organicRatingCountModel'
  | 'organicRatingsPerUser'
  | 'organicRatingDice'
  | 'guidedRatingCountModel'
  | 'guidedRecommendationsPerUser'
  | 'guidedRecommendationDice'
  | 'routingRiskProfile'
  | 'customExplorationWeight'
  | 'customMinimumPredictedFit'
>;

export type ExperimentPolicyLabels = Record<TurnMode, string>;
export type ExperimentPolicyDescriptions = Record<TurnMode, string>;

export const EXPERIMENT_POLICY_LABELS: ExperimentPolicyLabels = {
  organic: 'Organic Exploration',
  guided: 'Guided Discovery',
  mixed: 'Mixed'
};

export const EXPERIMENT_POLICY_DESCRIPTIONS: ExperimentPolicyDescriptions = {
  organic: 'Organic exploration only, with routed discovery disabled.',
  guided: 'Guided discovery only, with organic exploration disabled.',
  mixed: 'Shared participants may produce organic and guided events in the same turn.'
};

export type ExperimentScenarioCatalog = Record<string, ExperimentScenarioDefinition>;

export interface ExperimentAnalysisCommandArgs {
  readonly scenarioSlugs?: readonly string[];
  readonly outputDirectory?: string;
  readonly seeds?: readonly number[];
}

export interface ExperimentScenarioSummaryRow {
  readonly policyLabel: string;
  readonly runCount: number;
  readonly signalGrowth: number;
  readonly affinityEvidenceGrowth: number;
  readonly evidenceEfficiency: number;
  readonly timeToUsefulSignalTurn: number | null;
  readonly discoveryProbeVolume: number;
  readonly smartGambleVolume: number;
  readonly safeFitVolume: number;
}
