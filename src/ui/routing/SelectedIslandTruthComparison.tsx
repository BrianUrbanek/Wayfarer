import { useState, type RefObject } from 'react';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { ReportTable } from '../components/ReportTable';
import type { IslandTruthComparisonReport } from '../../model/islandTruthComparison.js';

interface SelectedIslandTruthComparisonProps {
  report: IslandTruthComparisonReport;
  panelRef?: RefObject<HTMLDivElement>;
}

interface SelectedIslandTruthComparisonModalProps {
  report: IslandTruthComparisonReport;
  open: boolean;
  onClose: () => void;
}

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function formatSigned(value: number, digits = 3): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}`;
}

function metricHelperText(report: IslandTruthComparisonReport): string {
  const targetEstimate = report.learnedEstimateForHiddenTarget ?? report.headlineEstimate;
  if (!targetEstimate) {
    return 'No projectable learned estimate yet.';
  }

  return `Certainty ${formatPercent(targetEstimate.confidence)} / RD ${targetEstimate.ratingDeviation.toFixed(3)} / Volatility ${targetEstimate.volatility.toFixed(3)}`;
}

export function SelectedIslandTruthComparisonModal({ report, open, onClose }: SelectedIslandTruthComparisonModalProps) {
  return (
    <Modal open={open} title="Truth comparison audit" onClose={onClose} placement="top" className="truth-comparison-modal">
      <div className="detail-stack truth-comparison-modal__body">
        <section className="detail-block">
          <h4>Interpretation</h4>
          <div className="badge-row">
            <Badge tone={report.statusTone}>{report.statusLabel}</Badge>
            <Badge tone="neutral">{report.hiddenTruthClassLabel}</Badge>
            <Badge tone="accent">{report.hiddenTargetTasteCohortKind ? `${report.hiddenTargetTasteCohortKind} target` : 'No target kind'}</Badge>
          </div>
          <p>{report.summarySentence}</p>
          <p className="muted">{report.caveatCopy}</p>
        </section>

        <section className="detail-block">
          <h4>Hidden generator truth</h4>
          {report.hiddenTruthClass || report.hiddenTargetTasteCohortId || report.hiddenAppealVectorSummary !== 'n/a' ? (
            <div className="detail-mini-table">
              <div className="detail-mini-table__row">
                <span>Truth class</span>
                <strong>{report.hiddenTruthClassLabel}</strong>
              </div>
              <div className="detail-mini-table__row">
                <span>Target cohort</span>
                <strong>{report.hiddenTargetTasteCohortLabel ?? report.hiddenTargetTasteCohortId ?? 'none'}</strong>
              </div>
              <div className="detail-mini-table__row">
                <span>Target kind</span>
                <strong>{report.hiddenTargetTasteCohortKind ?? 'n/a'}</strong>
              </div>
              <div className="detail-mini-table__row">
                <span>Projectable visible cohort</span>
                <strong>{report.hiddenTargetProjectableVisibleCohortLabel ?? 'n/a'}</strong>
              </div>
              <div className="detail-mini-table__row">
                <span>Appeal vector</span>
                <strong>{report.hiddenAppealVectorSummary}</strong>
              </div>
            </div>
          ) : (
            <EmptyState title="No hidden truth data" description="This island does not expose hidden truth fields for audit comparison." />
          )}
        </section>

        <section className="detail-block">
          <h4>Learned estimate detail</h4>
          <div className="metric-grid metric-grid--compact island-truth-comparison__metrics">
            <MetricCard
              label="Top positive visible cohort"
              value={report.learnedTopPositiveVisibleEstimate?.cohortLabel ?? 'n/a'}
              helper={
                report.learnedTopPositiveVisibleEstimate
                  ? `${formatPercent(report.learnedTopPositiveVisibleEstimate.confidence)} certainty / affinity ${formatSigned(report.learnedTopPositiveVisibleEstimate.affinity)}`
                  : 'No positive estimate yet'
              }
            />
            <MetricCard
              label="Top negative visible cohort"
              value={report.learnedTopNegativeVisibleEstimate?.cohortLabel ?? 'n/a'}
              helper={
                report.learnedTopNegativeVisibleEstimate
                  ? `${formatPercent(report.learnedTopNegativeVisibleEstimate.confidence)} certainty / affinity ${formatSigned(report.learnedTopNegativeVisibleEstimate.affinity)}`
                  : 'No negative estimate yet'
              }
            />
            <MetricCard
              label="Hidden target projection"
              value={report.learnedEstimateForHiddenTarget?.cohortLabel ?? 'n/a'}
              helper={metricHelperText(report)}
            />
          </div>
        </section>

        <section className="detail-block">
          <h4>Visible cohort estimates</h4>
          {report.visibleEstimates.length === 0 ? (
            <EmptyState title="No learned estimates" description="There are no visible cohort estimates for this island yet." />
          ) : (
            <ReportTable
              columns={[
                { key: 'cohort', label: 'Cohort', render: (row) => row.cohortLabel },
                { key: 'affinity', label: 'Affinity', align: 'right', render: (row) => formatSigned(row.affinity) },
                { key: 'confidence', label: 'Certainty', align: 'right', render: (row) => formatPercent(row.confidence) },
                { key: 'rd', label: 'RD', align: 'right', render: (row) => row.ratingDeviation.toFixed(3) },
                { key: 'vol', label: 'Volatility', align: 'right', render: (row) => row.volatility.toFixed(3) },
                { key: 'weight', label: 'Weight', align: 'right', render: (row) => row.effectiveWeight.toFixed(3) },
                { key: 'evidence', label: 'Evidence', align: 'right', render: (row) => row.evidenceCount }
              ]}
              rows={report.visibleEstimates}
              getRowKey={(row) => row.cohortId}
              emptyTitle="No learned estimates"
              emptyDescription="There are no visible cohort estimates for this island yet."
            />
          )}
        </section>
      </div>
    </Modal>
  );
}

export function SelectedIslandTruthComparison({ report, panelRef }: SelectedIslandTruthComparisonProps) {
  const [open, setOpen] = useState(false);
  const headlineEstimate = report.headlineEstimate;
  const headlineValue = headlineEstimate ? headlineEstimate.cohortLabel : 'n/a';
  const headlineHelper = headlineEstimate
    ? `${formatPercent(headlineEstimate.confidence)} certainty / affinity ${formatSigned(headlineEstimate.affinity)}`
    : 'No learned estimate yet.';

  return (
    <div ref={panelRef} className="card island-truth-comparison">
      <div className="card__title-row island-truth-comparison__title-row">
        <strong>Truth Alignment</strong>
        <Badge tone={report.statusTone}>{report.statusLabel}</Badge>
        <button type="button" className="button button--ghost" onClick={() => setOpen(true)}>
          Inspect truth comparison
        </button>
      </div>
      <p className="muted island-truth-comparison__summary">{report.summarySentence}</p>
      <div className="metric-grid metric-grid--compact island-truth-comparison__metrics">
        <MetricCard
          label="Hidden generator truth"
          value={report.hiddenTruthClassLabel}
          helper={
            report.hiddenTargetTasteCohortLabel
              ? `${report.hiddenTargetTasteCohortKind === 'unseeded' ? 'Unseeded' : 'Seed'} target: ${report.hiddenTargetTasteCohortLabel}`
              : 'No hidden target cohort'
          }
        />
        <MetricCard label="Learned read" value={headlineValue} helper={headlineHelper} />
      </div>
      <p className="muted island-truth-comparison__hint">
        {report.hiddenTargetProjectableVisibleCohortLabel
          ? `Projected visible cohort: ${report.hiddenTargetProjectableVisibleCohortLabel}`
          : 'The hidden target does not project cleanly into a visible cohort read yet.'}
      </p>

      <SelectedIslandTruthComparisonModal report={report} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
