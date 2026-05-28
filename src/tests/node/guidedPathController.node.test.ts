import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GuidedPathControllerStore,
  buildGuidedPathControllerView,
  createGuidedPathControllerSnapshot
} from '../../ui/guidedPath/guidedPathController.js';
import type { GuidedStep } from '../../ui/guidedPath/guidedPathTypes.js';

const STEPS: GuidedStep[] = [
  { id: 'step-1', title: 'Step 1', body: 'Body 1' },
  { id: 'step-2', title: 'Step 2', body: 'Body 2' },
  { id: 'step-3', title: 'Step 3', body: 'Body 3' }
];

describe('guided path controller', () => {
  it('initializes the first step as active', () => {
    const snapshot = createGuidedPathControllerSnapshot(STEPS);
    const view = buildGuidedPathControllerView(STEPS, snapshot);

    assert.equal(snapshot.activeStepId, 'step-1');
    assert.deepEqual(snapshot.completedStepIds, []);
    assert.equal(view.activeStep?.id, 'step-1');
    assert.equal(view.stepStates[0].status, 'active');
    assert.equal(view.stepStates[1].status, 'upcoming');
    assert.equal(view.stepStates[2].status, 'upcoming');
  });

  it('supports next previous select and complete behavior deterministically', () => {
    const store = new GuidedPathControllerStore(STEPS);

    store.next();
    assert.equal(store.getSnapshot().activeStepId, 'step-2');
    assert.deepEqual(store.getSnapshot().completedStepIds, ['step-1']);

    store.previous();
    assert.equal(store.getSnapshot().activeStepId, 'step-1');
    assert.deepEqual(store.getSnapshot().completedStepIds, ['step-1']);

    store.select('step-3');
    assert.equal(store.getSnapshot().activeStepId, 'step-3');
    assert.deepEqual(store.getSnapshot().completedStepIds, ['step-1', 'step-2']);

    store.markComplete();
    assert.deepEqual(store.getSnapshot().completedStepIds, ['step-1', 'step-2', 'step-3']);
  });

  it('resets when the step list changes', () => {
    const store = new GuidedPathControllerStore(STEPS);
    store.next();
    store.markComplete();

    store.setSteps([
      { id: 'fresh-1', title: 'Fresh 1', body: 'Fresh body 1' },
      { id: 'fresh-2', title: 'Fresh 2', body: 'Fresh body 2' }
    ]);

    assert.equal(store.getSnapshot().activeStepId, 'fresh-1');
    assert.deepEqual(store.getSnapshot().completedStepIds, []);
  });
});
