import type { SeededRng } from '../generator/seededRandom.js';
import type { IslandUpdateCadenceProfile, User } from './types.js';
import { rollSupportedDice, type SupportedDiceExpression } from './dice.js';

export type TurnMode = 'organic' | 'guided' | 'mixed';
export type ParticipationModel = 'fixed-count' | 'chance-per-user';
export type RatingCountModel = 'fixed-count' | 'dice-expression';
export type RoutingRiskProfile = 'conservative' | 'balanced' | 'exploratory' | 'custom';
export type HeartbeatCadenceProfile = IslandUpdateCadenceProfile;

export interface RoutingRiskProfileValues {
  explorationWeight: number;
  badFitGuardThreshold: number;
}

export interface HeartbeatPolicy {
  gamePatchEveryNTurns: number;
  gamePatchTurnOffset: number;
  maxIslandInspectionsPerTurn: number;
  maxIslandUpdatesPerTurn: number;
  islandCadenceProfileWeights: Record<HeartbeatCadenceProfile, number>;
}

export interface TurnPolicy {
  turnMode: TurnMode;
  participationModel: ParticipationModel;
  participatingUsersPerTurn: number;
  participationChance: number;
  organicRatingCountModel: RatingCountModel;
  organicRatingsPerUser: number;
  organicRatingDice: SupportedDiceExpression;
  guidedRatingCountModel: RatingCountModel;
  guidedRecommendationsPerUser: number;
  guidedRecommendationDice: SupportedDiceExpression;
  routingRiskProfile: RoutingRiskProfile;
  customRoutingValues: RoutingRiskProfileValues;
  turnBatchCount: number;
  heartbeat?: HeartbeatPolicy;
}

export interface TurnModeVisibility {
  showOrganic: boolean;
  showGuided: boolean;
  showRouting: boolean;
}

export const TURN_MODE_LABELS: Record<TurnMode, string> = {
  organic: 'Organic Exploration',
  guided: 'Guided Discovery',
  mixed: 'Mixed'
};

export const PARTICIPATION_MODEL_LABELS: Record<ParticipationModel, string> = {
  'fixed-count': 'Fixed Count',
  'chance-per-user': 'Chance per User'
};

export const RATING_COUNT_MODEL_LABELS: Record<RatingCountModel, string> = {
  'fixed-count': 'Fixed Count',
  'dice-expression': 'Dice Expression'
};

export const ROUTING_RISK_PROFILE_LABELS: Record<RoutingRiskProfile, string> = {
  conservative: 'Conservative',
  balanced: 'Balanced',
  exploratory: 'Exploratory',
  custom: 'Custom'
};

export const ROUTING_RISK_PROFILE_PRESETS: Record<Exclude<RoutingRiskProfile, 'custom'>, RoutingRiskProfileValues> = {
  conservative: {
    explorationWeight: 0.25,
    badFitGuardThreshold: -0.2
  },
  balanced: {
    explorationWeight: 0.55,
    badFitGuardThreshold: -0.35
  },
  exploratory: {
    explorationWeight: 0.85,
    badFitGuardThreshold: -0.5
  }
};

export const DEFAULT_HEARTBEAT_POLICY: HeartbeatPolicy = {
  gamePatchEveryNTurns: 0,
  gamePatchTurnOffset: 0,
  maxIslandInspectionsPerTurn: 0,
  maxIslandUpdatesPerTurn: 0,
  islandCadenceProfileWeights: {
    dormant: 0.35,
    slow: 0.25,
    steady: 0.2,
    active: 0.13,
    frenetic: 0.07
  }
};

export const DEFAULT_TURN_POLICY: TurnPolicy = {
  turnMode: 'organic',
  participationModel: 'fixed-count',
  participatingUsersPerTurn: 6,
  participationChance: 0.35,
  organicRatingCountModel: 'fixed-count',
  organicRatingsPerUser: 3,
  organicRatingDice: '1d3',
  guidedRatingCountModel: 'fixed-count',
  guidedRecommendationsPerUser: 2,
  guidedRecommendationDice: '1d2',
  routingRiskProfile: 'balanced',
  customRoutingValues: {
    explorationWeight: 0.55,
    badFitGuardThreshold: -0.35
  },
  turnBatchCount: 5,
  heartbeat: { ...DEFAULT_HEARTBEAT_POLICY, islandCadenceProfileWeights: { ...DEFAULT_HEARTBEAT_POLICY.islandCadenceProfileWeights } }
};

export function normalizeHeartbeatPolicy(policy?: Partial<HeartbeatPolicy> | null): HeartbeatPolicy {
  if (!policy) {
    return {
      ...DEFAULT_HEARTBEAT_POLICY,
      islandCadenceProfileWeights: { ...DEFAULT_HEARTBEAT_POLICY.islandCadenceProfileWeights }
    };
  }

  return {
    ...DEFAULT_HEARTBEAT_POLICY,
    ...policy,
    islandCadenceProfileWeights: {
      ...DEFAULT_HEARTBEAT_POLICY.islandCadenceProfileWeights,
      ...(policy.islandCadenceProfileWeights ?? {})
    }
  };
}

export function getTurnModeVisibility(turnMode: TurnMode): TurnModeVisibility {
  return {
    showOrganic: turnMode === 'organic' || turnMode === 'mixed',
    showGuided: turnMode === 'guided' || turnMode === 'mixed',
    showRouting: turnMode === 'guided' || turnMode === 'mixed'
  };
}

export function resolveRoutingRiskProfileValues(
  routingRiskProfile: RoutingRiskProfile,
  customRoutingValues: RoutingRiskProfileValues
): RoutingRiskProfileValues {
  if (routingRiskProfile === 'custom') {
    return customRoutingValues;
  }

  return ROUTING_RISK_PROFILE_PRESETS[routingRiskProfile];
}

export function describeRoutingRiskProfile(
  routingRiskProfile: RoutingRiskProfile,
  customRoutingValues: RoutingRiskProfileValues
): string {
  const values = resolveRoutingRiskProfileValues(routingRiskProfile, customRoutingValues);

  if (routingRiskProfile === 'custom') {
    return `Custom: exploration ${values.explorationWeight.toFixed(2)} | bad-fit guard ${values.badFitGuardThreshold.toFixed(2)}`;
  }

  return `${ROUTING_RISK_PROFILE_LABELS[routingRiskProfile]}: exploration ${values.explorationWeight.toFixed(2)} | bad-fit guard ${values.badFitGuardThreshold.toFixed(2)}`;
}

export function selectParticipatingUsers<T extends User>(
  rng: SeededRng,
  candidates: readonly T[],
  participationModel: ParticipationModel,
  participatingUsersPerTurn: number,
  participationChance: number
): T[] {
  if (candidates.length === 0) {
    return [];
  }

  if (participationModel === 'chance-per-user') {
    return rng.shuffle(candidates).filter(() => rng.next() < participationChance);
  }

  const count = Math.max(0, Math.min(participatingUsersPerTurn, candidates.length));
  return rng.shuffle(candidates).slice(0, count);
}

export function resolveRatingCount(
  rng: SeededRng,
  ratingCountModel: RatingCountModel,
  fixedCount: number,
  diceExpression: SupportedDiceExpression
): number {
  if (ratingCountModel === 'dice-expression') {
    return rollSupportedDice(diceExpression, rng);
  }

  return Math.max(0, fixedCount);
}
