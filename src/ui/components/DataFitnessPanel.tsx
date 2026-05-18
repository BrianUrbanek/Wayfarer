import { Badge } from './Badge';
import type { DataFitnessSummary } from '../../model/dataFitness';

interface DataFitnessPanelProps {
  summary: DataFitnessSummary;
  collapsed: boolean;
  onToggle: () => void;
}

export function DataFitnessPanel({ summary, collapsed, onToggle }: DataFitnessPanelProps) {
  return (
    <section className="panel stage-panel stage-panel--data-fitness" aria-label="Data fitness readiness">
      <div className="section-heading section-heading--collapse-row">
        <div>
          <p className="eyebrow">Data fitness</p>
          <h2>{summary.label} · {summary.warnings.length} active checks</h2>
          <div className="summary-inline">
            <Badge tone={summary.status === 'ready' ? 'success' : summary.status === 'caution' ? 'warning' : 'danger'}>
              {summary.label}
            </Badge>
            <p className="muted">{summary.leadMessage}</p>
          </div>
        </div>
        <button
          type="button"
          className="icon-button collapsible-panel__toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand Data fitness' : 'Collapse Data fitness'}
        >
          <span className="collapsible-panel__toggle-icon" aria-hidden="true">
            {collapsed ? 'v' : '^'}
          </span>
        </button>
      </div>
      {!collapsed ? (
        <div className="stack">
          {summary.topWarnings.length === 0 ? (
            <div className="notice notice--subtle">
              <p>Data fitness: ready enough for inspection.</p>
            </div>
          ) : (
            summary.topWarnings.map((warning) => (
              <div key={warning.kind} className="notice notice--subtle">
                <strong>{warning.title}</strong>
                <p>{warning.message}</p>
                {warning.suggestedAction ? <p className="muted">Action: {warning.suggestedAction}</p> : null}
              </div>
            ))
          )}
          {summary.extraWarningCount > 0 ? <p className="muted">+{summary.extraWarningCount} more checks</p> : null}
        </div>
      ) : null}
    </section>
  );
}
