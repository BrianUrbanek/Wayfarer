# Wayfarer Modeling Lab UI Integration Plan — v12b

_Last updated: 2026-06-03_

## Goal

Expose the new modeling-core scenario and trace systems in the existing web app as an analyst/lab UI.

This should not be a player-facing discovery UI yet. The first integration should help a designer/developer answer:

```text
Did the scenario run?
What did the model infer?
Did that match hidden truth?
Which evidence caused the result?
Where did source authority, projections, routing, and updates move?
```

## Why now

The modeling lab now has enough meaningful internal structure that raw JSON is becoming insufficient:

```text
rating ledger
evidence projections
snapshot-isolated turns
source authority / seed proxy
retroactive projection updates
scenario hidden truth checksums
authority summaries
scenario validation results
routing traces
player signal updates
island updates
```

The next bottleneck is not more model logic. It is making this state readable.

## UI integration principle

Start with a lab/analyst view. Avoid product polish until the underlying model is easier to inspect.

Recommended first UI question:

> Can a person open a scenario run and understand the causal chain without reading 2,000 lines of JSON?

## Proposed page: Modeling Lab / Scenario Runs

### Core controls

```text
Scenario/fixture selector
Run button
Optional output/export button
Raw JSON toggle
```

Initial scenario list should include:

```text
routing-safe-fit
rating-revision-supersedes
bob-becomes-alice-proxy
seed-proxy-insufficient-overlap
seed-proxy-contradiction-control
seed-proxy-lane-local-control
proxy-discovers-seed-positive-unrated-island
seed-proxy-scenario-matrix
```

The default selected scenario should probably be:

```text
seed-proxy-scenario-matrix
```

because it exercises the richest set of current systems.

## Panel 1: Run summary

Purpose: answer whether the run worked and what it was testing.

Fields:

```text
fixtureId
fixtureDescription
step count
validation passed/failed
scenario authority validation status
unsupported concepts
```

Suggested display:

```text
Scenario: seed-proxy-scenario-matrix
Status: PASS
Steps: 24
Validation: hidden checksum matched visible authority summary
Primary doctrine tested: hidden-truth-generated behavior with visible-only authority inference
```

## Panel 2: Turn timeline

Purpose: make snapshot isolation visible.

Fields per turn/step:

```text
turn
readModelStateTurn
writeModelStateTurn
capturePhase
updatePhase
snapshotIsolation flag
raw rating event summary
source authority updates
retroactive projection updates
```

Suggested display:

```text
Turn 1
  Reads State 0
  Captures: Bob rates Alice-positive-unrated island
  Writes State 1
  No same-turn proxy authority used

Turn 2
  Reads State 1
  Captures: Bob/Alice overlap ratings
  Writes State 2
  Bob earns Alice-proxy authority

Turn 3
  Reads State 2
  Reprojects Bob's prior rating as seedProxy evidence
  Writes State 3
```

Important visual rule: show that `readModelStateTurn` differs from the turn being written. This is how we communicate no intra-turn reflection.

## Panel 3: Authority matrix

Purpose: show hidden expected relationship vs visible inferred relationship.

Rows:

```text
Alice
Bob
Almost Bob
Anti-Bob
Control
```

Columns:

```text
Actor
Visible role / inferred relation
Expected hidden relation
Seed reference
Lane
Overlap count
Agreement count
Contradiction count
Proxy strength / relationship strength
Validation result
```

Example:

| Actor | Hidden expected | Visible inferred | Seed | Lane | Overlap | Agreement | Result |
|---|---|---|---|---|---:|---:|---|
| Bob | seedProxy | seedProxy | Alice | skill-based | 15 | 15 | PASS |
| Almost Bob | ordinarySimilar | ordinarySimilar | Alice | skill-based | 10 | 10 | PASS |
| Anti-Bob | inverseSignal | inverseSignal | Alice | skill-based | 15 | 0 | PASS |
| Control | unrelated | unrelated | Alice | skill-based | 0 | 0 | PASS |

This is the single most important UI panel for v12b.

## Panel 4: Hidden truth checksum inspector

Purpose: show the oracle without pretending it was model input.

Display hidden truth under a clear label:

```text
ORACLE / TEST TRUTH — not model input
```

Fields:

```text
actor id
expectedRelationToSeed
seedId
laneScope
hiddenSimilarity
notes
```

Include a warning/note:

```text
Hidden truth generates events and validates outcomes. Source-authority inference does not read these labels.
```

## Panel 5: Evidence timeline

Purpose: show the causal chain from event to ledger to projection to reprojected authority.

For each meaningful event:

```text
Turn
Actor
Island
Rating
Source
Ledger entry id
Projection id
sourceClass
proxyForSeedIds
signalStrength
active/superseded
```

Important filters:

```text
Show only actor: Bob
Show only island: Alice-positive-unrated
Show only sourceClass: seedProxy
Show superseded entries
Show retroactive projections only
```

For `proxy-discovers-seed-positive-unrated-island`, this panel should show:

```text
Bob rated Alice-positive-unrated before proxy status.
Alice never rated the island.
Later projection changed Bob's evidence sourceClass to seedProxy.
Ledger provenance remains Bob.
```

## Panel 6: Ledger / projection inspector

Purpose: debug append-only history vs mutable current state.

Two-column view:

```text
Ledger entry
Evidence projection
```

Ledger fields:

```text
entryId
eventId
playerId
islandId
rating
source
turn
reason
supersedesEntryId
```

Projection fields:

```text
projectionId
ledgerEntryId
activeForCurrentIslandVersion
supersededByPlayer
contributesToIslandEstimate
sourceClass
authorityBasis
proxyForSeedIds
signalStrength
calculatedAtTurn
modelVersion
```

This panel is especially useful for `rating-revision-supersedes` and retroactive proxy fixtures.

## Panel 7: Routing and recommendation explanation

Purpose: preserve v10 routing visibility.

Fields:

```text
kind
routingScore
predictedRating
confidence
safeFitScore
smartGambleScore
discoveryProbeScore
suppressOrAvoidScore
guidedDiscoveryScore
primaryReason
factors
```

Display as a breakdown, not just final category.

## Panel 8: Player signal update inspector

Purpose: show how the rater's value as a signal source changes.

Fields:

```text
trustEstimate
trustRD
signalVolatility
laneSignalUsefulness
laneSignalAlignment
laneSignalRD
laneSignalVolatility
usefulnessDeltas
alignmentDeltas
signalRDDeltas
signalVolatilityDeltas
```

This is important for distinguishing:

```text
Bob: useful aligned signal
Anti-Bob: useful inverse signal
Control: unrelated/noisy signal
```

## Panel 9: Island update inspector

Purpose: show how island audience-fit beliefs change.

Fields:

```text
audienceFitDeltas
islandRDDeltas
islandVolatilityDeltas
rawObservationDelta
learningPressure
```

Eventually this panel should expose review maturity and effective evidence counts once those are added.

## Panel 10: Validation details

Purpose: show why a scenario passed or failed.

Fields:

```text
scenarioAuthorityValidation.passed
validation results per actor
expected relation
inferred relation
mismatch reason
```

For failures, show enough context to debug:

```text
Expected Bob => seedProxy(Alice, skill-based)
Inferred Bob => ordinarySimilar(Alice, skill-based)
Reason: overlapCount 12 below threshold 15
```

## Data flow recommendation

Initial UI integration can be simple:

```text
Run modeling fixture from existing JS/TS code.
Receive ModelingTraceRun JSON.
Render panels from that JSON.
Keep raw JSON available for debugging.
```

Do not introduce real persistence for this UI yet. This is a lab view.

## Suggested implementation phases

### UI Phase 1: Static trace viewer

Load a saved JSON trace or run a fixture and render:

```text
Run summary
Authority matrix
Hidden checksum inspector
Raw JSON
```

This gives immediate value with minimal UI surface.

### UI Phase 2: Turn and evidence timeline

Add:

```text
Turn timeline
Evidence timeline
Ledger/projection inspector
```

This makes snapshot isolation and retroactive projection visible.

### UI Phase 3: Model movement inspectors

Add:

```text
Routing explanation
Player signal update inspector
Island update inspector
```

This preserves the v10 predictive/routing work and makes update mechanics visible.

### UI Phase 4: Scenario comparison

Run multiple fixtures and compare outputs:

```text
Bob vs Almost Bob vs Anti-Bob vs Control
Happy path vs insufficient overlap
Happy path vs contradiction-heavy overlap
Skill lane vs wrong-lane evidence
```

This turns the lab into a proper experiment browser.

## Minimal type/view model sketch

A UI adapter can flatten a trace into a view model like:

```ts
interface ModelingRunViewModel {
  runSummary: RunSummary;
  turnTimeline: TurnTimelineEntry[];
  authorityRows: AuthorityMatrixRow[];
  hiddenChecksumRows: HiddenChecksumRow[];
  evidenceRows: EvidenceTimelineRow[];
  ledgerProjectionRows: LedgerProjectionRow[];
  routingRows: RoutingRow[];
  playerSignalRows: PlayerSignalRow[];
  islandUpdateRows: IslandUpdateRow[];
  validationRows: ValidationRow[];
  rawTrace: ModelingTraceRun;
}
```

This adapter should live near UI code rather than inside the modeling core unless it becomes useful for CLI reports too.

## UX rules

1. Label hidden truth clearly as oracle/test truth.
2. Never present Bob-as-Alice-proxy as Alice directly rating something.
3. Keep provenance visible: source actor, source class, authority basis, proxy target.
4. Make turn boundaries visible.
5. Show pass/fail validation before raw details.
6. Preserve raw JSON escape hatch.
7. Prefer causal timelines over giant object dumps.

## Recommended first UI build

Build the smallest useful page:

```text
Scenario selector
Run button
Run summary
Authority matrix
Hidden truth checksum panel
Raw JSON panel
```

If that works, add turn/evidence timeline next.

## Known limitations

The UI will expose lab-grade math. It should avoid presenting outputs as production-quality recommendation scores. Use labels such as:

```text
Diagnostic confidence
Lab proxy strength
Scenario validation
Visible inference
Oracle expectation
```

Avoid product-sounding claims like:

```text
This island is definitively good for Alice-like players.
```

Prefer:

```text
In this scenario, the visible model inferred Bob as an Alice proxy and reprojected Bob's prior rating as Alice-proxy evidence.
```

## Next technical step after documentation

Before implementing UI, inspect current app state and decide where the modeling lab belongs:

```text
Existing dashboard?
New Modeling Lab route?
Developer-only panel?
Scenario report component?
```

Then create a read-only viewer first. Do not write new model state from the UI in the first pass.
