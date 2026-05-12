import type { CSSProperties, PropsWithChildren } from 'react';

interface TrayProps extends PropsWithChildren {
  collapsed: boolean;
  title: string;
  className?: string;
  style?: CSSProperties;
  toggleCollapsedLabel?: string;
  toggleExpandedLabel?: string;
  onToggle: () => void;
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
}

export function Tray({
  collapsed,
  title,
  className,
  style,
  toggleCollapsedLabel = 'Open',
  toggleExpandedLabel = 'Hide',
  onToggle,
  onSecondaryAction,
  secondaryActionLabel,
  children
}: TrayProps) {
  return (
    <aside className={`tray${collapsed ? ' tray--collapsed' : ''}${className ? ` ${className}` : ''}`} aria-label={title} style={style}>
      <div className="tray__rail">
        <div className="tray__rail-title">
          <p className="eyebrow">Pinned</p>
          <h2>{title}</h2>
        </div>
        <div className="tray__rail-actions">
          <button
            type="button"
            className="icon-button tray__toggle"
            onClick={onToggle}
            aria-label={collapsed ? toggleCollapsedLabel : toggleExpandedLabel}
          >
            {collapsed ? toggleCollapsedLabel : toggleExpandedLabel}
          </button>
          {onSecondaryAction && secondaryActionLabel ? (
            <button type="button" className="icon-button tray__clear" onClick={onSecondaryAction} aria-label={secondaryActionLabel}>
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      </div>
      {!collapsed ? <div className="tray__body">{children}</div> : null}
    </aside>
  );
}
