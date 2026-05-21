import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SelectedUserSummary } from '../ui/selectedUser/SelectedUserSummary';

describe('selected user summary', () => {
  it('renders the discovery signal and hidden taste audit surface', () => {
    const html = renderToString(
      <SelectedUserSummary
        selectedUserLabel="User 1"
        declaredTags={['strategy', 'competition']}
        selectedInference={
          {
            signalFit: 0.321,
            ratingEvidence: 0.456,
            effectiveSignal: 0.789,
            behaviorMatchStrength: 0.654,
            behaviorSpecificity: 0.432,
            targetAlignment: {
              ratedCount: 2,
              agreementCount: 1,
              agreementRate: 0.5,
              cohortId: 'cohort-strategy'
            },
            cohortSeparability: { topGap: 0.27, message: 'test gap', label: 'moderate' },
            declaredTop: { cohortId: 'cohort-strategy' }
          } as never
        }
        selectedPrimarySignal={null}
        selectedRaterSignalProfile={null}
        selectedDiscoverySignalProfile={
          {
            userId: 'user-1',
            score: 0.42,
            behaviorConsistency: 0.51,
            confidenceMomentum: 0.48,
            support: 0.75,
            eventCount: 3,
            latestTurn: 2,
            summary: 'Synthetic discovery usefulness is based on 3 rating-linked behavior events and stored confidence snapshots.',
            turnRows: [
              {
                turn: 1,
                ratingEvents: 2,
                behaviorAgreement: 0.5,
                confidenceMomentum: 0.45,
                usefulness: 0.49
              }
            ]
          } as never
        }
        declaredOverlapText="Overlap text"
        declaredObservedRelationshipText="Relationship text"
        behaviorReadText="Behavior read text"
        inverseNotice="Inverse notice"
        cohortLabel={(cohortId) => cohortId ?? 'none'}
        openUserPicker={() => {}}
        pinCurrentUser={() => {}}
        renderPrimarySignalTitle={() => 'Primary behavior read: diffuse behavior'}
        signalRows={[]}
        signalColumns={[]}
        declaredDistributionChart={<div>Declared chart</div>}
        behaviorDistributionChart={<div>Behavior chart</div>}
      />
    );

    expect(html).toContain('Discovery Signal');
    expect(html).toContain('Retrospective usefulness uses observed behavior and stored confidence snapshots.');
    expect(html).toContain('Rater trust profile (internal)');
  });
});
