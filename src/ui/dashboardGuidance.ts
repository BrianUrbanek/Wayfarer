export type GuidanceMode = 'novice' | 'expert';

export type DashboardOrderingPreset = 'overview-first' | 'recovery-first' | 'routing-first' | 'debug-first';

export type DashboardPanelGroupKey = 'overview' | 'recovery' | 'routing' | 'debug';

export type UseCaseStoryId =
  | 'first-time-walkthrough'
  | 'check-seed-alignment'
  | 'find-noisy-users'
  | 'inspect-mistagged-users'
  | 'watch-trust-propagation'
  | 'compare-safe-vs-discovery'
  | 'find-unexplained-high-signal-users'
  | 'diagnose-tag-taxonomy'
  | 'compare-passive-vs-active';

export interface UseCaseStory {
  id: UseCaseStoryId;
  title: string;
  goal: string;
  steps: string[];
  expectedResult: string;
  failureSigns: string[];
  recommendedOrdering: DashboardOrderingPreset;
}

export const DASHBOARD_ORDERING_LABELS: Record<DashboardOrderingPreset, string> = {
  'overview-first': 'Overview first',
  'recovery-first': 'Recovery first',
  'routing-first': 'Routing first',
  'debug-first': 'Debug first'
};

export const DASHBOARD_ORDERINGS: Record<DashboardOrderingPreset, DashboardPanelGroupKey[]> = {
  'overview-first': ['overview', 'recovery', 'routing', 'debug'],
  'recovery-first': ['recovery', 'overview', 'routing', 'debug'],
  'routing-first': ['routing', 'overview', 'recovery', 'debug'],
  'debug-first': ['debug', 'overview', 'recovery', 'routing']
};

export const USE_CASE_STORIES: UseCaseStory[] = [
  {
    id: 'first-time-walkthrough',
    title: 'First-time walkthrough',
    goal: 'Learn the full loop from seed setup to inspection.',
    steps: [
      'Set Dashboard ordering to Overview first.',
      'Pick a user and inspect the selected user summary.',
      'Take one turn and watch the turn summary change.',
      'Open the reviewer recovery and discovery routing panels.',
      'Open About if you want the prior-art framing.'
    ],
    expectedResult:
      'You should see the current turn advance, the selected user gains or changes signal, and the report panels start to tell a coherent story about what the model thinks is interesting.',
    failureSigns: [
      'The turn summary does not change after taking a turn.',
      'You cannot find the selected user or recommendation detail.',
      'The right-hand explanation does not make clear what the model is trying to prove.'
    ],
    recommendedOrdering: 'overview-first'
  },
  {
    id: 'check-seed-alignment',
    title: 'Check seed alignment',
    goal: 'See whether a user behaves like a trusted cohort anchor.',
    steps: [
      'Use Overview first ordering.',
      'Select a user that the reviewer recovery panel marks as a clean or partial match.',
      'Open the selected user drawer.',
      'Compare declared fit, behavior fit, and hidden debug checksum fields.'
    ],
    expectedResult:
      'The user should show a clear declared-vs-behavior story, and a good match should look high-signal rather than random.',
    failureSigns: [
      'The user looks high-signal but the visible cohorts do not explain why.',
      'The selected user summary is missing the declared and behavior distributions.',
      'Hidden debug labels appear as if they were model inputs.'
    ],
    recommendedOrdering: 'overview-first'
  },
  {
    id: 'find-noisy-users',
    title: 'Find noisy users',
    goal: 'Check that low-structure users stay cautious instead of being over-trusted.',
    steps: [
      'Use Recovery first ordering.',
      'Open Reviewer Archetype Recovery.',
      'Look for random, noisy, or uncertain checksum statuses.',
      'Select one of those users and inspect the diagnosis reasons.'
    ],
    expectedResult:
      'Noisy users should remain low-confidence or ambiguous, and the UI should make that caution easy to see.',
    failureSigns: [
      'A low-evidence user is presented as a confident match.',
      'The recovery panel does not distinguish uncertain from clean matches.',
      'The explanation panel reads like a verdict instead of a cautious estimate.'
    ],
    recommendedOrdering: 'recovery-first'
  },
  {
    id: 'inspect-mistagged-users',
    title: 'Inspect mistagged users',
    goal: 'See when declared tags point one way but ratings point another.',
    steps: [
      'Use Recovery first ordering.',
      'Open the candidate seed / unexplained high-signal report.',
      'Look for users marked as mismatches or retag candidates.',
      'Compare the declared top cohort to the behavior top cohort.'
    ],
    expectedResult:
      'Mistagged users should be easy to spot as a declared-vs-behavior mismatch, not as a hidden seed promotion.',
    failureSigns: [
      'The UI does not show both declared and behavioral fit.',
      'The user is treated as a production cohort automatically.',
      'The mismatch is buried in a long report table without an obvious summary.'
    ],
    recommendedOrdering: 'recovery-first'
  },
  {
    id: 'watch-trust-propagation',
    title: 'Watch trust propagation',
    goal: 'See whether high-signal users extend seed reach into under-reviewed islands.',
    steps: [
      'Use Routing first ordering.',
      'Select a high-signal user.',
      'Open Discovery Routing and the selected island summary.',
      'Take an active turn and watch routed islands create new sparse evidence.'
    ],
    expectedResult:
      'High-signal users should produce stronger routing candidates and the island affinity panels should show evidence moving in the expected direction.',
    failureSigns: [
      'Routing ignores the selected user\'s cohort-local signal.',
      'The recommendation panel does not separate safe fits from discovery probes.',
      'The island affinity report does not explain why the user was routed there.'
    ],
    recommendedOrdering: 'routing-first'
  },
  {
    id: 'compare-safe-vs-discovery',
    title: 'Compare safe vs discovery recommendations',
    goal: 'Check that the router distinguishes known-good recommendations from useful probes.',
    steps: [
      'Use Routing first ordering.',
      'Compare the top recommendation rows in Discovery Routing.',
      'Open both a safe fit and a discovery probe.',
      'Read the recommendation metrics and explanation text.'
    ],
    expectedResult:
      'Safe recommendations should look well-evidenced, while discovery probes should look promising but less certain.',
    failureSigns: [
      'Discovery probes overwhelm predicted fit.',
      'The router recommends unrated content with no explanation.',
      'Safe fits and probes are visually indistinguishable.'
    ],
    recommendedOrdering: 'routing-first'
  },
  {
    id: 'find-unexplained-high-signal-users',
    title: 'Find candidate new seed users',
    goal: 'Surface users whose behavior is predictive but not well explained by current cohorts.',
    steps: [
      'Use Recovery first ordering.',
      'Open the candidate new seed / unexplained high-signal section.',
      'Look for users with high usable signal and weak known fit.',
      'Open a reviewer detail drawer for a candidate.'
    ],
    expectedResult:
      'The report should surface strong but unexplained users for analyst review only, without promoting them into new seeds automatically.',
    failureSigns: [
      'The app auto-creates a new cohort.',
      'The report still uses a project-internal shorthand instead of the visible analyst label.',
      'A strong user is hidden inside a generic noise bucket.'
    ],
    recommendedOrdering: 'recovery-first'
  },
  {
    id: 'diagnose-tag-taxonomy',
    title: 'Diagnose tag taxonomy problems',
    goal: 'See whether observed behavior suggests the current tag vocabulary is helping or failing.',
    steps: [
      'Use Debug first ordering.',
      'Inspect pseudo-cohort reports and reviewer recovery together.',
      'Look for inconsistent tag combinations and weak-known-fit high-signal users.',
      'Compare the visible tags to the inferred behavior.'
    ],
    expectedResult:
      'The UI should make it obvious when the tag vocabulary is not matching the visible behavior cleanly.',
    failureSigns: [
      'Tag issues only appear deep in a drawer.',
      'Pseudo-cohort reports do not show internal consistency or evidence.',
      'The visible labels do not help explain the mismatch.'
    ],
    recommendedOrdering: 'debug-first'
  },
  {
    id: 'compare-passive-vs-active',
    title: 'Compare passive vs active learning',
    goal: 'See whether routed turns produce more useful evidence than random exposure.',
    steps: [
      'Use Routing first ordering.',
      'Switch Turn mode between passive random and active discovery.',
      'Take one turn in each mode.',
      'Compare the turn summary, routing panel, and island affinity changes.'
    ],
    expectedResult:
      'Active discovery should produce routed recommendations and more legible evidence growth than passive random exposure.',
    failureSigns: [
      'The turn summary does not make the mode difference obvious.',
      'Active and passive turns look identical.',
      'No change is visible in the routing or affinity panels.'
    ],
    recommendedOrdering: 'routing-first'
  }
];

export function getUseCaseStory(id: UseCaseStoryId): UseCaseStory {
  return USE_CASE_STORIES.find((story) => story.id === id) ?? USE_CASE_STORIES[0];
}
