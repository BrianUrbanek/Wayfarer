import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { CohortAffinityEstimate } from '../model/affinity';
import { buildIslandTruthComparison } from '../model/islandTruthComparison';
import { SelectedIslandTruthComparison, SelectedIslandTruthComparisonModal } from '../ui/routing/SelectedIslandTruthComparison';

function makeEstimate(overrides: Partial<CohortAffinityEstimate> & { cohortId: string }): CohortAffinityEstimate {
  const defaults: CohortAffinityEstimate = {
    islandId: 'island',
    cohortId: overrides.cohortId,
    rating: 0,
    affinity: 0,
    confidence: 0,
    ratingDeviation: 1,
    volatility: 0.08,
    effectiveWeight: 0,
    evidenceCount: 0,
    observedMean: 0,
    disagreement: 0,
    uncertainty: 1,
    rawCount: 0,
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0,
    contributions: [],
    lastUpdatedTurn: undefined,
    version: 1
  };

  return {
    ...defaults,
    ...overrides,
    islandId: 'island',
    cohortId: overrides.cohortId
  };
}

const visibleLabels = new Map([
  ['cohort-action', 'Competitive / Skill Expression'],
  ['cohort-story', 'Roleplay / Social']
]);

describe('island truth comparison', () => {
  it('reports an emerging match when the hidden target projection is learned confidently', () => {
    const report = buildIslandTruthComparison({
      island: {
        id: 'island-match',
        label: 'Island Match',
        hiddenTruthClass: 'seed-cohort-match',
        hiddenTargetTasteCohortId: 'hidden-seed-1',
        hiddenAppealVector: { 'tag-action': 0.8, 'tag-story': -0.1 }
      },
      hiddenTasteCohorts: [
        {
          id: 'hidden-seed-1',
          label: 'Hidden Action',
          kind: 'seed',
          sourceSeedCohortId: 'cohort-action',
          projectedSeedCohortId: 'cohort-action',
          preferenceVector: { 'tag-action': 1 },
          tagSignature: ['tag-action']
        }
      ],
      cohortLabelById: visibleLabels,
      affinityReport: {
        islandId: 'island-match',
        estimates: [
          makeEstimate({
            cohortId: 'cohort-action',
            affinity: 0.58,
            confidence: 0.78,
            ratingDeviation: 0.22,
            volatility: 0.06,
            effectiveWeight: 3.4,
            evidenceCount: 5,
            observedMean: 0.52,
            uncertainty: 0.22,
            rawCount: 5,
            lastUpdatedTurn: 4
          }),
          makeEstimate({
            cohortId: 'cohort-story',
            affinity: -0.15,
            confidence: 0.31,
            ratingDeviation: 0.52,
            volatility: 0.08,
            effectiveWeight: 1.1,
            evidenceCount: 2,
            observedMean: -0.1,
            uncertainty: 0.69,
            rawCount: 2,
            lastUpdatedTurn: 4
          })
        ],
        topPositive: null,
        topNegative: null
      }
    });

    expect(report.status).toBe('emerging-match');
    expect(report.statusLabel).toBe('Emerging match');
    expect(report.hiddenTargetTasteCohortKind).toBe('seed');
    expect(report.hiddenTargetProjectableVisibleCohortLabel).toBe('Competitive / Skill Expression');
    expect(report.learnedEstimateForHiddenTarget?.cohortId).toBe('cohort-action');
    expect(report.summarySentence).toContain('emerging match');
  });

  it('stays unresolved when evidence is sparse', () => {
    const report = buildIslandTruthComparison({
      island: {
        id: 'island-weak',
        label: 'Island Weak',
        hiddenTruthClass: 'unseeded-cohort-match',
        hiddenTargetTasteCohortId: 'hidden-unseeded-1',
        hiddenAppealVector: { 'tag-casual': 0.4 }
      },
      hiddenTasteCohorts: [
        {
          id: 'hidden-unseeded-1',
          label: 'Hidden Casual',
          kind: 'unseeded',
          sourceSeedCohortId: 'cohort-story',
          projectedSeedCohortId: 'cohort-story',
          preferenceVector: { 'tag-casual': 1 },
          tagSignature: ['tag-casual']
        }
      ],
      cohortLabelById: visibleLabels,
      affinityReport: {
        islandId: 'island-weak',
        estimates: [
          makeEstimate({
            cohortId: 'cohort-story',
            affinity: 0.08,
            confidence: 0.22,
            ratingDeviation: 0.78,
            volatility: 0.12,
            effectiveWeight: 0.8,
            evidenceCount: 1,
            observedMean: 0.08,
            uncertainty: 0.78,
            rawCount: 1,
            lastUpdatedTurn: 1
          })
        ],
        topPositive: null,
        topNegative: null
      }
    });

    expect(report.status).toBe('unresolved');
    expect(report.hiddenTargetTasteCohortKind).toBe('unseeded');
    expect(report.hiddenTargetTasteCohortLabel).toBe('Hidden Casual');
  });

  it('treats random truth as false positive when learned structure is confidently positive', () => {
    const report = buildIslandTruthComparison({
      island: {
        id: 'island-random',
        label: 'Island Random',
        hiddenTruthClass: 'random',
        hiddenAppealVector: { 'tag-random': 0.2 }
      },
      hiddenTasteCohorts: [],
      cohortLabelById: visibleLabels,
      affinityReport: {
        islandId: 'island-random',
        estimates: [
          makeEstimate({
            cohortId: 'cohort-action',
            affinity: 0.41,
            confidence: 0.73,
            ratingDeviation: 0.27,
            volatility: 0.07,
            effectiveWeight: 3.2,
            evidenceCount: 4,
            observedMean: 0.39,
            uncertainty: 0.27,
            rawCount: 4,
            lastUpdatedTurn: 1
          })
        ],
        topPositive: null,
        topNegative: null
      }
    });

    expect(report.status).toBe('possible-false-positive');
    expect(report.statusLabel).toBe('Possible false positive');
  });

  it('treats random truth as correctly uncertain when evidence is weak', () => {
    const report = buildIslandTruthComparison({
      island: {
        id: 'island-random-weak',
        label: 'Island Random Weak',
        hiddenTruthClass: 'random',
        hiddenAppealVector: { 'tag-random': 0.2 }
      },
      hiddenTasteCohorts: [],
      cohortLabelById: visibleLabels,
      affinityReport: {
        islandId: 'island-random-weak',
        estimates: [
          makeEstimate({
            cohortId: 'cohort-action',
            affinity: 0.12,
            confidence: 0.18,
            ratingDeviation: 0.86,
            volatility: 0.07,
            effectiveWeight: 0.4,
            evidenceCount: 1,
            observedMean: 0.12,
            uncertainty: 0.82,
            rawCount: 1,
            lastUpdatedTurn: 1
          })
        ],
        topPositive: null,
        topNegative: null
      }
    });

    expect(report.status).toBe('random-correctly-uncertain');
    expect(report.statusLabel).toBe('Random correctly uncertain');
  });

  it('distinguishes seeded and unseeded target labels and renders the compact card without the audit table', () => {
    const report = buildIslandTruthComparison({
      island: {
        id: 'island-unseeded',
        label: 'Island Unseeded',
        hiddenTruthClass: 'unseeded-cohort-match',
        hiddenTargetTasteCohortId: 'hidden-unseeded-2',
        hiddenAppealVector: { 'tag-casual': 0.6 }
      },
      hiddenTasteCohorts: [
        {
          id: 'hidden-unseeded-2',
          label: 'Unseeded Hidden Casual',
          kind: 'unseeded',
          sourceSeedCohortId: 'cohort-story',
          projectedSeedCohortId: 'cohort-story',
          preferenceVector: { 'tag-casual': 1 },
          tagSignature: ['tag-casual']
        }
      ],
      cohortLabelById: visibleLabels,
      affinityReport: {
        islandId: 'island-unseeded',
        estimates: [
          makeEstimate({
            cohortId: 'cohort-story',
            affinity: 0.24,
            confidence: 0.54,
            ratingDeviation: 0.46,
            volatility: 0.08,
            effectiveWeight: 2,
            evidenceCount: 3,
            observedMean: 0.23,
            uncertainty: 0.46,
            rawCount: 3,
            lastUpdatedTurn: 3
          })
        ],
        topPositive: null,
        topNegative: null
      }
    });

    expect(report.hiddenTargetTasteCohortKind).toBe('unseeded');
    expect(report.hiddenTargetTasteCohortLabel).toBe('Unseeded Hidden Casual');

    const html = renderToString(<SelectedIslandTruthComparison report={report} />);
    expect(html).toContain('Truth Alignment');
    expect(html).toContain('Inspect truth comparison');
    expect(html).toContain('Unseeded target: Unseeded Hidden Casual');
    expect(html).not.toContain('Visible cohort estimates');
  });

  it('renders the drilldown modal with hidden truth and learned estimate details', () => {
    const report = buildIslandTruthComparison({
      island: {
        id: 'island-modal',
        label: 'Island Modal',
        hiddenTruthClass: 'seed-cohort-match',
        hiddenTargetTasteCohortId: 'hidden-seed-1',
        hiddenAppealVector: { 'tag-action': 0.8, 'tag-story': -0.2 }
      },
      hiddenTasteCohorts: [
        {
          id: 'hidden-seed-1',
          label: 'Hidden Action',
          kind: 'seed',
          sourceSeedCohortId: 'cohort-action',
          projectedSeedCohortId: 'cohort-action',
          preferenceVector: { 'tag-action': 1 },
          tagSignature: ['tag-action']
        }
      ],
      cohortLabelById: visibleLabels,
      affinityReport: {
        islandId: 'island-modal',
        estimates: [
          makeEstimate({
            cohortId: 'cohort-action',
            affinity: 0.42,
            confidence: 0.67,
            ratingDeviation: 0.33,
            volatility: 0.07,
            effectiveWeight: 2.6,
            evidenceCount: 4,
            observedMean: 0.4,
            uncertainty: 0.33,
            rawCount: 4,
            lastUpdatedTurn: 4
          })
        ],
        topPositive: null,
        topNegative: null
      }
    });

    const html = renderToString(
      <SelectedIslandTruthComparisonModal report={report} open onClose={() => undefined} />
    );

    expect(html).toContain('Truth comparison audit');
    expect(html).toContain('Oracle / test generator truth');
    expect(html).toContain('Top positive visible cohort');
    expect(html).toContain('toy-world audit data');
    expect(html).toContain('Visible cohort estimates');
    expect(html).toContain('Confidence proxy 67% / RD 0.330 / Volatility 0.070');
  });

  it('renders random hidden truth details without a target cohort', () => {
    const report = buildIslandTruthComparison({
      island: {
        id: 'island-random-modal',
        label: 'Island Random Modal',
        hiddenTruthClass: 'random',
        hiddenAppealVector: { 'tag-random': 0.2 }
      },
      hiddenTasteCohorts: [],
      cohortLabelById: visibleLabels,
      affinityReport: {
        islandId: 'island-random-modal',
        estimates: [
          makeEstimate({
            cohortId: 'cohort-action',
            affinity: 0.12,
            confidence: 0.18,
            ratingDeviation: 0.86,
            volatility: 0.07,
            effectiveWeight: 0.4,
            evidenceCount: 1,
            observedMean: 0.12,
            uncertainty: 0.82,
            rawCount: 1,
            lastUpdatedTurn: 1
          })
        ],
        topPositive: null,
        topNegative: null
      }
    });

    const html = renderToString(
      <SelectedIslandTruthComparisonModal report={report} open onClose={() => undefined} />
    );

    expect(html).toContain('Random / noisy truth');
    expect(html).toContain('Target cohort');
    expect(html).toContain('none');
    expect(html).toContain('Target kind');
    expect(html).toContain('n/a');
    expect(html).toContain('Appeal vector');
  });

  it('handles missing hidden truth fields gracefully', () => {
    const report = buildIslandTruthComparison({
      island: {
        id: 'island-missing',
        label: 'Island Missing'
      },
      hiddenTasteCohorts: [],
      cohortLabelById: visibleLabels,
      affinityReport: {
        islandId: 'island-missing',
        estimates: [],
        topPositive: null,
        topNegative: null
      }
    });

    expect(report.status).toBe('missing-truth-data');
    expect(report.hiddenTruthClassLabel).toBe('n/a');
    expect(report.hiddenAppealVectorSummary).toBe('n/a');
  });
});
