import { Badge } from './Badge';
import { ModulePanelHeader } from './ModulePanelHeader';
import type { DataFitnessSummary } from '../../model/dataFitness';

interface DataFitnessPanelProps {
  summary: DataFitnessSummary;
  collapsed: boolean;
  onToggle: () => void;
}

export function DataFitnessPanel({ summary, collapsed, onToggle }: DataFitnessPanelProps) {
  return (
    <section className="panel stage-panel stage-panel--data-fitness" aria-label="Data fitness readiness">
      <ModulePanelHeader
        eyebrow="Data fitness"
        title={`${summary.label} · ${summary.warnings.length} active checks`}
        subtitle={summary.leadMessage}
        actions={
          <Badge tone={summary.status === 'ready' ? 'success' : summary.status === 'caution' ? 'warning' : 'danger'}>
            {summary.label}
          </Badge>
        }
        collapsed={collapsed}
        onToggleCollapsed={onToggle}
        collapseLabel={collapsed ? 'Expand Data fitness' : 'Collapse Data fitness'}
      />
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
