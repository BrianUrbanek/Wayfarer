import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App';

describe('App analyst console', () => {
  it('renders the novice cold-load start/import state without analysis panels', () => {
    const html = renderToString(<App initialGuidanceMode="novice" />);

    expect(html).toContain('Wayfarer analyst console');
    expect(html).toContain('Run Context');
    expect(html).toContain('Primary workflow');
    expect(html).toContain('Scenario utilities');
    expect(html).toContain('Golden Demo');
    expect(html).toContain('Choose a scenario or load a saved run.');
    expect(html).toContain('Novice');
    expect(html).toContain('Expert');
    expect(html).toContain('Novice keeps the instructional rails open while expert exposes the resolved controls.');
    expect(html).toContain('Guided path');
    expect(html).toContain('Guided paths');
    expect(html).toContain('Pinned reference controls');
    expect(html).toContain('Choose cohort');
    expect(html).toContain('Pinned reference');
    expect(html).toContain('Scenario preset');
    expect(html).toContain('Simulation JSON');
    expect(html).toContain('Golden Demo');
    expect(html).toContain('Demo report');
    expect(html).toContain(
      'Golden Demo is selected. You can inspect or advance the generated setup; execute the scenario to unlock the portfolio proof path and demo report.'
    );
    expect(html).not.toContain('Population Summary');
    expect(html).not.toContain('Selected User Summary');
    expect(html).not.toContain('Rater signal profile (internal)');
    expect(html).not.toContain('Current signal-weight proxy');
    expect(html).not.toContain('Cohort-local island affinity');
    expect(html).not.toContain('Discovery Routing');
    expect(html).not.toContain('Confidence Growth');
    expect(html).not.toContain('Reviewer Archetype Recovery');
    expect(html).not.toContain('Bootstrap Ratings / User');
    expect(html).not.toContain('Rating count policy');
    expect(html).not.toContain('Organic Ratings / User');
    expect(html).not.toContain('Tag Alignment');
    expect(html).not.toContain('Rating Alignment');
    expect(html).not.toContain('Participating Users / Turn');
    expect(html).not.toContain('Turns to Run');
    expect(html).toContain('Open About');
    expect(html).toContain('Show debug');
    expect(html).toContain('Execute Scenario');
    expect(html).toContain('Take 1 Turn');
    expect(html).toContain('Timing log');
    expect(html).toContain('Export');
    expect(html).toContain('Import');
    expect(html).toContain('Run Start');
    expect(html).not.toContain('Model Explanation');
    expect(html).not.toContain('Island Comparison');
    expect(html).not.toContain('Pseudo-Cohort Reports');
    expect(html).not.toContain('Debug Data');
    expect(html).not.toContain('Passive');
    expect(html).not.toContain('Active Discovery Turns');
    expect(html).not.toContain('False Positives Preview');
    expect(html).not.toContain('False Negatives Preview');
  });

  it('renders expert preset controls', () => {
    const html = renderToString(<App initialGuidanceMode="expert" />);

    expect(html).toContain('Scenario preset');
    expect(html).toContain('Scenario utilities');
    expect(html).toContain('Bootstrap Ratings / User');
    expect(html).toContain('Tag Alignment');
    expect(html).toContain('Rating Alignment');
    expect(html).not.toContain('Actionability proxy');
    expect(html).toContain('Turn behavior / Dynamic settings');
    expect(html).toContain('Expert scenario tuning');
    expect(html).toContain('Demo report');
    expect(html).toContain('Turn Mode');
    expect(html).toContain('Participation Model');
    expect(html).toContain('Turns to Run');
    expect(html).toContain('Seed on execute');
    expect(html).toContain('Execute Scenario');
    expect(html).toContain('Expert keeps the same run-context choices visible and exposes the resolved controls.');
    expect(html).toContain('Current turn explanation');
    expect(html).toContain('Mode explanation');
    expect(html).toContain('Rating events explanation');
    expect(html).toContain('Discovery probes explanation');
  });
});
