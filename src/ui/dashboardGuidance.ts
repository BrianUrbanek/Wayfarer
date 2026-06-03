import type { GuidedPath } from './guidedPath/guidedPathTypes.js';

export type GuidanceMode = 'novice' | 'expert';

export type DashboardPanelGroupKey = 'overview' | 'modeling' | 'recovery' | 'routing' | 'debug';

export type GuidedPathId = 'run-start' | 'portfolio-reviewer' | 'navigation-tutorial' | 'analyst-workflow';

export const GUIDED_PATHS: GuidedPath[] = [
  {
    id: 'run-start',
    title: 'Run Start',
    recommendedPreset: 'golden-demo',
    recommendedPath: 'Golden Demo -> Execute Scenario or import -> Proof path -> Report',
    framing: {
      system: 'Begin from a clean load and establish the Golden Demo or a saved run before you inspect evidence.',
      experience: 'Cold-load coaching path that turns a setup into a meaningful run.'
    },
    steps: [
      {
        id: 'run-start-choose-scenario',
        title: 'Choose scenario / confirm Golden Demo',
        body: 'Use the Scenario preset picker to confirm Golden Demo or another starting setup.',
        targetId: 'primary-workflow',
        why: 'Preset choice sets the frame, but it is not yet a loaded run.'
      },
      {
        id: 'run-start-execute-or-import',
        title: 'Execute or import',
        body: 'Execute Scenario to generate the run, or import a saved run blob if you already have one.',
        targetId: 'execute-scenario',
        actionLabel: 'Focus execute',
        why: 'The run becomes real only after execution or import.'
      }
    ],
    successCriteria: [
      'The viewer can confirm the Golden Demo or another scenario from the start state.',
      'The viewer can execute or import without reading analysis surfaces too early.',
      'The run stays clearly separate from the preset frame.'
    ],
    maintenanceNote: 'Keep this path aligned to cold-load novice behavior and the start/import contract.'
  },
  {
    id: 'portfolio-reviewer',
    title: 'Portfolio Reviewer',
    recommendedPreset: 'golden-demo',
    recommendedPath: 'Turn Summary -> Turn Recap -> Recovery -> Truth Alignment -> Routing -> Report',
    framing: {
      system: 'Show the proof path once a meaningful run is loaded.',
      experience: 'Reviewer flow centered on evidence, recovery, routing, and report.'
    },
    steps: [
      {
        id: 'portfolio-reviewer-turn-summary',
        title: 'Confirm the run',
        body: 'Open Turn Summary and then Turn Recap to confirm the loaded run and the latest turn delta.',
        targetId: 'turn-summary',
        why: 'These are the fastest proof surfaces for the loaded run.'
      },
      {
        id: 'portfolio-reviewer-turn-recap',
        title: 'Inspect Turn Recap',
        body: 'Use Turn Recap to read the turn-level movers and the meaningful delta story.',
        targetId: 'turn-recap',
        why: 'The recap tells you which movers mattered in the latest turn.'
      },
      {
        id: 'portfolio-reviewer-selected-user',
        title: 'Inspect Selected User Summary',
        body: 'Open Selected User Summary to review the selected user signal and diagnosis.',
        targetId: 'selected-user-summary',
        why: 'This is the primary per-user evidence surface.'
      },
      {
        id: 'portfolio-reviewer-hidden-recovery',
        title: 'Inspect Hidden Cohort Recovery',
        body: 'Open Hidden Cohort Recovery to see how seeded, unseeded, and noisy reads recover.',
        targetId: 'hidden-cohort-recovery',
        why: 'Recovery is a key Golden Demo proof surface.'
      },
      {
        id: 'portfolio-reviewer-selected-island',
        title: 'Inspect Selected Island / Truth Alignment',
        body: 'Open Selected Island and Truth Alignment to compare the visible read with hidden truth.',
        targetId: 'selected-island-truth',
        why: 'Truth alignment is the concrete island-level proof path.'
      },
      {
        id: 'portfolio-reviewer-discovery-routing',
        title: 'Use Discovery Routing',
        body: 'Open Discovery Routing to read the next-action output for the selected user.',
        targetId: 'discovery-routing',
        why: 'Routing is the next-action surface that closes the evidence loop.'
      },
      {
        id: 'portfolio-reviewer-open-report',
        title: 'Open Demo Report',
        body: 'Open Demo Report for the stakeholder readout once the path evidence is clear.',
        targetId: 'demo-report',
        why: 'The report is the presentation-ready artifact at the end of the path.'
      }
    ],
    successCriteria: [
      'The viewer can understand the claim without opening every detail panel.',
      'The proof path stays centered on summary, recap, recovery, truth alignment, routing, and report.',
      'Technical detail remains available but secondary.'
    ],
    maintenanceNote: 'Keep this path aligned to the novice proof path after a meaningful run loads.'
  },
  {
    id: 'navigation-tutorial',
    title: 'Navigation Tutorial',
    recommendedPreset: 'small-smoke-test',
    recommendedPath: 'Run context -> Turn Summary -> Selected User -> Selected Island',
    framing: {
      system: 'Teach a newcomer how to navigate the console on a simple stable frame.',
      experience: 'Hand-holding tutorial for learning the main surfaces and how they update.'
    },
    steps: [
      {
        id: 'navigation-start-at-setup',
        title: 'Start at setup',
        body: 'Open Run Context and confirm the active scenario preset, seed, and turn policy.',
        targetId: 'system-health',
        why: 'This anchors the tutorial in the current run context before any interpretation.'
      },
      {
        id: 'navigation-read-fitness-gate',
        title: 'Read the fitness gate',
        body: 'Review Data Fitness to see whether the current dataset is ready to interpret.',
        targetId: 'system-health',
        why: 'Data Fitness tells you when the frame is stable enough to trust.'
      },
      {
        id: 'navigation-check-current-turn',
        title: 'Check the current turn',
        body: 'Open Turn Summary and note the current action, participants, and routed activity.',
        targetId: 'turn-summary',
        why: 'The turn summary explains what just happened and what changed.'
      },
      {
        id: 'navigation-choose-user',
        title: 'Choose a user',
        body: 'Use Choose user to pick one reviewer and then read Selected User Summary.',
        targetId: 'selected-user-summary',
        why: 'A single user is the easiest entry point for the tutorial.'
      },
      {
        id: 'navigation-choose-island',
        title: 'Choose an island',
        body: 'Use Choose island to pin a candidate island, then inspect Selected Island.',
        targetId: 'selected-island',
        why: 'This shows how island-level evidence is presented in the app.'
      },
      {
        id: 'navigation-pin-island',
        title: 'Pin the island',
        body: 'Use Pin island so the chosen island stays in view while you compare modules.',
        targetId: 'selected-island',
        why: 'Pinning helps newcomers keep their place while reading multiple panels.'
      },
      {
        id: 'navigation-advance-reread',
        title: 'Advance and reread',
        body: 'Advance one turn, then reread Data Fitness, Turn Summary, Selected User Summary, and Selected Island to see what changed.',
        targetId: 'turn-summary',
        why: "Repeating the same read after a turn teaches the app's update loop."
      },
      {
        id: 'navigation-optional-formulas',
        title: 'Optional formulas',
        body: 'Open FormulaTips only when you want the calculation details behind a result.',
        targetId: 'model-explanation',
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
    recommendedPath: 'Run context -> Turn Summary / Recap -> Recovery -> Routing -> Debug',
    framing: {
      system: 'Expose the app surfaces used for deeper analysis and evidence review.',
      experience: 'Analyst deep-dive for understanding why the current read holds or breaks.'
    },
    steps: [
      {
        id: 'analyst-read-fitness-first',
        title: 'Read fitness first',
        body: 'Check Data Fitness before interpreting any other module.',
        targetId: 'system-health',
        why: 'The analyst workflow always starts by confirming the data is interpretable.'
      },
      {
        id: 'analyst-review-latest-action',
        title: 'Review the latest action',
        body: 'Use Turn Summary / Recent Action to understand the most recent update.',
        targetId: 'turn-summary',
        why: 'Recent Action explains whether the current turn strengthened or weakened evidence.'
      },
      {
        id: 'analyst-inspect-user-summary',
        title: 'Inspect the user summary',
        body: 'Open Selected User Summary and compare declared tags vs observed behavior, target agreement vs cohort separability, and the rater signal profile.',
        targetId: 'selected-user-summary',
        why: 'This is the core analyst read for a single user.'
      },
      {
        id: 'analyst-use-formulas',
        title: 'Use formula details as needed',
        body: 'Open FormulaTips only when you need calculation transparency for the user summary.',
        targetId: 'model-explanation',
        why: 'The formulas support the analysis, but should not replace the main read.'
      },
      {
        id: 'analyst-read-island-evidence',
        title: 'Read the island evidence',
        body: 'Inspect Selected Island for audience fit, cohort comparison, affinity evidence, and weighted ratings.',
        targetId: 'selected-island',
        why: 'Island-level evidence shows how the recommendation surface is being justified.'
      },
      {
        id: 'analyst-check-routing',
        title: 'Check routing',
        body: 'Use Discovery Routing and Recommended unrated islands, then inspect top route when a recommendation exists.',
        targetId: 'discovery-routing',
        why: 'Routing is the analyst-facing path to the next likely probe.'
      },
      {
        id: 'analyst-audit-recovery',
        title: 'Audit recovery',
        body: 'Open Reviewer Archetype Recovery as an audit step, not the primary read path.',
        targetId: 'reviewer-archetype-recovery',
        why: 'Recovery is useful for validation, but should not replace the main analysis surfaces.'
      },
      {
        id: 'analyst-validate-only-when-needed',
        title: 'Validate only when needed',
        body: 'Use Debug only for hidden checksum or generator validation.',
        targetId: 'debug-data',
        why: 'Debug belongs at the end of the workflow, not the beginning.'
      },
      {
        id: 'analyst-advance-and-compare',
        title: 'Advance and compare',
        body: 'Advance a turn and check whether the new evidence strengthens, separates, or contradicts the previous read.',
        targetId: 'turn-summary',
        why: "The analyst workflow closes by testing whether the model's story holds after new evidence arrives."
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
