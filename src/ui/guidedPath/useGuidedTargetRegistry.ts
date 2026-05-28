import { useMemo, useSyncExternalStore } from 'react';
import type { GuidedTargetId } from './guidedPathTypes.js';
import {
  GuidedTargetRegistryStore,
  type GuidedTargetRegistryDeps,
  type GuidedTargetRegistrySnapshot,
  type GuidedTargetRegistration
} from './guidedTargetRegistry.js';

export interface UseGuidedTargetRegistryResult extends GuidedTargetRegistrySnapshot {
  registerTarget: (targetId: GuidedTargetId, registration: GuidedTargetRegistration) => () => void;
  unregisterTarget: (targetId: GuidedTargetId) => void;
  showTarget: (targetId: GuidedTargetId) => Promise<boolean>;
  clearActiveTarget: () => void;
}

export function useGuidedTargetRegistry(deps?: GuidedTargetRegistryDeps): UseGuidedTargetRegistryResult {
  const store = useMemo(() => new GuidedTargetRegistryStore(deps), [deps]);

  const snapshot = useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => store.getSnapshot()
  );

  const registerTarget = useMemo(
    () => (targetId: GuidedTargetId, registration: GuidedTargetRegistration) => store.registerTarget(targetId, registration),
    [store]
  );
  const unregisterTarget = useMemo(() => (targetId: GuidedTargetId) => store.unregisterTarget(targetId), [store]);
  const showTarget = useMemo(() => (targetId: GuidedTargetId) => store.showTarget(targetId), [store]);
  const clearActiveTarget = useMemo(() => () => store.clearActiveTarget(), [store]);

  return useMemo(
    () => ({
      ...snapshot,
      registerTarget,
      unregisterTarget,
      showTarget,
      clearActiveTarget
    }),
    [clearActiveTarget, registerTarget, showTarget, snapshot, unregisterTarget]
  );
}
