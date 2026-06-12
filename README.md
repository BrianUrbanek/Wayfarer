# Wayfarer

Wayfarer is an experimental discovery and recommendation system for user-generated game experiences.

Wayfarer is an active prototype and modeling lab. The current codebase is intended to explore evidence, rating prediction, uncertainty, volatility, and recommendation behavior. It is not a production-ready discovery service.

The core thesis is simple:

> The rating prediction engine is the recommendation engine.

Wayfarer does not treat recommendations as a separate ranking layer bolted on top of ratings. Instead, it learns which players, cohorts, islands, evidence sources, and contexts produce reliable preference predictions. The system recommends by asking: “For this player, in this context, which island are we most likely to predict correctly, and where would new evidence be most valuable?”

## Current canonical docs

The current source-of-truth docs are:

- `docs/PROJECT_MAP.md` — project goals, system model, current architecture, design principles, and simplification/audit rules.
- `docs/DIAGNOSTIC_EXPECTATIONS.md` — what healthy system behavior should look like in Golden Demo, system movement, and modeling diagnostics.

Archived documents are preserved under `docs/archive/`. They are historical references only and should not be treated as current architecture unless a current canonical doc explicitly revives them.

## Current system focus

Wayfarer currently focuses on:

- player preference modeling
- island/cohort audience fit
- rating prediction
- evidence provenance
- uncertainty / rating deviation
- volatility / instability detection
- cumulative support
- refresh-aware evidence epochs
- source usefulness
- diagnostic simulation

The most important recent architecture changes are:

- evidence freshness is epoch-based, not turn-based
- island and game updates reopen uncertainty without automatically creating volatility
- rating confidence is no longer capped/inching per turn
- cumulative support now allows strong consensus to resolve uncertainty quickly
- same-context contradiction and split evidence raise volatility
- latest stated ratings remain visible even when current-context aggregates are refreshed or reopened

## Running the project

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Run tests:

```bash
npm.cmd run test:node
npm.cmd test
npm.cmd run build
```

On non-Windows shells, use the equivalent `npm run ...` commands.

## Development discipline

Wayfarer is built around an append-only evidence mindset.

Events are the audit trail. Current state is a projection.

Do not erase historical ratings to represent freshness. Use epochs, refresh boundaries, and current-context projections.

Do not merge explicit stated ratings, inferred revealed-preference evidence, synthetic observed behavior, and diagnostics into a single undifferentiated signal.

Do not treat confidence as a single universal formula. Confidence is a canonical projection family: each confidence kind has a specific domain, owner, input shape, and factor breakdown.

Player-facing UI may summarize expert state into simpler confidence language, but the underlying model should preserve the distinctions among:

- support
- rating deviation / uncertainty
- volatility / instability
- evidence source authority
- provenance
- freshness
- context

## Current next step

The next major project step is diagnostic review.

After the #83 rating-state math rewrite, Golden Demo and system movement outputs should be regenerated and reviewed against `docs/DIAGNOSTIC_EXPECTATIONS.md`.

The goal is to confirm that the system now behaves like Wayfarer, not merely that tests pass.
