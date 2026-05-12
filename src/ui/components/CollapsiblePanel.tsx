import type { PropsWithChildren } from 'react';

interface CollapsiblePanelProps extends PropsWithChildren {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  description?: string;
}

export function CollapsiblePanel({ title, collapsed, onToggle, className, description, children }: CollapsiblePanelProps) {
  return (
    <section className={`panel collapsible-panel${className ? ` ${className}` : ''}`}>
      <header className="collapsible-panel__header">
        <div>
          <h2>{title}</h2>
          {!collapsed && description ? <p className="muted">{description}</p> : null}
        </div>
        <button
          type="button"
          className="icon-button collapsible-panel__toggle"
          onClick={onToggle}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
        >
          <span className="collapsible-panel__toggle-icon" aria-hidden="true">
            {collapsed ? '▾' : '▴'}
          </span>
        </button>
      </header>
      {collapsed ? null : children}
    </section>
  );
}
