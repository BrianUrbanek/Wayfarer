import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App';

describe('App scaffold', () => {
  it('renders the Wayfarer explainability dashboard', () => {
    const html = renderToString(<App />);

    expect(html).toContain('Wayfarer');
    expect(html).toContain('Wayfarer explainability dashboard');
    expect(html).toContain('Seeded Meta-Moderators');
    expect(html).toContain('Generated Users');
    expect(html).toContain('Island Ratings');
    expect(html).toContain('Model Output');
    expect(html).toContain('Pseudo-Cohorts');
  });
});
