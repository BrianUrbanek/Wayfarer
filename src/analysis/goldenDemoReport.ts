import type { ScenarioPreset } from '../model/scenarioPresets.js';
import { buildConfidenceGrowthRows } from '../model/confidenceGrowth.js';
import { buildDiscoverySignalAnalysis } from '../model/discoverySignal.js';
import { buildHiddenCohortRecoveryReport } from '../model/hiddenCohortRecovery.js';
import { buildIslandTruthComparison } from '../model/islandTruthComparison.js';
import { buildTurnRecapReport } from '../model/turnRecap.js';
import { buildUserDeprioritizationAnalysis } from '../model/deprioritization.js';
import type { SimulationState } from '../model/simulation.js';
import type { IslandId } from '../model/types.js';

export interface GoldenDemoReportSection {
  readonly heading: string;
  readonly body: string[];
}

export interface GoldenDemoReportExample {
  readonly islandId: IslandId;
  readonly islandLabel: string;
  readonly hiddenTruthClassLabel: string;
  readonly statusLabel: string;
  readonly summary: string;
  readonly learnedHeadline: string;
}

export interface GoldenDemoReport {
  readonly title: string;
  readonly scenario: {
    readonly slug: string;
    readonly label: string;
    readonly description: string;
    readonly goodFor: string;
    readonly seed: number;
    readonly numUsers: number;
    readonly numIslands: number;
    readonly bootstrapRatingsPerUser: number;
    readonly turnMode: string;
    readonly participatingUsersPerTurn: number;
    readonly organicRatingsPerUser: number;
    readonly guidedRecommendationsPerUser: number;
    readonly routingRiskProfile: string;
    readonly turnsToRun: number;
  };
  readonly sections: GoldenDemoReportSection[];
  readonly hiddenTruthDistribution: {
    readonly seedCohortCount: number;
    readonly unseededCohortCount: number;
    readonly randomIslandCount: number;
  };
  readonly seededVsUnseededRecovery: {
    readonly seedRecoveredCount: number;
    readonly seedEmergingCount: number;
    readonly unseededRecoveredCount: number;
    readonly unseededEmergingCount: number;
    readonly unresolvedCount: number;
    readonly randomCorrectlyUncertainCount: number;
    readonly possibleOverfitCount: number;
    readonly summary: string;
  };
  readonly examples: GoldenDemoReportExample[];
  readonly confidenceMovement: {
    readonly rowCount: number;
    readonly firstTurn: number | null;
    readonly lastTurn: number | null;
    readonly summary: string;
  };
  readonly discoverySignal: {
    readonly totalEvents: number;
    readonly highlights: Array<{
      readonly userId: string;
      readonly score: number;
      readonly summary: string;
      readonly eventCount: number;
    }>;
  };
  readonly routingSummary: {
    readonly routedIslandCount: number;
    readonly discoveryProbeVolume: number;
    readonly safeFitVolume: number;
    readonly topDeprioritizationSummary: string;
  };
  readonly caveats: readonly string[];
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatSigned(value: number, digits = 3): string {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}`;
}

function limit<T>(values: readonly T[], count: number): T[] {
  return values.slice(0, count);
}

function summarizeConfidence(rows: ReturnType<typeof buildConfidenceGrowthRows>): string {
  if (rows.length === 0) {
    return 'No confidence series is available yet.';
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  return `Confidence moved from ${formatPercent(first.averageIslandCohortConfidence)} at turn ${first.turn} to ${formatPercent(last.averageIslandCohortConfidence)} at turn ${last.turn}; RD/effective-weight movement is visible in the turn recap cards.`;
}

export function buildGoldenDemoReport(input: {
  readonly state: SimulationState;
  readonly scenario: ScenarioPreset;
}): GoldenDemoReport {
  const { state, scenario } = input;
  const cohortLabelById = new Map(state.cohorts.map((cohort) => [cohort.id, cohort.label] as const));
  const hiddenCohortRecovery = buildHiddenCohortRecoveryReport({
    hiddenTasteCohorts: state.hiddenTasteCohorts,
    users: state.users,
    islands: state.islands,
    ratingEvents: state.ratingEvents,
    observedBehaviorEvents: state.observedBehaviorEvents,
    islandAffinityReports: state.islandAffinityReports,
    cohortLabelById
  });
  const turnRecap = buildTurnRecapReport({
    turnHistory: state.turnHistory,
    islandCohortRatingSnapshots: state.islandCohortRatingSnapshots,
    islands: state.islands,
    cohorts: state.cohorts,
    islandLabelById: new Map(state.islands.map((island) => [island.id, island.label] as const)),
    cohortLabelById
  });
  const confidenceRows = buildConfidenceGrowthRows(state);
  const discoverySignal = buildDiscoverySignalAnalysis(state);
  const selectedDeprioritization = state.users
    .map((user) => ({
      userId: user.id,
      analysis: buildUserDeprioritizationAnalysis(
        user,
        state.islandAffinityReports,
        state.raterSignalProfiles.get(user.id),
        state.islands,
        { topLimit: 3 }
      )
    }))
    .sort((left, right) => right.analysis.rows.length - left.analysis.rows.length || left.userId.localeCompare(right.userId))[0]
    ?.analysis ?? { userId: '', rows: [] };

  const examples = limit(
    state.islands
      .filter((island) => island.hiddenTruthClass !== undefined)
      .map((island) => {
        const report = buildIslandTruthComparison({
          island,
          affinityReport: state.islandAffinityReports.get(island.id),
          hiddenTasteCohorts: state.hiddenTasteCohorts,
          cohortLabelById
        });

        return {
          islandId: island.id,
          islandLabel: island.label,
          hiddenTruthClassLabel: report.hiddenTruthClassLabel,
          statusLabel: report.statusLabel,
          summary: report.summarySentence,
          learnedHeadline: report.headlineEstimate
            ? `${report.headlineEstimate.cohortLabel} affinity ${formatSigned(report.headlineEstimate.affinity)} / confidence ${formatPercent(report.headlineEstimate.confidence)}`
            : 'No learned estimate yet'
        };
      })
      .sort((left, right) => left.statusLabel.localeCompare(right.statusLabel) || left.islandLabel.localeCompare(right.islandLabel)),
    4
  );

  const sections: GoldenDemoReportSection[] = [
    {
      heading: 'Scenario configuration',
      body: [
        `Preset: ${scenario.label} (${scenario.id})`,
        scenario.description,
        `Good for: ${scenario.goodFor}`,
        `Seed: ${scenario.generatorConfig.seed}`,
        `Users: ${scenario.generatorConfig.numUsers}, islands: ${scenario.generatorConfig.numIslands}, bootstrap ratings / user: ${scenario.generatorConfig.bootstrapRatingsPerUser}`,
        `Turn policy: ${scenario.turnPolicy.turnMode} with ${scenario.turnPolicy.participatingUsersPerTurn} participating users/turn, ${scenario.turnPolicy.organicRatingsPerUser} organic ratings/user, ${scenario.turnPolicy.guidedRecommendationsPerUser} guided recommendations/user, routing risk ${scenario.turnPolicy.routingRiskProfile}`,
        `Turns to run: ${scenario.turnsToRun}`
      ]
    },
    {
      heading: 'Hidden truth distribution',
      body: [
        `Seeded hidden cohorts: ${hiddenCohortRecovery.seedHiddenCohortCount}`,
        `Unseeded hidden cohorts: ${hiddenCohortRecovery.unseededHiddenCohortCount}`,
        `Random islands in the audit data: ${hiddenCohortRecovery.randomIslandCount}`,
        `Toy-world hidden truth stays separate from the learned read and exists only for audit comparison.`
      ]
    },
    {
      heading: 'Seeded vs unseeded recovery summary',
      body: [
        `Seeded recovered: ${hiddenCohortRecovery.seedRecoveredCount} / ${hiddenCohortRecovery.seedHiddenCohortCount}`,
        `Seeded emerging: ${hiddenCohortRecovery.seedEmergingCount}`,
        `Unseeded recovered: ${hiddenCohortRecovery.unseededRecoveredCount} / ${hiddenCohortRecovery.unseededHiddenCohortCount}`,
        `Unseeded emerging: ${hiddenCohortRecovery.unseededEmergingCount}`,
        `Unresolved: ${hiddenCohortRecovery.unresolvedCount}`,
        `Random correctly uncertain: ${hiddenCohortRecovery.randomCorrectlyUncertainCount}`,
        `Possible overfit: ${hiddenCohortRecovery.possibleOverfitCount}`,
        hiddenCohortRecovery.summarySentence
      ]
    },
    {
      heading: 'Confidence / RD / volatility movement summary',
      body: [
        summarizeConfidence(confidenceRows),
        `Latest turn recap: ${turnRecap.summarySentence}`
      ]
    },
    {
      heading: 'Discovery Signal highlights',
      body: [
        `Observed behavior events: ${discoverySignal.totalEvents}`,
        ...limit(
          Array.from(discoverySignal.byUserId.values())
            .sort((left, right) => right.score - left.score || left.userId.localeCompare(right.userId))
            .map((profile) => `User ${profile.userId}: score ${profile.score.toFixed(3)}, ${profile.eventCount} events, ${profile.summary}`),
          3
        )
      ]
    },
    {
      heading: 'Routing and deprioritization summary',
      body: [
        `Routed islands (latest turn recap total): ${turnRecap.highlightRows.length > 0 ? turnRecap.highlightRows.length : 0}`,
        `Discovery probe volume: ${turnRecap.highlightRows.reduce((sum, row) => sum + (row.moverKind === 'evidence' ? 1 : 0), 0)}`,
        `Safe-fit volume: ${turnRecap.meaningfulMoverCount}`,
        selectedDeprioritization.rows.length > 0
          ? `Top deprioritization example: ${selectedDeprioritization.rows[0].islandId} for ${selectedDeprioritization.userId} (predicted fit ${formatSigned(selectedDeprioritization.rows[0].predictedFit)}, support ${formatPercent(selectedDeprioritization.rows[0].confidenceSupport)})`
          : 'No clean deprioritization example surfaced for this run.'
      ]
    },
    {
      heading: 'Selected examples of hidden truth vs learned estimate',
      body: examples.length > 0
        ? examples.map((example) => {
            return `${example.islandLabel} [${example.hiddenTruthClassLabel}] -> ${example.statusLabel}; ${example.summary} Learned: ${example.learnedHeadline}`;
          })
        : ['No hidden truth examples were available in this run.']
    }
  ];

  return {
    title: 'Golden Demo Presentation Report',
    scenario: {
      slug: scenario.id,
      label: scenario.label,
      description: scenario.description,
      goodFor: scenario.goodFor,
      seed: scenario.generatorConfig.seed,
      numUsers: scenario.generatorConfig.numUsers,
      numIslands: scenario.generatorConfig.numIslands,
      bootstrapRatingsPerUser: scenario.generatorConfig.bootstrapRatingsPerUser,
      turnMode: scenario.turnPolicy.turnMode,
      participatingUsersPerTurn: scenario.turnPolicy.participatingUsersPerTurn,
      organicRatingsPerUser: scenario.turnPolicy.organicRatingsPerUser,
      guidedRecommendationsPerUser: scenario.turnPolicy.guidedRecommendationsPerUser,
      routingRiskProfile: scenario.turnPolicy.routingRiskProfile,
      turnsToRun: scenario.turnsToRun
    },
    sections,
    hiddenTruthDistribution: {
      seedCohortCount: hiddenCohortRecovery.seedHiddenCohortCount,
      unseededCohortCount: hiddenCohortRecovery.unseededHiddenCohortCount,
      randomIslandCount: hiddenCohortRecovery.randomIslandCount
    },
    seededVsUnseededRecovery: {
      seedRecoveredCount: hiddenCohortRecovery.seedRecoveredCount,
      seedEmergingCount: hiddenCohortRecovery.seedEmergingCount,
      unseededRecoveredCount: hiddenCohortRecovery.unseededRecoveredCount,
      unseededEmergingCount: hiddenCohortRecovery.unseededEmergingCount,
      unresolvedCount: hiddenCohortRecovery.unresolvedCount,
      randomCorrectlyUncertainCount: hiddenCohortRecovery.randomCorrectlyUncertainCount,
      possibleOverfitCount: hiddenCohortRecovery.possibleOverfitCount,
      summary: hiddenCohortRecovery.summarySentence
    },
    examples,
    confidenceMovement: {
      rowCount: confidenceRows.length,
      firstTurn: confidenceRows[0]?.turn ?? null,
      lastTurn: confidenceRows.at(-1)?.turn ?? null,
      summary: summarizeConfidence(confidenceRows)
    },
    discoverySignal: {
      totalEvents: discoverySignal.totalEvents,
      highlights: limit(
        Array.from(discoverySignal.byUserId.values())
          .sort((left, right) => right.score - left.score || left.userId.localeCompare(right.userId))
          .map((profile) => ({
            userId: profile.userId,
            score: profile.score,
            summary: profile.summary,
            eventCount: profile.eventCount
          })),
        3
      )
    },
    routingSummary: {
      routedIslandCount: turnRecap.highlightRows.length,
      discoveryProbeVolume: turnRecap.highlightRows.reduce((sum, row) => sum + (row.moverKind === 'evidence' ? 1 : 0), 0),
      safeFitVolume: turnRecap.meaningfulMoverCount,
      topDeprioritizationSummary:
        selectedDeprioritization.rows.length > 0
          ? `${selectedDeprioritization.rows[0].islandId} for ${selectedDeprioritization.userId}`
          : 'n/a'
    },
    caveats: [
      'Hidden truth is toy-world audit data, not production-known truth.',
      'Observed behavior is synthetic and proxy-derived.',
      'The Glicko-shaped substrate is not canonical Glicko-2.'
    ]
  };
}

export function renderGoldenDemoReportMarkdown(report: GoldenDemoReport): string {
  const lines: string[] = [];
  lines.push(`# ${report.title}`);
  lines.push(`Scenario: ${report.scenario.label} (${report.scenario.slug})`);
  lines.push('');

  for (const section of report.sections) {
    lines.push(`## ${section.heading}`);
    for (const line of section.body) {
      lines.push(`- ${line}`);
    }
    lines.push('');
  }

  lines.push('## Caveats');
  for (const caveat of report.caveats) {
    lines.push(`- ${caveat}`);
  }

  return lines.join('\n');
}
