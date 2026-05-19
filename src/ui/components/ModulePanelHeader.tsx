import type { ReactNode } from 'react';

interface ModulePanelHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  collapseLabel?: string;
}

export function ModulePanelHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  collapsed = false,
  onToggleCollapsed,
  collapseLabel
}: ModulePanelHeaderProps) {
  return (
    <div className="section-heading section-heading--collapse-row">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h3>{title}</h3>
        {subtitle ? <p className="muted">{subtitle}</p> : null}
      </div>
      <div className="section-toolbar__buttons">
        {actions}
        {onToggleCollapsed ? (
          <button
            type="button"
            className="icon-button collapsible-panel__toggle"
            onClick={onToggleCollapsed}
            aria-label={collapseLabel}
          >
            <span className="collapsible-panel__toggle-icon" aria-hidden="true">
              {collapsed ? 'v' : '^'}
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
