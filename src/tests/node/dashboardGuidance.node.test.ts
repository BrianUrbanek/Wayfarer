import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_ORDERINGS,
  DASHBOARD_ORDERING_LABELS,
  getUseCaseStory,
  USE_CASE_STORIES
} from '../../ui/dashboardGuidance.js';

describe('dashboard guidance data', () => {
  it('exposes the expected story set', () => {
    assert.ok(USE_CASE_STORIES.length >= 8);
    assert.equal(getUseCaseStory('first-time-walkthrough').title, 'First-time walkthrough');
    assert.equal(
      getUseCaseStory('find-unexplained-high-signal-users').goal,
      'Surface users whose behavior is predictive but not well explained by current cohorts.'
    );
    assert.equal(getUseCaseStory('compare-organic-vs-guided').title, 'Compare organic vs guided learning');
  });

  it('keeps dashboard ordering explicit and user directed', () => {
    assert.deepEqual(DASHBOARD_ORDERINGS['overview-first'], ['overview', 'recovery', 'routing', 'debug']);
    assert.deepEqual(DASHBOARD_ORDERINGS['recovery-first'], ['recovery', 'overview', 'routing', 'debug']);
    assert.equal(DASHBOARD_ORDERING_LABELS['routing-first'], 'Routing first');
  });
});
