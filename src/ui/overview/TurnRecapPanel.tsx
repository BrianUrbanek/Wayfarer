import { useState } from 'react';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { ReportTable, type ReportTableColumn } from '../components/ReportTable';
import type {
  TurnRecapMoverKind,
  TurnRecapReport,
  TurnRecapRow
} from '../../model/turnRecap.js';

interface TurnRecapPanelProps {
  report: TurnRecapReport;
  id?: string;
}

function formatSigned(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'n/a';
  }

  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

function formatPercent(value: number): string {
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

function toneForKind(kind: TurnRecapMoverKind | null): 'neutral' | 'accent' | 'success' | 'warning' | 'danger' {
  switch (kind) {
    case 'affinity':
    case 'certainty':
      return 'success';
    case 'rating-deviation':
      return 'warning';
    case 'volatility':
      return 'danger';
    case 'evidence':
      return 'accent';
    default:
      return 'neutral';
  }
}

function buildColumns(hasComparison: boolean): ReportTableColumn<TurnRecapRow>[] {
  if (!hasComparison) {
    return [
      {
        key: 'island',
        label: 'Island / cohort',
        render: (row) => (
          <div className="table-cell-stack">
            <strong>{row.islandLabel}</strong>
            <span className="muted">{row.cohortLabel}</span>
          </div>
        )
      },
      {
        key: 'current',
        label: 'Current read',
        render: (row) => (
          <div className="table-cell-stack">
            <span>
              Affinity {formatSigned(row.currentAffinity)} | certainty {formatPercent(row.currentConfidence)}
            </span>
            <span className="muted">
              RD {row.currentRatingDeviation.toFixed(3)} | volatility {row.currentVolatility.toFixed(3)} | evidence {row.currentEvidenceCount}
            </span>
          </div>
        )
      }
    ];
  }

  return [
    {
      key: 'island',
      label: 'Mover',
      render: (row) => (
        <div className="table-cell-stack">
          <strong>{row.islandLabel}</strong>
          <span className="muted">{row.cohortLabel}</span>
        </div>
      )
    },
    {
      key: 'kind',
      label: 'Type',
      render: (row) => <Badge tone={toneForKind(row.moverKind)}>{row.moverLabel}</Badge>,
      align: 'center'
    },
    {
      key: 'delta',
      label: 'Turn delta',
      render: (row) => (
        <div className="table-cell-stack">
          <span>Affinity {formatSigned(row.affinityDelta)}</span>
          <span className="muted">
            Certainty {formatSigned(row.confidenceDelta)} | RD {formatSigned(row.ratingDeviationDelta)} | volatility {formatSigned(row.volatilityDelta)}
          </span>
        </div>
      )
    },
    {
      key: 'weight',
      label: 'Weight / evidence',
      render: (row) => (
        <div className="table-cell-stack">
          <span>Weight {formatSigned(row.effectiveWeightDelta)}</span>
          <span className="muted">Evidence {formatSigned(row.evidenceCountDelta, 0)}</span>
        </div>
      ),
      align: 'right'
    },
    {
      key: 'direction',
      label: 'Direction',
      render: (row) => row.moverDirectionLabel
    }
  ];
}

function groupRowsByKind(rows: readonly TurnRecapRow[]): Record<TurnRecapMoverKind, TurnRecapRow[]> {
  const sortRows = (entries: TurnRecapRow[]) =>
    entries.slice().sort((left, right) => right.score - left.score || left.islandLabel.localeCompare(right.islandLabel) || left.cohortLabel.localeCompare(right.cohortLabel) || `${left.islandId}:${left.cohortId}`.localeCompare(`${right.islandId}:${right.cohortId}`));

  return {
    affinity: sortRows(rows.filter((row) => row.moverKind === 'affinity')),
    certainty: sortRows(rows.filter((row) => row.moverKind === 'certainty')),
    'rating-deviation': sortRows(rows.filter((row) => row.moverKind === 'rating-deviation')),
    volatility: sortRows(rows.filter((row) => row.moverKind === 'volatility')),
    evidence: sortRows(rows.filter((row) => row.moverKind === 'evidence'))
  };
}

function groupLabel(kind: TurnRecapMoverKind): string {
  switch (kind) {
    case 'affinity':
      return 'Affinity movers';
    case 'certainty':
      return 'Certainty movers';
    case 'rating-deviation':
      return 'RD movers';
    case 'volatility':
      return 'Volatility movers';
    case 'evidence':
      return 'Evidence movers';
  }
}

function renderModalContent(report: TurnRecapReport): JSX.Element {
  const columns = buildColumns(report.hasComparison);

  if (!report.hasComparison) {
    return (
      <section className="detail-block">
        <h4>Baseline readings</h4>
        <p className="muted">
          There is no previous turn to compare yet, so the table shows the latest boundary as a baseline rather than a delta.
        </p>
        <ReportTable
          columns={columns}
          rows={report.rows}
          getRowKey={(row) => `${row.islandId}:${row.cohortId}`}
          emptyTitle="No turn recap data"
          emptyDescription="There is no turn history to compare yet."
          className="turn-recap__table"
        />
      </section>
    );
  }

  const grouped = groupRowsByKind(report.rows);

  return (
    <>
      {(['affinity', 'certainty', 'rating-deviation', 'volatility', 'evidence'] as const).map((kind) => (
        <section className="detail-block" key={kind}>
          <h4>{groupLabel(kind)}</h4>
          {grouped[kind].length === 0 ? (
            <EmptyState title={`No ${groupLabel(kind).toLowerCase()}`} description="No mover of this type stood out in the latest turn." />
          ) : (
            <ReportTable
              columns={columns}
              rows={grouped[kind]}
              getRowKey={(row) => `${row.islandId}:${row.cohortId}`}
              emptyTitle={`No ${groupLabel(kind).toLowerCase()}`}
              emptyDescription="No mover of this type stood out in the latest turn."
              className="turn-recap__table"
            />
          )}
        </section>
      ))}
    </>
  );
}

export function TurnRecapModal({ report, open, onClose }: { report: TurnRecapReport; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Turn recap details" placement="top" className="turn-recap-modal">
      <div className="detail-stack turn-recap-modal__body">
        <section className="detail-block">
          <h4>Interpretation</h4>
          <div className="badge-row">
            <Badge tone={report.statusTone}>{report.statusLabel}</Badge>
            {report.currentTurn !== null ? <Badge tone="neutral">Turn {report.currentTurn}</Badge> : null}
            <Badge tone="neutral">{report.ratingsCreated} ratings</Badge>
          </div>
          <p>{report.summarySentence}</p>
          <p className="muted">{report.caveatCopy}</p>
        </section>

        <section className="detail-block">
          <h4>Turn summary</h4>
          <div className="metric-grid metric-grid--compact turn-recap-modal__metrics">
            <MetricCard
              label="Ratings created"
              value={report.ratingsCreated}
              helper={`${report.organicRatingsCreated} organic / ${report.guidedRatingsCreated} guided`}
            />
            <MetricCard
              label="Meaningful movers"
              value={report.meaningfulMoverCount}
              helper={report.hasComparison ? `Previous turn ${report.previousTurn ?? 'n/a'}` : 'No prior turn yet'}
              tone={report.hasComparison && report.meaningfulMoverCount > 0 ? 'accent' : 'neutral'}
            />
          </div>
          <p className="muted">
            {report.hasComparison
              ? `Latest turn ${report.currentTurn ?? 'n/a'} is compared to previous turn ${report.previousTurn ?? 'n/a'}.`
              : 'No previous turn is available yet, so this is a baseline recap.'}
          </p>
        </section>

        <section className="detail-block">
          <h4>Highlights</h4>
          {report.highlightRows.length === 0 ? (
            <EmptyState title="No meaningful movers" description="No island/cohort read rose above the recap threshold this turn." />
          ) : (
            <div className="badge-row">
              {report.highlightRows.map((row) => (
                <Badge key={`${row.islandId}:${row.cohortId}`} tone={toneForKind(row.moverKind)}>
                  {row.islandLabel} / {row.cohortLabel}: {row.moverLabel} {row.moverDirectionLabel}
                </Badge>
              ))}
            </div>
          )}
        </section>

        {renderModalContent(report)}
      </div>
    </Modal>
  );
}

export function TurnRecapPanel({ report, id }: TurnRecapPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div id={id} className="card turn-recap">
      <div className="card__title-row turn-recap__title-row">
        <strong>Turn Recap</strong>
        <Badge tone={report.statusTone}>{report.statusLabel}</Badge>
        <button type="button" className="button button--ghost" onClick={() => setOpen(true)}>
          Inspect detail
        </button>
      </div>
      <p className="muted turn-recap__summary">{report.summarySentence}</p>
      <div className="metric-grid metric-grid--compact turn-recap__metrics">
        <MetricCard
          label="Ratings created"
          value={report.ratingsCreated}
          helper={`${report.organicRatingsCreated} organic / ${report.guidedRatingsCreated} guided`}
        />
        <MetricCard
          label="Meaningful movers"
          value={report.meaningfulMoverCount}
          helper={report.hasComparison ? `Previous turn ${report.previousTurn ?? 'n/a'}` : 'No prior turn yet'}
          tone={report.hasComparison && report.meaningfulMoverCount > 0 ? 'accent' : 'neutral'}
        />
      </div>
      <div className="badge-row turn-recap__highlights">
        {report.highlightRows.length > 0 ? (
          report.highlightRows.map((row) => (
            <Badge key={`${row.islandId}:${row.cohortId}`} tone={toneForKind(row.moverKind)}>
              {row.islandLabel} / {row.cohortLabel}: {row.moverLabel} {row.moverDirectionLabel}
            </Badge>
          ))
        ) : (
          <Badge tone="neutral">No meaningful movers this turn</Badge>
        )}
      </div>

      <TurnRecapModal report={report} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
