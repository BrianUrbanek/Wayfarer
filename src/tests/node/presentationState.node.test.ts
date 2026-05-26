import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { SimulationTurnSummary } from '../../model/simulation.js';
import { derivePresentationState } from '../../ui/presentationState.js';

function buildState(turn: number, turnHistoryTurns: number[] = [0]) {
  const makeTurnSummary = (turnNumber: number) =>
    ({
      turn: turnNumber,
      mode: 'organic',
      participatingUserIds: [],
      ratingsCreated: 0,
      organicRatingsCreated: 0,
      guidedRatingsCreated: 0,
      newlyRatedIslandIds: [],
      routedIslandIds: [],
      recommendationKinds: { SAFE_FIT: 0, DISCOVERY_PROBE: 0 },
      diagnosisCounts: {
        HIGH_SIGNAL: 0,
        MISMATCH_RETAG: 0,
        INVERSE_PROFILE: 0,
        UNKNOWN_OR_NOISY: 0,
        LOW_SIGNAL: 0,
        AMBIGUOUS: 0,
        UNEXPLAINED_PREDICTIVE: 0
      }
    }) satisfies SimulationTurnSummary;

  return {
    currentTurn: turn,
    turnHistory: turnHistoryTurns.map(makeTurnSummary),
    ratingEvents: []
  };
}

describe('presentation state', () => {
  it('classifies cold-load novice state as no-run even with a bootstrap state behind it', () => {
    const state = derivePresentationState({
      guidanceMode: 'novice',
      runSource: 'cold-load',
      simulationState: buildState(0)
    });

    assert.equal(state.runState, 'no-run');
    assert.equal(state.hasMeaningfulRun, false);
  });

  it('classifies imported or executed turn-0 states as bootstrap-only until they advance past bootstrap', () => {
    const imported = derivePresentationState({
      guidanceMode: 'novice',
      runSource: 'imported',
      simulationState: buildState(0)
    });
    const executed = derivePresentationState({
      guidanceMode: 'novice',
      runSource: 'executed',
      simulationState: buildState(0)
    });

    assert.equal(imported.runState, 'bootstrap-only');
    assert.equal(executed.runState, 'bootstrap-only');
  });

  it('keeps turn 0 bootstrap ratings from becoming meaningful evidence', () => {
    const bootstrapState = {
      currentTurn: 0,
      turnHistory: [
        {
          turn: 0,
          mode: 'organic',
          participatingUserIds: [],
          ratingsCreated: 12,
          organicRatingsCreated: 12,
          guidedRatingsCreated: 0,
          newlyRatedIslandIds: [],
          routedIslandIds: [],
          recommendationKinds: { SAFE_FIT: 0, DISCOVERY_PROBE: 0 },
          diagnosisCounts: {
            HIGH_SIGNAL: 0,
            MISMATCH_RETAG: 0,
            INVERSE_PROFILE: 0,
            UNKNOWN_OR_NOISY: 0,
            LOW_SIGNAL: 0,
            AMBIGUOUS: 0,
            UNEXPLAINED_PREDICTIVE: 0
          }
        } satisfies SimulationTurnSummary
      ],
      ratingEvents: []
    };

    const imported = derivePresentationState({
      guidanceMode: 'novice',
      runSource: 'imported',
      simulationState: bootstrapState
    });
    const executed = derivePresentationState({
      guidanceMode: 'novice',
      runSource: 'executed',
      simulationState: bootstrapState
    });

    assert.equal(imported.runState, 'bootstrap-only');
    assert.equal(executed.runState, 'bootstrap-only');
    assert.equal(imported.hasMeaningfulRun, false);
    assert.equal(executed.hasMeaningfulRun, false);
  });

  it('treats post-bootstrap turn history as a meaningful run', () => {
    const state = derivePresentationState({
      guidanceMode: 'novice',
      runSource: 'executed',
      simulationState: buildState(3, [0, 1, 2, 3])
    });

    assert.equal(state.runState, 'meaningful-run');
    assert.equal(state.hasMeaningfulRun, true);
  });

  it('keeps expert mode available even before a meaningful run exists', () => {
    const state = derivePresentationState({
      guidanceMode: 'expert',
      runSource: 'cold-load',
      simulationState: buildState(0)
    });

    assert.equal(state.guidanceMode, 'expert');
    assert.equal(state.runState, 'no-run');
  });
});
