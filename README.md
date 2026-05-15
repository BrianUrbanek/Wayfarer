# Wayfarer

Wayfarer is a browser-based TypeScript / React / Vitest analyst console for a cohort-aware discovery system for user-generated content.

The current app is a working prototype, not just a scaffold. It is designed to test a constrained, analyst-governed recommendation model:

- players declare preference tags;
- seeded internal meta-moderators define initial cohort anchors;
- players rate UGC islands with `+1`, `0`, or `-1`;
- the model compares declared tag fit against observed rating behavior;
- signal means model fit, not moral credibility or access authority;
- the system can suggest existing cohort retags and flag unexplained predictive behavior for analyst review;
- it does **not** automatically invent production cohorts;
- rating signal is cohort-local, while tag-level summaries are derived and explanatory.

The current UI is a browser analyst console for inspecting sparse ratings, cohort-local signal, island affinity, and routing behavior.

## Core docs

- [Cohort-Aware Discovery Toy Spec](docs/cohort-aware-discovery-toy-spec.md)
- [Algorithm Implementation Spec](docs/algorithm-implementation-spec.md)
- [Wayfarer Next-Generation Model Spec](docs/wayfarer-next-generation-model-spec.md)
- [Experiment Harness](docs/experiment-harness.md)
- Saved scenario JSON is local-only reproducibility data for export/import during development.
- Scenario presets are named experimental conditions and are defined in [`src/data/scenario-catalog.json`](src/data/scenario-catalog.json). Novice mode shows the preset selector and short rationale; Expert mode exposes the resolved controls for editing.
- Demo narratives use a dual-frame structure: a system use case plus a player journey, tied to shared steps and inspectable results.
- Fixed preset counts are intentional. Durable user activity profiles are future work, and the current turn model still uses per-turn selection rather than stable Pareto-like activity shapes.

## Live demo

- [Wayfarer on GitHub Pages](https://brianurbanek.github.io/Wayfarer/)

## Working names

- **Wayfarer**: repository/project name.
- **Wayfinder**: possible external/system/app name.
- **Columbus**: internal synthetic dataset generator / debug engine codename.

## Project Hygiene

- Keep changes narrow and issue-bounded unless the task explicitly asks for broader cleanup.
- For docs work and Node-safe model checks, run `npm run test:node` and `.\node_modules\.bin\tsc.cmd -b`.
- For characterization runs, use `npm run analyze:runs` and inspect the generated JSON/Markdown output under `artifacts/experiments/`.
- For local scenario reproduction, use the export/import controls in the simulation setup and keep the saved JSON files outside product content.
- For wider behavior changes, also run the broader local checks you actually touched, such as `npm run test`, `npm run build`, or `npm run dev`.
- Do not report a command as passing unless you actually ran it in this workspace.

## First milestone

Build a testable toy implementation that can:

1. generate seeded meta-moderators, islands, and synthetic users;
2. infer declared cohort fit from tags;
3. infer behavioral cohort fit from ratings;
4. compute signal as agreement between declared and behavioral cohort distributions;
5. diagnose mismatches, inverse profiles, noisy users, and retag candidates;
6. produce pseudo-cohort reports for analyst review;
7. show the model state in a legible UI.
