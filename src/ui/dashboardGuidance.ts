import type { ScenarioPresetId } from '../model/scenarioPresets.js';

export type GuidanceMode = 'novice' | 'expert';

export type DashboardOrderingPreset = 'overview-first' | 'recovery-first' | 'routing-first' | 'debug-first';

export type DashboardPanelGroupKey = 'overview' | 'recovery' | 'routing' | 'debug';

export type GuidedPathId = 'run-start' | 'portfolio-reviewer' | 'navigation-tutorial' | 'analyst-workflow';

export type DashboardModuleId =
  | 'turn-summary'
  | 'population-summary'
  | 'system-health'
  | 'selected-user-summary'
  | 'reviewer-archetype-recovery'
  | 'discovery-routing'
  | 'selected-island'
  | 'model-explanation'
  | 'island-comparison'
  | 'pseudo-cohort-reports'
  | 'debug-data';

export interface GuidedStep {
  title: string;
  instruction: string;
  targetModuleId?: DashboardModuleId;
  why?: string;
}

export interface GuidedPath {
  id: GuidedPathId;
  title: string;
  recommendedPreset: ScenarioPresetId;
  recommendedOrdering: DashboardOrderingPreset;
  recommendedPath?: string;
  framing: {
    system: string;
    experience: string;
  };
  steps: GuidedStep[];
  successCriteria: string[];
  maintenanceNote: string;
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

export const GUIDED_PATHS: GuidedPath[] = [
  {
    id: 'run-start',
    title: 'Run Start',
    recommendedPreset: 'golden-demo',
    recommendedOrdering: 'overview-first',
    recommendedPath: 'Run context → Turn Summary / Recap → Recovery → Truth Alignment → Report',
    framing: {
      system: 'Start from a clean prompt to choose a scenario or load an existing run.',
      experience: 'Cold-load first-contact path for starting or importing a meaningful run.'
    },
    steps: [
      {
        title: 'Choose a scenario',
        instruction: 'Use Scenario preset to select Golden Demo or another setup before you inspect anything else.',
        targetModuleId: 'turn-summary',
        why: 'Preset selection sets up the run, but it does not mean a meaningful run has been loaded yet.'
      },
      {
        title: 'Execute or import',
        instruction: 'Execute Scenario to generate a run, or Import JSON to load a saved run blob.',
        targetModuleId: 'turn-summary',
        why: 'A run becomes interpretable only after it has real turn history or an imported saved state.'
      },
      {
        title: 'Read the first proof path',
        instruction: 'Once a meaningful run is loaded, read Turn Summary, Turn Recap, Hidden Cohort Recovery, and Selected Island / Truth Alignment in that order.',
        targetModuleId: 'turn-summary',
        why: 'This is the portfolio-reviewer path after the run exists.'
      },
      {
        title: 'Open the report',
        instruction: 'Open demo report only after a meaningful Golden Demo run exists.',
        targetModuleId: 'turn-summary',
        why: 'The report is a readout artifact, not a start-state control.'
      }
    ],
    successCriteria: [
      'The viewer can start or import a run without seeing analysis warnings.',
      'The viewer can tell that preset selection is not the same as a loaded run.',
      'The first proof path appears only after a meaningful run exists.'
    ],
    maintenanceNote: 'Keep this path aligned to cold-load novice behavior and the start/import contract.'
  },
  {
    id: 'portfolio-reviewer',
    title: 'Portfolio Reviewer',
    recommendedPreset: 'golden-demo',
    recommendedOrdering: 'recovery-first',
    recommendedPath: 'Run context → Turn Summary / Recap → Recovery → Truth Alignment → Report',
    framing: {
      system: 'Show the proof path a reviewer needs after a meaningful run is loaded.',
      experience: 'Portfolio review flow centered on claim, run context, evidence, recovery, and report.'
    },
    steps: [
      {
        title: 'Read the run context',
        instruction: 'Open Run Context and confirm the active preset, seed, and turn policy.',
        targetModuleId: 'turn-summary',
        why: 'This anchors the loaded run before reading evidence.'
      },
      {
        title: 'Read what changed',
        instruction: 'Open Turn Summary and Turn Recap to see the current state and the turn-level delta.',
        targetModuleId: 'turn-summary',
        why: 'These are the fastest summary cards for the loaded run.'
      },
      {
        title: 'Inspect recovery',
        instruction: 'Open Hidden Cohort Recovery to read the seeded, unseeded, and noisy recovery story.',
        targetModuleId: 'selected-island',
        why: 'Recovery is the key claim surface for the Golden Demo path.'
      },
      {
        title: 'Inspect proof',
        instruction: 'Select an island and inspect Truth Alignment to compare hidden truth with the learned estimate.',
        targetModuleId: 'selected-island',
        why: 'This is the concrete proof path behind the summary cards.'
      },
      {
        title: 'Open the report',
        instruction: 'Open demo report for a presentation-ready readout of the current Golden Demo state.',
        targetModuleId: 'turn-summary',
        why: 'The report is the reviewer-friendly artifact once a meaningful run exists.'
      }
    ],
    successCriteria: [
      'The viewer can understand the claim without opening every detail panel.',
      'The proof path stays centered on turn summary, recovery, truth alignment, and report.',
      'Technical detail remains available but secondary.'
    ],
    maintenanceNote: 'Keep this path aligned to the novice proof path after a meaningful run loads.'
  },
  {
    id: 'navigation-tutorial',
    title: 'Navigation Tutorial',
    recommendedPreset: 'small-smoke-test',
    recommendedOrdering: 'overview-first',
    recommendedPath: 'Run context → Turn Summary → Selected User → Selected Island',
    framing: {
      system: 'Teach a newcomer how to navigate the console on a simple stable frame.',
      experience: 'Hand-holding tutorial for learning the main surfaces and how they update.'
    },
    steps: [
      {
        title: 'Start at setup',
        instruction: 'Open Run Context and confirm the active scenario preset, seed, and turn policy.',
        targetModuleId: 'system-health',
        why: 'This anchors the tutorial in the current run context before any interpretation.'
      },
      {
        title: 'Read the fitness gate',
        instruction: 'Review Data Fitness to see whether the current dataset is ready to interpret.',
        targetModuleId: 'system-health',
        why: 'Data Fitness tells you when the frame is stable enough to trust.'
      },
      {
        title: 'Check the current turn',
        instruction: 'Open Turn Summary and note the current action, participants, and routed activity.',
        targetModuleId: 'turn-summary',
        why: 'The turn summary explains what just happened and what changed.'
      },
      {
        title: 'Choose a user',
        instruction: 'Use Choose user to pick one reviewer and then read Selected User Summary.',
        targetModuleId: 'selected-user-summary',
        why: 'A single user is the easiest entry point for the tutorial.'
      },
      {
        title: 'Choose an island',
        instruction: 'Use Choose island to pin a candidate island, then inspect Selected Island.',
        targetModuleId: 'selected-island',
        why: 'This shows how island-level evidence is presented in the app.'
      },
      {
        title: 'Pin the island',
        instruction: 'Use Pin island so the chosen island stays in view while you compare modules.',
        targetModuleId: 'selected-island',
        why: 'Pinning helps newcomers keep their place while reading multiple panels.'
      },
      {
        title: 'Advance and reread',
        instruction: 'Advance one turn, then reread Data Fitness, Turn Summary, Selected User Summary, and Selected Island to see what changed.',
        targetModuleId: 'turn-summary',
        why: 'Repeating the same read after a turn teaches the app’s update loop.'
      },
      {
        title: 'Optional formulas',
        instruction: 'Open FormulaTips only when you want the calculation details behind a result.',
        targetModuleId: 'model-explanation',
        why: 'FormulaTips are optional affordances, not the primary path.'
      }
    ],
    successCriteria: [
      'A newcomer can find the main navigation surfaces without needing hidden terminology.',
      'The same stable frame can be reread after one turn to see what changed.',
      'FormulaTips remain available as optional detail, not required reading.'
    ],
    maintenanceNote: 'Keep this path aligned to the visible navigation and summary modules only.'
  },
  {
    id: 'analyst-workflow',
    title: 'Analyst Workflow',
    recommendedPreset: 'golden-demo',
    recommendedOrdering: 'recovery-first',
    recommendedPath: 'Run context → Turn Summary / Recap → Recovery → Routing → Debug',
    framing: {
      system: 'Expose the app surfaces used for deeper analysis and evidence review.',
      experience: 'Analyst deep-dive for understanding why the current read holds or breaks.'
    },
    steps: [
      {
        title: 'Read fitness first',
        instruction: 'Check Data Fitness before interpreting any other module.',
        targetModuleId: 'system-health',
        why: 'The analyst workflow always starts by confirming the data is interpretable.'
      },
      {
        title: 'Review the latest action',
        instruction: 'Use Turn Summary / Recent Action to understand the most recent update.',
        targetModuleId: 'turn-summary',
        why: 'Recent Action explains whether the current turn strengthened or weakened evidence.'
      },
      {
        title: 'Inspect the user summary',
        instruction: 'Open Selected User Summary and compare declared tags vs observed behavior, target agreement vs cohort separability, and the rater signal profile.',
        targetModuleId: 'selected-user-summary',
        why: 'This is the core analyst read for a single user.'
      },
      {
        title: 'Use formula details as needed',
        instruction: 'Open FormulaTips only when you need calculation transparency for the user summary.',
        targetModuleId: 'model-explanation',
        why: 'The formulas support the analysis, but should not replace the main read.'
      },
      {
        title: 'Read the island evidence',
        instruction: 'Inspect Selected Island for audience fit, cohort comparison, affinity evidence, and weighted ratings.',
        targetModuleId: 'selected-island',
        why: 'Island-level evidence shows how the recommendation surface is being justified.'
      },
      {
        title: 'Check routing',
        instruction: 'Use Discovery Routing and Recommended unrated islands, then inspect top route when a recommendation exists.',
        targetModuleId: 'discovery-routing',
        why: 'Routing is the analyst-facing path to the next likely probe.'
      },
      {
        title: 'Audit recovery',
        instruction: 'Open Reviewer Archetype Recovery as an audit step, not the primary read path.',
        targetModuleId: 'reviewer-archetype-recovery',
        why: 'Recovery is useful for validation, but should not replace the main analysis surfaces.'
      },
      {
        title: 'Validate only when needed',
        instruction: 'Use Debug only for hidden checksum or generator validation.',
        targetModuleId: 'debug-data',
        why: 'Debug belongs at the end of the workflow, not the beginning.'
      },
      {
        title: 'Advance and compare',
        instruction: 'Advance a turn and check whether the new evidence strengthens, separates, or contradicts the previous read.',
        targetModuleId: 'turn-summary',
        why: 'The analyst workflow closes by testing whether the model’s story holds after new evidence arrives.'
      }
    ],
    successCriteria: [
      'The workflow starts with data fitness and recent action, not with debug.',
      'Selected User Summary and Selected Island can be used as the main evidence surfaces.',
      'Routing and recovery remain available as analysis tools, not as the primary narrative.'
    ],
    maintenanceNote: 'Keep this path aligned to the analyst-facing visible modules and preserve debug as a validation-only escape hatch.'
  }
];

export function getGuidedPath(id: GuidedPathId): GuidedPath {
  return GUIDED_PATHS.find((path) => path.id === id) ?? GUIDED_PATHS[0];
}
