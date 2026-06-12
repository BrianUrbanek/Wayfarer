# Analyst Panel Confidence Audit

_Created for Issue #68_

## Scope

This pass adds a single shared helper for a novice-facing confidence composite and records where the current dashboard still uses stale confidence semantics.

The helper lives in [`src/model/confidenceComposite.ts`](../src/model/confidenceComposite.ts) and is covered by [`src/tests/node/confidenceComposite.node.test.ts`](../src/tests/node/confidenceComposite.node.test.ts).

## What the helper does

`buildConfidenceCompositeSummary()` treats confidence as a UX summary, not a model primitive.

Inputs:

- rating deviation / uncertainty
- volatility / stability
- evidence count or maturity

Outputs:

- band: `none`, `low`, `mixed`, `medium`, or `high`
- a numeric score
- a short explanation
- explicit factor states for uncertainty, volatility, and evidence using the shared vocabulary `none`, `sparse`, `moderate`, `strong`

## What was deliberately not changed

- No modeling-core math was changed.
- No recommendation behavior was changed.
- No saved scenario serialization was changed.
- No broad UI panel rewrite was attempted.
- No proof-of-use wiring was added, because doing that safely would require a wider `App.tsx` / dashboard refactor than Issue #68 allows.

## Surface audit

Legend:

1. already compatible with Confidence-as-composite
2. using stale confidence semantics
3. blocked by missing RD / volatility / evidence data in the current app path
4. blocked by the larger active-run modeling-trace integration in Issue #69

### Already compatible

- `Primary Workflow` - 1
  - This is a run-control surface, not a confidence readout.
- `Turn Summary` - 1
  - It reports turn context, counts, and routing activity without pretending to define confidence.
- `Turn Recap` - 1
  - It already exposes confidence alongside RD, volatility, and evidence as separate analyst-facing facts.
- `Population Summary` - 1
  - No confidence semantics here.
- `Hidden Cohort Recovery` - 1
  - The learned-read table already separates certainty, affinity, RD, volatility, counts, and status.
- `Reviewer Archetype Recovery` - 1
  - This is a recovery/validation surface, not a confidence surface.
- `Selected Island` - 1
  - The wrapper itself is neutral; the nested summary can stay as an evidence read.
- `Island/Cohort Rating Timeline` - 1
  - This already shows affinity, confidence, RD, volatility, and evidence together and keeps affinity distinct from confidence.

### Stale confidence semantics

- `System Movement` - 2
  - It uses confidence as a movement axis / legibility proxy, which is not the same thing as the composite novice confidence summary.
- `System Health` - 2
  - `systemConfidence` is a higher-level dashboard health metric, not the new novice-facing confidence composite.
- `Confidence Growth` - 2
  - It is still a stored snapshot report over historical confidence values, so it remains a legacy proxy surface.
- `Selected User Summary` - 2
  - `Current signal-weight proxy`, `Rater signal profile`, and related readouts are legacy signal/trust proxies, not the new confidence composite.
- `Discovery Signal` - 2
  - The current implementation still derives it from rating-linked behavior plus stored confidence snapshots.
- `Rater Signal Profile` - 2
  - This is explicitly an internal proxy based on cohort-local similarity, not the composite confidence summary.
- `Discovery Routing` - 2
  - It still uses routing confidence/support as a proxy thresholding concept rather than the new novice confidence helper.
- `Island confidence radar` - 2
  - It is a per-cohort confidence visualization, but the underlying values are still the existing estimate confidence proxy.
- `Island Evidence Distribution` - 2
  - The visualization uses `Rating Event Weight` and related proxies rather than the new composite helper.
- `Rating Event Weight` - 2
  - It is explicitly a derived proxy for routing/evidence strength, not the new confidence summary.

### Blocked by missing data in the current app path

- `Selected User Summary` - 3 for a true composite proof-of-use
  - The panel does not currently receive a direct RD / volatility / evidence summary object for a narrow local proof-of-use without broader refactoring.
- `Discovery Signal` - 3 for a true composite proof-of-use
  - The current player-facing signal path still depends on stored confidence snapshots and behavior-derived proxies, not a direct composite read.
- `System Health` - 3 for a true composite proof-of-use
  - It has the individual proxy values, but it is its own top-level health model and not a direct confidence composite surface.

### Blocked by the larger modeling-trace integration in Issue #69

- `Modeling Lab / Model Evidence Audit` - 4
  - This needs the active-run modeling-trace surface from Issue #69 before it can become a first-class panel.

## Decision summary

The right boundary for Issue #68 is a shared helper plus this audit.

The helper gives the codebase a single inspectable place to describe novice-facing confidence as a composite of uncertainty, stability, and evidence.

The current dashboard remains largely intact for now, but the audit above identifies the legacy proxy surfaces that should be relabeled, repointed, or removed in later cleanup.
