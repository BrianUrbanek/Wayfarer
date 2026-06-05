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
        liveEvidenceRead={{
          state: 'compatibility',
          headline: 'Compatibility proxy only',
          sourceAuthority: 'Legacy cohort-similarity proxy remains in use for User 1; it is not source authority.',
          provenance: 'Visible ratings and inference are available, but the live app cannot yet surface canonical source-class or projection provenance here.',
          compatibilityNote: 'This readout is explicitly a compatibility/degraded bridge, not canonical modeling-core evidence.',
          laneSignalSummary: 'Legacy cohort weights exist for 1 cohorts.',
          rdSummary: 'Observed rating evidence: 0.456',
          volatilitySummary: 'Behavior specificity: 0.432'
        }}
      />
    );

    expect(html).toContain('Preference read');
    expect(html).toContain('Signal-source read');
    expect(html).toContain('Compatibility bridge for live-app evidence');
    expect(html).toContain('Evidence state');
    expect(html).toContain('Compatibility proxy only');
    expect(html).toContain('Legacy cohort-similarity proxy remains in use');
    expect(html).toContain('canonical modeling-core evidence');
    expect(html).not.toContain('Retrospective usefulness uses observed behavior and stored confidence snapshots.');
    expect(html).toContain('Expert provenance');
  });
});
