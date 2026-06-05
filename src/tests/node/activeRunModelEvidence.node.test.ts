import { describe, expect, it } from 'vitest';
import { getScenarioPresetMetadata } from '../../model/scenarioPresets.js';
import {
  buildActiveRunModelEvidence,
  resolveActiveRunModelEvidencePreset
} from '../../ui/modelingLab/activeRunModelEvidence.js';

describe('active run model evidence adapter', () => {
  it('returns a no-trace state for ordinary scenarios', () => {
    const evidence = buildActiveRunModelEvidence({
      scenarioPreset: getScenarioPresetMetadata('small-smoke-test')
    });

    expect(evidence.kind).toBe('no-trace');
    expect(evidence.message).toContain('No modeling trace attached to this run');
    expect(evidence.trace).toBeNull();
  });

  it('attaches a modeling trace for metadata-backed demos', () => {
    const evidence = buildActiveRunModelEvidence({
      scenarioPreset: getScenarioPresetMetadata('golden-demo')
    });

    expect(evidence.kind).toBe('trace');
    expect(evidence.message).toContain('Modeling trace attached');
    expect(evidence.trace?.fixtureId).toBe('seed-proxy-scenario-matrix');
    expect(evidence.kind === 'trace' ? evidence.traceLabel : null).toBe('Authority Matrix Demo');
    expect(evidence.viewModel?.authorityRows.length).toBeGreaterThan(0);
  });

  it('falls back to active scenario preset metadata when the source preset is null', () => {
    const activeScenarioPresetMetadata = getScenarioPresetMetadata('golden-demo');
    const resolvedPreset = resolveActiveRunModelEvidencePreset(null, activeScenarioPresetMetadata);
    const evidence = buildActiveRunModelEvidence({
      scenarioPreset: resolvedPreset
    });

    expect(resolvedPreset).toEqual(activeScenarioPresetMetadata);
    expect(evidence.kind).toBe('trace');
    expect(evidence.trace?.fixtureId).toBe('seed-proxy-scenario-matrix');
  });
});
