import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { Panel } from '../components/Panel';
import { ReportTable, type ReportTableColumn } from '../components/ReportTable';
import { buildActiveRunModelEvidence, type ActiveRunModelEvidence } from './activeRunModelEvidence';
import { type ModelingAuthorityRow, type ModelingHiddenTruthRow, type ModelingValidationRow } from './modelingLabViewModel';

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

interface ModelingLabPanelProps {
  evidence?: ActiveRunModelEvidence | null;
}

type ModelingLabDetailView = 'authority' | 'hidden-truth' | 'validation' | 'raw-json' | null;

export function ModelingLabPanel({ evidence = null }: ModelingLabPanelProps) {
  const [detailView, setDetailView] = useState<ModelingLabDetailView>(null);
  const internalEvidence = useMemo(() => buildActiveRunModelEvidence({ scenarioPreset: null }), []);
  const activeEvidence = evidence ?? internalEvidence;
  const viewModel = activeEvidence.kind === 'trace' ? activeEvidence.viewModel : null;
  const summary = viewModel?.runSummary ?? null;
  const rawJson = useMemo(() => (viewModel ? JSON.stringify(viewModel.rawTrace, null, 2) : ''), [viewModel]);
  const authoritySummary = viewModel?.authorityRows.slice(0, 3) ?? [];
  const hiddenSummary = viewModel?.hiddenTruthRows.slice(0, 3) ?? [];
  const validationSummary = viewModel?.validationRows.slice(0, 3) ?? [];
  const validationPassed = summary?.validationPassed;

  return (
    <Panel id="modeling-lab" title="Modeling Lab" className="panel--full modeling-lab-panel">
      <div className="section-toolbar section-toolbar--stacked">
        <div className="section-heading">
          <p className="eyebrow">Analyst scenario trace</p>
          <h3>Modeling Lab</h3>
          <p>Read-only modeling trace surface attached to the selected scenario when available.</p>
        </div>
      </div>

      {activeEvidence.kind === 'no-trace' ? (
        <EmptyState
          title="No modeling trace attached to this run"
          description="This scenario is using the ordinary simulation path. Select a modeling-backed demo preset to inspect a modeling-core trace."
        />
      ) : (
        <>
          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Fixture" value={summary?.fixtureId ?? 'n/a'} tone="accent" />
            <MetricCard label="Steps" value={summary?.stepCount ?? 0} />
            <MetricCard
              label="Scenario validation"
              value={summary?.validationPassed === null ? 'n/a' : summary?.validationPassed ? 'PASS' : 'FAIL'}
              tone={summary?.validationPassed === false ? 'danger' : 'success'}
            />
            <MetricCard label="Unsupported concepts" value={summary?.unsupportedConcepts.length ?? 0} />
          </div>

          <div className="badge-row">
            <Badge tone={validationPassed === false ? 'danger' : 'success'}>
              {validationPassed === null ? 'Validation unavailable' : validationPassed ? 'Validation PASS' : 'Validation FAIL'}
            </Badge>
            <Badge tone="neutral">{viewModel?.hiddenTruthNotice ?? 'Oracle / test truth only'}</Badge>
            <Badge tone="warning">{activeEvidence.message}</Badge>
          </div>

          <div className="modeling-lab-panel__summary">
            <p>{summary?.fixtureDescription ?? 'No trace available.'}</p>
            <p className="muted">{summary?.hiddenTruthPolicy ?? 'No hidden truth checksum is attached to this fixture.'}</p>
          </div>

          <div className="metric-grid metric-grid--compact">
            <MetricCard label="Authority rows" value={viewModel?.authorityRows.length ?? 0} helper="Compact summary only." />
            <MetricCard label="Hidden checksum rows" value={viewModel?.hiddenTruthRows.length ?? 0} helper="Oracle/test truth rows." />
            <MetricCard label="Validation rows" value={viewModel?.validationRows.length ?? 0} helper="Scenario authority checks." />
          </div>

          <div className="summary-inline">
            {authoritySummary.map((row) => (
              <Badge key={`authority-${row.actorId}`} tone={row.validationResult === 'PASS' ? 'success' : row.validationResult === 'FAIL' ? 'danger' : 'neutral'}>
                {row.label}: {row.visibleRelation}
              </Badge>
            ))}
            {authoritySummary.length === 0 ? <Badge tone="neutral">No authority summary</Badge> : null}
          </div>

          <div className="summary-inline">
            {hiddenSummary.map((row) => (
              <Badge key={`hidden-${row.actorId}`} tone="accent">
                {row.label}: {row.expectedRelationToSeed}
              </Badge>
            ))}
            {hiddenSummary.length === 0 ? <Badge tone="neutral">No hidden checksum rows</Badge> : null}
          </div>

          <div className="summary-inline">
            {validationSummary.map((row) => (
              <Badge key={`validation-${row.actorId}`} tone={row.passed ? 'success' : 'danger'}>
                {row.actorId}: {row.passed ? 'PASS' : 'FAIL'}
              </Badge>
            ))}
            {validationSummary.length === 0 ? <Badge tone="neutral">No validation details</Badge> : null}
          </div>

          <div className="section-toolbar section-toolbar--stacked">
            <div className="section-toolbar__buttons">
              <button type="button" className="button button--ghost" onClick={() => setDetailView('authority')}>
                Inspect Authority Matrix
              </button>
              <button type="button" className="button button--ghost" onClick={() => setDetailView('hidden-truth')}>
                Inspect Hidden Truth Checksum
              </button>
              <button type="button" className="button button--ghost" onClick={() => setDetailView('validation')}>
                Inspect Validation Details
              </button>
              <button type="button" className="button button--ghost" onClick={() => setDetailView('raw-json')}>
                Inspect Raw JSON
              </button>
            </div>
          </div>
        </>
      )}

      <Modal
        open={detailView !== null}
        title={
          detailView === 'authority'
            ? 'Authority Matrix'
            : detailView === 'hidden-truth'
              ? 'Hidden Truth Checksum'
              : detailView === 'validation'
                ? 'Validation Details'
                : 'Raw JSON'
        }
        onClose={() => setDetailView(null)}
        placement="top"
        className="modeling-lab-modal"
      >
        {detailView === 'authority' ? (
          <div className="detail-block">
            <p className="muted">Visible inferred relationship compared with the scenario checksum.</p>
            <ReportTable
              columns={authorityColumns}
              rows={viewModel?.authorityRows ?? []}
              getRowKey={(row) => row.actorId}
              emptyTitle="No authority rows"
              emptyDescription="This trace did not emit an authority summary."
            />
          </div>
        ) : null}

        {detailView === 'hidden-truth' ? (
          <div className="detail-block">
            <p className="muted">Oracle/test truth is shown for validation only. It is not model input.</p>
            <ReportTable
              columns={hiddenTruthColumns}
              rows={viewModel?.hiddenTruthRows ?? []}
              getRowKey={(row) => row.actorId}
              emptyTitle="No hidden checksum"
              emptyDescription="This trace does not include scenario hidden-truth checksum rows."
            />
          </div>
        ) : null}

        {detailView === 'validation' ? (
          <div className="detail-block">
            <p className="muted">End-of-run comparison between visible inference and hidden checksum.</p>
            <ReportTable
              columns={validationColumns}
              rows={viewModel?.validationRows ?? []}
              getRowKey={(row) => row.actorId}
              emptyTitle="No validation rows"
              emptyDescription="This trace does not include scenario authority validation."
            />
          </div>
        ) : null}

        {detailView === 'raw-json' ? (
          <div className="detail-block">
            <p className="muted">Raw modeling trace JSON, preserved as an expert/debug escape hatch.</p>
            <pre className="report-markdown-preview" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
              {rawJson}
            </pre>
          </div>
        ) : null}
      </Modal>
    </Panel>
  );
}
