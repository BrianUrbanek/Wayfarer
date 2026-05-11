import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App';

describe('App analyst console', () => {
  it('renders the analyst console sections', () => {
    const html = renderToString(<App />);

    expect(html).toContain('Wayfarer analyst console');
    expect(html).toContain('Population Summary');
    expect(html).toContain('Selected User Summary');
    expect(html).toContain('Rater signal profile');
    expect(html).toContain('Cohort-local island affinity');
    expect(html).toContain('Discovery Routing');
    expect(html).toContain('Model Explanation');
    expect(html).toContain('Island Comparison');
    expect(html).toContain('Pseudo-Cohort Reports');
    expect(html).toContain('Reviewer Archetype Recovery');
    expect(html).toContain('Debug Data');
    expect(html).toContain('Turn Summary');
    expect(html).toContain('Turn mode');
    expect(html).toContain('About');
    expect(html).toContain('Hidden generator archetype');
    expect(html).toContain('Take 1 Turn');
  });
});
