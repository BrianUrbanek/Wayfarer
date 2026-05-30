import type { IslandRecommendation } from '../../model/recommendations.js';
import type { DeprioritizationRow } from '../../model/deprioritization.js';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { MetricCard } from '../components/MetricCard';
import { ProgressBar } from '../components/ProgressBar';
import { ReportTable, type ReportTableColumn } from '../components/ReportTable';

interface DiscoveryRoutingSummaryProps {
  selectedUserLabel: string;
  routingModeLabel: string;
  routingProfileLabel: string;
  explorationWeight: number;
  badFitGuardThreshold: number;
  guidedRecommendationsPerUser: number;
  recommendations: readonly IslandRecommendation[];
  deprioritizationRows: readonly DeprioritizationRow[];
  islandLabelForId: (islandId: string) => string;
  onInspectRecommendation: (row: IslandRecommendation) => void;
}

function formatDecimal(value: number, digits = 3): string {
  return value.toFixed(digits);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSignedDecimal(value: number, digits = 3): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

function recommendationKindBadge(row: IslandRecommendation) {
  if (row.recommendationKind === 'SAFE_FIT') {
    return <Badge tone="success">Safe fit</Badge>;
  }

  if (row.recommendationKind === 'SMART_GAMBLE') {
    return <Badge tone="accent">Smart gamble</Badge>;
  }

  return <Badge tone="warning">Discovery probe</Badge>;
}

export function DiscoveryRoutingSummary({
  selectedUserLabel,
  routingModeLabel,
  routingProfileLabel,
  explorationWeight,
  badFitGuardThreshold,
  guidedRecommendationsPerUser,
  recommendations,
  deprioritizationRows,
  islandLabelForId,
  onInspectRecommendation
}: DiscoveryRoutingSummaryProps) {
  const recommendationColumns: ReportTableColumn<IslandRecommendation>[] = [
    {
      key: 'island',
      label: 'Island',
      render: (row) => (
        <div className="table-cell-stack">
          <strong>{islandLabelForId(row.islandId)}</strong>
          <span className="muted">{row.explanation}</span>
        </div>
      )
    },
    {
      key: 'kind',
      label: 'Kind',
      render: recommendationKindBadge,
      align: 'center'
    },
    {
      key: 'fit',
      label: 'Predicted fit',
      render: (row) => <ProgressBar value={(row.predictedFit + 1) / 2} label={formatSignedDecimal(row.predictedFit)} tone={row.predictedFit >= 0 ? 'success' : 'danger'} />
    },
    { key: 'support', label: 'Support', render: (row) => formatPercent(row.affinitySupport), align: 'right' },
    { key: 'discovery', label: 'Discovery', render: (row) => formatPercent(row.discoveryValue), align: 'right' },
    { key: 'score', label: 'Score', render: (row) => formatDecimal(row.recommendationScore), align: 'right' }
  ];

  const deprioritizationColumns: ReportTableColumn<DeprioritizationRow>[] = [
    {
      key: 'island',
      label: 'Island',
      render: (row) => (
        <div className="table-cell-stack">
          <strong>{islandLabelForId(row.islandId)}</strong>
          <span className="muted">{row.explanation}</span>
        </div>
      )
    },
    { key: 'fit', label: 'Predicted fit', render: (row) => formatSignedDecimal(row.predictedFit), align: 'right' },
    { key: 'confidence', label: 'Confidence', render: (row) => formatPercent(row.confidenceSupport), align: 'right' },
    { key: 'evidence', label: 'Evidence', render: (row) => formatDecimal(row.effectiveWeight), align: 'right' },
    { key: 'score', label: 'Deprioritization', render: (row) => formatDecimal(row.deprioritizationScore), align: 'right' }
  ];

  return (
    <div className="stack">
      <div className="metric-grid metric-grid--compact">
        <MetricCard
          label="Routing mode"
          value={routingModeLabel}
          helper="Recommendations only route unrated islands, then the next turn updates the event log."
          tone={routingModeLabel.toLowerCase().includes('guided') ? 'accent' : 'neutral'}
        />
        <MetricCard
          label="Routing profile"
          value={routingProfileLabel}
          helper="Current routing profile balances safe fit, smart gambles, and discovery probes."
        />
        <MetricCard
          label="Exploration weight"
          value={formatDecimal(explorationWeight, 2)}
          helper="How much discovery value can influence the final route score."
        />
        <MetricCard
          label="Bad-fit guard"
          value={formatDecimal(badFitGuardThreshold, 2)}
          helper="Rejects only likely bounce-offs when confidence is high enough."
        />
        <MetricCard
          label="Guided recommendations / user"
          value={guidedRecommendationsPerUser}
          helper="How many unrated islands each participating user can receive per guided turn."
        />
      </div>

      <section className="detail-block">
        <h4>Recommended unrated islands</h4>
        <p className="muted">
          Guided routing candidates for {selectedUserLabel}. Unknown and uncertain islands can route unless they look confidently bad.
        </p>
        {recommendations.length > 0 ? (
          <ReportTable
            columns={recommendationColumns}
            rows={[...recommendations]}
            getRowKey={(row) => row.islandId}
            onRowClick={onInspectRecommendation}
            emptyTitle="No unrated recommendations"
            emptyDescription="The current user has no unrated islands that pass the bad-fit guard."
          />
        ) : (
          <EmptyState
            title="No unrated recommendations"
            description="The current user has no unrated islands that pass the bad-fit guard."
          />
        )}
      </section>

      <section className="detail-block">
        <h4>Deprioritized for selected user</h4>
        <p className="muted">
          Negative-fit candidates for {selectedUserLabel}. This is the report-only sibling to routing recommendations: suppression is
          user-specific and does not change routing behavior yet.
        </p>
        {deprioritizationRows.length > 0 ? (
          <ReportTable
            columns={deprioritizationColumns}
            rows={[...deprioritizationRows]}
            getRowKey={(row) => row.islandId}
            emptyTitle="No deprioritized islands"
            emptyDescription="No unrated islands meet the current negative-fit and confidence thresholds."
          />
        ) : (
          <EmptyState
            title="No deprioritized islands"
            description="No unrated islands meet the current negative-fit and confidence thresholds."
          />
        )}
      </section>
    </div>
  );
}
