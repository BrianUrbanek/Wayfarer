import type { User } from '../../model/types.js';
import type { InferenceResult } from '../../model/inference.js';

interface DebugPanelProps {
  user: User;
  inference: InferenceResult;
  hiddenSeedLabel: string | null;
  hiddenClassification: string;
  showHidden: boolean;
}

function alignmentLabel(value: number | undefined): string {
  return typeof value === 'number' ? value.toString() : 'n/a';
}

export function DebugPanel({
  user,
  inference,
  hiddenSeedLabel,
  hiddenClassification,
  showHidden
}: DebugPanelProps) {
  if (!showHidden) {
    return (
      <section className="debug-panel debug-panel--collapsed">
        <div className="section-heading">
          <h3>Debug</h3>
          <p>Hidden synthetic metadata is currently hidden.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="debug-panel">
      <div className="section-heading">
        <h3>Debug</h3>
        <p>Hidden generation fields are for debug and validation only. They are not model inputs.</p>
      </div>

      <dl className="debug-grid">
        <div>
          <dt>Hidden seed</dt>
          <dd>{hiddenSeedLabel ?? 'none'}</dd>
        </div>
        <div>
          <dt>Hidden tag alignment</dt>
          <dd>{alignmentLabel(user.hiddenTagAlignment)}</dd>
        </div>
        <div>
          <dt>Hidden rating alignment</dt>
          <dd>{alignmentLabel(user.hiddenRatingAlignment)}</dd>
        </div>
        <div>
          <dt>Hidden vs inferred</dt>
          <dd>{hiddenClassification}</dd>
        </div>
      </dl>

      <div className="stack__section">
        <strong>Model guardrail</strong>
        <p className="muted">
          Inference only uses visible tags and ratings. Hidden synthetic fields exist to validate the
          generator and explainability layers.
        </p>
      </div>

      <div className="stack__section">
        <strong>Visible tags</strong>
        <p className="muted">{user.declaredTags.join(', ') || 'none'}</p>
        <strong>Visible ratings</strong>
        <p className="muted">{Object.values(user.ratings).filter((value) => value !== null).length} rated islands</p>
        <strong>Signal</strong>
        <p className="muted">
          fit {inference.signalFit.toFixed(3)} | evidence {inference.signalEvidence.toFixed(3)} | effective {inference.effectiveSignal.toFixed(3)}
        </p>
      </div>
    </section>
  );
}
