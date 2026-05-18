import { Badge } from '../components/Badge';
import { MetricCard } from '../components/MetricCard';
import { Modal } from '../components/Modal';
import { ReportTable, type ReportTableColumn } from '../components/ReportTable';
import {
  archetypeLabel,
  type ReviewerArchetypeAnalysis,
  type ReviewerArchetypeReport
} from '../../model/reviewerArchetypes';
import type { CohortAnchor } from '../../model/types';

interface ReviewerArchetypeRecoveryModalProps {
  open: boolean;
  onClose: () => void;
  analysis: ReviewerArchetypeAnalysis;
  cohortRows: Array<{
    cohort: CohortAnchor | null;
    users: ReviewerArchetypeReport[];
    topUser: ReviewerArchetypeReport | null;
  }>;
  cohortLabel: (cohortId: string | null | undefined) => string;
  reviewerRecoveryTone: (status: string) => 'success' | 'accent' | 'danger' | 'warning' | 'neutral';
  onOpenReviewer: (userId: string) => void;
}

function parseHiddenAlignment(checksum: string): string {
  const parts = checksum.split(':');
  if (parts.length < 5) {
    return 'n/a';
  }
  const tagAlignment = Number(parts[parts.length - 2]);
  const ratingAlignment = Number(parts[parts.length - 1]);
  if (!Number.isFinite(tagAlignment) || !Number.isFinite(ratingAlignment)) {
    return 'n/a';
  }
  return `${tagAlignment}/${ratingAlignment}`;
}

function hiddenCohortLine(
  row: ReviewerArchetypeReport,
  cohortLabel: (cohortId: string | null | undefined) => string
): string {
  const seed = row.hiddenSeedCohortId ? cohortLabel(row.hiddenSeedCohortId) : 'none';
  const behavior = row.hiddenBehaviorCohortId ? cohortLabel(row.hiddenBehaviorCohortId) : 'none';

  return row.hiddenBehaviorCohortId && row.hiddenBehaviorCohortId !== row.hiddenSeedCohortId
    ? `Seed: ${seed} · Behavior: ${behavior}`
    : `Seed: ${seed}`;
}

export function ReviewerArchetypeRecoveryModal({
  open,
  onClose,
  analysis,
  cohortRows,
  cohortLabel,
  reviewerRecoveryTone,
  onOpenReviewer
}: ReviewerArchetypeRecoveryModalProps) {
  const reviewerRecoveryColumns: ReportTableColumn<ReviewerArchetypeReport>[] = [
    {
      key: 'user',
      label: 'User',
      render: (row) => (
        <div className="table-cell-stack">
          <strong>{row.label}</strong>
          <span className="muted">
            {row.inferredCohortId ? cohortLabel(row.inferredCohortId) : 'No visible cohort'}
          </span>
        </div>
      )
    },
    {
      key: 'hidden',
      label: 'Hidden',
      render: (row) => (
        <div className="table-cell-stack" title={row.hiddenReviewerChecksum || undefined}>
          <span>{archetypeLabel(row.hiddenReviewerArchetype)}</span>
          <span className="muted">{hiddenCohortLine(row, cohortLabel)}</span>
          <span className="muted">Alignment: {parseHiddenAlignment(row.hiddenReviewerChecksum)}</span>
        </div>
      )
    },
    {
      key: 'visibleRead',
      label: 'Visible read',
      render: (row) => (
        <div className="table-cell-stack">
          <span>{row.inferredCohortId ? cohortLabel(row.inferredCohortId) : 'No cohort read yet'}</span>
          <span className="muted">{row.inferredDiagnosisType}</span>
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge tone={reviewerRecoveryTone(row.recoveryStatus)}>{row.recoveryStatus}</Badge>,
      align: 'center'
    },
    {
      key: 'signal',
      label: 'Signal',
      render: (row) => row.effectiveSignal.toFixed(3),
      align: 'right'
    },
    {
      key: 'evidence',
      label: 'Evidence',
      render: (row) => `${Math.round(row.signalEvidence * 100)}%`,
      align: 'right'
    },
    {
      key: 'flags',
      label: 'Flags',
      render: (row) => row.analystFlags.slice(0, 4).join(' · ') || 'none'
    }
  ];

  const reviewerRecoveryCohortColumns: ReportTableColumn<{
    cohort: CohortAnchor | null;
    users: ReviewerArchetypeReport[];
    topUser: ReviewerArchetypeReport | null;
  }>[] = [
    {
      key: 'cohort',
      label: 'Cohort',
      render: (row) => row.cohort?.label ?? 'none'
    },
    {
      key: 'leadUser',
      label: 'Lead user',
      render: (row) => row.topUser?.label ?? 'none'
    },
    {
      key: 'count',
      label: 'Users',
      render: (row) => row.users.length,
      align: 'right'
    },
    {
      key: 'signal',
      label: 'Signal',
      render: (row) => (row.topUser?.effectiveSignal ?? 0).toFixed(3),
      align: 'right'
    },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge tone={reviewerRecoveryTone(row.topUser?.recoveryStatus ?? 'UNCERTAIN')}>
          {row.topUser?.recoveryStatus ?? 'UNCERTAIN'}
        </Badge>
      ),
      align: 'center'
    }
  ];

  const cohortRowsFiltered = cohortRows.filter(
    (row): row is { cohort: CohortAnchor; users: ReviewerArchetypeReport[]; topUser: ReviewerArchetypeReport } =>
      row.cohort !== null && row.topUser !== null
  );

  return (
    <Modal
      open={open}
      title="Reviewer archetype recovery"
      placement="top"
      className="modal--recovery"
      onClose={onClose}
    >
      <div className="stack reviewer-recovery-detail">
        <div className="summary-header">
          <div>
            <p className="eyebrow">Reviewer archetype recovery</p>
            <h3>Hidden generator checksums vs inferred behavior</h3>
          </div>
          <p className="muted">
            Debug-only labels are used to evaluate whether the visible model recovers the intended synthetic pattern
            when the evidence is there, and stays unsure when it is not.
          </p>
        </div>

        <div className="metric-grid metric-grid--compact">
          <MetricCard label="Generated archetypes" value={analysis.recoverySummary.totalUsers} tone="accent" />
          <MetricCard label="Matches" value={analysis.recoverySummary.matchCount} tone="success" />
          <MetricCard label="Partial" value={analysis.recoverySummary.partialCount} tone="accent" />
          <MetricCard label="Misses" value={analysis.recoverySummary.missCount} tone="danger" />
          <MetricCard label="Uncertain" value={analysis.recoverySummary.uncertainCount} tone="warning" />
          <MetricCard label="Candidate review" value={analysis.recoverySummary.candidateSeedCount} tone="accent" />
          <MetricCard label="False positives" value={analysis.recoverySummary.falsePositiveCount} tone="danger" />
          <MetricCard label="False negatives" value={analysis.recoverySummary.falseNegativeCount} tone="warning" />
        </div>

        <section className="detail-block">
          <h4>Column guide</h4>
          <ul className="diagnosis-list">
            <li>Hidden: generator checksum label, used only for debug validation.</li>
            <li>Visible read: model-derived behavior/cohort from visible ratings.</li>
            <li>Status: whether visible inference recovered the hidden checksum.</li>
            <li>Signal: usable reviewer signal strength.</li>
            <li>Evidence: rating support behind the read.</li>
            <li>Flags: analyst/debug tags that explain why the row is surfaced.</li>
          </ul>
        </section>

        <section className="stack">
          <div className="section-heading">
            <h3>High Signal by Cohort</h3>
            <p>Top signal users grouped by their strongest cohort fit.</p>
          </div>
          <ReportTable
            columns={reviewerRecoveryCohortColumns}
            rows={cohortRowsFiltered}
            getRowKey={(row) => row.cohort.id}
            onRowClick={(row) => onOpenReviewer(row.topUser.userId)}
            emptyTitle="No high-signal users"
            emptyDescription="Take more turns so the visible model can accumulate cohort-local signal."
          />
        </section>

        <section className="stack">
          <div className="section-heading">
            <h3>Candidate New Seed Users</h3>
            <p>High-value reviewers that do not fit known cohorts cleanly and should stay analyst-review only.</p>
          </div>
          <ReportTable
            columns={reviewerRecoveryColumns}
            rows={analysis.candidateSeedUsers}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => onOpenReviewer(row.userId)}
            emptyTitle="No analyst candidates"
            emptyDescription="This panel fills when the system finds strong signal but weak known-cohort fit."
          />
        </section>

        <section className="stack">
          <div className="section-heading">
            <h3>High Signal, Weak Known Fit</h3>
            <p>Users the model trusts, but only loosely explains with current cohort labels.</p>
          </div>
          <ReportTable
            columns={reviewerRecoveryColumns}
            rows={analysis.weakFitHighSignalUsers}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => onOpenReviewer(row.userId)}
            emptyTitle="No weak-fit high-signal users"
            emptyDescription="This list fills when a user has strong signal but poor known-cohort fit."
          />
        </section>

        <section className="stack">
          <div className="section-heading">
            <h3>Early Scouts</h3>
            <p>Users whose guided routing bias lands early in the turn history.</p>
          </div>
          <ReportTable
            columns={reviewerRecoveryColumns}
            rows={analysis.earlyScouts}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => onOpenReviewer(row.userId)}
            emptyTitle="No early scouts"
            emptyDescription="Guided turn timing has not yet produced any early-scout patterns."
          />
        </section>

        <section className="stack">
          <div className="section-heading">
            <h3>Popularity Chasers and Noise</h3>
            <p>Broad-hit followers, noisy users, and low-evidence mismatches.</p>
          </div>
          <ReportTable
            columns={reviewerRecoveryColumns}
            rows={[...analysis.popularityChasers, ...analysis.noisyUsers]}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => onOpenReviewer(row.userId)}
            emptyTitle="No popularity chasers or noisy users"
            emptyDescription="The current sample has not produced any obvious broad-hit followers or random noise."
          />
        </section>

        <section className="stack">
          <div className="section-heading">
            <h3>False Positives</h3>
            <p>Hidden noise or detached predictors that the model may be reading as meaningful signal.</p>
          </div>
          <ReportTable
            columns={reviewerRecoveryColumns}
            rows={analysis.falsePositives}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => onOpenReviewer(row.userId)}
            emptyTitle="No false positives"
            emptyDescription="The visible model has not over-classified any noisy or detached users yet."
          />
        </section>

        <section className="stack">
          <div className="section-heading">
            <h3>False Negatives</h3>
            <p>Hidden clean matches, mislabeled users, or inverse raters the model failed to recover.</p>
          </div>
          <ReportTable
            columns={reviewerRecoveryColumns}
            rows={analysis.falseNegatives}
            getRowKey={(row) => row.userId}
            onRowClick={(row) => onOpenReviewer(row.userId)}
            emptyTitle="No false negatives"
            emptyDescription="The current synthetic sample has not produced any misses worth flagging."
          />
        </section>
      </div>
    </Modal>
  );
}
