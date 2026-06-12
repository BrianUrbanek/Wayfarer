# Modeling Scenario Lab

The modeling scenario lab is the test-world authoring layer for `src/modeling-core`. It lets future conversations set up controlled discovery/trust experiments without hand-authoring every visible model field or hard-forcing every rating outcome.

## Core doctrine

A scenario keeps four layers separate:

1. **Hidden truth** is test-world reality. It says what an actor actually likes, which seed they resemble, whether they are inverse-aligned, and what audience an island is truly good for.
2. **Visible model state** is what Wayfarer currently believes at the start of the scenario. It should not automatically know the hidden truth.
3. **Events** are what happened during turns: encounters, ratings, revisions, guided or organic discovery actions.
4. **Projections** are what the model currently infers from events, using the latest completed turn snapshot.

Do not collapse these layers. In particular, do not make `PlayerPreferenceModel` or `IslandTasteModel` double as hidden truth. They are model belief/projection state. Hidden truth lives in `ScenarioActorTruth` and `ScenarioIslandTruth`.

## Files

The scenario system is intentionally small:

- `scenarioTruth.ts` defines hidden actor/island truth and rating generation from hidden causes.
- `scenarioInjections.ts` defines durable hidden-truth rewrites and encounter injections.
- `scenarioRatingGenerator.ts` converts an encounter plus hidden truth into a `RatingEvent`.
- `scenarioBuilder.ts` compiles a baseline plus injections into a normal `ModelingFixtureState`.
- `fixtures.ts` exposes compiled scenarios by fixture id.

The normal harness still runs scenarios through `runModelingFixture(fixtureId)`. Scenario fixtures are not a separate runner.

## Reading an existing scenario

Start in `fixtures.ts` and find the fixture id. Scenario-backed fixtures usually delegate to `scenarioBuilder.ts`; for example:

```ts
case 'proxy-discovers-seed-positive-unrated-island':
  return proxyDiscoversSeedPositiveUnratedIslandFixture();
```

Then read the scenario builder function. A scenario-backed fixture usually has:

1. a baseline world, such as `goldenSeedProxyBaseline()`;
2. hidden-truth injections, such as making Bob Alice-like;
3. encounter injections, which decide who sees what on which turn;
4. expectations recorded in the fixture oracle.

Use the trace to verify the causal chain. The `fixtureOracle.hiddenPlayers` and `fixtureOracle.hiddenIslands` fields expose hidden truth to the test harness and reader, but the model itself only receives visible state and events.

## Creating a scenario

Prefer this workflow:

1. Start from a baseline unless the test is specifically about baseline construction.
2. Give actors readable ids and labels: `scenario-alice`, `scenario-bob`, `Scenario Alice`, `Scenario Bob`.
3. Define hidden actor truth with helpers such as `seedActor`, `seedLikeActor`, `inverseSeedLikeActor`, or `disconnectedActor`.
4. Define hidden island truth with helpers such as `seedFitIsland`.
5. Use encounter injections to place actors on islands at turns.
6. Let hidden truth generate the rating outcome.
7. Add expectation assertions in `modelingCore.node.test.ts`.
8. Confirm the trace proves the intended causal chain.

## Durable archetype injections vs forced ratings

The preferred pattern is durable hidden-truth injection:

```ts
const bobLikeAlice = seedLikeActor('scenario-bob', 'Scenario Bob', alice, 0.98);
buildModelingFixtureFromScenario(base, [rewriteActorTruth('scenario-bob', bobLikeAlice)]);
```

This means Bob behaves like Alice across scripted and unscripted turns because Bob's hidden priors say so. Do **not** force Bob to vote like Alice one turn at a time unless the test is explicitly about a puppeted regression case.

Use encounters to control exposure:

```ts
ensureEncounter({
  turn: 1,
  actorId: 'scenario-bob',
  islandId: 'scenario-alice-positive-unrated',
  source: 'organic',
  selectionReason: 'cohortBoundaryProbe',
  focusTag: 'skill-based'
});
```

The rating generator then calculates the rating from Bob's hidden actor truth and the island's hidden truth.

## Canonical scenario: proxy discovers seed-positive unrated island

`proxy-discovers-seed-positive-unrated-island` is the first scenario-backed fixture.

It tests the Wayfarer trust-propagation trick:

1. Alice is a cohort seed / trust root.
2. Bob is rewritten as Alice-like through hidden archetype injection.
3. Bob encounters an island that is hidden-positive for Alice, but Alice never rates it.
4. Bob autonomously rates it positive.
5. Bob then matches Alice on fifteen overlap islands.
6. Bob earns lane-local Alice seed-proxy authority.
7. On the next turn, Bob's earlier Alice-unrated island rating is reprojected as seed-proxy evidence.
8. Alice still has no ledger entry for that island; the provenance remains Bob-as-Alice-proxy, not Alice.

Expected trace signs:

- `fixtureOracle.hiddenPlayers['scenario-bob'].behaviorArchetype === 'seedLike'`
- the first Bob rating is generated positive from hidden truth;
- no Alice ledger entry exists for `scenario-alice-positive-unrated`;
- the proxy-establishing step has `sourceAuthorityUpdates[0].sourceClass === 'seedProxy'`;
- the same-turn proxy-establishing step has no retroactive projection updates;
- the next turn reprojects Bob's prior rating with `sourceClass: 'seedProxy'` and `proxyForSeedIds: ['scenario-alice']`.

## Safety rules for future scenario work

- Hidden truth may guide generated events; visible model state should not be preloaded with the answer unless that is the explicit test.
- Prefer encounter/opportunity scripts over forced ratings.
- Use readable ids. The trace is a debugging surface.
- Add control cases by reusing the same baseline and changing one injection at a time.
- Reject duplicate actor/island encounters on the same turn unless a future test explicitly models rating revision.
- When testing batch semantics, remember that a turn reads the previous completed model snapshot and writes the next snapshot atomically.

## Hidden truth checksums and visible inference summaries

Scenario fixtures may include a `hiddenTruthChecksum`. The checksum is an oracle-side contract, not model input.

The rule is strict:

```text
Hidden truth may generate events.
Hidden truth may validate outcomes.
Hidden truth may not drive model inference.
```

The source-authority model must infer actor relationships from visible ledger/projection state only. At the end of a run, the harness may compare that visible inference against the hidden checksum and emit `scenarioAuthorityValidation`.

Read these fields as follows:

- `fixtureOracle.hiddenTruthChecksum` records the intended hidden relationship map: seed, seedProxy, ordinarySimilar, inverseSignal, or unrelated.
- `authoritySummary` records what the model can infer from visible ratings, seed metadata, and projections.
- `scenarioAuthorityValidation` compares the two after the run. It is an end-of-run validation layer, not a training signal.

A passing validation means the model-visible evidence produced the intended relationship classification without reading the hidden labels.

## Scenario matrix fixture

`seed-proxy-scenario-matrix` is the first matrix-style scenario. It uses one Alice seed and four controlled actors:

- Matrix Bob: hidden Alice-like actor; expected to become `seedProxy`.
- Matrix Almost Bob: hidden Alice-like but under the overlap threshold; expected to remain `ordinarySimilar`.
- Matrix Anti-Bob: hidden inverse-Alice actor; expected to infer as `inverseSignal`.
- Matrix Control: disconnected actor; expected to remain `unrelated`.

The fixture also includes an Alice-positive island that Alice never rates, a wrong-lane control island, seed overlap islands, and a post-proxy trigger encounter. It is intended to test both counterfactual controls and multi-turn separation in one run.

When reading this fixture, check:

- `scenarioAuthorityValidation.passed === true`;
- Bob has a visible `seedProxy` summary for Alice;
- Almost Bob has visible overlap but no proxy relationship;
- Anti-Bob has contradictions/inverse matches, not proxy authority;
- Control remains unrelated;
- Bob's Alice-positive unrated island evidence is reprojected as seedProxy evidence;
- Bob's wrong-lane evidence does not receive the skill-based proxy projection.

## Adding a matrix/control scenario

When adding a new matrix scenario:

1. Keep the hidden checksum explicit.
2. Make sure actor behavior is generated by hidden archetype truth.
3. Use encounters to create evidence, not forced votes.
4. Make the source-authority model infer from visible ledger/projection data only.
5. Add assertions both for positive manifestation and negative controls.
6. Prefer counterfactual variants that change one cause at a time.

Good controls include insufficient overlap, contradiction-heavy overlap, inverse alignment, wrong-lane evidence, disconnected actors, and superseded historical ratings.
