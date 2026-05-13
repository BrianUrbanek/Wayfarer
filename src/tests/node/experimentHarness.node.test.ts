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
      scenarioDefinitions: [EXPERIMENT_SCENARIOS.baseline, EXPERIMENT_SCENARIOS['low-alignment']],
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

  it('writes JSON and Markdown reports with stable headings and low-alignment coverage', () => {
    const outputDirectory = mkdtempSync(join(tmpdir(), 'wayfarer-experiment-'));
    const suite = runExperimentSuite({
      scenarioDefinitions: [EXPERIMENT_SCENARIOS.baseline, EXPERIMENT_SCENARIOS['low-alignment']],
      outputDirectory,
      generatedAt: '2026-05-12T18:00:00.000Z',
      now: createDeterministicClock(11)
    });
    const written = writeExperimentSuiteFiles(suite);
    const markdown = readFileSync(written.markdownPath, 'utf8');
    const json = JSON.parse(readFileSync(written.jsonPath, 'utf8')) as typeof suite;

    assert.equal(json.generatedAt, '2026-05-12T18:00:00.000Z');
    assert.equal(json.scenarios.length, 2);
    assert.ok(json.scenarios.some((scenario) => scenario.definition.slug === 'low-alignment'));
    assert.ok(markdown.includes('# Experiment Harness Report'));
    assert.ok(markdown.includes('## baseline'));
    assert.ok(markdown.includes('## low-alignment'));
    assert.ok(markdown.includes('### Organic Exploration'));
    assert.ok(markdown.includes('### Guided Discovery'));
    assert.ok(markdown.includes('### Mixed'));
    assert.ok(markdown.includes('time-to-useful-signal'));
    assert.ok(markdown.includes('evidence efficiency'));
  });

  it('renders a markdown summary from an in-memory suite result', () => {
    const suite = runExperimentSuite({
      scenarioDefinitions: [EXPERIMENT_SCENARIOS.baseline],
      outputDirectory: mkdtempSync(join(tmpdir(), 'wayfarer-experiment-')),
      generatedAt: '2026-05-12T18:00:00.000Z',
      now: createDeterministicClock(13)
    });
    const markdown = renderExperimentSuiteMarkdown(suite);

    assert.ok(markdown.includes('Policy comparison summary'));
    assert.ok(markdown.includes('Warnings and limitations'));
    assert.ok(markdown.includes('Observed failure signs'));
  });
});
