import type { ModelId, TagId } from './types.js';
import type { ScenarioActorTruth, ScenarioIslandTruth } from './scenarioTruth.js';

export interface ScenarioEncounterInjection {
  readonly turn: number;
  readonly actorId: ModelId;
  readonly islandId: ModelId;
  readonly source: 'organic' | 'guided';
  readonly selectionReason?: 'declaredPreferenceFit' | 'observedAffinityFit' | 'declaredObservedMismatchProbe' | 'cohortBoundaryProbe' | 'negativeAffinityConfirmation' | 'highValueScoutOpportunity';
  readonly focusTag?: TagId;
}

export type ScenarioInjection =
  | { readonly type: 'rewriteActorTruth'; readonly actorId: ModelId; readonly truth: ScenarioActorTruth }
  | { readonly type: 'rewriteIslandTruth'; readonly islandId: ModelId; readonly truth: ScenarioIslandTruth }
  | { readonly type: 'ensureEncounter'; readonly encounter: ScenarioEncounterInjection };

export function rewriteActorTruth(actorId: ModelId, truth: ScenarioActorTruth): ScenarioInjection {
  return { type: 'rewriteActorTruth', actorId, truth };
}

export function rewriteIslandTruth(islandId: ModelId, truth: ScenarioIslandTruth): ScenarioInjection {
  return { type: 'rewriteIslandTruth', islandId, truth };
}

export function ensureEncounter(encounter: ScenarioEncounterInjection): ScenarioInjection {
  return { type: 'ensureEncounter', encounter };
}
