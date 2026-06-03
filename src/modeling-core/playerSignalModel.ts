import type {
  LearningPressureTrace,
  ModelingCoreState,
  ModelingPrediction,
  PlayerSignalLearningTrace,
  RatingEvent,
  RatingEvidence,
  RdDelta,
  SignalAggregateDelta,
  TagDelta,
  TagId
} from './types.js';
import { average, clamp, round } from './math.js';
import { cloneModelingState, findPlayer } from './stateStore.js';

const SIGNAL_USEFULNESS_RATE = 0.11;
const SIGNAL_ALIGNMENT_RATE = 0.09;
const SIGNAL_RD_TIGHTEN_RATE = 0.1;
const SIGNAL_RD_LOOSEN_RATE = 0.045;
const SIGNAL_VOLATILITY_RATE = 0.12;
const AGGREGATE_SIGNAL_RATE = 0.18;

export interface PlayerSignalModelLayer {
  applySignalLearning(
    state: ModelingCoreState,
    event: RatingEvent,
    predictionBefore: ModelingPrediction,
    evidence: RatingEvidence,
    learningPressure: LearningPressureTrace
  ): { nextState: ModelingCoreState; signalTrace: PlayerSignalLearningTrace };
}

function buildTagDelta(tag: TagId, before: number, after: number): TagDelta {
  return { tag, before: round(before), after: round(after), delta: round(after - before) };
}

function buildRdDelta(tag: TagId, before: number, after: number): RdDelta {
  return { tag, before: round(before), after: round(after) };
}

function buildAggregateDelta(field: SignalAggregateDelta['field'], before: number, after: number): SignalAggregateDelta {
  return { field, before: round(before), after: round(after), delta: round(after - before) };
}

function tagsForSignalLearning(state: ModelingCoreState, event: RatingEvent): TagId[] {
  return event.focusTag ? [event.focusTag] : state.allTags.slice();
}

function componentForTag(prediction: ModelingPrediction, tag: TagId) {
  return prediction.components.find((component) => component.tag === tag) ?? null;
}

function nonTrainingTrace(event: RatingEvent, state: ModelingCoreState): PlayerSignalLearningTrace {
  return {
    trainingEligible: false,
    updateTags: tagsForSignalLearning(state, event),
    predictionError: null,
    normalizedSurprise: null,
    consistencyScore: null,
    signalLearningWeight: 0,
    usefulnessDeltas: [],
    alignmentDeltas: [],
    signalRDDeltas: [],
    signalVolatilityDeltas: [],
    aggregateDeltas: [],
    explanation: 'Neutral/meh ratings are stored as observations but do not train player signal-source usefulness, polarity, RD, or volatility.'
  };
}

export const laneLocalPlayerSignalModel: PlayerSignalModelLayer = {
  applySignalLearning(state, event, predictionBefore, evidence, learningPressure) {
    const nextState = cloneModelingState(state);
    const player = findPlayer(nextState, event.userId);

    if (!evidence.trainingEligible || event.rating === 0) {
      return { nextState, signalTrace: nonTrainingTrace(event, nextState) };
    }

    const updateTags = tagsForSignalLearning(nextState, event);
    const predictionError = event.rating - predictionBefore.predictedRating;
    const normalizedSurprise = clamp(Math.abs(predictionError) / 2, 0, 1);
    const consistencyScore = clamp(1 - normalizedSurprise, 0, 1);
    const surprisePenalty = consistencyScore < 0.45 ? 0.35 : 1;
    const signalLearningWeight = clamp(evidence.sourceAuthority * evidence.diagnosticContextWeight, 0, 1.25);
    const usefulnessDeltas: TagDelta[] = [];
    const alignmentDeltas: TagDelta[] = [];
    const signalRDDeltas: RdDelta[] = [];
    const signalVolatilityDeltas: RdDelta[] = [];

    for (const tag of updateTags) {
      const component = componentForTag(predictionBefore, tag);
      const playerAffinity = component?.playerAffinity ?? player.demonstratedAffinityByTag[tag] ?? 0;
      const islandAudienceFit = component?.islandAudienceFit ?? 0;
      const laneMagnitude = clamp(Math.max(Math.abs(playerAffinity), Math.abs(islandAudienceFit), 0.1), 0.1, 1);

      const usefulnessBefore = player.signalModel.signalUsefulnessByTag[tag] ?? player.signalModel.laneSignalByTag[tag] ?? player.signalModel.trustEstimate;
      const predictedDirection = Math.sign(predictionBefore.predictedRating);
      const actualDirection = Math.sign(event.rating);
      const directionAgreement = predictedDirection === 0 || predictedDirection === actualDirection;
      const usefulnessTarget = directionAgreement
        ? clamp(0.85 + 0.15 * consistencyScore, 0, 1)
        : consistencyScore;
      const usefulnessDelta = (usefulnessTarget - usefulnessBefore)
        * SIGNAL_USEFULNESS_RATE
        * laneMagnitude
        * signalLearningWeight
        * surprisePenalty;
      const usefulnessAfter = clamp(usefulnessBefore + usefulnessDelta, 0, 1);
      player.signalModel.signalUsefulnessByTag[tag] = usefulnessAfter;
      player.signalModel.laneSignalByTag[tag] = usefulnessAfter;
      usefulnessDeltas.push(buildTagDelta(tag, usefulnessBefore, usefulnessAfter));

      const alignmentBefore = player.signalModel.signalAlignmentByTag[tag] ?? 0;
      const alignmentTarget = Math.abs(playerAffinity) >= 0.05
        ? Math.sign(playerAffinity)
        : Math.sign(event.rating * (islandAudienceFit || 1));
      const alignmentDelta = (alignmentTarget - alignmentBefore)
        * SIGNAL_ALIGNMENT_RATE
        * laneMagnitude
        * signalLearningWeight
        * consistencyScore;
      const alignmentAfter = clamp(alignmentBefore + alignmentDelta, -1, 1);
      player.signalModel.signalAlignmentByTag[tag] = alignmentAfter;
      alignmentDeltas.push(buildTagDelta(tag, alignmentBefore, alignmentAfter));

      const rdBefore = player.signalModel.signalRDByTag[tag] ?? player.signalModel.trustRD;
      const rdTighten = consistencyScore * laneMagnitude * signalLearningWeight * SIGNAL_RD_TIGHTEN_RATE;
      const rdLoosen = Math.max(0, normalizedSurprise - 0.5) * SIGNAL_RD_LOOSEN_RATE;
      const rdAfter = clamp(rdBefore * (1 - Math.min(0.16, rdTighten)) + rdLoosen, 0.05, 1);
      player.signalModel.signalRDByTag[tag] = rdAfter;
      signalRDDeltas.push(buildRdDelta(tag, rdBefore, rdAfter));

      const volatilityBefore = player.signalModel.signalVolatilityByTag[tag] ?? player.signalModel.signalVolatility;
      const conflictPressure = learningPressure.confidenceConflict ?? 0;
      const volatilityAfter = clamp(
        volatilityBefore
          + normalizedSurprise * conflictPressure * SIGNAL_VOLATILITY_RATE * laneMagnitude
          + Math.max(0, 0.35 - consistencyScore) * 0.015,
        0,
        1
      );
      player.signalModel.signalVolatilityByTag[tag] = volatilityAfter;
      signalVolatilityDeltas.push(buildRdDelta(tag, volatilityBefore, volatilityAfter));
    }

    const aggregateBefore = {
      trustEstimate: player.signalModel.trustEstimate,
      trustRD: player.signalModel.trustRD,
      signalVolatility: player.signalModel.signalVolatility
    };
    const averageUsefulnessDelta = average(usefulnessDeltas.map((delta) => delta.delta));
    const averageRDDelta = average(signalRDDeltas.map((delta) => delta.after - delta.before));
    const averageVolatilityDelta = average(signalVolatilityDeltas.map((delta) => delta.after - delta.before));

    player.signalModel.trustEstimate = clamp(
      player.signalModel.trustEstimate + averageUsefulnessDelta * AGGREGATE_SIGNAL_RATE,
      0,
      1
    );
    player.signalModel.trustRD = clamp(
      player.signalModel.trustRD + averageRDDelta * AGGREGATE_SIGNAL_RATE,
      0.05,
      1
    );
    player.signalModel.signalVolatility = clamp(
      player.signalModel.signalVolatility + averageVolatilityDelta * AGGREGATE_SIGNAL_RATE,
      0,
      1
    );

    const aggregateDeltas = [
      buildAggregateDelta('trustEstimate', aggregateBefore.trustEstimate, player.signalModel.trustEstimate),
      buildAggregateDelta('trustRD', aggregateBefore.trustRD, player.signalModel.trustRD),
      buildAggregateDelta('signalVolatility', aggregateBefore.signalVolatility, player.signalModel.signalVolatility)
    ];

    return {
      nextState,
      signalTrace: {
        trainingEligible: true,
        updateTags,
        predictionError: round(predictionError),
        normalizedSurprise: round(normalizedSurprise),
        consistencyScore: round(consistencyScore),
        signalLearningWeight: round(signalLearningWeight),
        usefulnessDeltas,
        alignmentDeltas,
        signalRDDeltas,
        signalVolatilityDeltas,
        aggregateDeltas,
        explanation: 'Signal-source learning is lane-local: predictable ratings increase usefulness and tighten signal RD; surprising ratings increase signal volatility before sharply reducing scout value; stable inverse raters remain useful with negative alignment.'
      }
    };
  }
};
