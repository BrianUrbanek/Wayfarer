export type GlossaryTermId =
  | 'cohort-anchor'
  | 'meta-rater'
  | 'trust'
  | 'discovery-signal'
  | 'island-confidence'
  | 'island-cohort-rating-state'
  | 'glicko-shaped'
  | 'rating-deviation'
  | 'volatility'
  | 'rating-period'
  | 'rating-event-weight'
  | 'observed-behavior'
  | 'soft-reset'
  | 'cohort'
  | 'declared-preference'
  | 'behavioral-similarity'
  | 'target-agreement'
  | 'cohort-separability'
  | 'discovery-routing'
  | 'safe-fit'
  | 'discovery-probe'
  | 'confidence-composite'
  | 'oracle-test-generator-truth'
  | 'confidence-snapshot'
  | 'pinned-reference'
  | 'transient-drilldown';

export type GlossaryScope = 'player-facing' | 'analyst-facing' | 'internal' | 'future-facing';

export type GlossaryImplementedStatus = 'implemented' | 'partial' | 'future';

export interface GlossaryTerm {
  id: GlossaryTermId;
  term: string;
  shortDefinition: string;
  fullDefinition: string;
  scope: GlossaryScope;
  implementedStatus: GlossaryImplementedStatus;
  relatedTerms?: GlossaryTermId[];
}

export const CONCEPT_PRIMER_MARKDOWN = `## Content Discovery Under Uncertainty

Wayfarer treats islands as the prototype framing for a broader content discovery problem. The same model shape can apply to video, books, music, podcasts, apps, creator marketplaces, and other content surfaces where early evidence is sparse and expensive to interpret.

The system is not limited to UGC worlds, even if islands are the current concrete example. Islands are the working object that lets us inspect how cohort-local evidence, trust weighting, and confidence behave before generalizing the same logic to other content domains.

## Trust, Discovery Signal, and Confidence

Trust belongs to raters. It answers whether a person\'s ratings can be used as evidence. Discovery Signal belongs to the player-facing contribution layer. It answers whether a player has been useful over time. Confidence belongs to the island/cohort estimate itself. It answers how certain we are about fit right now, and in the current prototype it is projected from the island/cohort rating state rather than treated as a separate model.

These three ideas are related but not interchangeable. Trust weights evidence. Discovery Signal is retrospective usefulness. Confidence is the current uncertainty attached to an island/cohort read.

## Confidence Composite and Oracle Truth

Where the UI has RD, volatility, and evidence support together, confidence is shown as a composite UX read rather than a raw certainty claim. The composite stays separate from RD/uncertainty, volatility/stability, and evidence support so each part can still be inspected on its own.

Hidden truth and generator truth are validation layers only. They can be shown as oracle / test generator truth for audit and debugging, but they are never treated as model input or production-visible truth.

## Ratings, Behavior, and Hidden Truth

Ratings are early proxy evidence. They help the prototype route and explain fit before stronger evidence exists. Observed behavior is a separate evidence layer and should eventually outweigh early proxy ratings when it is available.

The generator also has hidden truth layers for auditability: seed cohorts, unseeded cohorts, user preference vectors, island appeal vectors, and truth classes. Those hidden layers explain why the synthetic ratings and later behavior look the way they do.

## Why the Prototype Uses Cohorts

Cohorts make the taste space inspectable. They let the system compare a player against multiple stable audience lenses instead of collapsing everything into one global quality score. That is the core reason confidence is modeled per island/cohort pairing and why analyst surfaces need to expose the underlying generator truth.`;

export const GLOSSARY_TERMS: GlossaryTerm[] = [
  {
    id: 'meta-rater',
    term: 'Meta-rater',
    shortDefinition: 'A trusted evaluator used to define taste structure early.',
    fullDefinition: 'A conceptual trusted evaluator that helps seed taste space before broad player evidence is available. In Wayfarer, this role is implemented through cohort anchors.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['cohort-anchor', 'cohort']
  },
  {
    id: 'cohort-anchor',
    term: 'Cohort Anchor',
    shortDefinition: 'Implementation-facing seed reviewer for a cohort taste group.',
    fullDefinition: 'A seed reviewer profile chosen to represent a meaningful audience taste group. Cohort anchors provide initial ratings that bootstrap cohort-local fit interpretation.',
    scope: 'internal',
    implementedStatus: 'implemented',
    relatedTerms: ['meta-rater', 'cohort', 'trust']
  },
  {
    id: 'trust',
    term: 'Trust',
    shortDefinition: 'Rater reliability signal used for weighting evidence.',
    fullDefinition: 'An internal estimate of how reliably a player\'s ratings can contribute to audience-fit inference. Trust belongs to players/raters, not islands.',
    scope: 'internal',
    implementedStatus: 'implemented',
    relatedTerms: ['discovery-signal', 'rating-event-weight']
  },
  {
    id: 'discovery-signal',
    term: 'Discovery Signal',
    shortDefinition: 'Player-facing useful-contribution and progression read.',
    fullDefinition: 'A player-facing measure of useful contribution to discovery outcomes. Discovery signal is related to trust, but does not mean the same thing as internal rater reliability.',
    scope: 'player-facing',
    implementedStatus: 'partial',
    relatedTerms: ['trust', 'observed-behavior']
  },
  {
    id: 'island-confidence',
    term: 'Island Confidence',
    shortDefinition: 'Certainty on island audience-fit estimates.',
    fullDefinition:
      'The certainty attached to audience-fit estimates for islands at island/cohort granularity. Confidence belongs to island fit estimates, not to players, and in the current model it is projected from island/cohort rating deviation at explicit rating-period or update-boundary snapshots.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['cohort', 'soft-reset', 'rating-event-weight', 'confidence-snapshot', 'island-cohort-rating-state', 'rating-deviation', 'rating-period']
  },
  {
    id: 'island-cohort-rating-state',
    term: 'Island/Cohort Rating State',
    shortDefinition: 'Glicko-shaped fit, RD analogue, and freshness for an island/cohort pair.',
    fullDefinition:
      'The durable island/cohort estimate used by Wayfarer to track fit, rating deviation, and volatility over rating periods or turn/update boundaries. It is Glicko-inspired rather than a literal canonical Glicko-2 implementation, and it projects into confidence, uncertainty, and event weight for reports.',
    scope: 'internal',
    implementedStatus: 'partial',
    relatedTerms: ['island-confidence', 'rating-event-weight', 'soft-reset', 'confidence-snapshot', 'rating-deviation', 'volatility', 'glicko-shaped', 'rating-period']
  },
  {
    id: 'glicko-shaped',
    term: 'Glicko-inspired / Glicko-shaped',
    shortDefinition: 'A Wayfarer-friendly rating substrate shaped like Glicko, not canonical Glicko-2.',
    fullDefinition:
      'A rating-and-uncertainty substrate that borrows Glicko concepts such as rating deviation and volatility without claiming a literal canonical Glicko-2 implementation. In Wayfarer, the shape is adapted to island/cohort fit rather than head-to-head competition.',
    scope: 'internal',
    implementedStatus: 'implemented',
    relatedTerms: ['island-cohort-rating-state', 'rating-deviation', 'volatility', 'rating-period']
  },
  {
    id: 'rating-deviation',
    term: 'Rating Deviation / RD',
    shortDefinition: 'Uncertainty width around an island/cohort fit estimate.',
    fullDefinition:
      'The uncertainty width around an island/cohort fit estimate. Lower RD means the read is more mature and should move less from new evidence; higher RD means the read is less certain and should move more. RD is an analogue, not a claim of canonical Glicko-2 implementation.',
    scope: 'internal',
    implementedStatus: 'implemented',
    relatedTerms: ['glicko-shaped', 'island-cohort-rating-state', 'island-confidence', 'rating-period', 'volatility']
  },
  {
    id: 'volatility',
    term: 'Volatility',
    shortDefinition: 'Freshness or instability analogue for an island/cohort read.',
    fullDefinition:
      'A freshness or instability analogue that tracks how erratic an island/cohort read appears over time. Consistent evidence should keep volatility lower and stable, while surprising or contradictory evidence may raise it. It is an analogue used for Wayfarer\'s Glicko-shaped substrate, not canonical Glicko-2 volatility.',
    scope: 'internal',
    implementedStatus: 'implemented',
    relatedTerms: ['glicko-shaped', 'rating-deviation', 'island-cohort-rating-state', 'soft-reset', 'rating-period']
  },
  {
    id: 'rating-period',
    term: 'Rating Period / Update Boundary',
    shortDefinition: 'The turn boundary where island/cohort estimates update.',
    fullDefinition:
      'The update boundary at which Wayfarer applies accumulated evidence to an island/cohort fit read. Turns currently serve as the prototype rating period, but the same shape can later support other boundary types such as scheduled or threshold-triggered updates.',
    scope: 'internal',
    implementedStatus: 'implemented',
    relatedTerms: ['island-cohort-rating-state', 'confidence-snapshot', 'rating-deviation', 'volatility']
  },
  {
    id: 'rating-event-weight',
    term: 'Rating Event Weight',
    shortDefinition: 'How much one rating should move an estimate right now.',
    fullDefinition:
      'A derived weighting concept calculated as trust multiplied by uncertainty leverage projected from the current island/cohort rating state. Direction stays separate from weight magnitude: a high-weight negative rating is strong negative evidence, not low-value evidence. Uncertainty leverage comes from the RD analogue projected through the island/cohort rating state, not from a separate heuristic.',
    scope: 'analyst-facing',
    implementedStatus: 'partial',
    relatedTerms: ['trust', 'island-confidence', 'island-cohort-rating-state', 'confidence-snapshot', 'rating-deviation']
  },
  {
    id: 'confidence-snapshot',
    term: 'Confidence Snapshot',
    shortDefinition: 'Baseline island/cohort confidence at an update boundary.',
    fullDefinition:
      'A stored baseline state for an island/cohort read at a rating-period or update boundary. Wayfarer currently stores post-turn island/cohort confidence snapshots in simulation state and exports so growth can be inspected after import. Pre-turn event-weight snapshots remain future work and can still use the same boundary model later.',
    scope: 'analyst-facing',
    implementedStatus: 'partial',
    relatedTerms: ['island-confidence', 'rating-event-weight', 'island-cohort-rating-state', 'rating-period']
  },
  {
    id: 'observed-behavior',
    term: 'Observed Behavior',
    shortDefinition: 'Outcome evidence that can confirm or contradict ratings.',
    fullDefinition: 'Behavioral outcomes such as completion, replay, return, bounce, or abandonment that eventually serve as stronger truth signals than early proxy ratings.',
    scope: 'future-facing',
    implementedStatus: 'future',
    relatedTerms: ['discovery-signal', 'island-confidence']
  },
  {
    id: 'soft-reset',
    term: 'Soft Reset',
    shortDefinition: 'A controlled increase in uncertainty after major island change.',
    fullDefinition: 'A mechanism that makes island confidence more movable after major island updates, so stale confidence does not lock the system into outdated assumptions.',
    scope: 'future-facing',
    implementedStatus: 'future',
    relatedTerms: ['island-confidence']
  },
  {
    id: 'cohort',
    term: 'Cohort',
    shortDefinition: 'A taste-group frame used to interpret audience fit.',
    fullDefinition: 'A cluster-like taste group used as explanatory structure for rating and behavior patterns. Cohorts are analytical tools, not fixed player identities.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['cohort-anchor', 'behavioral-similarity', 'target-agreement']
  },
  {
    id: 'declared-preference',
    term: 'Declared Preference / Self-identification',
    shortDefinition: 'What a player says they like.',
    fullDefinition: 'The explicit preference signal a player declares through tags or self-description. It can align with or diverge from observed behavior.',
    scope: 'player-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['behavioral-similarity', 'target-agreement']
  },
  {
    id: 'behavioral-similarity',
    term: 'Behavioral Similarity',
    shortDefinition: 'Fit signal from rating behavior overlap patterns.',
    fullDefinition: 'A similarity read derived from overlap in ratings and rating structure. It is used as a cohort-local evidence component rather than as a universal truth metric.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['cohort', 'target-agreement', 'cohort-separability']
  },
  {
    id: 'target-agreement',
    term: 'Target Agreement',
    shortDefinition: 'Agreement rate against selected cohort reference outcomes.',
    fullDefinition: 'A direct agreement measure between a player\'s observed ratings and a selected cohort reference set over rated overlap.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['behavioral-similarity', 'cohort']
  },
  {
    id: 'cohort-separability',
    term: 'Cohort Separability',
    shortDefinition: 'How clearly evidence distinguishes top cohort from runners-up.',
    fullDefinition: 'A measure of whether current evidence cleanly separates the strongest cohort explanation from alternatives.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['cohort', 'behavioral-similarity']
  },
  {
    id: 'discovery-routing',
    term: 'Discovery Routing',
    shortDefinition: 'Analyst-facing route selection for unrated island exposure.',
    fullDefinition: 'The workflow that prioritizes unrated islands by combining fit and exploration constraints, producing safe-fit and discovery-probe candidates.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['safe-fit', 'discovery-probe']
  },
  {
    id: 'confidence-composite',
    term: 'Confidence Composite',
    shortDefinition: 'Composite confidence read built from RD, volatility, and evidence support.',
    fullDefinition:
      'A novice-facing confidence read shown only when the UI has honest RD, volatility, and evidence support available together. It is a composite summary, not a replacement for the separate uncertainty, stability, or evidence fields.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['rating-deviation', 'volatility', 'rating-event-weight', 'island-confidence']
  },
  {
    id: 'oracle-test-generator-truth',
    term: 'Oracle / Test Generator Truth',
    shortDefinition: 'Validation-only hidden truth used to check a synthetic run.',
    fullDefinition:
      'The hidden generator layer used to validate a synthetic or test scenario. It is shown only as oracle / test generator truth, must be labeled as validation-only, and is never model input.',
    scope: 'internal',
    implementedStatus: 'implemented',
    relatedTerms: ['transient-drilldown', 'confidence-snapshot']
  },
  {
    id: 'safe-fit',
    term: 'Safe Fit',
    shortDefinition: 'Higher-confidence positive-fit candidate route.',
    fullDefinition: 'A routed candidate where current evidence indicates stronger expected fit and lower downside risk for the selected player.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['discovery-routing', 'discovery-probe']
  },
  {
    id: 'discovery-probe',
    term: 'Discovery Probe',
    shortDefinition: 'Exploration-oriented route with bounded risk.',
    fullDefinition: 'A routed candidate chosen partly for information gain under safeguards, used to reduce uncertainty in sparse regions of taste space.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['discovery-routing', 'safe-fit']
  },
  {
    id: 'pinned-reference',
    term: 'Pinned Reference',
    shortDefinition: 'A drilldown target held in place for cross-panel comparison.',
    fullDefinition: 'A selected user, island, or cohort pinned in the right tray so analysts can keep the same context while scanning other dashboard modules.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['transient-drilldown']
  },
  {
    id: 'transient-drilldown',
    term: 'Transient Drilldown',
    shortDefinition: 'Temporary inspection view not persisted as a pinned anchor.',
    fullDefinition: 'An on-demand detail view used for quick checks. It is useful for exploration but does not persist as stable reference context unless pinned.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['pinned-reference']
  }
];

export const REQUIRED_GLOSSARY_TERMS: GlossaryTermId[] = [
  'meta-rater',
  'cohort-anchor',
  'trust',
  'discovery-signal',
  'island-confidence',
  'rating-event-weight',
  'glicko-shaped',
  'rating-deviation',
  'volatility',
  'rating-period',
  'observed-behavior',
  'soft-reset',
  'cohort',
  'declared-preference',
  'behavioral-similarity',
  'target-agreement',
  'cohort-separability',
  'discovery-routing',
  'safe-fit',
  'discovery-probe',
  'confidence-composite',
  'oracle-test-generator-truth',
  'confidence-snapshot',
  'pinned-reference',
  'transient-drilldown'
];

export function glossaryTermById(id: GlossaryTermId): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((term) => term.id === id);
}
