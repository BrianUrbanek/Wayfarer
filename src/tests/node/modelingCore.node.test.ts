import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runModelingFixture } from '../../modeling-core/index.js';

describe('modeling core harness', () => {
  it('produces a deterministic trace with unsupported concept markers', () => {
    const first = runModelingFixture('basic');
    const second = runModelingFixture('basic');

    assert.deepEqual(second, first);
    assert.equal(first.fixtureId, 'basic');
    assert.equal(first.steps.length, 1);
    assert.equal(first.steps[0]?.rawRating.id, 'fixture-0:event-0');
    assert.equal(first.steps[0]?.unsupportedConcepts.includes('trustRD'), true);
    assert.equal(Array.isArray(first.steps[0]?.recommendationFacingState), true);
  });

  it('marks meh semantics as unsupported while preserving trace output', () => {
    const trace = runModelingFixture('meh-observed');

    assert.equal(trace.fixtureId, 'meh-observed');
    assert.equal(trace.steps[0]?.rawRating.rating, 0);
    assert.equal(trace.steps[0]?.unsupportedConcepts.includes('mehSemanticsChange'), true);
    assert.equal(trace.steps[0]?.deferredEvidence?.supported, false);
  });
});
