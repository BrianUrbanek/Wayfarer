import type { SimulationTurnSummary } from '../../model/simulation.js';

export interface TurnSummaryMetric {
  key: string;
  label: string;
  value: string | number;
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
  explanation: string;
}

interface BuildTurnSummaryMetricsInput {
  currentTurn: number;
  totalRatingEvents: number;
  turnSummary: SimulationTurnSummary | null;
  turnModeLabel: string;
}

export function buildTurnSummaryMetrics(input: BuildTurnSummaryMetricsInput): TurnSummaryMetric[] {
  const summary = input.turnSummary;

  return [
    {
      key: 'current-turn',
      label: 'Current turn',
      value: input.currentTurn,
      tone: 'accent',
      explanation: 'The latest completed simulation turn represented by the current dashboard state.'
    },
    {
      key: 'mode',
      label: 'Mode',
      value: input.turnModeLabel,
      explanation: 'How the most recent turn created rating events: organically, through guided routing, or through both streams.'
    },
    {
      key: 'rating-events',
      label: 'Rating events',
      value: input.totalRatingEvents,
      explanation: 'The total number of immutable rating events accumulated across the active simulation run.'
    },
    {
      key: 'ratings-this-turn',
      label: 'Ratings this turn',
      value: summary?.ratingsCreated ?? 0,
      explanation: 'All new rating events created during the most recent turn, across organic and guided streams.'
    },
    {
      key: 'organic-events',
      label: 'Organic events this turn',
      value: summary?.organicRatingsCreated ?? 0,
      explanation: 'New ratings created without recommendation-guided routing during the most recent turn.'
    },
    {
      key: 'guided-events',
      label: 'Guided events this turn',
      value: summary?.guidedRatingsCreated ?? 0,
      explanation: 'New ratings created from recommendation-guided exposure during the most recent turn.'
    },
    {
      key: 'participating-users',
      label: 'Participating users this turn',
      value: summary?.participatingUserIds.length ?? 0,
      explanation: 'Distinct users selected to participate in the most recent turn, including either event stream.'
    },
    {
      key: 'new-islands-rated',
      label: 'New islands rated',
      value: summary?.newlyRatedIslandIds.length ?? 0,
      explanation: 'Distinct islands that received at least one new rating during the most recent turn.'
    },
    {
      key: 'safe-fits',
      label: 'Safe fits routed',
      value: summary?.recommendationKinds.SAFE_FIT ?? 0,
      explanation: 'Guided routes classified as stronger expected fit with enough support to use the safe-fit path.'
    },
    {
      key: 'smart-gambles',
      label: 'Smart gambles',
      value: summary?.recommendationKinds.SMART_GAMBLE ?? 0,
      explanation: 'Guided routes with promising fit that do not yet meet the stronger safe-fit support threshold.'
    },
    {
      key: 'discovery-probes',
      label: 'Discovery probes',
      value: summary?.recommendationKinds.DISCOVERY_PROBE ?? 0,
      explanation: 'Guided exploration routes chosen to gather useful evidence in under-known areas.'
    }
  ];
}
