import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TAGS } from '../../data/defaultTags.js';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';
import { generateColumbusDataset } from '../../generator/columbusGenerator.js';
import { advancePolicyTurn, appendRefreshEvent, createInitialSimulationState, serializeSimulationState } from '../../model/simulation.js';
import { exportSavedWayfarerScenario, parseSavedWayfarerScenario } from '../../model/scenarioPersistence.js';
import { getScenarioPresetMetadata } from '../../model/scenarioPresets.js';
import { DEFAULT_TURN_POLICY } from '../../model/turnPolicy.js';

function buildBootstrap(seed = 86420) {
  const dataset = generateColumbusDataset({
    seed,
    numUsers: 6,
    numIslands: 8,
    allTags: DEFAULT_TAGS,
    cohorts: createDefaultCohorts(),
    tagAlignmentDistribution: { kind: 'fixed', value: 10 },
    ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
  });

  return {
    seed,
    allTags: dataset.allTags,
    latentUsers: dataset.users,
    cohorts: dataset.cohorts,
    islands: dataset.islands
  };
}

function buildTurnPolicy() {
  return {
    ...DEFAULT_TURN_POLICY,
    turnMode: 'organic' as const,
    participatingUsersPerTurn: 2,
    organicRatingsPerUser: 2,
    guidedRecommendationsPerUser: 1,
    customExplorationWeight: DEFAULT_TURN_POLICY.customRoutingValues.explorationWeight,
    customBadFitGuardThreshold: DEFAULT_TURN_POLICY.customRoutingValues.badFitGuardThreshold
  };
}

describe('scenario persistence', () => {
  it('exports a versioned saved scenario with config and snapshot data', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 3 });
    const scenario = exportSavedWayfarerScenario({
      label: 'baseline export',
      createdAt: '2026-05-13T02:30:00.000Z',
      scenarioPreset: getScenarioPresetMetadata('small-smoke-test'),
      generatorConfig: {
        seed: bootstrap.seed,
        numUsers: bootstrap.latentUsers.length,
        numIslands: bootstrap.islands.length,
        bootstrapRatingsPerUser: 3,
        tagAlignmentDistribution: { kind: 'fixed', value: 10 },
        ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
      },
      turnPolicy: buildTurnPolicy(),
      turnsToRun: 5,
      simulationState: state
    });

    assert.equal(scenario.version, 1);
    assert.equal(scenario.kind, 'simulation-state');
    assert.equal(scenario.scenarioPreset?.id, 'small-smoke-test');
    assert.equal(scenario.generatorConfig.seed, bootstrap.seed);
    assert.equal(scenario.turnPolicy.turnMode, 'organic');
    assert.equal(scenario.turnsToRun, 5);
    assert.equal(scenario.simulationState.ratingEvents.length, state.ratingEvents.length);
    assert.equal(
      scenario.simulationState.islandCohortRatingSnapshots?.length,
      state.islandCohortRatingSnapshots.length
    );
    assert.equal(
      typeof scenario.simulationState.ratingEvents[0]?.raterSignalWeights[bootstrap.cohorts[0].id],
      'number'
    );
  });

  it('round-trips refresh events through persistence', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const refreshed = appendRefreshEvent(state, {
      id: 'refresh-persistence:patch-1',
      turn: 1,
      kind: 'gamePatch',
      reason: 'patch window'
    });
    const serialized = serializeSimulationState(refreshed);
    const parsed = parseSavedWayfarerScenario(
      JSON.stringify({
        version: 1,
        kind: 'simulation-state',
        label: 'refresh persistence',
        createdAt: '2026-05-13T02:30:00.000Z',
        scenarioPreset: getScenarioPresetMetadata('small-smoke-test'),
        generatorConfig: {
          seed: bootstrap.seed,
          numUsers: bootstrap.latentUsers.length,
          numIslands: bootstrap.islands.length,
          bootstrapRatingsPerUser: 0,
          tagAlignmentDistribution: { kind: 'fixed', value: 10 },
          ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
        },
        turnPolicy: buildTurnPolicy(),
        turnsToRun: 5,
        simulationState: serialized
      })
    );

    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.restoredState.refreshEvents.length, 1);
      assert.equal(parsed.restoredState.refreshEvents[0]?.kind, 'gamePatch');
    }
  });

  it('round-trips inferred evidence records through persistence', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 0 });
    const withInference = {
      ...state,
      inferredRatingEvidence: [
        {
          id: 'inferred-1',
          turn: 2,
          userId: bootstrap.latentUsers[0].id,
          islandId: bootstrap.islands[0].id,
          rating: 1 as const,
          source: 'inferred' as const,
          sourceSystem: 'upstream-telemetry',
          sourceVersion: 'v1',
          sourceRunId: 'run-123',
          confidence: 0.91,
          provenance: 'Attached upstream black-box inference'
        }
      ]
    };
    const serialized = serializeSimulationState(withInference);
    const parsed = parseSavedWayfarerScenario(
      JSON.stringify({
        version: 1,
        kind: 'simulation-state',
        label: 'inferred persistence',
        createdAt: '2026-05-13T02:30:00.000Z',
        scenarioPreset: getScenarioPresetMetadata('small-smoke-test'),
        generatorConfig: {
          seed: bootstrap.seed,
          numUsers: bootstrap.latentUsers.length,
          numIslands: bootstrap.islands.length,
          bootstrapRatingsPerUser: 0,
          tagAlignmentDistribution: { kind: 'fixed', value: 10 },
          ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
        },
        turnPolicy: buildTurnPolicy(),
        turnsToRun: 5,
        simulationState: serialized
      })
    );

    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.restoredState.inferredRatingEvidence.length, 1);
      assert.equal(parsed.restoredState.inferredRatingEvidence[0]?.sourceSystem, 'upstream-telemetry');
      assert.equal(parsed.restoredState.inferredRatingEvidence[0]?.provenance, 'Attached upstream black-box inference');
    }
  });

  it('round-trips authored island update cadence and keeps it optional for legacy scenarios', () => {
    const bootstrap = buildBootstrap();
    const state = createInitialSimulationState({
      ...bootstrap,
      islands: bootstrap.islands.map((island, index) =>
        index === 0 ? { ...island, updateCadenceProfile: 'active' as const } : island
      ),
      initialRatingsPerUser: 0
    });
    const serialized = serializeSimulationState(state);
    const parsed = parseSavedWayfarerScenario(JSON.stringify({
      version: 1,
      kind: 'simulation-state',
      label: 'authored cadence',
      createdAt: new Date(0).toISOString(),
      generatorConfig: {
        seed: bootstrap.seed,
        numUsers: bootstrap.latentUsers.length,
        numIslands: bootstrap.islands.length,
        bootstrapRatingsPerUser: 0,
        tagAlignmentDistribution: { kind: 'fixed', value: 10 },
        ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
      },
      turnPolicy: buildTurnPolicy(),
      turnsToRun: 1,
      simulationState: serialized
    }));

    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }

    assert.equal(parsed.restoredState.islands[0]?.updateCadenceProfile, 'active');
    assert.equal(parsed.restoredState.islands[1]?.updateCadenceProfile, undefined);

    const legacyParsed = parseSavedWayfarerScenario(JSON.stringify({
      version: 1,
      kind: 'simulation-state',
      label: 'legacy cadence',
      createdAt: new Date(0).toISOString(),
      generatorConfig: {
        seed: bootstrap.seed,
        numUsers: bootstrap.latentUsers.length,
        numIslands: bootstrap.islands.length,
        bootstrapRatingsPerUser: 0,
        tagAlignmentDistribution: { kind: 'fixed', value: 10 },
        ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
      },
      turnPolicy: buildTurnPolicy(),
      turnsToRun: 1,
      simulationState: {
        ...serialized,
        islands: serialized.islands.map(({ updateCadenceProfile: _unused, ...island }) => island)
      }
    }));

    assert.equal(legacyParsed.ok, true);
  });

  it('rejects invalid saved scenario shapes', () => {
    const missingWeights = parseSavedWayfarerScenario(
      JSON.stringify({
        version: 1,
        kind: 'simulation-state',
        label: 'broken',
        createdAt: '2026-05-13T02:30:00.000Z',
        scenarioPreset: getScenarioPresetMetadata('small-smoke-test'),
        generatorConfig: {
          seed: 1,
          numUsers: 1,
          numIslands: 1,
          bootstrapRatingsPerUser: 1,
          tagAlignmentDistribution: { kind: 'fixed', value: 10 },
          ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
        },
        turnPolicy: buildTurnPolicy(),
        turnsToRun: 5,
        simulationState: {
          seed: 1,
          currentTurn: 0,
          allTags: [],
          latentUsers: [],
          cohorts: [],
          islands: [],
          ratingEvents: [
            {
              id: 'event-1',
              turn: 0,
              userId: 'user-1',
              islandId: 'island-1',
              rating: 1,
              source: 'organic',
              raterSignalWeights: { cohort: 'bad' }
            }
          ],
          turnHistory: []
        }
      })
    );

    const legacyWithoutSnapshots = parseSavedWayfarerScenario(
      JSON.stringify({
        version: 1,
        kind: 'simulation-state',
        label: 'legacy',
        createdAt: '2026-05-13T02:30:00.000Z',
        scenarioPreset: getScenarioPresetMetadata('small-smoke-test'),
        generatorConfig: {
          seed: 1,
          numUsers: 1,
          numIslands: 1,
          bootstrapRatingsPerUser: 1,
          tagAlignmentDistribution: { kind: 'fixed', value: 10 },
          ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
        },
        turnPolicy: buildTurnPolicy(),
        turnsToRun: 5,
        simulationState: {
          seed: 1,
          currentTurn: 0,
          allTags: [],
          latentUsers: [],
          cohorts: [],
          islands: [],
          ratingEvents: [],
          islandCohortRatingSnapshots: [],
          turnHistory: []
        }
      })
    );

    const badShape = parseSavedWayfarerScenario('{"version":1}');
    const malformedRevisionFields = parseSavedWayfarerScenario(
      JSON.stringify({
        version: 1,
        kind: 'simulation-state',
        label: 'bad revision fields',
        createdAt: '2026-05-13T02:30:00.000Z',
        scenarioPreset: getScenarioPresetMetadata('small-smoke-test'),
        generatorConfig: {
          seed: 1,
          numUsers: 1,
          numIslands: 1,
          bootstrapRatingsPerUser: 1,
          tagAlignmentDistribution: { kind: 'fixed', value: 10 },
          ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
        },
        turnPolicy: buildTurnPolicy(),
        turnsToRun: 5,
        simulationState: {
          seed: 1,
          currentTurn: 0,
          allTags: [],
          latentUsers: [],
          cohorts: [],
          islands: [],
          ratingEvents: [
            {
              id: 'event-1',
              turn: 0,
              userId: 'user-1',
              islandId: 'island-1',
              rating: 1,
              source: 'organic',
              raterSignalWeights: {},
              revisionReason: 'bad-revision',
              supersedesEventId: 123,
              islandVersionId: 99,
              gameRulesVersionId: false
            }
          ],
          turnHistory: []
        }
      })
    );
    const malformedInferredEvidence = parseSavedWayfarerScenario(
      JSON.stringify({
        version: 1,
        kind: 'simulation-state',
        label: 'bad inferred evidence',
        createdAt: '2026-05-13T02:30:00.000Z',
        scenarioPreset: getScenarioPresetMetadata('small-smoke-test'),
        generatorConfig: {
          seed: 1,
          numUsers: 1,
          numIslands: 1,
          bootstrapRatingsPerUser: 1,
          tagAlignmentDistribution: { kind: 'fixed', value: 10 },
          ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
        },
        turnPolicy: buildTurnPolicy(),
        turnsToRun: 5,
        simulationState: {
          seed: 1,
          currentTurn: 0,
          allTags: [],
          latentUsers: [],
          cohorts: [],
          islands: [],
          ratingEvents: [],
          inferredRatingEvidence: [
            {
              id: 'inf-1',
              turn: 0,
              userId: 'user-1',
              islandId: 'island-1',
              rating: 1,
              source: 'inferred',
              sourceSystem: 'upstream',
              sourceVersion: 'v1',
              sourceRunId: 2,
              confidence: 0.9,
              provenance: 'bad'
            }
          ],
          turnHistory: []
        }
      })
    );
    const legacyEventWithoutRevision = parseSavedWayfarerScenario(
      JSON.stringify({
        version: 1,
        kind: 'simulation-state',
        label: 'legacy event',
        createdAt: '2026-05-13T02:30:00.000Z',
        scenarioPreset: getScenarioPresetMetadata('small-smoke-test'),
        generatorConfig: {
          seed: 1,
          numUsers: 1,
          numIslands: 1,
          bootstrapRatingsPerUser: 1,
          tagAlignmentDistribution: { kind: 'fixed', value: 10 },
          ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
        },
        turnPolicy: buildTurnPolicy(),
        turnsToRun: 5,
        simulationState: {
          seed: 1,
          currentTurn: 0,
          allTags: [],
          latentUsers: [],
          cohorts: [],
          islands: [],
          ratingEvents: [
            {
              id: 'event-1',
              turn: 0,
              userId: 'user-1',
              islandId: 'island-1',
              rating: 1,
              source: 'organic',
              raterSignalWeights: {}
            }
          ],
          turnHistory: []
        }
      })
    );
    const legacyTurnPolicyWithoutHeartbeat = parseSavedWayfarerScenario(
      JSON.stringify({
        version: 1,
        kind: 'simulation-state',
        label: 'legacy turn policy',
        createdAt: '2026-05-13T02:30:00.000Z',
        scenarioPreset: getScenarioPresetMetadata('small-smoke-test'),
        generatorConfig: {
          seed: 1,
          numUsers: 1,
          numIslands: 1,
          bootstrapRatingsPerUser: 1,
          tagAlignmentDistribution: { kind: 'fixed', value: 10 },
          ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
        },
        turnPolicy: {
          ...buildTurnPolicy(),
          heartbeat: undefined
        },
        turnsToRun: 5,
        simulationState: {
          seed: 1,
          currentTurn: 0,
          allTags: [],
          latentUsers: [],
          cohorts: [],
          islands: [],
          ratingEvents: [],
          turnHistory: []
        }
      })
    );

    assert.equal(missingWeights.ok, false);
    assert.equal(legacyWithoutSnapshots.ok, true);
    assert.equal(badShape.ok, false);
    assert.equal(malformedRevisionFields.ok, false);
    assert.equal(malformedInferredEvidence.ok, false);
    assert.equal(legacyEventWithoutRevision.ok, true);
    assert.equal(legacyTurnPolicyWithoutHeartbeat.ok, true);
  });

  it('restores a valid saved simulation and continues deterministically', () => {
    const bootstrap = buildBootstrap(86421);
    const initial = createInitialSimulationState({ ...bootstrap, initialRatingsPerUser: 2 });
    const afterTurn = advancePolicyTurn(initial, buildTurnPolicy());
    const saved = exportSavedWayfarerScenario({
      label: 'continuation case',
      createdAt: '2026-05-13T02:30:00.000Z',
      scenarioPreset: getScenarioPresetMetadata('small-smoke-test'),
      generatorConfig: {
        seed: bootstrap.seed,
        numUsers: bootstrap.latentUsers.length,
        numIslands: bootstrap.islands.length,
        bootstrapRatingsPerUser: 2,
        tagAlignmentDistribution: { kind: 'fixed', value: 10 },
        ratingAlignmentDistribution: { kind: 'fixed', value: 10 }
      },
      turnPolicy: buildTurnPolicy(),
      turnsToRun: 5,
      simulationState: afterTurn
    });

    const parsedA = parseSavedWayfarerScenario(JSON.stringify(saved));
    const parsedB = parseSavedWayfarerScenario(JSON.stringify(saved));

    assert.equal(parsedA.ok, true);
    assert.equal(parsedB.ok, true);

    if (parsedA.ok && parsedB.ok) {
      assert.equal(parsedA.scenario.scenarioPreset?.id, 'small-smoke-test');
      const nextA = advancePolicyTurn(parsedA.restoredState, buildTurnPolicy());
      const nextB = advancePolicyTurn(parsedB.restoredState, buildTurnPolicy());

      assert.deepEqual(serializeSimulationState(nextB), serializeSimulationState(nextA));
      assert.equal(nextA.currentTurn, afterTurn.currentTurn + 1);
    }
  });
});
