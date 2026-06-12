# Cohort-Aware Discovery Toy Prototype Spec

## Purpose

Build a toy implementation for testing and demonstrating a cohort-aware discovery system for user-generated content.

The prototype is not intended to model production behavior perfectly. Its purpose is to create a controlled synthetic dataset with known hidden structure, then test whether the algorithm can infer meaningful cohort alignment, signal quality, mismatch, retagging suggestions, and possible unknown-cohort behavior using only visible player tags and ratings.

The current v0 implementation target is a browser-based TypeScript app, because that gives Codex a simple, testable development loop with standard command-line validation. Godot remains a possible later visualization target if the prototype benefits from a more game-like or spatial presentation, but it is not the initial implementation target.

## Core Concept

This system is not a traditional trust or moderation system. It is a discovery and recommendation system.

The central goal is:

> For each player, surface user-generated content they are likely to enjoy, based on observed rating patterns from players with similar taste.

There is no single meaningful global truth about whether content is “good.” Content quality is local, cohort-relative, and player-relative. A sweaty 1v1 duel island may be excellent for high-skill competitive players and terrible for casual roleplay players. That disagreement is signal, not noise.

Global analytics still matter for business, infrastructure, cost, retention, and platform policy. Those concerns belong in a separate analytics or business layer. They should not define the recommender’s concept of quality.

## Important Separation of Concerns

The recommender should answer:

> What is this player likely to enjoy?

The business layer may separately answer:

> How expensive is this content to host, how much engagement does it generate, how does it correlate with spend, and is it worth supporting?

Those layers may eventually interact, but they should remain conceptually distinct.

## Key Terms

### Player

A user of the system. In the toy dataset, players are divided into seeded internal meta-moderators and generated new users.

### Meta-Moderator

An internal seeded rater with a distinct tag profile and a seeded rating pattern. Meta-moderators are treated as high-signal anchors at startup.

Their signal may eventually be revalidated against live data, but in the toy prototype they are trusted starting points.

### New User

A synthetic generated player with visible declared tags and visible ratings, but no pre-existing signal record.

Each new user is generated from a hidden seed meta-moderator for dataset construction purposes, but the algorithm must not be given that seed identity.

### Tag

A self-identified preference marker, such as:

- Competitive
- Skill Expression
- Roleplay
- Social
- Brain Rot
- Fast Sessions
- Slow Sessions
- Exploration
- Tactical
- Team Coordination
- Systems Mastery
- Casual
- Weird
- Narrative
- Low Pressure

Tags are not absolute truth. They are routing hints used to map a player into existing seeded cohort profiles. The meaningful unit is the full tag combination, not an isolated tag.

### Cohort

In the first version of the system, a cohort is a seeded tag-combination profile represented by an internal meta-moderator.

A cohort is not an individual tag, and no tag is intrinsically higher, stronger, or more authoritative than another. Cohort identity comes from the combination of tags.

For example:

- { Skill, Roleplay, Short Session, Premades } may define Cohort A.
- { Skill, Roleplay, Long Session, Premades } may define Cohort B.

Those cohorts may later prove to have dramatic overlap in island preferences, or they may diverge strongly. The system should not assume either outcome from the tags alone.

In v0, the only recognized cohorts are the seeded meta-moderator profiles. New players are confidence-mapped into those existing cohorts based on degree of tag overlap and later checked against rating behavior.

### Signal

Signal is not moral credibility, access authority, or universal rating validity.

In this system, signal means:

> How well a player’s observed rating behavior matches the taste pattern implied by their declared or assigned identity profile.

A low signal score does not mean a player has bad taste or invalid opinions. It means their current profile does not explain their observed ratings well.

Signal can be recalculated if a player changes tags or if the system discovers a better cohort assignment.

### Declared Identity

The visible tag profile claimed by a player.

### Observed Behavior

The rating pattern produced by a player across UGC islands.

### Hidden Seed

The meta-moderator used by the synthetic data generator as the source pattern for a new user.

The hidden seed exists only for test generation and validation. The algorithm must never receive it.

## Synthetic Dataset Strategy

The toy prototype should use a controlled synthetic dataset.

The benefit of synthetic data is that we know the hidden generating structure, so we can test whether the algorithm rediscovers the intended relationships from visible evidence only.

### Dataset Tiers

There are two tiers of users:

1. Internal meta-moderators
2. Generated new users

### Meta-Moderator Generation

Create a small number of meta-moderators, probably 5 to start.

Each meta-moderator should have a very distinct tag group.

Example seed profiles:

| Seed | Example Identity |
|---|---|
| A | Competitive, Skill Expression, Fast Sessions |
| B | Roleplay, Social, Slow Sessions |
| C | Brain Rot, Fast Sessions, Casual, Meme |
| D | Exploration, Weird, Narrative, Low Pressure |
| E | Tactical, Team Coordination, Systems Mastery |

These are illustrative only. The actual tag set should be editable in the prototype.

### UGC Island Generation

Create a set of UGC islands.

At the earliest stage, islands do not need authored details beyond an ID/count. Their identity is implicitly defined by how the meta-moderators rate them.

For each island, each meta-moderator randomly assigns a rating:

- +1 = thumbs up
- 0 = meh
- -1 = thumbs down

For the prototype, we can pretend these are good ratings based on real criteria. We do not need to simulate island features yet.

### New User Generation

Each new user is assigned a hidden seed meta-moderator. New users should be distributed evenly among the seeded moderators.

Each new user receives two hidden generation values:

1. Tag Alignment
2. Rating Alignment

These values are used only to generate data. They have no meaning in the real algorithm.

The algorithm sees only:

- declared tags
- ratings

It does not see:

- hidden seed
- tag alignment value
- rating alignment value

## Alignment Scales

### Tag Alignment

Tag Alignment ranges from 0 to 10.

It describes how closely the generated user’s declared tags resemble the hidden seed moderator’s tag set.

Suggested interpretation:

| Value | Meaning |
|---|---|
| 10 | Tags closely or exactly match the hidden seed |
| 5 | Tags are random or uncorrelated relative to the hidden seed |
| 0 | Tags are deliberately anti-correlated or maximally different from the hidden seed, as much as the tag space allows |

Tag Alignment is synthetic scaffolding only.

### Rating Alignment

Rating Alignment ranges from 0 to 10.

It describes how closely the generated user’s ratings resemble the hidden seed moderator’s ratings.

Suggested interpretation:

| Value | Meaning |
|---|---|
| 10 | Strongly correlated with hidden seed ratings; nearly exact match |
| 8 | Mostly agrees with seed, with some deviation |
| 5 | Uncorrelated/random relative to seed |
| 2 | Mostly disagrees with seed |
| 0 | Strongly anti-correlated with seed ratings; nearly inverted |

Because this is a controlled dataset, noise should be low. The goal is not to simulate messy reality yet. The goal is to produce clean diagnostic cases.

## Important Data Generation Principle

A new user may be generated from Seed A with low tag alignment and low rating alignment, but by coincidence or structure, end up matching Seed B very well.

That is not a failure.

It is a desirable test case.

The algorithm should infer the best explanation from visible tags and ratings only. It should not care which hidden seed was used to generate the user.

## Algorithmic Goals

The prototype should answer these questions:

1. Does the system correctly identify players who have both tag overlap and rating overlap with a known cohort?
2. Does it rate their signal highly?
3. Does it correctly identify players with high tag overlap but poor rating overlap?
4. Does it rate their signal low under the declared profile?
5. Can it identify players whose ratings consistently match a cohort different from their declared tags?
6. Can it suggest a better identification set?
7. Can it identify users who are not explained by known seeded cohorts?
8. Can it flag unexplained users for analyst review without automatically creating new cohorts?

## First-Pass Algorithm

The first implementation should be simple and legible.

### Step 1: Represent Tags as Vectors

Each tag is a dimension.

A player’s declared identity becomes a tag vector.

For example:

- Competitive = 1
- Skill Expression = 1
- Fast Sessions = 1
- Roleplay = 0
- Social = 0
- etc.

### Step 2: Represent Ratings as Vectors

Each UGC island is a dimension.

A player’s rating behavior becomes a rating vector.

Ratings:

- +1 = thumbs up
- 0 = meh
- -1 = thumbs down

### Step 3: Compute Declared Similarity

Compare the new user’s tag vector to each meta-moderator’s tag vector.

This produces a declared similarity distribution.

Example:

| Cohort | Declared Similarity |
|---|---:|
| A | 0.12 |
| B | 0.82 |
| C | 0.34 |
| D | 0.08 |
| E | 0.18 |

### Step 4: Compute Behavioral Similarity

Compare the new user’s rating vector to each meta-moderator’s rating vector.

This produces a behavioral similarity distribution.

Example:

| Cohort | Behavioral Similarity |
|---|---:|
| A | 0.05 |
| B | 0.78 |
| C | 0.31 |
| D | 0.10 |
| E | 0.22 |

### Step 5: Compute Signal

Signal is the fit between declared identity and observed behavior.

In the simplest version:

> If the declared similarity distribution and behavioral similarity distribution point to the same cohort or mixture of cohorts, signal is high.

> If tags point to one cohort and ratings point to another, signal is low under the current declared identity.

This signal score should be contextual, not absolute.

### Step 6: Generate Diagnosis

For each user, produce a diagnosis such as:

- High signal: declared tags and observed ratings both match Cohort A.
- Low signal: declared tags match Cohort A, but observed ratings match Cohort B.
- Retag suggestion: consider Cohort B tags.
- Ambiguous: no strong declared or behavioral match.
- Unknown cohort candidate: ratings do not match known seeds but are internally consistent with other users.
- Inverse profile: ratings are strongly anti-correlated with a known cohort.

## Similarity Methods

Start with simple similarity metrics.

Possible first-pass choices:

- Cosine similarity for tag vectors and rating vectors.
- Pearson correlation for rating vectors, especially if detecting anti-correlation matters.

Because Rating Alignment explicitly includes anti-correlation, the prototype should preserve negative relationships where possible.

Cosine similarity may be useful for tags, because tags are sparse and non-negative.

Pearson correlation may be useful for ratings, because ratings can be positive, neutral, or negative and inverse patterns matter.

## Expected Diagnostic Cases

The synthetic generator should intentionally produce users across the following cases.

### Case 1: High Tag Alignment / High Rating Alignment

Expected result:

- Declared tags match seed/cohort.
- Ratings match same seed/cohort.
- Signal is high.
- No retag suggestion needed.

### Case 2: High Tag Alignment / Low Rating Alignment

Expected result:

- Declared tags match a cohort.
- Ratings do not match that cohort.
- Signal is low.
- If ratings match another cohort, suggest retagging.
- If ratings are inverse-correlated, identify structured disagreement.

### Case 3: Low Tag Alignment / High Rating Alignment

Expected result:

- Declared tags do not match the behaviorally correct cohort.
- Ratings strongly match a known cohort.
- Current signal under declared tags is low.
- Strong retag suggestion.

### Case 4: Low Tag Alignment / Low Rating Alignment

Expected result:

- The user may still be coherent if both tags and ratings land near another known cohort.
- The system should infer that naturally.
- If both visible tags and visible ratings match Cohort B, signal should be high as Cohort B, even if hidden generation came from Seed A.

### Case 5: Mid Tag Alignment / Mid Rating Alignment

Expected result:

- Ambiguous or low-confidence.
- Useful for testing thresholds.

### Case 6: Random / Noisy User

Expected result:

- No strong declared/behavioral match.
- Low signal.
- No confident retag suggestion.

### Case 7: Unknown Cohort Candidate

Expected result:

- User does not match known meta-moderators well.
- Multiple users share similar unexplained behavior.
- Flag for cohort analysis.

This can be a stage-two feature.

## Inferred Cohort vs Hidden Seed

The prototype should explicitly separate hidden generation data from model inference.

### Hidden Generation Data

Visible only in dev/debug mode:

- hidden seed
- tag alignment
- rating alignment

### Model Inference

Visible as the system’s actual output:

- declared similarity distribution
- behavioral similarity distribution
- inferred current cohort or mixture
- signal score
- retag suggestions
- anomaly flags

### Diagnostic Outcomes

The debug UI may classify the relationship between hidden generation and inferred model output as:

- Recovered seed: generated from A and inferred as A.
- Migrated to another seed: generated from A but inferred as B.
- Split profile: tags infer A, ratings infer B.
- Unexplained: no strong fit to known cohorts.
- Inverse profile: ratings are strongly anti-correlated with a known cohort.

The goal is not always to recover the hidden seed. The goal is to infer a coherent explanation from visible evidence.

## Mixture Model Direction

The first prototype may use nearest-seed matching for simplicity.

However, the data structures should be designed toward mixtures from the beginning.

Real players may not belong cleanly to one cohort. A user might be:

- 70% Competitive
- 20% Tactical
- 10% Brain Rot

Their observed ratings might be:

- 65% Competitive
- 25% Tactical
- 10% Brain Rot

That should be high signal, even if there is no single perfect moderator match.

Long-term, signal should compare the declared mixture profile to the observed behavioral mixture profile.

## UI / Browser Prototype Requirements

The prototype should prioritize legibility over polish.

Recommended layout:

### Left Panel: Users

List generated users and meta-moderators.

Selecting a user shows their details.

### Middle Panel: UGC Islands

Show islands and ratings.

For selected user, show that user’s rating per island.

For meta-moderators, show seeded rating patterns.

### Right Panel: Model Output

For selected user, show:

- declared tags
- inferred tags or cohort match
- signal score
- declared similarity distribution
- behavioral similarity distribution
- retag suggestion
- anomaly/cohort discovery flag

### Bottom Panel: Explanation Log

Show human-readable diagnosis.

Examples:

> High signal: this user’s declared tags and ratings both align most strongly with the Competitive / Skill Expression cohort.

> Low signal: this user declares Roleplay / Social, but their ratings align more strongly with Tactical / Team Coordination.

> Suggested retag: Tactical, Team Coordination, Systems Mastery.

> Unknown cohort candidate: this user does not match known cohorts, but shares a stable unexplained pattern with 8 other users.

### Dev Debug Panel

Optional but strongly recommended.

Show synthetic hidden generation values:

- hidden seed
- tag alignment
- rating alignment
- whether inferred cohort matched hidden seed
- diagnostic outcome category

This panel is for development only and should be clearly separated from model output.

## Mutation Controls

The prototype should allow manual changes so the system can be explored interactively.

Possible controls:

- Change selected user’s declared tags.
- Change selected user’s rating on an island.
- Regenerate all data with same settings.
- Regenerate with different random seed.
- Adjust number of meta-moderators.
- Adjust number of new users.
- Adjust number of islands.
- Adjust distribution of tag alignment values.
- Adjust distribution of rating alignment values.
- Toggle hidden debug data.

The useful behavior is watching the model update when tags or ratings change.

## Stage Plan

### Stage 1: Static Synthetic Dataset

- Define tags.
- Define meta-moderators.
- Generate UGC island ratings from meta-moderators.
- Generate new users with hidden seed, tag alignment, and rating alignment.
- Display raw data.

### Stage 2: Similarity and Signal

- Compute declared similarity to each meta-moderator.
- Compute behavioral similarity to each meta-moderator.
- Compute signal as match between declared and behavioral similarity.
- Display diagnosis.

### Stage 3: Retag Suggestions

- If behavioral match differs from declared match, suggest tags from behavioral cohort.
- Show confidence.

### Stage 4: Recommendation Logic

- For a selected user, recommend islands based on inferred cohort preferences.
- Keep explanation text visible.

### Stage 5: Analyst Review Flags and Pseudo-Cohorts

- Identify users not well explained by known seeded cohorts.
- Flag them for analyst review.
- Highest priority should go to users who are high-signal despite being detached from known cohort structure.
- Example: Tina does not map cleanly into any known seeded cohort, but her ratings consistently predict which islands later gain or lose traction among a stable pool of players. That is not low-value noise. It is a high-value unexplained predictive phenomenon.
- The toy system may show similarity among unexplained users as supporting evidence, but it should not automatically create new cohorts.
- Discovering, naming, validating, splitting, or merging meaningful new cohorts is a data-analysis responsibility outside the v0 recommender algorithm.

#### Pseudo-Cohort Analysis

The system may generate pseudo-cohort reports for analyst review. These are not production cohorts. They are ranked candidate patterns.

A pseudo-cohort is a player tag combination, or a recurring region of tag-combination space, that appears noteworthy based on rating behavior.

The system should produce at least two ranked lists:

1. **Top Consistent Pseudo-Cohorts**
   - Player tag combinations whose members rate islands consistently with each other.
   - These are likely candidates for new formal cohorts or for discovering “Tina”-like high-predictive players.
   - High priority if the group is also poorly explained by the existing seeded cohort hierarchy.

2. **Top Inconsistent Pseudo-Cohorts**
   - Player tag combinations whose members rate islands inconsistently with each other.
   - These may indicate that one or more tags are poorly understood, too broad, poorly chosen, or no longer useful.
   - Fixing or retiring weak tags may make high-signal pseudo-cohorts easier to discover.

Pseudo-cohort reports should support human taxonomy maintenance. They should not automatically create, split, merge, rename, or retire cohorts/tags.

### Stage 6: Rating Uncertainty and Early Signal Value

- Add uncertainty per island per cohort.
- Reward ratings that reduce uncertainty.
- Later, add delayed reward for ratings that predict future cohort behavior.

## Pseudo-Cohort Metrics

Pseudo-cohort analysis should evaluate tag combinations independently from seeded cohorts.

For a given tag combination, collect users who declare that combination, or users who are close enough to that combination under a defined overlap threshold.

Useful metrics:

- **Internal rating consistency:** how strongly members agree with one another across commonly rated islands.
- **Coverage:** how many users belong to the pseudo-cohort.
- **Rating overlap:** how many common islands were rated by enough members to make the consistency score meaningful.
- **Known-cohort fit:** how well the pseudo-cohort is explained by existing seeded cohorts.
- **Predictive value:** whether early ratings from this pseudo-cohort predict later traction or satisfaction among a stable pool of players.
- **Tag clarity risk:** high inconsistency within a tag combination may indicate weak or ambiguous tags.

A high-value candidate pseudo-cohort has:

- high internal consistency,
- meaningful population size,
- meaningful rating overlap,
- low fit to existing seeded cohorts,
- and/or high predictive value for future player satisfaction.

A weak or broken pseudo-cohort has:

- low internal consistency,
- poor predictive value,
- and no clear mapping to known cohorts.

The system should expose both cases because both are useful: one suggests a possible new formal cohort, and the other suggests taxonomy cleanup.

## Deferred Production Concepts

The following are important but should not be built first:

- Full Glicko-style uncertainty updates.
- Bayesian content quality distributions.
- Live reward economy.
- Business/hosting/spend/cost metrics.
- Real moderation or enforcement.
- Creator incentives.
- Adversarial resistance.
- Large-scale database architecture.

The first goal is to make the core conceptual model visible and testable.

## Success Criteria for First Prototype

The prototype succeeds if, given a controlled synthetic dataset, the system can:

1. Infer which cohort or mixture best matches a player’s declared tags.
2. Infer which cohort or mixture best matches their ratings.
3. Compute whether those two inferences agree.
4. Produce a signal score consistent with that agreement.
5. Identify clear tag/rating mismatches.
6. Suggest better tags when behavior clearly matches another cohort.
7. Distinguish random/noisy users from structured inverse or migrated users.
8. Flag poorly explained users for analyst review without automatically inventing new cohorts.
9. Prioritize cases where a user is poorly explained by known cohorts but still predicts later traction or satisfaction among a stable pool of players.
10. Produce ranked pseudo-cohort reports for analyst review: top consistent tag combinations and top inconsistent tag combinations.
11. Show all of this in a legible UI.

## Design Checksum

The model should preserve these principles:

- Local truth dominates global truth for recommendations.
- Disagreement across cohorts is signal, not noise.
- Signal means model fit, not moral trust.
- Tags are routing inputs into seeded cohort profiles.
- Cohorts are tag-combination anchors, not individual tag weights.
- Ratings validate or weaken confidence in a player’s current cohort assignment.
- New cohort discovery is an analyst workflow, not an automatic v0 algorithm behavior.
- The system should aggressively surface high-predictive users or clusters that are not explained by the existing cohort hierarchy.
- The system should separately surface highly consistent and highly inconsistent tag combinations as pseudo-cohort analyst reports.
- Hidden seed data must never be used by the algorithm.
- The toy generator should create known structure so the algorithm can be tested honestly.
- The UI should explain the model’s reasoning, not just output scores.
