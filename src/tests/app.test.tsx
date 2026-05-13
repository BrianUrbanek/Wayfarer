import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App';

describe('App analyst console', () => {
  it('renders the analyst console sections and preset-first novice setup', () => {
    const html = renderToString(<App initialGuidanceMode="novice" />);

    expect(html).toContain('Wayfarer analyst console');
    expect(html).toContain('Primary workflow');
    expect(html).toContain('Population Summary');
    expect(html).toContain('Selected User Summary');
    expect(html).toContain('Rater signal profile');
    expect(html).toContain('Cohort-local island affinity');
    expect(html).toContain('Discovery Routing');
    expect(html).toContain('Reviewer Archetype Recovery');
    expect(html).toContain('Turn Summary');
    expect(html).toContain('Novice');
    expect(html).toContain('Expert');
    expect(html).toContain('Novice keeps the instructional rails open and the raw controls hidden.');
    expect(html).toContain('Read path');
    expect(html).toContain('Demo narrative');
    expect(html).toContain('Guided task journey');
    expect(html).toContain('Drilldown targets');
    expect(html).toContain('Pinned reference');
    expect(html).toContain('Scenario preset');
    expect(html).toContain('Simulation JSON');
    expect(html).toContain('Golden Demo');
    expect(html).toContain('Small Smoke Test');
    expect(html).toContain('Turn behavior / Dynamic settings');
    expect(html).not.toContain('Bootstrap Ratings / User');
    expect(html).not.toContain('Rating count policy');
    expect(html).not.toContain('Organic Ratings / User');
    expect(html).not.toContain('Tag Alignment');
    expect(html).not.toContain('Rating Alignment');
    expect(html).not.toContain('Participating Users / Turn');
    expect(html).not.toContain('Turns to Run');
    expect(html).toContain('Open About');
    expect(html).toContain('Show debug');
    expect(html).toContain('Take 1 Turn');
    expect(html).toContain('Export');
    expect(html).toContain('Import');
    expect(html).toContain('First-time walkthrough');
    expect(html).toContain('System use case');
    expect(html).toContain('Player journey');
    expect(html).toContain('Shared steps');
    expect(html).toContain('Expected system result');
    expect(html).toContain('Expected player result');
    expect(html).not.toContain('Model Explanation');
    expect(html).not.toContain('Island Comparison');
    expect(html).not.toContain('Pseudo-Cohort Reports');
    expect(html).not.toContain('Debug Data');
    expect(html).not.toContain('Passive');
    expect(html).not.toContain('Active Discovery Turns');
  });

  it('renders expert preset controls', () => {
    const html = renderToString(<App initialGuidanceMode="expert" />);

    expect(html).toContain('Scenario preset');
    expect(html).toContain('Bootstrap Ratings / User');
    expect(html).toContain('Tag Alignment');
    expect(html).toContain('Rating Alignment');
    expect(html).toContain('Turn Mode');
    expect(html).toContain('Participation Model');
    expect(html).toContain('Turns to Run');
    expect(html).toContain('Expert exposes the resolved controls so you can inspect and edit the preset directly.');
  });
});
