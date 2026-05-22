import { Panel } from './Panel';
import { ReportTable, type ReportTableColumn } from './ReportTable';
import type { ConfidenceGrowthRow } from '../../model/confidenceGrowth';

interface ConfidenceGrowthPanelProps {
  rows: readonly ConfidenceGrowthRow[];
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDecimal(value: number, digits = 2): string {
  return value.toFixed(digits);
}

const columns: ReportTableColumn<ConfidenceGrowthRow>[] = [
  { key: 'turn', label: 'Turn', render: (row) => row.turn, align: 'right' },
  { key: 'ratings', label: 'Created', render: (row) => row.ratingsCreated, align: 'right' },
  { key: 'cumulative', label: 'Cumulative', render: (row) => row.cumulativeRatingEvents, align: 'right' },
  { key: 'avg-confidence', label: 'Avg certainty', render: (row) => formatPercent(row.averageIslandCohortConfidence), align: 'right' },
  { key: 'avg-weight', label: 'Avg evidence', render: (row) => formatDecimal(row.averageEffectiveWeight), align: 'right' },
  { key: 'above-25', label: '>25%', render: (row) => row.estimatesAbove25, align: 'right' },
  { key: 'above-50', label: '>50%', render: (row) => row.estimatesAbove50, align: 'right' },
  { key: 'above-75', label: '>75%', render: (row) => row.estimatesAbove75, align: 'right' },
  { key: 'routed', label: 'Routed islands', render: (row) => row.routedIslandCount, align: 'right' },
  { key: 'safe-fit', label: 'Safe fits', render: (row) => row.safeFitCount, align: 'right' },
  { key: 'probe', label: 'Probes', render: (row) => row.discoveryProbeCount, align: 'right' }
];

export function ConfidenceGrowthPanel({ rows }: ConfidenceGrowthPanelProps) {
  return (
    <Panel id="confidence-growth" title="Confidence Growth" className="panel--full" collapsible>
      <div className="stack">
        <div className="notice notice--subtle">
          <p>
            Stored post-turn confidence snapshots show island/cohort certainty at each turn boundary. This is a report
            of what the model believed after processing each turn, not a reconstruction of pre-turn event weights.
          </p>
        </div>
        <ReportTable
          className="report-table--dense confidence-growth__table"
          columns={columns}
          rows={[...rows]}
          getRowKey={(row) => String(row.turn)}
          emptyTitle="No confidence snapshots"
          emptyDescription="Run at least one turn to store post-turn island/cohort confidence snapshots."
        />
      </div>
    </Panel>
  );
}
