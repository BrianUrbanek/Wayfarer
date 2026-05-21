import { FormulaTip } from '../components/FormulaTip';
import { MetricCard } from '../components/MetricCard';
import { ReportTable } from '../components/ReportTable';
import type { DiscoverySignalProfile } from '../../model/discoverySignal';

interface DiscoverySignalPanelProps {
  profile: DiscoverySignalProfile | null;
}

export function DiscoverySignalPanel({ profile }: DiscoverySignalPanelProps) {
  return (
    <section className="detail-block">
      <div className="section-heading">
        <h4>
          Discovery Signal{' '}
          <FormulaTip
            label="Discovery Signal"
            formula="retrospective usefulness = behavior consistency blended with confidence momentum and support"
            inputs="Behavior comes from rating-linked observed behavior; confidence momentum comes from stored confidence snapshots."
            interpretation="This is a retrospective audit read, not a replacement for Trust or routing math."
          />
        </h4>
        <p>
          Retrospective usefulness uses observed behavior and stored confidence snapshots. Current synthetic behavior is proxy-derived,
          so treat this as an audit read, not a production-grade progression system.
        </p>
      </div>
      <div className="metric-grid metric-grid--compact">
        <MetricCard
          label="Discovery signal"
          value={profile ? profile.score.toFixed(3) : 'n/a'}
          helper={profile?.summary ?? 'No discovery signal available yet.'}
          tone="accent"
        />
        <MetricCard
          label="Behavior consistency"
          value={profile ? `${Math.round(profile.behaviorConsistency * 100)}%` : 'n/a'}
          helper="How often the synthetic behavior agrees with the source rating direction."
        />
        <MetricCard
          label="Confidence momentum"
          value={profile ? `${Math.round(profile.confidenceMomentum * 100)}%` : 'n/a'}
          helper="Confidence lift inferred from stored confidence snapshots around the rated islands."
        />
        <MetricCard
          label="Evidence support"
          value={profile ? `${profile.eventCount} events` : 'n/a'}
          helper="Rating-linked behavior events included in the retrospective usefulness read."
        />
      </div>
      {profile && profile.turnRows.length > 0 ? (
        <ReportTable
          columns={[
            { key: 'turn', label: 'Turn', render: (row: { turn: number }) => row.turn, align: 'right' },
            { key: 'ratingEvents', label: 'Ratings', render: (row: { ratingEvents: number }) => row.ratingEvents, align: 'right' },
            { key: 'agreement', label: 'Behavior agree', render: (row: { behaviorAgreement: number }) => `${Math.round(row.behaviorAgreement * 100)}%`, align: 'right' },
            { key: 'momentum', label: 'Confidence lift', render: (row: { confidenceMomentum: number }) => `${Math.round(row.confidenceMomentum * 100)}%`, align: 'right' },
            { key: 'usefulness', label: 'Usefulness', render: (row: { usefulness: number }) => `${Math.round(row.usefulness * 100)}%`, align: 'right' }
          ]}
          rows={profile.turnRows}
          getRowKey={(row) => String(row.turn)}
          emptyTitle="No discovery signal rows"
          emptyDescription="Discovery signal rows appear after the first rating-linked behavior events."
        />
      ) : (
        <p className="muted">No discovery signal rows yet.</p>
      )}
    </section>
  );
}
