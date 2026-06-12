# Wayfarer Diagnostic Expectations

This document describes what healthy Wayfarer behavior should look like in Golden Demo, system movement, modeling, and simulation diagnostics.

It is not a test file. It is a review map.

## 1. Purpose

After major model changes, especially rating-state math changes, raw output can be hard to interpret.

This document defines what we expect to see if Wayfarer is behaving correctly.

The goal is to distinguish:

- healthy uncertainty from failure
- useful volatility from noise
- real evidence gaps from model bugs
- meaningful recommendation exploration from random wandering
- strong consensus learning from capped/inching behavior

## 2. Core diagnostic questions

When reviewing system output, ask:

1. Are known cohorts becoming predictable when enough evidence exists?
2. Does strong consensus collapse RD quickly?
3. Does sparse evidence remain uncertain?
4. Does same-context contradiction raise volatility?
5. Does split evidence raise volatility even when the average rating is neutral?
6. Do refreshes reopen uncertainty without creating volatility by themselves?
7. Are latest stated ratings preserved?
8. Are current-context aggregates distinct from historical evidence?
9. Are recommendations becoming more purposeful?
10. Are probes aimed at uncertainty, not random noise?
11. Are confidence values scoped to the correct confidence kind?
12. Are duplicate or parallel projections producing conflicting reads?

## 3. Changed numbers are not automatically regressions

After a major model correction, some outputs should change.

Confidence may rise where strong evidence was previously capped. RD may collapse faster under consensus. Recommendation categories may shift because solved cases are no longer treated as uncertain. Volatility may fall where refresh events were previously counted as instability.

Treat changed numbers as regressions only when they violate the expected behavior in this document.

## 4. Expected rating-state behavior

### Clean consensus

When many high-quality sources agree about an island/cohort in the same context:

- support should rise
- RD should fall
- confidence should rise
- volatility should stay low or decay
- the rating estimate should move toward the consensus target

A large same-turn consensus should not be artificially capped into tiny movement.

A one-turn evidence burst and the same evidence spread across multiple turns should produce broadly comparable final confidence/RD/rating results.

### Sparse evidence

With only a small amount of evidence:

- the estimate may move
- RD should remain meaningfully open
- confidence should not overstate certainty
- volatility should not rise merely because evidence is sparse

Ignorance is uncertainty, not volatility.

### Same-context contradiction

If the system has a confident read and then receives same-epoch evidence against that read:

- volatility should rise
- RD should reopen
- support should not be erased
- the estimate should not instantly flip from a single contradictory batch
- repeated high-quality contradiction should eventually move the estimate

### Same-context split evidence

If a batch contains strong positive and strong negative ratings that wash out to a neutral mean:

- split pressure should be detected
- volatility should rise
- RD should remain open or reopen
- the estimate should not be forced to choose a side prematurely

This is especially important for islands with polarizing audiences.

### Refresh events

When a game-rules update or island update occurs:

- RD should reopen
- confidence should temporarily drop
- historical support should be preserved
- volatility should not rise merely because of the refresh
- changed post-refresh ratings should be treated as remeasurement, not same-context contradiction

Post-refresh evidence may later create volatility if it is contradictory or split inside the new context.

## 5. Expected confidence behavior

Confidence values should be scoped to a named confidence kind.

A diagnostic should not treat all confidence values as interchangeable. A vote evidence confidence, island/cohort prediction confidence, player-profile confidence, source-authority confidence, and system diagnostic confidence may use different formulas because they summarize different judgments.

Healthy confidence behavior includes:

- the confidence kind is clear from naming, context, or output shape
- confidence does not hide support/RD/volatility when those details matter
- confidence values are generated through a shared confidence calculation interface or family
- duplicate confidence logic is consolidated when it summarizes the same judgment
- genuinely distinct confidence judgments are represented as distinct confidence kinds

Red flags include:

- generic confidence values with unclear scope
- multiple formulas calculating the same kind of confidence
- inline confidence math that bypasses canonical helpers
- confidence rising despite weak support and high RD unless the confidence kind explicitly allows that interpretation
- confidence used as a substitute for source authority, volatility, freshness, or support without exposing those factors

## 6. Expected recommendation behavior

Recommendations should become more intentional over time.

A healthy recommendation mix may include:

- strong predicted fits
- guided discovery candidates
- useful probes
- smart gambles
- candidates that clarify cohort boundaries
- candidates that test declared-vs-observed preference divergence

Recommendations should not collapse into pure popularity.

Recommendations should not become random exploration once the system has useful evidence.

## 7. Expected probe behavior

Probes should target uncertainty.

Good probes are cases where:

- the player may plausibly like the island
- the system lacks enough evidence
- the island/cohort boundary is uncertain
- the player is a potentially useful signal source
- the outcome would improve future predictions

Bad probes are cases where:

- the island is obviously irrelevant
- the player has no plausible affinity
- the system already has enough evidence
- the probe exists only because randomness demanded it

## 8. Expected seeded cohort behavior

If seeded/cohort-known users all rate the same island consistently:

- that island should become highly resolved for the relevant known cohorts
- RD should approach its floor
- volatility should remain low
- the cohort/island fit should become obvious in diagnostics

If this does not happen, suspect one of:

- evidence is not being routed to the cohort state
- support is not accumulating
- RD is still capped or inching
- current-context filtering is excluding evidence incorrectly
- cohort mapping is wrong
- output is reading the wrong projection

## 9. Expected full-known-world behavior

If every relevant user in a closed known population rates an island in the current context:

- current-context support should be high
- RD should be very low for known cohorts
- confidence should be high
- volatility should be low if ratings agree
- split cohorts should show volatility or cohort separation, not mushy confidence

A full known-world census should not remain at low confidence unless the evidence itself is split, stale, or incorrectly scoped.

## 10. Expected refresh behavior in diagnostics

After a refresh:

- confidence may drop
- RD should reopen
- support should remain visible
- old evidence should remain historical
- current-context evidence may be thinner
- latest stated ratings should still be visible as stated ratings
- volatility should not spike solely because the refresh happened

If volatility spikes on refresh without new contradictory evidence, suspect a bug.

## 11. Expected volatility behavior

Volatility should correspond to instability.

Healthy volatility sources include:

- same-context contradiction
- same-context split evidence
- polarizing island response
- inconsistent post-refresh behavior
- context-sensitive audience fit

Unhealthy volatility sources include:

- sparse evidence alone
- refresh events alone
- missing evidence
- old evidence becoming historical
- player not yet observed

## 12. Expected evidence display behavior

Expert/debug surfaces should distinguish:

- explicit stated ratings
- inferred revealed-preference evidence
- synthetic observed behavior
- current-context evidence
- historical evidence
- superseded/revised evidence
- support
- RD
- volatility
- provenance
- confidence kind

Player-facing surfaces may simplify, but debug surfaces must not flatten these distinctions.

## 13. Red flags

Treat these as likely model or projection bugs:

- high confidence with a rating estimate that barely moved despite overwhelming consensus
- high volatility immediately after refresh with no new evidence
- full known-world census still unresolved
- sparse evidence marked as volatile rather than uncertain
- split evidence hidden as neutral confidence
- latest stated rating disappears after refresh
- explicit and inferred evidence are averaged without provenance
- recommendations ignore obvious high-fit candidates
- probes continue targeting already-solved cases
- support resets when it should be preserved
- RD fails to reopen after refresh
- RD never collapses under consensus
- confidence values appear without a clear domain/kind
- duplicate confidence calculations produce conflicting results for the same judgment
- a diagnostic/read model maintains a parallel truth rather than projecting from canonical evidence

## 14. Current diagnostic priority

The immediate priority is to rerun Golden Demo / system movement after the #83 math rewrite and inspect:

- seeded cohort recovery
- unresolved cohort count
- RD/confidence distribution
- volatility spikes
- support accumulation
- probe quality
- recommendation category movement
- refresh behavior
- current-context vs historical evidence display
- confidence kind consistency
- duplicated or parallel projection paths

The goal is not to force perfect numbers.

The goal is to see whether the system now moves like the intended Wayfarer model.
