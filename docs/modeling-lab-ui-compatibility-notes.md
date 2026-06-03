# Modeling Lab UI Compatibility Notes

_Last updated: 2026-06-03_

These notes track existing dashboard readouts that remain useful for the Columbus simulation path but should be reviewed before treating them as v12b modeling-core surfaces.

## Keep for first integration

The first Modeling Lab UI pass adds a separate analyst section and does not remove existing panels. This keeps the v12b trace viewer scoped while preserving the current app's simulation dashboard.

## Cleanup candidates for next pass

- `Rater signal`, `Effective signal`, and `trustWeight` are legacy cohort-similarity proxies. They are not equivalent to v12b `PlayerSignalModel`, `sourceAuthority`, `seedProxy`, or `RatingEvidence.signalStrength`.
- Current recommendation readouts come from `src/model/recommendations.ts`, which exposes `SAFE_FIT`, `SMART_GAMBLE`, and `DISCOVERY_PROBE`. v12b modeling-core routing also has `SUPPRESS_OR_AVOID` and `GUIDED_DISCOVERY` plus richer routing traces.
- Cohort-local island affinity panels remain valid for the Columbus dashboard, but v12b separates append-only ledger entries, evidence projections, source authority, signal strength, island audience-fit state, RD, and volatility.
- System Confidence and related confidence cards are still proxy health metrics for the current dashboard. They should not be presented as calibrated modeling-core confidence, RD, volatility, or validation status.

## Recommended next cleanup pass

Review each existing panel and choose one of three actions:

1. Relabel as Columbus simulation / legacy proxy.
2. Repoint to modeling-core trace data where an equivalent exists.
3. Delete if the readout duplicates or contradicts the modeling-core lab surface.
