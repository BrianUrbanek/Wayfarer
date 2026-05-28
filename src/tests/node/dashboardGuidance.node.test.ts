import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GUIDED_PATHS, getGuidedPath } from '../../ui/dashboardGuidance.js';
import { getScenarioPreset } from '../../model/scenarioPresets.js';
import { GUIDED_TARGET_IDS, isGuidedTargetId } from '../../ui/guidedPath/guidedPathTypes.js';

describe('dashboard guidance data', () => {
  it('exposes the expected guided path set', () => {
    assert.equal(GUIDED_PATHS.length, 4);
    assert.equal(getGuidedPath('run-start').title, 'Run Start');
    assert.equal(getGuidedPath('portfolio-reviewer').title, 'Portfolio Reviewer');
    assert.equal(getGuidedPath('navigation-tutorial').title, 'Navigation Tutorial');
    assert.equal(getGuidedPath('analyst-workflow').recommendedPreset, 'golden-demo');
    assert.equal(getScenarioPreset('small-smoke-test').id, 'small-smoke-test');
    assert.equal(getScenarioPreset('golden-demo').id, 'golden-demo');
  });

  it('keeps the new guided paths and avoids stale terminology', () => {
    const allText = GUIDED_PATHS.flatMap((path) => [
      path.id,
      path.title,
      path.recommendedPreset,
      path.framing.system,
      path.framing.experience,
      path.maintenanceNote,
      ...path.steps.flatMap((step) => [step.title, step.body, step.why ?? '', step.targetId ?? '']),
      ...path.successCriteria
    ])
      .join(' ')
      .toLowerCase();

    for (const path of GUIDED_PATHS) {
      assert.ok(path.id);
      assert.ok(path.title);
      assert.ok(path.recommendedPreset);
      assert.ok(path.framing.system);
      assert.ok(path.framing.experience);
      assert.ok(path.steps.length > 0);
      assert.ok(path.successCriteria.length > 0);
      assert.ok(path.maintenanceNote);
    }

    assert.ok(allText.includes('choose scenario'));
    assert.ok(allText.includes('execute or import'));
    assert.ok(allText.includes('turn recap'));
    assert.ok(allText.includes('hidden cohort recovery'));
    assert.ok(allText.includes('truth alignment'));
    assert.ok(allText.includes('discovery routing'));
    assert.ok(allText.includes('demo report'));
    assert.ok(allText.includes('portfolio review'));
    assert.ok(allText.includes('data fitness'));
    assert.ok(allText.includes('turn summary'));
    assert.ok(allText.includes('selected user summary'));
    assert.ok(allText.includes('selected island'));
    assert.ok(allText.includes('reviewer archetype recovery'));
    assert.ok(!allText.includes('drilldown targets'));
    assert.ok(!allText.includes('recommended ordering'));
    assert.ok(!allText.includes('debug first ordering'));

    assert.equal(GUIDED_TARGET_IDS.includes('primary-workflow'), true);
    assert.equal(GUIDED_TARGET_IDS.includes('execute-scenario'), true);
    assert.equal(GUIDED_TARGET_IDS.includes('turn-recap'), true);
    assert.equal(GUIDED_TARGET_IDS.includes('hidden-cohort-recovery'), true);
    assert.equal(GUIDED_TARGET_IDS.includes('selected-island-truth'), true);
    assert.equal(GUIDED_TARGET_IDS.includes('demo-report'), true);
    assert.equal(GUIDED_TARGET_IDS.includes('turn-summary'), true);
    assert.equal(isGuidedTargetId('turn-summary'), true);
    assert.equal(isGuidedTargetId('made-up-target'), false);

    for (const path of GUIDED_PATHS) {
      for (const step of path.steps) {
        if (step.targetId) {
          assert.equal(GUIDED_TARGET_IDS.includes(step.targetId), true);
        }
      }
    }
  });
});
