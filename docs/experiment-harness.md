# Experiment Harness

Wayfarer includes a Node-safe experiment harness for characterization runs over the current Organic Exploration, Guided Discovery, and Mixed turn policies.

## What it does

- runs seeded simulations with the current model code
- captures per-turn metrics from `SimulationState`
- aggregates run-level and policy-level summaries
- writes both JSON and Markdown outputs

The harness is a measurement layer, not a model redesign. It does not change recommendation math, rater-signal math, island-affinity math, or reviewer-archetype recovery logic.

## Command

```powershell
npm run analyze:runs
npm run analyze:open
```

Default behavior:

- scenario: `baseline`
- seeds: scenario defaults
- output: timestamped folder under `artifacts/experiments/`

You can override the selected scenarios, seeds, or output path:

```powershell
npm run analyze:runs -- --scenario baseline,low-alignment --seeds 1201,1202,1203 --output artifacts\experiments\manual-check
```

## Output

Each run writes:

- `experiment-suite.json`
- `experiment-suite.md`

The JSON file is the full machine-readable suite result. The Markdown file is a compact characterization summary for human review.

## Metrics

The harness records:

- per-turn rating counts
- participating user counts
- routed island counts
- recommendation kind counts
- mean and median rater signal
- mean and median signal evidence
- mean and median island affinity confidence
- mean and median island affinity evidence
- under-reviewed island counts and evidence
- signal growth
- affinity evidence growth
- discovery probe volume
- safe-fit volume
- time-to-useful-signal
- throughput cost per run, per turn, and per population size
- evidence efficiency

The analysis is approximate in the sense that it summarizes the current model outputs rather than re-running a separate statistical pipeline.

## Limits

- The harness is for characterization, not proof.
- Turn 0 is the bootstrap baseline and is included in the per-turn snapshots.
- Timing is wall-clock Node runtime duration, so use it for comparisons, not absolute truth.
- The output is only as good as the current simulation state; it does not create new model behavior.

## Validation

The expected validation loop is:

```powershell
npm run test:node
.\node_modules\.bin\tsc.cmd -b
npm run analyze:runs
```

The final command should leave an artifact path under `artifacts/experiments/` that you can inspect directly.

`npm run analyze:open` opens the most recent `experiment-suite.md` from that directory in the system default viewer. You can also point it at a specific report path with `-- --path ...` if needed.
