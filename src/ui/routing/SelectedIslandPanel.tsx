import type { ReactNode, RefObject } from 'react';
import { EmptyState } from '../components/EmptyState';
import { ModulePanelHeader } from '../components/ModulePanelHeader';
import { Panel } from '../components/Panel';

interface SelectedIslandPanelProps {
  id?: string;
  panelRef?: RefObject<HTMLElement>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onPinIsland: () => void;
  onChooseIsland: () => void;
  islandLabel: string;
  hasSelectedIsland: boolean;
  summary: ReactNode;
}

export function SelectedIslandPanel({
  id,
  panelRef,
  collapsed,
  onToggleCollapsed,
  onPinIsland,
  onChooseIsland,
  islandLabel,
  hasSelectedIsland,
  summary
}: SelectedIslandPanelProps) {
  return (
    <Panel ref={panelRef} id={id} title="Selected Island" className="panel--wide" hideTitle>
      <ModulePanelHeader
        eyebrow="Island comparison"
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
