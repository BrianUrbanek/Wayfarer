import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AboutGlossaryContent } from '../ui/components/AboutGlossaryContent';
import { GLOSSARY_TERMS } from '../ui/glossary';

describe('about glossary content', () => {
  it('renders the jump control with generated glossary options and stable anchors', () => {
    const html = renderToString(<AboutGlossaryContent />);

    expect(html).toContain('Jump to definition');
    expect(html).toContain('id="glossary-jump"');
    expect(html).toContain('Select a term...');
    expect(html).toContain('Confidence Composite');
    expect(html).toContain('Oracle / Test Generator Truth');
    expect(html).toContain('composite UX read');

    for (const term of GLOSSARY_TERMS) {
      expect(html).toContain(`<option value="${term.id}">${term.term}</option>`);
      expect(html).toContain(`id="${term.id}"`);
    }
  });
});
