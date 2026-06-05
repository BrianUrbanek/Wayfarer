import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildActiveRunModelEvidence } from '../ui/modelingLab/activeRunModelEvidence';
import { getScenarioPresetMetadata } from '../model/scenarioPresets';
import { authorityColumns, ModelingLabPanel, validationColumns } from '../ui/modelingLab/ModelingLabPanel';

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
    expect(html).toContain('Authority Matrix Demo');
    expect(html).toContain('title="seed-proxy-scenario-matrix"');
    expect(html).toContain('Validation PASS');
    expect(html).toContain('Inspect Authority Matrix');
    expect(html).toContain('Inspect Hidden Truth Checksum');
    expect(html).toContain('Inspect Validation Details');
    expect(html).toContain('Inspect Raw JSON');
    expect(html).toContain('Trace status &amp; boundaries');
    expect(html).toContain('Visible authority snapshot');
    expect(html).toContain('Seed proxy');
    expect(html).toContain('ORACLE / TEST TRUTH - not model input');
    expect(html).toContain('Matrix Bob');
    expect(html).not.toContain('matrix-alice: PASS');
  });

  it('keeps oracle comparison out of the visible authority matrix columns', () => {
    expect(authorityColumns.map((column) => column.label)).toEqual([
      'Actor',
      'Visible role',
      'Seed reference',
      'Lane',
      'Evidence summary',
      'Proxy strength'
    ]);
    expect(validationColumns.map((column) => column.label)).toContain('Expected');
    expect(validationColumns.map((column) => column.label)).toContain('Inferred');
    expect(validationColumns.map((column) => column.label)).toContain('Result');
  });

  it('renders compact authority evidence summaries', () => {
    const evidenceColumn = authorityColumns.find((column) => column.key === 'evidence');
    const html = renderToString(<>{evidenceColumn?.render({
      actorId: 'matrix-bob',
      label: 'Matrix Bob',
      visibleRelation: 'seedProxy',
      expectedRelation: 'seedProxy',
      seedId: 'matrix-alice',
      lane: 'skill-based',
      overlapCount: 15,
      agreementCount: 15,
      contradictionCount: 0,
      inverseMatchCount: 0,
      proxyStrength: 0.975,
      validationResult: 'PASS',
      explanation: 'Example'
    })}</>);

    expect(html).toContain('15 overlap');
    expect(html).toContain('15 agree');
    expect(html).toContain('0 contradict');
    expect(html).not.toContain(' / ');
  });
});
