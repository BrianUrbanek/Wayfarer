import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SelectedIslandEvidenceSummary } from '../ui/routing/SelectedIslandEvidenceSummary';

describe('selected island evidence summary', () => {
  it('renders confidence and rating-event-weight explanation surfaces', () => {
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
    expect(html).toContain('Confidence shows how certain');
    expect(html).toContain('Historical confidence snapshots are not implemented yet');
    expect(html).toContain('Island confidence by cohort');
    expect(html).toContain('Rating Event Weight');
    expect(html).toContain('Observed behavior');
    expect(html).toContain('generated from rating events');
    expect(html).toContain('Behavior events');
  });
});
