import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SelectedIslandEvidenceSummary } from '../ui/routing/SelectedIslandEvidenceSummary';

describe('selected island evidence summary', () => {
  it('keeps legacy projection visuals hidden behind a replacement notice', () => {
    const html = renderToString(
      <SelectedIslandEvidenceSummary
        confidenceRadarData={[{ cohortId: 'cohort-action', confidence: 0.42, label: 'Action' }]}
        ratingEventWeightRows={[
          {
            eventId: 'evt-1',
            userId: 'user-1',
            islandId: 'island-1',
            cohortId: 'cohort-action',
            rating: 1,
            trustWeight: 0.6,
            currentContextConfidence: 0.4,
            uncertaintyLeverage: 0.6,
            eventWeight: 0.36,
            directionalContribution: 0.36
          }
        ]}
        observedBehaviorRows={[
          {
            eventId: 'behavior:evt-1',
            turn: 2,
            userId: 'user-1',
            islandId: 'island-1',
            kind: 'completion',
            value: 1,
            sourceRatingEventId: 'evt-1',
            sourceRatingEventSource: 'organic'
          }
        ]}
        timelineRows={[{ turn: 0, cohortId: 'cohort-action', affinity: 0.2, confidence: 0.5, ratingDeviation: 0.5, uncertainty: 0.5, volatility: 0.08, effectiveWeight: 1, evidenceCount: 1 }]}
        constellation={{ points: [{ eventId: 'evt-1', turn: 2, userId: 'user-1', rating: 1, primaryCohortId: 'cohort-action', secondaryCohortId: null, primaryWeight: 0.6, secondaryWeight: 0, ambiguity: 0, spokeCohortId: 'cohort-action', angleJitter: 0, radiusValue: 0.36, sizeValue: 0.6, opacityValue: 1, directionalContribution: 0.36, weightProxyLabel: 'x' }], spokes: [{ cohortId: 'cohort-action', cohortLabel: 'Action', pointCount: 1, totalPrimaryWeight: 0.6, totalRadiusValue: 0.36 }], usesRatingEventWeightRows: true }}
        cohortLabelById={new Map([['cohort-action', 'Action']])}
        observedBehaviorSummary={{
          islandId: 'island-1',
          totalEvents: 1,
          counts: {
            qualifiedPlay: 0,
            completion: 1,
            replay: 0,
            return: 0,
            bounce: 0,
            abandon: 0
          }
        }}
        islandLabel="Island 1"
      />
    );

    expect(html).toContain('Selected island evidence');
    expect(html).toContain('Current confidence and directional affinity are separate diagnostic/proxy reads');
    expect(html).toContain('Audience read');
    expect(html).toContain('Confidence &amp; stability');
    expect(html).toContain('Evidence provenance');
    expect(html).toContain('Legacy rating-weight and constellation proxy visuals are hidden');
    expect(html).toContain('Projection provenance pending');
    expect(html).toContain('Hidden proxy rows: 1');
    expect(html).toContain('hidden constellation points: 1');
    expect(html).toContain('Island / Cohort Rating Timeline');
    expect(html).not.toContain('Island Evidence Distribution');
    expect(html).not.toContain('Experimental analyst evidence-shape read');
    expect(html).not.toContain('Rating Event Weight');
    expect(html).toContain('Observed behavior');
    expect(html).toContain('generated from rating events');
    expect(html).toContain('Behavior events');
  });
});

