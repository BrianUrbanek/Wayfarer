import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLiveIslandEvidenceRead, buildLiveUserEvidenceRead } from '../../ui/liveEvidenceAdapter.js';
import { buildActiveRunModelEvidence } from '../../ui/modelingLab/activeRunModelEvidence.js';
import { getScenarioPresetMetadata } from '../../model/scenarioPresets.js';

describe('live evidence adapter', () => {
  it('reports a degraded compatibility state when only live proxy data exists', () => {
    const userRead = buildLiveUserEvidenceRead({
      user: { id: 'u-1', label: 'User 1', declaredTags: [], ratings: {} as never },
      inference: null,
      signalProfile: null,
      activeRunEvidence: null
    });

    assert.equal(userRead.state, 'degraded');
    assert.match(userRead.sourceAuthority, /No signal profile exists/);
    assert.match(userRead.compatibilityNote, /compatibility\/degraded bridge/);
  });

  it('reports a compatibility state when an attached modeling trace exists', () => {
    const activeRunEvidence = buildActiveRunModelEvidence({ scenarioPreset: getScenarioPresetMetadata('golden-demo') });
    const userRead = buildLiveUserEvidenceRead({
      user: null,
      inference: null,
      signalProfile: null,
      activeRunEvidence
    });
    const islandRead = buildLiveIslandEvidenceRead({
      islandId: 'island-1',
      affinityReport: null,
      activeRunEvidence
    });

    assert.equal(userRead.state, 'compatibility');
    assert.equal(islandRead.state, 'compatibility');
    assert.match(userRead.headline, /trace available/i);
    assert.match(islandRead.headline, /trace available/i);
  });
});
