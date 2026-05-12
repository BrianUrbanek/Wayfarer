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
          {description ? <p className="muted">{description}</p> : null}
        </div>
        <button type="button" className="button button--ghost collapsible-panel__toggle" onClick={onToggle}>
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </header>
      {collapsed ? (
        <div className="notice notice--subtle">
          <strong>{title} collapsed.</strong>
          <p>Expand this panel when you need it.</p>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
