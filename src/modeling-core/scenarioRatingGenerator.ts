import type { RatingEvent } from './types.js';
import { ratingFromHiddenTruth } from './scenarioTruth.js';
import type { ScenarioActorTruth, ScenarioIslandTruth } from './scenarioTruth.js';
import type { ScenarioEncounterInjection } from './scenarioInjections.js';

export function generateRatingEventFromEncounter(
  scenarioId: string,
  encounterIndex: number,
  encounter: ScenarioEncounterInjection,
  actor: ScenarioActorTruth,
  island: ScenarioIslandTruth
): RatingEvent {
  return {
    id: `${scenarioId}:encounter-${encounterIndex + 1}`,
    turn: encounter.turn,
    userId: encounter.actorId,
    islandId: encounter.islandId,
    rating: ratingFromHiddenTruth(actor, island),
    source: encounter.source,
    focusTag: encounter.focusTag ?? island.laneScope[0],
    focusMeaning: 'expectationFulfillment',
    selectionReason: encounter.selectionReason ?? 'highValueScoutOpportunity'
  };
}
