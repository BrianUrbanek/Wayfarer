import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCohorts } from '../../data/defaultCohorts.js';

describe('default cohorts analyst names', () => {
  it('provides analyst-facing names for seeded cohorts', () => {
    const cohorts = createDefaultCohorts();
    assert.equal(cohorts.length > 0, true);
    assert.equal(cohorts.every((cohort) => typeof cohort.analystName === 'string' && cohort.analystName.length > 0), true);
  });
});
