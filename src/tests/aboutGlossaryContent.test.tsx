import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AboutGlossaryContent } from '../ui/components/AboutGlossaryContent';

describe('about glossary content', () => {
  it('renders markdown primer content and glossary rows', () => {
    const html = renderToString(<AboutGlossaryContent />);

    expect(html).toContain('Concept Primer');
    expect(html).toContain('Trust, Discovery Signal, and Confidence');
    expect(html).toContain('Wayfarer draws from adjacent ideas');
    expect(html).toContain('Glossary');
    expect(html).toContain('rating-event-weight');
    expect(html).toContain('confidence-snapshot');
  });
});
