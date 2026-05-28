import type { ScenarioPresetId } from '../../model/scenarioPresets.js';

export const GUIDED_TARGET_IDS = [
  'primary-workflow',
  'execute-scenario',
  'turn-summary',
  'turn-recap',
  'selected-user-summary',
  'hidden-cohort-recovery',
  'selected-island',
  'selected-island-truth',
  'discovery-routing',
  'reviewer-archetype-recovery',
  'system-health',
  'model-explanation',
  'debug-data',
  'demo-report'
] as const;

export type GuidedTargetId = (typeof GUIDED_TARGET_IDS)[number];

export function isGuidedTargetId(value: string): value is GuidedTargetId {
  return (GUIDED_TARGET_IDS as readonly string[]).includes(value);
}

export type GuidedStepStatus = 'active' | 'completed' | 'upcoming';

export interface GuidedStep {
  id: string;
  title: string;
  body: string;
  targetId?: GuidedTargetId;
  actionLabel?: string;
  why?: string;
}

export interface GuidedStepState extends GuidedStep {
  index: number;
  status: GuidedStepStatus;
}

export interface GuidedPath {
  id: string;
  title: string;
  recommendedPreset: ScenarioPresetId;
  recommendedPath?: string;
  framing: {
    system: string;
    experience: string;
  };
  steps: GuidedStep[];
  successCriteria: string[];
  maintenanceNote: string;
}
