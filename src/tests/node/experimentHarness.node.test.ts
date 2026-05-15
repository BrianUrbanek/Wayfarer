import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIMENT_SCENARIOS } from '../../analysis/scenarios.js';
import {
  renderExperimentSuiteMarkdown,
  runExperimentSuite,
  writeExperimentSuiteFiles
} from '../../analysis/reportExperiment.js';

function createDeterministicClock(step = 5): () => number {
  let current = 0;
  return () => {
    current += step;
    return current;
  };
}

describe('experiment harness', () => {
  it('produces deterministic JSON summaries for the same scenario and seed set', () => {
    const outputDirectory = mkdtempSync(join(tmpdir(), 'wayfarer-experiment-'));
    const options = {
      scenarioDefinitions: [EXPERIMENT_SCENARIOS['golden-demo'], EXPERIMENT_SCENARIOS['low-alignment-stress']],
      outputDirectory,
      generatedAt: '2026-05-12T18:00:00.000Z',
      now: createDeterministicClock(7)
    };

    const first = runExperimentSuite(options);
    const second = runExperimentSuite({
      ...options,
      now: createDeterministicClock(7)
    });

    assert.deepEqual(second, first);
    assert.equal(first.scenarios.length, 2);
    assert.equal(first.scenarios.every((scenario) => scenario.policyResults.length === 3), true);
  });

  it('writes JSON and Markdown reports with stable headings and preset-aligned coverage', () => {
    const outputDirectory = mkdtempSync(join(tmpdir(), 'wayfarer-experiment-'));
    const suite = runExperimentSuite({
      scenarioDefinitions: [EXPERIMENT_SCENARIOS['golden-demo'], EXPERIMENT_SCENARIOS['low-alignment-stress']],
      outputDirectory,
      generatedAt: '2026-05-12T18:00:00.000Z',
      now: createDeterministicClock(11)
    });
    const written = writeExperimentSuiteFiles(suite);
    const markdown = readFileSync(written.markdownPath, 'utf8');
    const json = JSON.parse(readFileSync(written.jsonPath, 'utf8')) as typeof suite;

    assert.equal(json.generatedAt, '2026-05-12T18:00:00.000Z');
    assert.equal(json.scenarios.length, 2);
    assert.ok(json.scenarios.some((scenario) => scenario.definition.slug === 'low-alignment-stress'));
    assert.ok(markdown.includes('# Experiment Harness Report'));
    assert.ok(markdown.includes('## golden-demo'));
    assert.ok(markdown.includes('## low-alignment-stress'));
    assert.ok(markdown.includes('Scenario label: Golden Demo'));
    assert.ok(markdown.includes('Preset-aligned: yes'));
    assert.ok(markdown.includes('### Organic Exploration'));
    assert.ok(markdown.includes('### Guided Discovery'));
    assert.ok(markdown.includes('### Mixed'));
    assert.ok(markdown.includes('time-to-useful-signal'));
    assert.ok(markdown.includes('evidence efficiency'));
  });

  it('renders a markdown summary from an in-memory suite result', () => {
    const suite = runExperimentSuite({
      scenarioDefinitions: [EXPERIMENT_SCENARIOS['golden-demo']],
      outputDirectory: mkdtempSync(join(tmpdir(), 'wayfarer-experiment-')),
      generatedAt: '2026-05-12T18:00:00.000Z',
      now: createDeterministicClock(13)
    });
    const markdown = renderExperimentSuiteMarkdown(suite);

    assert.ok(markdown.includes('Policy comparison summary'));
    assert.ok(markdown.includes('Warnings and limitations'));
    assert.ok(markdown.includes('Observed failure signs'));
  });

  it('maps harness scenarios to curated preset values and supports legacy aliases', async () => {
    const { resolveExperimentScenarioDefinition, listExperimentScenarioDefinitions } = await import('../../analysis/scenarios.js');
    const golden = resolveExperimentScenarioDefinition('golden-demo');
    assert.ok(golden);
    assert.equal(golden.userCount, 45);
    assert.equal(golden.islandCount, 36);
    assert.equal(golden.bootstrapRatingsPerUser, 6);
    assert.equal(golden.turnCount, 5);
    assert.equal(golden.turnPolicyTemplate.participatingUsersPerTurn, 12);
    assert.equal(golden.turnPolicyTemplate.organicRatingsPerUser, 4);
    assert.equal(golden.turnPolicyTemplate.guidedRecommendationsPerUser, 3);
    assert.equal(golden.turnPolicyTemplate.routingRiskProfile, 'balanced');

    const lowAlignment = resolveExperimentScenarioDefinition('low-alignment-stress');
    assert.ok(lowAlignment);
    const tagAlignment = lowAlignment.generatorConfig.tagAlignmentDistribution;
    const ratingAlignment = lowAlignment.generatorConfig.ratingAlignmentDistribution;
    assert.equal(typeof tagAlignment === 'object' ? tagAlignment.kind : null, 'uniform');
    assert.equal(typeof ratingAlignment === 'object' ? ratingAlignment.kind : null, 'uniform');
    assert.equal(lowAlignment.turnPolicyTemplate.routingRiskProfile, 'conservative');

    assert.equal(resolveExperimentScenarioDefinition('baseline')?.slug, 'golden-demo');
    assert.equal(resolveExperimentScenarioDefinition('low-alignment')?.slug, 'low-alignment-stress');
    assert.deepEqual(listExperimentScenarioDefinitions().map((entry) => entry.slug), [
      'golden-demo',
      'controlled-comparison',
      'low-alignment-stress',
      'small-smoke-test'
    ]);
  });
});
