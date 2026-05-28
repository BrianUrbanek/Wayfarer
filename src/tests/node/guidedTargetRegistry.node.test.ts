import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GuidedTargetRegistryStore } from '../../ui/guidedPath/guidedTargetRegistry.js';

describe('guided target registry', () => {
  it('keeps snapshot identity stable until state changes', () => {
    const store = new GuidedTargetRegistryStore({ nextFrame: async () => {} });

    const firstSnapshot = store.getSnapshot();
    const secondSnapshot = store.getSnapshot();

    assert.equal(firstSnapshot, secondSnapshot);

    store.registerTarget('turn-summary', {
      elementRef: { current: null }
    });

    const thirdSnapshot = store.getSnapshot();
    assert.notEqual(thirdSnapshot, firstSnapshot);
  });

  it('no-ops safely when a target is missing', async () => {
    const store = new GuidedTargetRegistryStore({ nextFrame: async () => {} });

    await assert.doesNotReject(() => store.showTarget('turn-summary'));
    assert.equal(store.getSnapshot().activeTargetId, null);
  });

  it('expands before scrolling and highlighting', async () => {
    const calls: string[] = [];
    let timeoutCallback: (() => void) | null = null;
    const element = {
      scrollIntoView: () => {
        calls.push('scroll');
      }
    };
    const ref = { current: element };

    const store = new GuidedTargetRegistryStore({
      nextFrame: async () => {
        calls.push('frame');
      },
      setTimeout: (callback: () => void, _ms: number) => {
        timeoutCallback = callback;
        return 1;
      },
      clearTimeout: () => {},
      highlightDurationMs: 1
    });

    store.registerTarget('turn-summary', {
      elementRef: ref,
      expand: () => {
        calls.push('expand');
      }
    });

    await store.showTarget('turn-summary');

    assert.deepEqual(calls, ['expand', 'frame', 'scroll']);
    assert.equal(store.getSnapshot().activeTargetId, 'turn-summary');

    if (timeoutCallback === null) {
      throw new Error('Expected highlight timeout to be scheduled.');
    }
    const callback: () => void = timeoutCallback as unknown as () => void;
    callback();
    assert.equal(store.getSnapshot().activeTargetId, null);
  });
});
