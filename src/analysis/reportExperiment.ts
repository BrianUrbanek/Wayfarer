import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { DEFAULT_TAGS } from '../data/defaultTags.js';
import { createDefaultCohorts } from '../data/defaultCohorts.js';
import { generateColumbusDataset } from '../generator/columbusGenerator.js';
import { advancePolicyTurn, createInitialSimulationState, type SimulationState } from '../model/simulation.js';
import type { ExperimentPolicyCase, ExperimentPolicyComparison, ExperimentPolicyResult, ExperimentReporterOptions, ExperimentRunMetrics, ExperimentRunnerOptions, ExperimentScenarioDefinition, ExperimentScenarioResult, ExperimentSuiteResult, ExperimentTurnMetrics, ExperimentWriteResult } from './experimentTypes.js';
import { buildPolicyAggregateMetrics, buildPolicyComparison, buildRunAggregateMetrics, buildTurnMetrics } from './metrics.js';
import { listExperimentScenarioDefinitions, resolveExperimentScenarioDefinition } from './scenarios.js';

function resolveScenarioDefinitions(
  scenarioDefinitions: readonly ExperimentScenarioDefinition[] | undefined,
  scenarioSlugs: readonly string[] | undefined
): ExperimentScenarioDefinition[] {
  if (scenarioDefinitions && scenarioDefinitions.length > 0) {
    return scenarioDefinitions.slice();
  }

  if (scenarioSlugs && scenarioSlugs.length > 0) {
    return scenarioSlugs
      .map((slug) => resolveExperimentScenarioDefinition(slug))
      .filter((definition): definition is ExperimentScenarioDefinition => definition !== null);
  }

  return listExperimentScenarioDefinitions();
}

function resolveSeedList(
  scenario: ExperimentScenarioDefinition,
  overrideSeeds: readonly number[] | undefined
): number[] {
  return overrideSeeds && overrideSeeds.length > 0 ? overrideSeeds.slice() : scenario.seedList.slice();
}

function formatTimestampForPath(value: string): string {
  return value.replace(/:/g, '-').replace(/\..+Z$/, 'Z').replace('T', '-');
}

function defaultOutputDirectory(generatedAt: string, scenarioCount: number): string {
  const stamp = formatTimestampForPath(generatedAt);
  const suffix = scenarioCount === 1 ? 'suite' : `${scenarioCount}-scenarios`;
  return resolve(process.cwd(), 'artifacts', 'experiments', `${stamp}-${suffix}`);
}

function clonePolicyTemplate(policyCase: ExperimentPolicyCase): ExperimentRunMetrics['policyCase'] {
  return {
    slug: policyCase.slug,
    label: policyCase.label,
    description: policyCase.description
  };
}

function buildTurnPolicyConfig(
  definition: ExperimentScenarioDefinition,
  policyCase: ExperimentPolicyCase
): Parameters<typeof advancePolicyTurn>[1] {
  return {
    ...definition.turnPolicyTemplate,
    turnMode: policyCase.slug
  };
}

function captureTurnMetricsForState(
  state: SimulationState,
  durationMs: number,
  reporterOptions: ExperimentReporterOptions
): ExperimentTurnMetrics {
  return buildTurnMetrics(state, durationMs, reporterOptions);
}

function runSingleExperiment(
  definition: ExperimentScenarioDefinition,
  policyCase: ExperimentPolicyCase,
  seed: number,
  now: () => number,
  reporterOptions: ExperimentReporterOptions
): ExperimentRunMetrics {
  const dataset = generateColumbusDataset({
    seed,
    numUsers: definition.userCount,
    numIslands: definition.islandCount,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: definition.generatorConfig.tagAlignmentDistribution,
    ratingAlignmentDistribution: definition.generatorConfig.ratingAlignmentDistribution,
    islandClassWeights: definition.generatorConfig.islandClassWeights
  });

  let state = createInitialSimulationState({
    seed,
    allTags: dataset.allTags,
    latentUsers: dataset.users,
    cohorts: dataset.cohorts,
    islands: dataset.islands,
    initialRatingsPerUser: definition.bootstrapRatingsPerUser
  });

  const turnMetrics: ExperimentTurnMetrics[] = [
    captureTurnMetricsForState(state, 0, reporterOptions)
  ];

  for (let turnIndex = 0; turnIndex < definition.turnCount; turnIndex += 1) {
    const start = now();
    state = advancePolicyTurn(state, buildTurnPolicyConfig(definition, policyCase));
    const durationMs = now() - start;
    turnMetrics.push(captureTurnMetricsForState(state, durationMs, reporterOptions));
  }

  const aggregate = buildRunAggregateMetrics(state, turnMetrics, reporterOptions);

  return {
    scenarioSlug: definition.slug,
    scenarioLabel: definition.label,
    seed,
    policyCase: clonePolicyTemplate(policyCase),
    turnCount: definition.turnCount,
    turnMetrics,
    aggregate,
    finalMeanOverallSignal: turnMetrics.at(-1)?.meanOverallSignal ?? 0,
    finalMeanAffinityEvidence: turnMetrics.at(-1)?.meanAffinityEvidence ?? 0
  };
}

function aggregatePolicyResults(
  definition: ExperimentScenarioDefinition,
  policyCase: ExperimentPolicyCase,
  runs: readonly ExperimentRunMetrics[],
  reporterOptions: ExperimentReporterOptions
): ExperimentPolicyResult {
  return {
    policyCase: clonePolicyTemplate(policyCase),
    runs,
    aggregate: buildPolicyAggregateMetrics(
      policyCase,
      runs,
      definition.userCount,
      definition.islandCount,
      definition.bootstrapRatingsPerUser,
      reporterOptions
    )
  };
}

function compareScenarioPolicies(policyResults: readonly ExperimentPolicyResult[]): ExperimentPolicyComparison {
  const organic = policyResults.find((entry) => entry.policyCase.slug === 'organic')?.aggregate;
  const guided = policyResults.find((entry) => entry.policyCase.slug === 'guided')?.aggregate;
  const mixed = policyResults.find((entry) => entry.policyCase.slug === 'mixed')?.aggregate;

  if (!organic || !guided || !mixed) {
    return {
      baselinePolicySlug: 'organic',
      guidedMinusOrganic: {},
      mixedMinusOrganic: {}
    };
  }

  return buildPolicyComparison(organic, guided, mixed);
}

function runScenario(
  definition: ExperimentScenarioDefinition,
  seeds: readonly number[],
  now: () => number,
  reporterOptions: ExperimentReporterOptions
): ExperimentScenarioResult {
  const policyResults = definition.policyCases.map((policyCase) => {
    const runs = seeds.map((seed) => runSingleExperiment(definition, policyCase, seed, now, reporterOptions));
    return aggregatePolicyResults(definition, policyCase, runs, reporterOptions);
  });

  return {
    definition,
    seedList: seeds.slice(),
    policyResults,
    comparison: compareScenarioPolicies(policyResults)
  };
}

export function runExperimentSuite(
  options: ExperimentRunnerOptions & ExperimentReporterOptions = {}
): ExperimentSuiteResult {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const scenarioDefinitions = resolveScenarioDefinitions(options.scenarioDefinitions, options.scenarioSlugs);
  const outputDirectory = options.outputDirectory ?? defaultOutputDirectory(generatedAt, scenarioDefinitions.length);
  const seedsOverride = options.seeds;
  const now = options.now ?? performance.now.bind(performance);

  return {
    generatedAt,
    outputDirectory,
    scenarios: scenarioDefinitions.map((definition) =>
      runScenario(definition, resolveSeedList(definition, seedsOverride), now, options)
    )
  };
}

export function renderExperimentSuiteMarkdown(suite: ExperimentSuiteResult): string {
  const lines: string[] = [];

  lines.push('# Experiment Harness Report');
  lines.push(`Generated at: ${suite.generatedAt}`);
  lines.push(`Output directory: ${suite.outputDirectory}`);
  lines.push('');

  for (const scenario of suite.scenarios) {
    lines.push(`## ${scenario.definition.slug}`);
    lines.push(`Scenario label: ${scenario.definition.label}`);
    lines.push(`Preset-aligned: ${scenario.definition.presetAligned ? 'yes' : 'no'}`);
    lines.push(scenario.definition.description);
    lines.push('');

    lines.push(`- Seeds: ${scenario.seedList.join(', ')}`);
    lines.push(`- Users: ${scenario.definition.userCount}`);
    lines.push(`- Islands: ${scenario.definition.islandCount}`);
    lines.push(`- Bootstrap ratings / user: ${scenario.definition.bootstrapRatingsPerUser}`);
    lines.push(`- Turn count: ${scenario.definition.turnCount}`);
    lines.push('');

    lines.push('Policy comparison summary');
    lines.push(`- Baseline policy: ${scenario.comparison.baselinePolicySlug}`);
    lines.push(`- Guided minus Organic: ${formatComparisonMap(scenario.comparison.guidedMinusOrganic)}`);
    lines.push(`- Mixed minus Organic: ${formatComparisonMap(scenario.comparison.mixedMinusOrganic)}`);
    lines.push('');

    for (const policyResult of scenario.policyResults) {
      const aggregate = policyResult.aggregate;
      lines.push(`### ${policyResult.policyCase.label}`);
      lines.push(policyResult.policyCase.description);
      lines.push('');
      lines.push(`- Runs: ${aggregate.runCount}`);
      lines.push(`- Signal growth: ${formatNumber(aggregate.signalGrowth)}`);
      lines.push(`- Affinity evidence growth: ${formatNumber(aggregate.affinityEvidenceGrowth)}`);
      lines.push(`- evidence efficiency: ${formatNumber(aggregate.evidenceEfficiency)}`);
      lines.push(`- time-to-useful-signal: ${formatNullableNumber(aggregate.timeToUsefulSignalTurn)}`);
      lines.push(`- Discovery probe volume: ${formatNumber(aggregate.discoveryProbeVolume)}`);
      lines.push(`- Safe-fit volume: ${formatNumber(aggregate.safeFitVolume)}`);
      lines.push(`- Under-reviewed coverage: ${formatPercent(aggregate.underReviewedCoverage)}`);
      lines.push(`- ms per turn: ${formatNumber(aggregate.msPerTurn)}`);
      lines.push(`- ms per population unit: ${formatNumber(aggregate.msPerPopulationUnit)}`);
      lines.push('');
    }

    lines.push('Warnings and limitations');
    lines.push('- Turn 0 is the bootstrap baseline and is included in the per-turn snapshot series.');
    lines.push('- Timing is wall-clock Node runtime duration, so it is useful for comparison but not proof.');
    lines.push('- These measurements characterize the current simulation; they do not replace the model outputs.');
    lines.push('');

    lines.push('Observed failure signs');
    lines.push(formatFailureSigns(scenario.policyResults));
    lines.push('');
  }

  return lines.join('\n');
}

function formatNumber(value: number): string {
  return value.toFixed(3);
}

function formatNullableNumber(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(3);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatComparisonMap(values: Record<string, number | null>): string {
  const entries = Object.entries(values).map(([key, value]) => `${key}=${formatNullableNumber(value)}`);
  return entries.length > 0 ? entries.join(', ') : 'n/a';
}

function formatFailureSigns(policyResults: readonly ExperimentPolicyResult[]): string {
  const summaries = policyResults.map((policyResult) => {
    const aggregate = policyResult.aggregate;
    const signals: string[] = [];

    if (aggregate.timeToUsefulSignalTurn === null) {
      signals.push('useful signal never crossed the threshold');
    }

    if (aggregate.signalGrowth <= 0) {
      signals.push('signal did not grow');
    }

    if (aggregate.affinityEvidenceGrowth <= 0) {
      signals.push('affinity evidence did not grow');
    }

    if (aggregate.evidenceEfficiency <= 0) {
      signals.push('evidence efficiency was non-positive');
    }

    return `${policyResult.policyCase.label}: ${signals.length > 0 ? signals.join('; ') : 'no obvious failure signs'}`;
  });

  return summaries.map((entry) => `- ${entry}`).join('\n');
}

export function writeExperimentSuiteFiles(suite: ExperimentSuiteResult): ExperimentWriteResult {
  mkdirSync(suite.outputDirectory, { recursive: true });

  const jsonPath = resolve(suite.outputDirectory, 'experiment-suite.json');
  const markdownPath = resolve(suite.outputDirectory, 'experiment-suite.md');

  writeFileSync(jsonPath, `${JSON.stringify(suite, null, 2)}\n`, 'utf8');
  writeFileSync(markdownPath, `${renderExperimentSuiteMarkdown(suite)}\n`, 'utf8');

  return {
    jsonPath,
    markdownPath
  };
}
