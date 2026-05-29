import { type ChangeEvent, type RefObject } from 'react';
import { Badge } from './components/Badge';
import { InfoTip } from './components/InfoTip';
import { ProgressBar } from './components/ProgressBar';
import type { ScenarioPresetMetadata } from '../model/scenarioPresets';
import { PARTICIPATION_MODEL_LABELS, RATING_COUNT_MODEL_LABELS, ROUTING_RISK_PROFILE_LABELS, TURN_MODE_LABELS, type ParticipationModel, type RatingCountModel, type RoutingRiskProfile, type TurnMode } from '../model/turnPolicy';
import type { ScenarioPresetId, ScenarioPreset } from '../model/scenarioPresets';
import { ExpertScenarioTuning, type ExpertScenarioTuningProps } from './ExpertScenarioTuning';

type ScenarioPresetOption = {
  id: ScenarioPresetId;
  label: string;
};

interface PrimaryWorkflowPanelProps {
  panelRef?: RefObject<HTMLElement>;
  executeScenarioRef?: RefObject<HTMLButtonElement>;
  demoReportRef?: RefObject<HTMLButtonElement>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  runState: 'no-run' | 'bootstrap-only' | 'meaningful-run';
  showAnalysisDashboard: boolean;
  primaryWorkflowHelperCopy: string;
  scenarioMessage: string;
  scenarioError: string;
  isExecutingScenario: boolean;
  executionProgress: number;
  executionStatus: string;
  turnsToRun: number;
  datasetCurrentTurn: number;
  currentScenarioLabel: string;
  turnMode: TurnMode;
  participationModel: ParticipationModel;
  organicRatingCountModel: RatingCountModel;
  routingRiskProfile: RoutingRiskProfile;
  scenarioPresetSource: ScenarioPresetMetadata | null;
  activeScenarioPreset: ScenarioPreset | null;
  scenarioPresetDisplay: ScenarioPreset | null;
  scenarioPresetSourceNote: ScenarioPresetMetadata | null;
  scenarioPresetOptions: ScenarioPresetOption[];
  onScenarioPresetChange: (presetId: ScenarioPresetId | 'custom') => void;
  onExecuteScenario: () => void;
  onExportCurrentSimulationJson: () => void;
  onOpenScenarioFilePicker: () => void;
  onOpenGoldenDemoReport: () => void;
  onResetSimulation: () => void;
  onToggleDebug: () => void;
  showDebug: boolean;
  onTakeSingleTurn: () => void;
  onTakeBatchTurns: () => void;
  onShowTimingLog: () => void;
  standardScenarioControlsDisabled: boolean;
  scenarioFileInputRef: RefObject<HTMLInputElement>;
  onScenarioFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  showExpertScenarioTuning: boolean;
  expertScenarioTuningProps: ExpertScenarioTuningProps;
  onChooseUser: () => void;
  onChooseIsland: () => void;
  onChooseCohort: () => void;
  canOpenGoldenDemoReport: boolean;
}

export function PrimaryWorkflowPanel({
  panelRef,
  executeScenarioRef,
  demoReportRef,
  collapsed,
  onToggleCollapsed,
  runState,
  showAnalysisDashboard,
  primaryWorkflowHelperCopy,
  scenarioMessage,
  scenarioError,
  isExecutingScenario,
  executionProgress,
  executionStatus,
  turnsToRun,
  datasetCurrentTurn,
  currentScenarioLabel,
  turnMode,
  participationModel,
  organicRatingCountModel,
  routingRiskProfile,
  scenarioPresetSource,
  activeScenarioPreset,
  scenarioPresetDisplay,
  scenarioPresetSourceNote,
  scenarioPresetOptions,
  onScenarioPresetChange,
  onExecuteScenario,
  onExportCurrentSimulationJson,
  onOpenScenarioFilePicker,
  onOpenGoldenDemoReport,
  onResetSimulation,
  onToggleDebug,
  showDebug,
  onTakeSingleTurn,
  onTakeBatchTurns,
  onShowTimingLog,
  standardScenarioControlsDisabled,
  scenarioFileInputRef,
  onScenarioFileChange,
  showExpertScenarioTuning,
  expertScenarioTuningProps,
  onChooseUser,
  onChooseIsland,
  onChooseCohort,
  canOpenGoldenDemoReport
}: PrimaryWorkflowPanelProps) {
  return (
    <section
      ref={panelRef}
      id="primary-workflow"
      className={`panel stage-panel${collapsed ? ' stage-panel__sticky' : ''}`}
      aria-label="Primary workflow"
    >
      <div className="stage-panel__lead">
        <div>
          <p className="eyebrow">Primary workflow</p>
          {!collapsed ? (
            <h2>
              {runState === 'no-run'
                ? 'Choose a scenario or load a saved run.'
                : runState === 'bootstrap-only'
                  ? 'Loaded baseline only. Execute to inspect the proof path.'
                  : 'Inspect the current state, then advance one turn.'}
            </h2>
          ) : null}
          {!collapsed ? (
            <p className="muted">
              {runState === 'no-run'
                ? 'Preset selection sets up the run, but a meaningful run only exists after execution or import.'
                : runState === 'bootstrap-only'
                  ? 'This state is a baseline snapshot, not the review path.'
                  : 'Keep the portfolio demo centered on one analyst target, one routed surface, and one turn-step at a time.'}
            </p>
          ) : null}
          {!collapsed && showAnalysisDashboard ? (
            <p className="muted">For a concrete proof example, select an island and inspect Truth Alignment.</p>
          ) : null}
        </div>
        <button
          type="button"
          className="icon-button collapsible-panel__toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand Primary workflow' : 'Collapse Primary workflow'}
        >
          <span className="collapsible-panel__toggle-icon" aria-hidden="true">
            {collapsed ? 'v' : '^'}
          </span>
        </button>
      </div>

      <div className="stage-panel__workspace">
        {!collapsed ? (
          <div className="stage-panel__workspace-main">
            <div className="control-strip__preset">
              <div className="control-strip__preset-main">
                <div className="control-strip__preset-start-row">
                  <div className="control-strip__preset-start-column">
                    <label className="control control--preset">
                      <span className="control__label-row">
                        <span>Scenario preset</span>
                        <InfoTip
                          label="Scenario preset help"
                          text="These scenarios are defined in src/data/scenario-catalog.json. Edit that JSON to change the named presets."
                        />
                      </span>
                    <select
                      value={scenarioPresetSource?.id ?? activeScenarioPreset?.id ?? 'custom'}
                      onChange={(event) => onScenarioPresetChange(event.target.value as ScenarioPresetId | 'custom')}
                    >
                      <option value="custom" disabled>
                        Custom / imported
                      </option>
                        {scenarioPresetOptions.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="control-strip__notes control-strip__notes--inline control-strip__notes--setup">
                      <p className="muted">{primaryWorkflowHelperCopy}</p>
                      {scenarioMessage ? <p className="muted">{scenarioMessage}</p> : null}
                      {scenarioError ? <p className="text-danger">{scenarioError}</p> : null}
                    </div>
                  </div>

                  <div className="stage-panel__utility-block stage-panel__utility-block--execute stage-panel__utility-block--compact">
                    <button
                      ref={executeScenarioRef}
                      type="button"
                      className="button button--primary"
                      onClick={onExecuteScenario}
                      disabled={isExecutingScenario}
                    >
                      Execute Scenario
                    </button>
                    <p className="muted">
                      Generate a fresh dataset from the selected setup, then run {turnsToRun} turns to the next inspection state.
                    </p>
                    {isExecutingScenario ? (
                      <ProgressBar value={executionProgress} label={executionStatus || 'Executing scenario'} tone="accent" />
                    ) : null}
                  </div>
                </div>

                <div className="control-strip__preset-frame control-strip__preset-frame--wide">
                  <div className="control-strip__preset-frame-header">
                    <span className="control__label-row">
                      <span>Preset details</span>
                    </span>
                  </div>
                  <div className="control-strip__preset-copy">
                    <p>{scenarioPresetDisplay?.goodFor ?? 'Custom / imported scenario with no named preset match.'}</p>
                    <p className="muted">
                      {scenarioPresetDisplay?.description ?? 'This scenario has been edited away from a named preset, or it was imported as a custom case.'}
                    </p>
                    {scenarioPresetSourceNote ? <p className="muted">Based on: {scenarioPresetSourceNote.label}</p> : null}
                  </div>
                </div>
              </div>
            </div>

            <div className="control-strip__utility-row">
              <div className="control-strip__utility-group">
                <div className="control-strip__subframe-heading">
                  <span className="control__label-row">
                    <span className="eyebrow">Simulation JSON</span>
                    <InfoTip label="Simulation JSON help" text="Save or reload the current resolved scenario and simulation state." />
                  </span>
                </div>
                <div className="control-strip__action-group control-strip__action-group--compact">
                  <button type="button" className="button button--ghost" onClick={onExportCurrentSimulationJson} disabled={isExecutingScenario}>
                    Export
                  </button>
                  <button type="button" className="button button--ghost" onClick={onOpenScenarioFilePicker} disabled={isExecutingScenario}>
                    Import
                  </button>
                </div>
              </div>

              <div className="control-strip__utility-group">
                <div className="control-strip__subframe-heading">
                  <span className="control__label-row">
                    <span className="eyebrow">Scenario utilities</span>
                    <InfoTip
                      label="Scenario utility help"
                      text="Utility actions stay available next to the demo report. Open the report only after a meaningful Golden Demo run exists."
                    />
                  </span>
                </div>
                <div className="control-strip__action-group control-strip__action-group--compact">
                  <button
                    ref={demoReportRef}
                    type="button"
                    className="button button--ghost"
                    onClick={onOpenGoldenDemoReport}
                    disabled={!canOpenGoldenDemoReport}
                  >
                    Demo report
                  </button>
                  <button type="button" className="button button--quiet" onClick={onResetSimulation} disabled={isExecutingScenario}>
                    Reset Simulation
                  </button>
                  <button type="button" className="button button--ghost" onClick={onToggleDebug} disabled={isExecutingScenario}>
                    {showDebug ? 'Hide debug' : 'Show debug'}
                  </button>
                </div>
              </div>
            </div>

            <input
              ref={scenarioFileInputRef}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
              onChange={onScenarioFileChange}
            />

            {showExpertScenarioTuning ? <ExpertScenarioTuning {...expertScenarioTuningProps} /> : null}
          </div>
        ) : null}

        <div className="stage-panel__summary-rail">
          <div className="stage-panel__badges">
            <Badge tone="accent">Turn {datasetCurrentTurn}</Badge>
            <Badge tone="neutral">Scenario: {currentScenarioLabel}</Badge>
            <Badge tone="neutral">Mode: {TURN_MODE_LABELS[turnMode]}</Badge>
            <Badge tone="neutral">Participation: {PARTICIPATION_MODEL_LABELS[participationModel]}</Badge>
            <Badge tone="neutral">Rating counts: {RATING_COUNT_MODEL_LABELS[organicRatingCountModel]}</Badge>
            <Badge tone="neutral">Routing: {ROUTING_RISK_PROFILE_LABELS[routingRiskProfile]}</Badge>
          </div>

          <div className="stage-panel__actions stage-panel__actions--summary">
            <div className="stage-panel__action-group">
              <button type="button" className="button button--primary" onClick={onTakeSingleTurn} disabled={standardScenarioControlsDisabled}>
                Take 1 Turn
              </button>
              <button type="button" className="button" onClick={onTakeBatchTurns} disabled={standardScenarioControlsDisabled}>
                Take {turnsToRun} Turns
              </button>
              <button type="button" className="button button--ghost" onClick={onShowTimingLog} disabled={standardScenarioControlsDisabled}>
                Timing log
              </button>
            </div>
            <div className="stage-panel__action-group stage-panel__action-group--right">
              <button type="button" className="button button--ghost" onClick={onChooseUser} disabled={standardScenarioControlsDisabled}>
                Choose user
              </button>
              <button type="button" className="button button--ghost" onClick={onChooseIsland} disabled={standardScenarioControlsDisabled}>
                Choose island
              </button>
              <button type="button" className="button button--ghost" onClick={onChooseCohort} disabled={standardScenarioControlsDisabled}>
                Choose cohort
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
