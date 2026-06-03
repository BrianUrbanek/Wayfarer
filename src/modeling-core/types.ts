export type TagId = string;
export type ModelId = string;
export type RatingValue = -1 | 0 | 1;
export type RatingEventSource = 'organic' | 'guided';
export type RatingFocusMeaning = 'expectationFulfillment';
export type RatingRevisionReason = 'initialRating' | 'playerChangedMind' | 'islandUpdated' | 'rulesChanged' | 'standardsEvolved' | 'guidedReevaluation';
export type SelectionReason =
  | 'declaredPreferenceFit'
  | 'observedAffinityFit'
  | 'declaredObservedMismatchProbe'
  | 'cohortBoundaryProbe'
  | 'negativeAffinityConfirmation'
  | 'highValueScoutOpportunity';

export interface RatingEvent {
  readonly id: string;
  readonly turn: number;
  readonly userId: ModelId;
  readonly islandId: ModelId;
  readonly rating: RatingValue;
  readonly source: RatingEventSource;
  readonly focusTag?: TagId;
  readonly focusMeaning?: RatingFocusMeaning;
  readonly selectionReason?: SelectionReason;
  readonly revisionReason?: RatingRevisionReason;
  readonly supersedesEventId?: string;
  readonly islandVersionId?: string;
  readonly gameRulesVersionId?: string;
}

export interface RatingLedgerEntry {
  readonly entryId: string;
  readonly eventId: string;
  readonly playerId: ModelId;
  readonly islandId: ModelId;
  readonly rating: RatingValue;
  readonly focusTag?: TagId;
  readonly focusMeaning?: RatingFocusMeaning;
  readonly source: RatingEventSource;
  readonly selectionReason?: SelectionReason;
  readonly turn: number;
  readonly reason: RatingRevisionReason;
  readonly supersedesEntryId?: string;
  readonly islandVersionId?: string;
  readonly gameRulesVersionId?: string;
}

export type RatingEvidenceSourceClass = 'ordinaryPlayer' | 'highSignalPlayer' | 'cohortSeed' | 'seedProxy' | 'guidedDiagnostic';
export type RatingEvidenceAuthorityBasis = 'ordinaryRating' | 'learnedPredictiveUsefulness' | 'directSeed' | 'learnedSimilarityToSeed' | 'diagnosticContext';

export interface RatingEvidenceProjection {
  readonly projectionId: string;
  readonly ledgerEntryId: string;
  readonly activeForCurrentIslandVersion: boolean;
  readonly versionCompatibility: number;
  readonly temporalDecayMultiplier: number;
  readonly supersededByPlayer: boolean;
  readonly contributesToIslandEstimate: boolean;
  readonly contributesToPlayerSignalLearning: boolean;
  readonly sourceClass: RatingEvidenceSourceClass;
  readonly authorityBasis: RatingEvidenceAuthorityBasis;
  readonly proxyForSeedIds: string[];
  readonly proxyStrengthBySeed: Record<string, number>;
  readonly signalStrength: number;
  readonly polarity: number;
  readonly trainingEligible: boolean;
  /** Rating/event turn that created the historical ledger entry. */
  readonly eventTurn: number;
  /** Completed model-state turn read while calculating this projection. */
  readonly readModelStateTurn: number;
  /** Turn whose atomic Phase 3 produced this projection. */
  readonly projectedTurn: number;
  /** Backward-compatible alias for projectedTurn. */
  readonly calculatedAtTurn: number;
  readonly modelVersion: string;
}

export interface ProjectionDirtyRecord {
  readonly targetType: 'island' | 'player';
  readonly targetId: ModelId;
  readonly reason: string;
  readonly causedByEntryId?: string;
  readonly markedTurn?: number;
  readonly processedTurn?: number;
  readonly processingStatus?: 'pending' | 'processed';
}

export interface SeedProxyRelationship {
  readonly seedPlayerId: ModelId;
  readonly tag: TagId;
  readonly similarity: number;
  readonly matchedRatings: number;
  readonly overlappingRatings: number;
  readonly contradictions: number;
  readonly proxyStrength: number;
  readonly proxyRD: number;
  readonly establishedTurn: number;
}

export interface SourceAuthorityTrace {
  readonly playerId: ModelId;
  readonly sourceClass: RatingEvidenceSourceClass;
  readonly authorityBasis: RatingEvidenceAuthorityBasis;
  readonly seedPlayerId: ModelId;
  readonly tag: TagId;
  readonly overlapCount: number;
  readonly matchedRatings: number;
  readonly contradictions: number;
  readonly similarity: number;
  readonly proxyStrength: number;
  readonly proxyRD: number;
  readonly establishedTurn: number;
  readonly explanation: string;
}

export interface RetroactiveProjectionTrace {
  readonly ledgerEntryId: string;
  readonly islandId: ModelId;
  readonly sourceClassBefore: RatingEvidenceSourceClass;
  readonly sourceClassAfter: RatingEvidenceSourceClass;
  readonly signalStrengthBefore: number;
  readonly signalStrengthAfter: number;
  readonly proxyForSeedIds: string[];
  readonly calculatedAtTurn: number;
  readonly reason: 'seedProxyEstablished' | 'seedProxyActive';
}

export interface PlayerSignalModel {
  trustEstimate: number;
  trustRD: number;
  signalVolatility: number;
  sourceAuthority: number;
  /** Backward-compatible aggregate lane signal used by rating evidence strength. */
  laneSignalByTag: Record<TagId, number>;
  /** 0..1 lane-local usefulness as a signal source for other players. */
  signalUsefulnessByTag: Record<TagId, number>;
  /** -1..1 lane-local polarity: positive scout, inverse scout, or mixed. */
  signalAlignmentByTag: Record<TagId, number>;
  /** Lane-local uncertainty in usefulness/alignment estimates. */
  signalRDByTag: Record<TagId, number>;
  /** Lane-local instability/context-dependence as a signal source. */
  signalVolatilityByTag: Record<TagId, number>;
  /** Silent lane-local seed proxies derived from Advogato-style overlap with trust roots. */
  seedProxyByTag?: Record<TagId, SeedProxyRelationship[]>;
}

export interface PlayerPreferenceModel {
  id: ModelId;
  label: string;
  declaredAffinityByTag: Record<TagId, number>;
  demonstratedAffinityByTag: Record<TagId, number>;
  activeRoutingAffinityByTag: Record<TagId, number>;
  preferenceRDByTag: Record<TagId, number>;
  signalModel: PlayerSignalModel;
}

export interface IslandTasteModel {
  id: ModelId;
  label: string;
  descriptiveTagProfile: Record<TagId, number>;
  audienceFitByTag: Record<TagId, number>;
  audienceFitRDByTag: Record<TagId, number>;
  audienceFitVolatilityByTag: Record<TagId, number>;
  rawObservations: {
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
  };
}

export interface ModelingCoreState {
  allTags: TagId[];
  players: PlayerPreferenceModel[];
  islands: IslandTasteModel[];
  ratingEvents: RatingEvent[];
  ratingLedger: RatingLedgerEntry[];
  evidenceProjections: RatingEvidenceProjection[];
  dirtyProjections: ProjectionDirtyRecord[];
}

export type HiddenActorArchetype =
  | 'seed'
  | 'seedLike'
  | 'almostSeedLike'
  | 'inverseSeedLike'
  | 'disconnected'
  | 'noisy'
  | 'custom';

export type HiddenIslandTruthClass =
  | 'seedPositiveUnrated'
  | 'seedNegativeUnrated'
  | 'overlapCalibration'
  | 'wrongLaneControl'
  | 'disconnectedControl'
  | 'custom';

export interface HiddenPlayerTruth {
  preferenceByTag: Record<TagId, number>;
  actorId?: ModelId;
  label?: string;
  behaviorArchetype?: HiddenActorArchetype;
  seedReferenceId?: ModelId;
  seedSimilarity?: number;
  inverseSimilarity?: number;
  laneScope?: TagId[];
  ratingAlignment?: number;
  contradictionRate?: number;
  explorationBias?: number;
  notes?: string;
}

export interface HiddenIslandTruth {
  descriptiveTagProfile?: Record<TagId, number>;
  audienceFitByTag?: Record<TagId, number>;
  islandId?: ModelId;
  label?: string;
  truthClass?: HiddenIslandTruthClass;
  intendedSeedFitById?: Record<ModelId, number>;
  laneScope?: TagId[];
  notes?: string;
}



export type ExpectedSeedRelation = 'seed' | 'seedProxy' | 'ordinarySimilar' | 'inverseSignal' | 'unrelated';

export interface HiddenActorRelationChecksum {
  readonly actorId: ModelId;
  readonly label: string;
  readonly seedPlayerId?: ModelId;
  readonly expectedRelationToSeed: ExpectedSeedRelation;
  readonly laneScope: TagId[];
  /** Hidden oracle similarity; positive values mean seed-like, negative values mean inverse-like. */
  readonly hiddenSimilarity: number;
  readonly explanation: string;
}

export interface HiddenIslandTruthChecksum {
  readonly islandId: ModelId;
  readonly label: string;
  readonly expectedSeedFitById: Record<ModelId, number>;
  readonly seedActuallyRated: boolean;
  readonly laneScope: TagId[];
  readonly truthClass: HiddenIslandTruthClass;
}

export interface HiddenTruthChecksum {
  readonly scenarioId: string;
  readonly oraclePolicy: {
    readonly hiddenTruthMayGenerateEvents: true;
    readonly hiddenTruthMayValidateOutcomes: true;
    readonly hiddenTruthMayNotDriveModelInference: true;
  };
  readonly actors: Record<ModelId, HiddenActorRelationChecksum>;
  readonly islands: Record<ModelId, HiddenIslandTruthChecksum>;
}

export interface InferredActorAuthoritySummary {
  readonly actorId: ModelId;
  readonly label: string;
  readonly seedPlayerId?: ModelId;
  readonly inferredRelationToSeed: ExpectedSeedRelation;
  readonly tag?: TagId;
  readonly overlapCount: number;
  readonly matchedRatings: number;
  readonly contradictions: number;
  readonly inverseMatches: number;
  readonly similarity: number;
  readonly proxyStrength?: number;
  readonly source: 'visibleLedgerAndProjectionStateOnly';
  readonly explanation: string;
}

export interface ScenarioAuthorityComparison {
  readonly actorId: ModelId;
  readonly expectedRelationToSeed: ExpectedSeedRelation;
  readonly inferredRelationToSeed: ExpectedSeedRelation;
  readonly passed: boolean;
  readonly explanation: string;
}

export interface ScenarioAuthorityValidationSummary {
  readonly hiddenTruthUsedFor: readonly ['eventGeneration', 'endOfRunValidation'];
  readonly hiddenTruthNotUsedFor: readonly ['sourceAuthorityInference', 'evidenceProjection', 'recommendationRouting'];
  readonly comparisons: ScenarioAuthorityComparison[];
  readonly passed: boolean;
}

export interface ModelingFixtureOracle {
  hiddenPlayers: Record<ModelId, HiddenPlayerTruth>;
  hiddenIslands: Record<ModelId, HiddenIslandTruth>;
  expectedBehavior: string[];
  hiddenTruthChecksum?: HiddenTruthChecksum;
}


export interface ModelingFixtureState {
  initialState: ModelingCoreState;
  ratingEvent?: RatingEvent;
  ratingEvents?: RatingEvent[];
  description: string;
  oracle?: ModelingFixtureOracle;
}

export interface PredictionComponent {
  tag: TagId;
  playerAffinity: number;
  islandAudienceFit: number;
  contribution: number;
}

export interface ModelingPrediction {
  islandId: ModelId;
  predictedRating: number;
  confidence: number;
  averageIslandRD: number;
  averageIslandVolatility: number;
  averagePlayerRD: number;
  playerPreferenceConfidence: number;
  islandConfidence: number;
  scoutValue: number;
  components: PredictionComponent[];
}

export type RecommendationKind = 'SAFE_FIT' | 'SMART_GAMBLE' | 'DISCOVERY_PROBE' | 'SUPPRESS_OR_AVOID' | 'GUIDED_DISCOVERY';

export type RoutingReasonKind = 'safeFit' | 'smartGamble' | 'discoveryProbe' | 'suppressOrAvoid' | 'guidedDiscovery';

export interface RoutingReasonFactor {
  reason: RoutingReasonKind;
  rawMagnitude: number;
  normalizedMagnitude: number;
  explanation: string;
}

export interface RoutingDecisionTrace {
  predictedFit: number;
  positiveFit: number;
  negativeFit: number;
  playerPreferenceConfidence: number;
  islandAudienceConfidence: number;
  combinedConfidence: number;
  volatilityMultiplier: number;
  scoutValue: number;
  explorationValue: number;
  declaredFit: number;
  demonstratedFit: number;
  declaredDemonstratedGap: number;
  safeFitScore: number;
  smartGambleScore: number;
  discoveryProbeScore: number;
  suppressOrAvoidScore: number;
  guidedDiscoveryScore: number;
  primaryReason: RoutingReasonKind;
  explanation: string;
  factors: RoutingReasonFactor[];
}

export interface RecommendationFacingEntry extends ModelingPrediction {
  kind: RecommendationKind;
  routingScore: number;
  routingTrace: RoutingDecisionTrace;
}

export interface RatingEvidence {
  assignedRating: RatingValue;
  trainingEligible: boolean;
  focusTag: TagId | null;
  focusMeaning: RatingFocusMeaning | null;
  signalStrength: number;
  raterSignalEstimate: number;
  trustEstimate: number;
  trustRD: number;
  signalVolatility: number;
  sourceAuthority: number;
  laneAlignment: number;
  diagnosticContextWeight: number;
  laneSignalUsefulness: number;
  laneSignalPolarity: number;
  laneSignalRD: number;
  laneSignalVolatility: number;
  laneSignalConfidence: number;
  laneSignalStability: number;
  lanePolarityClarity: number;
  aggregateTrustConfidence: number;
  aggregateTrustStability: number;
  signalBaseStrength: number;
  signalConfidenceMultiplier: number;
  signalStabilityMultiplier: number;
  signalPolarityClarityMultiplier: number;
  signalContextMultiplier: number;
}

export interface UpdateAllocation {
  playerUpdateShare: number;
  islandUpdateShare: number;
  playerAverageRD: number;
  islandAverageRD: number;
  focusTagIslandBias: number;
}

export interface TagDelta {
  tag: TagId;
  before: number;
  after: number;
  delta: number;
}

export interface RdDelta {
  tag: TagId;
  before: number;
  after: number;
}

export type UpdateReasonKind =
  | 'nonTraining'
  | 'playerLessCertain'
  | 'islandLessCertain'
  | 'balancedUncertainty'
  | 'confidenceConflict'
  | 'focusedExpectationFailure';

export interface UncertaintyInputsTrace {
  playerAverageRD: number | null;
  islandAverageRD: number | null;
  playerConfidence: number | null;
  islandConfidence: number | null;
  normalizedSurprise: number | null;
  confidenceConflict: number | null;
  signalStrength: number;
}

export interface UpdateReasonFactor {
  reason: UpdateReasonKind;
  rawMagnitude: number;
  normalizedMagnitude: number;
  explanation: string;
}

export interface UpdateReasonTrace {
  primaryReason: UpdateReasonKind;
  explanation: string;
  factors: UpdateReasonFactor[];
}

export interface LearningPressureTrace {
  predictionError: number | null;
  surprise: number | null;
  normalizedSurprise: number | null;
  playerConfidence: number | null;
  islandConfidence: number | null;
  confidenceConflict: number | null;
  estimateUpdateMultiplier: number;
  volatilityPressure: number;
  contradictionDampened: boolean;
  updateTags: TagId[];
  uncertaintyInputs: UncertaintyInputsTrace;
  updateReason: UpdateReasonTrace;
}

export interface ModelUpdateTrace {
  learningPressure: LearningPressureTrace;
  audienceFitDeltas: TagDelta[];
  demonstratedAffinityDeltas: TagDelta[];
  islandRDDeltas: RdDelta[];
  playerRDDeltas: RdDelta[];
  islandVolatilityDeltas: RdDelta[];
  rawObservationDelta: {
    positiveCount: number;
    neutralCount: number;
    negativeCount: number;
  };
}

export interface SignalAggregateDelta {
  field: 'trustEstimate' | 'trustRD' | 'signalVolatility';
  before: number;
  after: number;
  delta: number;
}

export interface PlayerSignalLearningTrace {
  trainingEligible: boolean;
  updateTags: TagId[];
  predictionError: number | null;
  normalizedSurprise: number | null;
  consistencyScore: number | null;
  signalLearningWeight: number;
  usefulnessDeltas: TagDelta[];
  alignmentDeltas: TagDelta[];
  signalRDDeltas: RdDelta[];
  signalVolatilityDeltas: RdDelta[];
  aggregateDeltas: SignalAggregateDelta[];
  explanation: string;
}

export interface ModelingAlgorithms {
  predictionModel: {
    predictPlayerIslandFit(player: PlayerPreferenceModel, island: IslandTasteModel, allTags: readonly TagId[]): ModelingPrediction;
  };
  recommendationPolicy: {
    recommendForPlayer(player: PlayerPreferenceModel, islands: readonly IslandTasteModel[], allTags: readonly TagId[]): RecommendationFacingEntry[];
  };
  ratingEvidenceModel: {
    constructRatingEvidence(player: PlayerPreferenceModel, event: RatingEvent): RatingEvidence;
  };
  updateAllocator: {
    allocateUpdatePressure(player: PlayerPreferenceModel, island: IslandTasteModel, allTags: readonly TagId[], focusTag: TagId | null): UpdateAllocation;
  };
  learningModel: {
    applyRatingEvent(
      state: ModelingCoreState,
      event: RatingEvent,
      predictionBefore: ModelingPrediction,
      evidence: RatingEvidence,
      allocation: UpdateAllocation | null
    ): { nextState: ModelingCoreState; updateTrace: ModelUpdateTrace };
  };
  playerSignalModel: {
    applySignalLearning(
      state: ModelingCoreState,
      event: RatingEvent,
      predictionBefore: ModelingPrediction,
      evidence: RatingEvidence,
      learningPressure: LearningPressureTrace
    ): { nextState: ModelingCoreState; signalTrace: PlayerSignalLearningTrace };
  };
}

export type TurnPhaseName = 'guidedDiscoveryCapture' | 'selfDirectedDiscoveryCapture' | 'atomicModelUpdate';

export interface TurnProcessingTrace {
  /** Prototype turn; in product this maps to a batch cadence such as hourly, nightly, weekly, or manual rebuild. */
  turn: number;
  /** Snapshot read for all decisions/calculations in this turn. */
  readModelStateTurn: number;
  /** Snapshot produced when this turn's atomic update finishes. */
  writeModelStateTurn: number;
  /** Phase where this rating/event was captured before atomic model update. */
  capturePhase: TurnPhaseName;
  /** Consequence-calculation phase; no Phase 3 result is readable by another Phase 3 calculation in the same turn. */
  updatePhase: 'atomicModelUpdate';
  snapshotIsolation: true;
  explanation: string;
}

export interface ModelingTraceStep {
  rawRating: RatingEvent;
  turnTrace: TurnProcessingTrace;
  assignedRating: RatingValue;
  playerDescriptors: {
    declaredAffinityByTag: Record<TagId, number>;
    demonstratedAffinityByTag: Record<TagId, number>;
    activeRoutingAffinityByTag: Record<TagId, number>;
  };
  ratingEvidence: RatingEvidence;
  ratingLedgerEntry: RatingLedgerEntry;
  ratingEvidenceProjection: RatingEvidenceProjection;
  activeRatingLedgerEntryIdsForIsland: string[];
  sourceAuthorityUpdates: SourceAuthorityTrace[];
  retroactiveProjectionUpdates: RetroactiveProjectionTrace[];
  predictionBefore: ModelingPrediction;
  recommendationFacingState: RecommendationFacingEntry[];
  predictionError: number | null;
  updateAllocation: UpdateAllocation | null;
  islandUpdate: ModelUpdateTrace | null;
  playerSignalUpdate: {
    before: PlayerSignalModel;
    after: PlayerSignalModel;
    trace: PlayerSignalLearningTrace;
  };
  deferredEvidence: {
    supported: boolean;
    reason: string | null;
  } | null;
  predictionAfter: ModelingPrediction;
  updatedModelState: ModelingCoreState;
  unsupportedConcepts: string[];
}

export interface ModelingTraceRun {
  fixtureId: string;
  fixtureDescription: string;
  fixtureOracle?: ModelingFixtureOracle;
  authoritySummary?: InferredActorAuthoritySummary[];
  scenarioAuthorityValidation?: ScenarioAuthorityValidationSummary;
  steps: ModelingTraceStep[];
  finalState: ModelingCoreState;
}
