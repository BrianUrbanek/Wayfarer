import { ModulePanelHeader } from './components/ModulePanelHeader';
import type { DashboardPanelGroupKey, GuidanceMode } from './dashboardGuidance';

type DashboardSectionDescriptor = {
  title: string;
  panels: JSX.Element[];
};

interface InspectionShellProps {
  showAnalysisDashboard: boolean;
  guidanceMode: GuidanceMode;
  visibleDashboardSections: DashboardPanelGroupKey[];
  dashboardSections: Record<DashboardPanelGroupKey, DashboardSectionDescriptor>;
  showDebug: boolean;
  debugCollapsed: boolean;
  onToggleDebugCollapsed: () => void;
}

export function InspectionShell({
  showAnalysisDashboard,
  guidanceMode,
  visibleDashboardSections,
  dashboardSections,
  showDebug,
  debugCollapsed,
  onToggleDebugCollapsed
}: InspectionShellProps) {
  if (!showAnalysisDashboard) {
    return null;
  }

  return (
    <section className="inspection-shell" aria-label="Inspection / dashboard panels">
      <section className={`dashboard-shell dashboard-shell--${guidanceMode}`} aria-label="Analyst dashboard">
        {visibleDashboardSections.map((sectionKey) => {
          if (sectionKey === 'debug' && !showDebug) {
            return null;
          }

          const section = dashboardSections[sectionKey];

          return (
            <section key={sectionKey} className={`dashboard-section dashboard-section--${sectionKey}`}>
              {sectionKey !== 'routing' && sectionKey !== 'recovery' && sectionKey !== 'overview' ? (
                <ModulePanelHeader
                  eyebrow={section.title}
                  title="Debug checksums"
                  subtitle="Checksums, hidden metadata, and debug-only fields"
                  collapsed={sectionKey === 'debug' && debugCollapsed}
                  onToggleCollapsed={() => {
                    if (sectionKey === 'debug') {
                      onToggleDebugCollapsed();
                    }
                  }}
                  collapseLabel={sectionKey === 'debug' && debugCollapsed ? `Expand ${section.title}` : `Collapse ${section.title}`}
                />
              ) : null}
              {sectionKey === 'routing' || sectionKey === 'recovery' || sectionKey === 'overview' ? (
                <div className="dashboard-section__panels">{section.panels}</div>
              ) : !(sectionKey === 'debug' && debugCollapsed) ? (
                <div className="dashboard-section__panels">{section.panels}</div>
              ) : null}
            </section>
          );
        })}
      </section>
    </section>
  );
}
