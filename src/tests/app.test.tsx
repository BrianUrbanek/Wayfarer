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
    expect(html).toContain('Novice');
    expect(html).toContain('Expert');
    expect(html).toContain('Dashboard ordering');
    expect(html).toContain('Use Case / Story');
    expect(html).toContain('Instruction panel');
    expect(html).toContain('Drilldown targets');
    expect(html).toContain('Pinned drilldown');
    expect(html).toContain('Turn behavior / Dynamic settings');
    expect(html).toContain('Rating count policy');
    expect(html).toContain('Organic Exploration');
    expect(html).toContain('Bootstrap Ratings / User');
    expect(html).toContain('Participating Users / Turn');
    expect(html).toContain('Organic Ratings / User');
    expect(html).toContain('Turns to Run');
    expect(html).toContain('Goal');
    expect(html).toContain('About');
    expect(html).toContain('Hidden generator archetype');
    expect(html).toContain('Take 1 Turn');
    expect(html).toContain('First-time walkthrough');
  });
});
