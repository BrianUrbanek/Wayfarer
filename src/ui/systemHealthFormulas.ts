export type SystemHealthComponentKey = 'player' | 'island' | 'cohort' | 'tag';

export interface WeightedComponent {
  key: SystemHealthComponentKey;
  label: string;
  weight: number;
}

export interface FormulaFactor {
  key: string;
  label: string;
  weight: number;
}

export const SYSTEM_HEALTH_FORMULA_SPEC = {
  caveats: {
    overview: 'Deterministic v1 proxies for structure/evidence. Not prediction accuracy or validated statistical truth.',
    tagConfidence: 'Tag Confidence is a weak proxy and should be interpreted as experimental.'
  },
  coverage: {
    composite: [
      { key: 'player', label: 'Player Coverage', weight: 0.35 },
      { key: 'island', label: 'Island Coverage', weight: 0.3 },
      { key: 'cohort', label: 'Cohort Coverage', weight: 0.2 },
      { key: 'tag', label: 'Tag Coverage', weight: 0.15 }
    ] as WeightedComponent[],
    player: {
      ratingsPerUserWeight: 0.75,
      progressWeight: 0.25
    },
    island: {
      ratedIslandsWeight: 0.7,
      routedIslandsWeight: 0.3
    },
    tag: {
      tagDensityWeight: 0.5,
      ratingsCoverageWeight: 0.5
    }
  },
  confidence: {
    composite: [
      { key: 'player', label: 'Player Confidence', weight: 0.4 },
      { key: 'island', label: 'Island Confidence', weight: 0.35 },
      { key: 'cohort', label: 'Cohort Confidence', weight: 0.2 },
      { key: 'tag', label: 'Tag Confidence', weight: 0.05 }
    ] as WeightedComponent[],
    player: {
      evidenceGate: 'ratingEvidence',
      behaviorScoreWeight: 0.55,
      diagnosisWeight: 0.45,
      diagnosisWeights: {
        HIGH_SIGNAL: 1,
        MISMATCH_RETAG: 1,
        INVERSE_PROFILE: 1,
        LOW_SIGNAL: 0.4,
        UNKNOWN_OR_NOISY: 0.15,
        AMBIGUOUS: 0.15
      } as Record<string, number>
    },
    island: {
      affinityConfidenceWeight: 0.7,
      affinityEvidenceWeight: 0.3
    },
    cohort: {
      knownTopWeight: 0.45,
      specificityWeight: 0.35,
      evidenceWeight: 0.2
    },
    tag: {
      tagCoherenceWeight: 0.6,
      tagDensityWeight: 0.15,
      playerConfidenceWeight: 0.25
    }
  }
};

export function getPlayerDiagnosisWeight(diagnosisType: string): number {
  return SYSTEM_HEALTH_FORMULA_SPEC.confidence.player.diagnosisWeights[diagnosisType] ??
    SYSTEM_HEALTH_FORMULA_SPEC.confidence.player.diagnosisWeights.AMBIGUOUS;
}

export function sumFormulaWeights(items: Array<{ weight: number }>): number {
  return items.reduce((sum, item) => sum + item.weight, 0);
}

export const SYSTEM_HEALTH_FORMULA_AUDIT = {
  coverageComposite: SYSTEM_HEALTH_FORMULA_SPEC.coverage.composite,
  confidenceComposite: SYSTEM_HEALTH_FORMULA_SPEC.confidence.composite,
  playerEvidenceGate: SYSTEM_HEALTH_FORMULA_SPEC.confidence.player.evidenceGate,
  playerDiagnosisWeights: SYSTEM_HEALTH_FORMULA_SPEC.confidence.player.diagnosisWeights
};
