export type GuidanceMode = 'novice' | 'expert';

export type DashboardOrderingPreset = 'overview-first' | 'recovery-first' | 'routing-first' | 'debug-first';

export type DashboardPanelGroupKey = 'overview' | 'recovery' | 'routing' | 'debug';

export type UseCaseStoryId =
  | 'first-time-walkthrough'
  | 'inspect-cohort-local-signal'
  | 'inspect-island-audience-fit'
  | 'inspect-guided-routing-safety'
  | 'compare-organic-guided-mixed'
  | 'inspect-candidate-seed-users'
  | 'inspect-taxonomy-mismatch';

export interface NarrativeFrame {
  title: string;
  description: string;
  detail: string;
}

export interface UseCaseStory {
  id: UseCaseStoryId;
  title: string;
  systemUseCase: NarrativeFrame;
  playerJourney: NarrativeFrame;
  sharedSteps: string[];
  expectedSystemResult: string;
  expectedPlayerResult: string;
  failureSigns: string[];
  recommendedOrdering: DashboardOrderingPreset;
  primaryPanels?: DashboardPanelGroupKey[];
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
    systemUseCase: {
      title: 'Inspect the analyst console loop',
      description:
        'Confirm that setup, the current turn, and one-turn advancement stay readable on a widescreen canvas.',
      detail:
        'The app keeps the generated dataset, current turn policy, selected user, and turn summary visible so the current state can be inspected before and after each turn.'
    },
    playerJourney: {
      title: 'Resume a case and keep exploring',
      description:
        'A player or analyst can save an interesting case, reload it later, and continue from the same point.',
      detail:
        'Export/import should preserve the story long enough to pick the same thread back up without rebuilding the setup.'
    },
    sharedSteps: [
      'Open Simulation setup and confirm the seed and turn policy values.',
      'Export the current simulation JSON.',
      'Import the exported file back into the app.',
      'Take one turn and compare the restored turn summary.',
      'Inspect the current user, island, and routing surfaces.'
    ],
    expectedSystemResult:
      'The imported state should restore the same generator config, turn policy, turn history, and rating-event snapshots so the next turn continues from the same point.',
    expectedPlayerResult:
      'The saved case should feel reusable: I can preserve it as a demo or experiment artifact and continue later without losing the setup.',
    failureSigns: [
      'Exported JSON does not restore the same visible state.',
      'The next turn diverges after an import.',
      'The story cannot be inspected without reopening unrelated panels.'
    ],
    recommendedOrdering: 'overview-first',
    primaryPanels: ['overview', 'routing']
  },
  {
    id: 'inspect-cohort-local-signal',
    title: 'Inspect cohort-local signal',
    systemUseCase: {
      title: 'Cohort-local rater signal',
      description:
        'See whether sparse rating events accumulate into a useful cohort-local signal profile instead of a tag-level trust shortcut.',
      detail:
        'Signal should grow from evidence, remain cohort-local, and keep neutral ratings distinct from unrated islands.'
    },
    playerJourney: {
      title: 'Players like me become useful inputs',
      description:
        'Early honest ratings begin to matter for later players with similar taste without turning into global status.',
      detail:
        'The player-facing promise is that some early ratings are worth listening to because they help similar players later.'
    },
    sharedSteps: [
      'Pin a user in Drilldown targets.',
      'Inspect the selected user summary and rater signal profile.',
      'Compare declared and behavioral fit.',
      'Take one turn and inspect the updated signal and evidence.',
      'Check that neutral 0 ratings stay distinct from unrated nulls.'
    ],
    expectedSystemResult:
      'The signal profile should strengthen only when evidence exists, stay cohort-local, and keep 0 versus null semantics separate.',
    expectedPlayerResult:
      'The UI should make it plausible that a player\'s early ratings can help later players with similar taste.',
    failureSigns: [
      'Tag-level trust behaves like the primary signal.',
      'High signal appears without supporting evidence.',
      'Null and 0 ratings collapse into the same meaning.'
    ],
    recommendedOrdering: 'overview-first',
    primaryPanels: ['overview', 'recovery']
  },
  {
    id: 'inspect-island-audience-fit',
    title: 'Inspect island audience-fit',
    systemUseCase: {
      title: 'Island affinity',
      description:
        'Inspect how rating events accumulate into island affinity reports for different cohorts.',
      detail:
        'The mechanism estimates which cohorts fit each island by aggregating visible rating behavior and its evidence weight.'
    },
    playerJourney: {
      title: 'The system learns what fits people like me',
      description:
        'A player should see why some islands feel safer or more relevant than others.',
      detail:
        'The player-facing promise is audience/content fit that is rough but inspectable rather than hidden behind a black box.'
    },
    sharedSteps: [
      'Pin an island in Drilldown targets.',
      'Compare the island across cohorts.',
      'Take a turn and watch the affinity rows update.',
      'Inspect confidence, evidence, and unrated-pair behavior.',
      'Read the selected island summary alongside the affinity report.'
    ],
    expectedSystemResult:
      'Affinity evidence should move with new ratings while unrated pairs remain unrated and neutral ratings stay neutral.',
    expectedPlayerResult:
      'The UI should make audience/content fit legible as a rough guide, not as a guarantee of perfection.',
    failureSigns: [
      'Affinity reads as certainty instead of evidence.',
      'Unrated and neutral behavior are not distinguishable.',
      'There is no visible cohort comparison for the island.'
    ],
    recommendedOrdering: 'overview-first',
    primaryPanels: ['overview', 'routing']
  },
  {
    id: 'inspect-guided-routing-safety',
    title: 'Inspect guided routing safety',
    systemUseCase: {
      title: 'Guided routing safety',
      description:
        'Check that Guided Discovery uses pre-turn recommendations to separate safe-fit candidates from discovery probes.',
      detail:
        'The mechanism should route from pre-turn state, not from the same turn it is trying to explain.'
    },
    playerJourney: {
      title: 'The system can suggest interesting islands without spam',
      description:
        'Guided discovery should feel curated rather than random.',
      detail:
        'The player-facing promise is a helpful nudge that still leaves room to explore instead of a flood of low-fit suggestions.'
    },
    sharedSteps: [
      'Switch Turn mode to Guided Discovery.',
      'Pin a user in Drilldown targets.',
      'Compare a safe fit and a discovery probe in Discovery Routing.',
      'Take one guided turn.',
      'Inspect the routed island and recommendation detail.'
    ],
    expectedSystemResult:
      'The route should reflect pre-turn recommendations and keep safe-fit versus discovery-probe categories readable.',
    expectedPlayerResult:
      'Guided routing should feel like a useful suggestion layer rather than random spam.',
    failureSigns: [
      'Guided turns ignore pre-turn recommendations.',
      'Safe-fit and discovery-probe rows are visually indistinguishable.',
      'The app stops protecting unrated pair safety.'
    ],
    recommendedOrdering: 'routing-first',
    primaryPanels: ['routing', 'overview']
  },
  {
    id: 'compare-organic-guided-mixed',
    title: 'Compare Organic, Guided, and Mixed',
    systemUseCase: {
      title: 'Organic, Guided, and Mixed turn policies',
      description:
        'Compare how the three turn modes change the evidence path without changing the underlying model math.',
      detail:
        'Mixed should reuse one shared participant set, while Organic and Guided remain distinguishable in the event stream and turn summary.'
    },
    playerJourney: {
      title: 'Three valid ways to discover content',
      description:
        'The experience should show unrouted discovery, routed discovery, and the combined version as different but related modes.',
      detail:
        'A player can understand how the same world feels when discovery is unguided, routed, or both.'
    },
    sharedSteps: [
      'Run the same scenario in Organic, Guided, and Mixed modes.',
      'Compare the turn summaries and event sources.',
      'Inspect routing changes after a turn in each mode.',
      'Compare island affinity changes across the three runs.'
    ],
    expectedSystemResult:
      'Organic, Guided, and Mixed should remain distinguishable, and Mixed should continue to use one shared participating set.',
    expectedPlayerResult:
      'The three modes should read like different presentation styles for the same discovery loop, not unrelated tools.',
    failureSigns: [
      'Mode differences disappear from the summary.',
      'Mixed silently splits into unrelated participant pools.',
      'The stream that produced an event is no longer inspectable.'
    ],
    recommendedOrdering: 'routing-first',
    primaryPanels: ['overview', 'routing']
  },
  {
    id: 'inspect-candidate-seed-users',
    title: 'Inspect candidate seed users',
    systemUseCase: {
      title: 'Unexplained high-signal users',
      description:
        'Surface strong contributors whose visible fit is not yet well explained by the current cohort structure.',
      detail:
        'The report should flag these users for analyst review only, not auto-promote them into production cohorts.'
    },
    playerJourney: {
      title: 'Find promising reviewers before the system can fully explain them',
      description:
        'The app should surface strong contributors without pretending certainty.',
      detail:
        'A player can recognize a promising reviewer candidate even before the broader explanation is complete.'
    },
    sharedSteps: [
      'Open Reviewer Archetype Recovery.',
      'Pin a candidate user in Drilldown targets.',
      'Compare visible fit and usable signal.',
      'Open the reviewer detail drawer.',
      'Check the report labels for reviewer recovery and candidate status.'
    ],
    expectedSystemResult:
      'The report should flag strong-but-unexplained users as review candidates only.',
    expectedPlayerResult:
      'The UI should make the candidate feel like a plausible future seed without pretending it is already a production identity.',
    failureSigns: [
      'The app auto-creates a new cohort.',
      'The candidate gets hidden behind a generic noise bucket.',
      'The report reintroduces stale internal shorthand.'
    ],
    recommendedOrdering: 'recovery-first',
    primaryPanels: ['recovery', 'overview']
  },
  {
    id: 'inspect-taxonomy-mismatch',
    title: 'Inspect taxonomy mismatch',
    systemUseCase: {
      title: 'Tag taxonomy mismatch',
      description:
        'Inspect when the current tag vocabulary is underfitting or mislabeling visible behavior.',
      detail:
        'Pseudo-cohort and reviewer reports should expose inconsistent tag combinations and retag pressure without changing the model.'
    },
    playerJourney: {
      title: 'See when labels stop matching behavior',
      description:
        'The app should make it obvious when the tag vocabulary no longer lines up with visible ratings.',
      detail:
        'The player-facing promise is an understandable explanation for why the current label set may need analyst attention.'
    },
    sharedSteps: [
      'Use Debug first ordering.',
      'Inspect pseudo-cohort reports.',
      'Compare declared tags, behavior fit, and mismatch candidates.',
      'Open any relevant drawer for a deeper look.'
    ],
    expectedSystemResult:
      'Pseudo-cohort and reviewer reports should expose inconsistent tag combinations and retag pressure without changing the model.',
    expectedPlayerResult:
      'The analysis should make the mismatch legible enough that an analyst can decide whether tags need attention.',
    failureSigns: [
      'Taxonomy problems only appear in drawers.',
      'Pseudo-cohort reports lack evidence.',
      'The labels read like verdicts instead of inspectable behavior.'
    ],
    recommendedOrdering: 'debug-first',
    primaryPanels: ['debug', 'recovery']
  }
];

export function getUseCaseStory(id: UseCaseStoryId): UseCaseStory {
  return USE_CASE_STORIES.find((story) => story.id === id) ?? USE_CASE_STORIES[0];
}
