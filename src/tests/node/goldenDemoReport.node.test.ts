import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { buildGoldenDemoReport, renderGoldenDemoReportMarkdown } from '../../analysis/goldenDemoReport.js';
import { getScenarioPreset } from '../../model/scenarioPresets.js';
import { advancePolicyTurn, createInitialSimulationState, type AdvancePolicyTurnConfig } from '../../model/simulation.js';

function buildGoldenDemoState(seedOverride?: number) {
  const preset = getScenarioPreset('golden-demo');
  const seed = seedOverride ?? preset.generatorConfig.seed;
  const dataset = generateColumbusDataset({
    seed,
    numUsers: preset.generatorConfig.numUsers,
    numIslands: preset.generatorConfig.numIslands,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: preset.generatorConfig.tagAlignmentDistribution,
    ratingAlignmentDistribution: preset.generatorConfig.ratingAlignmentDistribution,
    islandClassWeights: preset.generatorConfig.islandClassWeights
  });

  let state = createInitialSimulationState({
    seed,
    allTags: dataset.allTags,
    latentUsers: dataset.users,
    cohorts: dataset.cohorts,
    islands: dataset.islands,
    initialRatingsPerUser: preset.generatorConfig.bootstrapRatingsPerUser
  });

  const turnPolicy: AdvancePolicyTurnConfig = preset.turnPolicy;
  for (let turnIndex = 0; turnIndex < preset.turnsToRun; turnIndex += 1) {
    state = advancePolicyTurn(state, turnPolicy);
  }

  return { preset, state };
}

describe('golden demo report', () => {
  it('builds a deterministic presentation report from the Golden Demo preset', () => {
    const { state } = buildGoldenDemoState();
    const first = buildGoldenDemoReport({
      scenario: getScenarioPreset('golden-demo'),
      state
    });
    const second = buildGoldenDemoReport({
      scenario: getScenarioPreset('golden-demo'),
      state: buildGoldenDemoState().state
    });

    assert.deepEqual(second, first);
    assert.equal(first.scenario.slug, 'golden-demo');
    assert.equal(first.scenario.label, 'Golden Demo');
    assert.equal(first.hiddenTruthDistribution.seedCohortCount > 0, true);
    assert.equal(first.hiddenTruthDistribution.seedTargetedIslandCount > 0, true);
    assert.equal(first.hiddenTruthDistribution.unseededTargetedIslandCount > 0, true);
    assert.equal(first.hiddenTruthDistribution.randomIslandCount > 0, true);
    assert.equal(first.sections.some((section) => section.heading === 'Scenario configuration'), true);
    assert.equal(first.sections.some((section) => section.heading === 'Hidden truth distribution'), true);
    assert.equal(first.sections.some((section) => section.heading === 'Seeded vs unseeded recovery summary'), true);
    assert.equal(first.sections.some((section) => section.heading === 'Confidence / RD / volatility movement summary'), true);
    assert.equal(first.sections.some((section) => section.heading === 'Discovery Signal highlights'), true);
    assert.equal(first.sections.some((section) => section.heading === 'Routing and deprioritization summary'), true);
    assert.equal(first.routingSummary.scopeLabel, 'Across run');
    assert.equal(
      first.routingSummary.routedIslandCount,
      state.turnHistory.reduce((sum, turn) => sum + turn.routedIslandIds.length, 0)
    );
    assert.equal(
      first.routingSummary.discoveryProbeVolume,
      state.turnHistory.reduce((sum, turn) => sum + turn.recommendationKinds.DISCOVERY_PROBE, 0)
    );
    assert.equal(
      first.routingSummary.safeFitVolume,
      state.turnHistory.reduce((sum, turn) => sum + turn.recommendationKinds.SAFE_FIT, 0)
    );
    assert.equal(first.scenario.configuredSeed, getScenarioPreset('golden-demo').generatorConfig.seed);
    assert.equal(first.scenario.runSeed, state.seed);
    assert.equal(first.caveats.length, 3);
  });

  it('shows material confidence movement after the guided Golden Demo run', () => {
    const { state } = buildGoldenDemoState();
    const report = buildGoldenDemoReport({
      scenario: getScenarioPreset('golden-demo'),
      state
    });
    const firstConfidence = state.confidenceSnapshots.filter((snapshot) => snapshot.turn === 0)
      .reduce((sum, snapshot, _index, snapshots) => sum + snapshot.confidence / snapshots.length, 0);
    const lastConfidence = state.confidenceSnapshots.filter((snapshot) => snapshot.turn === state.currentTurn)
      .reduce((sum, snapshot, _index, snapshots) => sum + snapshot.confidence / snapshots.length, 0);

    assert.ok(lastConfidence > firstConfidence);
    assert.ok(report.confidenceMovement.summary.includes('Confidence moved from'));
  });

  it('renders readable markdown with the required caveats and headings', () => {
    const report = buildGoldenDemoReport({
      scenario: getScenarioPreset('golden-demo'),
      state: buildGoldenDemoState(73021).state
    });
    const markdown = renderGoldenDemoReportMarkdown(report);

    assert.ok(markdown.includes('# Golden Demo Presentation Report'));
    assert.ok(markdown.includes('## Scenario configuration'));
    assert.ok(markdown.includes('## Hidden truth distribution'));
    assert.ok(markdown.includes('Hidden cohort registry counts and content / island truth distribution'));
    assert.ok(markdown.includes('## Seeded vs unseeded recovery summary'));
    assert.ok(markdown.includes('## Confidence / RD / volatility movement summary'));
    assert.ok(markdown.includes('## Discovery Signal highlights'));
    assert.ok(markdown.includes('## Routing and deprioritization summary'));
    assert.ok(markdown.includes('Routing scope: Across run'));
    assert.ok(markdown.includes('Configured seed:'));
    assert.ok(markdown.includes('Run seed:'));
    assert.ok(markdown.includes('Hidden truth is toy-world audit data'));
    assert.ok(markdown.includes('Observed behavior is synthetic and proxy-derived'));
    assert.ok(markdown.includes('The Glicko-shaped substrate is not canonical Glicko-2'));
  });

  it('serializes to parseable JSON without losing report sections', () => {
    const report = buildGoldenDemoReport({
      scenario: getScenarioPreset('golden-demo'),
      state: buildGoldenDemoState().state
    });
    const parsed = JSON.parse(JSON.stringify(report)) as typeof report;

    assert.equal(parsed.title, report.title);
    assert.equal(parsed.sections.length, report.sections.length);
    assert.equal(parsed.examples.length > 0, true);
  });
});
