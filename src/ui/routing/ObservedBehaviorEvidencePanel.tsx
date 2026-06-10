import { MetricCard } from '../components/MetricCard';
import { ReportTable, type ReportTableColumn } from '../components/ReportTable';
import type {
  ObservedBehaviorIslandSummary,
  ObservedBehaviorRow
} from '../../model/observedBehavior';

interface ObservedBehaviorEvidencePanelProps {
  islandLabel: string;
  behaviorSummary: ObservedBehaviorIslandSummary | null;
  behaviorRows: readonly ObservedBehaviorRow[];
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const columns: ReportTableColumn<ObservedBehaviorRow>[] = [
  { key: 'turn', label: 'Turn', render: (row) => row.turn, align: 'right' },
  { key: 'user', label: 'User', render: (row) => row.userId },
  { key: 'kind', label: 'Kind', render: (row) => row.kind },
  { key: 'value', label: 'Value', render: (row) => formatPercent(row.value), align: 'right' },
  { key: 'source', label: 'Source rating', render: (row) => row.sourceRatingEventId }
];

export function ObservedBehaviorEvidencePanel({
  islandLabel,
  behaviorSummary,
  behaviorRows
}: ObservedBehaviorEvidencePanelProps) {
  return (
    <section className="detail-block">
      <div className="section-heading">
        <h4>Synthetic observed behavior</h4>
        <p>
          Synthetic observed behavior is generated from explicit rating events for now. It is stored separately from ratings and
          inferred revealed-preference evidence, and it is not raw telemetry.
        </p>
      </div>

      <div className="metric-grid metric-grid--compact">
        <MetricCard label="Behavior events" value={behaviorSummary?.totalEvents ?? 0} tone="accent" />
        <MetricCard label="Qualified play" value={behaviorSummary?.counts.qualifiedPlay ?? 0} />
        <MetricCard label="Positive outcomes" value={(behaviorSummary?.counts.completion ?? 0) + (behaviorSummary?.counts.replay ?? 0) + (behaviorSummary?.counts.return ?? 0)} tone="success" />
        <MetricCard label="Negative outcomes" value={(behaviorSummary?.counts.bounce ?? 0) + (behaviorSummary?.counts.abandon ?? 0)} tone="danger" />
      </div>

      <div className="summary-inline">
        <span className="muted">
          {behaviorRows.length > 0
            ? `Behavior rows for ${islandLabel} are shown below.`
            : 'No observed behavior has been generated for this island yet.'}
        </span>
      </div>

      <ReportTable
        columns={columns}
        rows={[...behaviorRows]}
        getRowKey={(row) => row.eventId}
        emptyTitle="No observed behavior"
        emptyDescription="Take more turns to generate synthetic behavior from rating events."
      />

      {behaviorSummary ? (
        <p className="muted">Synthetic behavior polarity is stored as a separate evidence layer; current explicit ratings still control affinity and routing.</p>
      ) : null}
    </section>
  );
}
