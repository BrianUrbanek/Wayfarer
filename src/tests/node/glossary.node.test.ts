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
});
