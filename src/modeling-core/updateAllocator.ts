import type { IslandTasteModel, PlayerPreferenceModel, TagId, UpdateAllocation } from './types.js';
import { average, clamp, round } from './math.js';

const FOCUSED_EVIDENCE_ISLAND_BIAS = 0.8;

export interface UpdateAllocator {
  allocateUpdatePressure(
    player: PlayerPreferenceModel,
    island: IslandTasteModel,
    allTags: readonly TagId[],
    focusTag: TagId | null
  ): UpdateAllocation;
}

export const rdWeightedUpdateAllocator: UpdateAllocator = {
  allocateUpdatePressure(player, island, allTags, focusTag) {
    const updateTags = focusTag ? [focusTag] : allTags;
    const playerAverageRD = average(updateTags.map((tag) => player.preferenceRDByTag[tag] ?? 1));
    const islandAverageRD = average(updateTags.map((tag) => island.audienceFitRDByTag[tag] ?? 1));
    const totalRD = Math.max(0.001, playerAverageRD + islandAverageRD);
    const baseIslandUpdateShare = islandAverageRD / totalRD;
    const focusTagIslandBias = focusTag ? FOCUSED_EVIDENCE_ISLAND_BIAS : 0.5;
    const islandUpdateShare = focusTag
      ? clamp(baseIslandUpdateShare * focusTagIslandBias + (1 - focusTagIslandBias), 0, 1)
      : baseIslandUpdateShare;
    const playerUpdateShare = 1 - islandUpdateShare;

    return {
      playerUpdateShare: round(playerUpdateShare),
      islandUpdateShare: round(islandUpdateShare),
      playerAverageRD: round(playerAverageRD),
      islandAverageRD: round(islandAverageRD),
      focusTagIslandBias: round(focusTagIslandBias)
    };
  }
};
