import { useState, type RefObject } from 'react';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { ReportTable, type ReportTableColumn } from '../components/ReportTable';
import type {
  HiddenCohortRecoveryRandomIslandRow,
  HiddenCohortRecoveryReport,
  HiddenCohortRecoveryRow
} from '../../model/hiddenCohortRecovery.js';

interface HiddenCohortRecoveryPanelProps {
  report: HiddenCohortRecoveryReport;
  id?: string;
  panelRef?: RefObject<HTMLDivElement>;
}

interface HiddenCohortRecoveryModalProps {
  open: boolean;
  onClose: () => void;
  report: HiddenCohortRecoveryReport;
}

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function formatSigned(value: number, digits = 3): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

export function HiddenCohortRecoveryModal({ open, onClose, report }: HiddenCohortRecoveryModalProps) {
  const recoveryColumns: ReportTableColumn<HiddenCohortRecoveryRow>[] = [
    {
      key: 'cohort',
      label: 'Hidden cohort',
      render: (row) => (
        <div className="table-cell-stack">
          <strong>{row.hiddenTasteCohortLabel}</strong>
          <span className="muted">
            {row.hiddenTasteCohortKind} | Projected visible seed: {row.projectedVisibleSeedCohortLabel}
          </span>
        </div>
      )
    },
    {
      key: 'counts',
      label: 'Counts',
      render: (row) => (
        <div className="table-cell-stack">
          <span>Users {row.assignedUserCount}</span>
          <span className="muted">
            Islands {row.targetedIslandCount} | Ratings {row.ratedEventCount} | Behavior {row.observedBehaviorCount}
          </span>
        </div>
      )
    },
    {
      key: 'learned',
      label: 'Learned read',
      render: (row) => (
        <div className="table-cell-stack">
          <span>
            Certainty {formatPercent(row.averageLearnedCertainty)} | affinity {formatSigned(row.averageLearnedAffinity)}
          </span>
          <span className="muted">
            RD {row.averageLearnedRatingDeviation.toFixed(3)} | volatility {row.averageLearnedVolatility.toFixed(3)}
          </span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge tone={row.statusTone}>{row.statusLabel}</Badge>,
      align: 'center'
    },
    {
      key: 'explanation',
      label: 'Explanation',
      render: (row) => row.explanation
    }
  ];

  const randomColumns: ReportTableColumn<HiddenCohortRecoveryRandomIslandRow>[] = [
    {
      key: 'island',
      label: 'Island',
      render: (row) => (
        <div className="table-cell-stack">
          <strong>{row.islandLabel}</strong>
          <span className="muted">{row.headlineEstimateLabel}</span>
        </div>
      )
    },
    {
      key: 'learned',
      label: 'Learned read',
      render: (row) => (
        <div className="table-cell-stack">
          <span>
            Certainty {formatPercent(row.headlineEstimateCertainty)} | affinity {formatSigned(row.headlineEstimateAffinity)}
          </span>
          <span className="muted">
            RD {row.headlineEstimateRatingDeviation.toFixed(3)} | volatility {row.headlineEstimateVolatility.toFixed(3)}
          </span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge tone={row.statusTone}>{row.statusLabel}</Badge>,
      align: 'center'
    },
    {
      key: 'explanation',
      label: 'Explanation',
      render: (row) => row.explanation
    }
  ];

  return (
    <Modal open={open} onClose={onClose} title="Hidden cohort recovery audit" placement="top" className="hidden-cohort-recovery-modal">
      <div className="detail-stack hidden-cohort-recovery-modal__body">
        <section className="detail-block">
          <h4>Interpretation</h4>
          <div className="badge-row">
            <Badge tone={report.statusTone}>{report.statusLabel}</Badge>
            <Badge tone="neutral">{report.seedHiddenCohortCount} seeded cohorts</Badge>
            <Badge tone="neutral">{report.unseededHiddenCohortCount} unseeded cohorts</Badge>
          </div>
          <p>{report.summarySentence}</p>
          <p className="muted">{report.caveatCopy}</p>
        </section>

        <section className="detail-block">
          <h4>Aggregate recovery</h4>
          <div className="metric-grid metric-grid--compact hidden-cohort-recovery__metrics">
            <MetricCard
              label="Seeded recovered"
              value={`${report.seedRecoveredCount} / ${report.seedHiddenCohortCount}`}
              helper={`${report.seedEmergingCount} emerging / ${report.unresolvedCount} unresolved`}
              tone={report.seedRecoveredCount > 0 ? 'success' : 'neutral'}
            />
            <MetricCard
              label="Unseeded emerging"
              value={`${report.unseededRecoveredCount + report.unseededEmergingCount} / ${report.unseededHiddenCohortCount}`}
              helper={`${report.unseededRecoveredCount} recovered / ${report.unseededEmergingCount} emerging`}
              tone={report.unseededRecoveredCount > 0 ? 'success' : 'accent'}
            />
            <MetricCard
              label="Random uncertain"
              value={`${report.randomCorrectlyUncertainCount} / ${report.randomIslandCount}`}
              helper={report.possibleOverfitCount > 0 ? `${report.possibleOverfitCount} possible overfit` : 'No overfit flagged'}
              tone={report.possibleOverfitCount > 0 ? 'warning' : 'neutral'}
            />
          </div>
        </section>

        <section className="detail-block">
          <h4>Hidden cohort rows</h4>
          {report.rows.length === 0 ? (
            <EmptyState title="No hidden cohort data" description="This dataset does not expose any hidden taste cohorts to compare." />
          ) : (
            <ReportTable
              columns={recoveryColumns}
              rows={report.rows}
              getRowKey={(row) => row.hiddenTasteCohortId}
              emptyTitle="No hidden cohort data"
              emptyDescription="This dataset does not expose any hidden taste cohorts to compare."
              className="hidden-cohort-recovery__table"
            />
          )}
        </section>

        <section className="detail-block">
          <h4>Random / noisy islands</h4>
          {report.randomIslandRows.length === 0 ? (
            <EmptyState title="No random islands" description="This run does not include any islands tagged with random hidden truth." />
          ) : (
            <>
              <div className="metric-grid metric-grid--compact hidden-cohort-recovery__metrics">
                <MetricCard label="Random islands" value={report.randomIslandCount} />
                <MetricCard label="Correctly uncertain" value={report.randomCorrectlyUncertainCount} tone="warning" />
                <MetricCard label="Possible overfit" value={report.possibleOverfitCount} tone="danger" />
              </div>
              <ReportTable
                columns={randomColumns}
                rows={report.randomIslandRows}
                getRowKey={(row) => row.islandId}
                emptyTitle="No random islands"
                emptyDescription="This run does not include any islands tagged with random hidden truth."
                className="hidden-cohort-recovery__table"
              />
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}

export function HiddenCohortRecoveryPanel({ report, id, panelRef }: HiddenCohortRecoveryPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div ref={panelRef} id={id} className="card hidden-cohort-recovery">
      <div className="card__title-row hidden-cohort-recovery__title-row">
        <strong>Hidden Cohort Recovery</strong>
        <Badge tone={report.statusTone}>{report.statusLabel}</Badge>
        <button type="button" className="button button--ghost" onClick={() => setOpen(true)}>
          Inspect recovery detail
        </button>
      </div>
      <p className="muted hidden-cohort-recovery__summary">{report.summarySentence}</p>
      <div className="metric-grid metric-grid--compact hidden-cohort-recovery__metrics">
        <MetricCard
          label="Seeded recovered"
          value={`${report.seedRecoveredCount} / ${report.seedHiddenCohortCount}`}
          helper={`${report.seedEmergingCount} emerging`}
          tone={report.seedRecoveredCount > 0 ? 'success' : 'neutral'}
        />
        <MetricCard
          label="Unseeded emerging"
          value={`${report.unseededRecoveredCount + report.unseededEmergingCount} / ${report.unseededHiddenCohortCount}`}
          helper={`${report.unseededRecoveredCount} recovered / ${report.unseededEmergingCount} emerging`}
          tone={report.unseededRecoveredCount > 0 ? 'success' : 'accent'}
        />
      </div>
      <p className="muted hidden-cohort-recovery__hint">
        {report.possibleOverfitCount > 0
          ? `${report.possibleOverfitCount} random or noisy islands look too confidently structured.`
          : `Random / noisy islands stay ${report.randomCorrectlyUncertainCount > 0 ? 'appropriately uncertain' : 'unresolved'} in this run.`}
      </p>

      <HiddenCohortRecoveryModal open={open} onClose={() => setOpen(false)} report={report} />
    </div>
  );
}
