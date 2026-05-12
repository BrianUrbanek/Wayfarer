import type { PropsWithChildren } from 'react';

interface TrayProps extends PropsWithChildren {
  collapsed: boolean;
  title: string;
  onToggle: () => void;
  onClear: () => void;
}

export function Tray({ collapsed, title, onToggle, onClear, children }: TrayProps) {
  return (
    <aside className={`tray${collapsed ? ' tray--collapsed' : ''}`} aria-label={title}>
      <div className="tray__rail">
        <div className="tray__rail-title">
          <p className="eyebrow">Pinned</p>
          <h2>{title}</h2>
        </div>
        <div className="tray__rail-actions">
          <button type="button" className="icon-button tray__toggle" onClick={onToggle} aria-label={collapsed ? 'Open tray' : 'Collapse tray'}>
            {collapsed ? 'Open' : 'Hide'}
          </button>
          <button type="button" className="icon-button tray__clear" onClick={onClear} aria-label="Clear pin">
            Clear
          </button>
        </div>
      </div>
      {!collapsed ? <div className="tray__body">{children}</div> : null}
    </aside>
  );
}
