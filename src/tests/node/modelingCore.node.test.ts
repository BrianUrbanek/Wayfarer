import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runModelingFixture } from '../../modeling-core/index.js';
import { blendedSignalStrengthModel } from '../../modeling-core/signalStrengthModel.js';

function deltaForTag<T extends { tag: string }>(entries: T[] | undefined, tag: string): T | undefined {
  return entries?.find((entry) => entry.tag === tag);
}

describe('modeling core harness', () => {
  it('produces a deterministic trace from the new prediction/update spine', () => {
    const first = runModelingFixture('basic');
    const second = runModelingFixture('basic');

    assert.deepEqual(second, first);
    assert.equal(first.fixtureId, 'basic');
    assert.equal(first.steps.length, 1);
    assert.equal(first.steps[0]?.rawRating.id, 'fixture-0:event-0');
    assert.equal(first.steps[0]?.ratingEvidence.trainingEligible, true);
    assert.equal(first.steps[0]?.ratingEvidence.focusMeaning, 'expectationFulfillment');
    assert.equal(first.steps[0]?.predictionBefore.islandId, 'island-skill-arena');
    assert.equal(Boolean(first.fixtureOracle?.hiddenPlayers['player-skill-scout']), true);
    assert.equal(Array.isArray(first.steps[0]?.recommendationFacingState), true);
  });

  it('stores meh ratings without training shared fit or confidence', () => {
    const trace = runModelingFixture('meh-observed');
    const step = trace.steps[0];

    assert.equal(trace.fixtureId, 'meh-observed');
    assert.equal(step?.rawRating.rating, 0);
    assert.equal(step?.ratingEvidence.trainingEligible, false);
    assert.equal(step?.ratingEvidence.signalStrength, 0);
    assert.equal(step?.deferredEvidence?.supported, true);
    assert.equal(step?.predictionError, null);
    assert.equal(step?.islandUpdate?.learningPressure.estimateUpdateMultiplier, 0);
    assert.equal(step?.islandUpdate?.audienceFitDeltas.length, 0);
    assert.equal(step?.islandUpdate?.islandRDDeltas.length, 0);
    assert.equal(step?.islandUpdate?.rawObservationDelta.neutralCount, 1);
  });

  it('treats focused negative ratings as island promise-fulfillment evidence before player dislike evidence', () => {
    const trace = runModelingFixture('focused-negative');
    const step = trace.steps[0];
    const audienceDelta = deltaForTag(step?.islandUpdate?.audienceFitDeltas, 'skill-based');
    const playerDelta = deltaForTag(step?.islandUpdate?.demonstratedAffinityDeltas, 'skill-based');

    assert.equal(step?.ratingEvidence.focusTag, 'skill-based');
    assert.equal(step?.ratingEvidence.trainingEligible, true);
    assert.equal(step?.updateAllocation !== null && step.updateAllocation.islandUpdateShare > step.updateAllocation.playerUpdateShare, true);
    assert.equal(Boolean(audienceDelta && audienceDelta.delta < 0), true);
    assert.equal(Boolean(playerDelta && Math.abs(playerDelta.delta) < Math.abs(audienceDelta?.delta ?? 0)), true);
  });

  it('uses stable negative affinity as useful inverse signal', () => {
    const trace = runModelingFixture('stable-negative-affinity');
    const step = trace.steps[0];
    const islandBrainRotDelta = deltaForTag(step?.islandUpdate?.audienceFitDeltas, 'brain-rot');
    const playerBrainRotDelta = deltaForTag(step?.islandUpdate?.demonstratedAffinityDeltas, 'brain-rot');

    assert.equal(step?.rawRating.rating, -1);
    assert.equal(step?.ratingEvidence.focusTag, 'brain-rot');
    assert.equal(Boolean(islandBrainRotDelta && islandBrainRotDelta.delta > 0), true);
    assert.equal(Boolean(playerBrainRotDelta && playerBrainRotDelta.delta < 0), true);
  });

  it('moves the more uncertain player more when island fit is confident', () => {
    const trace = runModelingFixture('confident-island-vs-uncertain-player');
    const step = trace.steps[0];
    const playerSkillDelta = deltaForTag(step?.islandUpdate?.demonstratedAffinityDeltas, 'skill-based');
    const islandSkillDelta = deltaForTag(step?.islandUpdate?.audienceFitDeltas, 'skill-based');

    assert.equal(step?.updateAllocation !== null && step.updateAllocation.playerUpdateShare > step.updateAllocation.islandUpdateShare, true);
    assert.equal(Boolean(playerSkillDelta && islandSkillDelta && Math.abs(playerSkillDelta.delta) > Math.abs(islandSkillDelta.delta)), true);
  });

  it('moves the more uncertain island more when player preference is confident', () => {
    const trace = runModelingFixture('uncertain-island-vs-confident-player');
    const step = trace.steps[0];
    const playerSkillDelta = deltaForTag(step?.islandUpdate?.demonstratedAffinityDeltas, 'skill-based');
    const islandSkillDelta = deltaForTag(step?.islandUpdate?.audienceFitDeltas, 'skill-based');

    assert.equal(step?.updateAllocation !== null && step.updateAllocation.islandUpdateShare > step.updateAllocation.playerUpdateShare, true);
    assert.equal(Boolean(playerSkillDelta && islandSkillDelta && Math.abs(islandSkillDelta.delta) > Math.abs(playerSkillDelta.delta)), true);
  });

  it('dampens estimate movement and raises volatility when both confident sides contradict each other', () => {
    const trace = runModelingFixture('both-confident-contradiction');
    const step = trace.steps[0];
    const islandSkillDelta = deltaForTag(step?.islandUpdate?.audienceFitDeltas, 'skill-based');
    const islandVolatilityDelta = deltaForTag(step?.islandUpdate?.islandVolatilityDeltas, 'skill-based');

    const learningPressure = step?.islandUpdate?.learningPressure;

    assert.equal(learningPressure?.contradictionDampened, true);
    assert.equal(Boolean(learningPressure && learningPressure.estimateUpdateMultiplier > 0 && learningPressure.estimateUpdateMultiplier < 1), true);
    assert.equal(Boolean(learningPressure && learningPressure.confidenceConflict !== null && learningPressure.confidenceConflict > 0), true);
    assert.equal(Boolean(learningPressure && learningPressure.volatilityPressure > 0), true);
    assert.equal(Boolean(islandSkillDelta && Math.abs(islandSkillDelta.delta) < 0.08), true);
    assert.equal(Boolean(islandVolatilityDelta && islandVolatilityDelta.after > islandVolatilityDelta.before), true);
  });

  it('supports multi-event hidden-truth fixtures without exposing hidden truth to model state', () => {
    const trace = runModelingFixture('declared-vs-demonstrated-mismatch');
    const finalPlayer = trace.finalState.players.find((player) => player.id === 'player-declared-skill-hidden-cozy');

    assert.equal(trace.steps.length, 3);
    assert.equal(Boolean(trace.fixtureOracle?.hiddenPlayers['player-declared-skill-hidden-cozy']), true);
    assert.equal(finalPlayer?.declaredAffinityByTag['skill-based'], 0.9);
    assert.equal(finalPlayer?.demonstratedAffinityByTag.cozy !== undefined && finalPlayer.demonstratedAffinityByTag.cozy > 0.25, true);
    assert.equal(finalPlayer?.demonstratedAffinityByTag.social !== undefined && finalPlayer.demonstratedAffinityByTag.social > 0.22, true);
  });
  it('exposes uncertainty trace fields used to explain update pressure', () => {
    const trace = runModelingFixture('both-confident-contradiction');
    const pressure = trace.steps[0]?.islandUpdate?.learningPressure;

    assert.equal(pressure?.uncertaintyInputs.playerAverageRD, 0.12);
    assert.equal(pressure?.uncertaintyInputs.islandAverageRD, 0.12);
    assert.equal(pressure?.updateReason.primaryReason, 'focusedExpectationFailure');
    assert.equal(typeof pressure?.updateReason.explanation, 'string');
  });

  it('monotonically allocates more player movement as player RD rises', () => {
    const low = runModelingFixture('pressure-player-rd-low').steps[0];
    const high = runModelingFixture('pressure-player-rd-high').steps[0];
    const lowPlayerDelta = Math.abs(deltaForTag(low?.islandUpdate?.demonstratedAffinityDeltas, 'skill-based')?.delta ?? 0);
    const highPlayerDelta = Math.abs(deltaForTag(high?.islandUpdate?.demonstratedAffinityDeltas, 'skill-based')?.delta ?? 0);

    assert.equal(Boolean(low?.updateAllocation && high?.updateAllocation && high.updateAllocation.playerUpdateShare > low.updateAllocation.playerUpdateShare), true);
    assert.equal(highPlayerDelta > lowPlayerDelta, true);
  });

  it('monotonically allocates more island movement as island RD rises', () => {
    const low = runModelingFixture('pressure-island-rd-low').steps[0];
    const high = runModelingFixture('pressure-island-rd-high').steps[0];
    const lowIslandDelta = Math.abs(deltaForTag(low?.islandUpdate?.audienceFitDeltas, 'skill-based')?.delta ?? 0);
    const highIslandDelta = Math.abs(deltaForTag(high?.islandUpdate?.audienceFitDeltas, 'skill-based')?.delta ?? 0);

    assert.equal(Boolean(low?.updateAllocation && high?.updateAllocation && high.updateAllocation.islandUpdateShare > low.updateAllocation.islandUpdateShare), true);
    assert.equal(highIslandDelta > lowIslandDelta, true);
  });

  it('monotonically dampens estimate movement and raises volatility pressure as surprise grows', () => {
    const mild = runModelingFixture('pressure-surprise-mild').steps[0]?.islandUpdate?.learningPressure;
    const extreme = runModelingFixture('pressure-surprise-extreme').steps[0]?.islandUpdate?.learningPressure;

    assert.equal(Boolean(mild && extreme && (extreme.normalizedSurprise ?? 0) > (mild.normalizedSurprise ?? 0)), true);
    assert.equal(Boolean(mild && extreme && (extreme.confidenceConflict ?? 0) > (mild.confidenceConflict ?? 0)), true);
    assert.equal(Boolean(mild && extreme && extreme.estimateUpdateMultiplier < mild.estimateUpdateMultiplier), true);
    assert.equal(Boolean(mild && extreme && extreme.volatilityPressure > mild.volatilityPressure), true);
  });

  it('monotonically increases update magnitude and volatility pressure as signal strength rises', () => {
    const low = runModelingFixture('pressure-signal-low').steps[0];
    const high = runModelingFixture('pressure-signal-high').steps[0];
    const lowIslandDelta = Math.abs(deltaForTag(low?.islandUpdate?.audienceFitDeltas, 'skill-based')?.delta ?? 0);
    const highIslandDelta = Math.abs(deltaForTag(high?.islandUpdate?.audienceFitDeltas, 'skill-based')?.delta ?? 0);
    const lowPressure = low?.islandUpdate?.learningPressure;
    const highPressure = high?.islandUpdate?.learningPressure;

    assert.equal(high.ratingEvidence.signalStrength > low.ratingEvidence.signalStrength, true);
    assert.equal(highIslandDelta > lowIslandDelta, true);
    assert.equal(Boolean(lowPressure && highPressure && highPressure.volatilityPressure > lowPressure.volatilityPressure), true);
  });


  it('reports multivariate update reasons with normalized factor magnitudes', () => {
    const trace = runModelingFixture('both-confident-contradiction');
    const reason = trace.steps[0]?.islandUpdate?.learningPressure.updateReason;
    const factors = reason?.factors ?? [];
    const totalNormalizedMagnitude = factors.reduce((sum, factor) => sum + factor.normalizedMagnitude, 0);
    const dominantFactor = factors[0];

    assert.equal(factors.length > 1, true);
    assert.equal(Math.abs(totalNormalizedMagnitude - 1) < 0.001, true);
    assert.equal(reason?.primaryReason, dominantFactor?.reason);
    assert.equal(Boolean(factors.find((factor) => factor.reason === 'focusedExpectationFailure')), true);
    assert.equal(Boolean(factors.find((factor) => factor.reason === 'confidenceConflict')), true);
    assert.equal(Boolean(dominantFactor && factors.every((factor) => dominantFactor.normalizedMagnitude >= factor.normalizedMagnitude)), true);
  });


  it('does not train player signal-source state from meh ratings', () => {
    const trace = runModelingFixture('meh-observed');
    const signalTrace = trace.steps[0]?.playerSignalUpdate.trace;

    assert.equal(signalTrace?.trainingEligible, false);
    assert.equal(signalTrace?.usefulnessDeltas.length, 0);
    assert.equal(signalTrace?.alignmentDeltas.length, 0);
    assert.equal(signalTrace?.signalRDDeltas.length, 0);
    assert.equal(signalTrace?.signalVolatilityDeltas.length, 0);
  });

  it('tightens lane-local signal confidence for predictable aligned scout evidence', () => {
    const trace = runModelingFixture('basic');
    const signalTrace = trace.steps[0]?.playerSignalUpdate.trace;
    const usefulnessDelta = deltaForTag(signalTrace?.usefulnessDeltas, 'skill-based');
    const rdDelta = deltaForTag(signalTrace?.signalRDDeltas, 'skill-based');
    const alignmentDelta = deltaForTag(signalTrace?.alignmentDeltas, 'skill-based');

    assert.equal(signalTrace?.trainingEligible, true);
    assert.equal(Boolean(usefulnessDelta && usefulnessDelta.delta > 0), true);
    assert.equal(Boolean(rdDelta && rdDelta.after < rdDelta.before), true);
    assert.equal(Boolean(alignmentDelta && alignmentDelta.after > alignmentDelta.before), true);
  });

  it('learns stable inverse raters as useful negative-polarity signal sources', () => {
    const trace = runModelingFixture('stable-negative-affinity');
    const signalTrace = trace.steps[0]?.playerSignalUpdate.trace;
    const usefulnessDelta = deltaForTag(signalTrace?.usefulnessDeltas, 'brain-rot');
    const alignmentDelta = deltaForTag(signalTrace?.alignmentDeltas, 'brain-rot');
    const rdDelta = deltaForTag(signalTrace?.signalRDDeltas, 'brain-rot');

    assert.equal(Boolean(usefulnessDelta && usefulnessDelta.delta > 0), true);
    assert.equal(Boolean(alignmentDelta && alignmentDelta.after < alignmentDelta.before), true);
    assert.equal(Boolean(rdDelta && rdDelta.after < rdDelta.before), true);
  });

  it('routes surprising scout contradictions into signal volatility before hard trust collapse', () => {
    const trace = runModelingFixture('focused-negative');
    const signalTrace = trace.steps[0]?.playerSignalUpdate.trace;
    const usefulnessDelta = deltaForTag(signalTrace?.usefulnessDeltas, 'skill-based');
    const volatilityDelta = deltaForTag(signalTrace?.signalVolatilityDeltas, 'skill-based');
    const aggregateTrustDelta = signalTrace?.aggregateDeltas.find((delta) => delta.field === 'trustEstimate');

    assert.equal(Boolean(signalTrace && (signalTrace.normalizedSurprise ?? 0) > 0.5), true);
    assert.equal(Boolean(volatilityDelta && volatilityDelta.after > volatilityDelta.before), true);
    assert.equal(Boolean(usefulnessDelta && usefulnessDelta.delta < 0), true);
    assert.equal(Boolean(aggregateTrustDelta && Math.abs(aggregateTrustDelta.delta) < 0.01), true);
  });


  it('constructs rating evidence from lane-local signal usefulness, polarity, RD, and volatility', () => {
    const basic = runModelingFixture('basic').steps[0];
    const inverse = runModelingFixture('stable-negative-affinity').steps[0];

    assert.equal(basic?.ratingEvidence.laneSignalUsefulness, 0.92);
    assert.equal(basic?.ratingEvidence.laneSignalPolarity, 0.8);
    assert.equal(Boolean(basic && basic.ratingEvidence.laneSignalConfidence < 1), true);
    assert.equal(Boolean(basic && basic.ratingEvidence.signalStrength > 0), true);

    assert.equal(Boolean(inverse && inverse.ratingEvidence.laneSignalPolarity < 0), true);
    assert.equal(Boolean(inverse && inverse.ratingEvidence.laneAlignment > 0), true);
    assert.equal(Boolean(inverse && inverse.ratingEvidence.signalStrength > 0), true);
  });

  it('uses player-side preference confidence and scout value in recommendation-facing predictions', () => {
    const step = runModelingFixture('basic').steps[0];
    const recommendation = step?.recommendationFacingState[0];

    assert.equal(Boolean(recommendation && recommendation.averagePlayerRD > 0), true);
    assert.equal(Boolean(recommendation && recommendation.playerPreferenceConfidence > 0), true);
    assert.equal(Boolean(recommendation && recommendation.islandConfidence > 0), true);
    assert.equal(Boolean(recommendation && recommendation.confidence <= recommendation.islandConfidence), true);
    assert.equal(Boolean(recommendation && recommendation.scoutValue >= 0), true);
    assert.equal(Boolean(recommendation && typeof recommendation.routingScore === 'number'), true);
  });


  it('groups signal-strength inputs into replaceable category calculations instead of over-multiplying raw factors', () => {
    const calculation = blendedSignalStrengthModel.calculateSignalStrength({
      trustEstimate: 0.5,
      aggregateTrustConfidence: 0.5,
      aggregateTrustStability: 0.5,
      sourceAuthority: 1,
      laneSignalUsefulness: 0.5,
      laneSignalConfidence: 0.5,
      laneSignalStability: 0.5,
      lanePolarityClarity: 0.5,
      source: 'organic'
    });

    assert.equal(calculation.baseSignal, 0.5);
    assert.equal(calculation.confidence, 0.675);
    assert.equal(calculation.stability, 0.75);
    assert.equal(calculation.polarityClarityMultiplier, 0.8);
    assert.equal(calculation.contextMultiplier, 1);
    assert.equal(calculation.signalStrength > 0.15, true);
    assert.equal(calculation.signalStrength < 0.3, true);
  });

  it('reports grouped signal-strength category values in rating evidence traces', () => {
    const evidence = runModelingFixture('basic').steps[0]?.ratingEvidence;

    assert.equal(Boolean(evidence && evidence.signalBaseStrength > 0), true);
    assert.equal(Boolean(evidence && evidence.signalConfidenceMultiplier > 0), true);
    assert.equal(Boolean(evidence && evidence.signalStabilityMultiplier > 0), true);
    assert.equal(Boolean(evidence && evidence.signalPolarityClarityMultiplier > 0), true);
    assert.equal(Boolean(evidence && evidence.signalContextMultiplier > 0), true);
  });


  it('classifies routing-safe-fit as a safe fit with multivariate routing trace', () => {
    const recommendation = runModelingFixture('routing-safe-fit').steps[0]?.recommendationFacingState[0];

    assert.equal(recommendation?.kind, 'SAFE_FIT');
    assert.equal(recommendation?.routingTrace.primaryReason, 'safeFit');
    assert.equal(Boolean(recommendation && recommendation.routingTrace.safeFitScore > recommendation.routingTrace.smartGambleScore), true);
    assert.equal(Boolean(recommendation && recommendation.routingTrace.factors.length > 1), true);
  });

  it('classifies routing-smart-gamble as positive fit with insufficient safe-fit certainty', () => {
    const recommendation = runModelingFixture('routing-smart-gamble').steps[0]?.recommendationFacingState[0];

    assert.equal(recommendation?.kind, 'SMART_GAMBLE');
    assert.equal(recommendation?.routingTrace.primaryReason, 'smartGamble');
    assert.equal(Boolean(recommendation && recommendation.routingTrace.predictedFit > 0), true);
    assert.equal(Boolean(recommendation && recommendation.routingTrace.smartGambleScore > recommendation.routingTrace.safeFitScore), true);
  });

  it('classifies routing-discovery-probe as information-rich exploration', () => {
    const recommendation = runModelingFixture('routing-discovery-probe').steps[0]?.recommendationFacingState[0];

    assert.equal(recommendation?.kind, 'DISCOVERY_PROBE');
    assert.equal(recommendation?.routingTrace.primaryReason, 'discoveryProbe');
    assert.equal(Boolean(recommendation && recommendation.routingTrace.explorationValue > 0.5), true);
    assert.equal(Boolean(recommendation && recommendation.routingTrace.discoveryProbeScore > recommendation.routingTrace.smartGambleScore), true);
  });

  it('classifies routing-avoid-negative as suppress-or-avoid', () => {
    const recommendation = runModelingFixture('routing-avoid-negative').steps[0]?.recommendationFacingState[0];

    assert.equal(recommendation?.kind, 'SUPPRESS_OR_AVOID');
    assert.equal(recommendation?.routingTrace.primaryReason, 'suppressOrAvoid');
    assert.equal(Boolean(recommendation && recommendation.routingTrace.negativeFit > 0.8), true);
    assert.equal(Boolean(recommendation && recommendation.routingTrace.suppressOrAvoidScore > recommendation.routingTrace.discoveryProbeScore), true);
  });

  it('keeps volatile-positive candidates out of the safe-fit band', () => {
    const recommendation = runModelingFixture('routing-volatile-positive').steps[0]?.recommendationFacingState[0];

    assert.notEqual(recommendation?.kind, 'SAFE_FIT');
    assert.equal(Boolean(recommendation && recommendation.routingTrace.predictedFit > 0), true);
    assert.equal(Boolean(recommendation && recommendation.routingTrace.volatilityMultiplier < 0.7), true);
  });

  it('routes declared-vs-demonstrated mismatch through guided discovery', () => {
    const recommendation = runModelingFixture('routing-guided-mismatch').steps[0]?.recommendationFacingState[0];

    assert.equal(recommendation?.kind, 'GUIDED_DISCOVERY');
    assert.equal(recommendation?.routingTrace.primaryReason, 'guidedDiscovery');
    assert.equal(Boolean(recommendation && recommendation.routingTrace.declaredDemonstratedGap > 1), true);
  });

  it('normalizes routing reason factors and reports the dominant routing reason', () => {
    const recommendation = runModelingFixture('routing-discovery-probe').steps[0]?.recommendationFacingState[0];
    const factors = recommendation?.routingTrace.factors ?? [];
    const totalNormalizedMagnitude = factors.reduce((sum, factor) => sum + factor.normalizedMagnitude, 0);
    const dominantFactor = factors[0];

    assert.equal(factors.length > 1, true);
    assert.equal(Math.abs(totalNormalizedMagnitude - 1) < 0.001, true);
    assert.equal(recommendation?.routingTrace.primaryReason, dominantFactor?.reason);
    assert.equal(Boolean(dominantFactor && factors.every((factor) => dominantFactor.normalizedMagnitude >= factor.normalizedMagnitude)), true);
  });


  it('records rating events through an auditable ledger and evidence projection', () => {
    const step = runModelingFixture('basic').steps[0];

    assert.equal(step?.ratingLedgerEntry.eventId, 'fixture-0:event-0');
    assert.equal(step?.ratingLedgerEntry.reason, 'initialRating');
    assert.equal(step?.ratingEvidenceProjection.ledgerEntryId, step?.ratingLedgerEntry.entryId);
    assert.equal(step?.ratingEvidenceProjection.contributesToIslandEstimate, true);
    assert.equal(step?.activeRatingLedgerEntryIdsForIsland.includes(step.ratingLedgerEntry.entryId), true);
    assert.equal(step?.updatedModelState.ratingLedger.length, 1);
    assert.equal(step?.updatedModelState.evidenceProjections.length, 1);
  });

  it('keeps rating history append-only while superseded ratings stop contributing as active evidence', () => {
    const trace = runModelingFixture('rating-revision-supersedes');
    const firstStep = trace.steps[0];
    const secondStep = trace.steps[1];
    const finalProjectionByLedgerId = new Map(trace.finalState.evidenceProjections.map((projection) => [projection.ledgerEntryId, projection]));
    const firstProjection = firstStep ? finalProjectionByLedgerId.get(firstStep.ratingLedgerEntry.entryId) : undefined;
    const secondProjection = secondStep ? finalProjectionByLedgerId.get(secondStep.ratingLedgerEntry.entryId) : undefined;

    assert.equal(trace.finalState.ratingLedger.length, 2);
    assert.equal(secondStep?.ratingLedgerEntry.supersedesEntryId, firstStep?.ratingLedgerEntry.entryId);
    assert.equal(firstProjection?.supersededByPlayer, true);
    assert.equal(firstProjection?.contributesToIslandEstimate, false);
    assert.equal(secondProjection?.supersededByPlayer, false);
    assert.equal(secondProjection?.contributesToIslandEstimate, true);
    assert.deepEqual(secondStep?.activeRatingLedgerEntryIdsForIsland, [secondStep?.ratingLedgerEntry.entryId]);
  });

  it('marks touched projections dirty so later trust/proxy changes can trigger replay instead of hidden mutation', () => {
    const trace = runModelingFixture('rating-revision-supersedes');
    const dirtyReasons = trace.finalState.dirtyProjections.map((record) => record.reason);

    assert.equal(dirtyReasons.includes('ratingEvidenceProjected'), true);
    assert.equal(dirtyReasons.includes('ratingSupersededByPlayer'), true);
    assert.equal(Boolean(trace.finalState.dirtyProjections.find((record) => record.targetType === 'island')), true);
    assert.equal(Boolean(trace.finalState.dirtyProjections.find((record) => record.targetType === 'player')), true);
  });


  it('establishes a silent seed proxy after exact overlap with a cohort seed', () => {
    const trace = runModelingFixture('bob-becomes-alice-proxy');
    const establishingStep = trace.steps.find((step) => step.sourceAuthorityUpdates.length > 0);
    const bob = trace.finalState.players.find((player) => player.id === 'new-bob');
    const proxy = bob?.signalModel.seedProxyByTag?.['skill-based']?.[0];

    assert.equal(trace.steps.length, 21);
    assert.equal(establishingStep?.rawRating.id, 'bob-proxy:event-20');
    assert.equal(establishingStep?.sourceAuthorityUpdates[0]?.sourceClass, 'seedProxy');
    assert.equal(establishingStep?.sourceAuthorityUpdates[0]?.authorityBasis, 'learnedSimilarityToSeed');
    assert.equal(establishingStep?.sourceAuthorityUpdates[0]?.seedPlayerId, 'seed-alice');
    assert.equal(establishingStep?.sourceAuthorityUpdates[0]?.matchedRatings, 15);
    assert.equal(establishingStep?.sourceAuthorityUpdates[0]?.contradictions, 0);
    assert.equal(proxy?.seedPlayerId, 'seed-alice');
    assert.equal(proxy?.matchedRatings, 15);
    assert.equal(proxy?.similarity, 1);
  });

  it('retroactively reprojects Bob-only ratings as Alice-proxy evidence without mutating ledger history', () => {
    const trace = runModelingFixture('bob-becomes-alice-proxy');
    const establishingStep = trace.steps.find((step) => step.sourceAuthorityUpdates.length > 0);
    const bobOnlyProjection = trace.finalState.evidenceProjections.find((projection) => projection.ledgerEntryId === 'bob-proxy:event-1:ledger');
    const bobOnlyLedgerEntry = trace.finalState.ratingLedger.find((entry) => entry.entryId === 'bob-proxy:event-1:ledger');
    const postProxyStep = trace.steps.find((step) => step.rawRating.id === 'bob-proxy:event-21');
    const bobOnlyRetroTrace = postProxyStep?.retroactiveProjectionUpdates.find((entry) => entry.ledgerEntryId === 'bob-proxy:event-1:ledger');
    const dirtyReasons = trace.finalState.dirtyProjections.map((record) => record.reason);

    assert.equal(bobOnlyLedgerEntry?.playerId, 'new-bob');
    assert.equal(bobOnlyLedgerEntry?.islandId, 'bob-only-island-1');
    assert.equal(bobOnlyLedgerEntry?.rating, 1);
    assert.equal(bobOnlyProjection?.sourceClass, 'seedProxy');
    assert.equal(bobOnlyProjection?.authorityBasis, 'learnedSimilarityToSeed');
    assert.equal(bobOnlyProjection?.proxyForSeedIds.includes('seed-alice'), true);
    assert.equal(establishingStep?.retroactiveProjectionUpdates.length, 0);
    assert.equal(Boolean(bobOnlyRetroTrace && bobOnlyRetroTrace.signalStrengthAfter > bobOnlyRetroTrace.signalStrengthBefore), true);
    assert.equal(dirtyReasons.includes('seedProxyReprojected'), true);
    assert.equal(dirtyReasons.includes('seedProxyEstablished'), true);
  });


  it('records snapshot-isolated turn metadata on rating and projection traces', () => {
    const step = runModelingFixture('routing-safe-fit').steps[0];

    assert.equal(step?.turnTrace.turn, 1);
    assert.equal(step?.turnTrace.readModelStateTurn, 0);
    assert.equal(step?.turnTrace.writeModelStateTurn, 1);
    assert.equal(step?.turnTrace.capturePhase, 'guidedDiscoveryCapture');
    assert.equal(step?.turnTrace.updatePhase, 'atomicModelUpdate');
    assert.equal(step?.turnTrace.snapshotIsolation, true);
    assert.equal(step?.ratingEvidenceProjection.eventTurn, 1);
    assert.equal(step?.ratingEvidenceProjection.projectedTurn, 1);
    assert.equal(step?.ratingEvidenceProjection.readModelStateTurn, 0);
  });

  it('does not use same-turn seed-proxy authority for retroactive reprojection', () => {
    const trace = runModelingFixture('bob-becomes-alice-proxy');
    const establishingStep = trace.steps.find((step) => step.sourceAuthorityUpdates.length > 0);
    const nextTurnStep = trace.steps.find((step) => step.rawRating.id === 'bob-proxy:event-21');

    assert.equal(establishingStep?.rawRating.turn, 20);
    assert.equal(establishingStep?.sourceAuthorityUpdates[0]?.establishedTurn, 20);
    assert.equal(establishingStep?.retroactiveProjectionUpdates.length, 0);
    assert.equal(nextTurnStep?.rawRating.turn, 21);
    assert.equal(Boolean(nextTurnStep && nextTurnStep.retroactiveProjectionUpdates.length > 0), true);
    assert.equal(nextTurnStep?.retroactiveProjectionUpdates[0]?.calculatedAtTurn, 21);
  });

  it('does not establish seed proxy authority when overlap is below threshold', () => {
    const trace = runModelingFixture('seed-proxy-insufficient-overlap');
    const bob = trace.finalState.players.find((player) => player.id === 'seed-proxy-insufficient-overlap:new-bob');
    const proxyEntries = bob?.signalModel.seedProxyByTag?.['skill-based'] ?? [];

    assert.equal(proxyEntries.length, 0);
    assert.equal(trace.steps.some((step) => step.sourceAuthorityUpdates.length > 0), false);
    assert.equal(trace.finalState.evidenceProjections.some((projection) => projection.sourceClass === 'seedProxy'), false);
  });

  it('does not establish seed proxy authority when overlap contains contradictions', () => {
    const trace = runModelingFixture('seed-proxy-contradiction-control');
    const bob = trace.finalState.players.find((player) => player.id === 'seed-proxy-contradiction-control:new-bob');
    const proxyEntries = bob?.signalModel.seedProxyByTag?.['skill-based'] ?? [];

    assert.equal(proxyEntries.length, 0);
    assert.equal(trace.steps.some((step) => step.sourceAuthorityUpdates.length > 0), false);
    assert.equal(trace.finalState.evidenceProjections.some((projection) => projection.sourceClass === 'seedProxy'), false);
  });

  it('keeps seed-proxy authority lane-local during retroactive reprojection', () => {
    const trace = runModelingFixture('seed-proxy-lane-local-control');
    const bob = trace.finalState.players.find((player) => player.id === 'seed-proxy-lane-local-control:new-bob');
    const skillProxy = bob?.signalModel.seedProxyByTag?.['skill-based']?.[0];
    const wrongLaneProjection = trace.finalState.evidenceProjections.find((projection) => projection.ledgerEntryId === 'seed-proxy-lane-local-control:bob-proxy:event-1:ledger');
    const skillProjection = trace.finalState.evidenceProjections.find((projection) => projection.ledgerEntryId === 'seed-proxy-lane-local-control:bob-proxy:event-2:ledger');

    assert.equal(skillProxy?.tag, 'skill-based');
    assert.notEqual(wrongLaneProjection?.sourceClass, 'seedProxy');
    assert.equal(skillProjection?.sourceClass, 'seedProxy');
  });



  it('generates Bob ratings from durable hidden archetype injections instead of forced vote outcomes', () => {
    const trace = runModelingFixture('proxy-discovers-seed-positive-unrated-island');
    const firstStep = trace.steps[0];
    const bobTruth = trace.fixtureOracle?.hiddenPlayers['scenario-bob'];
    const aliceUnratedIsland = trace.fixtureOracle?.hiddenIslands['scenario-alice-positive-unrated'];
    const aliceLedgerOnUnratedIsland = trace.finalState.ratingLedger.filter((entry) => entry.playerId === 'scenario-alice' && entry.islandId === 'scenario-alice-positive-unrated');

    assert.equal(bobTruth?.behaviorArchetype, 'seedLike');
    assert.equal(bobTruth?.seedReferenceId, 'scenario-alice');
    assert.equal(firstStep?.rawRating.userId, 'scenario-bob');
    assert.equal(firstStep?.rawRating.islandId, 'scenario-alice-positive-unrated');
    assert.equal(firstStep?.rawRating.rating, 1);
    assert.equal(aliceUnratedIsland?.truthClass, 'seedPositiveUnrated');
    assert.equal(aliceLedgerOnUnratedIsland.length, 0);
  });

  it('uses scenario-generated overlap to discover proxy authority and reproject Alice-unrated island evidence next turn', () => {
    const trace = runModelingFixture('proxy-discovers-seed-positive-unrated-island');
    const establishingStep = trace.steps.find((step) => step.sourceAuthorityUpdates.length > 0);
    const nextTurnStep = trace.steps.find((step) => step.rawRating.turn === 17);
    const unratedProjection = trace.finalState.evidenceProjections.find((projection) => projection.ledgerEntryId === 'proxy-discovers-seed-positive-unrated-island:encounter-1:ledger');
    const unratedRetroTrace = nextTurnStep?.retroactiveProjectionUpdates.find((entry) => entry.ledgerEntryId === 'proxy-discovers-seed-positive-unrated-island:encounter-1:ledger');

    assert.equal(trace.steps.length, 17);
    assert.equal(establishingStep?.rawRating.turn, 16);
    assert.equal(establishingStep?.sourceAuthorityUpdates[0]?.seedPlayerId, 'scenario-alice');
    assert.equal(establishingStep?.sourceAuthorityUpdates[0]?.matchedRatings, 15);
    assert.equal(establishingStep?.retroactiveProjectionUpdates.length, 0);
    assert.equal(nextTurnStep?.retroactiveProjectionUpdates.length !== undefined && nextTurnStep.retroactiveProjectionUpdates.length > 0, true);
    assert.equal(unratedProjection?.sourceClass, 'seedProxy');
    assert.equal(unratedProjection?.authorityBasis, 'learnedSimilarityToSeed');
    assert.equal(unratedProjection?.proxyForSeedIds.includes('scenario-alice'), true);
    assert.equal(Boolean(unratedRetroTrace && unratedRetroTrace.signalStrengthAfter > unratedRetroTrace.signalStrengthBefore), true);
  });


  it('runs scenario matrix with hidden-truth checksum validated against visible authority inference', () => {
    const trace = runModelingFixture('seed-proxy-scenario-matrix');
    const validation = trace.scenarioAuthorityValidation;
    const byActor = new Map(trace.authoritySummary?.map((entry) => [entry.actorId, entry]) ?? []);

    assert.equal(validation?.passed, true);
    assert.equal(validation?.hiddenTruthUsedFor.includes('eventGeneration'), true);
    assert.equal(validation?.hiddenTruthNotUsedFor.includes('sourceAuthorityInference'), true);
    assert.equal(byActor.get('matrix-bob')?.inferredRelationToSeed, 'seedProxy');
    assert.equal(byActor.get('matrix-almost-bob')?.inferredRelationToSeed, 'ordinarySimilar');
    assert.equal(byActor.get('matrix-anti-bob')?.inferredRelationToSeed, 'inverseSignal');
    assert.equal(byActor.get('matrix-control')?.inferredRelationToSeed, 'unrelated');
  });

  it('uses matrix controls to separate proxy, under-threshold similarity, inverse signal, and disconnected actors over multiple turns', () => {
    const trace = runModelingFixture('seed-proxy-scenario-matrix');
    const bob = trace.authoritySummary?.find((entry) => entry.actorId === 'matrix-bob');
    const almostBob = trace.authoritySummary?.find((entry) => entry.actorId === 'matrix-almost-bob');
    const antiBob = trace.authoritySummary?.find((entry) => entry.actorId === 'matrix-anti-bob');
    const control = trace.authoritySummary?.find((entry) => entry.actorId === 'matrix-control');

    assert.equal(bob?.overlapCount, 15);
    assert.equal(bob?.matchedRatings, 15);
    assert.equal(Boolean(bob?.proxyStrength && bob.proxyStrength > 0.9), true);
    assert.equal(almostBob?.overlapCount, 14);
    assert.equal(almostBob?.matchedRatings, 14);
    assert.equal(almostBob?.inferredRelationToSeed, 'ordinarySimilar');
    assert.equal(antiBob?.overlapCount, 15);
    assert.equal(antiBob?.matchedRatings, 0);
    assert.equal(antiBob?.inverseMatches, 15);
    assert.equal(control?.overlapCount, 0);
  });

  it('reprojects Bob seed-positive unrated evidence while preserving Bob provenance and blocking wrong-lane bleed', () => {
    const trace = runModelingFixture('seed-proxy-scenario-matrix');
    const bobUnratedEntry = trace.finalState.ratingLedger.find((entry) => entry.playerId === 'matrix-bob' && entry.islandId === 'matrix-bob-unrated-positive');
    const wrongLaneEntry = trace.finalState.ratingLedger.find((entry) => entry.playerId === 'matrix-bob' && entry.islandId === 'matrix-wrong-lane-brain-rot');
    const bobUnratedProjection = trace.finalState.evidenceProjections.find((projection) => projection.ledgerEntryId === bobUnratedEntry?.entryId);
    const wrongLaneProjection = trace.finalState.evidenceProjections.find((projection) => projection.ledgerEntryId === wrongLaneEntry?.entryId);
    const aliceLedgerOnBobUnrated = trace.finalState.ratingLedger.filter((entry) => entry.playerId === 'matrix-alice' && entry.islandId === 'matrix-bob-unrated-positive');

    assert.equal(bobUnratedEntry?.rating, 1);
    assert.equal(aliceLedgerOnBobUnrated.length, 0);
    assert.equal(bobUnratedProjection?.sourceClass, 'seedProxy');
    assert.equal(bobUnratedProjection?.authorityBasis, 'learnedSimilarityToSeed');
    assert.equal(bobUnratedProjection?.proxyForSeedIds.includes('matrix-alice'), true);
    assert.notEqual(wrongLaneProjection?.sourceClass, 'seedProxy');
  });

});
