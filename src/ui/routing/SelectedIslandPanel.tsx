import type { ReactNode } from 'react';
import { EmptyState } from '../components/EmptyState';
import { ModulePanelHeader } from '../components/ModulePanelHeader';
import { Panel } from '../components/Panel';

interface SelectedIslandPanelProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onPinIsland: () => void;
  onChooseIsland: () => void;
  islandLabel: string;
  hasSelectedIsland: boolean;
  summary: ReactNode;
}

export function SelectedIslandPanel({
  collapsed,
  onToggleCollapsed,
  onPinIsland,
  onChooseIsland,
  islandLabel,
  hasSelectedIsland,
  summary
}: SelectedIslandPanelProps) {
  return (
    <Panel title="Selected Island" className="panel--wide">
      <ModulePanelHeader
        eyebrow="Selected Island"
        title={islandLabel}
        subtitle="Compare selected user/cohort ratings and inspect cohort-local audience affinity."
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={onPinIsland}>
              Pin island
            </button>
            <button type="button" className="button button--ghost" onClick={onChooseIsland}>
              Choose island
            </button>
          </>
        }
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        collapseLabel={collapsed ? 'Expand Selected Island' : 'Collapse Selected Island'}
      />
      {!collapsed ? (hasSelectedIsland ? summary : <EmptyState title="No island selected" description="Open the island picker to inspect an island." />) : null}
    </Panel>
  );
}
