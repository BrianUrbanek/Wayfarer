import type { PseudoCohortAnalysis, PseudoCohortReport } from '../../model/pseudoCohorts.js';

interface PseudoCohortPanelProps {
  analysis: PseudoCohortAnalysis;
}

function ReportCard({ report }: { report: PseudoCohortReport }) {
  return (
    <article className="pseudo-card">
      <div className="card__title-row">
        <strong>{report.tags.join(' | ') || 'Untitled combination'}</strong>
        <span className="pill">{report.reportType}</span>
      </div>
      <dl className="pseudo-card__metrics">
        <div>
          <dt>Users</dt>
          <dd>{report.userCount}</dd>
        </div>
        <div>
          <dt>Internal consistency</dt>
          <dd>{report.internalConsistency.toFixed(3)}</dd>
        </div>
        <div>
          <dt>Consistency evidence</dt>
          <dd>{report.consistencyEvidence.toFixed(3)}</dd>
        </div>
        <div>
          <dt>Known fit</dt>
          <dd>{report.averageKnownCohortFit.toFixed(3)}</dd>
        </div>
        <div>
          <dt>Effective signal</dt>
          <dd>{report.averageEffectiveSignal.toFixed(3)}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{report.analystPriority}</dd>
        </div>
      </dl>
      <p className="muted">Key: {report.key}</p>
      <p className="muted">Users: {report.users.join(', ')}</p>
    </article>
  );
}

export function PseudoCohortPanel({ analysis }: PseudoCohortPanelProps) {
  return (
    <div className="stack stack--two-up">
      <section className="stack__section">
        <div className="section-heading">
          <h3>Top Consistent Pseudo-Cohorts</h3>
          <p>High internal agreement, low known-cohort fit, or both.</p>
        </div>
        <div className="pseudo-grid">
          {analysis.topConsistentPseudoCohorts.length > 0 ? (
            analysis.topConsistentPseudoCohorts.map((report) => (
              <ReportCard key={`consistent-${report.key}`} report={report} />
            ))
          ) : (
            <p className="muted">No consistent candidates above the current thresholds.</p>
          )}
        </div>
      </section>

      <section className="stack__section">
        <div className="section-heading">
          <h3>Top Inconsistent Pseudo-Cohorts</h3>
          <p>Tag combinations whose members do not rate content coherently.</p>
        </div>
        <div className="pseudo-grid">
          {analysis.topInconsistentPseudoCohorts.length > 0 ? (
            analysis.topInconsistentPseudoCohorts.map((report) => (
              <ReportCard key={`inconsistent-${report.key}`} report={report} />
            ))
          ) : (
            <p className="muted">No inconsistent groups above the current thresholds.</p>
          )}
        </div>
      </section>
    </div>
  );
}
