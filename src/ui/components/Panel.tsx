import { useState, type PropsWithChildren } from 'react';

interface PanelProps extends PropsWithChildren {
  title: string;
  className?: string;
  hideTitle?: boolean;
  collapsible?: boolean;
  id?: string;
}

export function Panel({ title, children, className, hideTitle = false, collapsible = false, id }: PanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (hideTitle && !collapsible) {
    return (
      <section id={id} className={`panel${className ? ` ${className}` : ''}`}>
        <h2 className="sr-only">{title}</h2>
        {children}
      </section>
    );
  }

  return (
    <section id={id} className={`panel${className ? ` ${className}` : ''}`}>
      <div className="panel__header-row">
        <h2 className={hideTitle ? 'sr-only' : undefined}>{title}</h2>
        {collapsible ? (
          <button
            type="button"
            className="icon-button collapsible-panel__toggle"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            <span className="collapsible-panel__toggle-icon" aria-hidden="true">
              {collapsed ? 'v' : '^'}
            </span>
          </button>
        ) : null}
      </div>
      {!collapsed ? children : null}
    </section>
  );
}
