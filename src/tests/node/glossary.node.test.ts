import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GLOSSARY_TERMS,
  REQUIRED_GLOSSARY_TERMS,
  glossaryTermById,
  type GlossaryImplementedStatus,
  type GlossaryScope
} from '../../ui/glossary.js';

describe('glossary data', () => {
  it('includes required glossary terms with unique ids', () => {
    const ids = GLOSSARY_TERMS.map((term) => term.id);
    const uniqueIds = new Set(ids);

    assert.equal(uniqueIds.size, ids.length);

    for (const requiredId of REQUIRED_GLOSSARY_TERMS) {
      assert.ok(uniqueIds.has(requiredId), `Missing required glossary term: ${requiredId}`);
      assert.ok(glossaryTermById(requiredId));
    }
  });

  it('keeps glossary rows non-empty and related references valid', () => {
    const ids = new Set(GLOSSARY_TERMS.map((term) => term.id));
    const validScopes: GlossaryScope[] = ['player-facing', 'analyst-facing', 'internal', 'future-facing'];
    const validStatuses: GlossaryImplementedStatus[] = ['implemented', 'partial', 'future'];

    for (const term of GLOSSARY_TERMS) {
      assert.ok(term.term.trim().length > 0, `${term.id} missing term label`);
      assert.ok(term.shortDefinition.trim().length > 0, `${term.id} missing shortDefinition`);
      assert.ok(term.fullDefinition.trim().length > 0, `${term.id} missing fullDefinition`);
      assert.ok(validScopes.includes(term.scope), `${term.id} has invalid scope`);
      assert.ok(validStatuses.includes(term.implementedStatus), `${term.id} has invalid implementedStatus`);

      for (const relatedId of term.relatedTerms ?? []) {
        assert.ok(ids.has(relatedId), `${term.id} references unknown related term: ${relatedId}`);
      }
    }
  });

  it('preserves focused discoverability semantics', () => {
    assert.match(glossaryTermById('source-authority')?.fullDefinition ?? '', /separate from what that player personally prefers/i);
    assert.match(glossaryTermById('inverse-signal')?.fullDefinition ?? '', /useful negative-polarity evidence/i);
    assert.match(glossaryTermById('seed-proxy')?.fullDefinition ?? '', /lane-local/i);
    assert.match(glossaryTermById('seed-proxy')?.fullDefinition ?? '', /does not mean the seed directly rated/i);
    assert.match(glossaryTermById('unsupported-concept')?.fullDefinition ?? '', /silently approximated/i);
  });

  it('defines the canonical issue 82 evidence taxonomy terms', () => {
    const expectedTerms = [
      'explicit-stated-rating-evidence',
      'inferred-revealed-preference-evidence',
      'synthetic-observed-behavior',
      'external-observed-behavior',
      'projected-model-evidence',
      'diagnostic-interpretation',
      'refresh-revision-context',
      'compatibility-proxy-evidence'
    ] as const;

    for (const termId of expectedTerms) {
      const term = glossaryTermById(termId);
      assert.ok(term, `Missing canonical taxonomy term: ${termId}`);
      assert.match(term.fullDefinition, /not|separate|distinct|preserve|context|compatibility/i);
    }

    assert.match(glossaryTermById('confidence-composite')?.fullDefinition ?? '', /not a model primitive/i);
    assert.match(glossaryTermById('rating-deviation')?.fullDefinition ?? '', /not confidence/i);
    assert.match(glossaryTermById('volatility')?.fullDefinition ?? '', /not ignorance/i);
    assert.match(glossaryTermById('source-authority')?.fullDefinition ?? '', /not global trust/i);
  });
});
