# Live App / Modeling-Core Alignment Audit

_Created for the foundation confidence fix pass._

## Decision boundary

The live app should not keep independent model semantics once modeling-core has a canonical concept for the same thing. The app can still translate, summarize, and label model output for presentation. `Confidence` remains acceptable as UI shorthand, especially for novice-facing composites, but the durable model should prefer explicit ingredients such as RD, volatility, evidence support, source authority, and signal strength.

This pass only removes passive no-evidence RD decay from the live island/cohort rating substrate. It does not migrate recommendations, affinity, persistence, or repeat-rating behavior.

## Foundation fix

The live app previously widened island/cohort RD after several turns with no new evidence. That made `IslandCohortRatingState.confidence`, currently stored as `1 - ratingDeviation`, collapse during exhausted Golden Demo tails where no ratings were being created.

No-evidence turns now preserve learned RD and confidence. Future freshness or decay should be introduced as a separate heartbeat or patch-cycle concept, not as passive erosion of learned certainty.

## Current divergence map

### Rater signal and source authority

- Live app path: `buildRaterSignalProfiles()` derives `cohortWeights` from visible behavioral similarity and overlap evidence.
- Modeling-core path: `RatingEvidence.signalStrength` is derived from source authority, lane-local usefulness, lane-local RD, lane-local volatility, polarity clarity, and event context.
- Divergence: live `cohortWeights` are legacy signal proxies. They are not equivalent to modeling-core `PlayerSignalModel`, `sourceAuthority`, `seedProxy`, or `signalStrength`.
- Next migration target: route live rating evidence weighting through a modeling-core-style signal-strength helper before changing recommendation behavior.

### Event-stored weights and evidence projections

- Live app path: each `RatingEvent` stores `raterSignalWeights` at creation time.
- Modeling-core path: rating events are append-only ledger inputs; evidence projections carry active contribution state, signal strength, source class, version compatibility, superseding, and dirty-projection records.
- Divergence: live event-stored weights freeze the rater/source read at event time and make later RD, volatility, or source-authority changes hard to reproject honestly.
- Next migration target: introduce a live adapter that can derive active evidence from canonical events plus current source state, without treating stored event weights as the long-term source of truth.

### Affinity, recommendation, and deprioritization consumers

- Live app path: affinity, recommendations, deprioritization, reviewer archetypes, and selected-user summaries consume `cohortWeights` or values derived from them.
- Modeling-core path: routing reasons use prediction confidence ingredients, source signal strength, scout value, volatility penalty, and richer route kinds.
- Divergence: the live app still uses older proxy weights for production-facing recommendation and evidence summaries.
- Next migration target: migrate one consumer at a time behind compatibility tests, starting with rating evidence weighting before route selection.

### Repeat ratings and revisions

- Live app path: ordinary and guided event creation filters out already-rated user/island pairs, so repeat ratings are not currently modeled as revisions.
- Modeling-core path: `RatingEvent` supports `revisionReason` and `supersedesEventId`; the ledger preserves history while superseded projections stop contributing as active evidence.
- Divergence: live app cannot yet represent patch-cycle re-ratings or current-source refreshes without either duplicate evidence or bespoke filtering.
- Next migration target: later patch-cycle mode should permit re-rating by creating revision events that supersede prior user/island evidence for the relevant island/game-rules version.

### Confidence terminology

- Live app path: `confidence` appears in stored snapshots, system health, confidence growth, selected-island readouts, and UI composites.
- Modeling-core path: internal traces also use confidence-like names for derived certainty multipliers and prediction/routing confidence.
- Divergence: `Confidence` is now intended as UI shorthand, not a canonical model primitive. Some model-core internals may need later renaming or caveats so the durable model vocabulary stays explicit.
- Next migration target: keep UI confidence composites in app/presentation helpers; keep model-core terms explicit where possible, such as RD, stability, signal multiplier, prediction support, and evidence support.

## Intended sequence

1. Foundation: confidence/RD is not freshness-adjusted; no-evidence turns do not erase learned certainty.
2. Unification: live app rating evidence and rater weighting consume modeling-core-style signal strength instead of legacy `cohortWeights` proxies.
3. Repeat-rating semantics: patch-cycle re-ratings become revisions/refreshes via superseding, not independent duplicate evidence.
4. Presentation cleanup: panels continue to label legacy/proxy values honestly until their data sources are migrated.

## Non-goals for this pass

- No persisted simulation schema change.
- No modeling-core type change.
- No recommendation or routing behavior migration.
- No live app repeat-rating support.
- No heartbeat or patch-cycle decay implementation.
