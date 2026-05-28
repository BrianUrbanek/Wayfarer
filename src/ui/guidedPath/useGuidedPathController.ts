import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { GuidedStep } from './guidedPathTypes.js';
import {
  GuidedPathControllerStore,
  type GuidedPathControllerSnapshot,
  type GuidedPathControllerView
} from './guidedPathController.js';

export interface UseGuidedPathControllerResult extends GuidedPathControllerView {
  snapshot: GuidedPathControllerSnapshot;
  next: () => void;
  previous: () => void;
  select: (stepId: string) => void;
  markComplete: (stepId?: string | null) => void;
  reset: () => void;
}

function buildStepSignature(steps: readonly GuidedStep[]): string {
  return steps.map((step) => step.id).join('|');
}

export function useGuidedPathController(steps: readonly GuidedStep[]): UseGuidedPathControllerResult {
  const storeRef = useRef<GuidedPathControllerStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = new GuidedPathControllerStore(steps);
  }

  const stepsSignature = useMemo(() => buildStepSignature(steps), [steps]);

  useEffect(() => {
    storeRef.current?.setSteps(steps);
  }, [stepsSignature, steps]);

  const snapshot = useSyncExternalStore(
    (listener) => storeRef.current!.subscribe(listener),
    () => storeRef.current!.getSnapshot(),
    () => storeRef.current!.getSnapshot()
  );

  const view = useMemo(() => storeRef.current!.getView(), [snapshot.activeStepId, snapshot.completedStepIds, stepsSignature]);
  const next = useMemo(() => () => storeRef.current!.next(), []);
  const previous = useMemo(() => () => storeRef.current!.previous(), []);
  const select = useMemo(() => (stepId: string) => storeRef.current!.select(stepId), []);
  const markComplete = useMemo(() => (stepId?: string | null) => storeRef.current!.markComplete(stepId), []);
  const reset = useMemo(() => () => storeRef.current!.reset(), []);

  return useMemo(
    () => ({
      ...view,
      snapshot,
      next,
      previous,
      select,
      markComplete,
      reset
    }),
    [markComplete, next, previous, reset, select, snapshot, view]
  );
}
