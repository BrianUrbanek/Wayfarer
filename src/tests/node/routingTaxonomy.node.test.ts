import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runModelingFixture } from '../../modeling-core/index.js';
import {
  COMPATIBILITY_ONLY_RECOMMENDATION_KINDS,
  isCompatibilityOnlyRecommendationKind,
  mapCanonicalRecommendationKindToLive,
  mapLiveRecommendationKindToCanonical
} from '../../modeling-core/routingTaxonomy.js';

describe('routing taxonomy adapter', () => {
  it('maps the live three-kind subset to canonical routing semantics', () => {
    assert.deepEqual(mapLiveRecommendationKindToCanonical('SAFE_FIT'), {
      recommendationKind: 'SAFE_FIT',
      routingReason: 'safeFit',
      compatibilityOnly: false
    });
    assert.deepEqual(mapLiveRecommendationKindToCanonical('SMART_GAMBLE'), {
      recommendationKind: 'SMART_GAMBLE',
      routingReason: 'smartGamble',
      compatibilityOnly: false
    });
    assert.deepEqual(mapLiveRecommendationKindToCanonical('DISCOVERY_PROBE'), {
      recommendationKind: 'DISCOVERY_PROBE',
      routingReason: 'discoveryProbe',
      compatibilityOnly: false
    });
  });

  it('keeps canonical-only routing kinds out of the live compatibility subset', () => {
    assert.equal(mapCanonicalRecommendationKindToLive('SUPPRESS_OR_AVOID'), null);
    assert.equal(mapCanonicalRecommendationKindToLive('GUIDED_DISCOVERY'), null);
    assert.equal(isCompatibilityOnlyRecommendationKind('SUPPRESS_OR_AVOID'), true);
    assert.equal(isCompatibilityOnlyRecommendationKind('GUIDED_DISCOVERY'), true);
    assert.deepEqual([...COMPATIBILITY_ONLY_RECOMMENDATION_KINDS], ['SUPPRESS_OR_AVOID', 'GUIDED_DISCOVERY']);
  });

  it('aligns live-facing routes with canonical modeling-core decisions where the taxonomy overlaps', () => {
    const safeFit = runModelingFixture('routing-safe-fit').steps[0]?.recommendationFacingState[0];
    const smartGamble = runModelingFixture('routing-smart-gamble').steps[0]?.recommendationFacingState[0];
    const discoveryProbe = runModelingFixture('routing-discovery-probe').steps[0]?.recommendationFacingState[0];
    const guidedDiscovery = runModelingFixture('routing-guided-mismatch').steps[0]?.recommendationFacingState[0];
    const suppressOrAvoid = runModelingFixture('routing-avoid-negative').steps[0]?.recommendationFacingState[0];

    assert.equal(safeFit?.kind, mapLiveRecommendationKindToCanonical('SAFE_FIT').recommendationKind);
    assert.equal(safeFit?.routingTrace.primaryReason, mapLiveRecommendationKindToCanonical('SAFE_FIT').routingReason);
    assert.equal(smartGamble?.kind, mapLiveRecommendationKindToCanonical('SMART_GAMBLE').recommendationKind);
    assert.equal(smartGamble?.routingTrace.primaryReason, mapLiveRecommendationKindToCanonical('SMART_GAMBLE').routingReason);
    assert.equal(discoveryProbe?.kind, mapLiveRecommendationKindToCanonical('DISCOVERY_PROBE').recommendationKind);
    assert.equal(discoveryProbe?.routingTrace.primaryReason, mapLiveRecommendationKindToCanonical('DISCOVERY_PROBE').routingReason);
    assert.equal(mapCanonicalRecommendationKindToLive(guidedDiscovery?.kind ?? 'GUIDED_DISCOVERY'), null);
    assert.equal(mapCanonicalRecommendationKindToLive(suppressOrAvoid?.kind ?? 'SUPPRESS_OR_AVOID'), null);
  });
});
