import type { Island, IslandId, MaybeRating, TagId } from './types.js';

export function tagsToVector(tags: TagId[], allTags: TagId[]): number[] {
  const tagSet = new Set(tags);

  return allTags.map((tag) => (tagSet.has(tag) ? 1 : 0));
}

export function ratingsToVector(
  ratings: Record<IslandId, MaybeRating>,
  allIslands: Island[]
): MaybeRating[] {
  return allIslands.map((island) => ratings[island.id] ?? null);
}
