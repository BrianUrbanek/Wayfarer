import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfidenceCompositeSummary } from '../../model/confidenceComposite.js';

describe('confidence composite helper', () => {
  it('treats low RD, low volatility, and evidence as high confidence', () => {
    const summary = buildConfidenceCompositeSummary({
      ratingDeviation: 0.12,
      volatility: 0.08,
      evidenceCount: 6
    });

    assert.equal(summary.band, 'high');
    assert.equal(summary.score >= 0.75, true);
    assert.equal(summary.evidenceState, 'strong');
    assert.equal(summary.uncertaintyState, 'sparse');
    assert.equal(summary.volatilityState, 'sparse');
  });

  it('treats high RD as low confidence even when evidence exists', () => {
    const summary = buildConfidenceCompositeSummary({
      ratingDeviation: 0.9,
      volatility: 0.12,
      evidenceCount: 6
    });

    assert.equal(summary.band, 'low');
    assert.equal(summary.score <= 0.4, true);
    assert.equal(summary.uncertaintyState, 'strong');
  });

  it('caps confidence when volatility is high but evidence is present', () => {
    const summary = buildConfidenceCompositeSummary({
      ratingDeviation: 0.2,
      volatility: 0.84,
      evidenceCount: 8
    });

    assert.equal(summary.band, 'mixed');
    assert.equal(summary.score <= 0.65, true);
    assert.equal(summary.volatilityState, 'strong');
  });

  it('returns no confidence when evidence is absent', () => {
    const summary = buildConfidenceCompositeSummary({
      ratingDeviation: 0.18,
      volatility: 0.1,
      evidenceCount: 0
    });

    assert.equal(summary.band, 'none');
    assert.equal(summary.score, 0);
    assert.equal(summary.evidenceState, 'none');
  });

  it('raises confidence when RD is lower with evidence and volatility held constant', () => {
    const highRd = buildConfidenceCompositeSummary({
      ratingDeviation: 0.82,
      volatility: 0.14,
      evidenceCount: 6
    });
    const lowRd = buildConfidenceCompositeSummary({
      ratingDeviation: 0.18,
      volatility: 0.14,
      evidenceCount: 6
    });

    assert.equal(lowRd.score > highRd.score, true);
  });

  it('raises confidence when volatility is lower with evidence and RD held constant', () => {
    const highVolatility = buildConfidenceCompositeSummary({
      ratingDeviation: 0.22,
      volatility: 0.88,
      evidenceCount: 6
    });
    const lowVolatility = buildConfidenceCompositeSummary({
      ratingDeviation: 0.22,
      volatility: 0.08,
      evidenceCount: 6
    });

    assert.equal(lowVolatility.score > highVolatility.score, true);
  });
});
