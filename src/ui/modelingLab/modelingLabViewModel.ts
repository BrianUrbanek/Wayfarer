import type {
  ExpectedSeedRelation,
  HiddenActorRelationChecksum,
  InferredActorAuthoritySummary,
  ModelingTraceRun,
  ScenarioAuthorityComparison
} from '../../modeling-core/types';

export interface ModelingRunSummary {
  fixtureId: string;
  fixtureDescription: string;
  stepCount: number;
  validationPassed: boolean | null;
  hiddenTruthPolicy: string;
  unsupportedConcepts: string[];
}

export interface ModelingAuthorityRow {
  actorId: string;
  label: string;
  visibleRelation: ExpectedSeedRelation;
  expectedRelation: ExpectedSeedRelation | null;
  seedId: string | null;
  lane: string;
  overlapCount: number;
  agreementCount: number;
  contradictionCount: number;
  inverseMatchCount: number;
  proxyStrength: number | null;
  validationResult: 'PASS' | 'FAIL' | 'n/a';
  explanation: string;
}

export interface ModelingHiddenTruthRow {
  actorId: string;
  label: string;
  expectedRelationToSeed: ExpectedSeedRelation;
  seedId: string | null;
  laneScope: string;
  hiddenSimilarity: number;
  explanation: string;
}

export interface ModelingValidationRow {
  actorId: string;
  expectedRelation: ExpectedSeedRelation;
  inferredRelation: ExpectedSeedRelation;
  passed: boolean;
  explanation: string;
}

export interface ModelingRunViewModel {
  runSummary: ModelingRunSummary;
  authorityRows: ModelingAuthorityRow[];
  hiddenTruthRows: ModelingHiddenTruthRow[];
  hiddenTruthNotice: string;
  validationRows: ModelingValidationRow[];
  rawTrace: ModelingTraceRun;
}

const HIDDEN_TRUTH_NOTICE = 'ORACLE / TEST TRUTH - not model input';

function summarizeHiddenTruthPolicy(trace: ModelingTraceRun): string {
  const policy = trace.fixtureOracle?.hiddenTruthChecksum?.oraclePolicy;
  if (!policy) {
    return 'No hidden truth checksum is attached to this fixture.';
  }

  return [
    policy.hiddenTruthMayGenerateEvents ? 'Hidden truth may generate events' : null,
    policy.hiddenTruthMayValidateOutcomes ? 'may validate outcomes' : null,
    policy.hiddenTruthMayNotDriveModelInference ? 'may not drive model inference' : null
  ].filter((entry): entry is string => Boolean(entry)).join('; ');
}

function unsupportedConcepts(trace: ModelingTraceRun): string[] {
  return Array.from(new Set(trace.steps.flatMap((step) => step.unsupportedConcepts)));
}

function validationByActor(comparisons: readonly ScenarioAuthorityComparison[] | undefined): Map<string, ScenarioAuthorityComparison> {
  return new Map((comparisons ?? []).map((comparison) => [comparison.actorId, comparison]));
}

function hiddenChecksumByActor(
  actors: Record<string, HiddenActorRelationChecksum> | undefined
): Map<string, HiddenActorRelationChecksum> {
  return new Map(Object.values(actors ?? {}).map((actor) => [actor.actorId, actor]));
}

function buildAuthorityRow(
  summary: InferredActorAuthoritySummary,
  expected: HiddenActorRelationChecksum | undefined,
  validation: ScenarioAuthorityComparison | undefined
): ModelingAuthorityRow {
  return {
    actorId: summary.actorId,
    label: summary.label,
    visibleRelation: summary.inferredRelationToSeed,
    expectedRelation: expected?.expectedRelationToSeed ?? null,
    seedId: summary.seedPlayerId ?? expected?.seedPlayerId ?? null,
    lane: summary.tag ?? expected?.laneScope.join(', ') ?? 'n/a',
    overlapCount: summary.overlapCount,
    agreementCount: summary.matchedRatings,
    contradictionCount: summary.contradictions,
    inverseMatchCount: summary.inverseMatches,
    proxyStrength: summary.proxyStrength ?? null,
    validationResult: validation ? (validation.passed ? 'PASS' : 'FAIL') : 'n/a',
    explanation: summary.explanation
  };
}

export function buildModelingRunViewModel(trace: ModelingTraceRun): ModelingRunViewModel {
  const expectedActors = hiddenChecksumByActor(trace.fixtureOracle?.hiddenTruthChecksum?.actors);
  const validations = validationByActor(trace.scenarioAuthorityValidation?.comparisons);

  return {
    runSummary: {
      fixtureId: trace.fixtureId,
      fixtureDescription: trace.fixtureDescription,
      stepCount: trace.steps.length,
      validationPassed: trace.scenarioAuthorityValidation?.passed ?? null,
      hiddenTruthPolicy: summarizeHiddenTruthPolicy(trace),
      unsupportedConcepts: unsupportedConcepts(trace)
    },
    authorityRows: (trace.authoritySummary ?? []).map((summary) =>
      buildAuthorityRow(summary, expectedActors.get(summary.actorId), validations.get(summary.actorId))
    ),
    hiddenTruthRows: Object.values(trace.fixtureOracle?.hiddenTruthChecksum?.actors ?? {}).map((actor) => ({
      actorId: actor.actorId,
      label: actor.label,
      expectedRelationToSeed: actor.expectedRelationToSeed,
      seedId: actor.seedPlayerId ?? null,
      laneScope: actor.laneScope.join(', '),
      hiddenSimilarity: actor.hiddenSimilarity,
      explanation: actor.explanation
    })),
    hiddenTruthNotice: HIDDEN_TRUTH_NOTICE,
    validationRows: (trace.scenarioAuthorityValidation?.comparisons ?? []).map((comparison) => ({
      actorId: comparison.actorId,
      expectedRelation: comparison.expectedRelationToSeed,
      inferredRelation: comparison.inferredRelationToSeed,
      passed: comparison.passed,
      explanation: comparison.explanation
    })),
    rawTrace: trace
  };
}
