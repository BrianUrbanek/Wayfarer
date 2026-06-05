import { forwardRef, useState, type PropsWithChildren } from 'react';

interface PanelProps extends PropsWithChildren {
  title: string;
  className?: string;
  hideTitle?: boolean;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  id?: string;
}

export const Panel = forwardRef<HTMLElement, PanelProps>(function Panel(
  { title, children, className, hideTitle = false, collapsible = false, defaultCollapsed = false, id },
  ref
) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (hideTitle && !collapsible) {
    return (
      <section ref={ref} id={id} aria-label={title} className={`panel${className ? ` ${className}` : ''}`}>
        {children}
      </section>
    );
  }

  return (
    <section ref={ref} id={id} className={`panel${className ? ` ${className}` : ''}`}>
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
});
