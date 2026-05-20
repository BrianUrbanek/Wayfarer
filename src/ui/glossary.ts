export type GlossaryTermId =
  | 'cohort-anchor'
  | 'meta-rater'
  | 'trust'
  | 'discovery-signal'
  | 'island-confidence'
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

export interface ConceptPrimerSection {
  id: string;
  title: string;
  paragraphs: string[];
}

export const CONCEPT_PRIMER_SECTIONS: ConceptPrimerSection[] = [
  {
    id: 'problem-goal',
    title: 'Problem and Goal',
    paragraphs: [
      'Wayfarer is built for UGC worlds where brute-force intelligent review does not scale. Too many islands arrive too quickly for uniform high-confidence manual routing.',
      'The product goal is two-sided: route likely-good islands toward players who will enjoy them, and confidently deprioritize islands that are unlikely to fit a specific player right now.'
    ]
  },
  {
    id: 'why-popularity-is-not-enough',
    title: 'Why Popularity Is Not Enough',
    paragraphs: [
      'Raw popularity helps identify broad hits, but it can hide audience mismatch. A globally popular island can still be wrong for a specific player taste profile.',
      'Wayfarer treats taste fit as cohort-local evidence, not as a single global quality score.'
    ]
  },
  {
    id: 'anchor-seeded-taste-space',
    title: 'Anchor-Seeded Taste Space',
    paragraphs: [
      'Cohort Anchors are trusted seed reviewers that define initial taste poles. They are the implementation-facing form of meta-raters.',
      'Other players accumulate trust by producing ratings that align predictably with cohort-local patterns, then extend anchor reach into sparse islands.'
    ]
  },
  {
    id: 'core-semantic-split',
    title: 'Trust, Discovery Signal, and Confidence',
    paragraphs: [
      'Trust belongs to raters and describes how reliably their ratings can be used as evidence.',
      'Discovery Signal is player-facing and tracks useful contribution or progression; it is related to trust but not identical.',
      'Confidence belongs to island audience-fit estimates, ideally per island/cohort pairing even when the UI summarizes confidence at a higher level.'
    ]
  },
  {
    id: 'glicko-analogy',
    title: 'Why Glicko-like Estimate + Uncertainty',
    paragraphs: [
      'Islands do not fight opponents, but the same estimate-plus-uncertainty framing still applies: each new evidence event can move a low-certainty estimate more than a high-certainty one.',
      'This framing helps keep sparse evidence honest and discourages overconfident routing from thin data.'
    ]
  },
  {
    id: 'ratings-vs-behavior',
    title: 'Ratings as Proxy, Behavior as Stronger Evidence',
    paragraphs: [
      'Ratings are early proxy evidence. They are useful for cold-start routing, but they are not the final truth source.',
      'Observed behavior should eventually dominate because engagement outcomes can confirm or contradict the earlier rating signal.'
    ]
  },
  {
    id: 'assumptions-and-risks',
    title: 'Assumptions and Failure Risks',
    paragraphs: [
      'Core assumptions: anchor cohorts are meaningful, rating behavior carries transferable fit signal, and sparse evidence can be stabilized through trust and confidence controls.',
      'Primary risks: anchor bias, noisy early evidence, overconfident cohort mapping, and stale island confidence after major content changes unless a soft reset path is applied.'
    ]
  }
];

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
    fullDefinition: 'The certainty attached to audience-fit estimates for islands, ideally at island/cohort granularity. Confidence belongs to island fit estimates, not to players.',
    scope: 'analyst-facing',
    implementedStatus: 'implemented',
    relatedTerms: ['cohort', 'soft-reset', 'rating-event-weight']
  },
  {
    id: 'rating-event-weight',
    term: 'Rating Event Weight',
    shortDefinition: 'How much one rating should move an estimate right now.',
    fullDefinition: 'A derived weighting concept that applies rater trust to a specific island rating in the context of current uncertainty. It separates evidence strength from like/dislike direction.',
    scope: 'analyst-facing',
    implementedStatus: 'partial',
    relatedTerms: ['trust', 'island-confidence']
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
  'pinned-reference',
  'transient-drilldown'
];

export function glossaryTermById(id: GlossaryTermId): GlossaryTerm | undefined {
  return GLOSSARY_TERMS.find((term) => term.id === id);
}
