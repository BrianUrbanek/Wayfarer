import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_ORDERINGS,
  DASHBOARD_ORDERING_LABELS,
  GUIDED_PATHS,
  getGuidedPath
} from '../../ui/dashboardGuidance.js';
import { getScenarioPreset } from '../../model/scenarioPresets.js';

describe('dashboard guidance data', () => {
  it('exposes the expected guided path set', () => {
    assert.equal(GUIDED_PATHS.length, 2);
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
      path.recommendedOrdering,
      path.framing.system,
      path.framing.experience,
      path.maintenanceNote,
      ...path.steps.flatMap((step) => [step.title, step.instruction, step.why ?? '', step.targetModuleId ?? '']),
      ...path.successCriteria
    ])
      .join(' ')
      .toLowerCase();

    for (const path of GUIDED_PATHS) {
      assert.ok(path.id);
      assert.ok(path.title);
      assert.ok(path.recommendedPreset);
      assert.ok(path.recommendedOrdering);
      assert.ok(path.framing.system);
      assert.ok(path.framing.experience);
      assert.ok(path.steps.length > 0);
      assert.ok(path.successCriteria.length > 0);
      assert.ok(path.maintenanceNote);
    }

    assert.ok(allText.includes('choose user'));
    assert.ok(allText.includes('choose island'));
    assert.ok(allText.includes('pin island'));
    assert.ok(allText.includes('inspect top route'));
    assert.ok(allText.includes('data fitness'));
    assert.ok(allText.includes('turn summary'));
    assert.ok(allText.includes('selected user summary'));
    assert.ok(allText.includes('selected island'));
    assert.ok(allText.includes('reviewer archetype recovery'));
    assert.ok(!allText.includes('drilldown targets'));
    assert.ok(!allText.includes('use debug first ordering'));
    assert.ok(!allText.includes('group-first'));
  });

  it('keeps dashboard ordering explicit and user directed', () => {
    assert.deepEqual(DASHBOARD_ORDERINGS['overview-first'], ['overview', 'recovery', 'routing', 'debug']);
    assert.deepEqual(DASHBOARD_ORDERINGS['recovery-first'], ['recovery', 'overview', 'routing', 'debug']);
    assert.equal(DASHBOARD_ORDERING_LABELS['routing-first'], 'Routing first');
  });
});
