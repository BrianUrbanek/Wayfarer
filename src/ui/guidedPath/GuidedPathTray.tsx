import { useMemo, useState } from 'react';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { Tray } from '../components/Tray';
import type { GuidedPath, GuidedStepState, GuidedTargetId } from './guidedPathTypes.js';
import type { UseGuidedPathControllerResult } from './useGuidedPathController.js';

interface GuidedPathTrayProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  path: GuidedPath;
  controller: UseGuidedPathControllerResult;
  onShowTarget: (targetId: GuidedTargetId) => void | Promise<boolean>;
  title: string;
}

function statusTone(status: GuidedStepState['status']): 'neutral' | 'accent' | 'success' {
  switch (status) {
    case 'active':
      return 'accent';
    case 'completed':
      return 'success';
    default:
      return 'neutral';
  }
}

export function GuidedPathTray({ collapsed, onToggleCollapsed, path, controller, onShowTarget, title }: GuidedPathTrayProps) {
  const [storyCollapsed, setStoryCollapsed] = useState(false);
  const [stepsCollapsed, setStepsCollapsed] = useState(false);

  const completionText = useMemo(() => {
    const activeCount = controller.stepStates.filter((step) => step.status === 'active').length;
    const completedCount = controller.stepStates.filter((step) => step.status === 'completed').length;
    const upcomingCount = controller.stepStates.filter((step) => step.status === 'upcoming').length;
    return `${completedCount} completed · ${activeCount} active · ${upcomingCount} upcoming`;
  }, [controller.stepStates]);

  return (
    <Tray
      collapsed={collapsed}
      title={title}
      className="tray--instruction tray--left"
      side="left"
      style={{
        top: '18px',
        left: '18px',
        right: 'auto',
        height: 'calc(100vh - 36px)'
      }}
      toggleCollapsedLabel={title === 'Guided paths' ? 'Open guided paths' : 'Open curator notes'}
      toggleExpandedLabel={title === 'Guided paths' ? 'Collapse guided paths' : 'Collapse curator notes'}
      onToggle={onToggleCollapsed}
    >
      <div className="summary-header">
        <div>
          <p className="eyebrow">Guided path</p>
          <h3>{path.title}</h3>
        </div>
      </div>

      <div className="instruction-grid">
        <section className="detail-block guided-path-panel">
          <div className="section-heading section-heading--collapse-row">
            <h4>Guided path overview</h4>
            <button
              type="button"
              className="icon-button collapsible-panel__toggle"
              onClick={() => setStoryCollapsed((value) => !value)}
              aria-label={storyCollapsed ? 'Expand Guided path overview' : 'Collapse Guided path overview'}
            >
              <span className="collapsible-panel__toggle-icon" aria-hidden="true">
                {storyCollapsed ? 'v' : '^'}
              </span>
            </button>
          </div>
          {!storyCollapsed ? (
            <>
              <h4>System framing</h4>
              <p className="detail-block__title">{path.framing.system}</p>
              <h4>Experience framing</h4>
              <p className="detail-block__title">{path.framing.experience}</p>
              <p className="muted">Recommended preset: {path.recommendedPreset}</p>
              {path.recommendedPath ? <p className="muted">Recommended path: {path.recommendedPath}</p> : null}
            </>
          ) : null}
        </section>

        <section className="detail-block detail-block--foldout guided-path-steps">
          <div className="detail-block__summary detail-block__summary--row">
            <div>
              <span>Path steps</span>
              <span className="muted">{completionText}</span>
            </div>
            <div className="guided-path__controls">
              <button type="button" className="button button--ghost" onClick={controller.previous} disabled={!controller.hasPrevious}>
                Previous
              </button>
              <button type="button" className="button button--ghost" onClick={controller.next} disabled={!controller.hasNext}>
                Next
              </button>
              <button
                type="button"
                className="icon-button collapsible-panel__toggle"
                onClick={() => setStepsCollapsed((value) => !value)}
                aria-label={stepsCollapsed ? 'Expand Path steps' : 'Collapse Path steps'}
              >
                <span className="collapsible-panel__toggle-icon" aria-hidden="true">
                  {stepsCollapsed ? 'v' : '^'}
                </span>
              </button>
            </div>
          </div>

          {!stepsCollapsed ? (
            <div className="detail-block__foldout-grid guided-path-step-list">
              {controller.stepStates.length === 0 ? (
                <EmptyState title="No guided steps" description="This guided path does not define any steps yet." />
              ) : (
                controller.stepStates.map((step) => (
                  <section key={step.id} className={`guided-path-step guided-path-step--${step.status}`}>
                    <div className="guided-path-step__header">
                      <div className="guided-path-step__title-group">
                        <Badge tone={statusTone(step.status)}>{step.status}</Badge>
                        <strong>{step.title}</strong>
                      </div>
                      {step.targetId ? (
                        <button
                          type="button"
                          className="button button--ghost guided-path-step__action"
                          onClick={() => {
                            const targetId = step.targetId;
                            if (!targetId) {
                              return;
                            }
                            void onShowTarget(targetId);
                          }}
                        >
                          {step.actionLabel ?? 'Show me'}
                        </button>
                      ) : null}
                    </div>
                    <p>{step.body}</p>
                    {step.why ? <p className="muted">{step.why}</p> : null}
                    {step.status === 'active' ? <p className="muted">Current step</p> : null}
                  </section>
                ))
              )}
            </div>
          ) : null}
        </section>

        <section className="detail-block">
          <h4>Success criteria</h4>
          <ul className="diagnosis-list">
            {path.successCriteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </section>

        <section className="detail-block">
          <h4>Maintenance note</h4>
          <p>{path.maintenanceNote}</p>
        </section>
      </div>
    </Tray>
  );
}
