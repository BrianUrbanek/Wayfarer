import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SelectedUserSummary } from '../ui/selectedUser/SelectedUserSummary';

describe('selected user summary', () => {
  it('hides legacy signal-source proxies until modeling-core authority is available', () => {
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
        declaredOverlapText="Overlap text"
        declaredObservedRelationshipText="Relationship text"
        behaviorReadText="Behavior read text"
        inverseNotice="Inverse notice"
        cohortLabel={(cohortId) => cohortId ?? 'none'}
        openUserPicker={() => {}}
        pinCurrentUser={() => {}}
        renderPrimarySignalTitle={() => 'Primary behavior read: diffuse behavior'}
        declaredDistributionChart={<div>Declared chart</div>}
        behaviorDistributionChart={<div>Behavior chart</div>}
      />
    );

    expect(html).toContain('Preference read');
    expect(html).toContain('Signal-source read');
    expect(html).toContain('Hidden for replacement');
    expect(html).toContain('previous rater-signal and Discovery Signal surfaces used legacy cohort-similarity and stored-confidence proxy math');
    expect(html).toContain('modeling-core source authority');
    expect(html).not.toContain('Retrospective usefulness uses observed behavior and stored confidence snapshots.');
    expect(html).toContain('Expert provenance');
  });
});
