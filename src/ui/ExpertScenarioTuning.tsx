import { PARTICIPATION_MODEL_LABELS, TURN_MODE_LABELS, type ParticipationModel, type TurnMode } from '../model/turnPolicy';
import type { SavedScenarioGeneratorConfig } from '../model/scenarioPersistence';

export type ScenarioExecutionSeedMode = 'random' | 'fixed';

export interface ExpertScenarioTuningProps {
  seed: number;
  onSeedChange: (value: number) => void;
  numUsers: number;
  onNumUsersChange: (value: number) => void;
  numIslands: number;
  onNumIslandsChange: (value: number) => void;
  bootstrapRatingsPerUser: number;
  onBootstrapRatingsPerUserChange: (value: number) => void;
  tagAlignmentDistribution: SavedScenarioGeneratorConfig['tagAlignmentDistribution'];
  onTagAlignmentDistributionChange: (value: SavedScenarioGeneratorConfig['tagAlignmentDistribution']) => void;
  ratingAlignmentDistribution: SavedScenarioGeneratorConfig['ratingAlignmentDistribution'];
  onRatingAlignmentDistributionChange: (value: SavedScenarioGeneratorConfig['ratingAlignmentDistribution']) => void;
  turnMode: TurnMode;
  onTurnModeChange: (value: TurnMode) => void;
  participationModel: ParticipationModel;
  onParticipationModelChange: (value: ParticipationModel) => void;
  turnsToRun: number;
  onTurnsToRunChange: (value: number) => void;
  executionSeedMode: ScenarioExecutionSeedMode;
  onExecutionSeedModeChange: (value: ScenarioExecutionSeedMode) => void;
  turnModeDescription?: string;
  participationModelDescription?: string;
}

function optionValue(value: SavedScenarioGeneratorConfig['tagAlignmentDistribution']): string {
  return JSON.stringify(value);
}

export function ExpertScenarioTuning({
  seed,
  onSeedChange,
  numUsers,
  onNumUsersChange,
  numIslands,
  onNumIslandsChange,
  bootstrapRatingsPerUser,
  onBootstrapRatingsPerUserChange,
  tagAlignmentDistribution,
  onTagAlignmentDistributionChange,
  ratingAlignmentDistribution,
  onRatingAlignmentDistributionChange,
  turnMode,
  onTurnModeChange,
  participationModel,
  onParticipationModelChange,
  turnsToRun,
  onTurnsToRunChange,
  executionSeedMode,
  onExecutionSeedModeChange,
  turnModeDescription,
  participationModelDescription
}: ExpertScenarioTuningProps) {
  return (
    <div className="stage-panel__expert-controls">
      <div className="section-heading section-heading--collapse-row">
        <h3>Expert scenario tuning</h3>
      </div>
      <div className="stack">
        <div className="control-strip__fields">
          <label className="control">
            <span className="control__label-row">
              <span>Seed</span>
            </span>
            <input type="number" value={seed} onChange={(event) => onSeedChange(Number(event.target.value))} min={0} step={1} />
          </label>
          <label className="control">
            <span className="control__label-row">
              <span>Users</span>
            </span>
            <input
              type="number"
              value={numUsers}
              onChange={(event) => onNumUsersChange(Number(event.target.value))}
              min={1}
              max={400}
              step={1}
            />
          </label>
          <label className="control">
            <span className="control__label-row">
              <span>Islands</span>
            </span>
            <input
              type="number"
              value={numIslands}
              onChange={(event) => onNumIslandsChange(Number(event.target.value))}
              min={4}
              max={96}
              step={1}
            />
          </label>
          <label className="control">
            <span className="control__label-row">
              <span>Bootstrap Ratings / User</span>
            </span>
            <input
              type="number"
              value={bootstrapRatingsPerUser}
              onChange={(event) => onBootstrapRatingsPerUserChange(Number(event.target.value))}
              min={1}
              max={12}
              step={1}
            />
          </label>
          <label className="control">
            <span className="control__label-row">
              <span>Tag Alignment (Legacy)</span>
            </span>
            <select
              value={optionValue(tagAlignmentDistribution)}
              onChange={(event) => onTagAlignmentDistributionChange(JSON.parse(event.target.value) as SavedScenarioGeneratorConfig['tagAlignmentDistribution'])}
              aria-label="Tag Alignment Legacy Metadata"
            >
              <option value={optionValue({ kind: 'uniform', min: 2, max: 10 })}>Uniform 2-10</option>
              <option value={optionValue({ kind: 'uniform', min: 6, max: 10 })}>Uniform 6-10</option>
              <option value={optionValue({ kind: 'uniform', min: 8, max: 10 })}>Uniform 8-10</option>
              <option value={optionValue({ kind: 'uniform', min: 0, max: 5 })}>Uniform 0-5</option>
            </select>
          </label>
          <label className="control">
            <span className="control__label-row">
              <span>Rating Alignment (Legacy)</span>
            </span>
            <select
              value={optionValue(ratingAlignmentDistribution)}
              onChange={(event) => onRatingAlignmentDistributionChange(JSON.parse(event.target.value) as SavedScenarioGeneratorConfig['ratingAlignmentDistribution'])}
              aria-label="Rating Alignment Legacy Metadata"
            >
              <option value={optionValue({ kind: 'uniform', min: 2, max: 10 })}>Uniform 2-10</option>
              <option value={optionValue({ kind: 'uniform', min: 6, max: 10 })}>Uniform 6-10</option>
              <option value={optionValue({ kind: 'uniform', min: 8, max: 10 })}>Uniform 8-10</option>
              <option value={optionValue({ kind: 'uniform', min: 0, max: 5 })}>Uniform 0-5</option>
            </select>
          </label>
          <p className="muted">
            Reviewer archetype profile alignment is authoritative. Legacy alignment controls are metadata-only and do not alter generated user behavior.
          </p>
          <label className="control">
            <span className="control__label-row">
              <span>Turn Mode</span>
            </span>
            <select value={turnMode} onChange={(event) => onTurnModeChange(event.target.value as TurnMode)}>
              {Object.entries(TURN_MODE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {turnModeDescription ? <p className="muted">{turnModeDescription}</p> : null}
          <label className="control">
            <span className="control__label-row">
              <span>Participation Model</span>
            </span>
            <select value={participationModel} onChange={(event) => onParticipationModelChange(event.target.value as ParticipationModel)}>
              {Object.entries(PARTICIPATION_MODEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {participationModelDescription ? <p className="muted">{participationModelDescription}</p> : null}
          <label className="control">
            <span className="control__label-row">
              <span>Turns to Run</span>
            </span>
            <input type="number" value={turnsToRun} onChange={(event) => onTurnsToRunChange(Number(event.target.value))} min={1} max={20} step={1} />
          </label>
          <label className="control">
            <span className="control__label-row">
              <span>Seed on execute</span>
            </span>
            <select value={executionSeedMode} onChange={(event) => onExecutionSeedModeChange(event.target.value as ScenarioExecutionSeedMode)}>
              <option value="random">Fresh random seed</option>
              <option value="fixed">Current seed</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
