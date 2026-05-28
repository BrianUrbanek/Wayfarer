import { useMemo, useState } from 'react';
import { EmptyState } from '../components/EmptyState';
import { Tray } from '../components/Tray';
import type { GuidedPath, GuidedTargetId } from './guidedPathTypes.js';
import type { UseGuidedPathControllerResult } from './useGuidedPathController.js';

interface GuidedPathTrayProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  path: GuidedPath;
  controller: UseGuidedPathControllerResult;
  onShowTarget: (targetId: GuidedTargetId) => void | Promise<boolean>;
  title: string;
}

function FocusGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
      <path d="M8 2.5v1.8M8 11.7v1.8M2.5 8h1.8M11.7 8h1.8" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

export function GuidedPathTray({ collapsed, onToggleCollapsed, path, controller, onShowTarget, title }: GuidedPathTrayProps) {
  const [detailsCollapsed, setDetailsCollapsed] = useState(true);

  const progressText = useMemo(
    () => `Step ${Math.min(controller.activeStepIndex + 1, Math.max(1, controller.stepStates.length))} of ${controller.stepStates.length}`,
    [controller.activeStepIndex, controller.stepStates.length]
  );

  const completionText = useMemo(() => {
    const completedCount = controller.stepStates.filter((step) => step.status === 'completed').length;
    const upcomingCount = controller.stepStates.filter((step) => step.status === 'upcoming').length;
    return `${completedCount} completed · ${upcomingCount} upcoming`;
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
          <p className="muted">{progressText}</p>
        </div>
      </div>

      <div className="instruction-grid">
        <section className="detail-block guided-path-panel">
          <div className="guided-path-stepper" role="list" aria-label={`${path.title} steps`}>
            {controller.stepStates.length === 0 ? (
              <EmptyState title="No guided steps" description="This guided path does not define any steps yet." />
            ) : (
              controller.stepStates.map((step) => {
                const isActive = step.status === 'active';
                const isCompleted = step.status === 'completed';
                return (
                  <section
                    key={step.id}
                    role="listitem"
                    className={`guided-path-step guided-path-step--${step.status}${isActive ? ' guided-path-step--expanded' : ''}`}
                  >
                    <button type="button" className="guided-path-step__summary" onClick={() => controller.select(step.id)} aria-current={isActive ? 'step' : undefined}>
                      <div className="guided-path-step__summary-copy">
                        <strong>{step.title}</strong>
                        {isActive ? <span className="muted">{step.body}</span> : null}
                      </div>
                      <span className="guided-path-step__summary-meta muted">
                        <span>{isActive ? 'Active' : isCompleted ? 'Completed' : 'Upcoming'}</span>
                      </span>
                    </button>

                    {isActive ? (
                      <div className="guided-path-step__content">
                        {step.body ? <p>{step.body}</p> : null}
                        {step.why ? <p className="muted">{step.why}</p> : null}
                        <div className="guided-path-step__footer">
                          {step.targetId ? (
                            <button
                              type="button"
                              className="button button--ghost guided-path-step__focus"
                              onClick={() => void onShowTarget(step.targetId!)}
                            >
                              <FocusGlyph />
                              <span>{step.actionLabel ?? 'Show me'}</span>
                            </button>
                          ) : null}
                          <div className="guided-path-step__controls">
                            <button type="button" className="button button--ghost" onClick={controller.previous} disabled={!controller.hasPrevious}>
                              Previous
                            </button>
                            <button type="button" className="button button--ghost" onClick={controller.next} disabled={!controller.hasNext}>
                              Next
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </section>
                );
              })
            )}
          </div>
        </section>

        <section className="detail-block detail-block--foldout guided-path-details">
          <div className="detail-block__summary detail-block__summary--row">
            <div>
              <span>Path details</span>
              <span className="muted">{completionText}</span>
            </div>
            <button
              type="button"
              className="icon-button collapsible-panel__toggle"
              onClick={() => setDetailsCollapsed((value) => !value)}
              aria-label={detailsCollapsed ? 'Expand Path details' : 'Collapse Path details'}
            >
              <span className="collapsible-panel__toggle-icon" aria-hidden="true">
                {detailsCollapsed ? 'v' : '^'}
              </span>
            </button>
          </div>

          {detailsCollapsed ? null : (
            <div className="guided-path-details__content">
              <h4>System framing</h4>
              <p className="detail-block__title">{path.framing.system}</p>
              <h4>Experience framing</h4>
              <p className="detail-block__title">{path.framing.experience}</p>
              <p className="muted">Recommended preset: {path.recommendedPreset}</p>
              {path.recommendedPath ? <p className="muted">Recommended path: {path.recommendedPath}</p> : null}
              <h4>Success criteria</h4>
              <ul className="diagnosis-list">
                {path.successCriteria.map((criterion) => (
                  <li key={criterion}>{criterion}</li>
                ))}
              </ul>
              <h4>Maintenance note</h4>
              <p>{path.maintenanceNote}</p>
            </div>
          )}
        </section>
      </div>
    </Tray>
  );
}
