# Modeling Core Lab

Wayfarer includes a compact modeling-core harness for deterministic, traceable inspection of the predictive rating and recommendation spine.

The modeling-core lab is intentionally isolated from the wider app. It is runnable from Node tests and from the `model:lab` command, while keeping the recommendation thesis inspectable:

> The rating prediction engine is the recommendation engine.

## What it does

- runs deterministic fixtures through the modeling-core prediction/update/routing loop
- emits JSON traces for rating events
- keeps assigned rating separate from signal strength
- models player preference separately from player-as-signal-source value
- models island descriptive tags separately from island audience-fit state
- exposes uncertainty/RD, volatility, update allocation, signal-strength factors, and routing reasons
- validates route classifications such as Safe Fit, Smart Gamble, Discovery Probe, Suppress/Avoid, Volatile Positive, and Guided Discovery
- records rating events through an append-only ledger
- projects rating evidence from the ledger under current model/trust interpretation
- marks player/island projections dirty when ratings or supersessions should trigger replay later
- establishes lane-local seed-proxy authority from exact overlap with cohort seeds
- uses snapshot-isolated turn metadata so same-turn authority changes are not readable by other same-turn calculations
- retroactively reprojects prior ratings on a later turn after a player becomes a seed proxy
- includes seed-proxy control fixtures for insufficient overlap, contradiction-heavy overlap, and lane-locality
- includes scenario-lab hidden truth checksums and visible authority summaries
- validates a multi-actor scenario matrix for proxy, under-threshold similarity, inverse signal, and disconnected controls

## Command

```powershell
npm run model:lab -- --fixture basic
npm run model:lab -- --fixture meh-observed
npm run model:lab -- --fixture routing-safe-fit
npm run model:lab -- --fixture rating-revision-supersedes
npm run model:lab -- --fixture bob-becomes-alice-proxy
npm run model:lab -- --fixture seed-proxy-insufficient-overlap
npm run model:lab -- --fixture seed-proxy-contradiction-control
npm run model:lab -- --fixture seed-proxy-lane-local-control
npm run model:lab -- --fixture proxy-discovers-seed-positive-unrated-island
npm run model:lab -- --fixture seed-proxy-scenario-matrix
```

Optional output file:

```powershell
npm run model:lab -- --fixture routing-safe-fit --output artifacts\modeling-core\routing-safe-fit-trace.json
```

## Core behavior

Every directional rating is interpreted as a prediction trial:

1. predict what this player should think of this island before the rating;
2. observe the actual rating;
3. append a rating ledger entry;
4. build typed rating evidence;
5. create a replayable evidence projection;
6. calculate signal strength from grouped conceptual factors;
7. calculate surprise / prediction error;
8. allocate update pressure between player and island models using uncertainty/RD and volatility;
9. update the player's preference model;
10. update the player's signal-source model when eligible;
11. update island audience-fit state;
12. evaluate source-authority/proxy changes produced by the turn;
13. produce recommendation-facing routing state from the same predictive model.

Turn semantics are snapshot-isolated. A turn is the prototype stand-in for a product batch cadence, not a fixed wall-clock unit. A turn may represent nightly processing, weekly processing, an hourly batch, or a manual rebuild. The rule is:

```text
Turn N reads Model State N-1.
Phase 1 captures guided-discovery evidence using State N-1.
Phase 2 captures self-directed/organic evidence using State N-1.
Phase 3 applies all Turn N evidence as one atomic model update.
Phase 3 writes Model State N.
No Phase 3 result is readable by another Phase 3 calculation in the same turn.
```

Trace fields distinguish the event turn from projection interpretation: `eventTurn`, `readModelStateTurn`, `projectedTurn`, and the per-step `turnTrace`.

A `0` / meh rating is currently stored as observed evidence but does not train shared preference, confidence, volatility, or contradiction state.

## Signal strength shape

Signal strength is grouped by conceptual category rather than multiplying many raw factors directly:

```text
baseSignal = calculateBaseSignal(...)
confidence = calculateConfidence(...)
stability = calculateStability(...)
polarityClarity = calculatePolarityClarityMultiplier(...)
context = calculateContextMultiplier(...)

signalStrength = baseSignal * confidence * stability * polarityClarity * context
```

Each category is intentionally behind a replaceable calculation function so the internal definition of confidence, stability, polarity clarity, and context can change without rewriting consumers.

## Ledger / projection boundary

The modeling core now has a database-shaped seam, but still uses in-memory fixture-backed stores.

Working doctrine:

```text
Rating history is append-only.
Current rating state is mutable through superseding entries.
Derived evidence is replayable.
```

A player can change a vote by adding a superseding ledger entry. The old entry remains auditable, but its evidence projection no longer contributes to the current island estimate. Dirty projection records mark which player/island projections would need replay once a real persistence layer or delayed trust propagation exists.

This is deliberately prototype-only storage architecture: no real database, no app-level persistence refactor, and no production job queue. The goal is to make the modeling core database-shaped so future JSON-to-database migration can be an I/O layer swap rather than a modeling rewrite.


## Seed authority / proxy replay

Seed ratings are not treated as ordinary ratings with a larger trust number. In the modeling lab, a seed is a trust root: its direct ratings can contribute evidence, and its historical overlap can define a reference frame for other players.

The `bob-becomes-alice-proxy` fixture demonstrates the first vertical slice of retroactive Advogato-style propagation:

1. Alice exists as a cohort seed / trust root.
2. Bob starts with low ordinary signal authority.
3. Bob rates five Bob-only islands before he has useful history.
4. Bob then matches Alice on fifteen overlapping skill-based ratings with no contradictions.
5. Bob becomes a silent `seedProxy` for Alice in the skill-based lane at the end of that turn.
6. That same-turn proxy authority is not used for retroactive replay inside the same atomic pass.
7. On the next turn, Bob's earlier ratings are reprojected as `learnedSimilarityToSeed` evidence.
8. The original ledger entries remain unchanged and auditable.
9. Affected islands are marked dirty for replay / downstream projection refresh.

This is intentionally not a full trust graph yet. It proves the core seam: a player's authority can change later, and prior ratings can be reinterpreted without editing historical rating entries.

The current proxy threshold is deliberately simple and diagnostic: fifteen exact overlap matches, no contradictions, and high similarity. v11c adds controls proving the happy path does not fire below threshold, does not fire when the overlap includes contradictions, and remains lane-local when a prior rating is focused on a different lane. Future passes should make this continuous, multi-seed-aware, and robust against adversarial mimicry.

## Validation

```powershell
npm run build:node-tests
node dist-node-tests/tests/node/modelingCore.node.test.js
npm run model:lab -- --fixture routing-safe-fit
npm run model:lab -- --fixture rating-revision-supersedes
npm run model:lab -- --fixture bob-becomes-alice-proxy
npm run model:lab -- --fixture seed-proxy-insufficient-overlap
npm run model:lab -- --fixture seed-proxy-contradiction-control
npm run model:lab -- --fixture seed-proxy-lane-local-control
npm run model:lab -- --fixture proxy-discovers-seed-positive-unrated-island
npm run model:lab -- --fixture seed-proxy-scenario-matrix
```

The broader node test suite may also be run with:

```powershell
npm run test:node
```

## Current status

The lab has passed first-order sanity tests: under clean diagnostic fixtures, the routing category produced by the math matches the intended case. This means the model can express the intended distinctions under controlled conditions. It does not yet mean the model is tuned, calibrated, adversarially stress tested, or validated against real-world behavior.

The v11a ledger/projection pass established the seam needed for retroactive trust. The v11b seed-proxy pass added the first vertical slice of Bob-as-Alice proxy propagation. The v11c pass tightens that model with snapshot-isolated turn semantics and seed-proxy controls: exact seed overlap creates lane-local proxy authority, same-turn authority is not reused inside the same atomic pass, prior Bob ratings are reprojected on a later turn, insufficient overlap does not create proxy authority, contradictory overlap blocks proxy promotion, and wrong-lane prior ratings remain ordinary evidence. This is still diagnostic and deliberately narrow; it is not yet full multi-seed trust propagation or calibrated source-authority math.

## Deferred work

The following are intentionally deferred until the core predictive/trust spine is stable:

- observed behavior integration
- tag evolution / tag discovery
- explicit adversarial stress testing

The next intended architectural step is making source authority smoother and more realistic: continuous proxy confidence, explicit seed-authority pressure terms, multi-seed handling, and later adversarial stress tests.

## Scenario scripting layer

The modeling core now includes a scenario lab for controlled hidden-truth experiments. See `docs/modeling-scenario-lab.md` for the operating guide.

The short version:

- hidden actor/island truth belongs in scenario truth, not visible model state;
- injections should usually rewrite durable hidden archetypes rather than force rating outcomes;
- encounters decide who sees what on which turn;
- ratings are generated from hidden truth and then processed by the normal modeling harness;
- traces must prove provenance, especially when seed-proxy evidence reprojects older ratings.



## Scenario matrix validation

The scenario lab adds hidden-truth checksums and visible authority summaries. Hidden truth may generate scenario events and validate outcomes, but source-authority inference, evidence projection, and recommendation routing must read only visible ledger/projection/model state.

`seed-proxy-scenario-matrix` is the main counterfactual scenario. It includes Alice as a seed plus Bob, Almost Bob, Anti-Bob, and Control. At the end of the run, `authoritySummary` reports what the model can infer from visible evidence, and `scenarioAuthorityValidation` compares that visible inference against the hidden checksum.

Expected high-level outcomes:

- Bob becomes a skill-based Alice seed proxy.
- Almost Bob remains ordinarySimilar because he is under the overlap threshold.
- Anti-Bob is identified as inverseSignal rather than seedProxy.
- Control remains unrelated.
- Bob's Alice-positive unrated evidence is reprojected as Bob-as-Alice-proxy evidence.
- Bob's wrong-lane evidence does not receive skill-based proxy authority.
