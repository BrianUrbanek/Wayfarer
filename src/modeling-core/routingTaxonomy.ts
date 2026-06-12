import type { RecommendationKind, RoutingReasonKind } from './types.js';

export type LiveRecommendationKind = Extract<RecommendationKind, 'SAFE_FIT' | 'SMART_GAMBLE' | 'DISCOVERY_PROBE'>;
export type LiveRoutingReasonKind = Extract<RoutingReasonKind, 'safeFit' | 'smartGamble' | 'discoveryProbe'>;

export const LIVE_RECOMMENDATION_KINDS: readonly LiveRecommendationKind[] = [
  'SAFE_FIT',
  'SMART_GAMBLE',
  'DISCOVERY_PROBE'
] as const;

export const COMPATIBILITY_ONLY_RECOMMENDATION_KINDS: readonly Exclude<RecommendationKind, LiveRecommendationKind>[] = [
  'SUPPRESS_OR_AVOID',
  'GUIDED_DISCOVERY'
] as const;

export interface LiveRoutingTaxonomyMapping {
  readonly recommendationKind: LiveRecommendationKind;
  readonly routingReason: LiveRoutingReasonKind;
  readonly compatibilityOnly: false;
}

const LIVE_TO_CANONICAL: Record<LiveRecommendationKind, LiveRoutingTaxonomyMapping> = {
  SAFE_FIT: {
    recommendationKind: 'SAFE_FIT',
    routingReason: 'safeFit',
    compatibilityOnly: false
  },
  SMART_GAMBLE: {
    recommendationKind: 'SMART_GAMBLE',
    routingReason: 'smartGamble',
    compatibilityOnly: false
  },
  DISCOVERY_PROBE: {
    recommendationKind: 'DISCOVERY_PROBE',
    routingReason: 'discoveryProbe',
    compatibilityOnly: false
  }
};

export function mapLiveRecommendationKindToCanonical(kind: LiveRecommendationKind): LiveRoutingTaxonomyMapping {
  return LIVE_TO_CANONICAL[kind];
}

export function mapCanonicalRecommendationKindToLive(kind: RecommendationKind): LiveRecommendationKind | null {
  if (kind === 'SAFE_FIT' || kind === 'SMART_GAMBLE' || kind === 'DISCOVERY_PROBE') {
    return kind;
  }

  return null;
}

export function isCompatibilityOnlyRecommendationKind(kind: RecommendationKind): kind is Exclude<RecommendationKind, LiveRecommendationKind> {
  return kind === 'SUPPRESS_OR_AVOID' || kind === 'GUIDED_DISCOVERY';
}
