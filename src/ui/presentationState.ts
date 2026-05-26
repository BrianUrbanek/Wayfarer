import type { GuidanceMode } from './dashboardGuidance.js';
import type { SimulationState } from '../model/simulation.js';

export type RunPresentationSource = 'cold-load' | 'imported' | 'executed';

export type PresentationRunState = 'no-run' | 'bootstrap-only' | 'meaningful-run';

export interface PresentationState {
  guidanceMode: GuidanceMode;
  runSource: RunPresentationSource;
  runState: PresentationRunState;
  hasMeaningfulRun: boolean;
}

function hasPostBootstrapEvidence(state: Pick<SimulationState, 'currentTurn' | 'turnHistory' | 'ratingEvents'>): boolean {
  return state.currentTurn > 0 || state.turnHistory.some((turn) => turn.turn > 0);
}

export function derivePresentationState(input: {
  guidanceMode: GuidanceMode;
  runSource: RunPresentationSource;
  simulationState: Pick<SimulationState, 'currentTurn' | 'turnHistory' | 'ratingEvents'>;
}): PresentationState {
  const hasMeaningfulRun = hasPostBootstrapEvidence(input.simulationState);

  if (input.guidanceMode === 'expert') {
    return {
      guidanceMode: 'expert',
      runSource: input.runSource,
      runState: hasMeaningfulRun ? 'meaningful-run' : input.runSource === 'cold-load' ? 'no-run' : 'bootstrap-only',
      hasMeaningfulRun
    };
  }

  if (input.runSource === 'cold-load') {
    return {
      guidanceMode: 'novice',
      runSource: 'cold-load',
      runState: 'no-run',
      hasMeaningfulRun: false
    };
  }

  return {
    guidanceMode: 'novice',
    runSource: input.runSource,
    runState: hasMeaningfulRun ? 'meaningful-run' : 'bootstrap-only',
    hasMeaningfulRun
  };
}
