import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyScenarioPreset,
  getScenarioPreset,
  getScenarioPresetMetadata,
  listScenarioPresets,
  stripScenarioPresetRuntimeMetadata,
  resolveScenarioPresetFromControls
} from '../../model/scenarioPresets.js';
import { SCENARIO_CATALOG } from '../../model/scenarioCatalog.js';

describe('scenario presets', () => {
  it('exposes the curated preset set', () => {
    const presets = listScenarioPresets();

    assert.equal(presets.length, 4);
    assert.deepEqual(
      presets.map((preset) => preset.label),
      ['Golden Demo', 'Controlled Comparison', 'Low-Alignment Stress', 'Small Smoke Test']
    );
  });

  it('defines the expected Golden Demo configuration', () => {
    const preset = getScenarioPreset('golden-demo');

    assert.equal(preset.generatorConfig.numUsers, 45);
    assert.equal(preset.generatorConfig.numIslands, 36);
    assert.equal(preset.generatorConfig.bootstrapRatingsPerUser, 6);
    assert.equal(preset.turnPolicy.turnMode, 'mixed');
    assert.equal(preset.turnPolicy.participationModel, 'fixed-count');
    assert.equal(preset.turnPolicy.participatingUsersPerTurn, 12);
    assert.equal(preset.turnPolicy.organicRatingCountModel, 'fixed-count');
    assert.equal(preset.turnPolicy.organicRatingsPerUser, 2);
    assert.equal(preset.turnPolicy.guidedRatingCountModel, 'fixed-count');
    assert.equal(preset.turnPolicy.guidedRecommendationsPerUser, 2);
    assert.equal(preset.turnsToRun, 18);
  });

  it('attaches the modeling-backed demo metadata without changing persistence fields', () => {
    const metadata = getScenarioPresetMetadata('golden-demo');
    const stripped = stripScenarioPresetRuntimeMetadata(metadata);

    assert.equal(metadata.modelingTraceFixtureId, 'seed-proxy-scenario-matrix');
    assert.equal(metadata.modelingTraceLabel, 'Authority Matrix Demo');
    assert.deepEqual(stripped, { id: 'golden-demo', label: 'Golden Demo' });
  });

  it('round-trips preset controls back to the same preset', () => {
    const preset = getScenarioPreset('low-alignment-stress');
    const controls = applyScenarioPreset(preset);

    assert.equal(resolveScenarioPresetFromControls(controls)?.id, preset.id);
  });

  it('loads editable demo and harness blocks from the scenario catalog', () => {
    assert.equal(SCENARIO_CATALOG.version, 1);
    assert.equal(SCENARIO_CATALOG.demoPresets.length, 4);
    assert.equal(SCENARIO_CATALOG.harnessCharacterization.baseScenario.numUsers, 90);
    assert.equal(SCENARIO_CATALOG.harnessCharacterization.baseScenario.numIslands, 36);
    assert.equal(SCENARIO_CATALOG.harnessCharacterization.baseScenario.turnsToRun, 20);
    assert.deepEqual(
      SCENARIO_CATALOG.harnessCharacterization.alignmentFamilies.map((family) => family.id),
      ['clean', 'mixed', 'low']
    );
    assert.deepEqual(
      SCENARIO_CATALOG.harnessCharacterization.policyCases.map((caseItem) => caseItem.id),
      ['organic', 'guided', 'mixed-volume-matched', 'mixed-product-like']
    );
  });
});
