import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App';

describe('App analyst console', () => {
  it('renders the analyst console sections', () => {
    const html = renderToString(<App />);

    expect(html).toContain('Wayfarer analyst console');
    expect(html).toContain('Population Summary');
    expect(html).toContain('Selected User Summary');
    expect(html).toContain('Model Explanation');
    expect(html).toContain('Island Comparison');
    expect(html).toContain('Pseudo-Cohort Reports');
    expect(html).toContain('Debug Data');
    expect(html).toContain('Turn Summary');
    expect(html).toContain('About / Prior Art');
    expect(html).toContain('Take 1 Turn');
  });
});
