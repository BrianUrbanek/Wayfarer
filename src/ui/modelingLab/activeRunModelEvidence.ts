import type { ModelingTraceRun } from '../../modeling-core/types.js';
import { runModelingFixture } from '../../modeling-core/index.js';
import type { ScenarioPresetMetadata } from '../../model/scenarioPresets.js';
import { buildModelingRunViewModel, type ModelingRunViewModel } from './modelingLabViewModel.js';

export interface ActiveRunModelEvidenceInput {
  scenarioPreset: ScenarioPresetMetadata | null;
}

export function resolveActiveRunModelEvidencePreset(
  scenarioPresetSource: ScenarioPresetMetadata | null,
  activeScenarioPresetMetadata: ScenarioPresetMetadata | null
): ScenarioPresetMetadata | null {
  return scenarioPresetSource ?? activeScenarioPresetMetadata ?? null;
}

export type ActiveRunModelEvidence =
  | {
      kind: 'no-trace';
      message: string;
      trace: null;
      viewModel: null;
    }
  | {
      kind: 'trace';
      message: string;
      traceFixtureId: string;
      traceLabel: string;
      trace: ModelingTraceRun;
      viewModel: ModelingRunViewModel;
    };

function traceFixtureIdForPreset(scenarioPreset: ScenarioPresetMetadata | null): string | null {
  return scenarioPreset?.modelingTraceFixtureId ?? null;
}

export function buildActiveRunModelEvidence(input: ActiveRunModelEvidenceInput): ActiveRunModelEvidence {
  const traceFixtureId = traceFixtureIdForPreset(input.scenarioPreset);

  if (!traceFixtureId) {
    return {
      kind: 'no-trace',
      message: 'No modeling trace attached to this run.',
      trace: null,
      viewModel: null
    };
  }

  const trace = runModelingFixture(traceFixtureId);
  return {
    kind: 'trace',
    message: `Modeling trace attached for ${input.scenarioPreset?.label ?? traceFixtureId}.`,
    traceFixtureId,
    traceLabel: input.scenarioPreset?.modelingTraceLabel ?? traceFixtureId,
    trace,
    viewModel: buildModelingRunViewModel(trace)
  };
}
