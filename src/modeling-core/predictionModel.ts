import type {
  IslandTasteModel,
  ModelingPrediction,
  PlayerPreferenceModel,
  TagId
} from './types.js';
import { average, clamp, confidenceFromRD, round, volatilityPenalty } from './math.js';

export interface PredictionModel {
  predictPlayerIslandFit(player: PlayerPreferenceModel, island: IslandTasteModel, allTags: readonly TagId[]): ModelingPrediction;
}


function weightedAverageByIslandFit(values: readonly number[], weights: readonly number[]): number {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) {
    return average(values);
  }
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
}

function scoutValueForPlayerIsland(player: PlayerPreferenceModel, island: IslandTasteModel, allTags: readonly TagId[]): number {
  const weights = allTags.map((tag) => Math.max(0.05, Math.abs(island.audienceFitByTag[tag] ?? 0)));
  const laneScores = allTags.map((tag) => {
    const usefulness = player.signalModel.signalUsefulnessByTag[tag]
      ?? player.signalModel.laneSignalByTag[tag]
      ?? player.signalModel.trustEstimate;
    const signalConfidence = confidenceFromRD(player.signalModel.signalRDByTag[tag] ?? player.signalModel.trustRD);
    const signalStability = volatilityPenalty(player.signalModel.signalVolatilityByTag[tag] ?? player.signalModel.signalVolatility);
    const polarityClarity = clamp(0.65 + 0.35 * Math.abs(player.signalModel.signalAlignmentByTag[tag] ?? 0), 0.65, 1);
    const islandUncertainty = island.audienceFitRDByTag[tag] ?? 1;
    return usefulness * signalConfidence * signalStability * polarityClarity * islandUncertainty;
  });
  return clamp(weightedAverageByIslandFit(laneScores, weights), 0, 1);
}

export const dotProductPredictionModel: PredictionModel = {
  predictPlayerIslandFit(player, island, allTags) {
    const components = allTags.map((tag) => {
      const playerAffinity = player.demonstratedAffinityByTag[tag] ?? 0;
      const islandAudienceFit = island.audienceFitByTag[tag] ?? 0;
      return {
        tag,
        playerAffinity: round(playerAffinity),
        islandAudienceFit: round(islandAudienceFit),
        contribution: round(playerAffinity * islandAudienceFit)
      };
    });
    const predictedRating = clamp(average(components.map((component) => component.contribution)) * 2.25);
    const averageIslandRD = average(allTags.map((tag) => island.audienceFitRDByTag[tag] ?? 1));
    const averageIslandVolatility = average(allTags.map((tag) => island.audienceFitVolatilityByTag[tag] ?? 0.5));
    const averagePlayerRD = average(allTags.map((tag) => player.preferenceRDByTag[tag] ?? 1));
    const islandConfidence = confidenceFromRD(averageIslandRD) * volatilityPenalty(averageIslandVolatility);
    const playerPreferenceConfidence = confidenceFromRD(averagePlayerRD);
    const confidence = islandConfidence * playerPreferenceConfidence;

    return {
      islandId: island.id,
      predictedRating: round(predictedRating),
      confidence: round(confidence),
      averageIslandRD: round(averageIslandRD),
      averageIslandVolatility: round(averageIslandVolatility),
      averagePlayerRD: round(averagePlayerRD),
      playerPreferenceConfidence: round(playerPreferenceConfidence),
      islandConfidence: round(islandConfidence),
      scoutValue: round(scoutValueForPlayerIsland(player, island, allTags)),
      components
    };
  }
};
