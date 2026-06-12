# Wayfarer Modeling Lab Handoff — v12b

_Last updated: 2026-06-03_

## Executive summary

The Wayfarer modeling work has moved from concept notes into a drop-in, repo-compatible modeling lab. The current lab can run deterministic fixtures, emit inspectable JSON traces, model ratings as replayable ledger evidence, represent seed/proxy authority, enforce snapshot-isolated turn semantics, and run hidden-truth scenario experiments with end-of-run validation.

The major product thesis remains:

> The rating prediction engine is the recommendation engine.

The current modeling lab does not yet prove production-calibrated math. It proves that the intended mechanisms can be represented, traced, controlled, and tested in code.

## Current bundle

Current complete drop-in bundle:

```text
wayfarer_modeling_rewrite_v12b_dropin.zip
```

The bundle is intended to be applied from the repo root with overwrite/force semantics. It is not a delta bundle.

Expected local validation commands:

```powershell
npm run build:node-tests
node dist-node-tests/tests/node/modelingCore.node.test.js
npm run model:lab -- --fixture seed-proxy-scenario-matrix
npm run test:node
```

The latest generated validation reported:

```text
focused modeling-core tests: 44 pass / 0 fail
full node test suite: 203 pass / 0 fail
```

Brian validated the earlier v11a drop-in locally using `npm run model:lab -- --fixture routing-safe-fit`, confirming the drop-in workflow works on the real project checkout without hand merge.

## Files in the v12b drop-in

```text
src/modeling-core/engine.ts
src/modeling-core/evidenceProjection.ts
src/modeling-core/fixtures.ts
src/modeling-core/harness.ts
src/modeling-core/index.ts
src/modeling-core/learningModel.ts
src/modeling-core/math.ts
src/modeling-core/modelingStores.ts
src/modeling-core/playerSignalModel.ts
src/modeling-core/predictionModel.ts
src/modeling-core/projectionEngine.ts
src/modeling-core/ratingEvidenceModel.ts
src/modeling-core/ratingLedger.ts
src/modeling-core/routingPolicy.ts
src/modeling-core/scenarioAuthoritySummary.ts
src/modeling-core/scenarioBuilder.ts
src/modeling-core/scenarioInjections.ts
src/modeling-core/scenarioRatingGenerator.ts
src/modeling-core/scenarioTruth.ts
src/modeling-core/signalStrengthModel.ts
src/modeling-core/sourceAuthorityModel.ts
src/modeling-core/stateStore.ts
src/modeling-core/types.ts
src/modeling-core/uncertaintyModel.ts
src/modeling-core/updateAllocator.ts
src/tests/node/modelingCore.node.test.ts
docs/modeling-core-lab.md
docs/modeling-scenario-lab.md
```

No package script, tsconfig, React UI, app-level persistence, or production data-layer file is intentionally changed by v12b.

## Milestone history

### v1–v2: modeling-core replacement and modularization

The original modeling-core wrapper around existing simulation/inference/recommendation code was replaced with an isolated lab model. The model was then split into replaceable modules: prediction, rating evidence, update allocation, learning, state storage, and engine orchestration.

### v3–v6: hidden oracle, uncertainty, update reasons

The lab added hidden fixture truth, diagnostic scenarios, continuous uncertainty handling, and structured update-reason traces. Prediction miss became surprise/update pressure rather than immediate blame.

### v7–v9: player-as-signal-source and grouped signal strength

The model split player preference from player signal value. Stable inverse raters became potentially useful signal sources rather than simply bad raters. Signal strength was moved away from fragile many-factor multiplication into grouped categories: base signal, confidence, stability, polarity clarity, and context.

### v10: routing policy

Recommendation categories became explicit routing outputs: Safe Fit, Smart Gamble, Discovery Probe, Suppress/Avoid, Volatile Positive, and Guided Discovery. Routing traces expose factor contributions.

### v11a: ledger/projection seam

Ratings became append-only ledger entries. Current rating state can be changed through superseding entries. Derived evidence projections can be recomputed from the ledger without rewriting history.

Core doctrine:

```text
Rating history is append-only.
Current rating state is mutable through superseding entries.
Derived evidence is replayable.
```

### v11b: first seed-proxy vertical slice

Alice as seed/trust root, Bob as ordinary rater, Bob matching Alice on overlap, Bob becoming Alice-proxy, and prior Bob ratings gaining seed-proxy projection meaning were represented in the lab.

### v11c: snapshot-isolated turns and proxy controls

Turn semantics were clarified: a turn reads the previous completed model state and writes the next state atomically. New authority produced during a turn is not readable by other same-turn calculations by default.

Proxy controls were added for insufficient overlap, contradiction-heavy overlap, and lane-local/wrong-lane behavior.

### v12a: scenario hidden-truth infrastructure

The lab added a scenario authoring layer: hidden actor truth, hidden island truth, durable archetype injections, encounter injections, autonomous rating generation, and documentation.

### v12b: scenario matrix and hidden-truth checksum validation

The lab added a counterfactual scenario matrix with Alice, Bob, Almost Bob, Anti-Bob, and Control. Hidden truth can generate events and validate outcomes, but model inference must operate only from visible rating/projection state.

## Core architecture doctrines

### Hidden truth vs visible belief

```text
Hidden truth = test-world reality.
Visible model state = what Wayfarer currently believes.
Events = what happened.
Projections = what the model currently infers from events.
```

Hidden truth may generate scenario events and validate end-of-run outcomes. It must not drive source-authority inference, routing, projection, or learning.

### Ratings

Ratings are directional evidence:

```text
+1 = positive directional signal
-1 = negative directional signal
 0 = meh / non-directional / ambiguous observation
```

A `0` rating is stored as an event but currently does not train shared preference, confidence, volatility, or contradiction state.

### Assigned rating vs signal strength

The assigned rating is the direction of the rater's stated judgment. Signal strength is the force of evidence the system should apply from that judgment. Do not collapse these into `rating * trust` as a single undifferentiated value.

### Player preference vs player signal value

A player has at least two distinct model surfaces:

```text
PlayerPreferenceModel:
  What the system believes the player likes.

PlayerSignalModel:
  How useful the player's ratings are as evidence for others.
```

A player can dislike an island and still be a highly useful signal source. A player can be inverse-correlated with a seed and still be useful if that inverse relationship is stable.

### Island descriptive tags vs audience fit

An island has descriptive/tag identity and audience-fit state. These should not be collapsed.

```text
Descriptive tags:
  What kind of thing the island is.

Audience fit:
  Which kinds of players/cohorts are expected to enjoy it.
```

### RD, confidence, volatility, and maturity

```text
RD/confidence:
  How certain are we about the current estimate?

Volatility:
  How stable is this estimate across contexts, raters, time, or sub-cohorts?

Review maturity / effective evidence count:
  How much effective evidence has accumulated?
```

RD should gate broad estimate movement. Volatility should gate confidence tightening and diagnostic interpretation. High volatility can mean the tag/cohort representation is too coarse, not merely that the estimate is low quality.

### Source authority

Seed ratings are not just ordinary ratings with high trust. Seeds are trust roots. A seed-proxy rating is not a seed rating; it is a rating by a rater who has earned lane-local authority by matching a seed.

Important provenance distinction:

```text
Alice directly rates Island X:
  sourceClass = directSeed
  provenance = Alice

Bob earns Alice-proxy and rated Island Y:
  sourceClass = seedProxy
  provenance = Bob-as-Alice-proxy
  proxyForSeedIds = [Alice]
```

Do not rewrite Bob's historical ratings as Alice ratings.

### Snapshot-isolated turns

A turn is a prototype proxy for a product batch cadence. It may eventually correspond to nightly processing, weekly processing, hourly processing, or a manual rebuild.

Rule:

```text
Turn N reads Model State N-1.
Phase 1 captures guided-discovery evidence using State N-1.
Phase 2 captures self-directed/organic evidence using State N-1.
Phase 3 applies all Turn N evidence as one atomic model update.
Phase 3 writes Model State N.
No Phase 3 result is readable by another Phase 3 calculation in the same turn by default.
```

This prevents intra-turn reflection cascades such as: Bob changes Island A, Island A changes Bob's trust, Bob's changed trust changes Island B, and so on.

### Scenario lab invariant

```text
Hidden truth may generate events.
Hidden truth may validate outcomes.
Hidden truth may not drive model inference.
```

The model-visible layer should only see ratings, turns, ledger entries, evidence projections, visible seed metadata, and previous completed model state.

## Important fixtures

### `routing-safe-fit`

A routing sanity test. High predicted fit, high confidence, and low volatility should produce `SAFE_FIT`.

### `rating-revision-supersedes`

A ledger/projection test. A changed vote creates a new ledger entry that supersedes the old one. The old ledger entry remains auditable but no longer contributes as active evidence.

### `bob-becomes-alice-proxy`

First seed-proxy happy path. Bob matches Alice on enough overlapping skill-based ratings to become a lane-local Alice proxy. Prior Bob-only ratings can be reprojected later.

### `seed-proxy-insufficient-overlap`

Control case. Bob does not have enough overlap with Alice to become a proxy.

### `seed-proxy-contradiction-control`

Control case. Bob has overlap but includes contradictions, blocking proxy promotion.

### `seed-proxy-lane-local-control`

Control case. Bob earns skill-based proxy authority, but wrong-lane evidence remains ordinary.

### `proxy-discovers-seed-positive-unrated-island`

Canonical scenario-backed "magic trick" case. Alice never rates an Alice-positive island. Bob, whose hidden priors make him Alice-like, rates it positive before he has proxy status. After Bob proves Alice-like through overlap, his prior rating is later reprojected as seed-proxy evidence. Alice still has no ledger entry for the island.

### `seed-proxy-scenario-matrix`

Primary v12b scenario matrix. It includes Alice plus Bob, Almost Bob, Anti-Bob, and Control. The hidden checksum validates that the visible authority inference classifies them as seedProxy, ordinarySimilar, inverseSignal, and unrelated respectively.

## How to read a trace

Start with these top-level fields:

```text
fixtureId
fixtureDescription
fixtureOracle
steps
finalState
authoritySummary
scenarioAuthorityValidation
```

For each step, inspect:

```text
turnTrace:
  Confirms snapshot isolation metadata.

rawRating:
  The visible rating event.

ratingLedgerEntry:
  Append-only historical record.

ratingEvidenceProjection:
  Current interpretation of that ledger entry.

predictionBefore / predictionAfter:
  Whether the rating matched the current model.

ratingEvidence:
  Signal strength inputs and source metadata.

islandUpdate:
  Audience-fit movement, RD movement, volatility movement.

playerSignalUpdate:
  How the rater's usefulness/alignment/RD/volatility changed.

sourceAuthorityUpdates:
  Seed/proxy authority changes produced by the turn.

retroactiveProjectionUpdates:
  Prior evidence reprojected under authority already readable at the start of that turn.
```

For scenario fixtures, inspect:

```text
fixtureOracle.hiddenTruthChecksum:
  What the hidden test-world truth expects.

authoritySummary:
  What the model inferred from visible evidence.

scenarioAuthorityValidation:
  Whether visible inference matches the hidden checksum.
```

## What is real vs provisional

### Real enough to build on

```text
Drop-in workflow
Modeling-core modular boundaries
Prediction-before/update-after trace shape
Rating ledger and evidence projection seam
Snapshot-isolated turn doctrine
Seed/proxy provenance distinction
Hidden-truth scenario lab discipline
Counterfactual scenario matrix structure
```

### Provisional lab math

```text
Signal-strength formulas
Proxy thresholds
Proxy strength calculations
RD/confidence/volatility tuning
Routing score weights
Learning rates
Multi-turn convergence behavior
```

These are plausibility models, not calibrated production algorithms.

### Not yet implemented / deferred

```text
Observed behavior integration
Tag evolution / tag discovery
Adversarial stress tests
Continuous multi-seed trust propagation
Real persistence
Production batch scheduler
Web UI exposure of v12 trace data
Creator-facing product flows
```

## Risks and cautions

### Scenario overfitting

The scenario matrix is controlled and diagnostic. It is not yet broad simulation. Passing it means the intended mechanism manifests under expected conditions and does not manifest under some known controls.

### Hidden truth leakage

Future scenario work must preserve the invariant that hidden truth does not drive model inference. Hidden truth can generate events and validate results only.

### UI impedance mismatch

The lab trace now contains structures the web UI probably does not understand: ledger entries, projections, dirty projection records, authority summaries, validation summaries, hidden checksums, turn metadata, and scenario matrices.

### Math calibration

The core math remains intentionally simple. It should be treated as a scaffold for reasoning, not a tuned recommendation engine.

## Recommended next phase

Do not add another major modeling mechanic immediately. Consolidate and integrate.

Recommended sequence:

```text
1. Validate v12b locally when convenient.
2. Treat this handoff and the scenario docs as the current modeling-lab reference.
3. Plan UI exposure for scenario runs and trace summaries.
4. Implement analyst-facing web UI panels for the new trace structures.
5. Only then resume deeper modeling work: smoother source authority, multi-seed propagation, observed behavior, tag evolution, adversarial tests.
```

## UI integration thesis

The next UI should not be a polished player-facing product view. It should be an analyst/lab UI that answers:

```text
What scenario ran?
What was hidden truth?
What did the visible model infer?
Did validation pass?
Which turns produced which events?
Which ledger entries were projected or reprojected?
Which actors became proxies, inverse signals, or controls?
Which islands changed, and why?
```

See `wayfarer_ui_integration_plan_v12b.md` for the proposed UI plan.
