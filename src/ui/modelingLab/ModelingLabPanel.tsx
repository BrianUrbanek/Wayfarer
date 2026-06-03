import { useMemo, useState } from 'react';
import { listModelingFixtureIds } from '../../modeling-core/fixtures';
import { runModelingFixture } from '../../modeling-core';
import { Badge } from '../components/Badge';
import { MetricCard } from '../components/MetricCard';
import { Panel } from '../components/Panel';
import { ReportTable, type ReportTableColumn } from '../components/ReportTable';
import {
  buildModelingRunViewModel,
  type ModelingAuthorityRow,
  type ModelingHiddenTruthRow,
  type ModelingValidationRow
} from './modelingLabViewModel';

const DEFAULT_FIXTURE_ID = 'seed-proxy-scenario-matrix';

function formatOptionalNumber(value: number | null, digits = 3): string {
  return value === null ? 'n/a' : value.toFixed(digits);
}

const authorityColumns: ReportTableColumn<ModelingAuthorityRow>[] = [
  {
    key: 'actor',
    label: 'Actor',
    render: (row) => (
      <div className="table-cell-stack">
        <strong>{row.label}</strong>
        <span className="muted">{row.actorId}</span>
      </div>
    )
  },
  { key: 'visible', label: 'Visible inference', render: (row) => row.visibleRelation },
  { key: 'expected', label: 'Oracle expectation', render: (row) => row.expectedRelation ?? 'n/a' },
  { key: 'seed', label: 'Seed', render: (row) => row.seedId ?? 'n/a' },
  { key: 'lane', label: 'Lane', render: (row) => row.lane },
  { key: 'overlap', label: 'Overlap', align: 'right', render: (row) => row.overlapCount },
  { key: 'agreement', label: 'Agreement', align: 'right', render: (row) => row.agreementCount },
  { key: 'contradictions', label: 'Contradictions', align: 'right', render: (row) => row.contradictionCount },
  { key: 'proxy', label: 'Proxy strength', align: 'right', render: (row) => formatOptionalNumber(row.proxyStrength) },
  {
    key: 'result',
    label: 'Result',
    render: (row) => (
      <Badge tone={row.validationResult === 'PASS' ? 'success' : row.validationResult === 'FAIL' ? 'danger' : 'neutral'}>
        {row.validationResult}
      </Badge>
    )
  }
];

const hiddenTruthColumns: ReportTableColumn<ModelingHiddenTruthRow>[] = [
  {
    key: 'actor',
    label: 'Actor',
    render: (row) => (
      <div className="table-cell-stack">
        <strong>{row.label}</strong>
        <span className="muted">{row.actorId}</span>
      </div>
    )
  },
  { key: 'expected', label: 'Expected relation', render: (row) => row.expectedRelationToSeed },
  { key: 'seed', label: 'Seed reference', render: (row) => row.seedId ?? 'n/a' },
  { key: 'lane', label: 'Lane', render: (row) => row.laneScope },
  { key: 'similarity', label: 'Hidden similarity', align: 'right', render: (row) => row.hiddenSimilarity.toFixed(3) },
  { key: 'notes', label: 'Oracle note', render: (row) => row.explanation }
];

const validationColumns: ReportTableColumn<ModelingValidationRow>[] = [
  { key: 'actor', label: 'Actor', render: (row) => row.actorId },
  { key: 'expected', label: 'Expected', render: (row) => row.expectedRelation },
  { key: 'inferred', label: 'Inferred', render: (row) => row.inferredRelation },
  {
    key: 'result',
    label: 'Result',
    render: (row) => <Badge tone={row.passed ? 'success' : 'danger'}>{row.passed ? 'PASS' : 'FAIL'}</Badge>
  },
  { key: 'explanation', label: 'Explanation', render: (row) => row.explanation }
];

export function ModelingLabPanel() {
  const fixtureIds = useMemo(() => listModelingFixtureIds(), []);
  const [selectedFixtureId, setSelectedFixtureId] = useState(DEFAULT_FIXTURE_ID);
  const [activeFixtureId, setActiveFixtureId] = useState(DEFAULT_FIXTURE_ID);
  const viewModel = useMemo(() => buildModelingRunViewModel(runModelingFixture(activeFixtureId)), [activeFixtureId]);
  const summary = viewModel.runSummary;
  const rawJson = useMemo(() => JSON.stringify(viewModel.rawTrace, null, 2), [viewModel.rawTrace]);

  return (
    <Panel id="modeling-lab" title="Modeling Lab" className="panel--full modeling-lab-panel">
      <div className="section-toolbar section-toolbar--stacked">
        <div className="section-heading">
          <p className="eyebrow">Analyst scenario trace</p>
          <h3>Modeling Lab</h3>
          <p>
            Read-only scenario runner for modeling-core traces. This lab shows visible inference beside oracle validation
            without using hidden truth as model input.
          </p>
        </div>
        <div className="section-toolbar__buttons">
          <label className="control control--inline control--wide">
            <span>Scenario</span>
            <select value={selectedFixtureId} onChange={(event) => setSelectedFixtureId(event.target.value)}>
              {fixtureIds.map((fixtureId) => (
                <option key={fixtureId} value={fixtureId}>
                  {fixtureId}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="button button--primary" onClick={() => setActiveFixtureId(selectedFixtureId)}>
            Run
          </button>
        </div>
      </div>

      <div className="metric-grid metric-grid--compact">
        <MetricCard label="Fixture" value={summary.fixtureId} tone="accent" />
        <MetricCard label="Steps" value={summary.stepCount} />
        <MetricCard
          label="Scenario validation"
          value={summary.validationPassed === null ? 'n/a' : summary.validationPassed ? 'PASS' : 'FAIL'}
          tone={summary.validationPassed === false ? 'danger' : 'success'}
        />
        <MetricCard label="Unsupported concepts" value={summary.unsupportedConcepts.length} />
      </div>

      <div className="modeling-lab-panel__summary">
        <p>{summary.fixtureDescription}</p>
        <Badge tone="warning">{viewModel.hiddenTruthNotice}</Badge>
        <p className="muted">{summary.hiddenTruthPolicy}</p>
      </div>

      <div className="report-section">
        <div className="report-section__column">
          <div className="section-heading">
            <h3>Authority Matrix</h3>
            <p>Visible inferred relationship compared with the scenario checksum.</p>
          </div>
          <ReportTable
            columns={authorityColumns}
            rows={viewModel.authorityRows}
            getRowKey={(row) => row.actorId}
            emptyTitle="No authority rows"
            emptyDescription="This fixture did not emit an authority summary."
          />
        </div>
      </div>

      <div className="report-section">
        <div className="report-section__column">
          <div className="section-heading">
            <h3>Hidden Truth Checksum</h3>
            <p>Oracle/test truth is shown for validation only. It is not model input.</p>
          </div>
          <ReportTable
            columns={hiddenTruthColumns}
            rows={viewModel.hiddenTruthRows}
            getRowKey={(row) => row.actorId}
            emptyTitle="No hidden checksum"
            emptyDescription="This fixture does not include scenario hidden-truth checksum rows."
          />
        </div>
      </div>

      <div className="report-section">
        <div className="report-section__column">
          <div className="section-heading">
            <h3>Validation Details</h3>
            <p>End-of-run comparison between visible inference and hidden checksum.</p>
          </div>
          <ReportTable
            columns={validationColumns}
            rows={viewModel.validationRows}
            getRowKey={(row) => row.actorId}
            emptyTitle="No validation rows"
            emptyDescription="This fixture does not include scenario authority validation."
          />
        </div>
      </div>

      <details className="modeling-lab-panel__raw">
        <summary>Raw JSON</summary>
        <pre>{rawJson}</pre>
      </details>
    </Panel>
  );
}
