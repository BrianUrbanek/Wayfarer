# Wayfinder / Columbus Algorithm Implementation Spec

## Role of This Document

This document is the implementation-facing companion to the higher-level Cohort-Aware Discovery Toy Prototype Spec.

The other document answers:

> What are we building, and why?

This document answers:

> How do we build the toy algorithm, synthetic dataset, tests, and UI/debug outputs?

The prototype should begin as a browser-based TypeScript app unless the implementation target changes later. The same core model should remain portable to Godot.

## Naming

- **Wayfinder**: external/system/app name.
- **Columbus**: internal synthetic dataset generator / debug engine codename.

Recommended repo/app name:

```text
wayfinder
```

Recommended internal generator naming:

```text
ColumbusGenerator
columbus_seed_data.json
Columbus Debug Panel
```

## Implementation Philosophy

The v0 implementation must remain constrained.

The algorithm should:

- map users into known seeded cohorts,
- compare declared tag fit against observed rating behavior,
- calculate signal as model-fit,
- suggest existing cohort retags when behavior strongly matches a different known cohort,
- flag noteworthy unexplained patterns for analyst review,
- generate pseudo-cohort reports for analysts.

The algorithm should not:

- create production cohorts automatically,
- retire tags automatically,
- rename cohorts automatically,
- treat signal as moral credibility,
- use hidden synthetic generation metadata during inference.

## Proposed Stack

Recommended first implementation:

```text
Vite + React + TypeScript + Vitest
```

Purpose of each layer:

- **Vite**: local dev server and build tool.
- **React**: UI/dashboard layer.
- **TypeScript**: model and UI safety.
- **Vitest**: unit tests and regression tests.

The core model should be UI-independent so it can later be reused in Godot or another visualization layer.

## Recommended Project Structure

```text
wayfinder/
  src/
    model/
      types.ts
      vectors.ts
      similarity.ts
      inference.ts
      diagnostics.ts
      recommendations.ts
      pseudoCohorts.ts
    generator/
      columbusGenerator.ts
      tagGeneration.ts
      ratingGeneration.ts
      islandGeneration.ts
      seededRandom.ts
    data/
      defaultTags.ts
      defaultCohorts.ts
    ui/
      App.tsx
      components/
        UserList.tsx
        IslandTable.tsx
        ModelOutputPanel.tsx
        SimilarityBars.tsx
        DiagnosisPanel.tsx
        PseudoCohortPanel.tsx
        DebugPanel.tsx
    tests/
      similarity.test.ts
      generator.test.ts
      inference.test.ts
      diagnostics.test.ts
      pseudoCohorts.test.ts
  package.json
  README.md
```

The important rule:

> `src/model` and `src/generator` must not import from `src/ui`.

The algorithm must be testable without rendering the UI.

## Core Types

### Primitive Types

```ts
type TagId = string;
type UserId = string;
type IslandId = string;
type CohortId = string;

type Rating = -1 | 0 | 1;
type MaybeRating = Rating | null;
```

Important semantic distinction:

```text
0    = the player rated the island as neutral / meh
null = the player has not rated the island
```

Do not collapse `null` into `0`.

### Core Data Objects

```ts
interface Island {
  id: IslandId;
  label: string;
  hiddenAppealPattern?: Record<CohortId, Rating>;
  hiddenClass?: IslandClass;
}
```

```ts
interface CohortAnchor {
  id: CohortId;
  label: string;
  tags: TagId[];
  ratings: Record<IslandId, MaybeRating>;
  source: "meta_moderator" | "analyst_defined";
}
```

In v0, every recognized cohort is a seeded `CohortAnchor` sourced from a meta-moderator or analyst-defined profile.

The system should not create production cohorts automatically.

```ts
interface User {
  id: UserId;
  label: string;
  declaredTags: TagId[];
  ratings: Record<IslandId, MaybeRating>;

  hiddenSeedCohortId?: CohortId;
  hiddenTagAlignment?: number;
  hiddenRatingAlignment?: number;
}
```

Synthetic/debug-only values must never be used by model inference.

### Analysis Objects

```ts
interface SimilarityResult {
  value: number;
  evidence: number;
  overlapCount: number;
}
```

```ts
interface CohortMatch {
  cohortId: CohortId | null;
  score: number;
}
```

```ts
type DiagnosisType =
  | "HIGH_SIGNAL"
  | "MISMATCH_RETAG"
  | "INVERSE_PROFILE"
  | "UNKNOWN_OR_NOISY"
  | "LOW_SIGNAL"
  | "AMBIGUOUS"
  | "UNEXPLAINED_PREDICTIVE";
```

```ts
interface Diagnosis {
  type: DiagnosisType;
  message: string;
  suggestedCohortId?: CohortId;
  suggestedTags?: TagId[];
  analystPriority: "none" | "low" | "medium" | "high" | "critical";
  reasons: string[];
}
```

## Vector Representation

### Tag Vectors

Tags are represented as sparse/binary membership over the global tag list.

```ts
function tagsToVector(tags: TagId[], allTags: TagId[]): number[] {
  const tagSet = new Set(tags);
  return allTags.map((tag) => (tagSet.has(tag) ? 1 : 0));
}
```

Important: tags are not individually ranked by default. The meaningful unit is the cohort’s full tag combination.

### Rating Vectors

Ratings are represented as vectors over islands.

```ts
function ratingsToVector(
  ratings: Record<IslandId, MaybeRating>,
  allIslands: Island[]
): MaybeRating[] {
  return allIslands.map((island) => ratings[island.id] ?? null);
}
```

Use `null` for missing data. Do not treat missing as `meh`.

## Similarity Functions

### Cosine Similarity

Use cosine similarity for tag vectors.

```text
cosine(A, B) = dot(A, B) / (|A| * |B|)
```

Interpretation:

```text
1.0 = same direction / strong overlap
0.0 = no overlap
```

### Pearson Correlation for Ratings

Use Pearson correlation for rating patterns because ratings can be positive, neutral, or negative, and inverse patterns matter.

```text
+1 = perfect agreement
 0 = no relationship
-1 = perfect inverse relationship
```

Implementation must ignore missing ratings. It should return a `SimilarityResult`, not only a number.

### Evidence from Overlap

Similarity should return both a value and an evidence term.

A simple saturating evidence curve:

```text
evidence = overlap / (overlap + k)
```

Example with `k = 20`:

```text
overlap 5   => 0.20
overlap 20  => 0.50
overlap 100 => 0.83
```

For synthetic v0 with every user rating every island, evidence may be close to uniform. Keep it in the code anyway because the real model will need it.

## Declared Similarity

Declared similarity compares user tags to each seeded cohort’s tag combination.

For each user/cohort pair:

```text
DeclaredSimilarity[user, cohort] = cosine(userTagVector, cohortTagVector)
```

Return a `SimilarityResult` with simple evidence of `1` when the user has declared tags, and `0` otherwise.

## Behavioral Similarity

Behavioral similarity compares user ratings to each seeded cohort’s rating pattern.

For each user/cohort pair:

```text
BehavioralSimilarity[user, cohort] = pearson(userRatingVector, cohortRatingVector)
```

Return raw Pearson value plus evidence from overlap.

## Distribution Construction

The model compares declared and behavioral distributions over known cohorts.

### Positive Behavioral Match

Raw Pearson values may be negative. For declared-vs-observed fit, use only positive behavioral match.

```ts
function positiveBehaviorScore(sim: SimilarityResult): number {
  return Math.max(0, sim.value) * sim.evidence;
}
```

### Inverse Behavioral Match

Negative correlation is diagnostically valuable.

```ts
function inverseBehaviorScore(sim: SimilarityResult): number {
  return Math.max(0, -sim.value) * sim.evidence;
}
```

### Normalize Scores

Normalize non-negative scores so they sum to `1`. If all scores are zero, return equal weights.

### Declared Distribution

```text
DeclaredDistribution[user] = normalize(max(0, declaredSimilarity.value) * evidence)
```

### Behavior Distribution

```text
BehaviorDistribution[user] = normalize(max(0, behavioralSimilarity.value) * evidence)
```

### Inverse Behavior Distribution

```text
InverseBehaviorDistribution[user] = normalize(max(0, -behavioralSimilarity.value) * evidence)
```

## Signal Calculation

Signal measures how well declared cohort proximity agrees with behavioral cohort proximity.

It is not an absolute quality score for the user.

### Signal Fit

```text
SignalFit[user] = cosine(DeclaredDistribution[user], BehaviorDistribution[user])
```

### Signal Evidence

For v0, use total rating coverage or weighted behavioral evidence.

### Effective Signal

```text
EffectiveSignal[user] = SignalFit[user] * SignalEvidence[user]
```

In the UI, show these separately:

```text
Signal fit
Signal evidence
Effective signal
```

Do not hide the difference.

## Diagnosis Rules

Thresholds should be configurable.

Suggested starting values:

```ts
const DEFAULT_THRESHOLDS = {
  highSignal: 0.75,
  lowSignal: 0.35,
  strongCohortMatch: 0.60,
  mediumCohortMatch: 0.40,
  strongInverse: 0.60,
};
```

Because distributions are normalized, thresholds may need tuning once synthetic data is running.

### High Signal

Criteria:

```text
effectiveSignal >= highSignal
```

Meaning:

> Declared cohort proximity and behavioral cohort proximity agree.

### Mismatch / Retag

Criteria:

```text
declaredTop.score >= strongCohortMatch
behaviorTop.score >= strongCohortMatch
declaredTop.cohortId !== behaviorTop.cohortId
effectiveSignal < highSignal
```

Meaning:

> The player declares like Cohort A but behaves like Cohort B.

Action:

> Suggest Cohort B’s tags.

### Inverse Profile

Criteria:

```text
inverseTop.score >= strongInverse
behaviorTop.score < mediumCohortMatch
```

Meaning:

> The player is not random; they are structured-away-from a known cohort.

### Unknown or Noisy

Criteria:

```text
behaviorTop.score < mediumCohortMatch
inverseTop.score < strongInverse
```

Meaning:

> The player does not strongly match or invert any known cohort.

### Low Signal

Criteria:

```text
effectiveSignal < lowSignal
```

Meaning:

> The player’s declared profile poorly explains observed behavior.

### Unexplained Predictive

This requires later traction/prediction data and is not part of the first static inference pass.

Criteria shape:

```text
knownCohortFit is low
predictivePower is high
stableAudiencePool exists
```

Meaning:

> This user or pseudo-cohort is high-value but not explained by known cohort structure.

Analyst priority:

```text
critical
```

## Recommendation Logic v0

Recommendation is optional for the first implementation, but the shape should be defined.

For a selected user, build a preference distribution over seeded cohorts.

Possible blend:

```text
preference = declaredDistribution * (1 - evidence) + behaviorDistribution * evidence
```

Where `evidence` can be `signalEvidence` or rating coverage.

Predict rating for an island:

```text
PredictedRating[user, island] = sum(preference[cohort] * cohortRating[island])
```

Rank unrated islands by predicted rating.

## Pseudo-Cohort Analysis

Pseudo-cohorts are analyst-facing candidate patterns, not production cohorts.

### Tag Combination Key

A pseudo-cohort can be defined by exact tag combination:

```ts
function tagCombinationKey(tags: TagId[]): string {
  return [...tags].sort().join("|");
}
```

Later, support near-match tag combinations using overlap thresholds.

### Internal Rating Consistency

For a group of users, compute average pairwise Pearson correlation.

### Pseudo-Cohort Report Object

```ts
interface PseudoCohortReport {
  key: string;
  tags: TagId[];
  userCount: number;
  internalConsistency: number;
  consistencyEvidence: number;
  averageKnownCohortFit: number;
  averageEffectiveSignal: number;
  predictiveValue?: number;
  reportType: "CONSISTENT_CANDIDATE" | "INCONSISTENT_TAG_RISK";
  analystPriority: "low" | "medium" | "high" | "critical";
  users: UserId[];
}
```

### Top Consistent Pseudo-Cohorts

Criteria:

```text
userCount >= minGroupSize
internalConsistency high
consistencyEvidence meaningful
averageKnownCohortFit low or moderate
```

Rank by:

```text
internalConsistency * consistencyEvidence * populationWeight * unexplainedBonus
```

### Top Inconsistent Pseudo-Cohorts

Criteria:

```text
userCount >= minGroupSize
internalConsistency low or negative
consistencyEvidence meaningful
```

Rank by:

```text
(1 - normalizedConsistency) * consistencyEvidence * populationWeight
```

Meaning:

> This tag combination does not produce coherent ratings. It may contain vague, overloaded, or poorly chosen tags.

## Predictive Power / Unexplained High-Signal User Detection

This is a later stage because it requires time-separated data.

The static synthetic dataset can fake this with two phases:

1. Early ratings
2. Later traction / later ratings from a stable pool

### Unexplained High-Signal Condition

A candidate new seed user has:

```text
low known-cohort fit
high predictive power
stable audience pool
```

Possible v1 toy metric:

```text
For each user U:
  For each island rated early by U:
    Compare U's rating to later average rating among other users.
  predictivePower = correlation(U early ratings, later pool outcomes)
```

If predictivePower is high but knownCohortFit is low:

```text
flag as UNEXPLAINED_PREDICTIVE
analystPriority = critical
```

### Stable Audience Pool

A stable pool can be approximated by users whose later ratings correlate with that candidate seed user’s ratings or whose island engagement moves in accordance with that user’s ratings.

Do not create a new cohort automatically.

Only surface:

```text
An unexplained high-signal user appears predictive for this recurring audience pool.
```

## Columbus Synthetic Generator

The generator creates controlled data with hidden answer-key values.

Inference must not use hidden values.

### Generator Config

```ts
interface GeneratorConfig {
  seed: number;
  numUsers: number;
  numIslands: number;
  cohorts: CohortAnchor[];
  allTags: TagId[];

  tagAlignmentDistribution: AlignmentDistribution;
  ratingAlignmentDistribution: AlignmentDistribution;

  islandClassWeights?: Partial<Record<IslandClass, number>>;
}
```

### Seeded Random

Use seeded randomness so scenarios are reproducible.

Required behavior:

```text
same config + same seed = same dataset
```

### Alignment Scale

Both tag and rating alignment use the same conceptual range:

```text
10 = correlated with hidden seed
 5 = random / uncorrelated relative to hidden seed
 0 = anti-correlated or maximally different from hidden seed
```

These values are generation scaffolding only.

### Generate Islands

Use hidden island classes to ensure useful diagnostic patterns.

Suggested island classes:

```ts
type IslandClass =
  | "BROAD_HIT"
  | "BROAD_DUD"
  | "NICHE_COHORT"
  | "POLARIZED_PAIR"
  | "MEH"
  | "CROSS_COHORT";
```

The algorithm does not see island class.

### Generate Ratings From Seed

```ts
function invertRating(rating: Rating): Rating {
  if (rating === 1) return -1;
  if (rating === -1) return 1;
  return 0;
}
```

Rating alignment:

```text
10 = copy seed
 5 = random
 0 = invert seed
```

Caveat:

```text
0 inverts to 0, so many meh ratings weaken anti-correlation.
```

Mitigation:

```text
Use fewer 0 ratings in seed cohort rating patterns if strong anti-correlation tests are needed.
```

### Generate Tags From Seed

Use alignment as interpolation between seed-like, random, and anti-seed tag sets.

```text
10 = seed-like
 5 = random
 0 = anti-seed
```

Keep target tag count close to seed tag count.

## Must-Pass Unit Tests

### Similarity Tests

1. Cosine exact match returns 1.
2. Cosine no-overlap binary tags returns 0.
3. Pearson exact rating match returns near 1.
4. Pearson inverse rating match returns near -1.
5. Pearson random-ish ratings returns near 0 with enough samples.
6. Pearson ignores nulls.
7. Pearson returns zero evidence when overlap is below threshold.

### Inference Tests

1. User tags and ratings both match Cohort A.
   - Declared top = A.
   - Behavior top = A.
   - Effective signal high.
   - Diagnosis HIGH_SIGNAL.

2. User tags match Cohort A, ratings match Cohort B.
   - Declared top = A.
   - Behavior top = B.
   - Effective signal low.
   - Diagnosis MISMATCH_RETAG.
   - Suggested cohort = B.

3. User generated from Seed A but visible tags and ratings match Cohort B.
   - Declared top = B.
   - Behavior top = B.
   - Effective signal high.
   - Diagnosis HIGH_SIGNAL.
   - Hidden seed mismatch is not an error.

4. User ratings strongly invert Cohort A.
   - Inverse top = A.
   - Diagnosis INVERSE_PROFILE if no stronger positive behavior match exists.

5. User ratings random relative to all cohorts.
   - Behavior top weak.
   - Diagnosis UNKNOWN_OR_NOISY or AMBIGUOUS.

6. User has blended tags and blended ratings across Cohorts A/B.
   - Declared distribution and behavior distribution are similar.
   - Effective signal high or medium-high.
   - Not forced into a single cohort.

### Generator Tests

1. Same seed and same config produce identical dataset.
2. Different seeds produce different datasets.
3. Tag alignment 10 produces seed-like tags.
4. Tag alignment 0 avoids seed tags as much as possible.
5. Rating alignment 10 strongly matches seed ratings.
6. Rating alignment 0 strongly anti-correlates with seed ratings, assuming enough non-zero seed ratings.
7. Rating alignment 5 is approximately uncorrelated over enough samples.
8. Hidden generation fields are present in debug data but not used by inference functions.

### Pseudo-Cohort Tests

1. A tag combination group with high pairwise rating correlation appears in Top Consistent Pseudo-Cohorts.
2. A tag combination group with low or negative pairwise rating correlation appears in Top Inconsistent Pseudo-Cohorts.
3. Small groups below minimum size are excluded or marked low evidence.
4. High internal consistency plus low known-cohort fit increases analyst priority.

## UI Requirements

The UI should be an explainability dashboard.

### Main Panels

1. **Users Panel**
   - list users
   - show type: seed/meta-moderator vs generated user
   - allow selection

2. **Island Ratings Panel**
   - show selected user’s ratings across islands
   - optionally compare to selected cohort ratings

3. **Model Output Panel**
   - declared distribution over cohorts
   - behavior distribution over cohorts
   - inverse behavior distribution
   - signal fit
   - signal evidence
   - effective signal
   - diagnosis
   - suggested tags/cohort

4. **Debug Panel**
   - hidden seed
   - hidden tag alignment
   - hidden rating alignment
   - inferred-vs-hidden classification
   - warning that hidden fields are not model inputs

5. **Pseudo-Cohort Panel**
   - top consistent pseudo-cohorts
   - top inconsistent pseudo-cohorts
   - user count
   - internal consistency
   - known-cohort fit
   - analyst priority

### Mutation Controls

- regenerate dataset
- choose random seed
- adjust number of users
- adjust number of islands
- adjust tag alignment distribution
- adjust rating alignment distribution
- toggle hidden debug panel
- edit selected user tags
- edit selected user ratings
- rerun inference

## Initial Codex Tasks

### Task 1: Project Setup

Create a Vite React TypeScript app with Vitest.

Acceptance:

- app runs locally,
- test command works,
- placeholder dashboard renders.

### Task 2: Core Types and Similarity

Implement `types.ts`, `vectors.ts`, and `similarity.ts`.

Acceptance:

- similarity tests pass.

### Task 3: Columbus Generator

Implement seeded random generator and synthetic dataset generation.

Acceptance:

- generator tests pass,
- same seed reproduces same dataset.

### Task 4: Inference Pipeline

Implement declared similarities, behavioral similarities, distributions, signal, and diagnosis.

Acceptance:

- inference tests pass.

### Task 5: UI Dashboard

Build basic panels for users, ratings, inference output, and debug fields.

Acceptance:

- selecting a user updates all panels,
- hidden debug fields are visually separated from model output.

### Task 6: Pseudo-Cohort Reports

Implement exact-tag-combination pseudo-cohort reports.

Acceptance:

- pseudo-cohort tests pass,
- UI shows top consistent and inconsistent groups.

## Open Questions / Tuning Areas

- Should declared tag similarity use cosine, Jaccard, or exact-combination distance?
- Should seeded cohorts have required vs optional tags?
- How many tags should a cohort have by default?
- How many islands are needed before Pearson is stable enough for useful toy results?
- Should `0 = meh` be common or rare in seed ratings?
- Should behavior distribution use raw positive Pearson, evidence-weighted Pearson, or thresholded Pearson?
- How should blended cohort assignments be explained to users/analysts?
- What minimum population size should pseudo-cohorts require?
- What evidence threshold makes a pseudo-cohort analyst-worthy?
- How should time-separated predictive power be simulated for unexplained high-signal user detection?

## Design Checksum

The implementation should preserve these rules:

- Hidden seed metadata is only for debug and test validation.
- Inference only uses visible tags and ratings.
- Cohorts are seeded tag-combination anchors in v0.
- The system maps users into known cohorts; it does not invent production cohorts.
- Signal means fit between declared identity and observed behavior.
- Low signal does not mean invalid taste.
- Unexplained predictive behavior is high-priority analyst material.
- Pseudo-cohorts are reports, not automatic taxonomy changes.
- The model layer must remain testable without the UI.
