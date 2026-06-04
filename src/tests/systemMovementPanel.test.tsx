import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SystemMovementPanel } from '../ui/components/SystemMovementPanel';
import type { SystemMovementAnalysis } from '../model/systemMovement';

describe('SystemMovementPanel', () => {
  it('renders a slider-driven post-run movement view with signal legend', () => {
    const analysis: SystemMovementAnalysis = {
      maxEvidenceWeight: 8,
      auditRows: [
        {
          turn: 2,
          islandId: 'island-1',
          islandLabel: 'Brass Orchard',
          dominantSignal: 'narrow-appeal',
          profilePosition: 0.35,
          previousProfilePosition: 0.12,
          profileDelta: 0.23,
          legibility: 0.71,
          previousLegibility: 0.5,
          legibilityDelta: 0.21,
          evidenceWeight: 8,
          previousEvidenceWeight: 4,
          evidenceDelta: 4,
          averageConfidence: 0.7,
          minConfidence: 0.62,
          averageVolatility: 0.04,
          positiveCohortCount: 2,
          negativeCohortCount: 0,
          unresolvedCohortCount: 0,
          movementScore: 0.44,
          moverReason: 'narrow-appeal; dominant delta: profile'
        }
      ],
      signalCounts: {
        'narrow-appeal': 1,
        'broad-appeal': 0,
        'polarized-appeal': 0,
        'coverage-gap': 0,
        contradiction: 0,
        volatility: 0
      },
      frames: [
        {
          turn: 2,
          domain: { xMin: 0.04, xMax: 0.43, yMin: 0.42, yMax: 0.8 },
          summary: {
            islandCount: 1,
            movingIslandCount: 1,
            coverageGapCount: 0,
            contradictionCount: 0,
            volatilityCount: 0,
            averageLegibility: 0.71,
            totalEvidenceWeight: 8
          },
          points: [
            {
              turn: 2,
              islandId: 'island-1',
              islandLabel: 'Brass Orchard',
              profilePosition: 0.35,
              legibility: 0.71,
              evidenceWeight: 8,
              averageConfidence: 0.7,
              minConfidence: 0.62,
              averageVolatility: 0.04,
              positiveCohortCount: 2,
              negativeCohortCount: 0,
              unresolvedCohortCount: 0,
              dominantSignal: 'narrow-appeal',
              trail: [{ turn: 1, profilePosition: 0.12, legibility: 0.5 }]
            }
          ]
        }
      ]
    };

    const html = renderToString(<SystemMovementPanel analysis={analysis} />);

    expect(html).toContain('System Movement');
    expect(html).toContain('Total movement in learned audience fit and legibility');
    expect(html).toContain('Dominant signal type legend');
    expect(html).toContain('Narrow Appeal');
    expect(html).toContain('Coverage Gap');
    expect(html).toContain('Turn 2');
    expect(html).toContain('Brass Orchard');
    expect(html).toContain('Fit to run');
    expect(html).toContain('Export movement JSON');
    expect(html).toContain('Movement audit');
    expect(html).toContain('Legibility / stability');
    expect(html).toContain('Negative affinity is information; uncertainty is risk.');
  });
});
