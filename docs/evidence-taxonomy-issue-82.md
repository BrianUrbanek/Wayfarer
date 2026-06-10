# Wayfarer Evidence Taxonomy / Issue #82

This document is the issue #82 terminology authority pass. It defines the names Wayfarer should use before adding new evidence architecture.

## Canonical Evidence Categories

- **Explicit stated rating evidence**: a direct player rating. It is stated preference and remains separate from inferred or observed evidence.
- **Inferred revealed-preference evidence**: an upstream black-box estimate of demonstrated preference. It preserves source and provenance and must not be written into explicit rating state.
- **Synthetic observed behavior**: current prototype behavior rows generated from explicit rating events. It is not raw telemetry.
- **External observed behavior**: reserved future behavior evidence supplied by an external source. It must carry provenance and remain distinct from inferred preference.
- **Projected / model-consumable evidence**: evidence transformed through model rules for eligibility, source class, authority, version context, and contribution.
- **Diagnostic interpretation**: a read about evidence, such as stated-vs-revealed alignment. Diagnostics are not primary evidence.
- **Refresh / revision context**: patch, island update, version, and supersession context that decides current evidence eligibility without deleting history.
- **Compatibility / proxy / degraded evidence**: labeled bridge state used when canonical projected evidence is not available.

## Canonical Concept Boundaries

- **Support** is amount or weight of evidence. It is not confidence.
- **Confidence** is UI shorthand only when the ingredients are clear. Durable model concepts should name RD, uncertainty, volatility, support, authority, or prediction support directly.
- **RD / uncertainty** is estimate width. It is not freshness and not confidence.
- **Volatility / instability** is observed instability, contradiction, split preference, context sensitivity, or change over time. It is not ignorance.
- **Source authority** is evidence-source usefulness in a context. It is not global trust and not personal preference.
- **Trust / signal** should be local to cohort, lane, task, or source context. Avoid global moral trust wording.
- **Source** identifies where an evidence record came from. **Provenance** explains how it was produced and why it is attached.
- **Active evidence** contributes in the current context. **Historical evidence** remains auditable. **Superseded evidence** is historical evidence replaced for current contribution. **Stale evidence** is evidence from an older refresh/version context.

## Audience Rules

- Player-facing UI: use plain language such as "your rating", "shown preference", "match", and "why this was suggested"; avoid RD, volatility, source authority, and projection.
- Novice demo UI: "confidence" is allowed only as a labeled summary with support/stability caveats.
- Analyst UI: may use stated/revealed, support, compatibility/proxy/degraded, synthetic observed behavior, and diagnostics.
- Expert/debug UI: may use RD, volatility, source authority, projection, supersession, and model-consumable evidence.
- Modeling Lab: should use precise modeling-core terms and preserve distinction between ledger entries, projections, traces, and diagnostics.
- Issue/work-order language and internal code names: prefer canonical category names when changing architecture.

## Dangerous Drift

- Treating inferred revealed-preference evidence as explicit rating state.
- Calling synthetic observed behavior "raw behavior" or external telemetry.
- Using "confidence" without naming support, RD/uncertainty, volatility, and authority ingredients.
- Treating source authority, trust, and signal as interchangeable global player quality.
- Treating refresh or revision as deletion of history.
- Treating diagnostics as primary evidence.

## Follow-Up Dependency Order

1. Stabilize glossary/docs/copy so canonical terms are visible.
2. Add a canonical live evidence view model that separates explicit, inferred, synthetic observed, projected, diagnostic, and refresh-context evidence.
3. Make inferred evidence refresh-context aware.
4. Replace selected-user and selected-island proxy surfaces with view-model-backed evidence.
5. Add authored island cadence profiles.
6. Clean up observed behavior naming/model boundaries.
7. Decompose remaining bundle hotspots.
