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
    assert.equal(USE_CASE_STORIES.length, 7);
    assert.equal(getUseCaseStory('first-time-walkthrough').title, 'First-time walkthrough');
    assert.equal(
      getUseCaseStory('inspect-cohort-local-signal').systemUseCase.title,
      'Cohort-local rater signal'
    );
    assert.equal(getUseCaseStory('compare-organic-guided-mixed').playerJourney.title, 'Three valid ways to discover content');
  });

  it('keeps paired narrative fields and avoids stale terminology', () => {
    const allText = USE_CASE_STORIES.flatMap((story) => [
      story.title,
      story.systemUseCase.title,
      story.systemUseCase.description,
      story.systemUseCase.detail,
      story.playerJourney.title,
      story.playerJourney.description,
      story.playerJourney.detail,
      ...story.sharedSteps,
      story.expectedSystemResult,
      story.expectedPlayerResult,
      ...story.failureSigns
    ])
      .join(' ')
      .toLowerCase();

    for (const story of USE_CASE_STORIES) {
      assert.ok(story.systemUseCase.title);
      assert.ok(story.systemUseCase.description);
      assert.ok(story.systemUseCase.detail);
      assert.ok(story.playerJourney.title);
      assert.ok(story.playerJourney.description);
      assert.ok(story.playerJourney.detail);
      assert.ok(story.sharedSteps.length > 0);
      assert.ok(story.expectedSystemResult);
      assert.ok(story.expectedPlayerResult);
      assert.ok(story.failureSigns.length > 0);
    }

    assert.ok(!allText.includes('passive'));
    assert.ok(!allText.includes('active discovery'));
    assert.ok(!allText.includes('tina-like detached predictor'));
  });

  it('keeps dashboard ordering explicit and user directed', () => {
    assert.deepEqual(DASHBOARD_ORDERINGS['overview-first'], ['overview', 'recovery', 'routing', 'debug']);
    assert.deepEqual(DASHBOARD_ORDERINGS['recovery-first'], ['recovery', 'overview', 'routing', 'debug']);
    assert.equal(DASHBOARD_ORDERING_LABELS['routing-first'], 'Routing first');
  });
});
