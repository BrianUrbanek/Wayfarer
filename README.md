# Wayfarer

Wayfarer is a toy/prototype implementation of a cohort-aware discovery system for user-generated content.

The system is designed to test a constrained, analyst-governed recommendation model:

- players declare preference tags;
- seeded internal meta-moderators define initial cohort anchors;
- players rate UGC islands with `+1`, `0`, or `-1`;
- the model compares declared tag fit against observed rating behavior;
- signal means model fit, not moral credibility or access authority;
- the system can suggest existing cohort retags and flag unexplained predictive behavior for analyst review;
- it does **not** automatically invent production cohorts.

The current implementation target is a browser-based TypeScript app, likely Vite + React + Vitest, so Codex can run tests and iterate on the algorithm safely.

## Core docs

- [Cohort-Aware Discovery Toy Spec](docs/cohort-aware-discovery-toy-spec.md)
- [Algorithm Implementation Spec](docs/algorithm-implementation-spec.md)

## Working names

- **Wayfarer**: repository/project name.
- **Wayfinder**: possible external/system/app name.
- **Columbus**: internal synthetic dataset generator / debug engine codename.

## First milestone

Build a testable toy implementation that can:

1. generate seeded meta-moderators, islands, and synthetic users;
2. infer declared cohort fit from tags;
3. infer behavioral cohort fit from ratings;
4. compute signal as agreement between declared and behavioral cohort distributions;
5. diagnose mismatches, inverse profiles, noisy users, and retag candidates;
6. produce pseudo-cohort reports for analyst review;
7. show the model state in a legible UI.
