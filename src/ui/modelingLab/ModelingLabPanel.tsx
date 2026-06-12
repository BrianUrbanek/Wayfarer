import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { InfoTip } from '../components/InfoTip';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { Panel } from '../components/Panel';
import { ReportTable, type ReportTableColumn } from '../components/ReportTable';
import { buildActiveRunModelEvidence, type ActiveRunModelEvidence } from './activeRunModelEvidence';
import { type ModelingAuthorityRow, type ModelingHiddenTruthRow, type ModelingValidationRow } from './modelingLabViewModel';

function formatOptionalNumber(value: number | null, digits = 3): string {
  return value === null ? 'n/a' : value.toFixed(digits);
}

export function formatAuthorityRelation(relation: ModelingAuthorityRow['visibleRelation']): string {
  switch (relation) {
    case 'seedProxy':
      return 'Seed proxy';
    case 'ordinarySimilar':
      return 'Ordinary similar';
    case 'inverseSignal':
      return 'Inverse signal';
    case 'seed':
      return 'Seed';
    case 'unrelated':
      return 'Unrelated';
  }
}

export const authorityColumns: ReportTableColumn<ModelingAuthorityRow>[] = [
  {
    key: 'actor',
    label: 'Actor',
    render: (row) => <strong title={row.actorId}>{row.label}</strong>
  },
  {
    key: 'visible',
    label: 'Visible role',
    render: (row) => (
      <div className="modeling-lab-table__explained-value">
        <span>{formatAuthorityRelation(row.visibleRelation)}</span>
        <InfoTip
          label="Visible role explanation"
          text="The role inferred from visible model state only. Oracle/test expectations are kept in Validation Details."
        />
      </div>
    )
  },
  { key: 'seed', label: 'Seed reference', render: (row) => row.seedId ?? 'n/a' },
  { key: 'lane', label: 'Lane', render: (row) => row.lane },
  {
    key: 'evidence',
    label: 'Evidence summary',
    render: (row) => (
      <span className="modeling-lab-table__evidence-summary">
        <span>{row.overlapCount} overlap</span>
        <span>{row.agreementCount} agree</span>
        <span>{row.contradictionCount} contradict</span>
      </span>
    )
  },
  {
    key: 'proxy',
    label: 'Proxy strength',
    align: 'right',
    render: (row) => (
      <div className="modeling-lab-table__explained-value modeling-lab-table__explained-value--right">
        <span>{formatOptionalNumber(row.proxyStrength)}</span>
        <InfoTip
          label="Proxy strength explanation"
          text="Lane-local strength of an established visible seed-proxy relationship. It is not general player preference."
        />
      </div>
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

export const validationColumns: ReportTableColumn<ModelingValidationRow>[] = [
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
          <div className="metric-grid metric-grid--compact modeling-lab-panel__metrics">
            <MetricCard
              label="Fixture"
              value={activeEvidence.traceLabel}
              valueTitle={summary?.fixtureId ?? undefined}
              tone="accent"
              explanation="The deterministic modeling-core scenario attached to this active analyst-console run."
            />
            <MetricCard label="Steps" value={summary?.stepCount ?? 0} explanation="The number of trace steps emitted while running the attached fixture." />
            <MetricCard
              label="Scenario validation"
              value={summary?.validationPassed === null ? 'n/a' : summary?.validationPassed ? 'PASS' : 'FAIL'}
              tone={summary?.validationPassed === false ? 'danger' : 'success'}
              explanation="End-of-run oracle/test comparison. This validation result is not model input."
            />
            <MetricCard
              label="Unsupported concepts"
              value={summary?.unsupportedConcepts.length ?? 0}
              explanation={summary?.unsupportedConceptsNote ?? 'Trace concepts deliberately marked as unavailable rather than silently approximated.'}
            />
          </div>

          <div className="modeling-lab-panel__group">
            <strong className="modeling-lab-panel__group-label">Trace status &amp; boundaries</strong>
            <div className="badge-row">
              <Badge tone={validationPassed === false ? 'danger' : 'success'}>
                {validationPassed === null ? 'Validation unavailable' : validationPassed ? 'Validation PASS' : 'Validation FAIL'}
              </Badge>
              <Badge tone="neutral">{viewModel?.hiddenTruthNotice ?? 'Oracle / test truth only'}</Badge>
              <Badge tone="warning">{activeEvidence.message}</Badge>
            </div>
          </div>

          <div className="modeling-lab-panel__summary">
            <p>{summary?.fixtureDescription ?? 'No trace available.'}</p>
            <p className="muted">{summary?.hiddenTruthPolicy ?? 'No hidden truth checksum is attached to this fixture.'}</p>
          </div>

          <div className="metric-grid metric-grid--compact modeling-lab-panel__metrics modeling-lab-panel__metrics--audit">
            <MetricCard
              label="Authority rows"
              value={viewModel?.authorityRows.length ?? 0}
              explanation="Visible source-authority relationships summarized from the model trace."
            />
            <MetricCard
              label="Hidden checksum rows"
              value={viewModel?.hiddenTruthRows.length ?? 0}
              explanation="Oracle/test truth rows available only for validation and debugging."
            />
            <MetricCard
              label="Validation rows"
              value={viewModel?.validationRows.length ?? 0}
              explanation="Expected-versus-inferred authority comparisons available in Validation Details."
            />
          </div>

          <div className="modeling-lab-panel__group">
            <strong className="modeling-lab-panel__group-label">Visible authority snapshot</strong>
            <div className="summary-inline">
              {authoritySummary.map((row) => (
                <Badge key={`authority-${row.actorId}`} tone="accent">
                  {row.label}: {formatAuthorityRelation(row.visibleRelation)}
                </Badge>
              ))}
              {authoritySummary.length === 0 ? <Badge tone="neutral">No authority summary</Badge> : null}
            </div>
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
            ? 'Visible Authority Matrix'
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
            <p className="muted">Visible source-authority relationships only. Use Validation Details for oracle/test comparison.</p>
            <ReportTable
              columns={authorityColumns}
              rows={viewModel?.authorityRows ?? []}
              getRowKey={(row) => row.actorId}
              emptyTitle="No authority rows"
              emptyDescription="This trace did not emit an authority summary."
              className="report-table--dense modeling-lab-authority-table"
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
