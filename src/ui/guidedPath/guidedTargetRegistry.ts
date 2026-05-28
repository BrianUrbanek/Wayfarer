import type { MutableRefObject } from 'react';
import type { GuidedTargetId } from './guidedPathTypes.js';

export interface GuidedTargetElement {
  scrollIntoView(options?: unknown): void;
}

export interface GuidedTargetRegistration {
  elementRef: MutableRefObject<GuidedTargetElement | null>;
  expand?: () => void;
}

export interface GuidedTargetRegistrySnapshot {
  activeTargetId: GuidedTargetId | null;
  registeredTargetIds: GuidedTargetId[];
}

export type GuidedTargetTimeoutHandle = any;
type SetTimeoutFn = (callback: () => void, ms: number) => GuidedTargetTimeoutHandle;
type ClearTimeoutFn = (handle: GuidedTargetTimeoutHandle) => void;

export interface GuidedTargetRegistryDeps {
  nextFrame?: () => Promise<void>;
  setTimeout?: SetTimeoutFn;
  clearTimeout?: ClearTimeoutFn;
  highlightDurationMs?: number;
}

type Listener = () => void;

function defaultNextFrame(): Promise<void> {
  const frameScheduler = (globalThis as typeof globalThis & { requestAnimationFrame?: (callback: (time: number) => void) => number }).requestAnimationFrame;

  if (typeof frameScheduler === 'function') {
    return new Promise((resolve) => {
      frameScheduler(() => resolve());
    });
  }

  return Promise.resolve();
}

export class GuidedTargetRegistryStore {
  private readonly listeners = new Set<Listener>();
  private readonly targets = new Map<GuidedTargetId, GuidedTargetRegistration>();
  private highlightTimeoutId: GuidedTargetTimeoutHandle | null = null;
  private activeTargetId: GuidedTargetId | null = null;
  private snapshot: GuidedTargetRegistrySnapshot = {
    activeTargetId: null,
    registeredTargetIds: []
  };
  private readonly deps: {
    nextFrame: () => Promise<void>;
    setTimeout: SetTimeoutFn;
    clearTimeout: ClearTimeoutFn;
    highlightDurationMs: number;
  };

  constructor(deps: GuidedTargetRegistryDeps = {}) {
    this.deps = {
      nextFrame: deps.nextFrame ?? defaultNextFrame,
      setTimeout: deps.setTimeout ?? ((callback, ms) => globalThis.setTimeout(callback, ms)),
      clearTimeout: deps.clearTimeout ?? ((handle) => globalThis.clearTimeout(handle as never)),
      highlightDurationMs: deps.highlightDurationMs ?? 1200
    };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): GuidedTargetRegistrySnapshot {
    return this.snapshot;
  }

  registerTarget(targetId: GuidedTargetId, registration: GuidedTargetRegistration): () => void {
    this.targets.set(targetId, registration);
    this.refreshSnapshot();
    this.emit();
    return () => {
      this.unregisterTarget(targetId);
    };
  }

  unregisterTarget(targetId: GuidedTargetId): void {
    const wasActive = this.activeTargetId === targetId;
    this.targets.delete(targetId);
    if (wasActive) {
      this.clearActiveTarget();
      return;
    }

    this.refreshSnapshot();
    this.emit();
  }

  clearActiveTarget(): void {
    if (this.highlightTimeoutId !== null) {
      this.deps.clearTimeout(this.highlightTimeoutId);
      this.highlightTimeoutId = null;
    }

    if (this.activeTargetId !== null) {
      this.activeTargetId = null;
      this.refreshSnapshot();
      this.emit();
    }
  }

  async showTarget(targetId: GuidedTargetId): Promise<boolean> {
    const target = this.targets.get(targetId);

    if (!target) {
      return false;
    }

    target.expand?.();
    await this.deps.nextFrame();

    const nextElement = target.elementRef.current;
    if (!nextElement) {
      return false;
    }

    nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    this.setActiveTargetId(targetId);
    this.scheduleHighlightClear();
    return true;
  }

  private setActiveTargetId(targetId: GuidedTargetId | null): void {
    this.activeTargetId = targetId;
    this.refreshSnapshot();
    this.emit();
  }

  private scheduleHighlightClear(): void {
    if (this.highlightTimeoutId !== null) {
      this.deps.clearTimeout(this.highlightTimeoutId);
    }

    this.highlightTimeoutId = this.deps.setTimeout(() => {
      this.highlightTimeoutId = null;
      this.setActiveTargetId(null);
    }, this.deps.highlightDurationMs);
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private refreshSnapshot(): void {
    this.snapshot = {
      activeTargetId: this.activeTargetId,
      registeredTargetIds: Array.from(this.targets.keys())
    };
  }
}
