import { describe, expect, it } from 'vitest';
import { runModelingFixture } from '../modeling-core';
import { buildModelingRunViewModel } from '../ui/modelingLab/modelingLabViewModel';

describe('modeling lab view model', () => {
  it('summarizes the scenario matrix authority and validation readout', () => {
    const trace = runModelingFixture('seed-proxy-scenario-matrix');
    const viewModel = buildModelingRunViewModel(trace);

    expect(viewModel.runSummary.fixtureId).toBe('seed-proxy-scenario-matrix');
    expect(viewModel.runSummary.stepCount).toBe(63);
    expect(viewModel.runSummary.validationPassed).toBe(true);
    expect(viewModel.runSummary.hiddenTruthPolicy).toContain('Hidden truth may generate events');
    expect(viewModel.runSummary.unsupportedConcepts).toEqual([]);
    expect(viewModel.runSummary.unsupportedConceptsNote).toContain('No unsupported concepts');

    expect(viewModel.authorityRows).toEqual([
      expect.objectContaining({ actorId: 'matrix-alice', visibleRelation: 'seed', validationResult: 'PASS' }),
      expect.objectContaining({ actorId: 'matrix-bob', visibleRelation: 'seedProxy', expectedRelation: 'seedProxy', overlapCount: 15, agreementCount: 15, validationResult: 'PASS' }),
      expect.objectContaining({ actorId: 'matrix-almost-bob', visibleRelation: 'ordinarySimilar', expectedRelation: 'ordinarySimilar', overlapCount: 14, validationResult: 'PASS' }),
      expect.objectContaining({ actorId: 'matrix-anti-bob', visibleRelation: 'inverseSignal', expectedRelation: 'inverseSignal', contradictionCount: 15, validationResult: 'PASS' }),
      expect.objectContaining({ actorId: 'matrix-control', visibleRelation: 'unrelated', expectedRelation: 'unrelated', validationResult: 'PASS' })
    ]);
  });

  it('keeps hidden truth rows clearly separate from visible inference rows', () => {
    const viewModel = buildModelingRunViewModel(runModelingFixture('seed-proxy-scenario-matrix'));

    expect(viewModel.hiddenTruthRows).toContainEqual(
      expect.objectContaining({
        actorId: 'matrix-bob',
        expectedRelationToSeed: 'seedProxy',
        seedId: 'matrix-alice',
        hiddenSimilarity: 1
      })
    );
    expect(viewModel.hiddenTruthNotice).toBe('ORACLE / TEST TRUTH - not model input');
    expect(viewModel.rawTrace.fixtureId).toBe('seed-proxy-scenario-matrix');
  });
});
