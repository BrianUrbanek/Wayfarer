import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildActiveRunModelEvidence } from '../ui/modelingLab/activeRunModelEvidence';
import { getScenarioPresetMetadata } from '../model/scenarioPresets';
import { ModelingLabPanel } from '../ui/modelingLab/ModelingLabPanel';

describe('modeling lab panel', () => {
  it('renders the explicit no-trace state for ordinary scenarios', () => {
    const html = renderToString(<ModelingLabPanel evidence={buildActiveRunModelEvidence({ scenarioPreset: getScenarioPresetMetadata('small-smoke-test') })} />);

    expect(html).toContain('Modeling Lab');
    expect(html).toContain('No modeling trace attached to this run');
    expect(html).not.toContain('Raw JSON');
  });

  it('renders the attached modeling trace for the metadata-backed demo', () => {
    const html = renderToString(<ModelingLabPanel evidence={buildActiveRunModelEvidence({ scenarioPreset: getScenarioPresetMetadata('golden-demo') })} />);

    expect(html).toContain('Modeling Lab');
    expect(html).toContain('seed-proxy-scenario-matrix');
    expect(html).toContain('Scenario validation');
    expect(html).toContain('Matrix Bob');
    expect(html).toContain('seedProxy');
    expect(html).toContain('Oracle/test truth is shown for validation only. It is not model input.');
    expect(html).toContain('Raw JSON');
  });
});
