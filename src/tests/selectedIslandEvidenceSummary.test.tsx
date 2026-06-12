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
        liveEvidenceRead={{
          state: 'compatibility',
          headline: 'Modeling-core trace available for this run',
          sourceAuthority: 'Legacy affinity snapshots remain the active live-app read for island-1; they are not modeling-core source authority.',
          provenance: 'Ratings and observed behavior are visible, but projection provenance is not canonical here.',
          compatibilityNote: 'Trace availability does not make this panel a canonical projection viewer.',
          affinitySummary: 'Visible affinity estimates: 1',
          rdSummary: 'Top confidence: 0.500',
          volatilitySummary: 'Top volatility: 0.080'
        }}
        statedRevealedDiagnostic={{
          userId: 'user-1',
          islandId: 'island-1',
          explicitRating: -1,
          inferredRating: 1,
          explicitPolarity: 'negative',
          inferredPolarity: 'positive',
          state: 'stated-negative-revealed-positive',
          explanation: 'The player said dislike, but the inferred evidence suggests instrumental engagement.',
          provenance: 'Black-box upstream engagement feed',
          sourceSystem: 'upstream-telemetry',
          sourceVersion: 'v1',
          confidence: 0.9
        }}
        pairEvidenceViewModel={{
          userId: 'user-1',
          islandId: 'island-1',
          explicitStated: {
            category: 'explicit-stated-rating-evidence',
            state: 'canonical',
            current: null,
            currentEpoch: null,
            currentIslandEpoch: { world: 0, island: 0 },
            freshness: 'context-unknown',
            historical: [],
            superseded: [],
            note: 'Current explicit stated rating is version-aware.'
          },
          inferredRevealed: {
            category: 'inferred-revealed-preference-evidence',
            state: 'compatibility',
            current: null,
            currentEpoch: null,
            currentIslandEpoch: { world: 0, island: 0 },
            freshness: 'context-unknown',
            records: [],
            historical: [],
            note: 'Legacy inferred revealed-preference evidence lacks refresh version context.'
          },
          syntheticObservedBehavior: {
            category: 'synthetic-observed-behavior',
            state: 'compatibility',
            records: [],
            note: 'Synthetic observed behavior is generated from explicit rating events.'
          },
          refreshContext: {
            category: 'refresh-revision-context',
            state: 'canonical',
            activeGameRulesVersionId: 'game-rules-v1',
            activeIslandVersionId: 'island:island-1:v1',
            refreshEvents: [],
            note: 'Refresh and revision context controls current evidence eligibility without deleting history.'
          },
          diagnostics: {
            userId: 'user-1',
            islandId: 'island-1',
            explicitRating: -1,
            inferredRating: 1,
            explicitPolarity: 'negative',
            inferredPolarity: 'positive',
            state: 'stated-negative-revealed-positive',
            explanation: 'The player said dislike, but the inferred evidence suggests instrumental engagement.',
            provenance: 'Black-box upstream engagement feed',
            sourceSystem: 'upstream-telemetry',
            sourceVersion: 'v1',
            confidence: 0.9,
            category: 'diagnostic-interpretation'
          }
        }}
      />
    );

    expect(html).toContain('Selected island evidence');
    expect(html).toContain('Current confidence and directional affinity are separate diagnostic/proxy reads');
    expect(html).toContain('Audience read');
    expect(html).toContain('Confidence &amp; stability');
    expect(html).toContain('Evidence provenance');
    expect(html).toContain('Evidence state');
    expect(html).toContain('Legacy affinity snapshots remain the active live-app read');
    expect(html).toContain('trace available for this run');
    expect(html).toContain('Hidden proxy rows:');
    expect(html).toContain('hidden constellation points:');
    expect(html).toContain('>1<');
    expect(html).toContain('Island / Cohort Rating Timeline');
    expect(html).not.toContain('Island Evidence Distribution');
    expect(html).not.toContain('Experimental analyst evidence-shape read');
    expect(html).not.toContain('Rating Event Weight');
    expect(html).toContain('Synthetic observed behavior');
    expect(html).toContain('generated from explicit rating events');
    expect(html).toContain('Behavior events');
    expect(html).toContain('Stated vs revealed');
    expect(html).toContain('stated-negative-revealed-positive');
    expect(html).toContain('Canonical pair evidence');
    expect(html).toContain('explicit-stated-rating-evidence');
    expect(html).toContain('inferred-revealed-preference-evidence');
    expect(html).toContain('synthetic-observed-behavior');
    expect(html).toContain('refresh-revision-context');
  });
});

