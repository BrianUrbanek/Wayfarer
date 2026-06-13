# Wayfarer Diagnostic Expectations

This document describes what healthy Wayfarer behavior should look like in Golden Demo, system movement, modeling, and simulation diagnostics.

It is not a test file. It is a review map.

## 1. Purpose

After major model changes, especially rating-state math changes, raw output can be hard to interpret.

This document defines what we expect to see if Wayfarer is behaving correctly.

The goal is to distinguish:

* healthy uncertainty from failure
* useful volatility from noise
* real evidence gaps from model bugs
* meaningful recommendation exploration from random wandering
* strong consensus learning from capped/inching behavior
* local seed-backed safety from broad evidence maturity
* true overfit from chance-shaped random content
* source usefulness from global reviewer trust

## 2. Core diagnostic questions

When reviewing system output, ask:

1. Are known cohorts becoming predictable when enough evidence exists?
2. Does strong consensus collapse RD quickly?
3. Does sparse ordinary evidence remain uncertain?
4. Does sparse audited seed evidence establish strong local baselines?
5. Does same-context contradiction raise volatility?
6. Does split evidence raise volatility even when the average rating is neutral?
7. Do refreshes reopen uncertainty without creating volatility by themselves?
8. Are latest stated ratings preserved?
9. Are current-context aggregates distinct from historical evidence?
10. Are recommendations becoming more purposeful?
11. Are probes aimed at uncertainty, not random noise?
12. Are confidence values scoped to the correct confidence kind?
13. Are duplicate or parallel projections producing conflicting reads?
14. Are local recommendation safety and global evidence maturity kept distinct?
15. Are seed reviewers treated as local audited calibration sources rather than universal truth?
16. Are ordinary users gaining source usefulness where they repeatedly behave like useful local proxies?

## 3. Changed numbers are not automatically regressions

After a major model correction, some outputs should change.

Confidence may rise where strong evidence was previously capped. RD may collapse faster under consensus. Recommendation categories may shift because solved cases are no longer treated as uncertain. Volatility may fall where refresh events were previously counted as instability.

Seed-backed local recommendations may also change routing mix. If the system properly distinguishes local safety from global evidence maturity, some recommendations may be safe local fits even while the island remains under-reviewed globally.

Treat changed numbers as regressions only when they violate the expected behavior in this document.

## 4. Expected rating-state behavior

### Clean consensus

When many high-quality sources agree about an island/cohort in the same context:

* support should rise
* RD should fall
* confidence should rise
* volatility should stay low or decay
* the rating estimate should move toward the consensus target

A large same-turn consensus should not be artificially capped into tiny movement.

A one-turn evidence burst and the same evidence spread across multiple turns should produce broadly comparable final confidence/RD/rating results.

### Sparse ordinary evidence

With only a small amount of ordinary evidence:

* the estimate may move
* RD should remain meaningfully open
* confidence should not overstate certainty
* volatility should not rise merely because evidence is sparse

Ignorance is uncertainty, not volatility.

### Sparse audited seed evidence

Sparse audited seed evidence should behave differently from sparse ordinary evidence.

A seed reviewer is a high-authority local calibration source. When a seed reviewer rates an island for the seed’s own taste locality under high RD and low support:

* the local island/cohort estimate should move meaningfully
* local RD may fall more sharply than it would from ordinary sparse evidence
* local confidence may become actionable earlier
* volatility should remain low if there is no same-locality contradiction
* the read should remain provisional and overridable
* the island should not be treated as broadly mature merely because a seed baseline exists

This expected state is valid:

> safe local fit, still under-reviewed globally.

That is not a contradiction. It is a healthy discovery state.

### Same-context contradiction

If the system has a confident read and then receives same-epoch evidence against that read:

* volatility should rise
* RD should reopen
* support should not be erased
* the estimate should not instantly flip from a single contradictory batch
* repeated high-quality contradiction should eventually move the estimate

For seed-backed baselines, contradiction should be evaluated by locality.

Same-locality contradiction should matter strongly. Distant-cohort contradiction may show that the island is not universally appealing, but it should not automatically invalidate the seed’s local baseline.

### Same-context split evidence

If a batch contains strong positive and strong negative ratings that wash out to a neutral mean:

* split pressure should be detected
* volatility should rise
* RD should remain open or reopen
* the estimate should not be forced to choose a side prematurely

This is especially important for islands with polarizing audiences.

Split evidence may indicate that the island has strong local fit for one audience and strong local mismatch for another.

### Refresh events

When a game-rules update or island update occurs:

* RD should reopen
* confidence should temporarily drop
* historical support should be preserved
* volatility should not rise merely because the refresh
* changed post-refresh ratings should be treated as remeasurement, not same-context contradiction

Post-refresh evidence may later create volatility if it is contradictory or split inside the new context.

## 5. Expected confidence behavior

Confidence values should be scoped to a named confidence kind.

A diagnostic should not treat all confidence values as interchangeable. A vote evidence confidence, island/cohort prediction confidence, player-profile confidence, source-authority confidence, local recommendation safety confidence, evidence maturity confidence, and system diagnostic confidence may use different formulas because they summarize different judgments.

Healthy confidence behavior includes:

* the confidence kind is clear from naming, context, or output shape
* confidence does not hide support/RD/volatility when those details matter
* confidence values are generated through a shared confidence calculation interface or family
* duplicate confidence logic is consolidated when it summarizes the same judgment
* genuinely distinct confidence judgments are represented as distinct confidence kinds
* source authority and evidence maturity are visible when they affect actionability

Red flags include:

* generic confidence values with unclear scope
* multiple formulas calculating the same kind of confidence
* inline confidence math that bypasses canonical helpers
* confidence rising despite weak support and high RD unless the confidence kind explicitly allows that interpretation
* confidence used as a substitute for source authority, volatility, freshness, or support without exposing those factors
* local recommendation safety hidden behind a global maturity threshold
* seed authority hidden inside ordinary support with no way to explain the source basis

## 6. Expected recommendation behavior

Recommendations should become more intentional over time.

A healthy recommendation mix may include:

* strong predicted fits
* seed-backed local fits
* locally validated safe fits
* guided discovery candidates
* useful probes
* smart gambles
* candidates that clarify cohort boundaries
* candidates that test declared-vs-observed preference divergence
* candidates that validate or challenge seed baselines
* candidates that help discover organic proxy reviewers

Recommendations should not collapse into pure popularity.

### Safe local fit

Safe fit should mean safe for this player or cohort, not globally safe for every player.

A healthy safe-fit recommendation may be backed by:

* broad consensus;
* strong local validation;
* trusted seed evidence;
* repeated high-quality same-locality agreement;
* reliable organic proxy evidence;
* or some combination of these.

A seed-backed safe local fit may still be under-reviewed globally.

If the diagnostics can only call broadly mature recommendations safe, then the system may be failing to use seed reviewers for their intended cold-start purpose.

### Smart gamble

Smart gamble should mean promising but not yet safe.

A recommendation may be a smart gamble when:

* predicted fit is positive but source authority is weak;
* the evidence basis is indirect or inferred;
* the target player is adjacent to, but not clearly inside, the strongest-fit cohort;
* the island has high upside but unresolved uncertainty;
* the system expects both player value and learning value.

Smart gamble should not become a catch-all for every under-reviewed island. If a trusted local baseline exists and the target player is in that locality, under-reviewedness alone should not force the route to remain a smart gamble.

### Discovery probe

Discovery probe should mean learning value dominates fit certainty.

A probe should be plausible for the player, but its main purpose is to improve the model: resolve uncertainty, test a boundary, validate an emerging cohort read, or evaluate whether a player is a useful signal source.

### Evidence maturity display

Recommendation diagnostics should explain evidence maturity separately from route purpose.

Useful maturity labels include:

* unknown / coverage gap
* seed-backed baseline
* early local validation
* emerging local consensus
* broad support
* contested
* stale / needs refresh-context evidence
* under-reviewed globally

The diagnostic surface should be able to explain:

> This is a safe local fit because it is seed-backed for this cohort, but the island remains under-reviewed globally.

## 7. Expected probe behavior

Probes should target uncertainty.

Good probes are cases where:

* the player may plausibly like the island
* the system lacks enough evidence
* the island/cohort boundary is uncertain
* the player is a potentially useful signal source
* the outcome would improve future predictions
* the probe can validate or challenge a seed-backed baseline
* the probe can help determine whether a user is an organic proxy for a taste locality

Bad probes are cases where:

* the island is obviously irrelevant
* the player has no plausible affinity
* the system already has enough evidence for the question being asked
* the probe exists only because randomness demanded it
* the probe uses distant-cohort uncertainty to question a strong local read without a meaningful hypothesis

## 8. Expected seeded cohort behavior

Seeded cohort behavior needs to distinguish two related but different cases:

1. cohort-known users in a simulation;
2. audited seed reviewers as high-authority calibration sources.

### Cohort-known users

If seeded/cohort-known users all rate the same island consistently:

* that island should become increasingly resolved for the relevant known cohorts
* RD should fall
* volatility should remain low if the evidence agrees
* the cohort/island fit should become obvious in diagnostics

If this does not happen, suspect one of:

* evidence is not being routed to the cohort state
* support is not accumulating
* RD is still capped or inching
* current-context filtering is excluding evidence incorrectly
* cohort mapping is wrong
* output is reading the wrong projection

### Audited seed reviewers

If an audited seed reviewer rates an island in the seed’s own taste locality while existing evidence is sparse:

* the local baseline should move sharply toward the seed rating
* local confidence should become actionable earlier than it would from ordinary sparse evidence
* the estimate should remain provisional and overridable
* global under-reviewedness should remain visible
* the seed baseline should not become universal island truth
* distant cohorts should not inherit the seed read automatically

If the system cannot show a strong local baseline from seed evidence, suspect one of:

* seed evidence is not represented with source authority
* seed evidence is being treated like ordinary sparse evidence
* seed locality is not being applied
* confidence calculation ignores source authority
* recommendation routing requires broad maturity before local safety
* diagnostics flatten source authority into generic support

If seed evidence immediately becomes universal truth for all cohorts, suspect one of:

* seed locality is being ignored
* cohort boundaries are being collapsed
* global support is being inflated by local evidence
* recommendation diagnostics are presenting local fit as global quality

## 9. Expected proxy-discovery behavior

Seeds should help identify ordinary users who act as useful natural proxies.

A healthy proxy-discovery pattern looks like:

* a seed reviewer establishes a local baseline;
* ordinary users rate the same or related islands;
* users who repeatedly align with validated local baselines gain local source usefulness;
* users who align early gain more signal than users who merely follow obvious consensus later;
* users who are useful in one domain do not automatically become trusted globally;
* users who disagree with seeds but are later validated by same-locality outcomes can also become useful sources.

Proxy discovery should not mean blind agreement with authority. It should mean repeated predictive usefulness inside a taste locality.

Red flags include:

* agreement with a seed granting global trust;
* disagreement with a seed being punished before later outcomes are known;
* proxy usefulness ignoring locality;
* late consensus-following being rewarded as much as early signal;
* users becoming “trusted reviewers” without evidence of predictive value.

## 10. Expected full-known-world behavior

If every relevant user in a closed known population rates an island in the current context:

* current-context support should be high
* RD should be very low for known cohorts
* confidence should be high
* volatility should be low if ratings agree
* split cohorts should show volatility or cohort separation, not mushy confidence

A full known-world census should not remain at low confidence unless the evidence itself is split, stale, or incorrectly scoped.

Full-known-world maturity is not required for local safe fit. It is a different evidence state.

## 11. Expected refresh behavior in diagnostics

After a refresh:

* confidence may drop
* RD should reopen
* support should remain visible
* old evidence should remain historical
* current-context evidence may be thinner
* latest stated ratings should still be visible as stated ratings
* volatility should not spike solely because the refresh happened
* seed baselines from the prior context should become historical/provisional rather than erased

If volatility spikes on refresh without new contradictory evidence, suspect a bug.

If a refresh erases historical seed evidence entirely, suspect a projection bug.

## 12. Expected volatility behavior

Volatility should correspond to instability.

Healthy volatility sources include:

* same-context contradiction
* same-context split evidence
* polarizing island response
* inconsistent post-refresh behavior
* context-sensitive audience fit
* seed baseline challenged by repeated same-locality evidence
* meaningful disagreement among high-authority or high-source-usefulness signals

Unhealthy volatility sources include:

* sparse evidence alone
* refresh events alone
* missing evidence
* old evidence becoming historical
* player not yet observed
* distant-cohort disagreement with a local baseline, unless the diagnostic is explicitly evaluating cross-cohort portability

## 13. Expected evidence display behavior

Expert/debug surfaces should distinguish:

* explicit stated ratings
* audited seed-reviewer ratings
* inferred revealed-preference evidence
* synthetic observed behavior
* current-context evidence
* historical evidence
* superseded/revised evidence
* support
* RD
* volatility
* provenance
* source authority
* evidence maturity
* confidence kind
* local recommendation safety

Player-facing surfaces may simplify, but debug surfaces must not flatten these distinctions.

In Golden Demo and simulation output, synthetic observed behavior should be labeled as synthetic/proxy-derived. It should not be presented as production telemetry.

## 14. Expected random/noisy content behavior

Random or noisy island truth in a toy simulation does not always mean statistically flat white noise.

A randomly generated island may, by chance, align with a visible cohort or taste vector. If users then consistently react to that island in line with that chance-shaped appeal pattern, the system may legitimately learn a local read.

Diagnostics should distinguish:

* random/noisy content that remains correctly uncertain;
* random/noisy content that is chance-shaped toward a cohort and is being learned plausibly;
* random/noisy content that is being overfit without meaningful support;
* random/noisy content whose learned estimate contradicts its hidden appeal pattern.

The label “possible overfit” should be treated as a review prompt, not an automatic failure.

If random/noisy islands repeatedly resolve with high confidence, inspect whether:

* the generator creates chance cohort-shaped appeal vectors;
* the learned estimate aligns with the hidden generated appeal pattern;
* support and source authority justify the estimate;
* diagnostics are confusing “not intentionally seeded” with “should remain patternless.”

## 15. Golden Demo report expectations

Golden Demo output should be legible and semantically precise.

Report labels should distinguish:

* preset seed from actual simulation/run seed;
* routed recommendation events from unique routed islands;
* configured organic participants from configured guided participants;
* unique participating users from per-mode participant counts;
* synthetic observed behavior from production behavior;
* local safe fit from broad evidence maturity;
* seed-backed baseline from broad consensus.

Red flags include:

* reporting the preset seed when the exported simulation state used a different actual seed;
* saying “routed islands” when the count is route events or recommendation slots;
* saying “12 participating users” when mixed mode separately selects organic and guided users;
* presenting synthetic observed behavior as plain observed behavior;
* presenting a seed-backed local fit as globally proven;
* presenting under-reviewedness as if it automatically means unsafe.

## 16. Red flags

Treat these as likely model, projection, or reporting bugs:

* high confidence with a rating estimate that barely moved despite overwhelming consensus
* high volatility immediately after refresh with no new evidence
* full known-world census still unresolved
* sparse ordinary evidence marked as volatile rather than uncertain
* sparse audited seed evidence failing to establish any meaningful local baseline
* split evidence hidden as neutral confidence
* latest stated rating disappears after refresh
* explicit, inferred, seed, and synthetic evidence are averaged without provenance
* recommendations ignore obvious high-fit candidates
* probes continue targeting already-solved cases
* support resets when it should be preserved
* RD fails to reopen after refresh
* RD never collapses under consensus
* confidence values appear without a clear domain/kind
* duplicate confidence calculations produce conflicting results for the same judgment
* a diagnostic/read model maintains a parallel truth rather than projecting from canonical evidence
* seed authority becomes universal island truth
* seed authority has no visible impact under sparse local evidence
* safe local fit is impossible unless the island is broadly mature
* under-reviewedness is used as a blanket blocker rather than an evidence maturity dimension
* ordinary proxy usefulness is treated as global rather than local
* random/noisy content is flagged as overfit without checking whether it is chance-shaped toward a cohort

## 17. Current diagnostic priority

The immediate priority is to review Golden Demo and recommendation/rating math against the clarified seed-reviewer doctrine.

Inspect:

* seeded cohort recovery
* seed-backed local baseline behavior
* unresolved cohort count
* RD/confidence distribution
* volatility spikes
* support accumulation
* evidence provenance
* proxy-discovery signal
* recommendation category movement
* safe local fit vs global evidence maturity
* under-reviewedness handling
* probe quality
* refresh behavior
* current-context vs historical evidence display
* confidence kind consistency
* duplicated or parallel projection paths
* Golden Demo report labels

The goal is not to force perfect numbers.

The goal is to see whether the system now moves like the intended Wayfarer model.

The central current audit question is:

> Can audited seed evidence produce a safe local fit while the island remains under-reviewed globally?

If the answer is no, inspect whether the issue is in rating-state math, confidence calculation, source-authority representation, recommendation thresholds, route taxonomy, diagnostic reporting, or some combination of those.