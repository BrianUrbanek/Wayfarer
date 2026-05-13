import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyScenarioPreset,
  getScenarioPreset,
  listScenarioPresets,
  resolveScenarioPresetFromControls
} from '../../model/scenarioPresets.js';

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
    assert.equal(preset.turnPolicy.organicRatingsPerUser, 4);
    assert.equal(preset.turnPolicy.guidedRatingCountModel, 'fixed-count');
    assert.equal(preset.turnPolicy.guidedRecommendationsPerUser, 3);
    assert.equal(preset.turnsToRun, 5);
  });

  it('round-trips preset controls back to the same preset', () => {
    const preset = getScenarioPreset('low-alignment-stress');
    const controls = applyScenarioPreset(preset);

    assert.equal(resolveScenarioPresetFromControls(controls)?.id, preset.id);
  });
});
