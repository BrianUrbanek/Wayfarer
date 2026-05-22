import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TurnRecapModal, TurnRecapPanel } from '../ui/overview/TurnRecapPanel';
import type { TurnRecapReport } from '../model/turnRecap';

function makeReport(overrides: Partial<TurnRecapReport> = {}): TurnRecapReport {
  return {
    status: 'movers',
    statusLabel: 'Meaningful movers',
    statusTone: 'accent',
    summarySentence: 'Turn 1 created 4 ratings; the biggest mover was Island 1 / Action with affinity up +0.200.',
    caveatCopy: 'Turn recap compares the latest turn/update boundary against the previous boundary using stored island/cohort rating snapshots.',
    currentTurn: 1,
    previousTurn: 0,
    turnMode: 'organic',
    ratingsCreated: 4,
    organicRatingsCreated: 4,
    guidedRatingsCreated: 0,
    meaningfulMoverCount: 1,
    rows: [
      {
        islandId: 'island-1',
        islandLabel: 'Island 1',
        cohortId: 'cohort-a',
        cohortLabel: 'Action',
        comparisonAvailable: true,
        currentTurn: 1,
        previousTurn: 0,
        currentAffinity: 0.3,
        previousAffinity: 0.1,
        affinityDelta: 0.2,
        currentConfidence: 0.7,
        previousConfidence: 0.4,
        confidenceDelta: 0.3,
        currentRatingDeviation: 0.25,
        previousRatingDeviation: 0.55,
        ratingDeviationDelta: -0.3,
        currentVolatility: 0.05,
        previousVolatility: 0.08,
        volatilityDelta: -0.03,
        currentEffectiveWeight: 3,
        previousEffectiveWeight: 1,
        effectiveWeightDelta: 2,
        currentEvidenceCount: 3,
        previousEvidenceCount: 1,
        evidenceCountDelta: 2,
        moverKind: 'affinity',
        moverLabel: 'Affinity',
        moverDirectionLabel: 'up +0.200',
        score: 0.3
      }
    ],
    highlightRows: [
      {
        islandId: 'island-1',
        islandLabel: 'Island 1',
        cohortId: 'cohort-a',
        cohortLabel: 'Action',
        comparisonAvailable: true,
        currentTurn: 1,
        previousTurn: 0,
        currentAffinity: 0.3,
        previousAffinity: 0.1,
        affinityDelta: 0.2,
        currentConfidence: 0.7,
        previousConfidence: 0.4,
        confidenceDelta: 0.3,
        currentRatingDeviation: 0.25,
        previousRatingDeviation: 0.55,
        ratingDeviationDelta: -0.3,
        currentVolatility: 0.05,
        previousVolatility: 0.08,
        volatilityDelta: -0.03,
        currentEffectiveWeight: 3,
        previousEffectiveWeight: 1,
        effectiveWeightDelta: 2,
        currentEvidenceCount: 3,
        previousEvidenceCount: 1,
        evidenceCountDelta: 2,
        moverKind: 'affinity',
        moverLabel: 'Affinity',
        moverDirectionLabel: 'up +0.200',
        score: 0.3
      }
    ],
    hasComparison: true,
    ...overrides
  };
}

describe('turn recap panel', () => {
  it('renders a compact summary card and modal proof copy', () => {
    const html = renderToString(
      <TurnRecapPanel
        report={makeReport()}
      />
    );

    expect(html).toContain('Turn Recap');
    expect(html).toContain('Meaningful movers');
    expect(html).toContain('Inspect detail');
    expect(html).toContain('Ratings created');
    expect(html).toContain('Meaningful movers');
    expect(html).toContain('Turn 1 created 4 ratings; the biggest mover was Island 1 / Action with affinity up +0.200.');
  });

  it('renders a bootstrap state without dense comparison rows', () => {
    const html = renderToString(
      <TurnRecapPanel
        report={makeReport({
          status: 'bootstrap',
          statusLabel: 'Bootstrap turn',
          statusTone: 'warning',
          summarySentence: 'This is the bootstrap turn, so the recap shows the current baseline instead of a turn-over-turn delta.',
          currentTurn: 0,
          previousTurn: null,
          hasComparison: false,
          meaningfulMoverCount: 0,
          highlightRows: [],
          rows: []
        })}
      />
    );

    expect(html).toContain('Bootstrap turn');
    expect(html).toContain('No prior turn yet');
    expect(html).toContain('No meaningful movers this turn');
  });

  it('renders modal detail rows', () => {
    const html = renderToString(
      <TurnRecapModal report={makeReport()} open onClose={() => undefined} />
    );

    expect(html).toContain('Turn recap details');
    expect(html).toContain('Affinity movers');
    expect(html).toContain('Island 1');
    expect(html).toContain('Affinity');
    expect(html).toContain('Turn delta');
    expect(html).toContain('Turn recap compares the latest turn/update boundary against the previous boundary');
  });
});
