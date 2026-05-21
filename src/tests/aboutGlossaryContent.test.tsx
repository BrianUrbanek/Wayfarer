import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AboutGlossaryContent } from '../ui/components/AboutGlossaryContent';

describe('about glossary content', () => {
  it('renders markdown primer content and glossary rows', () => {
    const html = renderToString(<AboutGlossaryContent />);

    expect(html).toContain('Concept Primer');
    expect(html).toContain('Content Discovery Under Uncertainty');
    expect(html).toContain('Trust belongs to raters');
    expect(html).toContain('The generator also has hidden truth layers');
    expect(html).toContain('Glossary');
    expect(html).toContain('rating-event-weight');
    expect(html).toContain('confidence-snapshot');
  });
});
