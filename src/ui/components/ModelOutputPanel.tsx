import { DistributionList } from './DistributionList.js';
import type { CohortAnchor, Diagnosis } from '../../model/types.js';
import type { InferenceResult } from '../../model/inference.js';

interface ModelOutputPanelProps {
  inference: InferenceResult & { diagnosis: Diagnosis };
  cohorts: CohortAnchor[];
  labelForCohort: (cohortId: string | null) => string;
}

function renderCohortLine(label: string, cohortId: string | null, score: number): string {
  return `${label}: ${cohortId ?? 'none'} (${Math.round(score * 100)}%)`;
}

export function ModelOutputPanel({
  inference,
  cohorts,
  labelForCohort
}: ModelOutputPanelProps) {
  return (
    <div className="stack">
      <section className="metrics-card">
        <div className="section-heading">
          <h3>Signal</h3>
          <p>Declared fit vs observed behavior fit.</p>
        </div>
        <dl className="metrics">
          <div>
            <dt>Signal fit</dt>
            <dd>{inference.signalFit.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Signal evidence</dt>
            <dd>{inference.signalEvidence.toFixed(3)}</dd>
          </div>
          <div>
            <dt>Effective signal</dt>
            <dd>{inference.effectiveSignal.toFixed(3)}</dd>
          </div>
        </dl>
      </section>

      <DistributionList
        title="Declared distribution"
        entries={inference.declaredDistribution}
        labelForCohort={labelForCohort}
      />

      <DistributionList
        title="Behavior distribution"
        entries={inference.behaviorDistribution}
        labelForCohort={labelForCohort}
      />

      <DistributionList
        title="Inverse behavior distribution"
        entries={inference.inverseBehaviorDistribution}
        labelForCohort={labelForCohort}
      />

      <section className="diagnosis-card">
        <div className="section-heading">
          <h3>Diagnosis</h3>
          <p>{inference.diagnosis.message}</p>
        </div>
        <div className="pill-row">
          <span className="pill pill--accent">{inference.diagnosis.type}</span>
          <span className="pill">priority: {inference.diagnosis.analystPriority}</span>
        </div>
        <ul className="diagnosis-list">
          {inference.diagnosis.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
        <div className="stack__section">
          <strong>Top cohort matches</strong>
          <p className="muted">{renderCohortLine('Declared', inference.declaredTop.cohortId, inference.declaredTop.score)}</p>
          <p className="muted">{renderCohortLine('Behavior', inference.behaviorTop.cohortId, inference.behaviorTop.score)}</p>
          <p className="muted">{renderCohortLine('Inverse', inference.inverseTop.cohortId, inference.inverseTop.score)}</p>
          <p className="muted">
            Suggested cohort:{' '}
            {inference.diagnosis.suggestedCohortId
              ? labelForCohort(inference.diagnosis.suggestedCohortId)
              : 'none'}
          </p>
          <p className="muted">
            Suggested tags:{' '}
            {inference.diagnosis.suggestedTags?.length
              ? inference.diagnosis.suggestedTags.join(', ')
              : 'none'}
          </p>
        </div>
        <div className="stack__section">
          <strong>Known cohorts</strong>
          <p className="muted">{cohorts.length} seeded anchors loaded</p>
        </div>
      </section>
    </div>
  );
}
