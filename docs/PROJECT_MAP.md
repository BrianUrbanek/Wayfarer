# Wayfarer Project Map

## 1. Core thesis

Wayfarer’s core thesis is:

> The rating prediction engine is the recommendation engine.

The system does not first build ratings and then separately build recommendations. It learns where ratings are predictable, who is useful as a signal source, where uncertainty remains, and what evidence would improve future predictions.

Recommendation is therefore a function of prediction quality, audience fit, uncertainty, source value, and discovery value.

Wayfarer is not trying to discover one universal ranking of islands. It is trying to learn local fit: which players, cohorts, or taste locations are likely to be satisfied by which islands, and how confidently the system can act on that prediction.

## 2. Terminology: seed reviewers vs seeded cohort users

Wayfarer uses two related but distinct ideas that should not be collapsed.

### Audited seed reviewers

An audited seed reviewer is a professional, paid, internally trusted reviewer whose work is directly subject to human review and audit.

A seed reviewer is an audited calibration instrument, not merely a normal user with a larger vote. Their high initial authority is justified outside the automated trust graph because their work is institutionally supervised.

Seed reviewer authority is local. A Strategy Roleplay seed reviewer establishes a high-authority local baseline for Strategy Roleplay-like players. That rating should not automatically generalize to High-Skill Competitive players, casual social players, or any other distant taste location unless the system has separately learned that those audiences overlap.

### Seeded cohort users

A seeded cohort user is a simulation or diagnostic construct: a user whose hidden cohort is known in the toy world so the system can be evaluated.

Seeded cohort users help test whether the system can recover known structure. They are not necessarily equivalent to audited seed reviewers.

When the docs refer to “seed evidence” or “seed reviewer evidence,” they mean audited seed-reviewer evidence unless the simulation context explicitly says otherwise.

## 3. What Wayfarer is trying to learn

Wayfarer is trying to learn several related things at once.

### Player preference

What kinds of islands, modes, rhythms, aesthetics, difficulty levels, social patterns, and reward structures a player appears to value.

### Island audience fit

Which cohorts or player types are likely to enjoy a given island.

An island does not have one universal quality score. It has audience-fit profiles. The same island may be excellent for one cohort, neutral for another, and actively bad for a third.

### Cohort satisfaction

How consistently an island satisfies a given audience segment.

### Source usefulness

Which players are useful sources of information for which islands, cohorts, or recommendation problems.

A player is not globally trustworthy or untrustworthy. A player may be highly useful in one domain and noisy in another.

Source usefulness is local. A reviewer who is an excellent signal source for Strategy Roleplay may be irrelevant or misleading for High-Skill Competitive. The system should discover where a source is useful, not assume that trust automatically transfers across taste space.

### Prediction confidence

How actionable the current prediction is for a given player/island/cohort context.

In expert terms, confidence is not a single universal primitive. It is a domain-level projection over support, rating deviation, volatility, evidence provenance, source authority, and freshness.

### Uncertainty / rating deviation

How open the current estimate remains.

Low RD means the system believes the estimate is well-supported. High RD means the system still needs more evidence or the context has reopened.

### Volatility

Whether evidence inside the same context is unstable, contradictory, split, or context-sensitive.

Volatility is not ignorance. Sparse evidence should generally mean high uncertainty, not high volatility.

### Evidence support

How much weighted evidence stands behind an estimate.

Support accumulates. Strong consensus should reduce uncertainty quickly. Weak or sparse evidence should leave uncertainty open.

### Local recommendation safety

How safe it is to route a specific island to a specific player or cohort.

Local recommendation safety is not the same as global evidence maturity. An island can be a safe local fit for a cohort while still being under-reviewed globally.

### Evidence maturity

How broadly and deeply an estimate has been validated.

Evidence maturity asks whether the read is still unknown, seed-backed, locally validated, broadly supported, contested, stale, or under-reviewed.

Evidence maturity should help explain the recommendation, but it should not automatically collapse into the recommendation kind.

## 4. Evidence model

Wayfarer treats evidence as an audit trail.

Current state is a projection over evidence.

### Explicit stated ratings

A player directly rates an island.

This is declarative preference evidence: “I say I liked/disliked this.”

Explicit ratings remain historically meaningful. A later refresh does not erase them.

### Audited seed-reviewer ratings

A seed reviewer rating establishes a high-authority local baseline for that reviewer’s cohort or taste locality, especially when existing evidence is sparse and RD is high.

Seed evidence is:

* high-authority;
* local to the seed reviewer’s cohort or taste space;
* provisional;
* overridable by later evidence;
* useful for rapid cold-start understanding;
* useful as a reference pattern for discovering organic proxy reviewers.

Seed evidence is not universal island truth.

The intended meaning of a seed rating is:

> For players like this seed reviewer, this island currently appears to be a positive, negative, or neutral fit.

Not:

> This island is objectively good or bad.

Seed evidence should be deeply impactful under sparse matching-locality evidence, but it remains accountable to later evidence. If same-locality evidence repeatedly contradicts a seed baseline, the estimate should eventually move, reopen uncertainty, raise volatility, or reveal that the seed’s assumed locality was wrong for this case.

### Inferred revealed-preference evidence

A separate upstream behavior system may infer that a player revealed preference through behavior.

Wayfarer can consume this evidence with provenance and confidence metadata, but it does not own the raw behavioral derivation.

Inferred evidence is not the same as explicit rating evidence and should not be averaged into it without preserving type/provenance.

### Synthetic observed behavior

Synthetic observed behavior is generated by the simulation to exercise the model.

It is not the same thing as upstream inferred revealed-preference evidence.

Demo and diagnostic surfaces should not shorten synthetic/proxy behavior into plain “observed behavior” in a way that implies real production telemetry.

### Refresh events

Game-rules updates and island updates create new evidence contexts.

A refresh should reopen uncertainty because the old read may no longer fully apply.

A refresh should not automatically create volatility. Volatility should come from contradictory or split evidence inside a context.

### Evidence epochs

Freshness is modeled through epochs.

A rating belongs to the world/island epoch in which it was made.

The current-context aggregate is derived by comparing rating epochs against current world/island epochs.

Turns remain useful for audit, replay, scheduling, charts, and deterministic simulation. Turns are not the semantic source of freshness.

## 5. Seed reviewers and organic proxy discovery

Seed reviewers serve two related purposes.

First, they rapidly establish working local knowledge for the player base. They allow the system to form meaningful early island/cohort reads without waiting for broad organic volume.

Second, they create reference patterns that can be used to discover ordinary users who behave like useful natural proxies.

A non-seed user who repeatedly rates in alignment with a seed reviewer in the relevant local taste space may become a useful organic signal source for that domain. The system should learn that user’s local source usefulness from repeated predictive alignment, not from title, declaration, or one-off agreement.

Organic proxy discovery should remain local. A user who reliably agrees with Strategy Roleplay seed baselines may become a useful proxy for Strategy Roleplay. That does not imply global reviewer authority.

The system should distinguish:

* a user who agrees with a seed baseline after broad consensus is already obvious;
* a user who agrees early with a seed baseline before broad validation;
* a user who disagrees with a seed baseline but is later proven right by same-locality outcomes;
* a user who agrees with one seed locality but fails outside it;
* a user whose ratings are consistent but only useful for a narrow domain.

Seed reviewers are not meant to eliminate organic trust discovery. They provide early calibration anchors and audit-backed baselines that help the system learn which ordinary users can become useful future sensors.

## 6. Rating-state model

Island/cohort rating state should track at least:

* rating estimate
* rating deviation / uncertainty
* confidence
* volatility
* support
* effective weight
* evidence count
* evidence provenance
* source authority
* evidence maturity where applicable

The intended behavior is:

### Strong consensus

When high-quality evidence agrees, support rises, RD falls, confidence rises, and volatility remains low.

A large same-turn consensus should be allowed to move the estimate strongly before that new support dampens future movement.

### Sparse ordinary evidence

Sparse ordinary evidence should move early estimates but leave RD open.

The system should not lock onto a confident conclusion from tiny ordinary support.

### Sparse audited seed evidence

Sparse seed evidence is different from sparse ordinary evidence.

A high-authority seed reviewer rating may sharply move a local island/cohort estimate and establish a high-confidence provisional baseline for that seed’s cohort, even when broad evidence remains sparse.

This can make the local estimate actionable to recommendation consumers earlier than ordinary sparse evidence would. It should not be treated as broad global maturity.

The intended state can be:

> safe local fit, still under-reviewed globally.

That state is not contradictory. It is one of the reasons seed reviewers exist.

### Same-context contradiction

Contradiction inside the same epoch should reopen uncertainty and raise volatility.

A single contradictory signal should not instantly flip a high-confidence estimate, but repeated high-quality contradiction should eventually move the estimate or reveal a split.

Contradiction should be evaluated in context. Evidence from a distant cohort should not automatically overrule a local seed baseline. Evidence from the same or adjacent taste locality should matter much more.

### Same-context split evidence

A batch of evidence can be internally split even if its aggregate mean is neutral.

Split pressure should raise volatility and reopen RD without forcing the estimate to choose a side prematurely.

Split evidence may indicate polarized audience fit rather than generic model failure.

### Refresh boundary

A refresh should reopen RD while preserving support.

Changed ratings across a refresh boundary are remeasurement, not automatically player inconsistency or island volatility.

## 7. Confidence calculation

Confidence is not a single universal formula, but it should be a canonical projection family.

All confidence values should be produced through a shared confidence calculation interface or clearly named confidence-family helper. The interface may route by confidence kind, such as:

* vote evidence confidence
* island/cohort prediction confidence
* player profile confidence
* source authority confidence
* local recommendation safety confidence
* evidence maturity confidence
* system diagnostic confidence

Each confidence kind may use a distinct formula and input shape, but each must declare its scope, required inputs, and factor breakdown.

New confidence calculations should not be invented inline. A new confidence formula should be added only when the judgment being summarized is genuinely distinct from existing confidence kinds. Otherwise, reuse or extend the existing confidence calculation path.

If two code paths calculate confidence for the same kind of judgment, they should be consolidated. If two confidence values summarize different judgments, they should be represented as different confidence kinds rather than hidden behind ambiguous generic naming.

Expert/debug surfaces should expose the relevant decomposition — support, RD, volatility, provenance, freshness, source authority, local fit, and evidence maturity — instead of treating confidence as self-explanatory.

Source authority and evidence maturity should not be hidden inside one generic confidence number if the consumer needs to understand why the system is acting.

## 8. Recommendation model

Wayfarer recommends by predicting fit and learning value.

A candidate island may be recommended because:

* it is likely to satisfy the player
* it is a useful probe
* it helps resolve uncertainty
* it improves cohort/island understanding
* it is a good match for the player’s declared preferences
* it is a good match for the player’s observed/revealed affinities
* it is part of guided discovery
* it is backed by a trusted local baseline
* it can validate or challenge an existing local baseline
* it can help discover or confirm organic proxy reviewers

The system should not reduce recommendation to popularity.

### Recommendation purpose vs evidence maturity

Recommendation purpose and evidence maturity are separate dimensions.

Recommendation purpose asks:

> Why is this island being routed to this player now?

Evidence maturity asks:

> How much and what kind of support stands behind the current read?

The system should be able to represent combinations such as:

* safe local fit, seed-backed baseline
* safe local fit, early local validation
* safe local fit, broad support
* smart gamble, promising but weakly sourced
* discovery probe, high learning value
* guided discovery, declared preference expansion
* avoid or suppress, likely bad fit
* contested fit, high split or volatility
* stale fit, needs refresh-context evidence

A candidate should not be forced into “smart gamble” only because it is globally under-reviewed if it has a strong, audited local baseline for the target player’s cohort.

Likewise, a candidate should not be called “safe” merely because it has broad global volume if the target player’s cohort fit is weak, unknown, or contradicted.

### Safe local fit

Safe fit should mean safe for this player or cohort, not universally safe for all players.

A seed-backed local baseline can justify a safe local fit when:

* the seed reviewer is authoritative for the relevant taste locality;
* the player or cohort being routed is in or near that locality;
* there is no strong same-locality contradiction;
* the predicted fit is high enough to act on;
* uncertainty is reduced enough for cohort-local routing.

The island may still remain under-reviewed globally. This should be explained as evidence maturity, not used as an automatic blocker against local safe fit.

### Smart gamble

Smart gamble should mean promising but not yet safe.

A candidate may be a smart gamble when:

* predicted fit is positive but source authority is weaker;
* evidence is inferred or indirect;
* the player is adjacent to, but not clearly inside, the strongest-fit cohort;
* the island has meaningful upside but unresolved uncertainty;
* the system expects both player value and learning value.

### Discovery probe

Discovery probe should mean learning value dominates fit certainty.

A probe should be plausible for the player, but its main purpose is to improve the model: resolve uncertainty, test a boundary, validate an emerging cohort read, or evaluate whether a player is a useful signal source.

### Under-reviewedness

Under-reviewedness should not be treated as synonymous with unsafe.

Under-reviewedness means the evidence base is not mature. That may make the recommendation more explanatory, more limited in audience, or more useful as a validation route, but it should not erase a high-authority local fit signal.

## 9. Declared identity vs observed affinity

Declared preferences matter.

Observed affinity also matters.

When declared identity and observed behavior diverge, Wayfarer should not silently overwrite the player’s self-description. It can use the divergence diagnostically.

Possible responses include:

* prioritize declared identity in casual browsing
* use observed affinity for guided discovery
* recommend a mixed discovery queue
* suggest preference correction when evidence strongly indicates mismatch

Seed reviewer locality should respect the same principle. A seed reviewer’s declared or assigned cohort is a strong prior because the company controls and audits that role, but the system should still detect if evidence suggests the seed is not behaving as expected in a domain.

## 10. Canonical architecture vs implementation audit

This document describes the intended current architecture.

If code disagrees with this map, do not assume the document is wrong. Treat the disagreement as an audit finding.

The correct resolution may be:

* update stale code
* delete redundant code
* consolidate parallel paths
* update this document if the intended architecture has genuinely changed
* file a follow-up issue if the mismatch is real but too large to fix immediately

## 11. Simplification principle

Prefer one canonical path from evidence event to projection to consumer.

Parallel derived-state paths are suspect unless they serve clearly distinct purposes.

Duplicated confidence, freshness, rating-state, volatility, support, or evidence-type logic should be consolidated behind shared helpers or projections wherever practical.

Every confidence calculation must declare what domain judgment it summarizes. If it belongs to an existing confidence kind, it should reuse that kind rather than inventing a new inline formula.

Do not collapse distinct concepts into a single threshold if consumers need to reason about them separately. In particular, local fit safety and global evidence maturity should remain distinguishable.

## 12. Shared conceptual spine

The live app, Golden Demo, system movement diagnostics, and Modeling Lab may expose different views, but they should not maintain incompatible meanings for:

* evidence
* support
* RD / uncertainty
* volatility
* confidence
* freshness
* source usefulness
* seed authority
* proxy discovery
* recommendation purpose
* evidence maturity
* local recommendation safety

Different surfaces may present different summaries, but the underlying concepts should remain compatible.

## 13. Healthy system behavior

Wayfarer is behaving well when:

* known cohorts become predictable after enough direct evidence
* audited seed reviewers establish strong local baselines under sparse evidence
* seed baselines remain local and provisional rather than universal truth
* strong consensus collapses RD quickly
* sparse ordinary evidence remains uncertain
* sparse audited seed evidence can create local confidence without implying broad maturity
* same-context contradiction raises volatility
* same-context split evidence raises volatility even when the mean washes out
* refreshes reopen uncertainty without causing volatility by themselves
* latest stated ratings remain visible
* current-context aggregates update cleanly after refreshes
* inferred and explicit evidence remain distinguishable
* recommendations become more targeted over time
* probes become more purposeful over time
* high-signal players become more useful as routing/evaluation sources
* ordinary users who repeatedly align with validated local baselines become stronger organic proxy sources
* safe local fit can coexist with global under-reviewedness

## 14. Current implementation anchors

The current live prototype is organized around a few important anchors:

* island/cohort rating snapshots hold rating estimate, RD, confidence, volatility, support, and evidence counts
* evidence freshness is represented with world/island epochs
* refresh events reopen uncertainty without erasing historical support
* the live evidence view model is the main expert-facing projection layer
* Golden Demo and system movement outputs are diagnostic tools, not player-facing product surfaces
* recommendation routing should distinguish local fit safety from evidence maturity
* archived docs are historical context only and should not override this map

## 15. Code simplification audit questions

When auditing the codebase against this map, ask:

* Does this code path derive from canonical events, or does it maintain a parallel truth?
* Does it use epoch semantics for freshness, or turn/version shortcuts?
* Does this code calculate confidence or confidence-like actionability inline? If so, does it belong to an existing confidence kind, require a new named confidence kind, or duplicate dead/stale logic?
* Does it conflate uncertainty and volatility?
* Does it conflate explicit, inferred, synthetic, seed, or diagnostic evidence?
* Does it duplicate rating-state math already owned by island/cohort snapshots?
* Does it treat source usefulness as global when it should be local?
* Does it treat seed authority as universal island truth instead of local baseline evidence?
* Does it prevent safe local fit merely because an island is globally under-reviewed?
* Does it collapse local recommendation safety and evidence maturity into one threshold?
* Does it exist only to preserve an old diagnostic/report shape that is no longer canonical?
* Does it serve a player-facing surface, expert/debug surface, simulation generator, persistence layer, or test fixture? If none, why is it still here?

## 16. Current known risks

### Stale documentation

Historical docs may describe older architecture. Current canonical docs should be preferred.

### Confidence overload

The word confidence can hide too much. Expert surfaces should show the decomposition and confidence kind.

### Seed authority overreach

Seed reviewers should have high authority inside their audited local taste domain, but that authority should not become global editorial truth.

If seed evidence is applied too broadly, Wayfarer risks replacing taste-local discovery with centralized fiat.

### Seed authority underuse

If seed evidence is too weak, the system loses its cold-start advantage and cannot rapidly establish working local baselines.

Seed reviewers exist because the system needs trusted audited calibration sources before organic evidence is dense.

### Local safety vs global maturity collapse

A recommendation system that requires global maturity before calling anything safe will fail to use seed evidence for discovery.

A recommendation system that treats local seed evidence as broad maturity will overstate what has been validated.

Both are wrong. Local fit safety and evidence maturity must remain separate.

### Live/modeling split

The live simulation and modeling/debug layers should continue converging toward one conceptual math spine.

### Projection clarity

Current state should be understood as a projection from evidence, not as mutable truth.

### UI semantics

Player-facing UI must avoid exposing expert terms in confusing ways, while expert/debug UI must not flatten important model distinctions.

## 17. Current next work

The immediate next work is to review the rating-state and routing math against the clarified seed-reviewer doctrine.

The specific audit question is:

> Does the current implementation allow audited seed evidence to create safe local fit while the island remains under-reviewed globally?

This should be reviewed before changing thresholds or routing categories.

The next code-facing pass should inspect, without immediately rewriting:

* how seed/source authority is represented;
* how seed evidence affects rating estimate, RD, support, and effective weight;
* whether seed evidence is distinguished from ordinary sparse evidence;
* whether local recommendation safety is blocked by global under-reviewedness;
* whether safe-fit, smart-gamble, and discovery-probe semantics match this map;
* whether Golden Demo report labels distinguish routed events from unique islands, actual run seed from preset seed, and synthetic behavior from production behavior.

Do not treat this documentation update as a direct implementation instruction to lower thresholds. It establishes doctrine. The math pass should determine what needs to change, if anything.