import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import App from '../App';

describe('App scaffold', () => {
  it('renders the Wayfarer placeholder dashboard', () => {
    const html = renderToString(<App />);

    expect(html).toContain('Wayfarer');
    expect(html).toContain('Placeholder dashboard');
    expect(html).toContain('Users');
    expect(html).toContain('Pseudo-Cohorts');
  });
});
