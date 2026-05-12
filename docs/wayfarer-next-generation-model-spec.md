# Wayfarer Next-Generation Model Spec

## Purpose

This document collects the next major conceptual expansion of Wayfarer after the first working proof of concept.

The first implementation demonstrates:

- seeded cohort anchors,
- synthetic users,
- synthetic islands,
- visible tags and ratings,
- user-to-cohort inference,
- diagnosis of high signal, mismatch, inverse profile, noisy users,
- pseudo-cohort reports,
- and an analyst dashboard.

The next-generation model should move from a fully rated synthetic toy world toward a discovery simulation:

> Users rate sparse subsets of islands. The system estimates island appeal by tag/cohort, learns which users are high-signal raters for which taste spaces, and routes under-reviewed islands to players who are likely to both enjoy them and improve the system’s knowledge.

## Core Design Shift

The current model mostly asks:

> Which seeded cohort does this user resemble?

The next model adds:

> What affinity does each island appear to have for each cohort, and how confident are we?

And then:

> Which users are reliable evidence sources for those cohorts?

Tag-level island descriptions may still be useful, but they should be treated as derived explanatory summaries, not the foundation of rater trust.

The trust layer remains cohort-local, not tag-local. Tags are routing hints and explanatory vocabulary; they are not the primary trust surface.

This turns Wayfarer from a static similarity demonstration into a discovery loop.

## Key Concepts

### Expressed Rating

The player’s explicit rating:

```text
-1 = dislike
 0 = neutral / meh
+1 = like
```

This should remain simple and human-readable.

### Rating Event

A rating should be stored as an event, not only as a final aggregate.

A rating event records:

- user,
- island,
- expressed rating,
- turn,
- island age at time of rating,
- island exposure/rating count at time of rating,
- and eventually the rater signal snapshot used at that time.

This is necessary because later analysis may discover that a rater is more or less valuable than previously believed.

### Weighted Rating Contribution

The expressed rating is discrete, but its evidentiary contribution is a float.

```text
weighted contribution = expressed rating × rater signal weight
```

A +1 rating from a high-signal Tactical rater should count more toward Tactical island affinity than a +1 rating from an unknown or low-signal rater.

### Rater Signal

Rater signal is not moral credibility.

It means:

> How useful is this player’s rating behavior as evidence for a known cohort / preference space?

A user may be high-signal for one cohort and low-signal for another.

This is specifically **cohort-local signal**, not tag-local signal.

The system should not treat individual tags as independent trust dimensions. Tags are descriptors, routing hints, and candidate vocabulary. Cohorts are meaningful combinations of tags that have demonstrated coherent rating behavior.

For example, a user is not “high signal for Skill Expression” in isolation. They may be high signal for a cohort such as:

```text
Competitive / Skill Expression / Fast Sessions
```

but low signal for another cohort that also contains Skill Expression, such as:

```text
Skill Expression / Roleplay / Long Sessions / Premades
```

This matters because the same tag can mean different things in different cohort contexts.

Example:

```text
User X:
  Competitive / Skill Expression signal: 0.86
  Roleplay / Social signal: 0.12
  Tactical / Team Coordination signal: 0.34
```

### Island Affinity

For each island and cohort, estimate whether that cohort tends to like or dislike the island.

Tag-level island affinity may also be displayed, but it should be understood as a derived explanatory layer. The more fundamental estimate is cohort affinity, because cohorts preserve context that individual tags lose.

Example:

```text
Island 17:
  Skill Expression affinity: +0.72
  Tactical affinity: +0.61
  Roleplay affinity: -0.48
  Low Pressure affinity: -0.33
```

Affinity should be in the range `-1..1`.

### Confidence

Confidence means:

> How much consistent evidence supports this affinity direction?

Confidence should be based on qualified sample sufficiency, not on percentage of the entire player population.

In a 10,000-player ecosystem, 50 coherent ratings from relevant/high-signal users can be enough to begin expanding exposure. We are not trying to prove universal quality; we are trying to decide whether the next discovery routing step is justified.

### Lift / Specificity

Affinity alone says:

> Users with this tag like this island.

Lift asks:

> Do users with this tag like this island more than users without this tag?

This distinguishes broad hits from tag-specific gems.

Example:

```text
Skill users average rating:     +0.8
Non-skill users average rating: +0.8
```

This is a broad hit, not specifically a Skill Expression island.

```text
Skill users average rating:     +0.8
Non-skill users average rating: -0.2
```

This is a strong Skill Expression island.

### Disagreement / Conflict

A tag can average near zero for two very different reasons:

```text
+1, +1, -1, -1  => polarized / conflicting
 0,  0,  0,  0  => neutral / irrelevant
```

The model should eventually distinguish:

- low confidence due to low sample,
- low confidence due to disagreement,
- and confident evidence that a tag is non-predictive.

## Suggested Island Affinity Data

For each island/cohort estimate, and optionally for derived island/tag summaries:

```ts
interface AffinityEstimate {
  targetId: TagId | CohortId;
  affinity: number;          // -1..1
  confidence: number;        // 0..1 confidence in direction
  lift?: number;             // tagged response vs baseline response
  disagreement: number;      // 0..1 conflict / variance indicator
  rawCount: number;          // number of rating events
  effectiveWeight: number;   // sum of rater weights
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
}
```

## Bayesian / Shrinkage Baseline

Simple averages overreact to small samples.

If two Skill Expression users rate an island +1, the observed mean is +1.0, but that should not become high-confidence truth.

Use Bayesian shrinkage:

```text
shrunken affinity =
  (prior weight × prior mean + effective weight × observed mean)
  / (prior weight + effective weight)
```

With prior mean 0, all island/tag affinities begin neutral and are pulled away from 0 as evidence accumulates.

This preserves early signal while preventing tiny samples from creating extreme certainty.

## Confidence from Sample Sufficiency

Confidence should saturate with qualified evidence.

A simple shape:

```text
sample confidence = effective weight / (effective weight + k)
```

Example with `k = 20`:

```text
5 effective ratings   => 20%
20 effective ratings  => 50%
50 effective ratings  => 71%
100 effective ratings => 83%
```

This means 50 coherent qualified ratings can be meaningful even if the total possible population is much larger.

Confidence in direction can combine sample sufficiency with agreement:

```text
direction confidence = sample confidence × directional agreement
```

Where directional agreement may be based on absolute observed mean, variance, or another conflict measure.

## Sparse Ratings

The current prototype lets every user rate every island.

The discovery simulation should not.

Sparse ratings are what make discovery meaningful. If every user has already rated every island, the system has nothing to route and nothing left to learn.

Instead:

- each user rates only a subset of islands,
- islands have unequal exposure,
- some islands are old and well-known,
- some are new and under-reviewed,
- some have broad global appeal,
- some have narrow cohort appeal,
- and some are misleadingly popular or overexposed.

This lets Wayfarer actually perform discovery:

> Given what we know so far, which unrated islands should this user see next?

## Discovery Recommendations

Discovery recommendations are generated across turns. The system should recommend or route islands that a user has not yet rated, then observe the resulting rating event in a later state.

Recommendation should eventually balance:

```text
expected user fit
+ exploration / discovery value
```

A simple shape:

```text
recommendation score = predicted user fit + exploration weight × discovery value
```

Where:

```text
predicted user fit = match between user profile and island learned affinities
```

And:

```text
discovery value = uncertainty × under-reviewed score × relevance to user
```

This lets the system distinguish:

- safe recommendations,
- promising under-reviewed candidates,
- and high-value discovery probes.

## Discovery Confidence vs Affinity Confidence

These are related but distinct.

### Affinity Confidence

How confident are we that the island has a positive/negative affinity for a tag/cohort?

### Discovery Confidence

How ready are we to expand exposure based on current evidence?

An island can have:

```text
high predicted fit
low affinity confidence
high discovery value
```

That makes it a good exploration candidate.

Or:

```text
high predicted fit
high affinity confidence
low discovery value
```

That makes it a safe recommendation but not a discovery opportunity.

## Rater Signal and Retroactive Reweighting

Once the system recognizes that a generated user consistently rates like Seed A, that user’s ratings should become higher-weight evidence for Seed A’s taste space.

This implies:

- ratings must be individually tracked,
- rater signal must be recomputed over time,
- island affinity estimates should be recomputable from rating events,
- and historical ratings may become more or less important as rater signal changes.

Example:

```text
Turn 1:
User X rates Island Foo +1.
User X has low/unknown signal.

Turn 5:
System discovers User X consistently matches Competitive / Skill Expression.

Reanalysis:
User X’s historical +1 on Island Foo now contributes more evidence toward Competitive / Skill Expression affinity.
```

This is the implied cohort-local trust layer.

## Avoiding Feedback Loops

If rater signal and island affinity update each other carelessly, the system can become self-reinforcing.

Example failure:

1. User X is considered high-signal.
2. User X rates Island Foo highly.
3. Island Foo becomes high-affinity for X’s cohort.
4. User X now appears even more correct because they liked an island they helped define.

To avoid this, use staged or lagged turn updates:

```text
Use prior-turn rater signal to weight current-turn island affinity.
Use current-turn outcomes to update next-turn rater signal.
```

For stricter evaluation, later versions may use leave-one-out or holdout logic:

```text
When evaluating User X, compare against island/cohort estimates that exclude User X's own rating contribution.
```

The proof of concept does not need full production-grade anti-leakage, but it should preserve the causal idea: a rating should not immediately validate itself in the same turn.

## Turn-Based Simulation Loop

For this proof of concept, model time as a turn-based simulation rather than as calendar days.

A turn is one discrete causal update step. It does not matter whether a turn represents a day, a week, a discovery refresh window, or some other platform cadence. What matters is the ordering:

```text
State exists.
Users rate some islands.
The system runs an analysis pass.
Derived state updates.
The user can inspect the result.
Repeat.
```

This makes the model easier to reason about and avoids accidentally implying that real-world time scale matters to the prototype.

### Turn Structure

A simple turn:

```text
1. Start from the current simulation state.
2. Select which users act this turn.
3. Each participating user rates between X and Y islands.
4. Ratings become immutable RatingEvents.
5. Run an analysis pass.
6. Update rater signal profiles.
7. Recompute island cohort affinities.
8. Recompute discovery recommendations.
9. Generate analyst reports.
10. Pause for inspection.
```

UI controls should eventually include:

```text
Take 1 Turn
Take X Turns
Reset Simulation
```

The important affordance is `Take 1 Turn`, because it makes the causal chain inspectable.

### Organic / Guided / Mixed Turn Modes

The simulation can support different turn modes.

Organic Exploration:

```text
Users rate random sparse subsets of islands.
The system observes and learns.
```

Guided Discovery:

```text
The system recommends or routes unrated islands to users.
Users rate those routed islands.
The system learns whether its routing improved fit, confidence, or discovery value.
```

Mixed Turn Mode:

```text
The turn policy selects one shared set of participating users.
Each selected user is then evaluated for organic and guided eligibility.
A selected user may produce organic events, guided events, both, or neither.
The participating user count remains an honest cap on distinct users involved in the turn.
```

This distinction is important. Organic turns test whether the model can infer structure from sparse observations. Guided turns test whether the model can improve discovery by choosing useful routing probes. Mixed turns test both at once while keeping the participant set shared and turn-scoped.

Current turn policy controls how many users participate in a turn. A future model may move participation tendencies onto generated users with separate organic/guided activity profiles, but that is intentionally out of scope here.

### Feedback-Safe Turn Rules

To avoid self-reinforcing feedback loops, each turn should respect causal boundaries.

A safe default:

```text
Use the state at the start of Turn N to choose/rank/rout islands during Turn N.
Use ratings generated during Turn N to update the state after Turn N.
Those updates affect Turn N+1, not the already-completed decisions of Turn N.
```

When evaluating a rater’s signal, avoid grading the user solely against island affinities that were created by that same user’s same-turn rating. Later versions may use leave-one-out logic for stricter anti-leakage checks.

### Example Turn Story

```text
Before Turn 6:
Island 12 has low Tactical affinity confidence.

Turn 6:
The system routes Island 12 to several users with some Tactical / Team Coordination signal.
Six users like it, one is neutral, one dislikes it.

After Turn 6:
Island 12's Tactical cohort affinity rises.
Affinity confidence increases.
Discovery readiness increases.
The next turn may expand exposure to adjacent cohorts.
```

This turn-based framing is the preferred language for the prototype. Avoid using day/week language except as optional flavor.

## Tag Taxonomy as an Output

A correct tag taxonomy is not assumed at startup. It is a long-term output of the data analysis enabled by the system.

Different players may perceive different meanings from the same tags. Some tags may be poorly designed. Some players will mistag themselves, either accidentally or because the available vocabulary does not fit them well.

The system should still expect tags to be useful enough to start routing users into rough cohorts. Over time, observed rating behavior should reveal:

- which tag combinations behave coherently,
- which individual tags become more signal-bearing in specific contexts,
- which tags are too broad or ambiguous,
- which tags should be split, merged, renamed, retired, or redefined,
- and which new cohort definitions analysts should consider.

This means tags are both inputs and objects of analysis. They are not fixed truth. Cohorts discovered from tag combinations and rating behavior are the working units of signal.

## User Trust Simplifies Island Evaluation

Once the system has per-rater signal, island evaluation becomes simpler and more robust.

Without user signal, every rating is equal. The island model must infer quality from noisy raw votes.

With user signal, island evaluation can ask:

> What do high-signal raters for this cohort think of this island?

So instead of treating an island as a global average, evaluate it as weighted evidence by taste space.

For each island/cohort:

```text
weighted sum = Σ(rating × rater signal for cohort)
weight total = Σ(rater signal for cohort)
affinity = weighted sum / weight total
```

This is simpler conceptually than trying to infer island quality from unweighted global consensus.

The island’s score becomes:

```text
This island is good evidence for Cohort A if high-signal Cohort A raters like it.
```

And:

```text
This island is bad evidence for Cohort A if high-signal Cohort A raters dislike it.
```

Low-signal raters are not ignored, but their ratings contribute less.

This also lets island evaluation remain local:

- an island can be excellent for Cohort A,
- terrible for Cohort B,
- and irrelevant to Cohort C.

There is no need to force a single global quality score.

## Reviewer Archetypes as Hidden Checksums

Future generator archetypes should be hidden generation labels, not model inputs.

Examples:

- Clean Cohort Match
- Mislabeled User
- Inverse Rater
- Random / Noisy User
- Unexplained High-Signal User / Candidate New Seed User
- Early Scout
- Late Consensus Follower
- Popularity Chaser
- Niche Specialist

The model should infer these only from visible behavior.

Evaluation should be probabilistic:

> Did the model recover the hidden archetype when there was enough evidence, and did it stay uncertain when evidence was weak?

A random user may temporarily look like a clean match or inverse rater when sample size is low. That is acceptable if evidence/confidence remains low.

## Island Lifecycle Metrics

Future islands should include lifecycle/global metrics such as:

- age days,
- exposure count,
- total plays,
- daily active players,
- return rate,
- bounce rate,
- rating count,
- qualified rating count,
- global rating average,
- cohort-specific satisfaction,
- under-reviewed score,
- discovery exposure.

These support the distinction between:

- broad hit,
- broad dud,
- niche gem,
- sleeper hit,
- overexposed low-satisfaction island,
- stale former hit,
- new under-reviewed candidate,
- polarizing island.

## UI Direction

The dashboard should evolve toward an analyst console rather than a giant user list.

For the turn-based simulation, the UI should make state changes inspectable. A user should be able to take one turn, inspect what changed, then take more turns when ready.

Top-level UI should show:

- population summary,
- discovery opportunities,
- reviewer signal reports,
- island affinity reports,
- taxonomy/cohort maintenance reports.

Users, islands, and pseudo-cohorts should be drill-down targets from reports, not the primary navigation.

Useful UI additions:

- turn counter,
- Take 1 Turn button,
- Take X Turns control,
- Reset Simulation button,
- current turn summary,
- before/after deltas for selected users/islands/reports,
- selected user summary,
- selected island summary,
- modal/dialog selectors,
- drawer drilldowns,
- exact match rate vs comparison cohort,
- behavior match strength,
- behavior specificity / non-informative behavior warning,
- island top positive/negative affinities,
- confidence/lift/disagreement metrics,
- rating event contribution details.

## About / Prior Art Framing

Wayfarer should include an informal About section in the app that explains the idea without overstating its novelty.

The tone should be:

> This is an amateur proof-of-concept built to explore a product idea. It is not a formal academic claim or a production recommender system.

The About section should acknowledge adjacent work directly. In particular, it should name trust-aware collaborative filtering and TrustSVD as nearby landmarks.

Suggested app copy:

```text
Wayfarer is adjacent to known work in trust-aware recommender systems.

For example, Massa and Avesani’s trust-aware collaborative filtering explored using propagated trust to improve recommender coverage while preserving prediction quality, especially when ordinary similarity matching becomes sparse. TrustSVD later incorporated explicit and implicit trust influence into a matrix-factorization recommender to address sparsity and cold-start problems.

Those systems are useful landmarks. They suggest that trust and rating behavior can help recommender systems when ordinary rating coverage is thin.

Wayfarer explores a different product-shaped version of that idea.

Instead of using explicit social trust links or global user reputation, Wayfarer starts with trusted cohort anchors: seed reviewers chosen because they represent meaningful taste groups in a UGC ecosystem. Ordinary users earn cohort-local signal by rating known islands similarly to those anchors. Their later ratings then extend the effective reach of those anchors into sparse, under-reviewed content.

So the propagated unit is not “Alice trusts Bob” or “Bob is globally reputable.” It is narrower:

Bob appears to be a reliable signal source for this cohort’s taste.

That makes Wayfarer an exploration of cohort-local trust propagation for UGC discovery, not a claim to have invented trust-aware recommendation from scratch.
```

A shorter version for a top-level About panel:

```text
Wayfarer adapts trust-propagation logic to cohort-local taste signal.

Trusted seed reviewers define initial cohort anchors. Players who behave like those anchors on known content earn cohort-local signal. Their ratings on unknown content then help propagate the trusted anchors’ reach into the long tail of under-reviewed islands.

This is adjacent to trust-aware collaborative filtering and TrustSVD, both of which suggest that trust-weighted rating evidence can help under sparse data conditions. Wayfarer’s specific twist is product-facing and UGC-focused: the propagated unit is not global reputation or explicit social trust, but cohort-local predictive signal.

This is worth prototyping, not proven.
```

This framing should be included in the upgrade process so the live app can explain why the experiment is interesting while remaining honest about prior art and uncertainty.

## Confidence Vocabulary

The word “confidence” is currently doing too much work. Before implementation goes deep, split confidence-like concepts into clearer model terms.

Recommended working vocabulary:

### Affinity Evidence

How much consistent qualified evidence supports an island/cohort affinity direction.

Example:

```text
Tactical / Team Coordination users appear to like Island 12, and enough weighted evidence supports that direction.
```

### Rater Signal Evidence

How much evidence supports the claim that a user is a reliable signal source for a cohort.

Example:

```text
User X has repeatedly rated known Cohort A islands similarly to Cohort A seeds.
```

### Discovery Readiness

How ready the system is to expand exposure for an island/cohort pairing.

Example:

```text
Island 12 is still under-reviewed, but early weighted evidence is coherent enough to route it to more adjacent users.
```

### Prediction Confidence

How confident the system is that a particular user will like a particular island.

Example:

```text
This island strongly matches the user’s inferred cohort profile, and the supporting island affinity estimate is well-evidenced.
```

### Taxonomy Confidence

How confident analysts should be that a tag or cohort definition is meaningful and stable.

Example:

```text
This tag combination consistently predicts similar rating behavior across many islands and turns.
```

The UI may simplify these names, but the model should avoid using one generic `confidence` field for all of them.

## Known Design Risks / Deferred Analysis

The following issues are important, but most should be analyzed as the system evolves rather than solved before the next implementation step.

### Cohort Lifecycle and Governance

Because rater signal is cohort-based, the lifecycle of a cohort is load-bearing.

Future design should distinguish:

- seed cohorts,
- candidate pseudo-cohorts,
- analyst-approved cohorts,
- deprecated cohorts,
- merged cohorts,
- and split cohorts.

The system may surface candidate cohorts, but production/signaling cohorts should remain analyst-governed.

### Confidence Overload

This is the most immediate risk. “Confidence” can mean affinity evidence, rater signal evidence, discovery readiness, prediction confidence, or taxonomy confidence. The model should separate those terms early enough to avoid ambiguous code and misleading UI.

### Tag-Level Affinity Drift

Tag-level island descriptions are useful for explanation and taxonomy analysis, but they should not become the core trust layer.

The core trust/signal layer remains cohort-based.

If tag-level affinity is used, it should be clearly marked as derived or explanatory unless a later design explicitly proves that a tag-level model is useful.

### Safe Recommendation vs Discovery Probe

Discovery value should not be allowed to overwhelm player fit.

Future routing logic should define a minimum predicted-fit floor so the system does not show users low-fit content merely because it would be informative for the model.

### Versioned Analysis Snapshots

Rating events should be immutable, and current aggregates should be recomputable. However, the system should eventually preserve historical analysis-pass snapshots so analysts can inspect what the system believed at each turn.

This matters for debugging, auditability, and demonstrating learning over time.

### Abuse / Manipulation Surface

Weighted rater influence creates future attack surfaces. Users or creators may try to farm signal, manipulate early discovery, coordinate brigading, or exploit cohort routing.

This is deferred for the proof of concept, but it should remain visible as a later production concern.

## Open Modeling Questions

- Should island/cohort affinity use simple Bayesian shrinkage, Dirichlet-multinomial counts, or both?
- Should tag-level island affinity be derived from cohort evidence, direct tagged-user evidence, or both?
- How should neutral ratings affect affinity and confidence?
- Should lift be included in v1 or deferred?
- How should rater signal be calculated per cohort while avoiding accidental per-tag trust?
- How strongly should high-signal raters outweigh unknown raters?
- How do we avoid feedback loops in the toy model while still showing retroactive reweighting?
- What thresholds define “enough evidence” for discovery expansion?
- How should recommendation balance safe fit against discovery value?
- How many users should participate per turn?
- How many islands should each participating user rate per turn?
- What mix of Organic Exploration vs Guided Discovery in Mixed Turn Mode best demonstrates the discovery loop?
- How should the dashboard explain the difference between safe recommendation and discovery probe?

## Design Checksum

The next-generation model should preserve these principles:

- Ratings are events, not just aggregate values.
- Expressed rating and evidentiary weight are separate.
- User signal is local to cohort/taste space, not moral trust.
- User signal is cohort-local, not tag-local.
- Tags are starting vocabulary and routing hints; tag-level summaries are derived/explanatory, not the primary trust layer.
- Island quality is local to cohorts, not global truth.
- Confidence is about qualified evidence sufficiency, not total-population percentage.
- Sparse ratings are necessary for discovery.
- The simulation should advance in discrete turns with inspectable state changes.
- Turn policy controls how many users participate; per-user organic/guided activity profiles are future work.
- Turn boundaries preserve causality and reduce feedback-loop risk.
- Early coherent signal should trigger cautious expansion.
- High-signal raters should increase confidence faster than unknown raters.
- Historical ratings should be recalculable as rater signal changes.
- Avoid self-reinforcing feedback loops through staged or lagged analysis passes.
- The system should surface discovery opportunities, not merely sort by popularity.
