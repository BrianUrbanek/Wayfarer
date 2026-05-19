import type { ReactNode } from 'react';
import { EmptyState } from '../components/EmptyState';
import { ModulePanelHeader } from '../components/ModulePanelHeader';
import { Panel } from '../components/Panel';

interface DiscoveryRoutingPanelProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onInspectTopRoute: () => void;
  onChooseUser: () => void;
  hasSelectedUser: boolean;
  summary: ReactNode;
}

export function DiscoveryRoutingPanel({
  collapsed,
  onToggleCollapsed,
  onInspectTopRoute,
  onChooseUser,
  hasSelectedUser,
  summary
}: DiscoveryRoutingPanelProps) {
  return (
    <Panel title="Discovery Routing" className="panel--wide" hideTitle>
      <ModulePanelHeader
        eyebrow="Routing"
        title="Recommended unrated islands"
        subtitle="Routes unrated islands for the selected user using current affinity, evidence, and routing policy."
        actions={
          <>
            <button type="button" className="button button--ghost" onClick={onInspectTopRoute}>
              Inspect top route
            </button>
            <button type="button" className="button button--ghost" onClick={onChooseUser}>
              Choose user
            </button>
          </>
        }
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
        collapseLabel={collapsed ? 'Expand Discovery Routing' : 'Collapse Discovery Routing'}
      />
      {!collapsed ? (hasSelectedUser ? summary : <EmptyState title="Select a user" description="Discovery routing appears once a user is selected." />) : null}
    </Panel>
  );
}
