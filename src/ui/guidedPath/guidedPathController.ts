import type { GuidedStep, GuidedStepState, GuidedStepStatus } from './guidedPathTypes.js';

export interface GuidedPathControllerSnapshot {
  activeStepId: string | null;
  completedStepIds: string[];
}

export interface GuidedPathControllerView extends GuidedPathControllerSnapshot {
  activeStepIndex: number;
  activeStep: GuidedStepState | null;
  stepStates: GuidedStepState[];
  hasPrevious: boolean;
  hasNext: boolean;
}

type Listener = () => void;

function uniqueIds(ids: readonly string[]): string[] {
  return Array.from(new Set(ids));
}

function stepIndexById(steps: readonly GuidedStep[], stepId: string | null): number {
  if (!stepId) {
    return -1;
  }

  return steps.findIndex((step) => step.id === stepId);
}

function firstStepId(steps: readonly GuidedStep[]): string | null {
  return steps[0]?.id ?? null;
}

export function createGuidedPathControllerSnapshot(steps: readonly GuidedStep[], activeStepId?: string | null): GuidedPathControllerSnapshot {
  const firstId = firstStepId(steps);
  const activeId = activeStepId && stepIndexById(steps, activeStepId) >= 0 ? activeStepId : firstId;

  return {
    activeStepId: activeId,
    completedStepIds: []
  };
}

export function buildGuidedPathControllerView(
  steps: readonly GuidedStep[],
  snapshot: GuidedPathControllerSnapshot
): GuidedPathControllerView {
  const activeStepIndex = Math.max(0, stepIndexById(steps, snapshot.activeStepId));
  const completedSet = new Set(snapshot.completedStepIds);

  const stepStates = steps.map((step, index) => {
    const status: GuidedStepStatus = step.id === snapshot.activeStepId
      ? 'active'
      : completedSet.has(step.id) || index < activeStepIndex
        ? 'completed'
        : 'upcoming';

    return {
      ...step,
      index,
      status
    };
  });

  const activeStep = stepStates.find((step) => step.status === 'active') ?? null;

  return {
    activeStepId: snapshot.activeStepId,
    completedStepIds: snapshot.completedStepIds,
    activeStepIndex,
    activeStep,
    stepStates,
    hasPrevious: activeStepIndex > 0,
    hasNext: activeStepIndex >= 0 && activeStepIndex < steps.length - 1
  };
}

export function nextGuidedPathControllerSnapshot(
  steps: readonly GuidedStep[],
  snapshot: GuidedPathControllerSnapshot
): GuidedPathControllerSnapshot {
  const currentIndex = stepIndexById(steps, snapshot.activeStepId);
  if (currentIndex < 0 || currentIndex >= steps.length - 1) {
    return snapshot;
  }

  const currentId = steps[currentIndex].id;
  const nextId = steps[currentIndex + 1].id;
  return {
    activeStepId: nextId,
    completedStepIds: uniqueIds([...snapshot.completedStepIds, currentId])
  };
}

export function previousGuidedPathControllerSnapshot(
  steps: readonly GuidedStep[],
  snapshot: GuidedPathControllerSnapshot
): GuidedPathControllerSnapshot {
  const currentIndex = stepIndexById(steps, snapshot.activeStepId);
  if (currentIndex <= 0) {
    return snapshot;
  }

  return {
    ...snapshot,
    activeStepId: steps[currentIndex - 1].id
  };
}

export function selectGuidedPathControllerSnapshot(
  steps: readonly GuidedStep[],
  snapshot: GuidedPathControllerSnapshot,
  stepId: string
): GuidedPathControllerSnapshot {
  const targetIndex = stepIndexById(steps, stepId);
  if (targetIndex < 0) {
    return snapshot;
  }

  const completedStepIds = uniqueIds([...snapshot.completedStepIds, ...steps.slice(0, targetIndex).map((step) => step.id)]);
  return {
    activeStepId: steps[targetIndex].id,
    completedStepIds
  };
}

export function markGuidedPathStepComplete(
  steps: readonly GuidedStep[],
  snapshot: GuidedPathControllerSnapshot,
  stepId?: string | null
): GuidedPathControllerSnapshot {
  const targetId = stepId ?? snapshot.activeStepId;
  if (!targetId || stepIndexById(steps, targetId) < 0) {
    return snapshot;
  }

  return {
    ...snapshot,
    completedStepIds: uniqueIds([...snapshot.completedStepIds, targetId])
  };
}

export function reconcileGuidedPathControllerSnapshot(
  steps: readonly GuidedStep[],
  snapshot: GuidedPathControllerSnapshot
): GuidedPathControllerSnapshot {
  const validIds = new Set(steps.map((step) => step.id));
  const completedStepIds = snapshot.completedStepIds.filter((stepId) => validIds.has(stepId));
  const activeStepId = snapshot.activeStepId && validIds.has(snapshot.activeStepId) ? snapshot.activeStepId : firstStepId(steps);

  return {
    activeStepId,
    completedStepIds
  };
}

export class GuidedPathControllerStore {
  private readonly listeners = new Set<Listener>();
  private snapshot: GuidedPathControllerSnapshot;
  private steps: readonly GuidedStep[];

  constructor(steps: readonly GuidedStep[], activeStepId?: string | null) {
    this.steps = steps.slice();
    this.snapshot = createGuidedPathControllerSnapshot(this.steps, activeStepId);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): GuidedPathControllerSnapshot {
    return this.snapshot;
  }

  getView(): GuidedPathControllerView {
    return buildGuidedPathControllerView(this.steps, this.snapshot);
  }

  setSteps(steps: readonly GuidedStep[]): void {
    const nextSteps = steps.slice();
    const nextSignature = nextSteps.map((step) => step.id).join('|');
    const currentSignature = this.steps.map((step) => step.id).join('|');

    if (nextSignature !== currentSignature) {
      this.steps = nextSteps;
      this.snapshot = createGuidedPathControllerSnapshot(this.steps);
      this.emit();
      return;
    }

    const reconciled = reconcileGuidedPathControllerSnapshot(this.steps, this.snapshot);
    const currentCompletedSignature = this.snapshot.completedStepIds.join('|');
    const nextCompletedSignature = reconciled.completedStepIds.join('|');
    if (reconciled.activeStepId !== this.snapshot.activeStepId || nextCompletedSignature !== currentCompletedSignature) {
      this.snapshot = reconciled;
      this.emit();
    }
  }

  next(): void {
    const nextSnapshot = nextGuidedPathControllerSnapshot(this.steps, this.snapshot);
    if (nextSnapshot !== this.snapshot) {
      this.snapshot = nextSnapshot;
      this.emit();
    }
  }

  previous(): void {
    const nextSnapshot = previousGuidedPathControllerSnapshot(this.steps, this.snapshot);
    if (nextSnapshot !== this.snapshot) {
      this.snapshot = nextSnapshot;
      this.emit();
    }
  }

  select(stepId: string): void {
    const nextSnapshot = selectGuidedPathControllerSnapshot(this.steps, this.snapshot, stepId);
    if (nextSnapshot !== this.snapshot) {
      this.snapshot = nextSnapshot;
      this.emit();
    }
  }

  markComplete(stepId?: string | null): void {
    const nextSnapshot = markGuidedPathStepComplete(this.steps, this.snapshot, stepId);
    if (nextSnapshot !== this.snapshot) {
      this.snapshot = nextSnapshot;
      this.emit();
    }
  }

  reset(): void {
    this.snapshot = createGuidedPathControllerSnapshot(this.steps);
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
