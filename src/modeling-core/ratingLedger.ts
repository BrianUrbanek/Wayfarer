import type { RatingEvent, RatingLedgerEntry } from './types.js';

export function ledgerEntryIdForEvent(eventId: string): string {
  return `${eventId}:ledger`;
}

export function createRatingLedgerEntry(event: RatingEvent): RatingLedgerEntry {
  return {
    entryId: ledgerEntryIdForEvent(event.id),
    eventId: event.id,
    playerId: event.userId,
    islandId: event.islandId,
    rating: event.rating,
    ...(event.focusTag ? { focusTag: event.focusTag } : {}),
    ...(event.focusMeaning ? { focusMeaning: event.focusMeaning } : {}),
    source: event.source,
    ...(event.selectionReason ? { selectionReason: event.selectionReason } : {}),
    turn: event.turn,
    reason: event.revisionReason ?? 'initialRating',
    ...(event.supersedesEventId ? { supersedesEntryId: ledgerEntryIdForEvent(event.supersedesEventId) } : {}),
    ...(event.islandVersionId ? { islandVersionId: event.islandVersionId } : {}),
    ...(event.gameRulesVersionId ? { gameRulesVersionId: event.gameRulesVersionId } : {})
  };
}
