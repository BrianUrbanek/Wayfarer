# Modeling Core Lab

Wayfarer now includes a compact modeling-core harness for deterministic, traceable inspection of the current prediction and recommendation pipeline.

## What it does

- runs a deterministic fixture through the current model code
- emits a JSON trace for one event step
- preserves the current math instead of rewriting it
- explicitly marks unsupported future-model concepts in the trace

## Command

```powershell
npm run model:lab -- --fixture basic
npm run model:lab -- --fixture meh-observed
```

Optional output file:

```powershell
npm run model:lab -- --fixture basic --output artifacts\modeling-core\basic-trace.json
```

## Trace shape

Each trace step includes:

- `rawRating`
- `assignedRating`
- `playerDescriptors`
- `ratingEvidence`
- `signalStrength`
- `sourceAuthority`
- `trustEstimate`
- `trustRD`
- `signalVolatility`
- `predictionBefore`
- `predictionError`
- `islandUpdate`
- `playerSignalUpdate`
- `deferredEvidence`
- `predictionAfter`
- `recommendationFacingState`
- `unsupportedConcepts`

When a concept is not present in the current model, the trace marks it in `unsupportedConcepts` rather than inventing a placeholder semantics layer.

## Validation

```powershell
npm run test:node
.\\node_modules\\.bin\\tsc.cmd -b
npm test
npm run build
```
